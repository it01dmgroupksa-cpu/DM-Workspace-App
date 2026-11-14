package com.dmworkspaceapp

import android.app.PictureInPictureParams
import android.content.res.Configuration
import android.util.Rational
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
    // Permissions calls need (notifications, full-screen calls, battery) are explained and
    // asked for in the app's Call check screen, only when the person taps a button there.
    // System settings are never opened by themselves.
  }

  override fun onResume() {
    super.onResume()
    resumed = true
  }

  override fun onPause() {
    resumed = false
    super.onPause()
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

  // The ring is not stopped when the app comes to the front: it has one owner, the native
  // RingService, until the call is answered, declined or over.

  // Video calls: leaving the app (Home, another app) shrinks the call into a floating
  // window instead of hiding it. The call screen turns this on only during a video call.
  fun updatePip() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
    try {
      setPictureInPictureParams(pipParams().setAutoEnterEnabled(pipWanted).build())
    } catch (e: Exception) {
    }
  }

  private fun pipParams() = PictureInPictureParams.Builder().setAspectRatio(Rational(9, 16))

  override fun onUserLeaveHint() {
    super.onUserLeaveHint()
    // Android 12+ enters by itself (auto-enter); older versions are asked here.
    if (!pipWanted || Build.VERSION.SDK_INT < Build.VERSION_CODES.O || Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) return
    try {
      enterPictureInPictureMode(pipParams().build())
    } catch (e: Exception) {
    }
  }

  override fun onPictureInPictureModeChanged(isInPictureInPictureMode: Boolean, newConfig: Configuration) {
    super.onPictureInPictureModeChanged(isInPictureInPictureMode, newConfig)
    DmCallsModule.emit("DmCallsPip", if (isInPictureInPictureMode) "1" else "0")
  }

  companion object {
    const val EXTRA_CALL = "dm_call"

    @Volatile
    var pipWanted = false

    // The app is on screen: an incoming call opens its call screen directly, no pop-up.
    @Volatile
    var resumed = false
      private set
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
