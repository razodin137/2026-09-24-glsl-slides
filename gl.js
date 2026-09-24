// gl.js — the WebGL2 half of the deck.
// One program, eleven scenes, five post effects. The DOM decides what to show;
// this file only knows how to paint it.

"use strict";

const GL = (() => {
  const VERT = `#version 300 es
layout(location=0) in vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

  const FRAG = `#version 300 es
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform int u_slide;
uniform int u_prev;
uniform float u_progress;
uniform float u_pixel;
uniform float u_dots;
uniform float u_grid;
uniform float u_ca;
uniform float u_grain;

out vec4 fragColor;

const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);

// -- hashing & noise ---------------------------------------------------

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 4; i++) {
    v += amp * noise(p);
    p = p * 2.03 + vec2(11.7, 5.3);
    amp *= 0.5;
  }
  return v;
}

// -- scenes -------------------------------------------------------------

// 0/5/8 -- terraced sine bands, tinted per slide
vec3 waves(vec2 uv, float t, vec3 deep, vec3 crest) {
  vec3 col = deep;
  for (int i = 4; i >= 0; i--) {
    float fi = float(i);
    float y = -0.62 + fi * 0.27
            + 0.11 * sin(uv.x * (1.3 + fi * 0.55) + t * (0.35 + fi * 0.22))
            + 0.05 * noise(vec2(uv.x * 2.6 + fi * 13.7, t * 0.14));
    float below = 1.0 - smoothstep(y - 0.0015, y + 0.0015, uv.y);
    col = mix(col, mix(deep, crest, 0.06 + fi * 0.1), below * 0.5);
    float line = 1.0 - smoothstep(0.0, 0.012, abs(uv.y - y));
    col = mix(col, crest, line * below * 0.75);
  }
  return col;
}

// 2/6 -- domain-warped fbm, slow drift
vec3 ink(vec2 uv, float t, vec3 dark, vec3 light) {
  vec2 p = uv * 1.7;
  float warp = fbm(p + vec2(t * 0.07, -t * 0.05));
  float w = fbm(p * 1.4 + warp * 1.6 + vec2(-t * 0.05, t * 0.06));
  vec3 col = mix(dark, light, smoothstep(0.3, 0.78, w));
  col += light * 0.12 * (1.0 - smoothstep(0.0, 0.05, abs(w - 0.5)));
  return col;
}

// 1/4/10 -- drifting radial light plus a breathing ring
vec3 glow(vec2 uv, float t, vec3 base, vec3 accent) {
  vec2 c = vec2(0.0, 0.08 + 0.12 * sin(t * 0.27));
  float d = length(uv - c);
  vec3 col = base + accent * exp(-d * 2.4) * 0.55;
  float ring = 1.0 - smoothstep(0.0, 0.02, abs(d - (0.52 + 0.1 * sin(t * 0.4))));
  col += accent * ring * 0.3;
  col += accent * exp(-length(uv - vec2(-0.8, -0.55)) * 2.0) * 0.25;
  return col;
}

// 3 -- high-contrast test pattern: rings on top, beams below
vec3 rings(vec2 uv, float t) {
  float d = length(uv);
  float pulse = 0.5 + 0.5 * sin(d * 14.0 - t * 1.2);
  float beam = 0.5 + 0.5 * sin(atan(uv.y, uv.x) * 6.0 + t * 0.4);
  vec3 dark = vec3(0.03, 0.04, 0.07);
  vec3 mid = vec3(0.16, 0.4, 0.6);
  float split = step(0.15 * sin(t * 0.3), uv.y);
  vec3 halfA = dark + mid * pulse * 0.85;
  vec3 halfB = mix(mid, vec3(0.9, 0.93, 1.0), pulse) * (0.35 + 0.4 * beam);
  return mix(halfA, halfB, split * 0.85);
}

