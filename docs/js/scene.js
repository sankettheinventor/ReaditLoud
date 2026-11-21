import * as THREE from './three.module.min.js';

/* The ReaditLoud book: closed and floating at the gate, opens on enter,
   pages flutter, words pulse rings of light out of it while the narrator speaks. */
export function initScene(canvas, opts) {
  opts = opts || {};
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  const reduce = !!opts.reduce;
  const small = () => innerWidth < 760;
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.autoClear = false;
  renderer.setClearColor(0x0e0a1f, 1);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0e0a1f, 0.045);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0, 7.2);

  /* light */
  scene.add(new THREE.HemisphereLight(0xcfc0ff, 0x1a1033, 1.1));
  const key = new THREE.DirectionalLight(0xffe2b8, 2.2); key.position.set(3, 4, 6); scene.add(key);
  const rim = new THREE.PointLight(0xff6ea0, 10, 14, 2); rim.position.set(-3.2, -1.2, -1.2); scene.add(rim);
  const top = new THREE.PointLight(0x8a6cff, 22, 14, 2); top.position.set(2.5, 2.5, 1); scene.add(top);

  /* helpers */
  function canvasTex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); draw(g, w, h);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
    t.userData = { c, g }; return t;
  }
  function radial(inner, outer) {
    return canvasTex(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, inner); gr.addColorStop(0.35, outer); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
  }

  /* book geometry */
  const W = 1.45, H = 1.95, T = 0.05, BLOCK = 0.16;
  const book = new THREE.Group();
  const holder = new THREE.Group(); holder.add(book); scene.add(holder);

  const coverMat = new THREE.MeshStandardMaterial({ color: 0x6d4ae6, roughness: 0.42, metalness: 0.15, emissive: 0x241052, emissiveIntensity: 0.4 });
  const innerMat = new THREE.MeshStandardMaterial({ color: 0xefe8ff, roughness: 0.9, emissive: 0xefe8ff, emissiveIntensity: 0.15 });
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xf5efe2, roughness: 0.95 });

  // front cover art: logo + title, drawn into a canvas
  const coverTex = canvasTex(512, 690, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, '#7D5CF0'); gr.addColorStop(0.55, '#8A52D8'); gr.addColorStop(1, '#FF6EA0');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(255,211,107,.55)'; g.lineWidth = 3; g.strokeRect(26, 26, w - 52, h - 52);
    g.strokeStyle = 'rgba(255,211,107,.25)'; g.lineWidth = 1.5; g.strokeRect(38, 38, w - 76, h - 76);
    g.fillStyle = '#FFF'; g.textAlign = 'center';
    g.font = 'italic 400 34px Serif, Georgia, serif'; g.fillStyle = 'rgba(255,255,255,.85)'; g.fillText('every page,', w / 2, 470);
    g.font = '400 66px Serif, Georgia, serif'; g.fillStyle = '#fff'; g.fillText('ReaditLoud', w / 2, 545);
    g.font = '700 16px Jakarta, sans-serif'; g.fillStyle = 'rgba(255,211,107,.9)';
    g.fillText('R E A D   O U T   L O U D', w / 2, 600);
  });
  const logoImg = new Image();
  logoImg.onload = () => {
    const { g } = coverTex.userData; g.save();
    g.shadowColor = 'rgba(20,0,60,.45)'; g.shadowBlur = 30; g.shadowOffsetY = 10;
    g.drawImage(logoImg, 156, 150, 200, 200); g.restore(); coverTex.needsUpdate = true;
  };
  logoImg.src = 'logo.svg';
  const coverFront = new THREE.MeshStandardMaterial({ map: coverTex, roughness: 0.38, metalness: 0.12 });

  // back cover + page block (static, right side)
  const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, T), coverMat);
  back.position.set(W / 2, 0, -T / 2); book.add(back);
  const block = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, H - 0.07, BLOCK), [edgeMat, edgeMat, edgeMat, edgeMat, innerMat, innerMat]);
  block.position.set(W / 2 - 0.02, 0, BLOCK / 2); book.add(block);
  const spine = new THREE.Mesh(new THREE.BoxGeometry(T, H, BLOCK + T * 2), coverMat);
  spine.position.set(-T / 2 + 0.005, 0, BLOCK / 2); book.add(spine);

  // right page (on top of block) with live text texture
  const LINES = 15;
  let litLine = -1;
  const pageTex = canvasTex(512, 690, () => {});
  function drawPage(lit) {
    const { g } = pageTex.userData, w = 512, h = 690;
    g.fillStyle = '#FBF8FF'; g.fillRect(0, 0, w, h);
    const sh = g.createLinearGradient(0, 0, 60, 0); sh.addColorStop(0, 'rgba(90,60,140,.18)'); sh.addColorStop(1, 'rgba(90,60,140,0)');
    g.fillStyle = sh; g.fillRect(0, 0, 60, h);
    g.fillStyle = '#2A2140'; g.textAlign = 'left';
    g.font = 'italic 400 30px Serif, Georgia, serif'; g.fillText('Chapter one', 62, 92);
    for (let i = 0; i < LINES; i++) {
      const y = 140 + i * 34, len = (i % 5 === 4) ? 0.55 : 0.82 + ((i * 37) % 11) / 100;
      if (i === lit) {
        const gr = g.createLinearGradient(56, 0, 56 + 400 * len, 0);
        gr.addColorStop(0, 'rgba(255,211,107,.95)'); gr.addColorStop(1, 'rgba(255,110,160,.85)');
        g.fillStyle = gr; roundRect(g, 54, y - 14, 400 * len + 16, 26, 7); g.fill();
        g.fillStyle = '#3B2A12';
      } else g.fillStyle = i < lit ? 'rgba(42,33,64,.62)' : 'rgba(42,33,64,.26)';
      roundRect(g, 62, y - 5, 400 * len, 9, 4.5); g.fill();
    }
    g.fillStyle = 'rgba(42,33,64,.4)'; g.font = '400 18px Serif, Georgia, serif'; g.textAlign = 'center'; g.fillText('1', w / 2, h - 34);
    pageTex.needsUpdate = true;
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  drawPage(-1);
  const rightPage = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.1, H - 0.1), new THREE.MeshStandardMaterial({ map: pageTex, roughness: 0.95, emissive: 0xffffff, emissiveIntensity: 0.32, emissiveMap: pageTex }));
  rightPage.position.set(W / 2 - 0.02, 0, BLOCK + 0.003); book.add(rightPage);

  // flipping sheets: bendable planes, front blank, back printed
  const leftTex = canvasTex(512, 690, (g, w, h) => {
    g.fillStyle = '#FBF8FF'; g.fillRect(0, 0, w, h);
    const sh = g.createLinearGradient(w - 60, 0, w, 0); sh.addColorStop(0, 'rgba(90,60,140,0)'); sh.addColorStop(1, 'rgba(90,60,140,.18)');
    g.fillStyle = sh; g.fillRect(w - 60, 0, 60, h);
    g.fillStyle = '#2A2140'; g.textAlign = 'center';
    g.font = 'italic 400 34px Serif, Georgia, serif'; g.fillText('Don’t read it.', w / 2, 300);
    g.font = '400 52px Serif, Georgia, serif'; g.fillText('Hear it.', w / 2, 362);
    g.strokeStyle = 'rgba(255,155,47,.8)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2 - 40, 400); g.lineTo(w / 2 + 40, 400); g.stroke();
  });
  const SEG = 24, SHEETS = 7;
  const sheets = [];
  for (let s = 0; s < SHEETS; s++) {
    const geo = new THREE.PlaneGeometry(W - 0.1, H - 0.1, SEG, 1);
    geo.translate((W - 0.1) / 2, 0, 0);
    const base = geo.attributes.position.array.slice();
    const isLast = s === SHEETS - 1;
    const front = new THREE.MeshStandardMaterial({ color: 0xfbf8ff, roughness: 0.95, side: THREE.FrontSide, emissive: 0xfff6ea, emissiveIntensity: 0.28 });
    const backM = new THREE.MeshStandardMaterial({ color: 0xfbf8ff, roughness: 0.95, side: THREE.BackSide, emissive: 0xfff6ea, emissiveIntensity: 0.28 });
    const pivot = new THREE.Group();
    pivot.position.set(0.0, 0, BLOCK + 0.006 + s * 0.0025);
    const m1 = new THREE.Mesh(geo, front), m2 = new THREE.Mesh(geo, backM);
    pivot.add(m1, m2); book.add(pivot);
    sheets.push({ pivot, geo, base, t: -1, start: 0.28 + s * 0.065 });
  }
  // the front cover pivot
  const coverPivot = new THREE.Group(); coverPivot.position.set(0, 0, BLOCK + T / 2 + 0.03);
  const front = new THREE.Mesh(new THREE.BoxGeometry(W, H, T), [coverMat, coverMat, coverMat, coverMat, coverFront, new THREE.MeshStandardMaterial({ map: leftTex, roughness: 0.95, emissive: 0xffffff, emissiveIntensity: 0.32, emissiveMap: leftTex })]);
  front.position.set(W / 2, 0, 0); coverPivot.add(front); book.add(coverPivot);

  // glow + rings
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial('rgba(160,120,255,.9)', 'rgba(125,92,240,.25)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.set(5, 5, 1); glow.position.set(0, 0, -0.6); holder.add(glow);
  const ringGeo = new THREE.RingGeometry(0.98, 1, 96);
  const rings = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: i % 2 ? 0xffb73d : 0xa58bff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.visible = false; holder.add(m); rings.push({ m, t: 1, s: 1 });
  }
  let ringIdx = 0;

  // fireflies
  const N = reduce ? 120 : (small() ? 220 : 420);
  const pGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(N * 3), col = new Float32Array(N * 3), seed = new Float32Array(N * 4);
  const palette = [new THREE.Color(0xffd36b), new THREE.Color(0xff9b2f), new THREE.Color(0xa58bff), new THREE.Color(0xff6ea0), new THREE.Color(0xffffff)];
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 16; pos[i * 3 + 1] = (Math.random() - 0.5) * 11; pos[i * 3 + 2] = -6 + Math.random() * 9;
    const c = palette[(Math.random() * palette.length) | 0]; col.set([c.r, c.g, c.b], i * 3);
    seed.set([Math.random() * 6.28, 0.15 + Math.random() * 0.35, Math.random() * 6.28, 0.4 + Math.random()], i * 4);
  }
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const flies = new THREE.Points(pGeo, new THREE.PointsMaterial({ size: 0.09, map: radial('rgba(255,255,255,1)', 'rgba(255,255,255,.35)'), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
  scene.add(flies);

  /* ───────── water: a ripple simulation the visitor stirs with their hand ───────── */
  const water = makeWater();
  function makeWater() {
    const SIMH = reduce ? 128 : (small() ? 170 : 260);
    let sw = 2, sh = 2, aspect = 1;
    const opts = { type: THREE.HalfFloatType, format: THREE.RGBAFormat, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false, stencilBuffer: false };
    let rtA = new THREE.WebGLRenderTarget(2, 2, opts), rtB = new THREE.WebGLRenderTarget(2, 2, opts);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.PlaneGeometry(2, 2);
    const vert = 'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}';
    const MAXD = 12;
    const dropsU = []; for (let i = 0; i < MAXD; i++) dropsU.push(new THREE.Vector4());
    const sim = new THREE.ShaderMaterial({
      uniforms: { tPrev: { value: null }, px: { value: new THREE.Vector2() }, drops: { value: dropsU }, nDrops: { value: 0 }, aspect: { value: 1 }, damp: { value: 0.985 } },
      vertexShader: vert,
      fragmentShader: `precision highp float;
        uniform sampler2D tPrev; uniform vec2 px; uniform vec4 drops[${MAXD}]; uniform int nDrops; uniform float aspect; uniform float damp; varying vec2 vUv;
        void main(){
          vec4 c = texture2D(tPrev, vUv);
          float sum = texture2D(tPrev, vUv + vec2(px.x,0.)).r + texture2D(tPrev, vUv - vec2(px.x,0.)).r
                    + texture2D(tPrev, vUv + vec2(0.,px.y)).r + texture2D(tPrev, vUv - vec2(0.,px.y)).r;
          float h = (sum * 0.5 - c.g) * damp;
          for (int i = 0; i < ${MAXD}; i++) {
            if (i >= nDrops) break;
            vec2 d = vUv - drops[i].xy; d.x *= aspect;
            float r = drops[i].z;
            h += drops[i].w * exp(-dot(d,d) / (r*r));
          }
          gl_FragColor = vec4(clamp(h,-2.,2.), c.r, 0., 1.);
        }`,
      depthTest: false, depthWrite: false
    });
    const simScene = new THREE.Scene(); simScene.add(new THREE.Mesh(quad, sim));
    const show = new THREE.ShaderMaterial({
      uniforms: { tH: { value: null }, px: { value: new THREE.Vector2() }, time: { value: 0 }, aspect: { value: 1 }, scroll: { value: 0 }, glow: { value: 0 } },
      vertexShader: vert,
      fragmentShader: `precision highp float;
        uniform sampler2D tH; uniform vec2 px; uniform float time; uniform float aspect; uniform float scroll; uniform float glow; varying vec2 vUv;
        float amb(vec2 p){
          p.y += scroll * 0.35;
          return 0.010*sin(p.x*9.0*aspect + time*0.55 + sin(p.y*3.0 + time*0.2)*1.6)
               + 0.008*sin(p.y*13.0 - time*0.7 + p.x*4.0)
               + 0.005*sin((p.x*aspect + p.y)*21.0 + time*1.1);
        }
        float H(vec2 p){ return texture2D(tH, p).r * 0.07 + amb(p); }
        vec3 sky(vec2 uv){
          vec2 p = vec2(uv.x * aspect, 1.0 - uv.y);
          vec3 c = vec3(0.055, 0.039, 0.122);
          float a1 = 1.0 - smoothstep(0.0, 0.78, length((p - vec2(0.5*aspect, 0.18)) * vec2(0.72, 1.05)));
          float a2 = 1.0 - smoothstep(0.0, 0.70, length(p - vec2(0.92*aspect, 0.82)));
          float a3 = 1.0 - smoothstep(0.0, 0.80, length(p - vec2(0.06*aspect, 0.92)));
          c += vec3(0.24, 0.15, 0.52) * a1 * a1 * (0.7 + glow * 0.3);
          c += vec3(0.42, 0.12, 0.26) * a2 * a2 * 0.55;
          c += vec3(0.24, 0.12, 0.42) * a3 * a3 * 0.6;
          float v = length((uv - 0.5) * vec2(1.0, 1.1));
          c *= 1.0 - smoothstep(0.45, 0.95, v) * 0.55;
          return c;
        }
        void main(){
          vec2 e = px * 1.5;
          float h  = H(vUv);
          float hx = H(vUv + vec2(e.x,0.)) - H(vUv - vec2(e.x,0.));
          float hy = H(vUv + vec2(0.,e.y)) - H(vUv - vec2(0.,e.y));
          vec3 n = normalize(vec3(-hx * 9.0, -hy * 9.0, 1.0));
          vec2 ruv = vUv + n.xy * 0.09;
          vec3 col = sky(ruv);
          // light glancing off the surface
          vec3 L = normalize(vec3(-0.35, 0.65, 0.68));
          float spec = pow(max(dot(reflect(-L, n), vec3(0.,0.,1.)), 0.0), 90.0);
          float rim = pow(1.0 - n.z, 1.3);
          float lap = (H(vUv + vec2(e.x,0.)) + H(vUv - vec2(e.x,0.)) + H(vUv + vec2(0.,e.y)) + H(vUv - vec2(0.,e.y)) - 4.0*h);
          float caus = clamp(-lap * 260.0, 0.0, 1.0);
          col += vec3(1.0, 0.80, 0.55) * spec * 0.35;
          col += vec3(0.62, 0.50, 1.0) * rim * 0.55;
          col += vec3(1.0, 0.72, 0.40) * caus * 0.10;
          gl_FragColor = vec4(col, 1.0);
        }`,
      depthTest: false, depthWrite: false
    });
    const showScene = new THREE.Scene(); showScene.add(new THREE.Mesh(quad, show));
    const queue = [];
    function size(w, h) {
      aspect = w / h; sh = SIMH; sw = Math.max(64, Math.round(SIMH * aspect));
      rtA.setSize(sw, sh); rtB.setSize(sw, sh);
      renderer.setRenderTarget(rtA); renderer.clear(); renderer.setRenderTarget(rtB); renderer.clear(); renderer.setRenderTarget(null);
      sim.uniforms.px.value.set(1 / sw, 1 / sh); show.uniforms.px.value.set(1 / sw, 1 / sh);
      sim.uniforms.aspect.value = aspect; show.uniforms.aspect.value = aspect;
    }
    return {
      size,
      drop(x, y, r, s) { if (queue.length < 40) queue.push([x, y, r, s]); },
      step(t, scrollP, glow) {
        const n = Math.min(MAXD, queue.length);
        for (let i = 0; i < n; i++) { const d = queue.shift(); dropsU[i].set(d[0], d[1], d[2], d[3]); }
        sim.uniforms.nDrops.value = n;
        for (let k = 0; k < 2; k++) {
          sim.uniforms.tPrev.value = rtA.texture;
          renderer.setRenderTarget(rtB); renderer.render(simScene, cam);
          const tmp = rtA; rtA = rtB; rtB = tmp;
          sim.uniforms.nDrops.value = 0;
        }
        renderer.setRenderTarget(null);
        show.uniforms.tH.value = rtA.texture; show.uniforms.time.value = t; show.uniforms.scroll.value = scrollP; show.uniforms.glow.value = glow;
        renderer.render(showScene, cam);
      }
    };
  }

  /* the visitor's hand over the water */
  let lastX = -1, lastY = -1, lastMove = 0, lastScrollY = scrollY, idle = 0;
  function stir(x, y, force) {
    const u = x / innerWidth, v = 1 - y / innerHeight;
    if (lastX >= 0) {
      const dx = x - lastX, dy = y - lastY, dist = Math.hypot(dx, dy);
      const steps = Math.min(4, Math.max(1, Math.floor(dist / 26)));
      const s = Math.min(0.11, (0.012 + dist * 0.0016) * (force || 1));
      for (let i = 1; i <= steps; i++) {
        const k = i / steps;
        water.drop((lastX + dx * k) / innerWidth, 1 - (lastY + dy * k) / innerHeight, 0.016, s / steps * 1.6);
      }
    } else water.drop(u, v, 0.02, 0.03);
    lastX = x; lastY = y; lastMove = performance.now();
  }
  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.pointerType === 'pen') stir(e.clientX, e.clientY); }, { passive: true });
  addEventListener('pointerdown', (e) => { water.drop(e.clientX / innerWidth, 1 - e.clientY / innerHeight, 0.03, 0.22); lastX = e.clientX; lastY = e.clientY; }, { passive: true });
  addEventListener('touchmove', (e) => { const t = e.touches[0]; if (t) stir(t.clientX, t.clientY, 0.8); }, { passive: true });
  addEventListener('touchend', () => { lastX = -1; }, { passive: true });
  addEventListener('scroll', () => {
    const d = scrollY - lastScrollY; lastScrollY = scrollY;
    if (!d) return;
    // the hand skims the surface as the page moves under it
    const x = lastX >= 0 ? lastX : innerWidth * (0.3 + Math.random() * 0.4);
    const y = lastY >= 0 ? lastY : innerHeight * 0.5;
    const s = Math.min(0.12, Math.abs(d) * 0.0011);
    water.drop(x / innerWidth, 1 - (y - d * 0.5) / innerHeight, 0.02, s);
    if (Math.abs(d) > 30) water.drop((x + (Math.random() - 0.5) * 220) / innerWidth, 1 - y / innerHeight, 0.014, s * 0.6);
  }, { passive: true });

  /* materials that fade with the book */
  const fadeMats = new Set(); let lastVis = 1, ringFade = 1;
  book.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => fadeMats.add(m)); });
  /* state */
  const bookScreen = new THREE.Vector3();
  let finale = 0, opened = false, openT = 0, energy = 0, scrollP = 0, mx = 0, my = 0, cmx = 0, cmy = 0, speaking = false;
  const clock = new THREE.Clock();
  resize();

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    if (typeof water !== 'undefined' && water) water.size(w, h);
  }
  addEventListener('resize', resize);
  addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });

  const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);
  const easeIO = (x) => { x = Math.min(1, Math.max(0, x)); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; };
  const lerp = (a, b, t) => a + (b - a) * t;

  function bend(sh, p) {
    // p 0..1 flip progress; curl the sheet while it travels
    const arr = sh.geo.attributes.position.array, base = sh.base, k = Math.sin(p * Math.PI) * 0.32;
    for (let i = 0; i < arr.length; i += 3) {
      const u = base[i] / (W - 0.1);
      arr[i + 2] = base[i + 2] + k * Math.sin(u * Math.PI * 0.9) * u;
    }
    sh.geo.attributes.position.needsUpdate = true;
  }

  function frame() {
    const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
    if (opened) openT = Math.min(1, openT + dt / (reduce ? 0.01 : 3.2));
    // cover and sheets
    coverPivot.rotation.y = -Math.PI * 0.985 * easeIO(openT / 0.55);
    for (const sh of sheets) {
      const p = easeIO((openT - sh.start) / 0.3);
      if (p !== sh.t) { sh.t = p; sh.pivot.rotation.y = -Math.PI * (0.972 + sheets.indexOf(sh) * 0.0015) * p; bend(sh, p); }
    }
    // pose: closed + tilted at the gate, open + facing on the hero, then drifts away as you scroll
    const o = ease(openT);
    // the book is part of the page: it scrolls away with the hero and comes back with the finale
    const mob = small();
    const VH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
    const sc0 = mob ? 0.58 : 0.76, sc1 = mob ? 0.5 : 0.6;
    const sc = lerp(sc0, sc1, o);
    const centreX = lerp(-W / 2, 0, o) * sc;
    const baseY = lerp(mob ? 0.5 : 0.42, mob ? 1.15 : 1.3, o);
    const fin = Math.min(1, Math.max(0, finale));
    const away = Math.min(1, scrollP);
    const ty = fin > 0 && away >= 1 ? baseY - (1 - fin) * VH : baseY + away * VH;
    holder.position.set(centreX, ty + Math.sin(t * 0.8) * 0.05, 0);
    holder.scale.setScalar(sc);
    cmx = lerp(cmx, mx, 0.05); cmy = lerp(cmy, my, 0.05);
    book.rotation.x = lerp(-0.42, -0.28, o) + cmy * 0.22 + Math.sin(t * 0.6) * 0.03;
    book.rotation.y = lerp(0.55 + Math.sin(t * 0.35) * 0.25, 0, o) + cmx * 0.3;
    book.rotation.z = lerp(-0.12, 0, o) + Math.sin(t * 0.5) * 0.015;
    const sp2 = (away >= 1 && fin > 0) ? 1 - fin : easeIO(away);
    // the book steps out of the way while you read the middle of the page, and returns for the finale
    const vis = 1 - sp2;
    if (Math.abs(vis - lastVis) > 0.002) { lastVis = vis; for (const m of fadeMats) { m.opacity = vis; m.transparent = vis < 0.999; m.depthWrite = vis > 0.5; } book.visible = vis > 0.01; }
    ringFade = 0.35 + 0.65 * vis;
    cmx = lerp(cmx, mx, 0.05); cmy = lerp(cmy, my, 0.05);
    book.rotation.x = lerp(-0.42, -0.28, o) + cmy * 0.22 + Math.sin(t * 0.6) * 0.03;
    book.rotation.y = lerp(0.55 + Math.sin(t * 0.35) * 0.25, 0, o) + cmx * 0.3 + lerp(0, -0.4, sp2);
    book.rotation.z = lerp(-0.12, 0, o) + Math.sin(t * 0.5) * 0.015;
    // energy from narration pulses
    energy *= Math.pow(0.04, dt);
    const sEnergy = speaking ? 0.35 : 0;
    glow.material.opacity = (0.35 + o * 0.35 + energy * 0.5 + sEnergy * 0.3) * ringFade;
    glow.scale.setScalar(5 + energy * 1.2 + Math.sin(t * 1.3) * 0.2);
    rim.intensity = 8 + energy * 22; top.intensity = 16 + energy * 16;
    for (const r of rings) {
      if (r.t >= 1) { r.m.visible = false; continue; }
      r.t += dt / 1.9; const e = ease(r.t);
      r.m.visible = true; r.m.scale.setScalar(1.1 + e * 1.9 * r.s); r.m.material.opacity = (1 - r.t) * (1 - r.t) * 0.42 * r.s * ringFade;
      r.m.rotation.z += dt * 0.2;
    }
    // fireflies
    const a = pGeo.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const s0 = seed[i * 4], sp_ = seed[i * 4 + 1] * (1 + energy * 1.5 + sEnergy);
      a[i * 3 + 1] += dt * sp_ * 0.35;
      a[i * 3] += Math.sin(t * seed[i * 4 + 3] + s0) * dt * 0.08;
      if (a[i * 3 + 1] > 5.8) { a[i * 3 + 1] = -5.8; a[i * 3] = (Math.random() - 0.5) * 16; }
    }
    pGeo.attributes.position.needsUpdate = true;
    flies.material.size = 0.08 + Math.sin(t * 2) * 0.006 + energy * 0.02;
    camera.position.x = cmx * 0.4; camera.position.y = -cmy * 0.3; camera.lookAt(0, 0.2, 0);
    // a slow rain of tiny drops keeps the water alive even when nobody touches it
    idle += dt;
    if (idle > (reduce ? 3 : 0.9)) { idle = 0; water.drop(Math.random(), Math.random(), 0.012, 0.03 + Math.random() * 0.03); }
    renderer.setRenderTarget(null); renderer.clear();
    water.step(t, scrollP, energy + (speaking ? 0.3 : 0));
    renderer.clearDepth();
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    open() { opened = true; },
    pulse(strength) {
      energy = Math.min(1.4, energy + (strength || 0.6));
      holder.getWorldPosition(bookScreen); bookScreen.project(camera);
      if (book.visible) water.drop(bookScreen.x * 0.5 + 0.5 + (Math.random() - 0.5) * 0.04, bookScreen.y * 0.5 + 0.5 - 0.02, 0.02, 0.035 * (strength || 0.6));
      const r = rings[ringIdx++ % rings.length];
      r.t = 0; r.s = 0.7 + Math.random() * 0.5; r.m.rotation.z = Math.random() * 6;
    },
    speaking(on) { speaking = !!on; },
    progress(p) { const l = Math.min(LINES - 1, Math.floor(p * LINES)); if (l !== litLine) { litLine = l; drawPage(l); } },
    scroll(p) { scrollP = p; },
    finale(f) { finale = Math.min(1, Math.max(0, f)); }
  };
}
