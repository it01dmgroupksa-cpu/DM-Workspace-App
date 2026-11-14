package com.dmworkspaceapp

import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri

/**
 * The app opens on a dmworkspace://call link; the JavaScript side (push.tsx) reads it
 * with Linking and answers, declines or shows the call. `kind` is open, answer or decline.
 *
 * React Native only reports an intent's link to JavaScript when the action is VIEW, so
 * every call intent carries it; without it Answer, Decline and a tap would be ignored.
 *
 * `title` (who is calling) lets the call screen show the caller's name the moment the
 * app opens, before Messenger has loaded anything.
 */
object CallLinks {
  fun intent(context: Context, kind: String, callId: String, conversationId: String, video: Boolean, title: String = ""): Intent {
    val link = Uri.Builder()
      .scheme("dmworkspace")
      .authority("call")
      .appendQueryParameter("action", kind)
      .appendQueryParameter("callId", callId)
      .appendQueryParameter("conversationId", conversationId)
      .appendQueryParameter("video", if (video) "1" else "0")
      .apply { if (title.isNotEmpty()) appendQueryParameter("title", title) }
      .appendQueryParameter("t", System.currentTimeMillis().toString())
      .build()
    return Intent(context, MainActivity::class.java).apply {
      action = Intent.ACTION_VIEW
      data = link
      flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      putExtra(MainActivity.EXTRA_CALL, true)
    }
  }

  fun pending(context: Context, kind: String, code: Int, callId: String, conversationId: String, video: Boolean, title: String = ""): PendingIntent =
    PendingIntent.getActivity(
      context,
      code,
      intent(context, kind, callId, conversationId, video, title),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
}
