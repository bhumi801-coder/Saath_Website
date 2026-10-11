// Cinematic 3D hero: a polished metallic ring floating above a dark glossy ribbon.
// Loaded lazily (dynamic import) so the three.js chunk never blocks first paint.
import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const VIOLET = 0x8b5cf6;
const LILAC = 0xc4b5fd;

// Image-based lighting: a dark studio with a few violet and white soft-boxes.
// The ring and ribbon reflect this, which is what makes the metal look real.
function buildEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new THREE.Scene();
  room.add(new THREE.Mesh(new THREE.BoxGeometry(40, 40, 40), new THREE.MeshBasicMaterial({ color: 0x07040f, side: THREE.BackSide })));
  const panel = (w, h, color, power, pos) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(power), side: THREE.DoubleSide, toneMapped: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    mesh.position.set(...pos);
    mesh.lookAt(0, 0, 0);
    room.add(mesh);
  };
  panel(16, 3, VIOLET, 7, [0, 10, -4]);
  panel(3, 14, 0xffffff, 5, [-10, 2, 4]);
  panel(3, 12, 0xa855f7, 9, [10, 1, -3]);
  panel(12, 2, LILAC, 4, [0, -7, 7]);
  panel(7, 7, 0x6d28d9, 3, [0, 3, 12]);
  panel(2, 9, 0xe9d5ff, 6, [6, 2, 9]);
  const target = pmrem.fromScene(room, 0.025);
  room.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  pmrem.dispose();
  return target.texture;
}

// A banked, slightly channel-shaped ribbon that sweeps from far upper-left to near lower-right.
export function ribbonCurve() {
  const pts = [[-10, 3.6, -5.5], [-5.5, 2.1, -2.8], [-1.6, 0.6, -0.9], [1.6, -0.35, 0.3], [5.2, -1.7, 1.9], [10, -3.5, 3.8]];
  return new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
}

function buildRibbon(curve) {
  const N = 260; const M = 26; const W = 3.8;
  const pos = new Float32Array((N + 1) * (M + 1) * 3);
  const up = new THREE.Vector3(0, 1, 0);
  const edgeA = []; const edgeB = [];
  const P = new THREE.Vector3(); const T = new THREE.Vector3(); const side = new THREE.Vector3(); const nrm = new THREE.Vector3(); const v = new THREE.Vector3();
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    curve.getPointAt(t, P); curve.getTangentAt(t, T);
    side.crossVectors(T, up).normalize();
    nrm.crossVectors(side, T).normalize();
    const twist = 0.55 + 0.28 * Math.sin(t * Math.PI * 1.3);
    side.applyAxisAngle(T, twist); nrm.applyAxisAngle(T, twist);
    const width = W * (0.92 + 0.22 * Math.sin(t * 3.1 + 0.6));
    for (let j = 0; j <= M; j++) {
      const u = (j / M) * 2 - 1;
      v.copy(P).addScaledVector(side, (u * width) / 2).addScaledVector(nrm, 0.2 * u * u);
      const k = (i * (M + 1) + j) * 3;
      pos[k] = v.x; pos[k + 1] = v.y; pos[k + 2] = v.z;
      if (j === 0) edgeA.push(v.clone());
      if (j === M) edgeB.push(v.clone());
    }
  }
  const idx = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * (M + 1) + j; const b = a + M + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return { geo, edgeA: new THREE.CatmullRomCurve3(edgeA), edgeB: new THREE.CatmullRomCurve3(edgeB) };
}

