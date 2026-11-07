package com.dmworkspaceapp

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.net.Uri
import android.os.Bundle
import android.provider.Settings

import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    setTheme(R.style.AppTheme)
    super.onCreate(null)
    showOverLockScreenForCall(intent)
    askForFullScreenCallAlerts()
  }

  // Android 14+ lets people switch off full-screen alerts for apps that aren't the phone
  // app, which would turn a ringing call into a quiet banner on a locked screen. Ask once.
  private fun askForFullScreenCallAlerts() {
    if (Build.VERSION.SDK_INT < 34) return
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (nm.canUseFullScreenIntent()) return
    val prefs = getSharedPreferences("dm_call_setup", Context.MODE_PRIVATE)
    if (prefs.getBoolean("asked_full_screen", false)) return
    prefs.edit().putBoolean("asked_full_screen", true).apply()
    try {
      startActivity(
        Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:$packageName")),
      )
    } catch (e: Exception) {
      // No such settings screen on this phone; calls still ring as a heads-up alert.
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    showOverLockScreenForCall(intent)
  }

  // Opened from the incoming call alert: appear over the lock screen and wake the screen.
  private fun showOverLockScreenForCall(i: Intent?) {
    if (i?.getBooleanExtra(EXTRA_CALL, false) != true) return
    if (Build.VERSION.SDK_INT >= 27) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    }
  }

  // Once the app is in front the call screen takes over; stop the alert ringing.
  override fun onResume() {
    super.onResume()
    (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager)
      .cancel(CallMessagingService.ID)
  }

  companion object {
    const val EXTRA_CALL = "dm_call"
  }

  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate(): ReactActivityDelegate {
    return ReactActivityDelegateWrapper(
      this,
      BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
      object : DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled) {},
    )
  }

  override fun invokeDefaultOnBackPressed() {
    if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
      if (!moveTaskToBack(false)) {
        super.invokeDefaultOnBackPressed()
      }
      return
    }
    super.invokeDefaultOnBackPressed()
  }
}
