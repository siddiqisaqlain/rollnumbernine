// Hero background: light glowing behind fluted (reeded) glass, rendered in WebGL.
// Each flute is a convex cylinder lens: it shows a flipped, magnified slice of the light
// behind it, with chromatic fringing, a specular ridge and a dark groove between flutes.
(() => {
  const cv = document.getElementById('glass');
  if (!cv) return;
  const gl = cv.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false });
  if (!gl) { cv.remove(); return; }                 // CSS fallback on .hero-frame stays visible

  const VERT = `attribute vec2 a; void main(){ gl_Position = vec4(a, 0.0, 1.0); }`;
  const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uLight;
uniform float uFlute;
uniform sampler2D uTex;
uniform float uHasTex;
uniform vec4 uCover;     // fixed background image rect on screen, in CSS px: x, y, w, h
uniform vec3 uFrame;     // canvas left, top (CSS px), device pixel ratio

float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

// the black plastic, sampled where the fixed site background sits, graded to the palette
vec3 plastic(vec2 p){
  vec2 css = vec2(uFrame.x + p.x / uFrame.z, uFrame.y + (uRes.y - p.y) / uFrame.z);
  vec2 tuv = (css - uCover.xy) / uCover.zw;
  float l = dot(texture2D(uTex, tuv).rgb, vec3(0.30, 0.59, 0.11));
  l = clamp((l - 0.06) * 1.2, 0.0, 1.0);
  return mix(vec3(0.0), vec3(0.62, 0.52, 0.86), l) * 0.55 * uHasTex;
}

// the light field behind the glass, in pixel coords
vec3 scene(vec2 p){
  vec2 uv = p / uRes;
  float asp = uRes.x / uRes.y;
  vec2 q = vec2(uv.x * asp, uv.y);
  float t = uTime;
  vec3 col = vec3(0.010, 0.008, 0.018) + plastic(p);

  // violet bloom rising from the bottom
  vec2 c1 = vec2(uLight.x * asp, 0.02 + 0.04 * sin(t * 0.40));
  vec2 d1 = (q - c1) * vec2(0.95, 0.70);
  col += vec3(0.49, 0.22, 0.92) * exp(-dot(d1, d1) * 4.2) * 1.5;

  // magenta-pink core
  vec2 c2 = c1 + vec2(0.07 * sin(t * 0.31), 0.13 + 0.03 * sin(t * 0.53));
  vec2 d2 = (q - c2) * vec2(1.2, 0.85);
  col += vec3(1.0, 0.40, 0.85) * exp(-dot(d2, d2) * 10.0) * 1.25;

  // white-hot centre
  vec2 d3 = (q - c2 - vec2(0.0, -0.05)) * vec2(1.5, 1.0);
  col += vec3(1.0, 0.94, 1.0) * exp(-dot(d3, d3) * 30.0) * 1.35;

  // icy blue, upper right
  vec2 c4 = vec2(asp * 0.94 + 0.05 * sin(t * 0.23), 0.80 + 0.05 * cos(t * 0.27));
  vec2 d4 = q - c4;
  col += vec3(0.42, 0.66, 1.0) * exp(-dot(d4, d4) * 6.5) * 0.38;

  // small lime glint that wanders
  vec2 c5 = vec2(uLight.x * asp - 0.38 + 0.07 * sin(t * 0.5), 0.46 + 0.09 * sin(t * 0.37) + (uLight.y - 0.5) * 0.2);
  vec2 d5 = q - c5;
  col += vec3(0.78, 1.0, 0.20) * exp(-dot(d5, d5) * 20.0) * 0.32;

  return col;
}

