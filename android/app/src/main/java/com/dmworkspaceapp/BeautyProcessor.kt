package com.dmworkspaceapp

import android.graphics.Matrix
import android.opengl.EGL14
import android.opengl.GLES11Ext
import android.opengl.GLES20
import com.oney.WebRTCModule.videoEffects.ProcessorProvider
import com.oney.WebRTCModule.videoEffects.VideoFrameProcessor
import livekit.org.webrtc.GlShader
import livekit.org.webrtc.GlUtil
import livekit.org.webrtc.RendererCommon
import livekit.org.webrtc.SurfaceTextureHelper
import livekit.org.webrtc.TextureBufferImpl
import livekit.org.webrtc.VideoFrame
import livekit.org.webrtc.YuvConverter

/**
 * "Touch up" for video calls: a gentle skin smoothing, in the spirit of WhatsApp's.
 *
 * Each camera frame is redrawn on the GPU through an edge-preserving (bilateral) blur that
 * only applies where the colour is skin, so eyes, hair, lips and the background keep their
 * detail. The other person and the self-view both see the result.
 *
 * Registered with LiveKit's WebRTC as the video effect "dm-beauty" (MainApplication), put on
 * the camera by the call screen, and switched on and off with [enabled]. Anything unusual
 * (no GL context, a CPU-only frame, an error, a phone too slow for it) sends the camera's
 * own frame on unchanged: the filter can make a call nicer, never break it.
 */
class BeautyProcessor : VideoFrameProcessor {
  companion object {
    const val NAME = "dm-beauty"
    @Volatile var enabled = true
    // 0..1: how much of the smoothed skin replaces the real one.
    private const val STRENGTH = 0.62f
    // Frames slower than this on average switch the filter off for this camera.
    private const val SLOW_NS = 28_000_000L

    fun register() {
      try {
        ProcessorProvider.addProcessor(NAME) { BeautyProcessor() }
      } catch (e: Throwable) {
        Telemetry.problem("touch up could not register", e)
      }
    }

    private const val VERTEX = """
      attribute vec4 a_pos;
      attribute vec2 a_uv;
      uniform mat4 u_m;
      varying vec2 v_tc;
      void main() {
        gl_Position = a_pos;
        v_tc = (u_m * vec4(a_uv, 0.0, 1.0)).xy;
      }
    """

    // Bilateral blur on two rings of 6 taps, weighted by how close each tap's brightness is
    // to the centre (so edges stay sharp), mixed in only where the centre looks like skin.
    private fun fragment(oes: Boolean): String {
      val head =
        if (oes) "#extension GL_OES_EGL_image_external : require\nprecision highp float;\nuniform samplerExternalOES u_tex;\n"
        else "precision highp float;\nuniform sampler2D u_tex;\n"
      return head + """
        varying vec2 v_tc;
        uniform vec2 u_dx;
        uniform vec2 u_dy;
        uniform float u_strength;
        const vec3 LUMA = vec3(0.299, 0.587, 0.114);
        vec3 c;
        vec3 acc;
        float sum;
        void tap(float x, float y) {
          vec3 s = texture2D(u_tex, v_tc + u_dx * x + u_dy * y).rgb;
          float d = dot(s - c, LUMA);
          float w = exp(-d * d * 180.0);
          acc += s * w;
          sum += w;
        }
        void main() {
          c = texture2D(u_tex, v_tc).rgb;
          acc = c;
          sum = 1.0;
          tap(1.0, 0.0); tap(0.5, 0.866); tap(-0.5, 0.866);
          tap(-1.0, 0.0); tap(-0.5, -0.866); tap(0.5, -0.866);
          tap(1.732, 1.0); tap(0.0, 2.0); tap(-1.732, 1.0);
          tap(-1.732, -1.0); tap(0.0, -2.0); tap(1.732, -1.0);
          vec3 soft = acc / sum;
          float cb = -0.1687 * c.r - 0.3313 * c.g + 0.5 * c.b + 0.5;
          float cr = 0.5 * c.r - 0.4187 * c.g - 0.0813 * c.b + 0.5;
          float skin = smoothstep(0.27, 0.32, cb) * (1.0 - smoothstep(0.50, 0.55, cb))
                     * smoothstep(0.50, 0.54, cr) * (1.0 - smoothstep(0.68, 0.72, cr));
          float y = dot(c, LUMA);
          skin *= smoothstep(0.12, 0.22, y);
          vec3 outc = mix(c, soft, u_strength * skin);
          // A touch brighter on skin, as a soft light would do.
          outc = mix(outc, 1.0 - (1.0 - outc) * (1.0 - outc), 0.06 * skin);
          gl_FragColor = vec4(outc, 1.0);
        }
      """
    }

    private val QUAD = GlUtil.createFloatBuffer(floatArrayOf(-1f, -1f, 1f, -1f, -1f, 1f, 1f, 1f))
    private val UV = GlUtil.createFloatBuffer(floatArrayOf(0f, 0f, 1f, 0f, 0f, 1f, 1f, 1f))

    // Output textures, shared by every camera (they live in WebRTC's shared GL context):
    // a texture goes back here when the encoder and the self-view are done with its frame.
    private object Textures {
      private const val MAX = 8
      private val free = ArrayList<Int>()
      private val trash = ArrayList<Int>()
      private var width = 0
      private var height = 0
      private var live = 0

      // On the GL thread.
      @Synchronized fun take(w: Int, h: Int): Int? {
        if (w != width || h != height) {
          trash.addAll(free)
          free.clear()
          width = w
          height = h
        }
        if (trash.isNotEmpty()) {
          GLES20.glDeleteTextures(trash.size, trash.toIntArray(), 0)
          live -= trash.size
          trash.clear()
        }
        if (free.isNotEmpty()) return free.removeAt(free.size - 1)
        if (live >= MAX) return null
        val id = GlUtil.generateTexture(GLES20.GL_TEXTURE_2D)
        GLES20.glTexImage2D(GLES20.GL_TEXTURE_2D, 0, GLES20.GL_RGBA, w, h, 0, GLES20.GL_RGBA, GLES20.GL_UNSIGNED_BYTE, null)
        GLES20.glBindTexture(GLES20.GL_TEXTURE_2D, 0)
        live++
        return id
      }

      // Any thread.
      @Synchronized fun give(id: Int, w: Int, h: Int) {
        if (w == width && h == height) free.add(id) else trash.add(id)
      }
    }
  }

