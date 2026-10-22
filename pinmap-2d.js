// Pocket Rivals site: 2D SVG version of the pin map, used when WebGL or the
// three.js files are unavailable, or when the visitor prefers reduced motion.
// Same layout (pinmap-model.js), same labels and the same hover / click
// behaviour as the 3D view, drawn as a slightly tilted top-down picture.
// Colours are CSS variables, so the light / dark theme just works.

import * as PM from "./pinmap-model.js";

const {BOARD, TOP, EDGE_Z, STRIP, RING, ONBOARD} = PM;
const NS = "http://www.w3.org/2000/svg";
const TILT = 0.38;                       // how far raised things shift "up" the page
const P = p => [p.x, p.z - p.y * TILT];  // world → picture
const f1 = n => Math.round(n * 100) / 100;

function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
}

// smooth path through points (Catmull-Rom → cubic Bézier)
function smooth(pts) {
  const q = pts.map(P);
  let d = `M${f1(q[0][0])},${f1(q[0][1])}`;
  for (let i = 0; i < q.length - 1; i++) {
    const p0 = q[Math.max(0, i - 1)], p1 = q[i], p2 = q[i + 1], p3 = q[Math.min(q.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f1(c1[0])},${f1(c1[1])} ${f1(c2[0])},${f1(c2[1])} ${f1(p2[0])},${f1(p2[1])}`;
  }
  return d;
}
const poly = pts => "M" + pts.map(P).map(([x, y]) => `${f1(x)},${f1(y)}`).join(" L");
const rrect = (x, y, w, h, r) => `M${x + r},${y} h${w - 2 * r} q${r},0 ${r},${r} v${h - 2 * r} q0,${r} -${r},${r} h-${w - 2 * r} q-${r},0 -${r},-${r} v-${h - 2 * r} q0,-${r} ${r},-${r}z`;

export function mount(stage, api) {
  stage.classList.add("p3d-2d");
  const svg = el("svg", {class: "p3d-svg", role: "img"}, stage);
  const layer = document.createElement("div");
  layer.className = "p3d-labels";
  stage.appendChild(layer);
  let model = null, sel = null, tagged = [], labelEls = [], small = false;
  let content = null;    // picture-space box of the drawing (labels are added in fit())
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

  function tag(node, tags, selv, kind = "") {
    node.dataset.kind = kind;
    tagged.push({node, tags, kind});
    if (selv !== undefined) {
      node.classList.add("hot");
      node.__sel = selv;
    }
    return node;
  }

  function build() {
    model = PM.buildModel(api);
    svg.replaceChildren();
    tagged = [];
    svg.setAttribute("aria-label", api.tr("p3d.aria"));
    const defs = el("defs", {}, svg);
    const grad = el("linearGradient", {id: "p2d-pcb", x1: 0, y1: 0, x2: 1, y2: 1}, defs);
    el("stop", {offset: 0, "stop-color": "#2a2b31"}, grad);
    el("stop", {offset: 1, "stop-color": "#141519"}, grad);

    const g = {
      shadow: el("g", {}, svg), board: el("g", {}, svg), traces: el("g", {}, svg), mods: el("g", {}, svg),
      wires: el("g", {class: "p2d-wires"}, svg), leaders: el("g", {}, svg),
      hits: el("g", {}, svg),   // pin targets on top, so a wire passing over a contact doesn't steal it
    };
    // background hit area: clicking empty space clears the selection
    tag(el("rect", {x: -500, y: -500, width: 1000, height: 1000, fill: "transparent"}, g.shadow), {}, null, "bg");

    // the board
    el("path", {d: rrect(-BOARD.w / 2, -BOARD.d / 2, BOARD.w, BOARD.d, BOARD.r), fill: "url(#p2d-pcb)", class: "p2d-pcb"}, g.board);
    el("path", {d: rrect(-BOARD.w / 2, -BOARD.d / 2 + BOARD.t * 0, BOARD.w, BOARD.d, BOARD.r), fill: "none", stroke: "rgba(255,255,255,.08)", "stroke-width": 0.3}, g.board);
    // fingers
    for (const f of model.fingers) {
      const cls = `p2d-finger st-${f.status}`;
      const style = f.status === "used" ? `fill:${PM.partColor(f.part)}` : "";
      let node;
      if (f.ring) {
        const w = RING.w / 2, cz = RING.z;
        node = el("path", {d: `M${f1(f.x - w)},${EDGE_Z} V${cz} A${w},${w} 0 0 1 ${f1(f.x + w)},${cz} V${EDGE_Z} Z M${f1(f.x + RING.hole)},${cz} A${RING.hole},${RING.hole} 0 1 0 ${f1(f.x - RING.hole)},${cz} A${RING.hole},${RING.hole} 0 1 0 ${f1(f.x + RING.hole)},${cz} Z`,
          class: cls, style, "fill-rule": "evenodd"}, g.board);
        el("text", {x: f1(f.x), y: f1(cz - RING.outer - 1.3), class: "p2d-silk big"}, g.board).textContent = f.label;
      } else {
        node = el("rect", {x: f1(f.x - STRIP.w / 2), y: f1(EDGE_Z - STRIP.len), width: STRIP.w, height: STRIP.len, class: cls, style}, g.board);
        const t = el("text", {x: 0, y: 0, class: "p2d-silk", transform: `translate(${f1(f.x)},${f1(EDGE_Z - STRIP.len - 1.4)}) rotate(-90)`}, g.board);
        t.textContent = f.pin ? f.pin.slice(1) : f.id === "GND" ? "G" : f.id;
      }
      if (f.pin) {
        tag(node, {pin: f.pin}, {pin: f.pin}, "finger");
        // a wider invisible target for the narrow strips
        const hw = f.ring ? RING.w : PM.PITCH;
        tag(el("rect", {x: f1(f.x - hw / 2), y: f1(EDGE_Z - (f.ring ? 9 : 6)), width: f1(hw), height: f.ring ? 9 : 6.6, fill: "transparent"}, g.hits), {}, {pin: f.pin}, "hit");
      }
      if (f.warn) el("path", {d: `M${f1(f.x)},${f1(EDGE_Z - STRIP.len - 4.2)} l0.75,1.3 h-1.5z`, class: "p2d-warn"}, g.board);
    }
    // on-board parts
    for (const o of model.onboard) {
      if (o.type === "button") {
        const n = el("g", {}, g.board);
        el("rect", {x: o.x - 2.6, y: o.z - 2.6, width: 5.2, height: 5.2, rx: 0.6, class: "p2d-metal"}, n);
        el("circle", {cx: o.x, cy: o.z, r: 1.8, class: "p2d-cap", style: o.part ? `fill:${PM.partColor(o.part)}` : ""}, n);
        el("text", {x: o.x, y: o.z + 5.6, class: "p2d-silk big"}, n).textContent = o.id.slice(-1);
        tag(n, {pin: o.pin, alias: "@" + o.id}, o.pin ? {pin: o.pin} : undefined, "onboard");
      } else if (o.type === "matrix") {
        const n = el("g", {}, g.board);
        const lit = matrixPattern(o);
        for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
          el("rect", {x: f1(o.x + (c - 2) * o.pitch - 0.5), y: f1(o.z + (r - 2) * o.pitch - 0.85), width: 1, height: 1.7, rx: 0.2,
            class: o.on && lit[r][c] ? "p2d-led on" : o.on ? "p2d-led" : "p2d-led off"}, n);
        }
        el("rect", {x: o.x - o.pitch * 2.5, y: o.z - o.pitch * 2.5, width: o.pitch * 5, height: o.pitch * 5, fill: "transparent"}, n);
        tag(n, {part: o.part, alias: "@matrix"}, {part: o.part || "@matrix"}, "onboard");
      } else if (["chip", "speaker", "accel", "mic"].includes(o.type)) {
        const w = o.w || 3.2, d = o.d || 2.2, z = o.type === "mic" ? o.z - 2.6 : o.z;
        const n = el("g", {}, g.board);
        el("rect", {x: f1(o.x - w / 2), y: f1(z - d / 2), width: w, height: d, class: "p2d-ghost", style: `--c:${o.part ? PM.partColor(o.part) : "var(--muted)"}`}, n);
        if (o.type === "speaker") el("circle", {cx: o.x, cy: z, r: 4.2, class: "p2d-ghost", style: `--c:${o.part ? PM.partColor(o.part) : "var(--muted)"}`}, n);
        tag(n, {part: o.part}, o.part ? {part: o.part} : undefined, "onboard");
      } else if (o.type === "logo") {
        el("rect", {x: o.x - 4.6, y: o.z - 2.3, width: 9.2, height: 4.6, rx: 2.3, class: "p2d-logo"}, g.board);
      } else if (o.type === "antenna") {
        const n = el("g", {}, g.board);
        for (let i = 1; i <= 3; i++) el("path", {d: `M${o.x - 2.4 * i},${o.z} A${2.4 * i},${2.4 * i} 0 0 1 ${o.x},${o.z - 2.4 * i}`, class: "p2d-wave", style: `--c:${PM.partColor(o.part)};opacity:${1 - i * 0.22}`}, n);
        tag(n, {part: o.part}, {part: o.part}, "onboard");
      }
    }
    for (const t of model.traces) {
      const n = el("path", {d: poly(t.pts), class: `p2d-trace${t.planned ? " planned" : ""}`, style: `--c:${t.color}`}, g.traces);
      tag(n, {pin: t.pin, part: t.pin ? null : t.part}, t.pin ? {pin: t.pin} : t.part ? {part: t.part} : undefined, "trace");
    }
    for (const gh of model.ghosts) {
      el("path", {d: rrect(gh.x - gh.w / 2, gh.z - gh.d / 2, gh.w, gh.d, 2), class: "p2d-ghostboard"}, g.mods);
    }
    // modules
    for (const m of model.modules) {
      const n = el("g", {transform: `translate(${f1(m.x)},${f1(m.z)}) rotate(${f1(-m.rot * 180 / Math.PI)})`, class: `p2d-mod${m.planned ? " planned" : ""}`, style: `--c:${m.color}`}, g.mods);
      drawModule(n, m);
      tag(n, {part: m.id}, {part: m.id}, "module");
    }
    // wires and links
    for (const w of model.wires) {
      const d = smooth(w.pts);
      const n = el("g", {}, g.wires);
      el("path", {d, class: "p2d-wire-bg"}, n);
      el("path", {d, class: `p2d-wire${w.planned ? " planned" : ""}`, style: `--c:${w.color}`}, n);
      el("path", {d, class: "p2d-wire-hit"}, n);
      const [sx, sy] = P(w.pts[0]);
      el("circle", {cx: f1(sx), cy: f1(sy), r: 0.75, class: "p2d-clip", style: `--c:${w.color}`}, n);
      tag(n, {pin: w.pin}, {pin: w.pin}, "wire");
    }
    for (const l of model.links) {
      const d = smooth(l.pts);
      const n = el("g", {}, g.wires);
      el("path", {d, class: `p2d-wire link${l.planned || l.radio ? " planned" : ""}`, style: `--c:${l.color}`}, n);
      el("path", {d, class: "p2d-wire-hit"}, n);
      tag(n, {part: l.part, alias: l.from}, {part: l.part}, "link");
    }
    for (const ld of model.leaders) {
      const a = P(ld.from), b = P(ld.to);
      const n = el("g", {}, g.leaders);
      el("path", {d: `M${f1(a[0])},${f1(a[1])} L${f1(b[0])},${f1(b[1])}`, class: `p2d-leader${ld.planned ? " planned" : ""}`, style: `--c:${ld.color}`}, n);
      el("circle", {cx: f1(a[0]), cy: f1(a[1]), r: 0.6, style: `fill:${ld.color}`}, n);
      tag(n, {part: ld.part, alias: ld.alias}, undefined, "leader");
    }
    // the drawing's extent in picture space (labels are added when fitting)
    const pts = [];
    const add = p => pts.push(P(p));
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) add({x: x * BOARD.w / 2, y: 0, z: z * BOARD.d / 2});
    for (const m of model.modules) {
      const r = Math.hypot(m.size.w, m.size.d) / 2 + (m.type === "dfplayer" ? 14 : 0);
      for (const [dx, dz] of [[-r, 0], [r, 0], [0, -r], [0, r]]) add({x: m.x + dx, y: 0, z: m.z + dz});
    }
    for (const gh of model.ghosts) { add({x: gh.x - gh.w / 2, y: 0, z: gh.z - gh.d / 2}); add({x: gh.x + gh.w / 2, y: 0, z: gh.z + gh.d / 2 + 6}); }
    for (const w of [...model.wires, ...model.links]) w.pts.forEach(add);
    content = {x0: Math.min(...pts.map(q => q[0])), x1: Math.max(...pts.map(q => q[0])), y0: Math.min(...pts.map(q => q[1])), y1: Math.max(...pts.map(q => q[1]))};
    buildLabels();
    highlight();
  }

  function drawModule(n, m) {
    const s = m.size;
    const body = (w, d, cls = "p2d-body", r = 1.5) => el("path", {d: rrect(-w / 2, -d / 2, w, d, r), class: cls}, n);
    switch (m.type) {
      case "tft":
        body(s.w, s.d);
        el("rect", {x: -13.2, y: -9.3, width: 26.4, height: 21.1, rx: 0.6, class: "p2d-screen"}, n);
        el("rect", {x: -10, y: 2, width: 7, height: 6, class: "p2d-px", style: "fill:var(--fire)"}, n);
        el("rect", {x: 3, y: -6, width: 7, height: 5, class: "p2d-px", style: "fill:var(--water)"}, n);
        el("rect", {x: -12, y: -8.3, width: 12, height: 2, class: "p2d-px", style: "fill:var(--star)"}, n);
        break;
      case "joystick":
        body(s.w, s.d);
        el("rect", {x: -7.75, y: -7.75, width: 15.5, height: 15.5, rx: 1, class: "p2d-dark"}, n);
        el("circle", {r: 6.2, class: "p2d-knob"}, n);
        break;
      case "buttons":
        body(s.w, s.d);
        for (const b of m.buttons) { el("rect", {x: b.x - 3, y: -3, width: 6, height: 6, rx: 0.6, class: "p2d-dark"}, n); el("circle", {cx: b.x, cy: 0, r: 2.2, class: "p2d-cap", style: "fill:var(--c)"}, n); }
        break;
      case "fsr":
        el("rect", {x: -2, y: -16.5, width: 4, height: 14, class: "p2d-metal"}, n);
        el("circle", {cx: 0, cy: 5, r: 8.6, class: "p2d-dark"}, n);
        el("circle", {cx: 0, cy: 5, r: 7.2, class: "p2d-ring"}, n);
        break;
      case "dfplayer":
        body(s.w, s.d);
        el("rect", {x: -4.5, y: -4.5, width: 12, height: 12, class: "p2d-metal"}, n);
        el("circle", {cx: PM.DF_SPEAKER.x, cy: PM.DF_SPEAKER.z, r: 8, class: "p2d-dark"}, n);
        el("circle", {cx: PM.DF_SPEAKER.x, cy: PM.DF_SPEAKER.z, r: 6.2, class: "p2d-ring"}, n);
        el("path", {d: `M7.5,8 Q9.5,10.5 ${PM.DF_SPEAKER.x},${PM.DF_SPEAKER.z - 7.5}`, class: "p2d-cable"}, n);
        break;
      case "tof":
        body(s.w, s.d);
        el("rect", {x: -2.3, y: -1.4, width: 4.6, height: 2.8, class: "p2d-dark"}, n);
        break;
    }
  }

  function matrixPattern(o) {
    if (o.pattern === "bars") {
      const h = [5, 4, 5, 3, 5];
      return [0, 1, 2, 3, 4].map(r => [0, 1, 2, 3, 4].map(c => 4 - r < h[c]));
    }
    return ["01010", "01010", "00000", "10001", "01110"].map(s => [...s].map(x => x === "1"));
  }

  /* ---- labels: HTML over the SVG, in the page font ---- */
  let tip = null;
  function buildLabels() {
    layer.replaceChildren();
    labelEls = [];
    const kindText = k => api.tr("p3d.kind." + k);
    for (const l of model.labels) {
      const e = document.createElement("div");
      e.className = `p3d-lab p3d-${l.cls.split(" ").join(" p3d-")}${l.secondary ? " sec" : ""}${l.planned ? " planned" : ""}${l.off ? " off" : ""}`;
      e.style.setProperty("--c", l.color || "var(--muted)");
      e.dataset.id = l.id;
      if (l.cls === "mod") e.innerHTML = `<span class="k k-${l.kind}">${api.esc(kindText(l.kind))}</span><b>${api.esc(l.title)}</b>` + (l.sub ? `<small>${api.esc(l.sub)}</small>` : "");
      else if (l.cls === "pin") e.innerHTML = `${api.esc(l.title)}${l.warn ? `<i class="w">⚠</i>` : ""}`;
      else e.textContent = l.title;
      const selv = l.pin ? {pin: l.pin} : l.part ? {part: l.part} : l.alias ? {part: l.alias} : null;
      if (selv) {
        e.classList.add("hot");
        e.addEventListener("pointerenter", ev => { if (ev.pointerType === "mouse") choose(selv); });
        e.addEventListener("click", () => choose(selv, true));
      }
      layer.appendChild(e);
      labelEls.push({el: e, l, tags: {pin: l.pin, part: l.pin ? null : l.part, alias: l.alias}});
    }
    tip = document.createElement("div");
    tip.className = "p3d-tip";
    tip.hidden = true;
    layer.appendChild(tip);
  }

  function toScreen(p) {
    const ctm = svg.getScreenCTM();
    const sr = stage.getBoundingClientRect();
    if (!ctm) return [0, 0];
    const [x, y] = P(p);
    const pt = svg.createSVGPoint();
    pt.x = x; pt.y = y;
    const q = pt.matrixTransform(ctm);
    return [q.x - sr.left, q.y - sr.top];
  }
  const at = l => small && l.small ? l.small : l;
  // stage-pixel boxes of the labels; the big ones are nudged apart (PM.declutter)
  function placeLabels() {
    const boxes = [];
    for (const it of labelEls) {
      const a = at(it.l);
      const [x, y] = toScreen(a.pos);
      const [ax, ay] = PM.ALIGN[a.align || "top"];
      it.w = it.el.offsetWidth; it.h = it.el.offsetHeight;
      it.box = {x: x - ax * it.w, y: y - ay * it.h, w: it.w, h: it.h};
      if (it.l.cls === "mod" && it.w) boxes.push(it);
    }
    const nudges = PM.declutter(boxes.map(it => it.box), stage.clientWidth, stage.clientHeight);
    boxes.forEach((it, i) => { it.box.x += nudges[i].dx; it.box.y += nudges[i].dy; });
    for (const it of labelEls) if (it.box) it.el.style.transform = `translate(${f1(it.box.x)}px, ${f1(it.box.y)}px)`;
    placeTip();
  }

  // viewBox and stage height so the drawing and every big label fit the width
  function fit() {
    const sw = stage.clientWidth;
    if (!sw || !content) return;
    let U = {...content}, sh = 300;
    // wide views make room for every label; on phones the labels are slid inside instead
    const big = small ? [] : labelEls.filter(it => it.el.offsetWidth);
    for (let k = 0; k < 5; k++) {
      const pad = 3;
      const w = U.x1 - U.x0 + 2 * pad, h = U.y1 - U.y0 + 2 * pad;
      sh = Math.round(Math.max(small ? 300 : 320, Math.min(small ? 460 : 560, sw * h / w)));
      const s = Math.min(sw / w, sh / h);       // px per unit
      U = {...content};
      for (const it of big) {
        const a = at(it.l);
        const [x, y] = P(a.pos);
        const [ax, ay] = PM.ALIGN[a.align || "top"];
        const bw = (it.el.offsetWidth + 8) / s, bh = (it.el.offsetHeight + 6) / s;
        U.x0 = Math.min(U.x0, x - ax * bw); U.x1 = Math.max(U.x1, x + (1 - ax) * bw);
        U.y0 = Math.min(U.y0, y - ay * bh); U.y1 = Math.max(U.y1, y + (1 - ay) * bh);
      }
    }
    const pad = 3;
    svg.setAttribute("viewBox", `${f1(U.x0 - pad)} ${f1(U.y0 - pad)} ${f1(U.x1 - U.x0 + 2 * pad)} ${f1(U.y1 - U.y0 + 2 * pad)}`);
    stage.style.height = sh + "px";
  }
  function placeTip() {
    const f = sel?.pin && model.fingers.find(x => x.pin === sel.pin);
    tip.hidden = !f;
    if (!f) return;
    tip.innerHTML = `<b>${api.esc(f.pin)}</b> ${api.esc(f.use)}${f.warn ? ` <i class="w">⚠</i>` : ""}`;
    tip.style.setProperty("--c", f.part ? PM.partColor(f.part) : "var(--muted)");
    const [x, y] = toScreen({x: f.x, y: TOP + 3.2, z: f.ring ? RING.z - 3 : EDGE_Z - STRIP.len - 2});
    tip.style.transform = `translate(${f1(x)}px, ${f1(y)}px) translate(-50%, -100%)`;
  }

  /* ---- highlight / interaction ---- */
  function highlight() {
    const r = PM.resolveSel(model, sel);
    for (const t of tagged) {
      if (t.kind === "bg" || t.kind === "hit") continue;
      const lit = PM.isLit(r, t.tags);
      const relevant = !!(t.tags.pin || t.tags.part || t.tags.alias);
      t.node.classList.toggle("dim", !!r && !lit && t.kind !== "finger");
      t.node.classList.toggle("lit", !!r && lit && relevant);
    }
    for (const l of labelEls) {
      const lit = PM.isLit(r, l.tags);
      l.el.classList.toggle("dim", !!r && !lit);
      l.el.classList.toggle("lit", !!r && lit && !!(l.tags.pin || l.tags.part || l.tags.alias));
    }
    if (tip) placeTip();
    stage.dataset.hlPin = sel?.pin || "";
    stage.dataset.hlParts = r ? [...r.parts].join(" ") : "";
  }
  function choose(s, sticky = false) {
    if (!sticky && JSON.stringify(s) === JSON.stringify(sel)) return;
    api.select(s);
  }
  const target = e => { let n = e.target; while (n && n !== svg && !("__sel" in n)) n = n.parentNode; return n && n !== svg ? n : null; };
  svg.addEventListener("pointerover", e => { if (e.pointerType !== "mouse") return; const n = target(e); if (n && n.__sel) choose(n.__sel); });
  svg.addEventListener("click", e => { const n = target(e); choose(n ? n.__sel : null, true); });

  function resize() {
    small = stage.clientWidth < 640;
    stage.classList.toggle("p3d-small", small);
    fit();
    placeLabels();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(stage);

  build();
  resize();

  return {
    mode: "2d",
    update() { build(); resize(); },
    setSel(s) { sel = s || null; highlight(); placeLabels(); },
    resetView() {},
    info() {
      const r = PM.resolveSel(model, sel);
      return {
        mode: "2d", board: model.board, noMatrix: model.noMatrix,
        wires: model.wires.map(w => ({pin: w.pin, part: w.part})),
        traces: model.traces.filter(t => t.pin).map(t => ({pin: t.pin, part: t.part, led: !!t.led})),
        links: model.links.map(l => ({from: l.from, part: l.part, pins: l.pins})),
        modules: model.modules.map(m => m.id),
        onboard: model.onboard.map(o => ({id: o.id, part: o.part || null, on: o.on})),
        labels: labelEls.map(l => l.l.id),
        lit: r ? {pins: [...r.pins], parts: [...r.parts]} : null,
        missing: PM.check(api.D),
      };
    },
    screenPos(pin) {
      const f = model.fingers.find(x => x.pin === pin);
      if (!f) return null;
      const [x, y] = toScreen({x: f.x, y: 0, z: f.ring ? RING.z + 2.6 : EDGE_Z - 1.4});
      const sr = stage.getBoundingClientRect();
      return {x: sr.left + x, y: sr.top + y};
    },
    destroy() { ro.disconnect(); stage.innerHTML = ""; },
  };
}
