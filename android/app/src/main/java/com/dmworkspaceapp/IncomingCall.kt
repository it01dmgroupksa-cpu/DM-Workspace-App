package com.dmworkspaceapp

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Bundle
import android.telecom.DisconnectCause

/**
 * One ringing call, as carried between the push, the ring service, the call alert and
 * the native call screen, plus what Answer and Decline do. `callId == TEST` is the
 * diagnostics screen's test call: it rings and shows, but nothing is sent anywhere.
 */
data class IncomingCall(
  val callId: String,
  val conversationId: String,
  val video: Boolean,
  val title: String,
  val text: String,
  val declineUrl: String,
) {
  val isTest get() = callId == TEST

  fun toExtras() = Bundle().apply {
    putString("callId", callId)
    putString("conversationId", conversationId)
    putBoolean("video", video)
    putString("title", title)
    putString("text", text)
    putString("declineUrl", declineUrl)
  }

  companion object {
    const val TEST = "test"

    fun from(push: CallPush) =
      IncomingCall(push.callId, push.conversationId, push.video, push.title, push.text, push.declineUrl)

    fun test() = IncomingCall(TEST, "", false, "Test call", "This is how a call rings", "")

    fun fromIntent(intent: Intent?): IncomingCall? {
      val e = intent?.extras ?: return null
      val callId = e.getString("callId") ?: return null
      return IncomingCall(
        callId,
        e.getString("conversationId") ?: "",
        e.getBoolean("video", false),
        e.getString("title") ?: "Incoming call",
        e.getString("text") ?: "",
        e.getString("declineUrl") ?: "",
      )
    }
  }
}

/**
 * The one way a call starts ringing on this phone, whoever noticed it first: the push
 * (app closed, in the background or open) or the app's live stream (app open, push late).
 * Rings at most once per call, and never over another call.
 */
object IncomingCalls {
  // True when this call is now ringing because of this request.
  fun present(context: Context, call: IncomingCall, source: String): Boolean {
    if (!call.isTest) {
      // Already talking: the call screen offers "End call & answer" itself (call waiting).
      if (OngoingCallService.running) {
        Telemetry.event("incoming ${call.callId} via $source not rung: on a call")
        return false
      }
      val ringing = RingService.current
      if (ringing != null && ringing.callId != call.callId) {
        Telemetry.event("incoming ${call.callId} via $source not rung: ${ringing.callId} is ringing")
        return false
      }
      if (!CallRegistry.claim(context, call.callId)) {
        Telemetry.event("incoming ${call.callId} via $source ignored: already handled")
        return false
      }
    }
    Telemetry.event("incoming_call_validated ${call.callId} via $source")
    try {
      RingService.start(context, call)
    } catch (e: Exception) {
      // Android refused the service (the push lost its high priority, or a phone maker's
      // restriction): still show the call alert and ring for as long as the app may run.
      Telemetry.problem("foreground_service_refused ${call.callId}", e)
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.notify(CallMessagingService.ID, CallMessagingService.buildIncomingCall(context, call, quiet = false))
      Telemetry.event("notification_displayed ${call.callId} (no service)")
      Ringer.start(context)
    }
    return true
  }
}

object CallActions {
  // The native call screen, over the lock screen or whatever is open.
  fun screenIntent(context: Context, call: IncomingCall): Intent =
    Intent(context, IncomingCallActivity::class.java)
      .putExtras(call.toExtras())
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_NO_USER_ACTION)

  fun screenPending(context: Context, call: IncomingCall): PendingIntent =
    PendingIntent.getActivity(
      context,
      4,
      screenIntent(context, call),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  // The alert's Decline button. With the panel's declineUrl it declines right here,
  // without opening the app; without it, the app opens and declines (as before).
  fun declinePending(context: Context, call: IncomingCall): PendingIntent =
    if (call.declineUrl.isNotEmpty() || call.isTest)
      PendingIntent.getBroadcast(
        context,
        5,
        Intent(context, CallActionReceiver::class.java).setAction(CallActionReceiver.DECLINE).putExtras(call.toExtras()),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )
    else CallLinks.pending(context, "decline", 3, call.callId, call.conversationId, call.video)

  fun answerPending(context: Context, call: IncomingCall): PendingIntent =
    if (call.isTest) declinePending(context, call)
    else CallLinks.pending(context, "answer", 2, call.callId, call.conversationId, call.video)

  // Answer: stop ringing and open the app on the answer link; JavaScript joins the call.
  fun answer(context: Context, call: IncomingCall) {
    Telemetry.event("answer_pressed ${call.callId}")
    CallMessagingService.dismiss(context, call.callId)
    if (call.isTest) return
    context.startActivity(CallLinks.intent(context, "answer", call.callId, call.conversationId, call.video))
  }

  // Decline. `canOpenApp`: called from a screen the person is looking at, so opening the
  // app to decline is allowed when there is no declineUrl.
  fun decline(context: Context, call: IncomingCall, canOpenApp: Boolean) {
    Telemetry.event("decline_pressed ${call.callId}")
    CallMessagingService.dismiss(context, call.callId)
    if (call.isTest) return
    CallTelecom.end(call.callId, DisconnectCause.REJECTED)
    when {
      call.declineUrl.isNotEmpty() -> CallPush.post(call.declineUrl, "decline ${call.callId}")
      canOpenApp -> context.startActivity(CallLinks.intent(context, "decline", call.callId, call.conversationId, call.video))
      else -> Telemetry.problem("decline without declineUrl or app: ${call.callId}")
    }
  }
}
