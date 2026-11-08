package com.dmworkspaceapp

import android.app.ActivityManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService
import org.json.JSONObject

/**
 * Incoming call pushes ring like a phone call, the way WhatsApp does: a call-style alert
 * with Answer and Decline, the app's own ringtone (RingService), and a full-screen call
 * screen over the lock screen. Every other push goes to Expo as before. The manifest gives
 * this service a higher priority than Expo's, so Firebase delivers to it first.
 *
 * If anything here fails, the push is handed to Expo's ordinary notification instead, so
 * a call is never silently lost.
 */
class CallMessagingService : ExpoFirebaseMessagingService() {
  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    val data = remoteMessage.data
    val body = try { JSONObject(data["body"] ?: "{}") } catch (e: Exception) { JSONObject() }
    // The call is over, or was answered on another device: stop ringing. A silent push with
    // nothing to show, so it never goes to Expo (which would try to display it).
    if (body.optString("type") == "call-cancel") {
      dismiss(this)
      CallTelecom.cancelRinging(body.optString("callId"), android.telecom.DisconnectCause.REMOTE)
      return
    }
    // Missed: stop the ring, then let Expo show "Missed call from X" like any message.
    if (body.optString("type") == "missed-call") {
      dismiss(this)
      CallTelecom.cancelRinging(body.optString("callId"), android.telecom.DisconnectCause.MISSED)
      return super.onMessageReceived(remoteMessage)
    }
    if (body.optString("type") != "call" || isAppInForeground()) {
      return super.onMessageReceived(remoteMessage)
    }
    try {
      showIncomingCall(
        title = data["title"] ?: "Incoming call",
        text = data["message"] ?: "",
        callId = body.optString("callId"),
        conversationId = body.optString("conversationId"),
        video = body.optBoolean("video", false),
      )
    } catch (e: Exception) {
      super.onMessageReceived(remoteMessage)
    }
  }

  private fun isAppInForeground(): Boolean {
    val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    val me = am.runningAppProcesses?.firstOrNull { it.pid == android.os.Process.myPid() }
    return me?.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
  }

  private fun showIncomingCall(title: String, text: String, callId: String, conversationId: String, video: Boolean) {
    try {
      // The ring service shows the alert, plays the ringtone and opens the call screen.
      RingService.start(this, title, text, callId, conversationId, video)
    } catch (e: Exception) {
      // Not allowed to start it (rare): still show the alert and ring from here.
      val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.notify(ID, buildIncomingCall(this, title, text, callId, conversationId, video))
      Ringer.start(this)
    }
    CallTelecom.ringing(this, callId, conversationId, title, video)
  }

  companion object {
    // A new id whenever the channel's settings change: a channel's settings are fixed once
    // created. The channel is silent: the ringtone and vibration are played by Ringer.
    const val CHANNEL = "incoming_calls_v4"
    private val OLD_CHANNELS = listOf("incoming_calls_v2", "incoming_calls_v3")
    const val ID = 7001

    // Stops the call alert and the ringtone: answered, declined, cancelled or missed.
    fun dismiss(context: Context) {
      RingService.stop(context)
      Ringer.stop()
      (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(ID)
    }

    private fun ensureChannel(nm: NotificationManager) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || nm.getNotificationChannel(CHANNEL) != null) return
      OLD_CHANNELS.forEach { nm.deleteNotificationChannel(it) }
      val channel = NotificationChannel(CHANNEL, "Incoming calls", NotificationManager.IMPORTANCE_HIGH)
      channel.setSound(null, null)
      channel.enableVibration(false)
      channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      channel.setBypassDnd(true)
      nm.createNotificationChannel(channel)
    }

    // The call-style alert with Answer and Decline, and a full-screen call screen when locked.
    fun buildIncomingCall(
      context: Context,
      title: String,
      text: String,
      callId: String,
      conversationId: String,
      video: Boolean,
    ): Notification {
      ensureChannel(context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
      val open = CallLinks.pending(context, "open", 1, callId, conversationId, video)
      val answer = CallLinks.pending(context, "answer", 2, callId, conversationId, video)
      val decline = CallLinks.pending(context, "decline", 3, callId, conversationId, video)
      val caller = Person.Builder().setName(title).setImportant(true).build()
      return NotificationCompat.Builder(context, CHANNEL)
        .setSmallIcon(R.drawable.ic_notification)
        .setContentTitle(title)
        .setContentText(text)
        .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, decline, answer))
        .setCategory(NotificationCompat.CATEGORY_CALL)
        .setPriority(NotificationCompat.PRIORITY_MAX)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setContentIntent(open)
        .setFullScreenIntent(open, true)
        .setOngoing(true)
        .setAutoCancel(false)
        .setOnlyAlertOnce(true)
        .build()
    }
  }
}
