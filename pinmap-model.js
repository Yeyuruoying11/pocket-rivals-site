// Pocket Rivals site: layout of the pin map diagram (shared by the 3D view in
// pinmap-3d.js and the 2D SVG fallback in pinmap-2d.js; no three.js here).
//
// Everything about WHICH pin does WHAT comes from pins.json and status.json
// through the api object app.js passes in (pinInfo, components, strings), so
// the diagram follows the data. The only things written down here are the
// physical facts: the edge connector order and size, where the parts sit on
// the micro:bit, and where each external module is placed on the "table".
//
// Units are millimetres. The board lies flat on the table (y up), LED side up,
// with the edge connector toward the viewer: x to the right, z toward the
// viewer, board centre at x = z = 0, the connector edge at z = +21.

/* ---------------- the micro:bit V2 edge connector ----------------
 * Front view (LED side up, connector at the bottom), left to right. Source:
 * the official micro:bit V2 pinout (tech.microbit.org/hardware/edgeconnector/
 * and microbit.org/get-started/user-guide/features-in-depth/#pins): 25
 * contacts = 20 narrow strips + 5 wide ring pads (0, 1, 2, 3V, GND). The
 * connector is 40 positions of 1.27 mm; each ring pad takes 4 positions.
 *   P3 | 0 | P4 P5 P6 P7 | 1 | P8 P9 P10 P11 P12 | 2 | P13 P14 P15 P16 3V(P17) | 3V | 3V(P18) P19 P20 GND | GND | GND
 * The same contacts are repeated on the back of the board. Every pin in
 * pins.json must appear here (pinmap-model checks it in check()).
 */
export const EDGE = ["P3", "R:P0", "P4", "P5", "P6", "P7", "R:P1", "P8", "P9", "P10", "P11", "P12", "R:P2",
  "P13", "P14", "P15", "P16", "3V", "R:3V", "3V", "P19", "P20", "GND", "R:GND", "GND"];

export const PITCH = 1.27;
export const BOARD = {w: 51.6, d: 42, t: 1.6, r: 4};
export const TOP = BOARD.t;                  // y of the board's top surface
export const EDGE_Z = BOARD.d / 2;           // the connector edge
export const STRIP = {w: 0.86, len: 4.4};    // narrow strip
export const RING = {w: 4.9, outer: 2.45, hole: 1.9, z: EDGE_Z - 6.4};   // ring pad: ~4 mm hole (takes 4 mm banana plugs); hole centre z

// Parts on the board itself (front-view positions; back-side parts are drawn
// "seen through" the board, dashed). Positions are approximate.
export const ONBOARD = {
  matrix: {x: 0, z: -3, pitch: 4.2},                 // 5×5 LEDs, front
  btnA:   {x: -19.6, z: -3, size: 6},                // front
  btnB:   {x: 19.6, z: -3, size: 6},
  logo:   {x: 0, z: -16.2},                          // touch logo, front
  mic:    {x: 7.4, z: -16.2, back: true},            // MEMS microphone (back; hole + LED on the front)
  speaker:{x: 0, z: -8.5, w: 11, d: 11, back: true}, // V2 speaker, back
  chip:   {x: 11.5, z: 8.4, w: 7, d: 7, back: true}, // nRF52833
  accel:  {x: 18.6, z: 8.6, w: 2.4, d: 2.4, back: true}, // LSM303AGR
  usb:    {x: -6, z: -EDGE_Z, back: true},           // micro-USB on the top edge
  antenna:{x: -19, z: -17},                          // 2.4 GHz PCB antenna corner
};

// Which status.json component is drawn as which on-board part
const ONBOARD_PART = {beep: "speaker", accel: "accel", matrix: "matrix", radio: "antenna", logic: "chip"};

