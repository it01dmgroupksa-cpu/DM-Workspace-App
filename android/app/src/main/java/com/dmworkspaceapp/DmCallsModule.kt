package com.dmworkspaceapp

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.PowerManager
import android.provider.Settings
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