void main(){
  vec2 p = gl_FragCoord.xy;
  float w = uFlute;
  float idx = floor(p.x / w);
  float c = fract(p.x / w) - 0.5;                    // -0.5 .. 0.5 across one flute
  float center = (idx + 0.5) * w;

  // convex lens: inverted, magnified slice, tiny per-flute irregularity like real cast glass
  float k = -2.3 + (hash(vec2(idx, 3.0)) - 0.5) * 0.18;
  float sy = p.y + c * c * w * 1.4;                  // slight bow toward the edges

  vec3 col;
  col.r = scene(vec2(center + c * w * k * 1.06, sy)).r;
  col.g = scene(vec2(center + c * w * k,        sy)).g;
  col.b = scene(vec2(center + c * w * k * 0.94, sy)).b;

  // frosting: blend toward the light at the flute centre
  col = mix(col, scene(vec2(center, p.y)), 0.18);

  // cylinder shading: darker toward the flute edges
  float e = abs(c) * 2.0;
  col *= 1.0 - e * e * e * e * 0.62;

  // specular ridges, stronger where the light is bright
  float lum = dot(col, vec3(0.30, 0.59, 0.11));
  float s1 = (c + 0.30) / 0.035;
  float s2 = (c - 0.40) / 0.022;
  col += vec3(1.0) * exp(-s1 * s1) * (0.05 + lum * 0.60);
  col += vec3(0.86, 0.90, 1.0) * exp(-s2 * s2) * (0.025 + lum * 0.28);

  // groove between flutes
  col *= 1.0 - smoothstep(0.465, 0.5, abs(c)) * 0.7;

  // faint diagonal sheen across the pane
  vec2 uv = p / uRes;
  col += vec3(1.0) * 0.022 * smoothstep(0.0, 1.0, 1.0 - abs(uv.x - uv.y * 0.45 - 0.25) * 3.0);

  // vignette, tonemap, grain
  col *= mix(0.5, 1.0, smoothstep(1.3, 0.2, length((uv - vec2(0.6, 0.4)) * vec2(1.05, 1.0))));
  col = 1.0 - exp(-col * 1.4);
  col += (hash(p + fract(uTime * 7.0)) - 0.5) * 0.03;
  gl_FragColor = vec4(col, 1.0);
}`;

  const sh = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  };
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (err) { console.warn('glass shader:', err); cv.remove(); return; }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);  // one big triangle
  const loc = gl.getAttribLocation(prog, 'a');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = n => gl.getUniformLocation(prog, n);
  const uRes = U('uRes'), uTime = U('uTime'), uLight = U('uLight'), uFlute = U('uFlute');
  const uHasTex = U('uHasTex'), uCover = U('uCover'), uFrame = U('uFrame');

  // plastic texture (embedded data URI, so it isn't blocked on file://)
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
  ['TEXTURE_WRAP_S', 'TEXTURE_WRAP_T'].forEach(k => gl.texParameteri(gl.TEXTURE_2D, gl[k], gl.CLAMP_TO_EDGE));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.uniform1i(U('uTex'), 0);
  let texW = 1, texH = 1, hasTex = 0;
  if (window.PLASTIC_TEX) {
    const img = new Image();
    img.onload = () => {
      try {
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
        texW = img.naturalWidth; texH = img.naturalHeight; hasTex = 1;
        draw(last);
      } catch (err) { console.warn('glass texture:', err); }
    };
    img.src = window.PLASTIC_TEX;
  }

  // mirror the CSS of .bg-layer: inset -48px, background-size cover, centred
  const BLEED = 48;
  function cover() {
    const lw = innerWidth + BLEED * 2, lh = innerHeight + BLEED * 2;
    const s = Math.max(lw / texW, lh / texH), dw = texW * s, dh = texH * s;
    return [-BLEED + (lw - dw) / 2, -BLEED + (lh - dh) / 2, dw, dh];
  }

  let dpr = 1;
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    const w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h);
    draw(last);
  };

  // the light leans toward the mouse, eased
  const light = { x: .56, y: .5 }, target = { x: .56, y: .5 };
  const frame = cv.parentElement;
  frame.addEventListener('pointermove', e => {
    const r = frame.getBoundingClientRect();
    target.x = .38 + ((e.clientX - r.left) / r.width) * .42;
    target.y = 1 - (e.clientY - r.top) / r.height;
  });
  frame.addEventListener('pointerleave', () => { target.x = .56; target.y = .5; });

  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now();
  let last = 0, raf = 0, visible = true;

  function draw(t) {
    gl.uniform2f(uRes, cv.width, cv.height);
    gl.uniform1f(uTime, t);
    gl.uniform2f(uLight, light.x, light.y);
    gl.uniform1f(uFlute, Math.max(14, Math.round((innerWidth < 640 ? 20 : 30) * dpr)));
    const r = cv.getBoundingClientRect();
    gl.uniform1f(uHasTex, hasTex);
    gl.uniform4f(uCover, ...cover());
    gl.uniform3f(uFrame, r.left, r.top, dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function loop(now) {
    raf = 0;
    last = (now - t0) / 1000;
    light.x += (target.x - light.x) * .04;
    light.y += (target.y - light.y) * .04;
    draw(last);
    if (visible && !calm) raf = requestAnimationFrame(loop);
  }
  const start = () => { if (!raf && !calm) raf = requestAnimationFrame(loop); };

  new ResizeObserver(resize).observe(cv);
  new IntersectionObserver(([en]) => { visible = en.isIntersecting && !document.hidden; visible ? start() : 0; }).observe(cv);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; visible ? start() : 0; });
  resize();
  calm ? draw(4) : start();
})();