// External modules on the table, by status.json component id: shape type and
// position. Rotation is computed so each module faces the connector.
const MODULES = {
  audio: {type: "dfplayer", x: -54, z: 24, h: 4},
  fsr:   {type: "fsr",      x: -34, z: 57, h: 3},
  btn:   {type: "buttons",  x: -6,  z: 58, h: 4},
  tft:   {type: "tft",      x: 26,  z: 55, h: 5},
  joy:   {type: "joystick", x: 54,  z: 27, h: 5},
  gest:  {type: "gesture",  x: 58,  z: -4, h: 4},
};
// Size on the table (footprint w × d, top height) and the header (local z)
export const MODULE_SIZE = {
  dfplayer: {w: 20, d: 20, top: 3.2, hy: 3.6, hz: -8.6},
  fsr:      {w: 18, d: 30, top: 0.8, hy: 1.4, hz: -14.6},
  buttons:  {w: 34, d: 14, top: 5.5},
  tft:      {w: 34, d: 27, top: 6.5, hy: 11.9, hz: -9.4},   // tilted toward the viewer (pinmap-3d.js)
  joystick: {w: 25.4, d: 25.4, top: 14, hy: 3.6, hz: -12.6},
  gesture:  {w: 15, d: 22, top: 2.2},
};

// label alignment → which point of the label sits on its anchor (x, y fractions)
export const ALIGN = {top: [0.5, 1], below: [0.5, 0], left: [1, 0.5], right: [0, 0.5], center: [0.5, 0.5]};

// the DFPlayer's speaker, in the DFPlayer module's local coordinates
export const DF_SPEAKER = {x: 12, z: 19};

// Small screens: where a module's label goes instead (default: under the module)
const SMALL_LABEL = {
  dfplayer: m => ({pos: toWorld(m, DF_SPEAKER.x * 0.5, 1, DF_SPEAKER.z + 9), align: "below"}),   // under its speaker
  fsr: m => ({pos: toWorld(m, 0, 1, 14.5), align: "below"}),
  gesture: m => ({pos: toWorld(m, 0, 1, -m.size.d / 2 - 2), align: "top"}),                          // the joystick is below it
};

export const PART_IDS = ["tft", "audio", "joy", "btn", "fsr", "gest", "beep", "accel", "matrix", "radio", "logic"];
export const partColor = id => `var(--c-${id})`;

/* ---------------- helpers ---------------- */

export const lerp = (a, b, t) => a + (b - a) * t;
const v = (x, y, z) => ({x, y, z});

// local (module) coordinates → world, rotation rot about y
export function toWorld(m, lx, ly, lz) {
  const c = Math.cos(m.rot), s = Math.sin(m.rot);
  return v(m.x + lx * c + lz * s, ly, m.z - lx * s + lz * c);
}

/* ---------------- build ---------------- */

