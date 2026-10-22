// World 1 co-op checker for rooms 1-2 WINCH and 1-3 LEVERS (reads ./mode-adventure.js, the real file).
//   1. geometry: 1-2 every winch stand tile is >= 5 walking steps from the nearest gate tile;
//                1-3 every stand tile of lever A is >= 6 walking steps from every stand tile of lever B
//                (walking = floor-like tiles; barriers count as walkable, so this is the worst case)
//   2. inventory: each room keeps the same kinds and counts of objects as before (its idea and look)
//   3. solver (tests/out/solve_c, the BFS with the central's rules): all 6 pet orders solvable;
//      12 solo cases (partner absent) and 12 passive-partner cases (partner only walks) NOT solvable;
//      ablations: 1-2 without the winch and 1-3 without the crate NOT solvable
//   4. every duo solution replayed in the REAL central code of ./mode-adventure.js -> ROOM_CLEAR
//      (open loop, slimes removed because the solver has none; the browser harness plays them with slimes)
//   5. difficulty: duo solution length stays within 0.7x .. 1.8x of the original room's
//   6. rooms 1-1 and 1-4 unchanged
// usage: node tests/adv/check-w1.js [-v]      exit 0 = all PASS   (no browser: needs solve_c)
"use strict";
const fs = require("fs"), path = require("path"), vm = require("vm"), {execFileSync} = require("child_process");
const ROOT = path.resolve(__dirname, "..", "..");
const SOLVE = process.env.SOLVE_C || path.join(__dirname, "..", "out", "solve_c");
const VERBOSE = process.argv.includes("-v");
const COLS = 10, ROWS = 9, PET = ["Ember", "Tide", "Sprout"], DUOS = [[0, 1], [1, 0], [0, 2], [2, 0], [1, 2], [2, 1]];
const xy = t => `(${t % COLS},${(t / COLS) | 0})`;
let fails = 0;
const res = (ok, msg) => { console.log((ok ? "PASS " : "FAIL ") + msg); if (!ok) fails++; return ok; };

// the original World 1 maps (main be739d2), for inventory / difficulty / unchanged checks
const ORIG = {
  0: ["....##....", ".1..VV..$.", "....##....", ".S..##...E", "....FF...E", "....##...E", ".2..##....", "....WW....", "....##...."],
  1: ["..$.s...PE", ".........E", "##GGGG####", "..........", ".R........", "..........", "....12....", "..........", ".........."],
  2: ["....#....$", ".1..#..L..", "..C.#.....", "....G....E", "..V.#..s.E", ".#P##....E", "....#.....", ".2..#..L..", "S...#....+"],
  3: ["..........", "....BB....", "....BB....", "..........", "..........", "..........", "..........", "...1..2...", ".........."],
};
const ORIG_SLOTS = {1: {lo: 15, hi: 15}, 2: {lo: 19, hi: 21}};   // solve_c duo solution lengths of ORIG (6 pet orders)

function siteRooms() {
  const src = fs.readFileSync(path.join(ROOT, "mode-adventure.js"), "utf8");
  const a = src.indexOf("const ROOMS = [");
  const end = src.indexOf("\n  ];", a);
  if (a < 0 || end < 0) throw new Error("ROOMS literal not found in mode-adventure.js");
  return vm.runInNewContext("(" + src.slice(a + "const ROOMS = ".length, end + 4) + ")", {});
}

function solveC(map, gateBack, p0, p1, sp, duo, passive) {
  const sh = p1 === 3 ? [0, 1, 2].find(x => x !== p0) : 3 - p0 - p1;
  return solveRaw(map, gateBack, p0, p1, sh, sp, duo, passive);
}
function solveRaw(map, gateBack, p0, p1, sh, sp, duo, passive) {
  const args = [map.join(""), String(gateBack == null ? 0 : gateBack), String(p0), String(p1), String(sh), String(sp || 0),
    duo ? "2" : "3", duo ? "4" : "6", "0", String(passive == null ? -1 : passive)];
  const out = execFileSync(SOLVE, args, {maxBuffer: 1 << 28}).toString();
  const r = {};
  for (const line of out.trim().split("\n")) { const [k, ...v] = line.split(" "); r[k] = v; }
  const o = {solvable: r.solvable && r.solvable[0] === "1", states: r.states ? +r.states[0] : 0};
  if (o.solvable) { o.slots = +r.slots[0]; o.acts = r.path.map(x => x.split(",").map(Number)); }
  return o;
}

