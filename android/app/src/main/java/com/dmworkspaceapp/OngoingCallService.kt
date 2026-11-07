package com.dmworkspaceapp

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.Person
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * Runs for the whole of a call, the way WhatsApp's "Ongoing call" notification does.
 * Android only lets an app keep using the microphone and camera while it is out of sight
 * (screen locked, another app in front) if a foreground service of the right type is
 * running; without this a call goes silent the moment the phone is put in a pocket.
 *
 * Its notification has a Hang up button, which tells the JavaScript call screen.
 */
class OngoingCallService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_HANG_UP) {
      // The call screen (JavaScript) hangs up and then stops this service. If it is gone,
      // there is no call to keep alive.
      if (!DmCallsModule.emit("DmCallsHangup", intent.getStringExtra(EXTRA_CALL_ID))) stopSelf()
      return START_NOT_STICKY
    }
    show(
      callId = intent?.getStringExtra(EXTRA_CALL_ID) ?: "",
      title = intent?.getStringExtra(EXTRA_TITLE) ?: "Call",
      video = intent?.getBooleanExtra(EXTRA_VIDEO, false) ?: false,
    )
    return START_NOT_STICKY
  }

  private fun show(callId: String, title: String, video: Boolean) {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && nm.getNotificationChannel(CHANNEL) == null) {
      // Quiet: the call itself is the sound.
      val channel = NotificationChannel(CHANNEL, "Ongoing calls", NotificationManager.IMPORTANCE_LOW)
      channel.setSound(null, null)
      nm.createNotificationChannel(channel)
    }
    val open = PendingIntent.getActivity(
      this,
      10,
      Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val hangUp = PendingIntent.getService(
      this,
      11,
      Intent(this, OngoingCallService::class.java).setAction(ACTION_HANG_UP).putExtra(EXTRA_CALL_ID, callId),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val person = Person.Builder().setName(title).setImportant(true).build()
    val notification = NotificationCompat.Builder(this, CHANNEL)
      .setSmallIcon(R.drawable.ic_notification)
      .setContentTitle(title)
      .setContentText(if (video) "Ongoing video call" else "Ongoing voice call")
      .setStyle(NotificationCompat.CallStyle.forOngoingCall(person, hangUp))
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setUsesChronometer(true)
      .setWhen(System.currentTimeMillis())
      .setContentIntent(open)
      .build()
    // A phone call that uses the microphone (and the camera on a video call). The camera
    // type is only allowed once the camera permission is granted.
    var types = 0
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) types = ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
      if (video && granted(Manifest.permission.CAMERA)) types = types or ServiceInfo.FOREGROUND_SERVICE_TYPE_CAMERA
    }
    try {
      ServiceCompat.startForeground(this, ID, notification, types)
    } catch (e: Exception) {
      // Some phones refuse one of the types; the microphone matters most.
      try {
        val mic = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE else 0
        ServiceCompat.startForeground(this, ID, notification, mic)
      } catch (e2: Exception) {
        stopSelf() // the call goes on; it may just pause when the screen locks
      }
    }
  }

  private fun granted(permission: String) =
    ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED

  override fun onDestroy() {
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  companion object {
    const val CHANNEL = "ongoing_calls"
    const val ID = 7002
    const val ACTION_HANG_UP = "com.dmworkspaceapp.HANG_UP"
    const val EXTRA_CALL_ID = "callId"
    const val EXTRA_TITLE = "title"
    const val EXTRA_VIDEO = "video"

    fun start(context: Context, callId: String, title: String, video: Boolean) {
      val intent = Intent(context, OngoingCallService::class.java)
        .putExtra(EXTRA_CALL_ID, callId)
        .putExtra(EXTRA_TITLE, title)
        .putExtra(EXTRA_VIDEO, video)
      ContextCompat.startForegroundService(context, intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, OngoingCallService::class.java))
    }
  }
}
