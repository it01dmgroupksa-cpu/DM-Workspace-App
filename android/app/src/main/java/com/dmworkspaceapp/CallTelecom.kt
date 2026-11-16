package com.dmworkspaceapp

import android.app.NotificationManager
import android.content.Context
import android.net.Uri
import android.os.Build
import android.telecom.DisconnectCause
import androidx.core.telecom.CallAttributesCompat
import androidx.core.telecom.CallControlScope
import androidx.core.telecom.CallEndpointCompat
import androidx.core.telecom.CallsManager
import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.util.concurrent.ConcurrentHashMap

/**
 * Tells Android's Telecom about each call (a "self-managed" call, as WhatsApp does), so:
 *  - a Bluetooth headset, car or watch can answer and hang up,
 *  - a normal phone call arriving mid-call is handled by the system as call waiting,
 *  - the speaker / earpiece / Bluetooth choice goes through the system.
 *
 * The call itself (LiveKit) and its screen stay in JavaScript; this only mirrors it.
 * Everything here is best effort: if Telecom refuses, the call carries on without it.
 * Set ENABLED to false to switch the whole thing off.
 */
object CallTelecom {
  private const val ENABLED = true
  private const val RING_MS = 45_000L

  private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
  private var manager: CallsManager? = null

  private class Live(val conversationId: String, val incoming: Boolean, val video: Boolean) {
    @Volatile var control: CallControlScope? = null
    @Volatile var answered = false
    @Volatile var ended = false
    @Volatile var endpoints: List<CallEndpointCompat> = emptyList()
    @Volatile var current: CallEndpointCompat? = null
    // The Speaker button's choice; null until it is pressed (the system's own default).
    @Volatile var speaker: Boolean? = null
    val done = CompletableDeferred<Unit>()
  }

  private val calls = ConcurrentHashMap<String, Live>()