  private var oesShader: GlShader? = null
  private var rgbShader: GlShader? = null
  private var framebuffer = 0
  private var yuv: YuvConverter? = null
  private var off = false
  private var frames = 0
  private var spentNs = 0L

  override fun process(frame: VideoFrame, helper: SurfaceTextureHelper?): VideoFrame? {
    if (!enabled || off || helper == null) return null
    val input = frame.buffer as? VideoFrame.TextureBuffer ?: return null
    if (EGL14.eglGetCurrentContext() == EGL14.EGL_NO_CONTEXT) return null
    return try {
      val started = System.nanoTime()
      val out = draw(frame, input, helper)
      watch(System.nanoTime() - started)
      out
    } catch (e: Throwable) {
      off = true
      Telemetry.problem("touch up stopped", e)
      GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)
      null
    }
  }

  // A phone that can't keep up gets the plain camera instead of a stuttering one.
  private fun watch(ns: Long) {
    frames++
    spentNs += ns
    if (frames < 60) return
    if (spentNs / frames > SLOW_NS) {
      off = true
      Telemetry.event("touch up off: ${spentNs / frames / 1_000_000} ms a frame")
    }
    frames = 0
    spentNs = 0
  }

  private fun shader(oes: Boolean): GlShader {
    val existing = if (oes) oesShader else rgbShader
    if (existing != null) return existing
    return GlShader(VERTEX, fragment(oes)).also { if (oes) oesShader = it else rgbShader = it }
  }

  private fun draw(frame: VideoFrame, input: VideoFrame.TextureBuffer, helper: SurfaceTextureHelper): VideoFrame? {
    val w = input.width
    val h = input.height
    val texture = Textures.take(w, h) ?: return null // every texture still in use: skip
    if (framebuffer == 0) {
      val ids = IntArray(1)
      GLES20.glGenFramebuffers(1, ids, 0)
      framebuffer = ids[0]
    }
    GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, framebuffer)
    GLES20.glFramebufferTexture2D(GLES20.GL_FRAMEBUFFER, GLES20.GL_COLOR_ATTACHMENT0, GLES20.GL_TEXTURE_2D, texture, 0)
    GLES20.glViewport(0, 0, w, h)

    val oes = input.type == VideoFrame.TextureBuffer.Type.OES
    val program = shader(oes)
    program.useProgram()
    val m = RendererCommon.convertMatrixFromAndroidGraphicsMatrix(input.transformMatrix)
    GLES20.glUniformMatrix4fv(program.getUniformLocation("u_m"), 1, false, m, 0)
    // One step of the blur, ~3 px on a 720p picture, turned the way the camera's texture is.
    val step = 3f * (minOf(w, h) / 720f).coerceAtLeast(0.6f)
    val tx = step / w
    val ty = step / h
    GLES20.glUniform2f(program.getUniformLocation("u_dx"), m[0] * tx, m[1] * tx)
    GLES20.glUniform2f(program.getUniformLocation("u_dy"), m[4] * ty, m[5] * ty)
    GLES20.glUniform1f(program.getUniformLocation("u_strength"), STRENGTH)
    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    val target = if (oes) GLES11Ext.GL_TEXTURE_EXTERNAL_OES else GLES20.GL_TEXTURE_2D
    GLES20.glBindTexture(target, input.textureId)
    GLES20.glUniform1i(program.getUniformLocation("u_tex"), 0)
    program.setVertexAttribArray("a_pos", 2, QUAD)
    program.setVertexAttribArray("a_uv", 2, UV)
    GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
    GLES20.glBindTexture(target, 0)
    GLES20.glBindFramebuffer(GLES20.GL_FRAMEBUFFER, 0)
    // The encoder reads the texture from its own thread: finish drawing first.
    GLES20.glFinish()
    GlUtil.checkNoGLES2Error("touch up")

    val converter = yuv ?: YuvConverter().also { yuv = it }
    val buffer = TextureBufferImpl(
      w, h, VideoFrame.TextureBuffer.Type.RGB, texture, Matrix(), helper.handler, converter,
    ) { Textures.give(texture, w, h) }
    return VideoFrame(buffer, frame.rotation, frame.timestampNs)
  }
}