// 7 -- drafting-paper grid with a slow vertical sweep
vec3 blueprint(vec2 uv, float t) {
  vec3 col = vec3(0.02, 0.04, 0.075);
  vec2 g1 = abs(fract(uv * 6.0) - 0.5);
  vec2 g2 = abs(fract(uv * 1.5) - 0.5);
  float fine = 1.0 - smoothstep(0.0, 0.05, min(g1.x, g1.y));
  float bold = 1.0 - smoothstep(0.0, 0.03, min(g2.x, g2.y));
  col += vec3(0.15, 0.42, 0.68) * (fine * 0.22 + bold * 0.5);
  float sweep = 1.0 - smoothstep(0.0, 0.25, abs(uv.y - (-1.25 + fract(t * 0.045) * 2.5)));
  col += vec3(0.2, 0.55, 0.8) * sweep * 0.18;
  col += vec3(0.35, 0.6, 0.9) * exp(-length(uv) * 1.8) * 0.2;
  return col;
}

// 9 -- horizon grid, finale energy
vec3 vroom(vec2 uv, float t) {
  vec3 col = vec3(0.02, 0.012, 0.05);
  float horizon = -0.18;
  if (uv.y < horizon) {
    float z = 1.0 / (horizon - uv.y);
    vec2 ground = vec2(uv.x * z, z * 1.2 - t * 0.9);
    float lx = abs(fract(ground.x * 3.0) - 0.5);
    float lz = abs(fract(ground.y * 3.0) - 0.5);
    float lines = max(smoothstep(0.47, 0.495, lx), smoothstep(0.47, 0.495, lz));
    col += vec3(0.25, 0.6, 0.95) * lines * clamp(z * 0.2, 0.0, 0.85);
  } else {
    float star = step(0.9975, hash(floor((uv + 13.7) * 260.0)));
    col += vec3(0.8, 0.85, 1.0) * star * 0.4;
    col += vec3(0.9, 0.25, 0.55) * exp(-(uv.y - horizon) * 5.0) * 0.45;
  }
  return col;
}

vec3 scene(int id, vec2 uv, float t) {
  if (id == 0) return waves(uv, t, vec3(0.043, 0.031, 0.12), vec3(0.55, 0.5, 1.0));
  if (id == 1) return glow(uv, t, vec3(0.03, 0.035, 0.065), vec3(0.45, 0.55, 1.0));
  if (id == 2) return ink(uv, t, vec3(0.03, 0.02, 0.09), vec3(0.28, 0.55, 0.8));
  if (id == 3) return rings(uv, t);
  if (id == 4) return glow(uv, t, vec3(0.04, 0.02, 0.075), vec3(0.35, 0.9, 0.8));
  if (id == 5) return waves(uv, t, vec3(0.02, 0.05, 0.055), vec3(0.4, 0.95, 0.85));
  if (id == 6) return ink(uv, t, vec3(0.09, 0.03, 0.02), vec3(0.85, 0.55, 0.3));
  if (id == 7) return blueprint(uv, t);
  if (id == 8) return waves(uv, t, vec3(0.055, 0.02, 0.09), vec3(0.9, 0.5, 0.95));
  if (id == 9) return vroom(uv, t);
  if (id == 10) return glow(uv, t, vec3(0.05, 0.02, 0.08), vec3(0.85, 0.5, 0.95));
  return vec3(0.0);
}

// -- render: noise dissolve with a hot rim between scenes ---------------

vec3 render(vec2 uv, float t) {
  vec3 next = scene(u_slide, uv, t);
  if (u_progress >= 1.0) return next;
  vec3 prev = scene(u_prev, uv, t);
  float n = noise(uv * 5.0 + vec2(17.0, t * 0.05));
  float edge = smoothstep(n - 0.18, n + 0.02, u_progress);
  float dd = (u_progress - n - 0.02) * 24.0;
  float rim = exp(-dd * dd) * 0.55;
  return mix(prev, next, edge) + vec3(0.9, 0.85, 1.0) * rim;
}

