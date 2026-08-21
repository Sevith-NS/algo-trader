'use client';

import { useEffect, useRef } from 'react';
import { Renderer, Program, Mesh, Color, Triangle } from 'ogl';

/**
 * Vendored from ReactBits' Galaxy background (reactbits.dev), ported to
 * TypeScript and adapted for Flint:
 *  - `animated={false}` renders exactly ONE frame — the prefers-reduced-motion
 *    path (no rAF loop is ever created);
 *  - the rAF loop pauses while the tab is hidden or the canvas is offscreen;
 *  - DPR is capped at 2 (retina is enough — 3x buys nothing for a starfield);
 *  - a lost WebGL context stops the loop silently and lets the parent's CSS
 *    background show through instead of crashing;
 *  - the opaque clear color is bgPrimary (#07090F), not black, so the canvas
 *    is indistinguishable from the app shell behind it;
 *  - defaults sit in the committed palette: low-saturation stars drifting
 *    white → cyan → green rather than the upstream purple demo.
 */

const vertexShader = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0, 1);
}
`;

const fragmentShader = /* glsl */ `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform vec2 uFocal;
uniform vec2 uRotation;
uniform float uStarSpeed;
uniform float uDensity;
uniform float uHueShift;
uniform float uSpeed;
uniform vec2 uMouse;
uniform float uGlowIntensity;
uniform float uSaturation;
uniform bool uMouseRepulsion;
uniform float uTwinkleIntensity;
uniform float uRotationSpeed;
uniform float uRepulsionStrength;
uniform float uMouseActiveFactor;
uniform float uAutoCenterRepulsion;
uniform bool uTransparent;
uniform vec3 uClearColor;

varying vec2 vUv;

#define NUM_LAYER 4.0
#define STAR_COLOR_CUTOFF 0.2
#define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)
#define PERIOD 3.0

float Hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float tri(float x) {
  return abs(fract(x) * 2.0 - 1.0);
}

float tris(float x) {
  float t = fract(x);
  return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0));
}

float trisn(float x) {
  float t = fract(x);
  return 2.0 * (1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0))) - 1.0;
}

vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

float Star(vec2 uv, float flare) {
  float d = length(uv);
  float m = (0.05 * uGlowIntensity) / d;
  float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * flare * uGlowIntensity;
  uv *= MAT45;
  rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
  m += rays * 0.3 * flare * uGlowIntensity;
  m *= smoothstep(1.0, 0.2, d);
  return m;
}

vec3 StarLayer(vec2 uv) {
  vec3 col = vec3(0.0);

  vec2 gv = fract(uv) - 0.5;
  vec2 id = floor(uv);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 offset = vec2(float(x), float(y));
      vec2 si = id + vec2(float(x), float(y));
      float seed = Hash21(si);
      float size = fract(seed * 345.32);
      float glossLocal = tri(uStarSpeed / (PERIOD * seed + 1.0));
      float flareSize = smoothstep(0.9, 1.0, size) * glossLocal;

      float red = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 1.0)) + STAR_COLOR_CUTOFF;
      float blu = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 3.0)) + STAR_COLOR_CUTOFF;
      float grn = min(red, blu) * seed;
      vec3 base = vec3(red, grn, blu);

      float hue = atan(base.g - base.r, base.b - base.r) / (2.0 * 3.14159) + 0.5;
      hue = fract(hue + uHueShift / 360.0);
      float sat = length(base - vec3(dot(base, vec3(0.299, 0.587, 0.114)))) * uSaturation;
      float val = max(max(base.r, base.g), base.b);
      base = hsv2rgb(vec3(hue, sat, val));

      vec2 pad = vec2(tris(seed * 34.0 + uTime * uSpeed / 10.0), tris(seed * 38.0 + uTime * uSpeed / 30.0)) - 0.5;

      float star = Star(gv - offset - pad, flareSize);
      vec3 color = base;

      float twinkle = trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0;
      twinkle = mix(1.0, twinkle, uTwinkleIntensity);
      star *= twinkle;

      col += star * size * color;
    }
  }

  return col;
}