// ---- the real central code, ROOMS replaced by one room
function loadMode(room) {
  let src = fs.readFileSync(path.join(ROOT, "mode-adventure.js"), "utf8");
  // the room under test becomes ROOMS[0] (where a world starts); the other rooms stay
  const a = src.indexOf("  const ROOMS = ["), b = src.indexOf("\n  ];", a);
  if (a < 0 || b < 0) throw new Error("ROOMS literal not found");
  const all = vm.runInNewContext("(" + src.slice(a + "  const ROOMS = ".length, b + 4) + ")", {});
  const R = {key: "dev.adv.room1", tips: [], map: room.map};
  if (room.gateBack != null) R.gateBack = room.gateBack;
  all[0] = R;
  src = src.slice(0, a) + "  const ROOMS = " + JSON.stringify(all) + ";" + src.slice(b + 4);
  let mode = null;
  const noop = () => {};
  const DEVICE = {
    C: {ACT: {ADV_PICK: 0x30, ADV_USE: 0x31, ADV_POWER: 0x32, ADV_PING: 0x33, ADV_SWAP: 0x34, ADV_CORE: 0x35, ADV_RESTART_ROOM: 0x36},
      MSG: {ADV_STATE: 0x44}, CTL_JOY_PUSH: 60, CTL_PRESS_START: 40, CTL_PRESS_FULL: 230},
    registerStrings: noop, registerSprites: noop, registerSfx: noop, registerMessage: noop, registerScreen: noop,
    registerFixture: noop, registerMode: m => { mode = m; }, battleParams: () => ({}), params: () => ({}), PLAYER_COLORS: [], PETS: [],
    rankFmt: {clockDs: () => ""}, bytesToStr: () => "",
  };
  vm.runInNewContext(src, {window: {DEVICE}, console, Math, JSON, Object, Array, Set, Map, Error});
  if (!mode) throw new Error("mode-adventure.js did not register a mode");
  return mode;
}
const JOY = [[0, 100], [100, 0], [0, -100], [-100, 0]];
function replay(room, pets, acts) {
  const mode = loadMode(room);
  const A = {PICK: 0x30, USE: 0x31, POWER: 0x32, SWAP: 0x34};
  let g = 0;
  const api = {gameNow: () => g, now: () => g, nextStep: () => {}, broadcast: () => {}, randInt: () => 0};
  const c = mode.central.create(api, {});
  // world vote (0x10 + world, both World 1), then the pet pick
  if (!c.action(0, A.PICK, 0x10) || !c.action(1, A.PICK, 0x10)) return {ok: false, why: "world vote failed"};
  if (!c.action(0, A.PICK, pets[0]) || !c.action(1, A.PICK, pets[1])) return {ok: false, why: "pick failed"};
  const winch = room.map.join("").indexOf("R");
  const step = (t, d) => { const x = t % 10 + [0, 1, 0, -1][d], y = ((t / 10) | 0) + [-1, 0, 1, 0][d]; return x >= 0 && y >= 0 && x < 10 && y < 9 ? y * 10 + x : -1; };
  const stick = [-1, -1], pad = [0, 0];
  const tick = () => {
    g += 50;
    for (let p = 0; p < 2; p++) {
      const [x, y] = stick[p] >= 0 ? JOY[stick[p]] : [0, 0];
      c.input(p, {joyX: x, joyY: y, buttons: 0, pressure: pad[p] ? 230 : 0});
    }
    c.tick(g);
  };
  const actDir = a => (a >= 5 && a <= 8 ? a - 5 : -1);
  // wait for the room to start (pick -> play) and its start countdown to run out
  for (let k = 0; k < 400; k++) { const s0 = c.debug("state"); if (s0.phase === 1 && !(s0.countdownMs > 0)) break; tick(); }
  if (acts.length) for (let p = 0; p < 2; p++) stick[p] = actDir(acts[0][p]);
  tick();
  stick[0] = stick[1] = -1;
  tick(); tick(); tick();
  let fail = null;
  for (let i = 0; i < acts.length && !fail; i++) {
    const ac = acts[i], s = c.debug("state");
    if (s.phase !== 1) break;
    const hold = [0, 1].map(p => ac[p] >= 5 && ac[p] <= 8 && step(s.heroes[p].pos, ac[p] - 5) === winch);
    for (let p = 0; p < 2; p++) {
      const x = ac[p];
      if (x >= 5 && x <= 8 && !hold[p]) {
        const f = step(s.heroes[p].pos, x - 5), ch = room.map[(f / 10) | 0][f % 10];
        if (s.heroes[p].dir !== x - 5) fail = `slot ${i + 1}: P${p + 1} not facing ${"URDL"[x - 5]}`;
        if (!c.action(p, ch === "L" ? A.USE : A.POWER, 0)) fail = `slot ${i + 1}: action of P${p + 1} refused`;
      } else if (x === 9) { if (!c.action(p, A.SWAP, 0)) fail = `slot ${i + 1}: swap of P${p + 1} refused`; }
    }
    for (let p = 0; p < 2; p++) {
      stick[p] = ac[p] >= 1 && ac[p] <= 4 ? ac[p] - 1 : hold[p] ? ac[p] - 5 : -1;
      pad[p] = hold[p] ? 1 : 0;
    }
    tick();
    for (let p = 0; p < 2; p++) if (!hold[p]) stick[p] = -1;
    tick(); tick();
    if (i + 1 < acts.length) for (let p = 0; p < 2; p++) if (!hold[p]) stick[p] = actDir(acts[i + 1][p]);
    tick();
    for (let p = 0; p < 2; p++) { if (!(i + 1 < acts.length && hold[p] && acts[i + 1][p] === ac[p])) { stick[p] = -1; pad[p] = 0; } }
  }
  for (let k = 0; k < 4; k++) tick();
  const st = c.debug("state");
  return {ok: !fail && st.phase === 2, phase: st.phase, why: fail, hearts: st.hearts, pos: st.heroes.map(h => xy(h.pos))};
}

