package com.dmworkspaceapp

import android.app.ActivityManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService
import org.json.JSONObject

/**
 * Incoming call pushes ring like a phone call: the device's own ringtone and a
 * full-screen call alert over the lock screen. Every other push goes to Expo as before.
 * (The manifest gives this service a higher priority than Expo's.)
 */
class CallMessagingService : ExpoFirebaseMessagingService() {
  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    val data = remoteMessage.data
    val body = try { JSONObject(data["body"] ?: "{}") } catch (e: Exception) { JSONObject() }
    if (body.optString("type") != "call" || isAppInForeground()) {
      return super.onMessageReceived(remoteMessage)
    }
    showIncomingCall(data["title"] ?: "Incoming call", data["message"] ?: "")
  }

  private fun isAppInForeground(): Boolean {
    val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    val me = am.runningAppProcesses?.firstOrNull { it.pid == android.os.Process.myPid() }
    return me?.importance == ActivityManager.RunningAppProcessInfo.IMPORTANCE_FOREGROUND
  }

  private fun showIncomingCall(title: String, text: String) {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val ringtone = RingtoneManager.getActualDefaultRingtoneUri(this, RingtoneManager.TYPE_RINGTONE)
      ?: RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channel = NotificationChannel(CHANNEL, "Incoming calls", NotificationManager.IMPORTANCE_HIGH)
      channel.setSound(
        ringtone,
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
      channel.enableVibration(true)
      channel.vibrationPattern = longArrayOf(0, 800, 400, 800, 400, 800, 400, 800)
      channel.lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      channel.setBypassDnd(true)
      nm.createNotificationChannel(channel)
    }
    val open = Intent(this, MainActivity::class.java).apply {
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra(MainActivity.EXTRA_CALL, true)
    }
    val pending = PendingIntent.getActivity(
      this, 0, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val n = NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(R.drawable.ic_notification)
      .setContentTitle(title)
      .setContentText(text)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setPriority(NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setSound(ringtone, android.media.AudioManager.STREAM_RING)
      .setVibrate(longArrayOf(0, 800, 400, 800, 400, 800, 400, 800))
      .setContentIntent(pending)
      .setFullScreenIntent(pending, true)
      .setOngoing(true)
      .setAutoCancel(true)
      .setTimeoutAfter(45_000)
      .build()
    n.flags = n.flags or Notification.FLAG_INSISTENT // keep ringing until answered
    nm.notify(ID, n)
  }

  companion object {
    const val CHANNEL = "incoming_calls"
    const val ID = 7001
  }
}
