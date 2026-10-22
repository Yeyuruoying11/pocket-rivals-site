// Pocket Rivals: the three attack trials, one per pet (pocket-rivals
// docs/attack-trial.md §2-§2C). Pure functions, no DOM and no timers, shared
// by the battle prototype (battle.js, index.html), the handheld simulator
// (device-core.js / mode-battle.js, device.html) and Node (tests, fairness
// runs): window.PetTrials in a page, module.exports in Node.
//
//   band     trial.c: the moving band, the three stages and the score (§2).
//            Ember follows it with the pressure pad (or hold A without a pad),
//            Tide with the tilt pointer and a wider band (§2A).
//   tilt     input_map.c tilt_level_step(): accelerometer x (mg) -> pointer,
//            integers only, Math.trunc where C divides (§2A)
//   beat     beat.c: Sprout's beat table, tap judging and score (§2B)
//   models   the §2C bot models (first-time / skilled player per trial),
//            used by the simulator's battle bot and by fairness()
//   fairness run every model over many seeds -> p10 / median / p90, the
//            share >= 50 / >= 80 and the top-5 share per pet (§2C)
//
// Times are whole ms from the trial start (the ready phase included), like
// the firmware. Parameters come in the battle prototype's key names
// (DEVICE.battleParams() / battle.js P), so one object drives all three.
(function (root) {
  "use strict";

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  // round(inside * 100 / scored), half up, in integers; 0 with nothing scored (trial.c pct())
  const pct = (inside, scored) => scored ? Math.floor((inside * 200 + scored) / (scored * 2)) : 0;
  const sum = a => a.reduce((x, y) => x + y, 0);

  // game_config.h defaults of the per-pet trials (§7), prototype key names.
  // Tuned with fairness() (§2C): the spec's first draft was TIDE_BAND_PCT 28,
  // BEAT_PERFECT_MS 40, BEAT_GOOD_MS 90, BEAT_GOOD_PTS 60
  const DEFAULTS = Object.freeze({
    tideBandPct: 34, tiltFullMg: 500, tiltSmoothPct: 50, tiltSampleMs: 20, tiltStaleMs: 200,
    beatStage1Ms: 500, beatStage2Ms: 375, beatStage3Ms: 300, beatRests: 1,
    beatPerfectMs: 20, beatGoodMs: 130, beatGoodPts: 65, beatStrayPts: 50, beatLanePxPerS: 100,
  });
  const CTL_EVENT_MAX_AGE_MS = 100;   // controls_config.h: the oldest edge controls still trusts
  const KINDS = ["pad", "tilt", "beat"];   // pet index (ember, tide, sprout) -> its own trial

  /* ================= band (trial.c, §2) ================= */

  // cfg = {readyMs, stageMs, stages, bandPct, speeds}; the simulator's
  // DEVICE.trial is this object
  const band = {
    // cfg from battle params; w = the band width of this trial (Ember / hold A:
    // bandPct, Tide tilting: tideBandPct)
    cfgFrom: (P, w) => ({readyMs: P.readyMs, stageMs: P.stageMs, stages: 3, bandPct: w == null ? P.bandPct : w,
      speeds: [P.speed1, P.speed2, P.speed3]}),
    endMs: cfg => cfg.readyMs + cfg.stages * cfg.stageMs,
    stageAt(t, cfg) {
      if (t < cfg.readyMs) return 0;
      return Math.min(Math.floor((t - cfg.readyMs) / cfg.stageMs), cfg.stages - 1);
    },
    tau100(t, cfg) {
      const Rm = cfg.readyMs, S = cfg.stageMs, s = cfg.speeds, n = cfg.stages;
      if (t < Rm) return t * s[0];
      const u = Math.min(t - Rm, n * S);
      const k = Math.min(Math.floor(u / S), n - 1);
      let v = Rm * s[0];
      for (let j = 0; j < k; j++) v += S * s[j];
      return v + (u - k * S) * s[k];
    },
    bandCenter(seed, t, cfg) {
      const twoPi = 2 * Math.PI;
      const half = cfg.bandPct / 2;
      const tau = band.tau100(t, cfg) / 100;
      const p1 = seed * twoPi / 256;
      const p2 = (seed * 7 % 256) * twoPi / 256;
      let c = 50 + 22 * Math.sin(twoPi * tau / 1300 + p1) + 12 * Math.sin(twoPi * tau / 700 + p2);
      if (c < half) c = half;
      if (c > 100 - half) c = 100 - half;
      return Math.floor(c + 0.5);
    },
    inBand: (level, center, cfg) => 2 * Math.abs(level - center) <= cfg.bandPct,
    create(seed, cfg, now) {
      return {seed: seed & 0xff, cfg, start: now, elapsed: 0, phase: 0, level: 0,
        center: band.bandCenter(seed & 0xff, 0, cfg), inside: false,
        scored: new Array(cfg.stages).fill(0), insideMs: new Array(cfg.stages).fill(0)};
    },
    // -> true on the one call that finishes the trial
    update(T, level, now) {
      if (T.phase === 2) return false;
      const cfg = T.cfg, end = band.endMs(cfg);
      let e = Math.min(now - T.start, end);
      if (e < T.elapsed) e = T.elapsed;
      const prev = T.elapsed;
      T.elapsed = e;
      T.level = clamp(Math.round(level), 0, 100);
      T.center = band.bandCenter(T.seed, e, cfg);
      T.inside = band.inBand(T.level, T.center, cfg);
      for (let k = 0; k < cfg.stages; k++) {
        const lo = cfg.readyMs + k * cfg.stageMs, hi = lo + cfg.stageMs;
        const from = Math.max(prev, lo), to = Math.min(e, hi);
        if (to > from) { T.scored[k] += to - from; if (T.inside) T.insideMs[k] += to - from; }
      }
      if (e >= end) { T.phase = 2; return true; }
      T.phase = e >= cfg.readyMs ? 1 : 0;
      return false;
    },
    pct,
    score: T => pct(sum(T.insideMs), sum(T.scored)),
    stageScore: (T, k) => k >= 0 && k < T.cfg.stages ? pct(T.insideMs[k], T.scored[k]) : 0,
    stage: T => band.stageAt(T.elapsed, T.cfg),
    done: T => T.phase === 2,
    ready: T => T.phase === 0,      // still in the ready phase
    defaults: null,                 // filled by device-core.js (its C constants)
  };

  /* ================= tilt (input_map.c, §2A) ================= */

  const tilt = {
    // ax (mg, handheld frame, + = right side down) -> pointer x 1000, 0..100000
    target(ax, F) {
      const v = clamp(ax + F, 0, 2 * F);
      return Math.trunc(v * 100000 / (2 * F));
    },
    // one accelerometer sample through the filter; first = the sample the
    // trial starts from (no slide in from 0). C truncates toward 0: Math.trunc
    step(levelM, ax, first, F, smoothPct) {
      const t = tilt.target(ax, F);
      if (first) return t;
      return levelM + Math.trunc((t - levelM) * smoothPct / 100);
    },
    level: levelM => Math.floor((levelM + 500) / 1000),     // levelM >= 0, like controls_level()
    // pointer 0..100 -> the x reading that puts it there (bots, keys)
    mgFor: (level, F) => Math.round(level * 2 * F / 100 - F),
    // the chip: 10 bit at +-2 g = 4 mg steps
    quantize: mg => clamp(Math.round(mg / 4) * 4, -2000, 2000),
  };

  /* ================= beat (beat.c, §2B) ================= */

  const beat = {
    cfgFrom: P => ({readyMs: P.readyMs, stageMs: P.stageMs, intervals: [P.beatStage1Ms, P.beatStage2Ms, P.beatStage3Ms],
      rests: P.beatRests ? 1 : 0, perfectMs: P.beatPerfectMs, goodMs: P.beatGoodMs, goodPts: P.beatGoodPts,
      strayPts: P.beatStrayPts, lanePxPerS: P.beatLanePxPerS}),
    endMs: cfg => cfg.readyMs + 3 * cfg.stageMs,
    // §2B timing rules; [] = fine (the prototype's sliders show the rest in red)
    check(cfg) {
      const bad = [], I = cfg.intervals, n = I.map(i => Math.floor(cfg.stageMs / i));
      if (!(cfg.goodMs < Math.min(...I) / 2)) bad.push("goodWindow");
      if (cfg.perfectMs > cfg.goodMs) bad.push("perfectWindow");
      if (cfg.rests && (n[1] < 2 || n[2] < 2)) bad.push("rests");
      if (n.some(x => x < 1)) bad.push("notes");
      const s = beat.schedule(0, cfg), last = s.notes.filter(x => !x.rest).pop();
      if (last && last.b + cfg.goodMs + CTL_EVENT_MAX_AGE_MS > beat.endMs(cfg)) bad.push("lastNote");
      if (!(cfg.readyMs > cfg.goodMs)) bad.push("ready");
      return bad;
    },
    // Beat table from the seed: slots {b, k, j, rest}, count-in clicks, notes per stage
    schedule(seed, cfg) {
      seed &= 0xff;
      const R = cfg.readyMs, S = cfg.stageMs, I = cfg.intervals;
      const slots = [], perStage = [0, 0, 0];
      for (let k = 0; k < 3; k++) {
        const n = Math.max(0, Math.floor(S / I[k]));
        let r = -1;
        if (cfg.rests && k === 1 && n >= 2) r = 1 + seed % (n - 1);
        if (cfg.rests && k === 2 && n >= 2) r = 1 + Math.floor(seed / 16) % (n - 1);
        for (let j = 0; j < n; j++) {
          const rest = j === r;
          slots.push({b: R + k * S + j * I[k], k, j, rest});
          if (!rest) perStage[k]++;
        }
      }
      const counts = [];
      for (let m = 1; R - m * I[0] >= 0; m++) counts.unshift(R - m * I[0]);
      return {slots, notes: slots.filter(s => !s.rest), counts, perStage};
    },
    create(seed, cfg, start) {
      const sc = beat.schedule(seed, cfg);
      return {seed: seed & 0xff, cfg, start, sc, elapsed: 0, phase: 0,
        res: sc.notes.map(() => null),          // per note: null (open) | "perfect" | "good" | "miss"
        pts: sc.notes.map(() => 0), extra: [0, 0, 0], taps: [], lastTap: -1e9};
    },
    // Note index the stray tap at e counts against: nearest note, ties to the earlier
    nearest(B, e) {
      let best = -1, bd = Infinity;
      B.sc.notes.forEach((nt, i) => { const d = Math.abs(e - nt.b); if (d < bd) { bd = d; best = i; } });
      return best;
    },
    // A press edge at e ms (taps must come in time order) ->
    // {kind: "ignored" | "perfect" | "good" | "stray", i (note), k (stage), d (e - b)}
    tap(B, e) {
      const cfg = B.cfg;
      if (B.phase === 2 || e <= 0 || e < cfg.readyMs - cfg.goodMs || e >= beat.endMs(cfg)) return {kind: "ignored"};
      B.taps.push(e);
      B.lastTap = e;
      const notes = B.sc.notes;
      for (let i = 0; i < notes.length; i++) {
        if (B.res[i] === "perfect" || B.res[i] === "good") continue;
        const d = e - notes[i].b;
        if (Math.abs(d) > cfg.goodMs) continue;
        const perfect = Math.abs(d) <= cfg.perfectMs;
        B.res[i] = perfect ? "perfect" : "good";
        B.pts[i] = perfect ? 100 : cfg.goodPts;
        return {kind: B.res[i], i, k: notes[i].k, d};
      }
      const i = beat.nearest(B, e), k = i >= 0 ? notes[i].k : 0;
      B.extra[k]++;
      return {kind: "stray", i, k, d: i >= 0 ? e - notes[i].b : 0};
    },
    // Notes whose window closed (plus the 100 ms an edge may still be on its
    // way, §2B) without a hit are missed. Returns the notes it just closed.
    update(B, e) {
      if (B.phase === 2) return [];
      if (e > B.elapsed) B.elapsed = e;
      const closed = [];
      B.sc.notes.forEach((nt, i) => {
        if (B.res[i] === null && B.elapsed >= nt.b + B.cfg.goodMs + CTL_EVENT_MAX_AGE_MS) { B.res[i] = "miss"; closed.push(i); }
      });
      B.phase = B.elapsed >= B.cfg.readyMs ? 1 : 0;
      return closed;
    },
    // End of the trial (at R + 3S): every open note is missed, taps stop counting
    finish(B) {
      B.res = B.res.map(r => r === null ? "miss" : r);
      B.elapsed = Math.max(B.elapsed, beat.endMs(B.cfg));
      B.phase = 2;
    },
    done: B => B.phase === 2,
    ready: B => B.elapsed < B.cfg.readyMs,
    stage: B => B.elapsed < B.cfg.readyMs ? 0 : Math.min(Math.floor((B.elapsed - B.cfg.readyMs) / B.cfg.stageMs), 2),
    // stage k: points after stray presses (each miss of the stage forgives one)
    stagePts(B, k) {
      let hit = 0, miss = 0;
      B.sc.notes.forEach((nt, i) => { if (nt.k !== k) return; hit += B.pts[i]; if (B.res[i] === "miss") miss++; });
      return Math.max(0, hit - B.cfg.strayPts * Math.max(0, B.extra[k] - miss));
    },
    stageScore: (B, k) => pct(beat.stagePts(B, k), 100 * B.sc.perStage[k]),
    score: B => pct([0, 1, 2].reduce((a, k) => a + beat.stagePts(B, k), 0), 100 * sum(B.sc.perStage)),
    // the screen's "this stage so far": only judged notes count; null = none judged yet
    stageLive(B, k) {
      let judged = 0;
      B.sc.notes.forEach((nt, i) => { if (nt.k === k && B.res[i] !== null) judged++; });
      return judged ? pct(beat.stagePts(B, k), 100 * judged) : null;
    },
    // Sounds of the trial, in time order: {t, id} (beat_count / beat_accent / beat_tick)
    cues(B) {
      const out = B.sc.counts.map(t => ({t, id: "beat_count"}));
      for (const nt of B.sc.notes) out.push({t: nt.b, id: nt.j === 0 ? "beat_accent" : "beat_tick"});
      return out.sort((a, b) => a.t - b.t);
    },
  };

  /* ================= bot models (§2C) ================= */

  // first = a first-time player, good = a skilled one
  const MODELS = Object.freeze({
    pad: {first: {lagMs: 150, sd: 7, redrawMs: 300, tauMs: 80}, good: {lagMs: 60, sd: 3, redrawMs: 300, tauMs: 60}},
    tilt: {first: {lagMs: 180, sd: 7, redrawMs: 300, tauMs: 130, jitterMg: 15}, good: {lagMs: 80, sd: 3, redrawMs: 300, tauMs: 100, jitterMg: 8}},
    beat: {first: {mu: 35, sd: 65, forget: 0.08, rest: 0.40, stray: 0.40}, good: {mu: 0, sd: 28, forget: 0.02, rest: 0.05, stray: 0.05}},
    hold: {first: {sloppy: [6, 22, 45]}, good: {sloppy: [6]}},
  });

  // mulberry32 + Box-Muller, the seeded randoms of the fairness runs
  function rngOf(seed) {
    let a = seed >>> 0;
    const next = () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    return {float: next, int: n => Math.floor(next() * n)};
  }
  function normal(rng, mu = 0, sd = 1) {
    let u = rng.float();
    if (u < 1e-12) u = 1e-12;
    return mu + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng.float());
  }

  // A tracking player (pad or tilt model) that the caller steps in time:
  // aim(e) -> where the hand wants the pointer (0..100), hand(e) -> pointer
  // the hand is at after the first-order lag. Used by fairness() and the
  // simulator bot (with its own rng).
  function tracker(model, rng, centerAt, start = 0) {
    const s = {err: normal(rng, 0, model.sd), errAt: 0, pos: start, at: 0};
    return {
      aim(e) {
        if (e - s.errAt >= model.redrawMs) { s.errAt = e; s.err = normal(rng, 0, model.sd); }
        return centerAt(Math.max(0, e - model.lagMs)) + s.err;
      },
      // advance the hand to e (ms), returns its position (pointer units)
      hand(e) {
        const dt = e - s.at;
        if (dt > 0) { s.pos += (this.aim(e) - s.pos) * (1 - Math.exp(-dt / model.tauMs)); s.at = e; }
        return s.pos;
      },
    };
  }

  // Press times (ms from the trial start) of the beat model for one trial
  function beatPresses(B, model, rng) {
    const out = [];
    for (const sl of B.sc.slots) {
      if (sl.rest ? rng.float() >= model.rest : rng.float() < model.forget) continue;
      out.push(Math.round(sl.b + normal(rng, model.mu, model.sd)));
    }
    for (let k = 0; k < 3; k++) {
      if (rng.float() < model.stray) out.push(B.cfg.readyMs + k * B.cfg.stageMs + rng.int(B.cfg.stageMs));
    }
    return out.sort((a, b) => a - b);
  }

  // One trial played by a model -> {score, stages}. kind: pad | tilt | beat | hold;
  // skill: first | good; seed 0..255 (the band / beat seed); rng: the player's randomness
  const STEP_MS = 2;   // the simulator's tick
  function play(kind, skill, P, seed, rng) {
    const model = MODELS[kind][skill];
    if (kind === "beat") {
      const cfg = beat.cfgFrom(P), B = beat.create(seed, cfg, 0);
      for (const e of beatPresses(B, model, rng)) { beat.update(B, e); beat.tap(B, e); }
      beat.finish(B);
      return {score: beat.score(B), stages: [0, 1, 2].map(k => beat.stageScore(B, k))};
    }
    const cfg = band.cfgFrom(P, kind === "tilt" ? P.tideBandPct : P.bandPct);
    const T = band.create(seed, cfg, 0), end = band.endMs(cfg);
    const centerAt = e => band.bandCenter(T.seed, e, cfg);
    if (kind === "hold") {
      const sloppy = model.sloppy[rng.int(model.sloppy.length)];
      let milli = 0, held = true, aim = 0, aimAt = -1e9;
      for (let e = 0; ; e += STEP_MS) {
        milli = held ? Math.min(100000, milli + P.risePerS * STEP_MS) : Math.max(0, milli - P.fallPerS * STEP_MS);
        if (band.update(T, Math.floor((milli + 500) / 1000), e)) break;
        if (e - aimAt > 300) { aimAt = e; aim = rng.int(2 * sloppy + 1) - sloppy; }
        held = T.level < T.center + aim;
      }
    } else if (kind === "pad") {
      const tr = tracker(model, rng, centerAt, 0);
      for (let e = 0; ; e += STEP_MS) if (band.update(T, clamp(Math.round(tr.hand(e)), 0, 100), e)) break;
    } else {
      const F = P.tiltFullMg, tr = tracker(model, rng, centerAt, 50);
      const sampleMs = P.tiltSampleMs || 20;
      let levelM = tilt.step(0, tilt.quantize(tilt.mgFor(50, F)), true, F, P.tiltSmoothPct);
      for (let e = 0; ; e += STEP_MS) {
        const pos = tr.hand(e);
        if (e > 0 && e % sampleMs === 0) {
          const ax = tilt.quantize(tilt.mgFor(pos, F) + normal(rng, 0, model.jitterMg));
          levelM = tilt.step(levelM, ax, false, F, P.tiltSmoothPct);
        }
        if (band.update(T, tilt.level(levelM), e)) break;
      }
      if (T.elapsed < end) throw new Error("trial did not finish");
    }
    return {score: band.score(T), stages: [0, 1, 2].map(k => band.stageScore(T, k))};
  }

  /* ================= fairness (§2C) ================= */

  const quant = (sorted, q) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];
  function stats(scores) {
    const s = scores.slice().sort((a, b) => a - b), n = s.length;
    return {n, p10: quant(s, 0.1), median: quant(s, 0.5), p90: quant(s, 0.9), max: s[n - 1],
      mean: Math.round(sum(s) / n * 10) / 10,
      ge50: Math.round(s.filter(x => x >= 50).length / n * 1000) / 10, ge80: Math.round(s.filter(x => x >= 80).length / n * 1000) / 10,
      eq100: Math.round(s.filter(x => x >= 100).length / n * 1000) / 10};
  }
  const PET_KINDS = [["ember", "pad"], ["tide", "tilt"], ["sprout", "beat"]];

  // -> {rows: [{pet, kind, skill, ...stats}], top5: {ember, tide, sprout} (share of
  // the top-5 places, %), checks: [{what, ok, detail}]}.
  // o.seeds: trials per bot (§2C: 400); o.games: skilled games per pet for the
  // top-5 count (1000), played as days of o.perDay games per pet (10) whose
  // board keeps the 5 best (ties: a coin flip)
  function fairness(P, o = {}) {
    const seeds = o.seeds || 400, games = o.games == null ? 1000 : o.games, perDay = o.perDay || 10;
    const base = o.rngSeed == null ? 20261022 : o.rngSeed;
    const rows = [], byKey = {};
    PET_KINDS.forEach(([pet, kind], pi) => {
      for (const skill of ["first", "good"]) {
        const rng = rngOf(base + pi * 7919 + (skill === "good" ? 104729 : 0));
        const scores = [];
        for (let i = 0; i < seeds; i++) scores.push(play(kind, skill, P, i % 256, rng).score);
        const r = Object.assign({pet, kind, skill}, stats(scores));
        rows.push(r);
        byKey[pet + "." + skill] = r;
      }
    });
    const top5 = {ember: 0, tide: 0, sprout: 0};
    if (games > 0) {
      const rng = rngOf(base + 31337), days = Math.max(1, Math.round(games / perDay));
      const seedRng = rngOf(base + 4242);
      for (let d = 0; d < days; d++) {
        const day = [];
        for (const [pet, kind] of PET_KINDS) {
          for (let g = 0; g < perDay; g++) day.push({pet, score: play(kind, "good", P, seedRng.int(256), rng).score, tie: rng.float()});
        }
        day.sort((a, b) => b.score - a.score || a.tie - b.tie);
        day.slice(0, 5).forEach(x => top5[x.pet]++);
      }
      for (const k of Object.keys(top5)) top5[k] = Math.round(top5[k] / (days * 5) * 1000) / 10;
    }
    // §2C targets
    const checks = [];
    for (const [pet] of PET_KINDS) {
      const f = byKey[pet + ".first"], g = byKey[pet + ".good"];
      checks.push({what: pet + " first median 50-60", ok: f.median >= 50 && f.median <= 60, detail: f.median});
      checks.push({what: pet + " first >= 80 at most 10%", ok: f.ge80 <= 10, detail: f.ge80});
      checks.push({what: pet + " skilled median 80-90", ok: g.median >= 80 && g.median <= 90, detail: g.median});
      checks.push({what: pet + " skilled >= 80 at least half", ok: g.ge80 >= 50, detail: g.ge80});
      checks.push({what: pet + " skilled p90 under 100", ok: g.p90 < 100, detail: g.p90});
    }
    for (const skill of ["first", "good"]) {
      const ms = PET_KINDS.map(([pet]) => byKey[pet + "." + skill].median), ps = PET_KINDS.map(([pet]) => byKey[pet + "." + skill].p90);
      checks.push({what: skill + " medians within 5", ok: Math.max(...ms) - Math.min(...ms) <= 5, detail: ms.join("/")});
      checks.push({what: skill + " p90 within 5", ok: Math.max(...ps) - Math.min(...ps) <= 5, detail: ps.join("/")});
    }
    return {rows, top5, checks, seeds, games};
  }

  const api = {DEFAULTS, KINDS, CTL_EVENT_MAX_AGE_MS, MODELS, clamp, pct, band, tilt, beat, rngOf, normal, tracker, beatPresses, play, stats, fairness};
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PetTrials = api;
})(typeof window !== "undefined" ? window : this);