void main() {
  vec2 focalPx = uFocal * uResolution.xy;
  vec2 uv = (vUv * uResolution.xy - focalPx) / uResolution.y;

  vec2 mouseNorm = uMouse - vec2(0.5);

  if (uAutoCenterRepulsion > 0.0) {
    vec2 centerUV = vec2(0.0, 0.0);
    float centerDist = length(uv - centerUV);
    vec2 repulsion = normalize(uv - centerUV) * (uAutoCenterRepulsion / (centerDist + 0.1));
    uv += repulsion * 0.05;
  } else if (uMouseRepulsion) {
    vec2 mousePosUV = (uMouse * uResolution.xy - focalPx) / uResolution.y;
    float mouseDist = length(uv - mousePosUV);
    vec2 repulsion = normalize(uv - mousePosUV) * (uRepulsionStrength / (mouseDist + 0.1));
    uv += repulsion * 0.05 * uMouseActiveFactor;
  } else {
    vec2 mouseOffset = mouseNorm * 0.1 * uMouseActiveFactor;
    uv += mouseOffset;
  }

  float autoRotAngle = uTime * uRotationSpeed;
  mat2 autoRot = mat2(cos(autoRotAngle), -sin(autoRotAngle), sin(autoRotAngle), cos(autoRotAngle));
  uv = autoRot * uv;

  uv = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * uv;

  vec3 col = vec3(0.0);

  for (float i = 0.0; i < 1.0; i += 1.0 / NUM_LAYER) {
    float depth = fract(i + uStarSpeed * uSpeed);
    float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);
    float fade = depth * smoothstep(1.0, 0.9, depth);
    col += StarLayer(uv * scale + i * 453.32) * fade;
  }

  if (uTransparent) {
    float alpha = length(col);
    alpha = smoothstep(0.0, 0.3, alpha);
    alpha = min(alpha, 1.0);
    gl_FragColor = vec4(col, alpha);
  } else {
    gl_FragColor = vec4(uClearColor + col, 1.0);
  }
}
`;

interface GalaxyProps {
  density?: number;
  glowIntensity?: number;
  saturation?: number;
  hueShift?: number;
  twinkleIntensity?: number;
  rotationSpeed?: number;
  mouseInteraction?: boolean;
  /** Upstream demo's signature interaction: stars repel from the cursor. */
  mouseRepulsion?: boolean;
  repulsionStrength?: number;
  transparent?: boolean;
  className?: string;
  /** Our addition: false renders exactly one static frame (reduced motion). */
  animated?: boolean;
}

// Upstream knobs we don't expose — fixed so every call site drifts the same way.
const FOCAL: [number, number] = [0.5, 0.5];
const ROTATION: [number, number] = [1.0, 0.0];
const STAR_SPEED = 0.5;
const SPEED = 1.0;
// Mid-phase timestamp for the single reduced-motion frame: at t=0 every star
// sits at its cycle origin and the field looks artificially sparse.
const STATIC_TIME = 12.0;
// bgPrimary (#07090F) as GL floats — the opaque clear must match the shell.
const CLEAR_RGB: [number, number, number] = [7 / 255, 9 / 255, 15 / 255];

export default function Galaxy({
  density = 1.2,
  glowIntensity = 0.25,
  saturation = 0.35,
  hueShift = 160,
  twinkleIntensity = 0.25,
  rotationSpeed = 0.05,
  mouseInteraction = true,
  mouseRepulsion = false,
  repulsionStrength = 2,
  transparent = false,
  className = '',
  animated = true,
}: GalaxyProps) {
  const ctnDom = useRef<HTMLDivElement>(null);
  const targetMousePos = useRef({ x: 0.5, y: 0.5 });
  const smoothMousePos = useRef({ x: 0.5, y: 0.5 });
  const targetMouseActive = useRef(0.0);
  const smoothMouseActive = useRef(0.0);

  useEffect(() => {
    if (!ctnDom.current) return;
    const ctn = ctnDom.current;

    // PRD F14 degradation doctrine: low-memory devices (<4GB) and
    // prefers-reduced-data users get the static single-frame path even when
    // `animated` — the rAF starfield is pure decoration, the first thing to
    // shed. Treated exactly like animated=false below.
    const lowPower =
      ((navigator as any).deviceMemory ?? 8) < 4 ||
      window.matchMedia('(prefers-reduced-data: reduce)').matches;
    const isAnimated = animated && !lowPower;

    let renderer: Renderer;
    try {
      renderer = new Renderer({
        alpha: transparent,
        premultipliedAlpha: false,
        // Cap at 2: fragment cost scales with pixels and 3x DPR is invisible
        // on a soft starfield.
        dpr: Math.min(window.devicePixelRatio || 1, 2),
      });
    } catch {
      // No WebGL at all (old hardware, disabled in browser): the parent's CSS
      // background is the composed fallback — nothing to do here.
      return;
    }
    const gl = renderer.gl;

    if (transparent) {
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.clearColor(0, 0, 0, 0);
    } else {
      gl.clearColor(CLEAR_RGB[0], CLEAR_RGB[1], CLEAR_RGB[2], 1);
    }

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: vertexShader,
      fragment: fragmentShader,
      uniforms: {
        uTime: { value: 0 },
        uResolution: {
          value: new Color(gl.canvas.width, gl.canvas.height, gl.canvas.width / gl.canvas.height),
        },
        uFocal: { value: new Float32Array(FOCAL) },
        uRotation: { value: new Float32Array(ROTATION) },
        uStarSpeed: { value: STAR_SPEED },
        uDensity: { value: density },
        uHueShift: { value: hueShift },
        uSpeed: { value: SPEED },
        uMouse: {
          value: new Float32Array([smoothMousePos.current.x, smoothMousePos.current.y]),
        },
        uGlowIntensity: { value: glowIntensity },
        uSaturation: { value: saturation },
        // Brand register: repulsion (the upstream demo's look) is opt-in per
        // surface; parallax is the default.
        uMouseRepulsion: { value: mouseRepulsion },
        uTwinkleIntensity: { value: twinkleIntensity },
        uRotationSpeed: { value: rotationSpeed },
        uRepulsionStrength: { value: repulsionStrength },
        uMouseActiveFactor: { value: 0.0 },
        uAutoCenterRepulsion: { value: 0 },
        uTransparent: { value: transparent },
        uClearColor: { value: new Color(CLEAR_RGB[0], CLEAR_RGB[1], CLEAR_RGB[2]) },
      },
    });

    const mesh = new Mesh(gl, { geometry, program });

    const renderStaticFrame = () => {
      program.uniforms.uTime.value = STATIC_TIME;
      program.uniforms.uStarSpeed.value = (STATIC_TIME * STAR_SPEED) / 10.0;
      renderer.render({ scene: mesh });
    };

    function resize() {
      // DPR can change mid-session (browser zoom, dragging to a different-DPI
      // monitor) — refresh it before sizing so the backing store isn't stale.
      // Same 2x cap as at construction.
      renderer.dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setSize(ctn.offsetWidth, ctn.offsetHeight);
      program.uniforms.uResolution.value = new Color(
        gl.canvas.width,
        gl.canvas.height,
        gl.canvas.width / gl.canvas.height,
      );
      // The static path has no loop to repaint after a resize.
      if (!isAnimated && !contextLost) renderStaticFrame();
    }

    // ---- rAF loop with pause/resume discipline -------------------------
    let rafId: number | null = null;
    let lastT: number | null = null;
    let elapsed = 0; // own clock: pausing must not fast-forward the rotation
    let contextLost = false;
    let pageVisible = !document.hidden;
    let inView = true;

    const update = (t: number) => {
      rafId = requestAnimationFrame(update);
      if (lastT !== null) elapsed += t - lastT;
      lastT = t;
      const time = elapsed * 0.001;
      program.uniforms.uTime.value = time;
      program.uniforms.uStarSpeed.value = (time * STAR_SPEED) / 10.0;

      const lerpFactor = 0.05;
      smoothMousePos.current.x += (targetMousePos.current.x - smoothMousePos.current.x) * lerpFactor;
      smoothMousePos.current.y += (targetMousePos.current.y - smoothMousePos.current.y) * lerpFactor;
      smoothMouseActive.current += (targetMouseActive.current - smoothMouseActive.current) * lerpFactor;
      program.uniforms.uMouse.value[0] = smoothMousePos.current.x;
      program.uniforms.uMouse.value[1] = smoothMousePos.current.y;
      program.uniforms.uMouseActiveFactor.value = smoothMouseActive.current;

      renderer.render({ scene: mesh });
    };

    const start = () => {
      if (rafId !== null || !isAnimated || contextLost || !pageVisible || !inView) return;
      lastT = null; // don't count the paused gap into the clock
      rafId = requestAnimationFrame(update);
    };
    const stop = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    };

    // ---- listeners ------------------------------------------------------
    const onContextLost = (e: Event) => {
      // preventDefault keeps the browser from firing contextrestored churn;
      // we deliberately don't recover — the wrapper's CSS bg stays composed.
      e.preventDefault();
      contextLost = true;
      stop();
    };
    gl.canvas.addEventListener('webglcontextlost', onContextLost, false);

    const onVisibility = () => {
      pageVisible = !document.hidden;
      pageVisible ? start() : stop();
    };

    let io: IntersectionObserver | null = null;
    if (isAnimated) {
      document.addEventListener('visibilitychange', onVisibility);
      io = new IntersectionObserver(([entry]) => {
        inView = entry.isIntersecting;
        inView ? start() : stop();
      });
      io.observe(ctn);
    }

    const handleMouseMove = (e: MouseEvent) => {
      const rect = ctn.getBoundingClientRect();
      targetMousePos.current = {
        x: (e.clientX - rect.left) / rect.width,
        y: 1.0 - (e.clientY - rect.top) / rect.height,
      };
      targetMouseActive.current = 1.0;
    };
    const handleMouseLeave = () => {
      targetMouseActive.current = 0.0;
    };
    // Parallax needs the loop to ease — pointless (and dead) when static.
    // Listen on window, not ctn: the container sits in the fixed z-0 backdrop
    // fully covered by the z-10 content, so pointer hit-testing never reaches
    // it. handleMouseMove normalizes with ctn's rect, which equals the
    // viewport for the fixed backdrop. document 'mouseleave' (pointer leaving
    // the window) is the only "leave" that exists once tracking is global.
    if (mouseInteraction && isAnimated) {
      window.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseleave', handleMouseLeave);
    }

    window.addEventListener('resize', resize, false);
    resize();
    ctn.appendChild(gl.canvas as HTMLCanvasElement);

    if (isAnimated) {
      start();
    } else {
      renderStaticFrame(); // prefers-reduced-motion / low power: exactly one frame
    }

    return () => {
      stop();
      io?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      gl.canvas.removeEventListener('webglcontextlost', onContextLost);
      if (gl.canvas.parentNode === ctn) ctn.removeChild(gl.canvas as HTMLCanvasElement);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    };
  }, [
    density,
    glowIntensity,
    saturation,
    hueShift,
    twinkleIntensity,
    rotationSpeed,
    mouseInteraction,
    mouseRepulsion,
    repulsionStrength,
    transparent,
    animated,
  ]);

  return <div ref={ctnDom} className={`h-full w-full ${className}`} />;
}
