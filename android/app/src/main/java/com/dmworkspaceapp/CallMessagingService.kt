package com.dmworkspaceapp

import android.app.ActivityManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.AudioManager
import android.os.Build
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService
import org.json.JSONObject

/**
 * Incoming call pushes ring like a phone call, the way WhatsApp does: a call-style alert
 * with Answer and Decline, the device's own ringtone, and a full-screen call screen over
 * the lock screen. Every other push goes to Expo as before. The manifest gives this
 * service a higher priority than Expo's, so Firebase delivers to it first.
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
      (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(ID)
      CallTelecom.cancelRinging(body.optString("callId"), android.telecom.DisconnectCause.REMOTE)
      return
    }
    // Missed: stop the ring, then let Expo show "Missed call from X" like any message.
    if (body.optString("type") == "missed-call") {
      (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(ID)
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

  private fun ensureChannel(nm: NotificationManager) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || nm.getNotificationChannel(CHANNEL) != null) return
    // The system's default-ringtone pointer, not a copy of today's ringtone: it follows
    // whatever the person picks in Settings later, so this always matches their phone.
    val ringtone = Settings.System.DEFAULT_RINGTONE_URI
    val channel = NotificationChannel(CHANNEL, "Incoming calls", NotificationManager.IMPORTANCE_HIGH)
    channel.setSound(
      ringtone,
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build(),
    )
    channel.enableVibration(true)
    channel.vibrationPattern = VIBRATION
    channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
    channel.setBypassDnd(true)
    nm.createNotificationChannel(channel)
  }

  private fun showIncomingCall(title: String, text: String, callId: String, conversationId: String, video: Boolean) {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    ensureChannel(nm)
    val open = CallLinks.pending(this, "open", 1, callId, conversationId, video)
    val answer = CallLinks.pending(this, "answer", 2, callId, conversationId, video)
    val decline = CallLinks.pending(this, "decline", 3, callId, conversationId, video)
    val caller = Person.Builder().setName(title).setImportant(true).build()
    val n = NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(R.drawable.ic_notification)
      .setContentTitle(title)
      .setContentText(text)
      .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, decline, answer))
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      // Android 7: no channels, so the ringtone and vibration belong to the notification.
      .setSound(Settings.System.DEFAULT_RINGTONE_URI, AudioManager.STREAM_RING)
      .setVibrate(VIBRATION)
      .setContentIntent(open)
      .setFullScreenIntent(open, true)
      .setOngoing(true)
      .setAutoCancel(false)
      .setTimeoutAfter(RING_MS)
      .build()
    n.flags = n.flags or Notification.FLAG_INSISTENT // keep ringing until answered
    nm.notify(ID, n)
    CallTelecom.ringing(this, callId, conversationId, title, video)
  }

  companion object {
    // A new id whenever the channel's settings change: a channel's sound is fixed once created.
    const val CHANNEL = "incoming_calls_v2"
    const val ID = 7001
    private const val RING_MS = 45_000L
    private val VIBRATION = longArrayOf(0, 800, 400, 800, 400, 800, 400, 800)
  }
}
