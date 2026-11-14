package com.dmworkspaceapp

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.lang.ref.WeakReference

/**
 * The incoming call screen, in Kotlin like a phone app's, so it shows at once over the
 * lock screen or whatever app is open, whether or not the app (JavaScript) is running.
 * The ringtone is RingService's. Answer opens the app, where JavaScript joins the call;
 * Decline is handled here (CallActions). Pressing Back hides it; the call alert keeps
 * ringing until it is answered, declined or over.
 */
class IncomingCallActivity : Activity() {
  private var call: IncomingCall? = null
  // Answer or Decline already pressed: a second tap does nothing.
  private var acted = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    showOverLockScreen()
    if (!show(intent)) finish()
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    setIntent(intent)
    show(intent)
  }

  override fun onDestroy() {
    if (current?.get() === this) current = null
    super.onDestroy()
  }

  private fun show(intent: Intent?): Boolean {
    val next = IncomingCall.fromIntent(intent) ?: return false
    // Opened late (an old alert, a recent-apps tap) for a call no longer ringing here.
    if (!next.isTest && RingService.current?.callId != next.callId && !Ringer.isRinging()) {
      Telemetry.event("call screen not shown: ${next.callId} is no longer ringing")
      return false
    }
    call = next
    acted = false
    current = WeakReference(this)
    setContentView(layout(next))
    Telemetry.event("call screen shown ${next.callId}")
    return true
  }

  private fun showOverLockScreen() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
      setShowWhenLocked(true)
      setTurnScreenOn(true)
    } else {
      @Suppress("DEPRECATION")
      window.addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON)
    }
    window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
  }

  private fun dp(value: Int) =
    TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, value.toFloat(), resources.displayMetrics).toInt()

  private fun text(value: String, sp: Float, color: Int, bold: Boolean = false) = TextView(this).apply {
    text = value
    setTextSize(TypedValue.COMPLEX_UNIT_SP, sp)
    setTextColor(color)
    gravity = Gravity.CENTER
    if (bold) typeface = Typeface.DEFAULT_BOLD
  }

  private fun circle(color: Int) = GradientDrawable().apply {
    shape = GradientDrawable.OVAL
    setColor(color)
  }

  private fun layout(c: IncomingCall): View {
    val root = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      setBackgroundColor(NAVY)
      setPadding(dp(24), dp(24), dp(24), dp(24))
    }
    // Edge to edge: keep clear of the status and navigation bars.
    ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
      v.setPadding(dp(24), bars.top + dp(24), dp(24), bars.bottom + dp(24))
      insets
    }
    fun spacer(weight: Float) = View(this).apply {
      layoutParams = LinearLayout.LayoutParams(1, 0, weight)
    }
    root.addView(spacer(1f))
    root.addView(text(getString(R.string.app_name), 15f, MUTED))
    val initial = c.title.trim().firstOrNull()?.uppercaseChar()?.toString() ?: "?"
    root.addView(
      text(initial, 46f, Color.WHITE, bold = true).apply {
        background = circle(ACCENT)
        layoutParams = LinearLayout.LayoutParams(dp(120), dp(120)).apply { topMargin = dp(28) }
      },
    )
    root.addView(
      text(c.title, 28f, Color.WHITE, bold = true).apply {
        layoutParams = LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(22) }
        maxLines = 2
      },
    )
    root.addView(
      text(if (c.video) "Incoming video call" else "Incoming voice call", 16f, MUTED).apply {
        layoutParams = LinearLayout.LayoutParams(-1, -2).apply { topMargin = dp(8) }
      },
    )
    root.addView(spacer(2f))
    val buttons = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      layoutParams = LinearLayout.LayoutParams(-1, -2).apply { bottomMargin = dp(24) }
    }
    buttons.addView(
      button("Decline", R.drawable.ic_call_end, RED) {
        if (acted) return@button
        acted = true
        CallActions.decline(this, c, canOpenApp = true)
        finish()
      },
    )
    buttons.addView(
      button("Answer", R.drawable.ic_call_answer, GREEN) {
        if (acted) return@button
        acted = true
        CallActions.answer(this, c)
        finish()
      },
    )
    root.addView(buttons)
    return root
  }

  private fun button(label: String, icon: Int, color: Int, onTap: () -> Unit): View {
    val column = LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      gravity = Gravity.CENTER_HORIZONTAL
      layoutParams = LinearLayout.LayoutParams(0, -2, 1f)
    }
    val round = FrameLayout(this).apply {
      background = circle(color)
      layoutParams = LinearLayout.LayoutParams(dp(76), dp(76))
      isClickable = true
      isFocusable = true
      contentDescription = label
      setOnClickListener { onTap() }
    }
    round.addView(
      ImageView(this).apply {
        setImageResource(icon)
        layoutParams = FrameLayout.LayoutParams(dp(34), dp(34), Gravity.CENTER)
      },
    )
    column.addView(round)
    column.addView(
      text(label, 15f, Color.WHITE).apply {
        layoutParams = LinearLayout.LayoutParams(-2, -2).apply { topMargin = dp(10) }
      },
    )
    return column
  }

  companion object {
    private val NAVY = Color.parseColor("#153156")
    private val ACCENT = Color.parseColor("#0f766e")
    private val MUTED = Color.parseColor("#B8C4D6")
    private val GREEN = Color.parseColor("#16a34a")
    private val RED = Color.parseColor("#d92d20")

    @Volatile
    private var current: WeakReference<IncomingCallActivity>? = null

    // The call was answered elsewhere, declined, cancelled or missed: take the screen down.
    fun close() {
      val activity = current?.get() ?: return
      current = null
      activity.runOnUiThread { activity.finish() }
    }
  }
}