// ---- geometry
const at = (map, t) => map[(t / COLS) | 0][t % COLS];
const nbrs = t => {
  const x = t % COLS, y = (t / COLS) | 0, out = [];
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) { const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS) out.push(ny * COLS + nx); }
  return out;
};
const standable = ch => !"#RLS".includes(ch) && ch !== "G";    // gate tiles are targets, not stand tiles
function bfsDist(map, from, isGoal, pass) {
  const dist = new Map([[from, 0]]), q = [from];
  while (q.length) {
    const t = q.shift();
    if (isGoal(t) && t !== from) return dist.get(t);
    for (const n of nbrs(t)) if (!dist.has(n) && (pass(at(map, n)) || isGoal(n))) { dist.set(n, dist.get(t) + 1); q.push(n); }
  }
  return Infinity;
}
const tilesOf = (map, ch) => { const o = []; for (let t = 0; t < COLS * ROWS; t++) if (at(map, t) === ch) o.push(t); return o; };
const inventory = map => { const c = {}; for (const ch of map.join("")) if (ch !== "." && ch !== "#") c[ch] = (c[ch] || 0) + 1; return c; };
const invStr = c => Object.keys(c).sort().map(k => k + c[k]).join(" ");

function checkRoom(ri, room) {
  const id = "1-" + (ri + 1), map = room.map;
  console.log(`== ${id}\n${map.map((r, y) => "   " + y + " " + r).join("\n")}`);
  if (!res(Array.isArray(map) && map.length === ROWS && map.every(r => typeof r === "string" && r.length === COLS), `${id} map is 9 rows x 10 columns`)) return;
  const inv0 = invStr(inventory(ORIG[ri])), inv1 = invStr(inventory(map));
  // the gate may change width (it is one group), everything else keeps its count
  const strip = s => s.replace(/G\d+/, "G*");
  res(strip(inv0) === strip(inv1), `${id} inventory (objects and counts) unchanged: was "${inv0}", now "${inv1}"`);
  const G = tilesOf(map, "G");
  if (ri === 1) {
    const R = tilesOf(map, "R")[0];
    const stands = nbrs(R).filter(t => standable(at(map, t)));
    const d = stands.map(t => [t, bfsDist(map, t, n => G.includes(n), standable)]);
    const min = Math.min(...d.map(x => x[1]));
    res(stands.length > 0 && min >= 5, `${id} winch ${xy(R)}: stand tiles ${d.map(([t, k]) => xy(t) + "->" + k).join(" ")}; nearest gate ${min} steps (need >= 5)`);
    const P = tilesOf(map, "P")[0], north = bfsDist(map, R, n => n === P, standable);
    res(north === Infinity, `${id} plate ${xy(P)} is only reachable through the gate (not from the winch side)`);
  }
  if (ri === 2) {
    const L = tilesOf(map, "L");
    if (res(L.length === 2, `${id} two levers`)) {
      const sa = nbrs(L[0]).filter(t => standable(at(map, t))), sb = nbrs(L[1]).filter(t => standable(at(map, t)));
      let min = Infinity, pair = "";
      for (const a of sa) for (const b of sb) {
        const k = a === b ? 0 : bfsDist(map, a, n => n === b, ch => standable(ch) || ch === "G");
        if (k < min) { min = k; pair = xy(a) + "-" + xy(b); }
      }
      res(min >= 6, `${id} levers ${xy(L[0])} ${xy(L[1])}: closest stand tiles ${pair} are ${min} steps apart (need >= 6)`);
    }
  }
  const gb = room.gateBack;
  const duoSlots = [];
  for (const [a, b] of DUOS) {
    const r = solveC(map, gb, a, b, 0, true);
    let line = `${id} duo ${PET[a]}+${PET[b]}: ${r.solvable ? r.slots + " slots" : "NOT SOLVABLE"}`;
    let ok = r.solvable;
    if (r.solvable) {
      duoSlots.push(r.slots);
      // the solver ignores slimes, so the open-loop replay runs without them (the browser harness has them)
      const rp = replay(Object.assign({}, room, {map: map.map(row => row.replace(/s/g, "."))}), [a, b], r.acts);
      line += rp.ok ? `, real central (slimes removed) ROOM_CLEAR hearts ${rp.hearts}` : `, real central (slimes removed) FAILED (${rp.why || "phase " + rp.phase} at ${rp.pos})`;
      ok = ok && rp.ok;
      if (VERBOSE) line += "\n     path " + r.acts.map(x => x.join(",")).join(" ");
    }
    res(ok, line);
  }
  const so = [];
  for (let pet = 0; pet < 3; pet++) for (let sh = 0; sh < 3; sh++) if (sh !== pet) for (const sp of [0, 1]) {
    const r = solveRaw(map, gb, pet, 3, sh, sp, false, null);
    if (r.solvable) so.push(`${PET[pet]}/shrine ${PET[sh]}/spawn ${sp + 1}: ${r.slots} slots` + (VERBOSE ? " path " + r.acts.map(x => x.join(",")).join(" ") : ""));
  }
  res(!so.length, `${id} solo (partner absent, loose timing gate 600 ms / lever 1.2 s): ${so.length}/12 solvable ${so.join("; ")}`);
  const pa = [];
  for (const [a, b] of DUOS) for (const pv of [0, 1]) {
    const r = solveRaw(map, gb, a, b, 3 - a - b, 0, false, pv);
    if (r.solvable) pa.push(`${PET[a]}+${PET[b]} P${pv + 1} passive: ${r.slots} slots` + (VERBOSE ? " path " + r.acts.map(x => x.join(",")).join(" ") : ""));
  }
  res(!pa.length, `${id} passive partner (only walks): ${pa.length}/12 solvable ${pa.join("; ")}`);
  const abl = ri === 1 ? ["noWinch", m => m.map(r => r.replace("R", "."))] : ["noCrate", m => m.map(r => r.replace("C", "."))];
  const ab = DUOS.filter(([a, b]) => solveC(abl[1](map), gb, a, b, 0, true).solvable);
  res(!ab.length, `${id} ablation ${abl[0]}: ${ab.length}/6 pet orders solvable (need 0)`);
  if (duoSlots.length) {
    const o = ORIG_SLOTS[ri], lo = Math.min(...duoSlots), hi = Math.max(...duoSlots);
    res(lo >= Math.floor(0.7 * o.lo) && hi <= Math.ceil(1.8 * o.hi), `${id} difficulty: duo solutions ${lo}-${hi} slots (original ${o.lo}-${o.hi}; allowed ${Math.floor(0.7 * o.lo)}-${Math.ceil(1.8 * o.hi)})`);
  }
}

const rooms = siteRooms();
for (const ri of [0, 3]) res(JSON.stringify(rooms[ri].map) === JSON.stringify(ORIG[ri]), `1-${ri + 1} unchanged`);
for (const ri of [1, 2]) checkRoom(ri, rooms[ri]);
console.log(fails ? `\n${fails} check(s) FAILED` : "\nALL PASS");
process.exit(fails ? 1 : 0);
