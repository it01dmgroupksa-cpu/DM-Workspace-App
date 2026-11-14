package com.dmworkspaceapp

import android.app.Activity
import android.content.ClipData
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.content.FileProvider
import java.io.File

/** Hands files in the app's cache "share" folder to other apps (res/xml/share_paths.xml). */
class ShareFileProvider : FileProvider()

/**
 * "Forward to WhatsApp" (ChatScreen.tsx): a message's text and/or file go straight to
 * WhatsApp, or WhatsApp Business, where the person picks the customer's chat. With both
 * installed, Android asks which one.
 */
object WhatsAppShare {
  private val APPS = listOf("com.whatsapp", "com.whatsapp.w4b")

  fun installed(context: Context): List<String> = APPS.filter {
    try {
      context.packageManager.getPackageInfo(it, 0)
      true
    } catch (e: PackageManager.NameNotFoundException) {
      false
    }
  }

  /** The number of WhatsApp apps offered; 0 when none is installed (nothing opens). */
  fun share(context: Context, activity: Activity?, path: String?, mime: String?, text: String?): Int {
    val apps = installed(context)
    if (apps.isEmpty()) return 0
    val base = Intent(Intent.ACTION_SEND)
    if (!path.isNullOrEmpty()) {
      val uri = FileProvider.getUriForFile(context, "${context.packageName}.share", File(path))
      base.type = mime?.takeIf { it.isNotBlank() } ?: "application/octet-stream"
      base.putExtra(Intent.EXTRA_STREAM, uri)
      base.clipData = ClipData.newRawUri("", uri)
      base.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    } else {
      base.type = "text/plain"
    }
    if (!text.isNullOrEmpty()) base.putExtra(Intent.EXTRA_TEXT, text)
    val targets = apps.map { Intent(base).setPackage(it) }
    val launch =
      if (targets.size == 1) targets[0]
      else Intent.createChooser(targets[0], "Forward to WhatsApp")
        .putExtra(Intent.EXTRA_INITIAL_INTENTS, targets.drop(1).toTypedArray())
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    if (activity != null) activity.startActivity(launch)
    else context.startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    return apps.size
  }
}
