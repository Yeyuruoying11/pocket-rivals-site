// Pocket Rivals site: interactive 3D pin map (three.js r160, vendored under
// vendor/three@0.160.0/, loaded through the import map in index.html).
//
// app.js imports this module the first time the 硬件与 Pin tab opens and calls
// mount(stage, api). The layout (connector order, module positions, which pin
// goes where) comes from pinmap-model.js, which reads pins.json / status.json;
// this file only turns it into meshes, labels and interactions.
//
// Rendering is on demand: a frame is drawn only while something moves (drag,
// damping, idle rotation, the reset tween) or after a change, and nothing is
// drawn while the tab is hidden or the view is scrolled off-screen.

import * as THREE from "three";
import {OrbitControls} from "three/addons/controls/OrbitControls.js";
import {CSS2DRenderer, CSS2DObject} from "three/addons/renderers/CSS2DRenderer.js";
import {RoomEnvironment} from "three/addons/environments/RoomEnvironment.js";
import * as PM from "./pinmap-model.js";

const {BOARD, TOP, EDGE_Z, STRIP, RING, ONBOARD} = PM;
const SPK = PM.DF_SPEAKER;

/* ---------------- colours from the page's CSS variables ---------------- */

const rootStyle = () => getComputedStyle(document.documentElement);
function cssColor(expr, style = rootStyle()) {
  const m = /var\((--[\w-]+)\)/.exec(expr || "");
  const val = (m ? style.getPropertyValue(m[1]) : expr || "").trim() || "#888888";
  const c = new THREE.Color();
  try { c.setStyle(val); } catch { c.set(0x888888); }
  return c;
}

/* ---------------- textures (theme-independent, made once) ---------------- */

const PX = 40;  // canvas pixels per mm on the board texture
function boardTexture(model) {
  const W = Math.round(BOARD.w * PX), H = Math.round(BOARD.d * PX);
  const cv = document.createElement("canvas");
  cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const X = x => (x + BOARD.w / 2) * PX, Z = z => (z + BOARD.d / 2) * PX;
  // PCB with a soft sheen
  g.save();
  g.beginPath(); g.roundRect(0, 0, W, H, BOARD.r * PX); g.clip();
  const grad = g.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, "#26272d"); grad.addColorStop(1, "#141519");
  g.fillStyle = grad; g.fillRect(0, 0, W, H);
  // faint copper-pour hatch
  g.strokeStyle = "rgba(255,255,255,.025)"; g.lineWidth = 2;
  for (let i = -H; i < W; i += 26) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + H, H); g.stroke(); }
  // silkscreen
  g.fillStyle = "rgba(236,236,236,.92)"; g.strokeStyle = "rgba(236,236,236,.85)";
  g.textAlign = "center"; g.textBaseline = "middle";
  for (const f of model.fingers) {
    if (f.ring) {
      g.font = `bold ${2.5 * PX}px Arial, Helvetica, sans-serif`;
      g.fillText(f.label, X(f.x), Z(RING.z - RING.outer - 2.1));
    } else {
      // the narrow strips are unlabelled on a real board; small vertical numbers here
      g.save();
      g.translate(X(f.x), Z(EDGE_Z - STRIP.len - 1.35));
      g.rotate(-Math.PI / 2);
      g.font = `bold ${0.95 * PX}px Arial, Helvetica, sans-serif`;
      g.fillText(f.pin ? f.pin.slice(1) : f.id === "GND" ? "G" : f.id, 0, 0);
      g.restore();
    }
  }
  g.font = `bold ${2.4 * PX}px Arial, Helvetica, sans-serif`;
  g.fillText("A", X(ONBOARD.btnA.x), Z(ONBOARD.btnA.z + 5.4));
  g.fillText("B", X(ONBOARD.btnB.x), Z(ONBOARD.btnB.z + 5.4));
  // button outlines
  g.lineWidth = 0.18 * PX;
  for (const b of [ONBOARD.btnA, ONBOARD.btnB]) { g.beginPath(); g.roundRect(X(b.x - 3.9), Z(b.z - 3.9), 7.8 * PX, 7.8 * PX, 0.8 * PX); g.stroke(); }
  // touch logo (gold) and the microphone hole with its LED
  g.strokeStyle = "#d8b25a"; g.fillStyle = "#d8b25a"; g.lineWidth = 0.55 * PX;
  g.beginPath(); g.roundRect(X(ONBOARD.logo.x - 4.6), Z(ONBOARD.logo.z - 2.3), 9.2 * PX, 4.6 * PX, 2.3 * PX); g.stroke();
  for (const dx of [-1.9, 1.9]) { g.beginPath(); g.arc(X(ONBOARD.logo.x + dx), Z(ONBOARD.logo.z), 0.75 * PX, 0, 7); g.fill(); }
  g.fillStyle = "#050506"; g.beginPath(); g.arc(X(ONBOARD.mic.x), Z(ONBOARD.mic.z), 0.6 * PX, 0, 7); g.fill();
  g.fillStyle = "#e8e2d0"; g.fillRect(X(ONBOARD.mic.x + 1.6), Z(ONBOARD.mic.z - 0.4), 1.2 * PX, 0.8 * PX);
  // edge-connector keep-out line
  g.strokeStyle = "rgba(236,236,236,.35)"; g.lineWidth = 0.12 * PX; g.setLineDash([0.6 * PX, 0.5 * PX]);
  g.beginPath(); g.moveTo(X(-BOARD.w / 2 + 1), Z(EDGE_Z - 9.6)); g.lineTo(X(BOARD.w / 2 - 1), Z(EDGE_Z - 9.6)); g.stroke();
  g.restore();
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// A tiny Pocket Rivals battle frame for the TFT (160 × 128, landscape)
function screenTexture() {
  const cv = document.createElement("canvas");
  cv.width = 160; cv.height = 128;
  const g = cv.getContext("2d");
  const sky = g.createLinearGradient(0, 0, 0, 80);
  sky.addColorStop(0, "#1a2246"); sky.addColorStop(1, "#3b4f8f");
  g.fillStyle = sky; g.fillRect(0, 0, 160, 80);
  g.fillStyle = "#2f6b3a"; g.fillRect(0, 80, 160, 48);
  g.fillStyle = "#3f8a4a"; for (let x = 0; x < 160; x += 8) g.fillRect(x, 80, 4, 2);
  // platforms
  g.fillStyle = "#24502c"; g.beginPath(); g.ellipse(40, 98, 26, 6, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(118, 62, 22, 5, 0, 0, 7); g.fill();
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  // Ember (fire), bottom-left
  px(30, 78, 20, 16, "#e8663d"); px(34, 72, 12, 6, "#e8663d"); px(38, 66, 4, 6, "#ffb347"); px(26, 84, 4, 6, "#e8663d"); px(50, 84, 4, 6, "#e8663d");
  px(42, 80, 3, 3, "#fff"); px(43, 81, 2, 2, "#111"); px(34, 80, 3, 3, "#fff"); px(35, 81, 2, 2, "#111");
  // Tide (water), top-right
  px(108, 44, 20, 14, "#2f8fd6"); px(112, 38, 12, 6, "#2f8fd6"); px(104, 50, 4, 6, "#2f8fd6"); px(122, 34, 6, 4, "#8fd3ff");
  px(111, 47, 3, 3, "#fff"); px(111, 48, 2, 2, "#111"); px(119, 47, 3, 3, "#fff"); px(119, 48, 2, 2, "#111");
  // HP boxes
  const hp = (x, y, f, c) => { px(x, y, 52, 12, "rgba(10,12,24,.82)"); px(x + 3, y + 3, 46, 6, "#40424f"); px(x + 3, y + 3, 46 * f, 6, c); };
  hp(6, 6, 0.55, "#e3a21a"); hp(102, 92, 0.85, "#4cc27a");
  // command bar
  px(0, 110, 160, 18, "#10131f");
  ["#e8663d", "#2f8fd6", "#4a9e3a", "#d9d9e0"].forEach((c, i) => { px(6 + i * 39, 114, 32, 10, i === 0 ? "#2a2f48" : "#191c2b"); px(10 + i * 39, 117, 6, 4, c); px(19 + i * 39, 118, 14, 2, "#9aa0b8"); });
  px(6, 114, 32, 1, "#fff"); px(6, 123, 32, 1, "#fff");
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  return t;
}

// dashes for planned parts: an alpha map repeated along a tube's length
function dashTexture() {
  const cv = document.createElement("canvas");
  cv.width = 16; cv.height = 2;
  const g = cv.getContext("2d");
  g.fillStyle = "#000"; g.fillRect(0, 0, 16, 2);
  g.fillStyle = "#fff"; g.fillRect(0, 0, 9, 2);
  const t = new THREE.CanvasTexture(cv);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.NearestFilter;
  return t;
}

// soft contact shadow under the board and the modules
function shadowTexture() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 128;
  const g = cv.getContext("2d");
  const r = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  r.addColorStop(0, "rgba(0,0,0,.55)"); r.addColorStop(0.55, "rgba(0,0,0,.22)"); r.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(cv);
}

