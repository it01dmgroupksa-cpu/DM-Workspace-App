package com.dmworkspaceapp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.telecom.DisconnectCause
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService

/**
 * Every push arrives here first (the manifest gives this service a higher priority than
 * Expo's). A call push rings natively, whatever state the app is in: closed, in the
 * background or open. Nothing here waits for JavaScript, the network or LiveKit before
 * ringing. Every other push goes on to Expo as before.
 *
 * Call pushes come straight from the panel through Firebase, or through Expo's push
 * service; CallPush reads both. The moment the phone rings it tells the panel (ackUrl),
 * so the caller sees "Ringing".
 */
class CallMessagingService : ExpoFirebaseMessagingService() {
  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    val push = try {
      CallPush.parse(remoteMessage.data)
    } catch (e: Exception) {
      Telemetry.problem("unreadable push", e)
      null
    } ?: return super.onMessageReceived(remoteMessage) // not about a call
    Telemetry.event(
      "native_push_received ${push.type} ${push.callId} via ${push.route}" +
        " priority=${remoteMessage.priority}/${remoteMessage.originalPriority}" +
        if (push.sentAt > 0) " age=${System.currentTimeMillis() - push.sentAt}ms" else "",
    )
    when (push.type) {
      // The call is over, or was answered on another device: stop ringing, and never
      // start if its ring is still on the way. Nothing to show.
      "call-cancel" -> {
        dismiss(this, push.callId)
        CallTelecom.cancelRinging(push.callId, DisconnectCause.REMOTE)
      }
      // Missed: stop the ring, then Expo shows "Missed call from X" like any message.
      "missed-call" -> {
        dismiss(this, push.callId)
        CallTelecom.cancelRinging(push.callId, DisconnectCause.MISSED)
        if (push.route == "expo") super.onMessageReceived(remoteMessage)
      }
      else -> ring(push)
    }
  }

  private fun ring(push: CallPush) {
    if (!push.valid()) return Telemetry.problem("call push without a valid call or chat id: not rung")
    if (push.expired()) {
      CallRegistry.settle(this, push.callId)
      return Telemetry.event("late call push ignored ${push.callId}")
    }
    if (!IncomingCalls.present(this, IncomingCall.from(push), "push:${push.route}")) return
    // It is ringing: tell the panel, so the caller sees "Ringing".
    CallPush.post(push.ackUrl, "ringing confirmation ${push.callId}")
    CallTelecom.ringing(this, push.callId, push.conversationId, push.title, push.video)
    // The app is open: its call screen follows the call from here on.
    DmCallsModule.emit("DmCallsIncoming", push.callId)
  }

  companion object {
    // A new id whenever a channel's settings change: they are fixed once created. Both
    // channels are silent, because the ringtone and vibration have one owner: Ringer.
    // A channel sound as well would ring twice.
    const val CHANNEL = "incoming_calls_v4"
    // The same alert while the app itself is in front (its call screen is open): no pop-up.
    private const val CHANNEL_IN_APP = "incoming_calls_in_app"
    private val OLD_CHANNELS = listOf("incoming_calls_v2", "incoming_calls_v3")
    const val ID = 7001

    // Stops the call alert, the ringtone and the call screen: answered, declined,
    // cancelled or missed. With the call's id, it also can never ring again.
    fun dismiss(context: Context, callId: String? = null) {
      CallRegistry.settle(context, callId)
      // A stop for some other call must not silence the one ringing.
      val ringing = RingService.current
      if (callId != null && ringing != null && ringing.callId != callId) return
      RingService.stop(context)
      Ringer.stop()
      IncomingCallActivity.close()
      (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(ID)
    }

    fun ensureChannels(nm: NotificationManager) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      OLD_CHANNELS.forEach { nm.deleteNotificationChannel(it) }
      if (nm.getNotificationChannel(CHANNEL) == null) {
        val channel = NotificationChannel(CHANNEL, "Incoming calls", NotificationManager.IMPORTANCE_HIGH)
        channel.description = "Shows who is calling, with Answer and Decline"
        channel.setSound(null, null)
        channel.enableVibration(false)
        channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        nm.createNotificationChannel(channel)
      }
      if (nm.getNotificationChannel(CHANNEL_IN_APP) == null) {
        val channel = NotificationChannel(CHANNEL_IN_APP, "Incoming calls while the app is open", NotificationManager.IMPORTANCE_LOW)
        channel.setSound(null, null)
        channel.enableVibration(false)
        channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        nm.createNotificationChannel(channel)
      }
    }

    // The call-style alert with Answer and Decline. Tapping it, and the full-screen intent
    // on a locked phone, open the native call screen.
    fun buildIncomingCall(context: Context, call: IncomingCall, quiet: Boolean): Notification {
      ensureChannels(context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
      val screen = CallActions.screenPending(context, call)
      val caller = Person.Builder().setName(call.title).setImportant(true).build()
      val builder = NotificationCompat.Builder(context, if (quiet) CHANNEL_IN_APP else CHANNEL)
        .setSmallIcon(R.drawable.ic_notification)
        .setContentTitle(call.title)
        .setContentText(call.text.ifEmpty { if (call.video) "Incoming video call" else "Incoming voice call" })
        .setStyle(
          NotificationCompat.CallStyle.forIncomingCall(
            caller,
            CallActions.declinePending(context, call),
            CallActions.answerPending(context, call),
          ).setIsVideo(call.video),
        )
        .setCategory(NotificationCompat.CATEGORY_CALL)
        .setPriority(if (quiet) NotificationCompat.PRIORITY_LOW else NotificationCompat.PRIORITY_MAX)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setContentIntent(screen)
        .setOngoing(true)
        .setAutoCancel(false)
        .setOnlyAlertOnce(true)
        .setWhen(System.currentTimeMillis())
      if (!quiet) builder.setFullScreenIntent(screen, true)
      return builder.build()
    }
  }
}