// -- main: the compositing stack, in fixed order -------------------------

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / min(u_res.x, u_res.y);
  float t = u_time;

  // 1 - pixelate: quantize the sampling grid before scenes run
  if (u_pixel > 0.001) {
    float cell = mix(0.003, 0.05, u_pixel);
    uv = (floor(uv / cell) + 0.5) * cell;
  }

  // 2 - chromatic aberration: radial per-channel magnification
  vec3 col;
  if (u_ca > 0.001) {
    float k = u_ca * 0.045;
    col = vec3(
      render(uv * (1.0 + k), t).r,
      render(uv, t).g,
      render(uv * (1.0 - k), t).b
    );
  } else {
    col = render(uv, t);
  }

  // 3 - halftone: luminance drives dot radius
  if (u_dots > 0.001) {
    vec2 f = fract(uv / mix(0.012, 0.05, u_dots)) - 0.5;
    float lum = dot(col, LUMA);
    float r = lum * 0.72 + 0.002;
    float dotm = 1.0 - smoothstep(r * 0.72, r, length(f));
    col = mix(col * (1.0 - 0.72 * u_dots), col * 1.8 + 0.05, dotm * u_dots);
  }

  // 4 - grid overlay
  if (u_grid > 0.001) {
    vec2 g = abs(fract(uv * 20.0) - 0.5);
    float line = 1.0 - smoothstep(0.0, 0.05, min(g.x, g.y));
    col = mix(col, col * 1.55 + vec3(0.35, 0.75, 1.0) * 0.1, line * u_grid);
  }

  // 5 - vignette
  float vig = 1.0 - 0.5 * pow(length(uv * vec2(0.75, 1.0)), 2.3);
  col *= clamp(vig, 0.0, 1.0);

  // 6 - film grain
  col += (hash(uv * u_res * 0.5 + fract(t) * 543.0) - 0.5) * u_grain * 0.12;

  fragColor = vec4(col, 1.0);
}`;

  const canvas = document.getElementById("gl");
  const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });

  const noop = { goTo() {}, applyFx() {}, toggleFx() {}, target() { return 0; } };
  if (!gl) {
    document.body.classList.add("no-gl");
    return noop;
  }

  try {
    // -- compile ----------------------------------------------------------

    function shader(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(s));
      }
      return s;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, shader(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      throw new Error(gl.getProgramInfoLog(prog));
    }
    gl.useProgram(prog);

    // -- one fullscreen triangle -----------------------------------------

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    const U = {};
    for (const name of ["res", "time", "slide", "prev", "progress", "pixel", "dots", "grid", "ca", "grain"]) {
      U[name] = gl.getUniformLocation(prog, "u_" + name);
    }

    // -- state -------------------------------------------------------------

    const TRANSITION_MS = 950;
    let current = -1;      // scene on screen
    let prev = -1;         // scene we dissolve from (-1 paints black)
    let startedAt = -1;    // transition start timestamp
    let time = 0;
    let last = performance.now();
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

    const effects = {};
    for (const key of ["pixel", "dots", "grid", "ca", "grain"]) {
      effects[key] = { value: 0, target: 0 };
    }

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener("resize", resize);
    resize();

    // -- frame -------------------------------------------------------------

    function frame(now) {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduceMotion) time += dt;

      for (const key in effects) {
        const fx = effects[key];
        fx.value += (fx.target - fx.value) * Math.min(1, dt * 7);
      }

      let p = 1;
      if (startedAt >= 0) {
        p = Math.min(1, (now - startedAt) / TRANSITION_MS);
        p = p * p * (3 - 2 * p); // smoothstep
      }

      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform1f(U.time, time);
      gl.uniform1i(U.slide, current);
      gl.uniform1i(U.prev, prev);
      gl.uniform1f(U.progress, p);
      gl.uniform1f(U.pixel, effects.pixel.value);
      gl.uniform1f(U.dots, effects.dots.value);
      gl.uniform1f(U.grid, effects.grid.value);
      gl.uniform1f(U.ca, effects.ca.value);
      gl.uniform1f(U.grain, effects.grain.value);

      gl.drawArrays(gl.TRIANGLES, 0, 3);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    // -- public api --------------------------------------------------------

    return {
      goTo(scene) {
        if (scene === current) return;
        prev = current;
        current = scene;
        startedAt = performance.now();
      },
      applyFx(map) {
        for (const key in map) {
          if (effects[key]) effects[key].target = map[key];
        }
      },
      toggleFx(key) {
        if (effects[key]) effects[key].target = effects[key].target > 0.5 ? 0 : 1;
      },
      target(key) {
        return effects[key] ? effects[key].target : 0;
      }
    };
  } catch (err) {
    console.error("gl.js:", err);
    document.body.classList.add("no-gl");
    return noop;
  }
})();