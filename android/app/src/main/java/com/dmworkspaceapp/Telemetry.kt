package com.dmworkspaceapp

import android.content.Context
import android.util.Log
import com.google.firebase.crashlytics.FirebaseCrashlytics
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * What happened on this phone, step by step, for every call:
 *  - logcat, tag "DmCalls" (`adb logcat -s DmCalls`);
 *  - a small file on the phone (the last few hundred steps), shown and shared from the
 *    app's Call check screen, so "why did this phone not ring" needs no cable;
 *  - Firebase Crashlytics: crashes (automatic), the same trail attached to every report,
 *    and non-fatal problems such as "the ringtone couldn't play".
 *
 * Never holds push tokens, links or passwords. Never throws.
 */
object Telemetry {
  private const val TAG = "DmCalls"
  private const val MAX_BYTES = 96 * 1024L
  private const val KEEP_LINES = 300

  @Volatile
  private var file: File? = null
  private val stamp = SimpleDateFormat("MM-dd HH:mm:ss.SSS", Locale.US)

  // Called once from MainApplication, before anything can ring.
  fun attach(context: Context) {
    file = File(context.applicationContext.filesDir, "call-events.log")
  }

  private fun crashlytics(): FirebaseCrashlytics? =
    try {
      FirebaseCrashlytics.getInstance()
    } catch (e: Throwable) {
      null
    }

  @Synchronized
  private fun keep(line: String) {
    try {
      val f = file ?: return
      if (f.exists() && f.length() > MAX_BYTES) f.writeText(f.readLines().takeLast(KEEP_LINES).joinToString("\n", postfix = "\n"))
      f.appendText("${stamp.format(Date())} $line\n")
    } catch (e: Throwable) {
    }
  }

  // The latest steps, oldest first.
  @Synchronized
  fun recent(lines: Int = 200): String =
    try {
      file?.takeIf { it.exists() }?.readLines()?.takeLast(lines)?.joinToString("\n") ?: ""
    } catch (e: Throwable) {
      ""
    }

  fun event(message: String) {
    Log.i(TAG, message)
    keep(message)
    try {
      crashlytics()?.log(message)
    } catch (e: Throwable) {
    }
  }

  // Something went wrong but the app carried on: reported as a non-fatal issue.
  fun problem(message: String, cause: Throwable? = null) {
    Log.w(TAG, message, cause)
    keep("PROBLEM $message" + (cause?.let { " (${it.javaClass.simpleName}: ${it.message})" } ?: ""))
    try {
      crashlytics()?.recordException(CallProblem(message, cause))
    } catch (e: Throwable) {
    }
  }

  // A JavaScript error, from the global error handler (telemetry.ts).
  fun jsError(message: String, stack: String, fatal: Boolean) {
    Log.e(TAG, "JS ${if (fatal) "fatal" else "error"}: $message\n$stack")
    keep("JS ${if (fatal) "FATAL" else "error"} $message")
    try {
      val c = crashlytics() ?: return
      c.setCustomKey("js_fatal", fatal)
      c.recordException(JsError(message, stack))
    } catch (e: Throwable) {
    }
  }

  fun setUser(id: String?) {
    try {
      crashlytics()?.setUserId(id ?: "")
    } catch (e: Throwable) {
    }
  }

  class CallProblem(message: String, cause: Throwable?) : Exception(message, cause)

  // Keeps the JavaScript stack readable in the Crashlytics console.
  class JsError(message: String, private val jsStack: String) : Exception(message) {
    override fun toString() = "JsError: $message\n$jsStack"
  }
}
