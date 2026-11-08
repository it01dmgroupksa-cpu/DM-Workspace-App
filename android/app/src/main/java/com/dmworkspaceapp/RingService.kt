package com.dmworkspaceapp

import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.view.View
import android.view.WindowManager
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat

/**
 * Rings an incoming call. A foreground service (type phoneCall) keeps the app alive for the
 * whole ring, plays the app's own ringtone and vibration (Ringer) and shows the call alert
 * with Answer and Decline. When the person has allowed "Display over other apps", it also
 * opens the call screen straight away, even on an unlocked phone, like a phone app.
 *
 * It is stopped by CallMessagingService.dismiss(): answered, declined, cancelled or missed.
 */
class RingService : Service() {
  private val handler = Handler(Looper.getMainLooper())
  private var overlay: View? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val callId = intent?.getStringExtra(EXTRA_CALL_ID) ?: ""
    val conversationId = intent?.getStringExtra(EXTRA_CONVERSATION_ID) ?: ""
    val video = intent?.getBooleanExtra(EXTRA_VIDEO, false) ?: false
    val notification = CallMessagingService.buildIncomingCall(
      this,
      title = intent?.getStringExtra(EXTRA_TITLE) ?: "Incoming call",
      text = intent?.getStringExtra(EXTRA_TEXT) ?: "",
      callId = callId,
      conversationId = conversationId,
      video = video,
    )
    try {
      val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL else 0
      ServiceCompat.startForeground(this, CallMessagingService.ID, notification, type)
    } catch (e: Exception) {
      // Not allowed to be a foreground service here: show the alert the ordinary way.
      (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(CallMessagingService.ID, notification)
    }
    Ringer.start(this)
    openCallScreen(callId, conversationId, video)
    handler.removeCallbacksAndMessages(null)
    handler.postDelayed({ stopSelf() }, RING_MS) // nobody answered
    return START_NOT_STICKY
  }

  // With "Display over other apps" allowed, Android lets the app open its screen from the
  // background. A one-pixel invisible overlay window is what makes that reliable on
  // Android 15, so it is shown for a moment around the launch.
  private fun openCallScreen(callId: String, conversationId: String, video: Boolean) {
    if (!Settings.canDrawOverlays(this)) return
    try {
      val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
      @Suppress("DEPRECATION")
      val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
      else WindowManager.LayoutParams.TYPE_PHONE
      val params = WindowManager.LayoutParams(
        1,
        1,
        type,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE,
        PixelFormat.TRANSLUCENT,
      )
      removeOverlay()
      val view = View(this)
      wm.addView(view, params)
      overlay = view
      startActivity(CallLinks.intent(this, "open", callId, conversationId, video))
      handler.postDelayed({ removeOverlay() }, 3000)
    } catch (e: Exception) {
      removeOverlay() // the alert's full-screen intent still covers a locked phone
    }
  }

  private fun removeOverlay() {
    val view = overlay ?: return
    overlay = null
    try {
      (getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(view)
    } catch (e: Exception) {
    }
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    removeOverlay()
    Ringer.stop()
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    super.onDestroy()
  }

  companion object {
    private const val RING_MS = 45_000L
    const val EXTRA_TITLE = "title"
    const val EXTRA_TEXT = "text"
    const val EXTRA_CALL_ID = "callId"
    const val EXTRA_CONVERSATION_ID = "conversationId"
    const val EXTRA_VIDEO = "video"

    fun start(context: Context, title: String, text: String, callId: String, conversationId: String, video: Boolean) {
      val intent = Intent(context, RingService::class.java)
        .putExtra(EXTRA_TITLE, title)
        .putExtra(EXTRA_TEXT, text)
        .putExtra(EXTRA_CALL_ID, callId)
        .putExtra(EXTRA_CONVERSATION_ID, conversationId)
        .putExtra(EXTRA_VIDEO, video)
      ContextCompat.startForegroundService(context, intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, RingService::class.java))
    }
  }
}