/* ---------------- the view ---------------- */

export function mount(stage, api) {
  const reduced = false;  // app.js only loads this module when motion is allowed
  const renderer = new THREE.WebGLRenderer({antialias: true, alpha: true, powerPreference: "low-power"});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.className = "p3d-canvas";
  renderer.domElement.setAttribute("aria-hidden", "true");
  stage.appendChild(renderer.domElement);
  stage.setAttribute("role", "group");
  stage.setAttribute("aria-label", api.tr("p3d.aria"));

  const labels = new CSS2DRenderer();
  labels.domElement.className = "p3d-labels";
  stage.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(renderer), 0.04).texture;
  scene.environment = envTex;
  pmrem.dispose();
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8a8a90, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.4);
  sun.position.set(-40, 120, 80);
  scene.add(sun);

  const camera = new THREE.PerspectiveCamera(26, 1, 2, 5000);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.09;
  controls.enablePan = false;
  controls.minPolarAngle = 0.12;          // nearly top-down
  controls.maxPolarAngle = 1.22;          // never below ~20° above the table
  controls.minAzimuthAngle = -1.15;
  controls.maxAzimuthAngle = 1.15;
  controls.rotateSpeed = 0.7;
  controls.zoomSpeed = 0.8;

  const tex = {dash: dashTexture(), shadow: shadowTexture(), screen: screenTexture(), board: null};
  const root = new THREE.Group();
  scene.add(root);

  let model = null;
  let items = [];        // {tags, mats, kind, base}
  let picks = [];        // invisible hit meshes → selection
  let labelObjs = [];    // {obj, el, tags, secondary}
  let themed = [];       // {mat, expr, prop, mul}
  let sel = null;
  let tip = null;

  /* ---- material helpers (each object gets its own, so it can fade alone) ---- */
  function mat(expr, opts = {}) {
    const m = new THREE.MeshStandardMaterial({roughness: 0.55, metalness: 0.05, ...opts});
    if (expr) themed.push({mat: m, expr, prop: "color"});
    return m;
  }
  function fixed(hex, opts = {}) { return new THREE.MeshStandardMaterial({color: hex, roughness: 0.55, metalness: 0.05, ...opts}); }
  function planned(m) { m.transparent = true; m.opacity = 0.42; m.depthWrite = false; return m; }
  function reg(kind, tags, objs, extra = {}) {
    const mats = [];
    for (const o of [].concat(objs)) o.traverse(n => { if (n.material) [].concat(n.material).forEach(x => mats.includes(x) || mats.push(x)); });
    mats.forEach(m => { m.userData.baseOpacity = m.transparent ? m.opacity : 1; m.userData.baseEmissive = m.emissive ? m.emissive.clone() : null; });
    items.push({kind, tags, mats, ...extra});
  }
  function pick(obj, selv) { obj.userData.sel = selv; picks.push(obj); }
  const hitMat = new THREE.MeshBasicMaterial({visible: false});
  function hitBox(w, h, d, pos, selv, parent = root, rotY = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), hitMat);
    m.position.copy(pos); m.rotation.y = rotY;
    parent.add(m); pick(m, selv);
    return m;
  }
  const V = p => new THREE.Vector3(p.x, p.y, p.z);

  function tube(points, radius, material, {dashed = false, closed = false, type = "centripetal", poly = false} = {}) {
    let curve;
    if (poly) {
      curve = new THREE.CurvePath();
      for (let i = 0; i < points.length - 1; i++) curve.add(new THREE.LineCurve3(V(points[i]), V(points[i + 1])));
    } else curve = new THREE.CatmullRomCurve3(points.map(V), closed, type);
    const seg = poly ? points.length * 12 : 72;
    const geo = new THREE.TubeGeometry(curve, seg, radius, 8, closed);
    if (dashed) {
      material.alphaMap = tex.dash.clone();
      material.alphaMap.needsUpdate = true;
      material.alphaMap.repeat.set(Math.max(2, curve.getLength() / 3.2), 1);
      material.transparent = true;
      material.alphaTest = 0.5;
    }
    return new THREE.Mesh(geo, material);
  }

  /* ---------------- build the scene from the model ---------------- */

  function clear() {
    root.traverse(n => {
      if (n.geometry) n.geometry.dispose();
      if (n.material) [].concat(n.material).forEach(m => { if (m !== hitMat) { if (m.alphaMap && m.alphaMap !== tex.dash) m.alphaMap.dispose(); m.dispose(); } });
    });
    for (const l of labelObjs) l.obj.removeFromParent();
    root.clear();
    items = []; picks = []; labelObjs = []; themed = []; tip = null;
  }

  function build() {
    clear();
    model = PM.buildModel(api);
    if (!tex.board) tex.board = boardTexture(model);
    buildTable();
    buildBoard();
    buildFingers();
    buildOnboard();
    buildModules();
    buildWires();
    buildLabels();
    applyTheme();
    highlight();
    if (stage.clientWidth) measureLabels();
  }

  function buildTable() {
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.w * 1.7, BOARD.d * 1.8), new THREE.MeshBasicMaterial({map: tex.shadow, transparent: true, depthWrite: false, opacity: 0.55}));
    sh.rotation.x = -Math.PI / 2; sh.position.set(0, 0.01, 1);
    root.add(sh);
  }

  function roundedShape(w, d, r, cx = 0, cz = 0) {
    // shape in (x, -z) so that after rotateX(-90°) it lies in world x/z
    const s = new THREE.Shape();
    const x0 = cx - w / 2, x1 = cx + w / 2, y0 = -(cz + d / 2), y1 = -(cz - d / 2);
    s.moveTo(x0 + r, y0); s.lineTo(x1 - r, y0); s.quadraticCurveTo(x1, y0, x1, y0 + r);
    s.lineTo(x1, y1 - r); s.quadraticCurveTo(x1, y1, x1 - r, y1); s.lineTo(x0 + r, y1);
    s.quadraticCurveTo(x0, y1, x0, y1 - r); s.lineTo(x0, y0 + r); s.quadraticCurveTo(x0, y0, x0 + r, y0);
    return s;
  }
  function flatExtrude(shape, depth) {
    const g = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled: false, curveSegments: 10});
    g.rotateX(-Math.PI / 2);
    return g;
  }

  function buildBoard() {
    const pcb = new THREE.Mesh(flatExtrude(roundedShape(BOARD.w, BOARD.d, BOARD.r), BOARD.t),
      [fixed(0x1b1c21, {roughness: 0.6}), fixed(0x2a2b31, {roughness: 0.8})]);
    root.add(pcb);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(BOARD.w, BOARD.d),
      new THREE.MeshStandardMaterial({map: tex.board, transparent: true, alphaTest: 0.5, roughness: 0.5, metalness: 0.1}));
    top.rotation.x = -Math.PI / 2; top.position.y = TOP + 0.004;
    root.add(top);
    // clicking the bare board clears the selection
    hitBox(BOARD.w, 0.2, BOARD.d, new THREE.Vector3(0, TOP, 0), null);
  }

  function fingerMaterial(f) {
    if (f.status === "used") return mat(PM.partColor(f.part), {metalness: 0.55, roughness: 0.32, envMapIntensity: 0.9});
    if (f.status === "power") return fixed(0xd9ad45, {metalness: 0.9, roughness: 0.28});
    if (f.status === "busy") return fixed(0x5d5a52, {metalness: 0.6, roughness: 0.4});
    return fixed(0xa9a9ae, {metalness: 0.75, roughness: 0.36});
  }

  function buildFingers() {
    const warnMat = mat("var(--doing)", {emissive: 0x000000});
    for (const f of model.fingers) {
      let mesh;
      if (f.ring) {
        const s = new THREE.Shape();
        const w = RING.w / 2;
        s.moveTo(f.x - w, -EDGE_Z);
        s.lineTo(f.x - w, -RING.z);
        s.absarc(f.x, -RING.z, w, Math.PI, 0, true);
        s.lineTo(f.x + w, -EDGE_Z);
        s.lineTo(f.x - w, -EDGE_Z);
        const hole = new THREE.Path();
        hole.absarc(f.x, -RING.z, RING.hole, 0, Math.PI * 2, false);
        s.holes.push(hole);
        const g = new THREE.ExtrudeGeometry(s, {depth: 0.08, bevelEnabled: false, curveSegments: 24});
        g.rotateX(-Math.PI / 2);
        mesh = new THREE.Mesh(g, fingerMaterial(f));
        mesh.position.y = TOP;
        // plated hole wall
        const wall = new THREE.Mesh(new THREE.CylinderGeometry(RING.hole, RING.hole, BOARD.t + 0.1, 24, 1, true), fixed(0x0a0a0c, {side: THREE.DoubleSide}));
        wall.position.set(f.x, TOP / 2, RING.z);
        root.add(wall);
      } else {
        mesh = new THREE.Mesh(new THREE.BoxGeometry(STRIP.w, 0.08, STRIP.len), fingerMaterial(f));
        mesh.position.set(f.x, TOP + 0.04, EDGE_Z - STRIP.len / 2);
      }
      root.add(mesh);
      const selv = f.pin ? {pin: f.pin} : null;
      reg("finger", {pin: f.pin}, mesh, {finger: f});
      if (f.pin) {
        const hw = f.ring ? RING.w : PM.PITCH;
        hitBox(hw, 2.4, f.ring ? 9 : 7, new THREE.Vector3(f.x, TOP + 0.6, f.ring ? EDGE_Z - 4.4 : EDGE_Z - 3), selv);
      }
      if (f.warn) {
        // a small warning triangle just above the contact (NFC pins)
        const tri = new THREE.Mesh(new THREE.CircleGeometry(0.78, 3), warnMat);
        tri.rotation.x = -Math.PI / 2; tri.rotation.z = Math.PI / 2;
        tri.position.set(f.x, TOP + 0.03, EDGE_Z - STRIP.len - 3.4);
        root.add(tri);
      }
    }
  }

  function ghostRect(w, d, x, z, expr, {dashed = true, circle = 0, opacity = 0.16} = {}) {
    const g = new THREE.Group();
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat(expr, {transparent: true, opacity, depthWrite: false, roughness: 1}));
    fill.rotation.x = -Math.PI / 2;
    g.add(fill);
    const pts = [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2], [-w / 2, -d / 2]].map(([a, b]) => new THREE.Vector3(a, 0.01, b));
    const lm = new THREE.LineDashedMaterial({dashSize: 0.9, gapSize: 0.6, transparent: true, opacity: 0.9});
    themed.push({mat: lm, expr, prop: "color"});
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), dashed ? lm : new THREE.LineBasicMaterial());
    line.computeLineDistances();
    g.add(line);
    if (circle) {
      const cp = [];
      for (let i = 0; i <= 48; i++) { const a = i / 48 * Math.PI * 2; cp.push(new THREE.Vector3(Math.cos(a) * circle, 0.01, Math.sin(a) * circle)); }
      const c = new THREE.Line(new THREE.BufferGeometry().setFromPoints(cp), lm);
      c.computeLineDistances();
      g.add(c);
    }
    g.position.set(x, TOP + 0.03, z);
    root.add(g);
    return g;
  }

  function buildOnboard() {
    for (const o of model.onboard) {
      if (o.type === "button") {
        const g = new THREE.Group();
        const base = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.4, 5.2), fixed(0xb8bcc4, {metalness: 0.8, roughness: 0.3}));
        base.position.y = 0.7;
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 1.1, 28), o.part ? mat(PM.partColor(o.part), {roughness: 0.4}) : fixed(0x18181b, {roughness: 0.5}));
        cap.position.y = 1.95;
        g.add(base, cap);
        g.position.set(o.x, TOP, o.z);
        root.add(g);
        reg("onboard", {pin: o.pin, alias: "@" + o.id}, g);
        hitBox(7, 4, 7, new THREE.Vector3(o.x, TOP + 1.5, o.z), o.pin ? {pin: o.pin} : null);
      } else if (o.type === "matrix") {
        const g = new THREE.Group();
        const lit = matrixPattern(o);
        for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
          const on = o.on && lit[r][c];
          const m = on
            ? new THREE.MeshBasicMaterial({color: 0xff3b2e, toneMapped: false})
            : fixed(o.on ? 0xd8d2c6 : 0x6f6c66, {roughness: 0.45});
          const led = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.55, 1.7), m);
          led.position.set((c - 2) * o.pitch, 0.28, (r - 2) * o.pitch);
          g.add(led);
        }
        g.position.set(o.x, TOP, o.z);
        root.add(g);
        reg("onboard", {part: o.part, alias: "@matrix"}, g);
        hitBox(o.pitch * 5, 1.6, o.pitch * 5, new THREE.Vector3(o.x, TOP + 0.6, o.z), {part: o.part || "@matrix"});
      } else if (o.type === "chip") {
        const g = ghostRect(o.w, o.d, o.x, o.z, o.part ? PM.partColor(o.part) : "var(--muted)", {opacity: 0.2});
        reg("onboard", {part: o.part}, g);
        if (o.part) hitBox(o.w, 1, o.d, new THREE.Vector3(o.x, TOP + 0.3, o.z), {part: o.part});
      } else if (o.type === "speaker") {
        const g = ghostRect(o.w, o.d, o.x, o.z, o.part ? PM.partColor(o.part) : "var(--muted)", {circle: 4.2, opacity: 0.2});
        reg("onboard", {part: o.part}, g);
        if (o.part) hitBox(o.w, 1, o.d, new THREE.Vector3(o.x, TOP + 0.3, o.z), {part: o.part});
      } else if (o.type === "accel") {
        const g = ghostRect(o.w, o.d, o.x, o.z, o.part ? PM.partColor(o.part) : "var(--muted)", {opacity: 0.3});
        reg("onboard", {part: o.part}, g);
        if (o.part) hitBox(5, 1, 5, new THREE.Vector3(o.x, TOP + 0.3, o.z), {part: o.part});
      } else if (o.type === "mic") {
        reg("onboard", {}, ghostRect(3.2, 2.2, o.x, o.z - 2.6, "var(--muted)", {opacity: 0.12}));
      } else if (o.type === "usb") {
        const usb = new THREE.Mesh(new THREE.BoxGeometry(7.6, 2.6, 5.4), fixed(0xb8bcc4, {metalness: 0.85, roughness: 0.28}));
        usb.position.set(o.x, -0.2, o.z + 2.1);  // on the back, so mostly hidden under the board
        root.add(usb);
      } else if (o.type === "antenna") {
        const g = new THREE.Group();
        for (let i = 1; i <= 3; i++) {
          const arc = new THREE.Mesh(new THREE.TorusGeometry(2.4 * i, 0.22, 6, 32, Math.PI / 2), mat(PM.partColor(o.part), {emissive: 0x000000, transparent: true, opacity: 1 - i * 0.22}));
          arc.rotation.x = -Math.PI / 2;
          arc.rotation.z = Math.PI / 2;
          g.add(arc);
        }
        g.position.set(o.x, TOP + 0.4, o.z);
        root.add(g);
        reg("onboard", {part: o.part}, g);
        hitBox(9, 2, 9, new THREE.Vector3(o.x - 3, TOP + 1, o.z - 3), {part: o.part});
      }
    }
    // traces on the board surface
    for (const t of model.traces) {
      const m = t.part || t.status === "used" ? mat(t.color, {roughness: 0.45, emissive: 0x000000}) : fixed(0x8b8a86, {roughness: 0.6});
      if (t.planned) planned(m);
      const mesh = tube(t.pts, 0.24, m, {poly: true, dashed: !!t.planned});
      root.add(mesh);
      reg("trace", {pin: t.pin, part: t.pin ? null : t.part}, mesh);
    }
    // central board: the two player boards it talks to
    for (const gh of model.ghosts) {
      const g = new THREE.Mesh(flatExtrude(roundedShape(gh.w, gh.d, 2), 0.8), mat("var(--muted)", {transparent: true, opacity: 0.28, depthWrite: false}));
      g.position.set(gh.x, 0, gh.z);
      root.add(g);
      const grid = new THREE.Group();
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
        const led = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 0.9), fixed(0xff6a5a, {emissive: 0x551510, transparent: true, opacity: 0.6}));
        led.position.set((c - 2) * 1.8, 0.95, (r - 2) * 1.8);
        grid.add(led);
      }
      grid.position.set(gh.x, 0, gh.z - 1);
      root.add(grid);
    }
  }

  function matrixPattern(o) {
    // player: a smiley (the matrix in use); central: lit columns = packet rate
    if (o.pattern === "bars") {
      const h = [5, 4, 5, 3, 5];
      return [0, 1, 2, 3, 4].map(r => [0, 1, 2, 3, 4].map(c => 4 - r < h[c]));
    }
    return ["01010", "01010", "00000", "10001", "01110"].map(s => [...s].map(x => x === "1"));
  }

  /* ---- modules ---- */

  function moduleGroup(m) {
    const g = new THREE.Group();
    const s = m.size;
    const plannedify = mm => m.planned ? planned(mm) : mm;
    const pcb = (w, d, color, y = 0) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(w, 1.6, d), plannedify(fixed(color, {roughness: 0.6})));
      p.position.y = y + 0.8;
      return p;
    };
    const box = (w, h, d, color, x, y, z, opts) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), plannedify(fixed(color, opts)));
      b.position.set(x, y + h / 2, z);
      return b;
    };
    const header = (n, z, y = 1.6) => {
      const hg = new THREE.Group();
      hg.add(box(n * 2.54 + 0.6, 2.5, 2.6, 0x151517, 0, y, z));
      for (let i = 0; i < n; i++) hg.add(box(0.64, 3.4, 0.64, 0xd9ad45, (i - (n - 1) / 2) * 2.54, y, z, {metalness: 0.9, roughness: 0.3}));
      return hg;
    };
    const accent = (w, d, y) => {
      // a thin coloured rim in the module's colour: links the part to its wires at a glance
      const rim = new THREE.Mesh(new THREE.BoxGeometry(w + 1.4, 0.5, d + 1.4), plannedify(mat(m.color, {roughness: 0.5})));
      rim.position.y = y;
      return rim;
    };
    const npins = Math.max(1, m.pins.length);
    switch (m.type) {
      case "tft": {
        // tilted toward the viewer, resting on its far edge
        const tilt = new THREE.Group();
        tilt.add(accent(s.w, s.d, 0.25), pcb(s.w, s.d, 0x173a7a, 0.5));
        tilt.add(box(29, 0.8, 23, 0x0c0c10, 0, 2.1, 1.2));
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(26.4, 21.1), new THREE.MeshBasicMaterial({map: tex.screen, toneMapped: false}));
        scr.rotation.x = -Math.PI / 2; scr.position.set(0, 2.95, 1.2);
        tilt.add(scr);
        tilt.add(header(Math.max(4, npins), -s.d / 2 + 1.5, 2.1));
        const pivot = new THREE.Group();
        tilt.position.z = -s.d / 2;          // pivot at the far edge
        pivot.add(tilt);
        pivot.position.z = s.d / 2;
        pivot.rotation.x = 0.35;  // keep in step with MODULE_SIZE.tft.hy / hz
        g.add(pivot);
        g.add(box(24, 7.2, 2, 0x2a2b31, 0, 0, -6));   // stand under the raised edge
        break;
      }
      case "joystick": {
        g.add(accent(s.w, s.d, 0.25), pcb(s.w, s.d, 0xb3262d, 0.5));
        g.add(box(15.5, 5.5, 15.5, 0x1d1d22, 0, 2.1, 0));
        const stick = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.2, 6, 18), plannedify(fixed(0x2a2a30)));
        stick.position.y = 10; g.add(stick);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(6.2, 6.6, 3.4, 32), plannedify(fixed(0x3a3b42, {roughness: 0.7})));
        cap.position.y = 13.6; g.add(cap);
        g.add(box(6, 3, 4.2, 0xf1f1ee, 0, 2.1, -s.d / 2 + 2.2));       // Qwiic in
        g.add(box(6, 3, 4.2, 0xf1f1ee, s.w / 2 - 2.2, 2.1, 0));        // Qwiic out
        break;
      }
      case "buttons": {
        g.add(accent(s.w, s.d, 0.25), pcb(s.w, s.d, 0x2f5f4a, 0.5));
        for (const b of m.buttons) {
          g.add(box(6, 2.6, 6, 0x1b1b1f, b.x, 2.1, 0));
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 1.8, 24), mat(m.color, {roughness: 0.35}));
          cap.position.set(b.x, 5.6, 0); g.add(cap);
        }
        break;
      }
      case "fsr": {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(8.6, 8.6, 0.7, 48), plannedify(fixed(0x26262b, {roughness: 0.4})));
        disc.position.set(0, 0.35, 5);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(7.2, 0.35, 8, 48), plannedify(mat(m.color, {roughness: 0.4})));
        ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.75, 5);
        const tail = new THREE.Mesh(new THREE.BoxGeometry(4, 0.5, 14), plannedify(fixed(0xc4c4c8, {metalness: 0.6, roughness: 0.35})));
        tail.position.set(0, 0.25, -9.5);
        g.add(disc, ring, tail);
        g.add(header(2, -14.5, 0));
        break;
      }
      case "dfplayer": {
        g.add(accent(s.w, s.d, 0.25), pcb(s.w, s.d, 0x1e5fb4, 0.5));
        g.add(box(12, 1.8, 12, 0xc9ccd2, 1.5, 2.1, 1.5, {metalness: 0.85, roughness: 0.3}));   // microSD slot
        g.add(box(4.5, 1, 4.5, 0x111114, -5.5, 2.1, 5.5));
        g.add(header(Math.max(2, npins), -s.d / 2 + 1.5, 2.1));
        // its speaker, with a short pair of wires
        const spk = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 3.2, 40), fixed(0x2c2c31, {metalness: 0.4, roughness: 0.5}));
        body.position.y = 1.6;
        const cone = new THREE.Mesh(new THREE.CylinderGeometry(6.4, 4.2, 0.6, 40), mat(m.color, {roughness: 0.8}));
        cone.position.y = 3.3;
        const dust = new THREE.Mesh(new THREE.SphereGeometry(1.8, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), fixed(0x1a1a1d));
        dust.position.y = 3.4;
        spk.add(body, cone, dust);
        spk.position.set(SPK.x, 0, SPK.z);
        g.add(spk);
        g.add(tube([{x: 7, y: 2.4, z: 8}, {x: 9, y: 5, z: 10.5}, {x: SPK.x - 1, y: 3.4, z: SPK.z - 7.4}], 0.35, fixed(0xc0392b)));
        g.add(tube([{x: 8.6, y: 2.4, z: 8}, {x: 10.6, y: 5.2, z: 10.5}, {x: SPK.x + 1, y: 3.4, z: SPK.z - 7.4}], 0.35, fixed(0x1c1c1c)));
        break;
      }
      case "tof": {
        g.add(accent(s.w, s.d, 0.25), pcb(s.w, s.d, 0xb3262d, 0.5));
        g.add(box(4.6, 1.2, 2.8, 0x0b0b0e, 0, 2.1, 0));
        g.add(box(2.4, 0.3, 1.3, 0x5a6b8a, 0, 3.3, 0, {metalness: 0.5, roughness: 0.1}));
        g.add(box(6, 3, 4.2, 0xf1f1ee, 0, 2.1, -s.d / 2 + 2.6));
        g.add(box(6, 3, 4.2, 0xf1f1ee, 0, 2.1, s.d / 2 - 2.6));
        // dashed outline: planned
        const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(s.w + 3, 4, s.d + 3)),
          new THREE.LineDashedMaterial({dashSize: 1.2, gapSize: 0.8}));
        themed.push({mat: edges.material, expr: m.color, prop: "color"});
        edges.computeLineDistances();
        edges.position.y = 2;
        g.add(edges);
        break;
      }
    }
    g.position.set(m.x, 0, m.z);
    g.rotation.y = m.rot;
    return g;
  }

  function buildModules() {
    for (const m of model.modules) {
      const g = moduleGroup(m);
      root.add(g);
      reg("module", {part: m.id}, g);
      // soft shadow
      const sh = new THREE.Mesh(new THREE.PlaneGeometry(m.size.w * 1.6, m.size.d * 1.6), new THREE.MeshBasicMaterial({map: tex.shadow, transparent: true, depthWrite: false, opacity: m.planned ? 0.2 : 0.4}));
      sh.rotation.x = -Math.PI / 2; sh.position.set(m.x, 0.02, m.z);
      root.add(sh);
      const box = new THREE.Box3().setFromObject(g);
      const size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      hitBox(size.x, size.y, size.z, c, {part: m.id});
    }
  }

  function buildWires() {
    for (const w of model.wires) {
      const m = mat(w.color, {roughness: 0.42, metalness: 0.05, emissive: 0x000000});
      if (w.planned) planned(m);
      const mesh = tube(w.pts, 0.42, m, {dashed: w.planned});
      // a little crimp where the wire meets the contact
      const clip = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 0.9, 14), m);
      clip.position.copy(V(w.pts[0])).add(new THREE.Vector3(0, 0.3, 0));
      root.add(mesh, clip);
      reg("wire", {pin: w.pin}, [mesh, clip]);
      const fat = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(w.pts.map(V), false, "centripetal"), 40, 1.4, 5), hitMat);
      root.add(fat); pick(fat, {pin: w.pin});
    }
    for (const l of model.links) {
      const m = mat(l.color, {roughness: 0.42, emissive: 0x000000});
      if (l.planned || l.radio) planned(m);
      if (l.radio) m.opacity = 0.9;   // radio: dashed, but it's real
      const mesh = tube(l.pts, l.radio ? 0.4 : 0.55, m, {dashed: l.planned || l.radio});
      root.add(mesh);
      reg("link", {part: l.part, alias: l.from}, mesh);
      const fat = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(l.pts.map(V)), 30, 1.6, 5), hitMat);
      root.add(fat); pick(fat, {part: l.part});
    }
    for (const ld of model.leaders) {
      const pts = [V(ld.from), new THREE.Vector3(ld.from.x, ld.to.y, ld.from.z), V(ld.to)];
      const lm = new THREE.LineDashedMaterial({dashSize: 1, gapSize: ld.planned ? 0.9 : 0.0001, transparent: true, opacity: 0.85});
      themed.push({mat: lm, expr: ld.color, prop: "color"});
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), lm);
      line.computeLineDistances();
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), mat(ld.color));
      dot.position.copy(V(ld.from));
      root.add(line, dot);
      reg("leader", {part: ld.part, alias: ld.alias}, [line, dot]);
    }
  }

  /* ---- labels (DOM, in the page font) ---- */

  function addLabel(l, el) {
    const obj = new CSS2DObject(el);
    root.add(obj);
    const tags = {pin: l.pin, part: l.pin ? null : l.part, alias: l.alias};
    // the big labels (modules, on-board callouts) are measured, kept inside the view and decluttered
    labelObjs.push({obj, el, tags, l, secondary: !!l.secondary, id: l.id, big: l.cls === "mod", w: 0, h: 0, nudge: ""});
    return obj;
  }

  // phones get the compact placement from the model (l.small), wider views the normal one
  let small = false;
  function placeLabels() {
    for (const lo of labelObjs) {
      const at = small && lo.l.small ? lo.l.small : lo.l;
      lo.obj.position.copy(V(at.pos));
      const c = PM.ALIGN[at.align || "top"];
      lo.obj.center.set(c[0], c[1]);
    }
  }
  // label sizes in px (they are DOM elements); hidden ones measure 0 and are ignored
  function measureLabels() {
    labels.render(scene, camera);
    for (const lo of labelObjs) {
      if (!lo.big) continue;
      // measure even the ones the camera can't see right now
      if (lo.el.parentNode !== labels.domElement) labels.domElement.appendChild(lo.el);
      const disp = lo.el.style.display;
      lo.el.style.display = "";
      lo.el.style.margin = "";
      lo.w = lo.el.offsetWidth; lo.h = lo.el.offsetHeight;
      lo.el.style.display = disp;
      lo.nudge = "";
    }
  }
  // stage-pixel box of a label for a camera (before any declutter nudge)
  const tmpV = new THREE.Vector3();
  function labelBox(lo, cam, W, H) {
    tmpV.copy(lo.obj.position).applyMatrix4(root.matrixWorld).project(cam);
    const x = (tmpV.x + 1) / 2 * W, y = (1 - tmpV.y) / 2 * H;
    return {x: x - lo.obj.center.x * lo.w, y: y - lo.obj.center.y * lo.h, w: lo.w, h: lo.h};
  }
  // nudge overlapping big labels apart (runs after every label render)
  function declutter() {
    const W = stage.clientWidth, H = stage.clientHeight;
    const list = labelObjs.filter(lo => lo.big && lo.w && lo.el.style.display !== "none");
    const nudges = PM.declutter(list.map(lo => labelBox(lo, camera, W, H)), W, H);
    list.forEach((lo, i) => {
      const m = `${Math.round(nudges[i].dy)}px 0 0 ${Math.round(nudges[i].dx)}px`;
      if (m !== lo.nudge) { lo.nudge = m; lo.el.style.margin = m; }
    });
  }

  function buildLabels() {
    const kindText = k => api.tr("p3d.kind." + k);
    for (const l of model.labels) {
      const el = document.createElement("div");
      el.className = `p3d-lab p3d-${l.cls.split(" ").join(" p3d-")}${l.secondary ? " sec" : ""}${l.planned ? " planned" : ""}${l.off ? " off" : ""}`;
      el.style.setProperty("--c", l.color || "var(--muted)");
      el.dataset.id = l.id;
      const selv = l.pin ? {pin: l.pin} : l.part ? {part: l.part} : l.alias ? {part: l.alias} : null;
      if (l.cls === "mod") {
        el.innerHTML = `<span class="k k-${l.kind}">${api.esc(kindText(l.kind))}</span><b>${api.esc(l.title)}</b>` +
          (l.sub ? `<small>${api.esc(l.sub)}</small>` : "");
      } else if (l.cls === "pin") {
        el.innerHTML = `${api.esc(l.title)}${l.warn ? `<i class="w">⚠</i>` : ""}`;
      } else {
        el.textContent = l.title;
      }
      if (selv) {
        el.classList.add("hot");
        el.addEventListener("pointerenter", e => { if (e.pointerType === "mouse") choose(selv); });
        el.addEventListener("click", () => choose(selv, true));
      }
      addLabel(l, el);
    }
    placeLabels();
    // the floating pin tooltip
    const el = document.createElement("div");
    el.className = "p3d-tip";
    tip = new CSS2DObject(el);
    tip.center.set(0.5, 1);
    tip.visible = false;
    root.add(tip);
  }

  /* ---------------- theme ---------------- */

  function applyTheme() {
    const st = rootStyle();
    for (const t of themed) t.mat[t.prop].copy(cssColor(t.expr, st));
    for (const it of items) for (const m of it.mats) if (m.emissive && m.userData.baseEmissive) m.userData.baseEmissive.copy(m.emissive);
    invalidate();
  }

  /* ---------------- highlight ---------------- */

  function highlight() {
    const r = PM.resolveSel(model, sel);
    const st = rootStyle();
    for (const it of items) {
      const lit = PM.isLit(r, it.tags);
      const relevant = r && (it.tags.pin || it.tags.part || it.tags.alias);
      for (const m of it.mats) {
        const base = m.userData.baseOpacity ?? 1;
        let op = base;
        if (r && !lit) {
          op = it.kind === "finger" ? base : it.kind === "onboard" ? base * 0.45 : base * 0.16;
        }
        if (it.kind === "finger" && !m.transparent && op < 1) m.transparent = true;
        if (m.transparent || op < 1) { m.transparent = true; m.opacity = op; }
        if (m.emissive) {
          if (r && lit && relevant) {
            const c = m.color.clone().multiplyScalar(it.kind === "finger" ? 0.9 : 0.45);
            m.emissive.copy(c);
          } else if (m.userData.baseEmissive) m.emissive.copy(m.userData.baseEmissive);
        }
        m.needsUpdate = true;
      }
    }
    for (const l of labelObjs) {
      const lit = PM.isLit(r, l.tags);
      l.el.classList.toggle("dim", !!r && !lit);
      l.el.classList.toggle("lit", !!r && lit && !!(l.tags.pin || l.tags.part || l.tags.alias));
    }
    // tooltip over the selected pin
    if (tip) {
      const f = sel?.pin && model.fingers.find(x => x.pin === sel.pin);
      tip.visible = !!f;
      if (f) {
        tip.position.set(f.x, TOP + 3.2, f.ring ? RING.z - 1 : EDGE_Z - STRIP.len - 0.6);
        tip.element.innerHTML = `<b>${api.esc(f.pin)}</b> ${api.esc(f.use)}${f.warn ? ` <i class="w">⚠</i>` : ""}`;
        tip.element.style.setProperty("--c", f.part ? PM.partColor(f.part) : "var(--muted)");
      }
    }
    stage.dataset.hlPin = sel?.pin || "";
    stage.dataset.hlParts = r ? [...r.parts].join(" ") : "";
    if (small) measureLabels();   // a lit label shows its second line on phones
    invalidate();
  }

  function choose(s, sticky = false) {
    const key = JSON.stringify(s);
    if (key === JSON.stringify(sel) && !sticky) return;
    api.select(s);   // app.js renders the detail box and calls setSel back
  }

  /* ---------------- interaction ---------------- */

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  function pickAt(clientX, clientY) {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(picks, false)[0];
    return hit ? {sel: hit.object.userData.sel} : null;
  }
  let down = null, dragging = false, hoverQueued = null;
  const cv = renderer.domElement;
  cv.addEventListener("pointerdown", e => { down = {x: e.clientX, y: e.clientY}; stopAuto(); });
  cv.addEventListener("pointermove", e => {
    if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) dragging = true;
    if (e.pointerType !== "mouse" || down) return;
    // hover: once per frame
    if (!hoverQueued) requestAnimationFrame(() => {
      const h = hoverQueued; hoverQueued = null;
      const p = pickAt(h.x, h.y);
      cv.style.cursor = p && p.sel ? "pointer" : "grab";
      if (p && p.sel) choose(p.sel);
    });
    hoverQueued = {x: e.clientX, y: e.clientY};
  });
  window.addEventListener("pointerup", e => {
    if (down && !dragging && e.target === cv) {
      const p = pickAt(e.clientX, e.clientY);
      choose(p ? p.sel : null, true);
    }
    down = null; dragging = false;
  });
  cv.addEventListener("pointerleave", () => { cv.style.cursor = ""; });
  cv.addEventListener("wheel", stopAuto, {passive: true});

  /* ---------------- camera, idle rotation, reset ---------------- */

  const DEFAULT = {polar: 0.62, az: 0.0, target: new THREE.Vector3(0, 0, 18), dist: 200};
  let auto = !reduced;
  let autoDir = 1;
  let tween = null;
  // Points that must be in view: the board, every module and the ghost boards.
  // The labels are checked separately, by their measured size in pixels.
  function keyPoints() {
    const pts = [];
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) pts.push(new THREE.Vector3(x * BOARD.w / 2, 0, z * BOARD.d / 2));
    for (const m of model.modules) {
      const r = Math.hypot(m.size.w, m.size.d) / 2;
      pts.push(new THREE.Vector3(m.x - r, 0, m.z), new THREE.Vector3(m.x + r, 0, m.z), new THREE.Vector3(m.x, 0, m.z + r), new THREE.Vector3(m.x, m.h + 8, m.z - r));
    }
    for (const g of model.ghosts) pts.push(new THREE.Vector3(g.x - g.w / 2, 0, g.z), new THREE.Vector3(g.x + g.w / 2, 0, g.z + g.d / 2 + 6));
    return pts;
  }
  // distance (and target) so the key points fill the view with a margin
  function fitView(polar, az) {
    const pts = keyPoints();
    const box = new THREE.Box3().setFromPoints(pts);
    const target = box.getCenter(new THREE.Vector3()).setY(0);
    const test = new THREE.PerspectiveCamera(camera.fov, camera.aspect, 1, 5000);
    const W = stage.clientWidth || 600, H = stage.clientHeight || 400;
    const big = labelObjs.filter(lo => lo.big && lo.w);
    const M = small ? 4 : 12;                    // px margin; the reset button keeps its corner
    let withLabels = !small;                     // phones: fit the drawing, labels are slid inside
    const fits = d => {
      test.position.copy(target).add(new THREE.Vector3().setFromSphericalCoords(d, polar, az));
      test.lookAt(target); test.updateMatrixWorld(); test.updateProjectionMatrix();
      let lo = Infinity, hi = -Infinity;
      for (const p of pts) {
        const q = p.clone().project(test);
        if (Math.abs(q.x) > 0.96) return {ok: false};
        lo = Math.min(lo, q.y); hi = Math.max(hi, q.y);
      }
      for (const l of withLabels ? big : []) {
        const b = labelBox(l, test, W, H);
        if (b.x < M || b.x + b.w > W - M) return {ok: false};
        if (b.x + b.w > W - 104 && b.y < 44) return {ok: false};
        lo = Math.min(lo, 1 - 2 * (b.y + b.h) / H); hi = Math.max(hi, 1 - 2 * b.y / H);
      }
      return {ok: lo > -1 + 2 * M / H && hi < 1 - 2 * M / H, shift: (hi + lo) / 2};
    };
    const search = () => {
      let a = 40, b = 2000;
      for (let i = 0; i < 24; i++) { const m = (a + b) / 2; if (fits(m).ok) b = m; else a = m; }
      return b;
    };
    let b = search();
    // too narrow for the labels at any distance (phones): fit the drawing, and
    // declutter() slides the labels back inside the view
    if (b > 1500) { withLabels = false; b = search(); }
    // nudge the target so the picture is vertically centred
    const r = fits(b);
    if (r.shift) target.z -= r.shift * b * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2) / Math.cos(polar) * 0.9;
    return {target, dist: b * 1.02};
  }
  function fitDistance() {
    const f = fitView(DEFAULT.polar, DEFAULT.az);
    DEFAULT.target.copy(f.target);
    DEFAULT.dist = f.dist;
    return f.dist;
  }
  function placeCamera(polar, az, dist, target) {
    controls.target.copy(target);
    const off = new THREE.Vector3().setFromSphericalCoords(dist, polar, az);
    camera.position.copy(target).add(off);
    camera.lookAt(target);
  }
  function resetView(animate = true) {
    const dist = fitDistance();
    controls.minDistance = dist * 0.38;
    controls.maxDistance = dist * 1.6;
    if (!animate) { placeCamera(DEFAULT.polar, DEFAULT.az, dist, DEFAULT.target); controls.update(); invalidate(); return; }
    const from = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
    tween = {t0: performance.now(), from, fromT: controls.target.clone(), dist};
    auto = !reduced;
    invalidate();
  }
  function stopAuto() { auto = false; tween = null; }
  controls.addEventListener("start", stopAuto);
  controls.addEventListener("change", () => invalidate());

  /* ---------------- render loop (on demand) ---------------- */

  let raf = 0, onScreen = true, pageVisible = !document.hidden;
  function invalidate() { if (!raf && onScreen && pageVisible) raf = requestAnimationFrame(frame); }
  function frame(now) {
    raf = 0;
    if (!stage.offsetParent) return;   // the tab was switched away: stop until shown again
    let more = false;
    if (tween) {
      const k = Math.min(1, (now - tween.t0) / 650), e = 1 - Math.pow(1 - k, 3);
      const tgt = tween.fromT.clone().lerp(DEFAULT.target, e);
      placeCamera(THREE.MathUtils.lerp(tween.from.phi, DEFAULT.polar, e), THREE.MathUtils.lerp(tween.from.theta, DEFAULT.az, e),
        THREE.MathUtils.lerp(tween.from.radius, tween.dist, e), tgt);
      if (k >= 1) tween = null;
      more = true;
    } else if (auto) {
      const az = controls.getAzimuthalAngle();
      if (az > 0.3) autoDir = -1; else if (az < -0.3) autoDir = 1;
      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.35 * autoDir;
      more = true;
    } else controls.autoRotate = false;
    if (controls.update()) more = true;
    renderer.render(scene, camera);
    labels.render(scene, camera);
    declutter();
    frames++;
    if (more) invalidate();
  }
  let frames = 0;

  const io = new IntersectionObserver(es => {
    onScreen = es[es.length - 1].isIntersecting;
    if (onScreen) invalidate();
  });
  io.observe(stage);
  const onVis = () => { pageVisible = !document.hidden; if (pageVisible) invalidate(); };
  document.addEventListener("visibilitychange", onVis);

  let lastW = 0;
  function resize() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    labels.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const nowSmall = w < 640;
    if (nowSmall !== small || !lastW) {
      small = nowSmall;
      DEFAULT.polar = small ? 0.46 : 0.62;   // a tall phone view looks down more steeply
      stage.classList.toggle("p3d-small", small);
      placeLabels();
      measureLabels();
    }
    if (Math.abs(w - lastW) > 40) {
      // keep the zoom limits (and the default view, before anyone touches it) in step with the size
      const keep = auto && !tween;
      const dist = fitDistance();
      controls.minDistance = dist * 0.38;
      controls.maxDistance = dist * 1.6;
      if (keep || !lastW) placeCamera(lastW ? controls.getPolarAngle() : DEFAULT.polar, lastW ? controls.getAzimuthalAngle() : DEFAULT.az, dist, DEFAULT.target);
      lastW = w;
    }
    invalidate();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(stage);

  // theme: system preference or an explicit data-theme on <html>
  const mq = matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", applyTheme);
  const mo = new MutationObserver(applyTheme);
  mo.observe(document.documentElement, {attributes: true, attributeFilter: ["data-theme"]});

  build();
  resize();
  resetView(false);

  /* ---------------- controller for app.js (and the tests) ---------------- */

  return {
    mode: "3d",
    update() {
      const was = model.board;
      build();
      // another board is another picture: glide to its default view
      if (model.board !== was) { resetView(true); return; }
      const dist = fitDistance();
      controls.minDistance = dist * 0.38;
      controls.maxDistance = dist * 1.6;
      if (auto && !tween) placeCamera(controls.getPolarAngle(), controls.getAzimuthalAngle(), dist, DEFAULT.target);
      invalidate();
    },
    setSel(s) { sel = s || null; highlight(); },
    resetView: () => resetView(true),
    info() {
      const r = PM.resolveSel(model, sel);
      return {
        mode: "3d", board: model.board, noMatrix: model.noMatrix, frames,
        camera: {dist: +camera.position.distanceTo(controls.target).toFixed(1), polar: +controls.getPolarAngle().toFixed(3), az: +controls.getAzimuthalAngle().toFixed(3), w: stage.clientWidth, h: stage.clientHeight, aspect: +camera.aspect.toFixed(3)},
        wires: model.wires.map(w => ({pin: w.pin, part: w.part})),
        traces: model.traces.filter(t => t.pin).map(t => ({pin: t.pin, part: t.part, led: !!t.led})),
        links: model.links.map(l => ({from: l.from, part: l.part, pins: l.pins})),
        modules: model.modules.map(m => m.id),
        onboard: model.onboard.map(o => ({id: o.id, part: o.part || null, on: o.on})),
        labels: labelObjs.map(l => l.id),
        lit: r ? {pins: [...r.pins], parts: [...r.parts]} : null,
        missing: PM.check(api.D),
      };
    },
    // client coordinates of a pin's contact (tests hover there)
    screenPos(pin) {
      const f = model.fingers.find(x => x.pin === pin);
      if (!f) return null;
      const p = new THREE.Vector3(f.x, TOP + 0.1, f.ring ? RING.z + 2.6 : EDGE_Z - 1.4).project(camera);
      const r = cv.getBoundingClientRect();
      return {x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height};
    },
    // draw now and count pixels that differ from the clear colour (tests)
    sample() {
      renderer.render(scene, camera);
      const gl = renderer.getContext();
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
      const px = new Uint8Array(w * h * 4);
      gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
      let n = 0;
      for (let i = 3; i < px.length; i += 16) if (px[i] > 0) n++;
      return {w, h, painted: n / (px.length / 16)};
    },
    stopAuto,
    destroy() {
      cancelAnimationFrame(raf);
      io.disconnect(); ro.disconnect(); mo.disconnect();
      mq.removeEventListener("change", applyTheme);
      document.removeEventListener("visibilitychange", onVis);
      clear(); controls.dispose(); renderer.dispose();
      stage.innerHTML = "";
    },
  };
}