// api: {D, state, pinInfo, tr, L}
export function buildModel(api) {
  const {D, state, pinInfo, tr, L} = api;
  const boardKind = state.board;
  const comps = D.status.components[boardKind] || [];
  const compById = Object.fromEntries(comps.map(c => [c.id, c]));
  const pinById = new Map(D.pins.pins.map(p => [p.pin, p]));

  // ---- fingers (the connector), with what each pin does right now
  const fingers = [];
  let u = 0;
  for (const e of EDGE) {
    const ring = e.startsWith("R:");
    const id = ring ? e.slice(2) : e;
    const width = ring ? 4 : 1;
    const x = -25.4 + (u + width / 2) * PITCH;
    u += width;
    const p = pinById.get(id) || null;
    const info = p ? pinInfo(p) : null;
    const warn = p ? L(p, "warn") : "";
    fingers.push({
      id, ring, x, p,
      label: ring ? (id.startsWith("P") ? id.slice(1) : id) : id,
      pin: p ? id : null,
      power: p ? null : id,           // "3V" / "GND"
      status: p ? info.kind : "power", // used / busy / free / power
      part: info?.part || null,
      use: info?.use || "",
      warn: warn && info?.kind !== "busy" ? warn : "",
      builtin: p?.builtin || "",
      // where a wire or trace starts on this contact
      at: ring ? v(x, TOP + 0.1, RING.z) : v(x, TOP + 0.1, EDGE_Z - 1.6),
    });
  }
  const fingerOf = id => fingers.find(f => f.pin === id);

  const model = {
    board: boardKind, noMatrix: state.noMatrix,
    fingers, modules: [], wires: [], traces: [], links: [], labels: [], onboard: [], leaders: [],
    ghosts: [],
  };

  // Which pins does an on-board button / matrix column use?
  const btnPins = {A: null, B: null};
  const ledPins = [];
  for (const f of fingers) {
    if (!f.p) continue;
    const b = f.builtin;
    if (b.startsWith("按钮")) btnPins[b.endsWith("A") ? "A" : "B"] = f;
    if (b.startsWith("LED")) ledPins.push({f, col: +b.replace(/\D+/g, "")});
  }

  // ---- external modules (components that have a layout entry and are on this board)
  const i2cOwner = fingers.find(f => f.p && f.p.caps.some(c => c.startsWith("I2C")) && f.status === "used")?.part || null;
  for (const c of comps) {
    const lay = MODULES[c.id];
    if (!lay) continue;
    const own = fingers.filter(f => f.part === c.id && f.status === "used" && !f.builtin.startsWith("按钮"));
    // an I2C part with no pins of its own hangs off the Qwiic chain of the part that owns P19/P20
    const chain = !own.length && /I2C/.test(c.iface) && i2cOwner && i2cOwner !== c.id ? i2cOwner : null;
    if (!own.length && !chain && c.planned !== true) continue;
    const m = {id: c.id, comp: c, type: lay.type, x: lay.x, z: lay.z, h: lay.h, kind: c.kind || "other",
      planned: !!c.planned, name: L(c, "name"), iface: c.iface, color: partColor(c.id), chain, rot: 0,
      size: MODULE_SIZE[lay.type], pins: own.map(f => f.pin), buttons: []};
    // face the connector (the middle of its own pins, else the board)
    const cx = own.length ? own.reduce((s, f) => s + f.x, 0) / own.length : 0;
    const cz = own.length ? EDGE_Z : 0;
    m.rot = Math.atan2(m.x - cx, m.z - cz) * 0.6;
    model.modules.push(m);
  }
  const modById = Object.fromEntries(model.modules.map(m => [m.id, m]));

  // ---- wires: connector → module header, sorted along the header so they don't cross
  for (const m of model.modules) {
    const own = m.pins.map(fingerOf);
    if (!own.length) continue;
    const c = Math.cos(m.rot), s = Math.sin(m.rot);
    own.sort((a, b) => ((a.x - m.x) * c - (EDGE_Z - m.z) * s) - ((b.x - m.x) * c - (EDGE_Z - m.z) * s));
    const n = own.length;
    own.forEach((f, i) => {
      let end, approach;
      if (m.type === "buttons") {
        // one wire per button cap; the buttons are spread across the strip
        const bx = (i - (n - 1) / 2) * 7.6;
        m.buttons.push({x: bx, pin: f.pin});
        end = toWorld(m, bx, 2.2, -4.6);
        approach = toWorld(m, bx, 2.2 + m.h * 0.5, -10);
      } else {
        const hx = (i - (n - 1) / 2) * 2.54;
        const hy = m.size.hy;
        end = toWorld(m, hx, hy, m.size.hz);
        approach = toWorld(m, hx * 3.2, hy + m.h * 0.45, m.size.hz - 9);
      }
      const st = f.at;
      const lift = m.h;
      const out = f.ring ? v(st.x, st.y + lift * 0.75, st.z + 4) : v(st.x, st.y + lift * 0.55, st.z + 4.5);
      const mid = v(lerp(out.x, approach.x, 0.5), Math.max(out.y, approach.y) + lift * 0.35, lerp(out.z, approach.z, 0.5));
      model.wires.push({pin: f.pin, part: m.id, color: m.color, planned: m.planned,
        pts: [st, out, mid, approach, end], end, label: f.pin});
    });
  }

  // Qwiic chain (e.g. joystick → gesture sensor)
  for (const m of model.modules) {
    if (!m.chain || !modById[m.chain]) continue;
    const a = modById[m.chain];
    const dx = m.x - a.x, dz = m.z - a.z, len = Math.hypot(dx, dz);
    const ux = dx / len, uz = dz / len;
    const p0 = v(a.x + ux * 11, 2.4, a.z + uz * 11);
    const p3 = v(m.x - ux * 9, 2.0, m.z - uz * 9);
    const p1 = v(lerp(p0.x, p3.x, 0.33), 8, lerp(p0.z, p3.z, 0.33) + 2);
    const p2 = v(lerp(p0.x, p3.x, 0.66), 8, lerp(p0.z, p3.z, 0.66) + 2);
    const pins = fingers.filter(f => f.part === m.chain && f.p.caps.some(c => c.startsWith("I2C"))).map(f => f.pin);
    model.links.push({from: m.chain, part: m.id, pins, color: m.color, planned: m.planned, pts: [p0, p1, p2, p3]});
    m.pins = pins;     // it talks over those pins
    m.viaChain = true;
  }

  // ---- on-board parts and the traces to them
  const tr2 = (pts, extra) => ({pts: pts.map(([x, z]) => v(x, TOP + 0.06, z)), ...extra});
  const B = ONBOARD;
  // buttons A / B
  for (const k of ["A", "B"]) {
    const f = btnPins[k];
    const ob = k === "A" ? B.btnA : B.btnB;
    const item = {id: "btn" + k, type: "button", x: ob.x, z: ob.z, pin: f?.pin || null, part: f?.status === "used" ? f.part : null, status: f?.status || "busy"};
    model.onboard.push(item);
    if (!f) continue;
    const color = item.part ? partColor(item.part) : "var(--muted)";
    const pts = k === "A"
      ? [[f.x, f.at.z], [f.x, 13], [ob.x, 7], [ob.x, ob.z + 3.4]]
      : [[f.x, f.at.z], [f.x, 11.6], [ob.x - 4, 11.6], [ob.x, 7.5], [ob.x, ob.z + 3.4]];
    model.traces.push(tr2(pts, {pin: f.pin, part: item.part, color, status: f.status}));
  }
  // LED matrix: on the central board it's a component; on a player board it's built in
  const matrixComp = compById.matrix;
  const matrixOn = !state.noMatrix;
  const matrixPart = matrixComp ? "matrix" : null;
  const ledPinIds = ledPins.map(l => l.f.pin);
  model.onboard.push({id: "matrix", type: "matrix", x: B.matrix.x, z: B.matrix.z, pitch: B.matrix.pitch, part: matrixPart,
    on: matrixOn, pins: ledPinIds, pattern: boardKind === "central" ? "bars" : "face"});
  for (const {f, col} of ledPins) {
    if (f.status !== "busy") continue;
    const cx = B.matrix.x + (col - 3) * B.matrix.pitch;
    const bottom = B.matrix.z + 2 * B.matrix.pitch + 1;
    const color = matrixPart ? partColor(matrixPart) : "var(--muted)";
    model.traces.push(tr2([[f.x, f.at.z], [f.x, 14.4], [cx, 10.4], [cx, bottom]], {pin: f.pin, part: matrixPart, color, status: "busy", led: true}));
  }
  // chip, speaker, accelerometer, microphone, logo, USB, antenna
  model.onboard.push({id: "chip", type: "chip", ...B.chip, part: compById.logic ? "logic" : null});
  model.onboard.push({id: "speaker", type: "speaker", ...B.speaker, part: compById.beep ? "beep" : null});
  model.onboard.push({id: "accel", type: "accel", ...B.accel, part: compById.accel ? "accel" : null, planned: !!compById.accel?.planned});
  model.onboard.push({id: "mic", type: "mic", ...B.mic});
  model.onboard.push({id: "logo", type: "logo", ...B.logo});
  model.onboard.push({id: "usb", type: "usb", ...B.usb});
  if (compById.radio) model.onboard.push({id: "antenna", type: "antenna", ...B.antenna, part: "radio"});
  if (compById.beep) model.traces.push(tr2([[B.chip.x - 3.5, B.chip.z - 2], [5.5, 1.5], [3, -3.0]], {part: "beep", color: partColor("beep"), status: "used", label: "P0.00"}));
  if (compById.accel) model.traces.push(tr2([[B.chip.x + 3.5, B.chip.z], [B.accel.x - 1.2, B.accel.z]], {part: "accel", color: partColor("accel"), status: "used", planned: !!compById.accel.planned}));
  if (compById.radio) model.traces.push(tr2([[B.chip.x - 3.5, B.chip.z - 3], [-4, 2], [-14, -10], [B.antenna.x + 2, B.antenna.z + 2]], {part: "radio", color: partColor("radio"), status: "used"}));

  // ---- labels
  const kindBadge = k => k === "sensor" || k === "actuator" || k === "comms" ? k : "other";
  for (const m of model.modules) {
    const ox = m.x, oz = m.z - 14, n = Math.hypot(ox, oz);
    const side = Math.abs(ox) > Math.abs(oz) * 1.2;
    const align = side ? (ox < 0 ? "left" : "right") : "below";
    const reach = side ? m.size.w / 2 + 3 : m.size.d / 2 + (m.type === "fsr" ? 5 : 3);
    const pos = side ? v(m.x + Math.sign(ox) * reach, 1, m.z) : v(m.x + ox / n * 4, 1, m.z + reach);
    // phones: every module label sits centred under (or, far back, over) its module, so
    // no label has to reach out sideways past the edge of a narrow view
    const small = SMALL_LABEL[m.type] ? SMALL_LABEL[m.type](m) : {pos: toWorld(m, 0, 1, m.size.d / 2 + 2), align: "below"};
    model.labels.push({id: "mod-" + m.id, cls: "mod", part: m.id, kind: kindBadge(m.kind), planned: m.planned, align,
      title: m.name, sub: m.chain ? tr("p3d.chain", {pins: m.pins.join(" ")}) : m.iface + (m.pins.length ? " · " + m.pins.join(" ") : ""),
      pos, color: m.color, small});
  }
  for (const w of model.wires) {
    // pin numbers where the wires reach the modules (secondary labels)
    const m = modById[w.part];
    const p = w.pts[3];
    model.labels.push({id: "wire-" + w.pin, cls: "pin", pin: w.pin, part: w.part, title: w.pin, align: "center",
      pos: v(p.x, p.y + 0.8, p.z), color: w.color, warn: !!fingerOf(w.pin).warn,
      secondary: true, mod: m.id});
  }
  // bus names: SPI to the screen, I2C on the Qwiic chain
  for (const m of model.modules) {
    const ws = model.wires.filter(w => w.part === m.id);
    if (!ws.length || !/SPI|I2C|UART/.test(m.iface)) continue;
    const mids = ws.map(w => ({x: lerp(w.pts[1].x, w.pts[2].x, 0.55), y: lerp(w.pts[1].y, w.pts[2].y, 0.55), z: lerp(w.pts[1].z, w.pts[2].z, 0.55)}));
    const mx = mids.reduce((s, p) => s + p.x, 0) / mids.length;
    const my = Math.max(...mids.map(p => p.y));
    const mz = mids.reduce((s, p) => s + p.z, 0) / mids.length;
    const title = /I2C/.test(m.iface) ? "I2C · Qwiic" : m.iface;
    // passive: it sits just off the connector, so it must not catch the pointer meant for a contact
    model.labels.push({id: "bus-" + m.id, cls: "bus", part: m.id, title, align: "center", pos: v(mx, my + 2.5, mz), color: m.color, secondary: true, passive: true});
  }
  for (const l of model.links) {
    const p = l.pts[1];
    model.labels.push({id: "link-" + l.part, cls: "bus", part: l.part, title: "Qwiic", align: "center", pos: v(lerp(l.pts[1].x, l.pts[2].x, .5), p.y + 1, lerp(l.pts[1].z, l.pts[2].z, .5)), color: l.color, secondary: true, planned: l.planned});
  }

  // on-board callouts: a leader line from the part to a label off the board
  const callout = (id, from, to, lab) => {
    lab.align = to.x < 0 ? "left" : "right";
    model.leaders.push({id, from, to, part: lab.part || null, alias: lab.alias || null, color: lab.color || "var(--muted)", planned: lab.planned});
    model.labels.push({id, pos: to, ...lab});
  };
  const back = " · " + tr("p3d.back");
  if (compById.beep) {
    const c = compById.beep;
    callout("ob-beep", v(B.speaker.x - 4, TOP, B.speaker.z - 2), v(-34, 3, -23),
      {cls: "mod", part: "beep", kind: kindBadge(c.kind), title: L(c, "name"), sub: c.iface + " · P0.00" + back, color: partColor("beep")});
  }
  if (compById.accel) {
    const c = compById.accel;
    callout("ob-accel", v(B.accel.x, TOP, B.accel.z), v(30, 3, -27),
      {cls: "mod", part: "accel", kind: kindBadge(c.kind), planned: !!c.planned, title: L(c, "name"), sub: tr("p3d.internalI2c") + back, color: partColor("accel")});
  }
  const matrixPins = ledPins.filter(l => !(l.f.status === "used")).map(l => l.f.pin);
  if (matrixComp) {
    callout("ob-matrix", v(B.matrix.x - 8.4, TOP + 0.6, B.matrix.z - 8.4), v(-34, 3, -10),
      {cls: "mod", part: "matrix", kind: kindBadge(matrixComp.kind), title: L(matrixComp, "name"),
        sub: matrixOn ? tr("p3d.matrixBusy", {pins: matrixPins.join(" ")}) : tr("p3d.matrixOff", {pins: ledPinIds.join(" ")}),
        color: partColor("matrix"), off: !matrixOn});
  } else {
    callout("ob-matrix", v(B.matrix.x - 8.4, TOP + 0.6, B.matrix.z + 2), v(-34, 3, -7),
      {cls: "mod", part: null, alias: "@matrix", kind: "actuator", title: tr("p3d.matrix"),
        sub: matrixOn ? tr("p3d.matrixBusy", {pins: matrixPins.join(" ")}) : tr("p3d.matrixOff", {pins: ledPinIds.join(" ")}),
        color: "var(--muted)", off: !matrixOn, pins: ledPinIds});
  }
  if (compById.radio) {
    const c = compById.radio;
    callout("ob-radio", v(B.antenna.x, TOP, B.antenna.z), v(-34, 3, -26),
      {cls: "mod", part: "radio", kind: kindBadge(c.kind), title: L(c, "name"), sub: c.iface, color: partColor("radio")});
  }
  if (compById.logic) {
    const c = compById.logic;
    callout("ob-logic", v(B.chip.x, TOP + 0.8, B.chip.z), v(34, 3, 4),
      {cls: "mod", part: "logic", kind: kindBadge(c.kind), title: L(c, "name"), sub: "nRF52833" + back, color: partColor("logic")});
  } else {
    // on the chip, clear of the 0 / 1 / 2 / 3V / GND names printed above the rings
    model.labels.push({id: "ob-chip", cls: "onb", title: "nRF52833" + back, pos: v(B.chip.x + 3, TOP + 1, B.chip.z + 0.6), secondary: true});
  }
  // the logo's name above it, the microphone's to its right, so the two never run into each other
  model.labels.push({id: "ob-mic", cls: "onb", title: tr("p3d.mic"), pos: v(B.mic.x + 1.8, TOP + 1, B.mic.z), align: "right", secondary: true});
  model.labels.push({id: "ob-logo", cls: "onb", title: tr("p3d.logo"), pos: v(B.logo.x, TOP + 1, B.logo.z - 2.4), secondary: true});

  // central board: the two player boards it talks to (ghosts)
  if (boardKind === "central" && compById.radio) {
    for (const [n, x] of [[1, -58], [2, 58]]) {
      model.ghosts.push({n, x, z: 12, w: BOARD.w * 0.42, d: BOARD.d * 0.42});
      const a = v(B.antenna.x, TOP + 1, B.antenna.z);
      const b = v(x, 2, 12);
      model.links.push({from: "radio", part: "radio", pins: [], color: partColor("radio"), planned: false, radio: true,
        pts: [a, v(lerp(a.x, b.x, 0.33), 16, lerp(a.z, b.z, 0.33) - 6), v(lerp(a.x, b.x, 0.7), 12, lerp(a.z, b.z, 0.7) - 4), b]});
      model.labels.push({id: "ghost-" + n, cls: "onb ghost", title: tr("app.board.playerN", {n}), align: "below", pos: v(x, 1, 12 + 11)});
    }
  }

  return model;
}

