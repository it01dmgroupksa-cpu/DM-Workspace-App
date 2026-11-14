package com.dmworkspaceapp

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * The JavaScript call screen's handle on Android's calling features (src/messenger/
 * nativeCalls.ts): the ongoing-call service, Telecom (Bluetooth, car and watch buttons),
 * the proximity sensor, picture-in-picture and the battery-saver exemption.
 *
 * Events back to JavaScript: DmCallsHangup (callId) and DmCallsPip ("1" / "0").
 * Every method swallows its own failures: a missing phone feature must never end a call.
 */
class DmCallsModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  init {
    instance = this
  }

  override fun getName() = NAME

  private var proximity: PowerManager.WakeLock? = null

  @ReactMethod
  fun callStarted(callId: String, conversationId: String, title: String, video: Boolean, incoming: Boolean) {
    try {
      OngoingCallService.start(context, callId, title, video)
    } catch (e: Exception) {
      // Not allowed right now (the app is not in front); the call still works while in view.
    }
    CallTelecom.started(context, callId, conversationId, title, video, incoming)
  }

  @ReactMethod
  fun callConnected(callId: String) {
    CallTelecom.connected(callId)
  }

  @ReactMethod
  fun callEnded(callId: String) {
    try {
      OngoingCallService.stop(context)
    } catch (e: Exception) {
    }
    CallTelecom.end(callId, android.telecom.DisconnectCause.LOCAL)
    setProximity(false)
  }

  // A call seen on the app's live stream (the push may be late or lost): ring it natively,
  // exactly as the push would. Ignored when the push already rang it (one ring per call).
  @ReactMethod
  fun presentIncoming(callId: String, conversationId: String, title: String, video: Boolean) {
    try {
      val call = IncomingCall(callId, conversationId, video, title.ifEmpty { "Incoming call" }, "", "")
      if (IncomingCalls.present(context, call, "stream"))
        CallTelecom.ringing(context, callId, conversationId, call.title, video)
    } catch (e: Exception) {
      Telemetry.problem("could not ring $callId from the live stream", e)
    }
  }

  // The call stopped ringing for this phone (answered, declined, cancelled, over): stop the
  // ringtone, the alert and the call screen, and never ring it again.
  @ReactMethod
  fun stopRinging(callId: String) {
    try {
      CallMessagingService.dismiss(context, callId)
    } catch (e: Exception) {
    }
  }

  // One id per installation, so the panel knows a phone's tokens belong to one phone.
  @ReactMethod
  fun deviceId(promise: Promise) {
    val prefs = context.getSharedPreferences("dm_device", Context.MODE_PRIVATE)
    promise.resolve(
      prefs.getString("id", null) ?: java.util.UUID.randomUUID().toString().also {
        prefs.edit().putString("id", it).apply()
      },
    )
  }

  @ReactMethod
  fun setSpeaker(on: Boolean) {
    CallTelecom.setSpeaker(on)
  }

  // Voice calls on the earpiece: the screen goes dark at the ear, so a cheek can't
  // press Mute or Hang up.
  @ReactMethod
  fun setProximity(on: Boolean) {
    try {
      if (!on) {
        proximity?.let { if (it.isHeld) it.release(PowerManager.RELEASE_FLAG_WAIT_FOR_NO_PROXIMITY) }
        proximity = null
        return
      }
      if (proximity?.isHeld == true) return
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      if (!pm.isWakeLockLevelSupported(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK)) return
      proximity = pm.newWakeLock(PowerManager.PROXIMITY_SCREEN_OFF_WAKE_LOCK, "dmworkspace:call-proximity").also {
        it.acquire(12 * 60 * 60 * 1000L) // released when the call ends; capped at 12 hours
      }
    } catch (e: Exception) {
    }
  }

  // Video calls shrink into a floating window when the person leaves the app.
  @ReactMethod
  fun setPip(on: Boolean) {
    MainActivity.pipWanted = on
    val activity = getCurrentActivity() as? MainActivity ?: return
    activity.runOnUiThread { activity.updatePip() }
  }

  @ReactMethod
  fun batteryExempt(promise: Promise) {
    try {
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      promise.resolve(pm.isIgnoringBatteryOptimizations(context.packageName))
    } catch (e: Exception) {
      promise.resolve(true) // can't tell: don't nag
    }
  }

  // Phones that save battery hard (Xiaomi, Huawei, Samsung) can hold back the call push.
  @ReactMethod
  fun requestBatteryExemption() {
    val ask = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    try {
      context.startActivity(ask)
    } catch (e: Exception) {
      try {
        context.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      } catch (e2: Exception) {
      }
    }
  }

  // ---- Call check (DiagnosticsScreen.tsx): everything that stops a call ringing. ----

  @ReactMethod
  fun diagnostics(promise: Promise) {
    try {
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      CallMessagingService.ensureChannels(nm)
      val granted = { p: String ->
        androidx.core.content.ContextCompat.checkSelfPermission(context, p) == android.content.pm.PackageManager.PERMISSION_GRANTED
      }
      val channelOn = Build.VERSION.SDK_INT < Build.VERSION_CODES.O ||
        (nm.getNotificationChannel(CallMessagingService.CHANNEL)?.importance ?: NotificationManager.IMPORTANCE_HIGH) >=
        NotificationManager.IMPORTANCE_HIGH
      val result = Arguments.createMap().apply {
        putBoolean("notifications", NotificationManagerCompat.from(context).areNotificationsEnabled())
        putBoolean("callAlerts", channelOn)
        putBoolean("fullScreen", Build.VERSION.SDK_INT < 34 || nm.canUseFullScreenIntent())
        putBoolean("microphone", granted(android.Manifest.permission.RECORD_AUDIO))
        putBoolean("camera", granted(android.Manifest.permission.CAMERA))
        putBoolean("battery", pm.isIgnoringBatteryOptimizations(context.packageName))
        putString("ringer", Ringer.modeName(am.ringerMode))
        putInt("ringVolume", am.getStreamVolume(AudioManager.STREAM_RING))
        putInt("ringVolumeMax", am.getStreamMaxVolume(AudioManager.STREAM_RING))
        putBoolean("dnd", nm.currentInterruptionFilter > NotificationManager.INTERRUPTION_FILTER_ALL)
        putString("device", "${Build.MANUFACTURER} ${Build.MODEL}")
        putString("android", "${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
        putBoolean("is64bit", Build.SUPPORTED_64_BIT_ABIS.isNotEmpty())
        putString("lastRing", Ringer.lastOutcome)
        putString("appVersion", BuildConfig.VERSION_NAME + " (" + BuildConfig.VERSION_CODE + ")")
      }
      promise.resolve(result)
    } catch (e: Exception) {
      promise.reject("diagnostics", e.message, e)
    }
  }

  // A "Fix" button: change the setting where Android lets an app, else open its screen.
  @ReactMethod
  fun fix(kind: String) {
    val pkg = Uri.parse("package:${context.packageName}")
    val am = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val screen: Intent = when (kind) {
      "notifications", "callAlerts" ->
        Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
      "fullScreen" ->
        if (Build.VERSION.SDK_INT >= 34) Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, pkg)
        else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg)
      "microphone", "camera" -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg)
      "battery" -> return requestBatteryExemption()
      "ringer" -> {
        try {
          am.ringerMode = AudioManager.RINGER_MODE_NORMAL
          return
        } catch (e: Exception) {
          Intent(Settings.ACTION_SOUND_SETTINGS) // Do Not Disturb holds it: let the person change it
        }
      }
      "volume" -> {
        try {
          val max = am.getStreamMaxVolume(AudioManager.STREAM_RING)
          am.setStreamVolume(AudioManager.STREAM_RING, max, AudioManager.FLAG_SHOW_UI)
          return
        } catch (e: Exception) {
          Intent(Settings.ACTION_SOUND_SETTINGS)
        }
      }
      "dnd" -> Intent(Settings.ACTION_SOUND_SETTINGS)
      else -> Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg)
    }
    try {
      context.startActivity(screen.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (e: Exception) {
      try {
        context.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, pkg).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      } catch (e2: Exception) {
      }
    }
  }

  @ReactMethod
  fun testRingtone(on: Boolean) {
    if (on) Ringer.start(context) else Ringer.stop()
  }

  // Rings and shows the native call screen exactly as a real call would, through the same
  // path (IncomingCalls); nothing is sent anywhere.
  @ReactMethod
  fun testCallScreen() {
    IncomingCalls.present(context, IncomingCall.test(), "test")
  }

  // The phone's own record of the latest call steps (Telemetry), for the Call check screen.
  @ReactMethod
  fun callEvents(promise: Promise) {
    promise.resolve(Telemetry.recent())
  }

  // ---- Forward to WhatsApp (ChatScreen.tsx) ----

  // Resolves how many WhatsApp apps were offered (0: none installed, nothing opened).
  // path: a file in the cache "share" folder, or null for text only.
  @ReactMethod
  fun shareToWhatsApp(path: String?, mime: String?, text: String?, promise: Promise) {
    try {
      promise.resolve(WhatsAppShare.share(context, reactApplicationContext.currentActivity, path, mime, text))
    } catch (e: Exception) {
      promise.reject("whatsapp", e.message ?: "Couldn't open WhatsApp.", e)
    }
  }

  // ---- Reports (telemetry.ts) ----

  @ReactMethod
  fun reportError(message: String, stack: String, fatal: Boolean) {
    Telemetry.jsError(message, stack, fatal)
  }

  @ReactMethod
  fun reportEvent(message: String) {
    Telemetry.event(message)
  }

  @ReactMethod
  fun setUser(id: String?) {
    Telemetry.setUser(id)
  }

  // Required by React Native's NativeEventEmitter.
  @ReactMethod
  fun addListener(eventName: String) {}

  @ReactMethod
  fun removeListeners(count: Double) {}

  override fun invalidate() {
    setProximity(false)
    if (instance === this) instance = null
    super.invalidate()
  }

  companion object {
    const val NAME = "DmCalls"

    @Volatile
    var instance: DmCallsModule? = null

    // True when JavaScript was there to hear it.
    fun emit(event: String, value: String?): Boolean {
      val module = instance ?: return false
      return try {
        if (!module.context.hasActiveReactInstance()) return false
        module.context.emitDeviceEvent(event, value)
        true
      } catch (e: Exception) {
        false
      }
    }
  }
}
