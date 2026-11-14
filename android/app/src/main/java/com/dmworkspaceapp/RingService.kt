package com.dmworkspaceapp

import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * Rings one incoming call, without JavaScript. A foreground service (type phoneCall) keeps
 * the app alive for the whole ring, plays the one ringtone (Ringer) and shows the call
 * alert with Answer and Decline.
 *
 * The call screen (IncomingCallActivity) is opened the ways Android intends:
 *  - phone locked or screen off: the alert's full-screen intent;
 *  - phone in use, another app in front: the alert pops up as a call banner;
 *  - the app itself in front: the screen is opened directly.
 *
 * Stopped by CallMessagingService.dismiss(): answered, declined, cancelled, missed; or by
 * itself when the ringing window closes.
 */
class RingService : Service() {
  private val handler = Handler(Looper.getMainLooper())

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val call = IncomingCall.fromIntent(intent)
    if (call == null) {
      stopSelf()
      return START_NOT_STICKY
    }
    // A duplicate start for the call already ringing changes nothing.
    if (current?.callId == call.callId) return START_NOT_STICKY
    current = call
    // The app is in front: its own call screen opens, so the alert stays out of the way.
    val inApp = MainActivity.resumed
    val notification = CallMessagingService.buildIncomingCall(this, call, quiet = inApp)
    try {
      val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL else 0
      ServiceCompat.startForeground(this, CallMessagingService.ID, notification, type)
      Telemetry.event("foreground_service_started ${call.callId}")
    } catch (e: Exception) {
      // Not allowed to be a foreground service here: show the alert the ordinary way.
      Telemetry.problem("foreground_service_refused ${call.callId}", e)
      (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(CallMessagingService.ID, notification)
    }
    Telemetry.event("notification_displayed ${call.callId}" + if (inApp) " (in app)" else " full_screen_intent_requested")
    Ringer.start(this)
    if (inApp) {
      try {
        startActivity(CallActions.screenIntent(this, call))
      } catch (e: Exception) {
        Telemetry.problem("call screen could not open in app ${call.callId}", e)
      }
    }
    handler.removeCallbacksAndMessages(null)
    handler.postDelayed({
      Telemetry.event("ring timed out ${call.callId}")
      CallRegistry.settle(this, call.callId)
      stopSelf()
    }, CallPush.RING_MS)
    return START_NOT_STICKY
  }

  override fun onDestroy() {
    Telemetry.event("ring_service_stopped ${current?.callId ?: ""}")
    current = null
    handler.removeCallbacksAndMessages(null)
    Ringer.stop()
    IncomingCallActivity.close()
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  companion object {
    // The call ringing right now, if any.
    @Volatile
    var current: IncomingCall? = null
      private set

    fun start(context: Context, call: IncomingCall) {
      ContextCompat.startForegroundService(context, Intent(context, RingService::class.java).putExtras(call.toExtras()))
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, RingService::class.java))
    }
  }
}