/* ---------------- label layout (both views) ---------------- */

// Keep the big labels inside the stage (W × H px) and off each other: boxes
// {x, y, w, h} (top-left corner, px) → a nudge {dx, dy} for each. A label is
// first slid sideways back inside the stage, then moved up or down to the
// nearest spot that is free (just above or below one of the labels already
// placed, or of the fixed boxes, which never move). Greedy, in order of height
// on screen; a label with no free spot stays where it is.
export function declutter(boxes, W, H, gap = 3, fixed = []) {
  const order = boxes.map((b, i) => i).sort((a, b) => boxes[a].y - boxes[b].y);
  const placed = [...fixed];   // small labels that stay put (pin numbers): the big ones move around them
  const out = boxes.map(() => ({dx: 0, dy: 0}));
  const hits = (r, p) => r.x < p.x + p.w + gap && p.x < r.x + r.w + gap && r.y < p.y + p.h + gap && p.y < r.y + r.h + gap;
  for (const i of order) {
    const b = boxes[i];
    const r = {...b};
    r.x = Math.max(2, Math.min(W - 2 - r.w, r.x));
    r.y = Math.max(2, Math.min(H - 2 - r.h, r.y));
    if (placed.some(q => hits(r, q))) {
      const y0 = r.y;
      const cands = [];
      for (const p of placed) cands.push(p.y - gap - r.h, p.y + p.h + gap);
      const free = cands.filter(y => y >= 2 && y + r.h <= H - 2)
        .sort((a, c) => Math.abs(a - y0) - Math.abs(c - y0))
        .find(y => !placed.some(q => hits({...r, y}, q)));
      if (free !== undefined) r.y = free;
    }
    out[i] = {dx: r.x - b.x, dy: r.y - b.y};
    placed.push(r);
  }
  return out;
}