  private fun manager(context: Context): CallsManager? {
    if (!ENABLED || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return null
    manager?.let { return it }
    return try {
      CallsManager(context.applicationContext).also {
        it.registerAppWithTelecom(
          CallsManager.CAPABILITY_BASELINE or CallsManager.CAPABILITY_SUPPORTS_VIDEO_CALLING,
        )
        manager = it
      }
    } catch (e: Exception) {
      null
    }
  }

  // An incoming call is ringing (from the push, the app may be closed).
  fun ringing(context: Context, callId: String, conversationId: String, name: String, video: Boolean) {
    add(context, callId, conversationId, name, video, incoming = true)
  }

  // The call screen started or answered a call. Already known when it rang here.
  fun started(context: Context, callId: String, conversationId: String, name: String, video: Boolean, incoming: Boolean) {
    add(context, callId, conversationId, name, video, incoming)
  }

  private fun add(context: Context, callId: String, conversationId: String, name: String, video: Boolean, incoming: Boolean) {
    if (callId.isEmpty() || calls.containsKey(callId)) return
    val telecom = manager(context) ?: return
    val live = Live(conversationId, incoming, video)
    calls[callId] = live
    val attributes = CallAttributesCompat(
      displayName = name,
      address = Uri.fromParts("dmworkspace", callId, null),
      direction = if (incoming) CallAttributesCompat.DIRECTION_INCOMING else CallAttributesCompat.DIRECTION_OUTGOING,
      callType = if (video) CallAttributesCompat.CALL_TYPE_VIDEO_CALL else CallAttributesCompat.CALL_TYPE_AUDIO_CALL,
      callCapabilities = 0, // no hold
    )
    val app = context.applicationContext
    scope.launch {
      try {
        telecom.addCall(
          attributes,
          onAnswer = { _ -> systemAnswered(app, callId) },
          onDisconnect = { _ -> systemHungUp(app, callId) },
          onSetActive = {},
          onSetInactive = {},
        ) {
          live.control = this
          launch {
            availableEndpoints.collect {
              live.endpoints = it
              keepRoute(live)
            }
          }
          // Telecom picks its own route when the call is answered or goes active (the
          // earpiece for a voice call): put back the person's choice.
          launch {
            currentCallEndpoint.collect {
              live.current = it
              keepRoute(live)
            }
          }
          // Ended before Telecom was ready: end it now.
          if (live.ended) launch { disconnect(DisconnectCause(DisconnectCause.LOCAL)) }
          launch { live.done.await() }
        }
      } catch (e: Exception) {
        calls.remove(callId)
      }
    }
    // Nobody answered: Telecom must not think it is still ringing.
    if (incoming)
      scope.launch {
        delay(RING_MS)
        if (!live.answered) end(callId, DisconnectCause.MISSED)
      }
  }

  // The call is up: an incoming call is answered, an outgoing one goes active.
  fun connected(callId: String) {
    val live = calls[callId] ?: return
    if (live.answered) return
    live.answered = true
    scope.launch {
      try {
        val control = live.control ?: return@launch
        if (live.incoming)
          control.answer(if (live.video) CallAttributesCompat.CALL_TYPE_VIDEO_CALL else CallAttributesCompat.CALL_TYPE_AUDIO_CALL)
        else control.setActive()
        keepRoute(live)
      } catch (e: Exception) {
      }
    }
  }

  // A "stop ringing" push: ignored for a call already answered here (it was meant for the
  // person's other phones, or arrived late).
  fun cancelRinging(callId: String?, cause: Int) {
    val live = calls[callId ?: return] ?: return
    if (live.answered) return
    end(callId, cause)
  }

  fun end(callId: String?, cause: Int) {
    val live = calls.remove(callId ?: return) ?: return
    live.ended = true
    scope.launch {
      try {
        live.control?.disconnect(DisconnectCause(cause))
      } catch (e: Exception) {
      }
      live.done.complete(Unit)
    }
  }

  // Mirrors the Speaker button, so the system routes the sound the same way. Remembered for
  // the call: pressed while still ringing out, it holds once the other person answers.
  fun setSpeaker(on: Boolean) {
    val live = calls.values.firstOrNull { it.answered && !it.ended }
      ?: calls.values.firstOrNull { !it.ended }
      ?: return
    live.speaker = on
    Telemetry.event("speaker ${if (on) "on" else "off"}")
    keepRoute(live, force = true)
  }

  // Speaker or earpiece as chosen. A headset or Bluetooth the person switched to is left
  // alone: only the phone's own speaker and earpiece are swapped.
  private fun keepRoute(live: Live, force: Boolean = false) {
    val on = live.speaker ?: return
    val control = live.control ?: return
    val wanted = if (on) CallEndpointCompat.TYPE_SPEAKER else CallEndpointCompat.TYPE_EARPIECE
    val now = live.current?.type
    if (now == wanted) return
    if (!force && now != null && now != CallEndpointCompat.TYPE_SPEAKER && now != CallEndpointCompat.TYPE_EARPIECE) return
    val endpoint = live.endpoints.firstOrNull { it.type == wanted } ?: return
    scope.launch {
      try {
        val result = control.requestEndpointChange(endpoint)
        if (result !is androidx.core.telecom.CallControlResult.Success)
          Telemetry.event("speaker switch refused: $result")
      } catch (e: Exception) {
        Telemetry.problem("speaker switch failed", e)
      }
    }
  }

  // Answered from a headset, car or watch: open the app on the same link the Answer
  // button uses, so JavaScript joins the call one way only.
  private fun systemAnswered(context: Context, callId: String) {
    val live = calls[callId] ?: return
    try {
      context.startActivity(CallLinks.intent(context, "answer", callId, live.conversationId, live.video))
    } catch (e: Exception) {
    }
  }

  // Hung up from a headset, car or watch, or the system ended it (a phone call took over).
  private fun systemHungUp(context: Context, callId: String) {
    calls.remove(callId)?.done?.complete(Unit)
    CallMessagingService.dismiss(context, callId)
    DmCallsModule.emit("DmCallsHangup", callId)
  }
}
