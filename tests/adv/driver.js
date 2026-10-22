// In-page play-through driver for 双人冒险 (injected by harness.js into device.html?test=1).
// Drives BOTH handhelds only through the simulator's key/stick/pad hooks (DEVICE.press / hold / stick /
// pressure), so every input goes handheld -> radio -> central board (the micro:bit relay) like on hardware.
// It READS the central's last broadcast adv.state (DEVICE.central().mode.snapshot) to know when a step
// has happened (closed loop: robust to radio latency / loss), never writes game state, except
// DEVICE.debug("room", i) to jump to the room under test (the same hook World 1's fixtures use).
(function () {
  "use strict";
  const D = window.DEVICE, NONE = 0xff, COLS = 10, ROWS = 9;
  const C = D.C;

  /* ===================== ADAPTER: the one place to change for the builder's hooks ===================== */
  const ADAPTER = {
    rules: () => D.rules("adventure"),
    // Where is this case's room in the simulator? 1) a ROOMS entry with the identical map (any order),
    // 2) else the flat position (world - 1) * 4 + (room - 1) (World 1 layout continued), 3) else not built.
    roomIndex(c) {
      const rooms = (this.rules() || {}).ROOMS || [];
      const want = c.map.join("|");
      const hit = rooms.findIndex(r => r && r.map && r.map.join("|") === want);
      if (hit >= 0) return {idx: hit, how: "map"};
      const i = (c.world - 1) * 4 + (c.room - 1);
      // only trusted when the table looks like the full flat layout (3 worlds x 4 rooms)
      if (rooms.length >= 12 && rooms[i] && rooms[i].map && !!rooms[i].boss === !!c.boss) return {idx: i, how: "position (map differs from final/*.json)"};
      return {idx: -1, how: "not built (" + rooms.length + " rooms in ROOMS)"};
    },
    // World 1's hook: central.debug("room", index) = enterRoom(index) (only after the pick)
    jump(idx) { D.debug("room", idx); },
    // the room is cleared: ROOM_CLEAR (2), CLEAR (4: last room / boss down), or already in the next room
    cleared: (s, idx) => s.phase === 2 || s.phase === 4 || (s.phase === 1 && s.room !== idx),
    failedPhase: s => s.phase === 3 || s.phase === 5,          // TEAM_DOWN, GAVE_UP
    info: idx => ADAPTER.rules().INFO[idx],
  };

  const DXY = [[0, 100], [100, 0], [0, -100], [-100, 0]];     // up right down left (stick y > 0 = up)
  const snap = () => { const c = D.central(); return c.mode && c.mode.snapshot; };
  const X = t => t % COLS, Y = t => (t / COLS) | 0;
  const stepTile = (t, d) => { const x = X(t) + [0, 1, 0, -1][d], y = Y(t) + [-1, 0, 1, 0][d]; return x >= 0 && y >= 0 && x < COLS && y < ROWS ? y * COLS + x : -1; };
  const petOf = h => h.petFlags & 3;
  const stick = (p, d) => (d < 0 ? D.stick(p, 0, 0) : D.stick(p, DXY[d][0], DXY[d][1]));
  const radioMax = {};
  let t0 = 0;
  const now = () => D.now() - t0;
  function waitUntil(pred, maxMs, chunk = 10) {
    const end = D.now() + maxMs;
    while (D.now() < end) { const s = snap(); if (s && pred(s)) return true; D.step(chunk); }
    const s = snap(); return !!(s && pred(s));
  }

  /* ===================== setup: reset, pick pets with keys, jump ===================== */
  function setup(o) {
    D.reset({seed: o.seed || 7, skipBoot: true, mode: "adventure", pad: "on",
      profiles: [{name: "ANNA", avatar: 3, color: 0}, {name: "BENJI", avatar: 5, color: 4}]});
    D.pause();
    if (o.radio) D.radio.set(o.radio);
    // record the size of every frame the radio carries, per message type (adv.state is 0x44)
    const radio = D.world().radio, send = radio.send.bind(radio);
    radio.send = (src, dst, bytes) => { const k = "0x" + bytes[1].toString(16); radioMax[k] = Math.max(radioMax[k] || 0, bytes.length); return send(src, dst, bytes); };
    for (const p of [0, 1]) { D.bot(p, false); stick(p, -1); D.pressure(p, 0); }
    // World vote first (adv.world, r3 builds): both handhelds vote the case's world with keys
    // (DOWN moves the cursor, A votes); old builds go straight to adv.pick
    const onWorld = () => [0, 1].some(p => D.screen(p).id === "adv.world");
    for (let i = 0; i < 300 && !onWorld() && ![0, 1].every(p => D.screen(p).id === "adv.pick"); i++) D.step(10);
    if (onWorld()) {
      D.step(300);
      const w = (o.world || 1) - 1;
      for (const p of [0, 1]) {
        for (let k = 0; k < 6 && (D.hh(p).s.sel | 0) !== w; k++) { D.press(p, "DOWN", 60); D.step(200); }
        D.press(p, "A", 60); D.step(300);
      }
      if (!waitUntil(s => s.phase === 0 && s.room === w * 4, 2000)) throw new Error("world vote for world " + (w + 1) + " did not start the pet pick");
    }
    const both = () => [0, 1].every(p => D.screen(p).id === "adv.pick");
    for (let i = 0; i < 1000 && !both(); i++) D.step(10);
    if (!both()) throw new Error("pick screen never came: " + JSON.stringify([D.screen(0), D.screen(1)]));
    D.step(300);
    for (const p of [0, 1]) {
      const want = o.pets[p];
      for (let k = 0; k < 10; k++) {
        const s = snap();
        if (s && petOf(s.heroes[p]) === want) break;
        const sel = D.hh(p).s.sel | 0;
        D.press(p, sel === want ? "A" : "RIGHT", 60);
        D.step(sel === want ? 700 : 250);
      }
      if (!waitUntil(s => petOf(s.heroes[p]) === want || s.phase === 1, 1000)) throw new Error("P" + (p + 1) + " could not pick pet " + want);
    }
    if (!waitUntil(s => s.phase === 1 && s.countdownDs === 0, 6000)) throw new Error("play never started");
    const s = snap();
    if (petOf(s.heroes[0]) !== o.pets[0] || petOf(s.heroes[1]) !== o.pets[1]) throw new Error("pets are " + [petOf(s.heroes[0]), petOf(s.heroes[1])]);
    D.step(300);
  }
  function jump(idx) {
    ADAPTER.jump(idx);
    if (!waitUntil(s => s.room === idx && s.phase === 1, 2000)) throw new Error("jump to room index " + idx + " failed");
    D.step(250);                                             // input lock after the room wipe
    t0 = D.now();
    const s = snap();
    return {bits: s.objBits, crates: s.cratePos.slice(), pos: s.heroes.map(h => h.pos), hearts: s.hearts};
  }

  /* ===================== measured redraw: animated room tiles (§7.3: <= 8, <= 4 Hz) ===================== */
  function animatedTiles(idx, ms = 1000) {
    const excl = new Set(), prev = [null, null], changes = new Array(COLS * ROWS).fill(0);
    const mark = s => {
      for (const h of s.heroes) if (h.pos !== NONE) excl.add(h.pos);
      for (const e of s.enemies) if (e.pos !== NONE) excl.add(e.pos);
      for (const c of s.cratePos) if (c !== NONE) excl.add(c);
      for (const r of s.rocks) if (r !== NONE) excl.add(r);
      const I = ADAPTER.info(idx);
      if (I.boss) { for (let t = 0; t < COLS * ROWS; t++) if (ADAPTER.rules().ROOMS[idx].map[Y(t)][X(t)] === "B") excl.add(t); }
      for (const b of (ADAPTER.rules().BOSS_TILES || [])) if (I.boss) excl.add(b);
      if (s.bossTarget !== NONE) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) excl.add(s.bossTarget + dy * COLS + dx);
    };
    const tileSig = (px, t) => { let h = 0; const x0 = 4 + X(t) * 12, y0 = 16 + Y(t) * 12; for (let y = 0; y < 12; y++) for (let x = 0; x < 12; x++) h = (Math.imul(h, 31) + px[(y0 + y) * 128 + x0 + x]) | 0; return h; };
    for (let k = 0; k <= ms / 50; k++) {
      const s = snap(); mark(s);
      const px = D.pixels(0), sig = [];
      for (let t = 0; t < COLS * ROWS; t++) sig.push(tileSig(px, t));
      if (prev[0]) for (let t = 0; t < COLS * ROWS; t++) if (sig[t] !== prev[0][t]) changes[t]++;
      prev[0] = sig;
      D.step(50);
    }
    const tiles = [];
    for (let t = 0; t < COLS * ROWS; t++) if (changes[t] && !excl.has(t)) tiles.push({t: `(${X(t)},${Y(t)})`, perS: +(changes[t] * 1000 / ms).toFixed(1)});
    const map = ADAPTER.rules().ROOMS[idx].map.join("");
    return {measured: tiles.length, tiles, maxChangesPerS: Math.max(0, ...tiles.map(x => x.perS)), mapCount: map.split("").filter(ch => ch === "F" || ch === "W").length};
  }

  /* ===================== scripted solution (solver slots -> keys) ===================== */
  // solve_c slot codes per player: 0 stay, 1-4 move (dir = a - 1: up right down left), 5-8 act toward dir a - 5
  // (winch -> stick + full pad held; lever -> A; barrier -> S), 9 shrine swap (M click). Slot = ADV_STEP_MS 200 ms (§6.3).
  function runActs(idx, acts, o = {}) {
    const I = ADAPTER.info(idx), R = ADAPTER.rules(), map = R.ROOMS[idx].map;
    const ch = t => map[Y(t)][X(t)];
    const passive = o.passive != null ? o.passive : -1;         // that player only walks (no A / S / M / pad)
    let slots = acts.trim().split(/\s+/).map(x => x.split(",").map(Number));
    if (o.gateSafe) slots = gateSafe(slots, snap().heroes.map(h => h.pos), ch);
    const hold = [false, false], exp = snap().heroes.map(h => h.pos), trace = [];
    let timeouts = 0;
    const until = o.slots != null ? o.slots : slots.length;
    for (let i = 0; i < until; i++) {
      const s0 = snap();
      if (ADAPTER.cleared(s0, idx) || ADAPTER.failedPhase(s0)) break;
      const tasks = [0, 1].map(p => {
        let a = slots[i][p];
        const h = s0.heroes[p], tk = {p, a, done: false, start: D.now()};
        // the judge's passive partner: only walks; no A / S / M / pad, never steps on a plate or pushes a crate
        if (p === passive && a >= 5) a = tk.a = 0;
        if (p === passive && a >= 1 && a <= 4) {
          const n = stepTile(h.pos, a - 1);
          if (n >= 0 && (ch(n) === "P" || s0.cratePos.includes(n))) a = tk.a = 0;
        }
        const keepHold = a >= 5 && a <= 8 && stepTile(h.pos, a - 5) >= 0 && ch(stepTile(h.pos, a - 5)) === "R";
        if (hold[p] && !keepHold) { stick(p, -1); D.pressure(p, 0); hold[p] = false; }
        if (a === 0) { stick(p, -1); tk.check = () => true; }
        else if (a <= 4) {
          const d = a - 1, target = stepTile(h.pos, d);
          stick(p, d); tk.target = target; tk.lastSkill = -1e9;
          tk.check = s => {
            const me = s.heroes[p];
            if (me.pos === target) { stick(p, -1); exp[p] = target; return true; }
            if (me.pos !== h.pos) { stick(p, -1); tk.off = true; return true; }      // knocked away (slime)
            // a slime on the tile: walking into it only turns you; hit it with S (2 damage) until it is gone
            const slime = s.enemies.some(e => e.pos === target && (e.hpType >> 4) === 1);
            if (slime && (me.dirAnim & 3) === d && D.now() - tk.lastSkill > 450) { D.press(p, "SKILL", 60); tk.lastSkill = D.now(); }
            return false;
          };
        } else if (a <= 8) {
          const d = a - 5, target = stepTile(h.pos, d);
          if (keepHold) { stick(p, d); D.pressure(p, 230); hold[p] = true; tk.check = () => true; }
          else {
            const btn = ch(target) === "L" ? "A" : "SKILL", oi = I.objAt[target];
            const bitSet = s => oi >= 0 && ((s.objBits >> oi) & 1) === 1;
            const doorSet = s => I.door >= 0 && ((s.objBits >> I.door) & 1) === 1;
            tk.pressed = false;
            if ((h.dirAnim & 3) !== d) stick(p, d);
            tk.check = s => {
              const me = s.heroes[p];
              if (!tk.pressed) {
                if ((me.dirAnim & 3) !== d) return false;
                stick(p, -1); D.press(p, btn, 60); tk.pressed = true; tk.pressAt = D.now();
                return false;
              }
              return bitSet(s) || doorSet(s);
            };
          }
        } else if (a === 9) {
          const pet = petOf(h);
          D.press(p, "MENU", 120);
          tk.check = s => petOf(s.heroes[p]) !== pet;
        }
        return tk;
      });
      const minEnd = D.now() + 200, limit = D.now() + (o.slotTimeoutMs || 1500);
      while (true) {
        const s = snap();
        for (const tk of tasks) if (!tk.done && tk.check(s)) { tk.done = true; tk.ms = D.now() - tk.start; }
        if (ADAPTER.cleared(s, idx) || ADAPTER.failedPhase(s)) break;
        if (tasks.every(tk => tk.done) && D.now() >= minEnd) break;
        if (D.now() >= limit) break;
        D.step(10);
      }
      const late = tasks.filter(tk => !tk.done);
      if (late.length) {
        timeouts++;
        for (const tk of late) { if (tk.a >= 1 && tk.a <= 4) stick(tk.p, -1); }
        trace.push(`slot ${i + 1} [${slots[i]}] timeout: ` + late.map(tk => "P" + (tk.p + 1) + " a" + tk.a).join(" ") + " at " + snap().heroes.map(h => `(${X(h.pos)},${Y(h.pos)})`).join(" "));
        if (!o.tolerant) return {ok: false, why: trace[trace.length - 1], trace, timeouts, slot: i + 1};
      }
      // knocked off the path (slime hit): walk back to where the solver expects us
      for (const tk of tasks) if (tk.off && !o.tolerant) {
        const back = walkTo(idx, tk.p, exp[tk.p]);
        trace.push(`slot ${i + 1}: P${tk.p + 1} knocked off, walk back ${back ? "ok" : "FAILED"}`);
        if (!back) return {ok: false, why: "could not walk back after a knock-back", trace, timeouts, slot: i + 1};
      }
    }
    for (const p of [0, 1]) { stick(p, -1); if (hold[p]) D.pressure(p, 0); }
    return {ok: true, trace, timeouts, slot: until};
  }
  // Gate-safe reorder (for the relay radio): the solver lets go of the winch / steps off the plate one slot
  // before the partner crosses the gate, using the ADV_GATE_CLOSE_MS (400 ms) fall time. With 10-60 ms
  // round trips that squeeze is a coin flip, and a person keeps holding anyway. So: the holder keeps holding
  // (winch: same act; plate: stays) while the partner runs its next slots up to the step off the gate,
  // then the holder runs the slots it skipped while the partner waits. Same moves, same order per player.
  function gateSafe(slots, start, ch) {
    const pos = start.slice(), out = [];
    const isGate = t => t >= 0 && ch(t) === "G";
    const isWinchAct = (t, a) => a >= 5 && a <= 8 && stepTile(t, a - 5) >= 0 && ch(stepTile(t, a - 5)) === "R";
    const adv = (t, a) => { if (a >= 1 && a <= 4) { const n = stepTile(t, a - 1); if (n >= 0 && ch(n) !== "#") return n; } return t; };
    let i = 0;
    while (i < slots.length) {
      let done = false;
      for (const p of [0, 1]) {
        if (done || i === 0) continue;
        const q = 1 - p, prevA = slots[i - 1][p], a = slots[i][p];
        const winchEnd = isWinchAct(pos[p], prevA) && !isWinchAct(pos[p], a);
        const plateEnd = ch(pos[p]) === "P" && a >= 1 && a <= 4;
        if (!winchEnd && !plateEnd) continue;
        // does the partner step onto a gate tile in slots i .. i+3?  then run it to the step off the gate
        let qp = pos[q], j = -1, j2 = -1;
        for (let k = i; k < Math.min(slots.length, i + 4) && j2 < 0; k++) {
          const n = adv(qp, slots[k][q]);
          if (j < 0 && isGate(n) && n !== qp) j = k;
          if (j >= 0 && !isGate(n)) j2 = k;
          qp = n;
        }
        if (j < 0 || j2 < 0) continue;
        const keep = winchEnd ? prevA : 0;
        for (let k = i; k <= j2; k++) { const sl = [0, 0]; sl[p] = keep; sl[q] = slots[k][q]; out.push(sl); pos[q] = adv(pos[q], slots[k][q]); }
        for (let k = i; k <= j2; k++) { const sl = [0, 0]; sl[p] = slots[k][p]; sl[q] = 0; out.push(sl); pos[p] = adv(pos[p], slots[k][p]); }
        i = j2 + 1; done = true;
      }
      if (done) continue;
      out.push(slots[i]);
      for (const p of [0, 1]) pos[p] = adv(pos[p], slots[i][p]);
      i++;
    }
    return out;
  }
  // closed-loop walk (BFS over the rules' walkable()) for knock-back recovery
  function walkTo(idx, p, goal) {
    const R = ADAPTER.rules(), I = ADAPTER.info(idx);
    for (let guard = 0; guard < 40; guard++) {
      const s = snap(), me = s.heroes[p];
      if (me.pos === goal) return true;
      const blocked = new Set(s.cratePos.filter(c => c !== NONE).concat([s.heroes[1 - p].pos]));
      const path = R.bfs(me.pos, t => R.walkable(I, s.objBits, petOf(me), t) && !blocked.has(t), t => t === goal);
      if (!path || path.length < 2) return false;
      const d = [0, 1, 2, 3].find(k => stepTile(me.pos, k) === path[1]);
      stick(p, d);
      waitUntil(x => x.heroes[p].pos !== me.pos, 1000);
      stick(p, -1);
    }
    return false;
  }

  /* ===================== boss rooms ===================== */
  function bossFight(idx, kind, o = {}) {
    const BP = window.BOSS_POLICY, map = ADAPTER.rules().ROOMS[idx].map;
    const mem = [{}, {}], cur = [-2, -2], struck = [-1, -1];
    const end = D.now() + (o.maxMs || 180000);
    let strikes = 0;
    while (D.now() < end) {
      const s = snap();
      if (ADAPTER.cleared(s, idx) || ADAPTER.failedPhase(s)) break;
      const v = BP.decode(s, map, kind);
      for (const p of [0, 1]) {
        if (p === o.idle) continue;
        const m = D.hh(p).m;
        if (m && m.trial) {                              // core strike running: follow the band (what the screen shows)
          const lvl = Math.max(0, Math.min(100, m.trial.center));
          D.pressure(p, C.CTL_PRESS_START + Math.round(lvl * (C.CTL_PRESS_FULL - C.CTL_PRESS_START) / 100) + 2);
          continue;
        }
        if (cur[p] === -3) { D.pressure(p, 0); cur[p] = -2; }
        const a = BP.policy(v, p, mem[p]);
        if (a.strike) {
          if (cur[p] !== -1) { stick(p, -1); cur[p] = -1; }
          if (struck[p] !== s.bossWindow) { struck[p] = mem[p].struck = s.bossWindow; D.press(p, "A", 60); strikes++; cur[p] = -3; }
        } else {
          const d = a.d != null ? a.d : -1;
          if (d !== cur[p]) { stick(p, d); cur[p] = d; }
        }
      }
      D.step(50);
    }
    for (const p of [0, 1]) { stick(p, -1); D.pressure(p, 0); }
    return {strikes};
  }
  function botFight(idx, o = {}) {
    for (const p of [0, 1]) if (p !== o.idle) D.bot(p, true);
    waitUntil(s => ADAPTER.cleared(s, idx) || ADAPTER.failedPhase(s), o.maxMs || 180000, 100);
    D.bot(0, false); D.bot(1, false);
  }

  /* ===================== restart room (pause menu, keys only) ===================== */
  function restartRoom(idx, init) {
    D.hold(0, "MENU", true); D.step(1150); D.hold(0, "MENU", false); D.step(250);
    if (D.screen(0).overlay !== "ov.pause") return {ok: false, why: "hold M did not open the pause menu (" + JSON.stringify(D.screen(0)) + ")"};
    const before = snap();                                   // the world is paused from here on
    D.press(0, "UP", 60); D.step(250);                      // wraps to the last item: the mode's "Retry room"
    D.press(0, "A", 60); D.step(250);
    const asked = D.find(0, "重来这一间") || D.find(0, "Retry room");
    D.press(0, "A", 60);
    let sawCount = false;
    waitUntil(s => { if (s.countdownDs > 0) sawCount = true; return sawCount; }, 2000);
    waitUntil(s => s.countdownDs === 0 && s.phase === 1 && D.screen(0).overlay == null, 6000);
    D.step(250);
    const s = snap(), errs = [];
    if (!asked) errs.push("confirm text 'Retry room?' not shown");
    if (!sawCount) errs.push("no 3-2-1 countdown after the restart");
    if (s.room !== idx) errs.push("room " + s.room + " != " + idx);
    if (s.heroes.some((h, p) => h.pos !== init.pos[p])) errs.push("heroes not back on spawn: " + s.heroes.map(h => h.pos) + " want " + init.pos);
    // gems and hearts stay taken (enterRoom keeps them); every other object is back to the room start
    const I = ADAPTER.info(idx), keep = (I.gem >= 0 ? 1 << I.gem : 0) | (I.heart >= 0 ? 1 << I.heart : 0);
    if ((s.objBits & ~keep) !== (init.bits & ~keep)) errs.push("objBits " + s.objBits + " != room start " + init.bits + " (before restart " + before.objBits + ")");
    if ((s.objBits & keep) !== (before.objBits & keep)) errs.push("a taken gem / heart came back (bits " + (before.objBits & keep) + " -> " + (s.objBits & keep) + ")");
    if (s.cratePos.join() !== init.crates.join()) errs.push("crates " + s.cratePos + " != " + init.crates);
    if (s.hearts !== before.hearts) errs.push("hearts changed " + before.hearts + " -> " + s.hearts);
    return {ok: !errs.length, why: errs.join("; "), progressBits: before.objBits, progressPos: before.heroes.map(h => h.pos)};
  }

  /* ===================== one test case ===================== */
  // spec: {case, kind: solve | solo | restart | boss | bossSolo | bot, order: [pet1, pet2], acts, seed, radio, passive}
  function run(spec) {
    const c = spec.case, out = {id: c.id, kind: spec.kind, order: spec.orderTag, ok: false, notes: []};
    const where = ADAPTER.roomIndex(c);
    out.roomIndex = where.idx; out.found = where.how;
    if (where.idx < 0) { out.skip = true; out.why = "room " + c.id + " " + where.how; return out; }
    if (where.how !== "map") out.notes.push("room found by " + where.how);
    setup({pets: spec.order, seed: spec.seed, radio: spec.radio, world: c.world});
    const init = jump(where.idx), idx = where.idx;
    out.anim = animatedTiles(idx);
    const s1 = snap();
    if (s1.room !== idx || ADAPTER.cleared(s1, idx)) throw new Error("not in room after the redraw sample");
    let r = {};
    if (spec.kind === "solve") {
      r = runActs(idx, spec.acts, {gateSafe: !!spec.radio});
      waitUntil(s => ADAPTER.cleared(s, idx) || ADAPTER.failedPhase(s), 3000);
    } else if (spec.kind === "solo") {
      r = runActs(idx, spec.acts, {passive: spec.passive, tolerant: true, slotTimeoutMs: 800});
      waitUntil(s => ADAPTER.cleared(s, idx) || ADAPTER.failedPhase(s), spec.idleMs || 20000, 50);
    } else if (spec.kind === "restart") {
      const half = Math.max(1, Math.floor(spec.acts.trim().split(/\s+/).length / 2));
      const a = runActs(idx, spec.acts, {slots: half, gateSafe: !!spec.radio});
      if (!a.ok) { out.why = "first half: " + a.why; out.trace = a.trace; out.simS = +(now() / 1000).toFixed(2); return finish(out, idx); }
      const rr = restartRoom(idx, init);
      out.restart = rr;
      if (!rr.ok) { out.why = "restart: " + rr.why; out.simS = +(now() / 1000).toFixed(2); return finish(out, idx); }
      // the restart keeps the pets as they are now (a shrine swap stays): replay the solution for the current pet order
      const sn = snap(), tag = "ETS"[petOf(sn.heroes[0])] + "ETS"[petOf(sn.heroes[1])];
      if (tag !== spec.orderTag) out.notes.push("pets after restart " + tag + ": replayed the " + tag + " solution");
      if (!c.solutions[tag]) { out.why = "no solution for pets " + tag; return finish(out, idx); }
      r = runActs(idx, c.solutions[tag], {gateSafe: !!spec.radio});
      waitUntil(s => ADAPTER.cleared(s, idx) || ADAPTER.failedPhase(s), 3000);
    } else if (spec.kind === "boss") {
      r = Object.assign(bossFight(idx, c.bossType), {driver: "boss-policy.js keys"});
      out.notes.push(r.strikes + " strikes");
    } else if (spec.kind === "bossSolo") {
      r = Object.assign(bossFight(idx, c.bossType, {idle: 1, maxMs: spec.maxMs || 120000}), {driver: "boss-policy.js P1, P2 idle"});
    } else if (spec.kind === "bot") {
      botFight(idx, {maxMs: spec.maxMs || 120000});
    }
    const s = snap(), cleared = ADAPTER.cleared(s, idx);
    out.result = r; out.trace = r.trace; out.cleared = cleared; out.phase = s.phase; out.hearts = s.hearts;
    out.simS = +(now() / 1000).toFixed(2);
    const expectClear = !["solo", "bossSolo"].includes(spec.kind);
    if (expectClear) { out.ok = cleared && (r.ok !== false); if (!out.ok) out.why = r.why || ("not cleared, phase " + s.phase + ", heroes " + s.heroes.map(h => `(${X(h.pos)},${Y(h.pos)})`).join(" ")); }
    else { out.ok = !cleared; if (!out.ok) out.why = "cleared although the partner never acted"; else out.notes.push(s.phase === 3 ? "team down" : "timed out without clearing"); }
    return finish(out, idx);
  }
  // shared assertions
  function finish(out, idx) {
    const errors = D.errors(), lint = D.lint(), size = D.msgSize("adv.state");
    out.shared = {errors: errors.map(e => e.where + ": " + e.message), lint: lint.map(l => l.kind + " " + l.where), advStateSize: size,
      radioMaxAdvState: radioMax["0x44"] || 0, anim: out.anim ? {measured: out.anim.measured, mapFW: out.anim.mapCount, maxPerS: out.anim.maxChangesPerS} : null};
    const fails = [];
    if (errors.length) fails.push("DEVICE.errors(): " + out.shared.errors.join(" | "));
    if (lint.length) fails.push("DEVICE.lint(): " + out.shared.lint.join(" | "));
    if (size > 61) fails.push("adv.state is " + size + " B > 61");
    if ((radioMax["0x44"] || 0) > 61) fails.push("an adv.state frame on the radio was " + radioMax["0x44"] + " B > 61");
    if (out.anim && out.anim.measured > 8) fails.push("animated tiles " + out.anim.measured + " > 8: " + out.anim.tiles.map(x => x.t).join(" "));
    if (out.anim && out.anim.mapCount > 8) fails.push("map has " + out.anim.mapCount + " F/W tiles > 8");
    if (out.anim && out.anim.maxChangesPerS > 8) fails.push("a tile redraws " + out.anim.maxChangesPerS + "x/s (> 4 Hz)");
    out.sharedFails = fails;
    if (fails.length) { out.ok = false; out.why = [out.why, ...fails].filter(Boolean).join("; "); }
    return out;
  }

  window.PT = {run, ADAPTER, setup, jump, runActs, animatedTiles, restartRoom, bossFight, botFight, snap};
})();
