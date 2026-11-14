package com.dmworkspaceapp

import android.content.Context

/**
 * Which calls this phone has already dealt with, so each call rings at most once whatever
 * arrives and in whatever order: a duplicate push, the same call from the push and from
 * the app's live stream, a ring delayed until after its own cancel, or a push that lands
 * after the call was answered or declined here.
 *
 * Kept on disk for ten minutes (a call rings for 45 seconds), because the app's process
 * may be stopped and started again between the two pushes.
 */
object CallRegistry {
  private const val FILE = "dm_calls_seen"
  private const val KEEP_MS = 10 * 60_000L

  private fun prefs(context: Context) = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

  // True the first time this call is offered for ringing; false ever after.
  @Synchronized
  fun claim(context: Context, callId: String): Boolean {
    val p = prefs(context)
    val now = System.currentTimeMillis()
    val edit = p.edit()
    for ((key, value) in p.all) if (value !is Long || now - value > KEEP_MS) edit.remove(key)
    val fresh = (p.all[callId] as? Long)?.let { now - it > KEEP_MS } ?: true
    if (fresh) edit.putLong(callId, now)
    edit.apply()
    return fresh
  }

  // The call is over for this phone (answered, declined, cancelled, missed): never ring it,
  // even if its ring push has not arrived yet.
  @Synchronized
  fun settle(context: Context, callId: String?) {
    if (callId.isNullOrEmpty()) return
    prefs(context).edit().putLong(callId, System.currentTimeMillis()).apply()
  }
}
