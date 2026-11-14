package com.dmworkspaceapp

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// The call alert's Decline button when the panel sent a declineUrl: declines without
// opening the app (Android doesn't allow opening it from here anyway).
class CallActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != DECLINE) return
    val call = IncomingCall.fromIntent(intent) ?: return
    CallActions.decline(context, call, canOpenApp = false)
  }

  companion object {
    const val DECLINE = "com.dmworkspaceapp.DECLINE_CALL"
  }
}
