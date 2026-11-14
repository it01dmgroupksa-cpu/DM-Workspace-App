package com.dmworkspaceapp

import android.content.Context
import android.media.AudioAttributes
import android.media.AudioFocusRequest
import android.media.AudioManager
import android.media.MediaPlayer
import android.os.Build
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings

/**
 * The ringtone for an incoming call, like WhatsApp: the phone's own ringtone (loud, and the
 * sound people know), or res/raw/ring.wav when that can't be played. Looped, played as a
 * ringtone, so it comes out of the loudspeaker at ring volume, with a repeating vibration.
 * The phone's ringer mode is respected: normal rings and vibrates, vibrate mode only
 * vibrates, silent is quiet.
 *
 * The single ringtone controller: the push, the app's live stream and the test button all
 * start it through IncomingCalls / RingService, so one call can never ring twice.
 * While it rings it holds transient audio focus, so music or a video pauses, as for a
 * phone call, and resumes when the ring stops.
 */
object Ringer {
  private val PATTERN = longArrayOf(0, 800, 400, 800, 400, 800, 400, 800, 1200)
  private val ATTRIBUTES = AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
    .build()

  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var focus: AudioFocusRequest? = null

  // What the ringer did, for the Call check screen and the event trail.
  @Volatile
  var lastOutcome: String = "not rung yet"
    private set

  @Synchronized
  fun start(context: Context) {
    if (player != null || vibrator != null) return
    val app = context.applicationContext
    val am = app.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    val mode = am.ringerMode
    Telemetry.event(
      "ring start: ringer=${modeName(mode)} volume=${am.getStreamVolume(AudioManager.STREAM_RING)}/${am.getStreamMaxVolume(AudioManager.STREAM_RING)}",
    )
    if (mode == AudioManager.RINGER_MODE_SILENT) {
      lastOutcome = "silent mode: no sound, no vibration"
      return Telemetry.event("ringtone_failed: the phone is in silent mode")
    }
    if (mode == AudioManager.RINGER_MODE_NORMAL) {
      if (am.getStreamVolume(AudioManager.STREAM_RING) == 0) Telemetry.event("ringtone volume is 0")
      useLoudspeaker(app)
      appAudio = am
      takeFocus(am)
      playSound(app)
    } else Telemetry.event("ringtone_failed: the phone is in vibrate mode (vibration only)")
    vibrate(app)
    lastOutcome = when {
      player != null -> "ringtone and vibration"
      vibrator != null -> if (mode == AudioManager.RINGER_MODE_VIBRATE) "vibrate mode: vibration only" else "vibration only (ringtone failed)"
      else -> "nothing could play"
    }
  }

  private fun takeFocus(am: AudioManager) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    try {
      val request = AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN_TRANSIENT)
        .setAudioAttributes(ATTRIBUTES)
        .setOnAudioFocusChangeListener {}
        .build()
      if (am.requestAudioFocus(request) == AudioManager.AUDIOFOCUS_REQUEST_GRANTED) focus = request
    } catch (e: Exception) {
      Telemetry.problem("audio focus for the ringtone refused", e)
    }
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
    val held = focus ?: return
    focus = null
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) appAudio?.abandonAudioFocusRequest(held)
    } catch (e: Exception) {
    }
  }

  private var appAudio: AudioManager? = null

  fun isRinging() = player != null || vibrator != null

  // A ringtone goes to the loudspeaker unless the audio was left in call mode (by an
  // earlier call that didn't reset it), which sends it quietly to the earpiece. Reset that,
  // but never during a call of ours.
  private fun useLoudspeaker(app: Context) {
    try {
      val am = app.getSystemService(Context.AUDIO_SERVICE) as AudioManager
      if (am.mode == AudioManager.MODE_IN_COMMUNICATION && !OngoingCallService.running) {
        am.mode = AudioManager.MODE_NORMAL
      }
    } catch (e: Exception) {
    }
  }

  // The phone's ringtone first. It can fail: set to None, or a file the app may not read
  // on older phones. Then the bundled ring. If both fail, the vibration still rings.
  private fun playSound(app: Context) {
    player = open("phone ringtone") { it.setDataSource(app, Settings.System.DEFAULT_RINGTONE_URI) }
      ?: open("bundled ring") { mp ->
        app.resources.openRawResourceFd(R.raw.ring).use {
          mp.setDataSource(it.fileDescriptor, it.startOffset, it.length)
        }
      }
    if (player == null) Telemetry.problem("no ringtone could play; vibration only")
  }

  fun modeName(mode: Int) = when (mode) {
    AudioManager.RINGER_MODE_NORMAL -> "normal"
    AudioManager.RINGER_MODE_VIBRATE -> "vibrate"
    else -> "silent"
  }

  private fun open(what: String, source: (MediaPlayer) -> Unit): MediaPlayer? {
    val mp = MediaPlayer()
    return try {
      mp.setAudioAttributes(ATTRIBUTES)
      source(mp)
      mp.isLooping = true
      mp.setVolume(1f, 1f)
      mp.prepare()
      mp.start()
      Telemetry.event("ringing with the $what")
      mp
    } catch (e: Exception) {
      Telemetry.event("the $what can't play: ${e.javaClass.simpleName}")
      mp.release()
      null
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
