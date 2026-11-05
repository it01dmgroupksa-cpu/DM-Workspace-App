# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Durar Messenger calls: WebRTC and LiveKit are looked up from native code by name,
# so keep them if minification (android.enableMinifyInReleaseBuilds) is turned on.
-keep class org.webrtc.** { *; }
-keep class com.livekit.reactnative.** { *; }
-keep class com.oney.WebRTCModule.** { *; }