// Flat metallic band with bevelled edges, like the reference ring.
function buildRingGeometry() {
  const outer = 1.18; const inner = 0.9;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  let geo = new THREE.ExtrudeGeometry(shape, {
    depth: 0.2, curveSegments: 128, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelOffset: 0, bevelSegments: 6, steps: 1,
  });
  geo.center();
  geo = toCreasedNormals(geo, 0.6);
  return geo;
}

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(196,181,253,.8)'); grad.addColorStop(1, 'rgba(139,92,246,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

export function createRingScene(host, { onReady, onFail } = {}) {
  const reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.environment = buildEnvironment(renderer);
  scene.environmentIntensity = 1;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 80);

  // Ribbon + glowing edges
  const curve = ribbonCurve();
  const { geo: ribbonGeo, edgeA, edgeB } = buildRibbon(curve);
  const ribbonMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0518, metalness: 0.85, roughness: 0.14, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.85, side: THREE.DoubleSide });
  const ribbon = new THREE.Mesh(ribbonGeo, ribbonMat);
  scene.add(ribbon);
  const edgeMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xa78bfa).multiplyScalar(2.2), toneMapped: false });
  const tubes = [edgeA, edgeB].map((c) => new THREE.Mesh(new THREE.TubeGeometry(c, 260, 0.016, 6, false), edgeMat));
  tubes.forEach((m) => scene.add(m));

  // Ring (outer group = position/lean, inner mesh = spin)
  const ringGeo = buildRingGeometry();
  const ringMat = new THREE.MeshPhysicalMaterial({ color: 0xd8d0ff, metalness: 1, roughness: 0.13, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.7, iridescence: 0.35, iridescenceIOR: 1.6 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  const ringRig = new THREE.Group();
  ringRig.add(ring);
  // The ring slides down the ribbon from upper-left to lower-right, then the loop restarts
  // while the ring is fully scaled to zero, so there is never a visible jump.
  const TRAVEL = { from: 0.34, to: 0.7, period: 9 };
  const anchor = curve.getPointAt(0.5);
  const baseY = anchor.y + 1.0; const baseZ = anchor.z + 0.9;
  ringRig.rotation.set(0.16, 0, -0.24);
  const contact = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xa78bfa, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(contact);
  scene.add(ringRig);

  // Lights that travel along the ribbon, so reflections keep moving
  const keyLight = new THREE.PointLight(VIOLET, 22, 0, 2);
  const rimLight = new THREE.PointLight(0xe879f9, 28, 0, 2);
  rimLight.position.set(anchor.x - 2.5, baseY + 3, baseZ - 3);
  scene.add(keyLight, rimLight);

  // Light streaks gliding along the ribbon edges (they fade at both ends, so the loop never pops)
  const halo = glowTexture();
  const streaks = [0, 1, 2].map((n) => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: halo, color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.scale.setScalar(0.5);
    scene.add(s);
    return { sprite: s, curve: n % 2 ? edgeB : edgeA, offset: n / 3, speed: 0.045 + n * 0.012 };
  });

  // Dust
  const small = () => host.clientWidth < 640;
  const dustCount = small() ? 40 : 90;
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = (Math.random() - 0.5) * 16; dustPos[i * 3 + 1] = (Math.random() - 0.5) * 8; dustPos[i * 3 + 2] = (Math.random() - 0.5) * 8;
    dustSeed[i] = Math.random() * 100;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: LILAC, size: 0.035, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: true }));
  scene.add(dust);

  const ringPoint = new THREE.Vector3();
  const state = { px: 0, py: 0, tx: 0, ty: 0 };
  const onPointer = (e) => {
    state.tx = (e.clientX / window.innerWidth) * 2 - 1;
    state.ty = (e.clientY / window.innerHeight) * 2 - 1;
  };
  if (finePointer) window.addEventListener('pointermove', onPointer, { passive: true });

  const size = () => {
    const w = Math.max(1, host.clientWidth); const h = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, w < 640 ? 1.5 : 2));
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the ring comfortably in frame from phones to ultrawide screens
    const d = camera.aspect >= 1.2 ? 14.5 : 14 + (1.2 - camera.aspect) * 9;
    camera.position.set(-1.4, 1.7, d);
    camera.lookAt(-2.7, 0.2, 0);
    camera.updateProjectionMatrix();
  };

  const update = (t) => {
    // Seamless loops: only sin/cos and a continuously increasing angle are used.
    const phase = (t / TRAVEL.period) % 1;
    const slide = phase ** 1.25; // gentle acceleration, like sliding down a slope
    const sm = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
    const grow = sm(0, 0.14, phase) * (1 - sm(0.86, 1, phase));
    const f = TRAVEL.from + (TRAVEL.to - TRAVEL.from) * slide;
    curve.getPointAt(f, ringPoint);
    const sc = 0.7 * Math.max(0.0001, grow);
    ringRig.scale.setScalar(sc);
    ringRig.position.set(ringPoint.x, ringPoint.y + 1.0 * sc / 0.7 + Math.sin(t * 1.3) * 0.08, ringPoint.z + 0.9 * sc / 0.7);
    ring.rotation.y = t * 0.9; // keeps turning on its own axis the whole way down
    ringRig.rotation.x = 0.16 + Math.sin(t * 0.55) * 0.04;
    ringRig.rotation.z = -0.3 + Math.cos(t * 0.45) * 0.04;
    contact.position.set(ringPoint.x, ringPoint.y + 0.15, ringPoint.z + 0.35);
    contact.scale.setScalar(3.2 * sc / 0.7 * grow + 0.0001);
    contact.material.opacity = 0.4 * grow;
    state.px += (state.tx - state.px) * 0.04; state.py += (state.ty - state.py) * 0.04;
    camera.position.x = -1.4 + state.px * 0.45;
    camera.position.y = 1.7 - state.py * 0.25;
    camera.lookAt(-2.7, 0.2, 0);
    scene.environmentRotation.y = t * 0.12;
    keyLight.position.set(ringPoint.x + 1.2, ringPoint.y + 1.6, ringPoint.z + 2.6);
    streaks.forEach((s) => {
      const f = (((t * s.speed + s.offset) % 1) + 1) % 1;
      s.sprite.position.copy(s.curve.getPointAt(f));
      s.sprite.material.opacity = Math.sin(f * Math.PI) ** 1.5;
    });
    const arr = dustGeo.attributes.position.array;
    for (let i = 0; i < dustCount; i++) {
      arr[i * 3 + 1] += Math.sin(t * 0.3 + dustSeed[i]) * 0.0009 + 0.0007;
      if (arr[i * 3 + 1] > 4) arr[i * 3 + 1] = -4;
    }
    dustGeo.attributes.position.needsUpdate = true;
  };

  let raf = 0; let t = 0; let last = 0; let visible = true; let ready = false; let disposed = false;
  const draw = () => {
    update(t);
    renderer.render(scene, camera);
    if (!ready) { ready = true; onReady?.(); }
  };
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    t += Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
    draw();
  };
  const shouldRun = () => visible && !document.hidden && !reduceMq.matches;
  const sync = () => {
    if (disposed) return;
    if (shouldRun()) {
      if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    } else {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (reduceMq.matches) { t = 1.4; draw(); } // a single still frame for reduced motion
    }
  };

  const ro = new ResizeObserver(() => { size(); if (!raf) draw(); });
  ro.observe(host);
  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }, { threshold: 0 });
  io.observe(host);
  document.addEventListener('visibilitychange', sync);
  reduceMq.addEventListener?.('change', sync);
  const onLost = (e) => { e.preventDefault(); dispose(); onFail?.(); };
  canvas.addEventListener('webglcontextlost', onLost);

  size();
  sync();
  if (!raf && !ready) draw();

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (raf) cancelAnimationFrame(raf);
    ro.disconnect(); io.disconnect();
    document.removeEventListener('visibilitychange', sync);
    reduceMq.removeEventListener?.('change', sync);
    window.removeEventListener('pointermove', onPointer);
    canvas.removeEventListener('webglcontextlost', onLost);
    [ribbonGeo, ringGeo, dustGeo, ...tubes.map((m) => m.geometry)].forEach((g) => g.dispose());
    [ribbonMat, ringMat, edgeMat, dust.material, contact.material.map, contact.material, halo, scene.environment, ...streaks.map((s) => s.sprite.material)].forEach((m) => m?.dispose?.());
    renderer.dispose();
    renderer.forceContextLoss();
    canvas.remove();
  }
  return dispose;
}
