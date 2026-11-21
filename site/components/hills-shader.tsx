'use client'
import React from 'react'

/*
 * The hero's painted hills, alive: mist drifts slowly through the valley and a soft band of morning
 * light crosses the ridge over about a minute and a half. One WebGL fragment shader over the same
 * image the stage shows as a still, so with Reduce Motion, without WebGL, or before the shader is
 * ready, the still painting is what people see. It renders only while the hero is on screen.
 */

const SRC = '/art/jerusalem-hills.webp'
/** Frames per second; the motion is slow enough that more buys nothing. */
const FPS = 30

const VERTEX = `
attribute vec2 position;
varying vec2 uv;
void main() {
  uv = vec2(position.x * 0.5 + 0.5, 0.5 - position.y * 0.5);
  gl_Position = vec4(position, 0.0, 1.0);
}`

const FRAGMENT = `
precision mediump float;
varying vec2 uv;
uniform sampler2D image;
uniform float time;
uniform float aspect;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float value = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p);
    p *= 2.03;
    amplitude *= 0.5;
  }
  return value;
}

void main() {
  vec4 painting = texture2D(image, uv);
  float tone = painting.r;

  // Mist: two layers of noise drifting at different speeds, settled in the valley floor.
  vec2 p = vec2(uv.x * aspect, uv.y) * 2.2;
  float mist = fbm(p + vec2(time * 0.012, time * 0.003));
  mist = mix(mist, fbm(p * 1.7 - vec2(time * 0.02, 0.0)), 0.4);
  float valley = smoothstep(0.2, 0.55, uv.y) * (1.0 - smoothstep(0.75, 1.0, uv.y));
  tone = mix(tone, 1.0, smoothstep(0.45, 0.85, mist) * valley * 0.45);

  // Morning light: a wide, soft band crossing the ridge, then resting before it comes round again.
  float sweep = fract(time / 90.0) * 1.8 - 0.4;
  float light = exp(-pow((uv.x - sweep) * 2.6, 2.0)) * (1.0 - smoothstep(0.2, 0.9, uv.y));
  tone += light * 0.16;

  gl_FragColor = vec4(vec3(tone) * painting.a, painting.a);
}`

function compile(gl: WebGLRenderingContext, type: number, source: string) {
	const shader = gl.createShader(type)
	if (!shader) return null
	gl.shaderSource(shader, source)
	gl.compileShader(shader)
	return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

export function HillsShader() {
	const canvasRef = React.useRef<HTMLCanvasElement>(null)

	React.useEffect(() => {
		const canvas = canvasRef.current
		const host = canvas?.parentElement
		if (!canvas || !host) return
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
		const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true, antialias: false })
		if (!gl) return

		const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
		const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
		const program = gl.createProgram()
		if (!vertex || !fragment || !program) return
		gl.attachShader(program, vertex)
		gl.attachShader(program, fragment)
		gl.linkProgram(program)
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
		gl.useProgram(program)

		const buffer = gl.createBuffer()
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
		const position = gl.getAttribLocation(program, 'position')
		gl.enableVertexAttribArray(position)
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
		const timeUniform = gl.getUniformLocation(program, 'time')
		const aspectUniform = gl.getUniformLocation(program, 'aspect')

		let frame = 0
		let last = 0
		let visible = false
		let ready = false
		let disposed = false
		const start = performance.now()

		const resize = () => {
			const scale = Math.min(window.devicePixelRatio || 1, 1.5)
			const { width, height } = canvas.getBoundingClientRect()
			canvas.width = Math.max(1, Math.round(width * scale))
			canvas.height = Math.max(1, Math.round(height * scale))
			gl.viewport(0, 0, canvas.width, canvas.height)
			gl.uniform1f(aspectUniform, width / Math.max(1, height))
		}
		const draw = (now: number) => {
			frame = 0
			if (disposed || !visible || document.hidden) return
			frame = requestAnimationFrame(draw)
			if (now - last < 1000 / FPS) return
			last = now
			gl.uniform1f(timeUniform, (now - start) / 1000)
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
		}
		const run = () => {
			if (ready && visible && !document.hidden && !frame) frame = requestAnimationFrame(draw)
		}

		const image = new Image()
		image.decoding = 'async'
		image.src = SRC
		image.onload = () => {
			if (disposed) return
			const texture = gl.createTexture()
			gl.bindTexture(gl.TEXTURE_2D, texture)
			gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
			resize()
			ready = true
			// Swap the still for the live painting only once the first frame is drawn.
			gl.uniform1f(timeUniform, 0)
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
			host.dataset.live = ''
			run()
		}

		const observer = new IntersectionObserver(([entry]) => {
			visible = entry.isIntersecting
			run()
		})
		observer.observe(host)
		const resizeObserver = new ResizeObserver(() => ready && resize())
		resizeObserver.observe(canvas)
		const onVisibility = () => run()
		document.addEventListener('visibilitychange', onVisibility)

		return () => {
			disposed = true
			cancelAnimationFrame(frame)
			observer.disconnect()
			resizeObserver.disconnect()
			document.removeEventListener('visibilitychange', onVisibility)
			delete host.dataset.live
			// The context stays with the canvas: a remount reuses it, and losing it here would break that.
			gl.deleteProgram(program)
		}
	}, [])

	return <canvas ref={canvasRef} aria-hidden className="hero-hills-canvas" />
}