/* ---------------- selection ---------------- */

// sel: {pin: "P13"} or {part: "tft"} → the pins and parts to light up
export function resolveSel(model, sel) {
  const pins = new Set(), parts = new Set();
  if (!sel) return null;
  if (sel.pin) {
    pins.add(sel.pin);
    const f = model.fingers.find(x => x.pin === sel.pin);
    if (f?.part) parts.add(f.part);
    for (const t of model.traces) if (t.pin === sel.pin && t.part) parts.add(t.part);
    if (f && f.builtin.startsWith("LED") && f.status === "busy") parts.add(model.board === "central" ? "matrix" : "@matrix");
    if (f && f.builtin.startsWith("按钮")) parts.add("@btn" + f.builtin.slice(-1));
    for (const l of model.links) if (l.pins.includes(sel.pin)) parts.add(l.part);
  }
  if (sel.part) {
    parts.add(sel.part);
    for (const f of model.fingers) if (f.part === sel.part && f.status === "used") pins.add(f.pin);
    for (const l of model.links) if (l.part === sel.part) l.pins.forEach(p => pins.add(p));
    for (const t of model.traces) if (t.part === sel.part && t.pin) pins.add(t.pin);
    if (sel.part === "@matrix") for (const t of model.traces) if (t.led) pins.add(t.pin);
    if (sel.part === "btn") { parts.add("@btnA"); parts.add("@btnB"); }
  }
  return {pins, parts};
}

// Does an object with these tags ({pin, part, alias}) belong to the selection?
export function isLit(r, t) {
  if (!r) return true;
  if (t.pin && r.pins.has(t.pin)) return true;
  if (t.part && r.parts.has(t.part)) return true;
  if (t.alias && r.parts.has(t.alias)) return true;
  return false;
}

// Sanity check used by the tests: every pin in pins.json is on the connector
export function check(D) {
  const onEdge = new Set(EDGE.map(e => e.replace("R:", "")));
  return D.pins.pins.filter(p => !onEdge.has(p.pin)).map(p => p.pin);
}
