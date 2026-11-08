package com.dmworkspaceapp

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager

/**
 * The app's own ringtone for an incoming call: res/raw/ring.wav, looped, played as a
 * ringtone (so it follows the ring volume), with a repeating vibration. The phone's ringer
 * mode is respected: normal rings and vibrates, vibrate mode only vibrates, silent is quiet.
 */
object Ringer {
  private val PATTERN = longArrayOf(0, 800, 400, 800, 400, 800, 400, 800, 1200)
  private val ATTRIBUTES = AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
    .build()

  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null

  @Synchronized
  fun start(context: Context) {
    if (player != null || vibrator != null) return
    val app = context.applicationContext
    val mode = (app.getSystemService(Context.AUDIO_SERVICE) as AudioManager).ringerMode
    if (mode == AudioManager.RINGER_MODE_SILENT) return
    if (mode == AudioManager.RINGER_MODE_NORMAL) playSound(app)
    vibrate(app)
  }

  @Synchronized
  fun stop() {
    try {
      player?.stop()
    } catch (e: Exception) {
    }
    try {
      player?.release()
    } catch (e: Exception) {
    }
    player = null
    try {
      vibrator?.cancel()
    } catch (e: Exception) {
    }
    vibrator = null
  }

  private fun playSound(app: Context) {
    try {
      val mp = MediaPlayer()
      mp.setAudioAttributes(ATTRIBUTES)
      app.resources.openRawResourceFd(R.raw.ring).use {
        mp.setDataSource(it.fileDescriptor, it.startOffset, it.length)
      }
      mp.isLooping = true
      mp.prepare()
      mp.start()
      player = mp
    } catch (e: Exception) {
      player = null // the vibration still rings
    }
  }

  @Suppress("DEPRECATION")
  private fun vibrate(app: Context) {
    try {
      val v = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
        (app.getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
      else app.getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
      if (!v.hasVibrator()) return
      // The attributes mark this as a ringtone vibration; without them Android can drop
      // vibration requested while the app is in the background.
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) v.vibrate(VibrationEffect.createWaveform(PATTERN, 0), ATTRIBUTES)
      else v.vibrate(PATTERN, 0, ATTRIBUTES)
      vibrator = v
    } catch (e: Exception) {
    }
  }
}
