package com.dmworkspaceapp

import android.app.Application
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

import com.livekit.reactnative.LiveKitReactNative
import com.livekit.reactnative.audio.AudioType

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      // DmCallsPackage: the call screen's native side (ongoing call, Telecom, PiP).
      packageList = PackageList(this).packages.apply { add(DmCallsPackage()) },
    )
  }

  override fun onCreate() {
    super.onCreate()
    // The call event trail (Call check screen, Crashlytics, logcat) before anything rings.
    Telemetry.attach(this)
    // Messenger calls: must run before React Native loads.
    LiveKitReactNative.setup(this, AudioType.CommunicationAudioType())
    // "Touch up" skin smoothing, offered to the call screen as the video effect "dm-beauty".
    BeautyProcessor.register()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (error: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}