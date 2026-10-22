// Boss-room policies for the play-through tests (2-4 IDOL "eye", 3-4 RHINO), ported from the judge's
// boss.js bots (eyeBot / rhinoBot, 120/120 clears) but driven ONLY by what a handheld receives:
// the adv.state snapshot, decoded as world2-4.json / world3-4.json "state_bytes" specify.
// Works in Node (check-boss-policy.js runs it inside the judge's simulator) and in the page (driver.js).
//
// view = decode(snapshot, map, kind):
//   {kind, st, phase2, hp, body (top-left tile), tgt (0/1), face (eye), lane / land / rock (rhino), window,
//    heroes: [{pos}], rocks: [tiles], map}
// policy(view, p, mem) -> {d: 0..3} move | {strike: true} | {} stand still
(function (root) {
  "use strict";
  const COLS = 10, ROWS = 9, NONE = 0xff;
  const X = t => t % COLS, Y = t => (t / COLS) | 0, tile = (x, y) => y * COLS + x;
  const inRoom = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const stepTile = (t, d) => { const x = X(t) + DX[d], y = Y(t) + DY[d]; return inRoom(x, y) ? tile(x, y) : -1; };
  const man = (a, b) => Math.abs(X(a) - X(b)) + Math.abs(Y(a) - Y(b));
  const near4 = (a, b) => man(a, b) === 1;
  // st codes (spec): eye 0 sleep 1 idle 2 lock 3 stun 4/5 rocks 6 dead; rhino adds 7 charge 8 bonk 9 return (1 = track, 2 = aim)
  const ST = {SLEEP: 0, IDLE: 1, AIM: 2, STUN: 3, ROCK_WAIT: 4, ROCK_TELE: 5, DEAD: 6, CHARGE: 7, BONK: 8, RETURN: 9};

  // ---- decode adv.state (the builder's encoding, per the room specs). ONE place to change if it differs. ----
  function decode(snap, map, kind) {
    const e3 = snap.enemies[3] || {pos: NONE, hpType: 0, state: 0};
    const v = {kind, map, st: snap.bossState & 15, phase2: (snap.bossState & 0x80) !== 0, hp: snap.bossHp,
      body: e3.pos, tgt: e3.hpType & 1, window: snap.bossWindow,
      heroes: snap.heroes.map(h => ({pos: h.pos, dir: h.dirAnim & 3})), rocks: (snap.rocks || []).filter(r => r !== NONE)};
    if (kind === "warden") {
      // 1-4 (existing code): body fixed on the map's B tiles; TELE marks bossTarget (+ enemies[0] hpType 0x2_ in phase 2)
      let b = -1; for (let t = 0; t < COLS * ROWS && b < 0; t++) if (map[Y(t)][X(t)] === "B") b = t;
      v.body = b; v.tgt = -1;
      v.centers = [snap.bossTarget].concat(snap.enemies.filter(e => e.pos !== NONE && (e.hpType >> 4) === 2).map(e => e.pos)).filter(t => t !== NONE);
    } else if (kind === "eye") { v.face = e3.state & 3; v.center = snap.bossTarget; }
    else { v.lane = e3.state & 15; v.rock = (e3.state & 16) !== 0; v.land = snap.bossTarget; }
    return v;
  }

  const chAt = (v, t) => v.map[Y(t)][X(t)];
  const bodyTiles = v => v.body === NONE || v.st === ST.DEAD ? [] : [v.body, v.body + 1, v.body + COLS, v.body + COLS + 1];
  // conservative: never path over '#', the current body, or the map's starting 'B' tiles (the judge sim does the same)
  const free = (v, t) => t >= 0 && chAt(v, t) !== "#" && chAt(v, t) !== "B" && !bodyTiles(v).includes(t);
  const distBoss = (v, t) => Math.min(...bodyTiles(v).map(b => man(b, t)));
  function idolFace(v, t, cur) {
    const bx = X(v.body), by = Y(v.body);
    const dx = 2 * X(t) + 1 - (2 * bx + 2), dy = 2 * Y(t) + 1 - (2 * by + 2);
    const h = dx > 0 ? 1 : 3, vv = dy > 0 ? 2 : 0;
    if (Math.abs(dx) > Math.abs(dy)) return h;
    if (Math.abs(dy) > Math.abs(dx)) return vv;
    return cur === h || cur === vv ? cur : vv;
  }
  function backTiles(v, f) {
    const x = X(v.body), y = Y(v.body);
    const c = f === 2 ? [[x, y - 1], [x + 1, y - 1]] : f === 0 ? [[x, y + 2], [x + 1, y + 2]] : f === 1 ? [[x - 1, y], [x - 1, y + 1]] : [[x + 2, y], [x + 2, y + 1]];
    return c.filter(([a, b]) => inRoom(a, b)).map(([a, b]) => tile(a, b));
  }
  function adjTiles(v) {
    const out = [], x = X(v.body), y = Y(v.body);
    for (const [ax, ay] of [[x - 1, y], [x - 1, y + 1], [x + 2, y], [x + 2, y + 1], [x, y - 1], [x + 1, y - 1], [x, y + 2], [x + 1, y + 2]])
      if (inRoom(ax, ay)) out.push(tile(ax, ay));
    return out;
  }
  const strikeTiles = v => (v.kind === "rhino" ? adjTiles(v) : backTiles(v, v.face)).filter(t => chAt(v, t) !== "#");
  function danger(v) {
    const out = new Set(v.rocks);
    if (v.kind === "rhino" && (v.st === ST.AIM || v.st === ST.CHARGE) && v.land !== NONE) {
      for (let y = Y(v.body); y <= Y(v.land) + 1 && y < ROWS; y++) { out.add(tile(v.lane, y)); if (v.lane + 1 < COLS) out.add(tile(v.lane + 1, y)); }
    }
    if (v.kind === "warden" && v.st === ST.AIM) for (const c of v.centers) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inRoom(X(c) + dx, Y(c) + dy)) out.add(tile(X(c) + dx, Y(c) + dy));
    }
    if (v.kind === "eye" && v.st === ST.AIM && v.center !== NONE) {
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (inRoom(X(v.center) + dx, Y(v.center) + dy)) out.add(tile(X(v.center) + dx, Y(v.center) + dy));
    }
    return out;
  }
  // first step (0..3) of a shortest path to goal, -2 already there, -1 none
  function bfs(v, p, goal, avoid) {
    const start = v.heroes[p].pos, other = v.heroes[1 - p].pos;
    if (goal(start)) return -2;
    const prev = new Map([[start, -1]]), q = [start];
    while (q.length) {
      const t = q.shift();
      for (let d = 0; d < 4; d++) {
        const n = stepTile(t, d);
        if (n < 0 || prev.has(n) || !free(v, n) || n === other || (avoid(n) && !goal(n))) continue;
        prev.set(n, t);
        if (goal(n)) { let k = n; while (prev.get(k) !== start) k = prev.get(k); for (let dd = 0; dd < 4; dd++) if (stepTile(start, dd) === k) return dd; }
        q.push(n);
      }
    }
    return -1;
  }
  const rockCols = v => { const out = []; for (let x = 0; x < COLS; x++) if (chAt(v, tile(x, ROWS - 1)) === "#") out.push(x); return out; };

  function rhino(v, p, mem) {
    const h = v.heroes[p], dz = danger(v), avoid = t => dz.has(t);
    const go = goal => { const d = bfs(v, p, goal, avoid); return d >= 0 ? {d} : {}; };
    if (v.st === ST.DEAD || v.st === ST.SLEEP) return {};
    if (dz.has(h.pos)) { const d = bfs(v, p, t => !dz.has(t), () => false); return d >= 0 ? {d} : {}; }
    if (v.st === ST.STUN && p !== v.tgt) {
      const st = strikeTiles(v);
      if (st.includes(h.pos)) return {strike: true};
      return go(t => st.includes(t));
    }
    const rcs = rockCols(v);
    if (p === v.tgt) {
      if (v.st === ST.IDLE) {
        const good = t => rcs.includes(X(t)) && Y(t) >= 2 && Y(t) <= 5;
        if (good(h.pos)) return {};
        if (!rcs.includes(X(h.pos))) {
          const want = rcs.slice().sort((a, c) => Math.abs(a - X(h.pos)) - Math.abs(c - X(h.pos)))[0];
          const d = want > X(h.pos) ? 1 : 3, n = stepTile(h.pos, d);
          if (n >= 0 && free(v, n) && n !== v.heroes[1 - p].pos && !dz.has(n)) return {d};
        }
        return go(good);
      }
      return {};
    }
    if (v.st === ST.IDLE || v.st === ST.AIM || v.st === ST.CHARGE) {
      const tx = X(v.heroes[v.tgt].pos), rc = rcs.slice().sort((a, c) => Math.abs(a - tx) - Math.abs(c - tx))[0];
      const wait = [[rc - 2, 6], [rc + 2, 6], [rc - 2, 5], [rc + 2, 5]].filter(([x, y]) => inRoom(x, y)).map(([x, y]) => tile(x, y))
        .filter(t => free(v, t) && !dz.has(t));
      if (!wait.length) return {};
      const w = wait.sort((a, c) => man(a, h.pos) - man(c, h.pos))[0];
      return h.pos === w ? {} : go(t => t === w);
    }
    return {};
  }

  function eye(v, p, mem) {
    const h = v.heroes[p], dz = danger(v), avoid = t => dz.has(t);
    const go = goal => { const d = bfs(v, p, goal, avoid); return d >= 0 ? {d} : {}; };
    if (v.st === ST.DEAD || v.st === ST.SLEEP) return {};
    if (dz.has(h.pos)) {
      // the bait dodges along the facing axis, away from the body, so the facing does not flip
      const d = bfs(v, p, t => !dz.has(t) && (p !== v.tgt || idolFace(v, t, v.face) === v.face), () => false);
      return d >= 0 ? {d} : {};
    }
    if (v.st === ST.STUN && p !== v.tgt) {
      const st = strikeTiles(v);
      if (st.includes(h.pos)) return {strike: true};
      return go(t => st.includes(t));
    }
    if (v.st === ST.STUN) return {};                  // the bait holds still
    if (v.st === ST.IDLE) {
      if (p === v.tgt) {
        const spots = [tile(4, 6), tile(5, 6), tile(4, 1), tile(5, 1), tile(2, 3), tile(7, 4)];
        const sp = spots.filter(t => free(v, t) && t !== v.heroes[1 - p].pos).sort((a, c) => man(a, h.pos) - man(c, h.pos))[0];
        return sp == null || h.pos === sp ? {} : go(t => t === sp);
      }
      const bt = v.heroes[1 - p].pos, f = idolFace(v, bt, v.face), back = backTiles(v, f);
      const cand = [];
      for (let t = 0; t < COLS * ROWS; t++) if (free(v, t) && t !== bt && distBoss(v, t) > distBoss(v, bt) && distBoss(v, t) <= 3) {
        if (back.some(k => near4(k, t)) && !back.includes(t)) cand.push(t);
      }
      const w = cand.sort((a, c) => man(a, h.pos) - man(c, h.pos))[0];
      return w == null || h.pos === w ? {} : go(t => t === w);
    }
    return {};
  }

  // 1-4 WARDEN (proves the key / core-strike layer on today's site): dodge, strike from any side while stunned
  // (both may: combo), else wait at a home tile. mem.struck = the stun window this pet already struck in.
  function warden(v, p, mem) {
    const h = v.heroes[p], dz = danger(v), avoid = t => dz.has(t);
    const go = goal => { const d = bfs(v, p, goal, avoid); return d >= 0 ? {d} : {}; };
    if (v.st === ST.DEAD || v.st === ST.SLEEP) return {};
    if (dz.has(h.pos)) { const d = bfs(v, p, t => !dz.has(t), () => false); return d >= 0 ? {d} : {}; }
    if (v.st === ST.STUN && mem.struck !== v.window) {
      const st = adjTiles(v);
      if (st.includes(h.pos)) return {strike: true};
      return go(t => st.includes(t));
    }
    const home = p === 0 ? tile(3, 3) : tile(6, 3);
    return h.pos === home ? {} : go(t => t === home);
  }
  const policy = (v, p, mem) => (v.kind === "rhino" ? rhino(v, p, mem || {}) : v.kind === "warden" ? warden(v, p, mem || {}) : eye(v, p, mem || {}));
  const api = {decode, policy, danger, strikeTiles, ST, NONE};
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.BOSS_POLICY = api;
})(typeof window !== "undefined" ? window : globalThis);
