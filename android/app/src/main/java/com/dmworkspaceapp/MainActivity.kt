package com.dmworkspaceapp

import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle

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
