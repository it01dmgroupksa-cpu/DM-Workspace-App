package com.dmworkspaceapp

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * A call push. The contract with the panel (lib/messenger/push.ts), the same on both routes:
 *
 *   data.title    the caller's name
 *   data.message  "Incoming voice call"
 *   data.body     JSON: { type, callId, conversationId, video, sentAt, ackUrl, declineUrl }
 *
 * Straight from the panel through Firebase (FCM HTTP v1, data-only, high priority) the
 * panel builds exactly that; through Expo's push service, Expo wraps the panel's data the
 * same way. `type` is "call", "call-cancel" or "missed-call".
 *
 *  - sentAt: when the panel sent it (epoch milliseconds), so a late push doesn't ring;
 *  - ackUrl: a signed link this phone POSTs to the moment it rings, so the caller sees
 *    "Ringing" and the panel stops re-sending;
 *  - declineUrl: a signed link that declines without the app having to start.
 *
 * Nothing in a push is trusted beyond showing and ringing: Answer always asks the panel
 * whether the call can still be taken.
 */
data class CallPush(
  val type: String,
  val route: String,
  val callId: String,
  val conversationId: String,
  val video: Boolean,
  val title: String,
  val text: String,
  val ackUrl: String,
  val declineUrl: String,
  val sentAt: Long,
) {
  // Rings for at most RING_MS after it was sent; an older push is a call that is over.
  // A phone whose clock is far behind would see every push as "from the future": those ring.
  fun expired(now: Long = System.currentTimeMillis()) = sentAt > 0 && now - sentAt > RING_MS

  // What a ring needs. A push that fails this is never shown as a call.
  fun valid() = UUID.matches(callId) && UUID.matches(conversationId)

  companion object {
    const val RING_MS = 45_000L
    private val UUID = Regex("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")

    // Null when the push is not about a call at all (a chat message: Expo's to show).
    fun parse(data: Map<String, String>): CallPush? {
      val body = try {
        JSONObject(data["body"] ?: return null)
      } catch (e: Exception) {
        return null
      }
      val type = body.optString("type")
      if (type != "call" && type != "call-cancel" && type != "missed-call") return null
      val link = { name: String -> body.optString(name).takeIf { it.startsWith("https://") } ?: "" }
      return CallPush(
        type = type,
        // Expo stamps its own pushes; anything else came straight from the panel.
        route = if (data.containsKey("experienceId") || data.containsKey("scopeKey") || data.containsKey("projectId")) "expo" else "fcm",
        callId = body.optString("callId"),
        conversationId = body.optString("conversationId"),
        video = body.optBoolean("video", false),
        title = data["title"].orEmpty().trim().take(80).ifEmpty { "Incoming call" },
        text = data["message"].orEmpty().trim().take(120),
        ackUrl = link("ackUrl"),
        declineUrl = link("declineUrl"),
        sentAt = body.optLong("sentAt", 0L),
      )
    }

    // POST to one of the panel's signed call links, off the main thread. Best effort: a
    // failed confirmation only means the panel sends the push once more.
    fun post(url: String, what: String) {
      if (!url.startsWith("https://")) return
      Thread {
        try {
          val c = URL(url).openConnection() as HttpURLConnection
          c.requestMethod = "POST"
          c.connectTimeout = 8000
          c.readTimeout = 8000
          c.doOutput = true
          c.setRequestProperty("Content-Type", "application/json")
          c.outputStream.use { it.write("{}".toByteArray()) }
          val code = c.responseCode
          c.disconnect()
          if (code in 200..299) Telemetry.event("$what sent")
          else Telemetry.problem("$what refused: HTTP $code")
        } catch (e: Exception) {
          Telemetry.problem("$what failed", e)
        }
      }.start()
    }
  }
}
