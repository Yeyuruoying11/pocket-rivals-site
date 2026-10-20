// Pocket Rivals battle prototype: teams of 3, secret send-out, attack trial
// (track the moving band), chained blocks, skills, type matchups. Follows
// pocket-rivals/docs/attack-trial.md and the firmware rules in software/lib
// (integer math and rounding included) so numbers tuned here behave the same
// after they go into game_config.h.

(() => {
  const $ = s => document.querySelector(s);
  const store = window.PR.store;

  // Same names, defaults, order and comments as software/lib/game_config.h, so
  // the exported block can replace that file. Entries without min/max are
  // exported but not tuned here.
  const PARAMS = [
    {key: "base",       c: "BASE_DAMAGE",        g: "攻击测试", label: "基础伤害（测试 0 分）",        min: 4,   max: 20,   step: 1,   def: 10,   unit: "",    note: "attack damage at trial score 0"},
    {key: "windowPct",  c: "DEFEND_WINDOW_PCT",  g: "连续格挡", label: "判定区宽度（普通一击）",       min: 8,   max: 50,   step: 1,   def: 24,   unit: "%",   note: "width of the block zone at tier 0, % of the sweep"},
    {key: "sweepMs",    c: "DEFEND_SWEEP_MS",    g: "连续格挡", label: "扫过时间（普通一击）",         min: 500, max: 2500, step: 100, def: 1100, unit: " ms", note: "time for the cursor to cross the bar at tier 0"},
    {key: "hp",         c: "START_HP",           g: "节奏", label: "每只宠物 HP（下一局生效）",     min: 20,  max: 200,  step: 5,   def: 60,   unit: "",    note: "HP of each pet (TEAM_SIZE pets per player)"},
    {key: "skillCd",    c: "SKILL_COOLDOWN",     g: "技能", label: "技能冷却（自己的回合数）",      min: 1,   max: 5,    step: 1,   def: 3,    unit: "",    note: "own turns before the skill is ready again"},
    {key: "burnDmg",    c: "BURN_DAMAGE",        g: "技能", label: "Ember 灼烧每回合伤害",          min: 0,   max: 15,   step: 1,   def: 5,    unit: "",    note: "Ember skill: damage per turn while burning", before: [""]},
    {key: "burnTurns",  c: "BURN_TURNS",         g: "技能", label: "灼烧持续回合",                  min: 0,   max: 5,    step: 1,   def: 2,    unit: ""},
    {key: "emberDmg",   c: "EMBER_SKILL_DAMAGE", g: "技能", label: "Ember 技能直接伤害",            min: 0,   max: 25,   step: 1,   def: 8,    unit: ""},
    {key: "tideHeal",   c: "TIDE_HEAL",          g: "技能", label: "Tide 回复量",                   min: 0,   max: 40,   step: 1,   def: 12,   unit: "",    note: "Tide skill: heal and shield the next hit"},
    {key: "drain",      c: "SPROUT_DRAIN",       g: "技能", label: "Sprout 汲取（伤害 = 回复）",    min: 0,   max: 25,   step: 1,   def: 6,    unit: "",    note: "Sprout skill: deal this much, heal as much"},
    {key: "perfectPct", c: "BLOCK_PERFECT_PCT",  g: "连续格挡", label: "完美格挡后承受伤害",           min: 0,   max: 100,  step: 5,   def: 20,   unit: "%",   note: "damage taken on a perfect block", before: [""]},
    {key: "goodPct",    c: "BLOCK_GOOD_PCT",     g: "连续格挡", label: "普通格挡后承受伤害",           min: 0,   max: 100,  step: 5,   def: 50,   unit: "%"},
    {key: "shieldPct",  c: "SHIELD_PCT",         g: "技能", label: "护盾后承受伤害",                min: 0,   max: 100,  step: 5,   def: 50,   unit: "%"},
    {key: "strongPct",  c: "TYPE_STRONG_PCT",    g: "属性", label: "属性克制伤害（效果拔群）",      min: 100, max: 250,  step: 10,  def: 150,  unit: "%",   note: "fire > grass > water > fire"},
    {key: "weakPct",    c: "TYPE_WEAK_PCT",      g: "属性", label: "被克制伤害（效果一般）",        min: 30,  max: 100,  step: 5,   def: 70,   unit: "%"},
    // The new block uses a wider name column, like the file
    {key: "trialBonus", c: "TRIAL_BONUS",         w: 20, g: "攻击测试", label: "测试满分额外伤害",       min: 0,   max: 40,   step: 1,   def: 20,   unit: "",    note: "extra damage at trial score 100", before: ["", "// Attack trial + chained blocks (docs/attack-trial.md)"]},
    {key: "maxDmg",     c: "ATTACK_MAX_DAMAGE",   w: 20, g: "攻击测试", label: "一次攻击伤害上限（属性克制之后）", min: 10, max: 60, step: 1, def: 30, unit: "",    note: "cap on one attack after the type bonus (half a pet's HP)"},
    {key: "stageMs",    c: "TRIAL_STAGE_MS",      w: 20, g: "攻击测试", label: "每层计分时长（共 3 层）", min: 500, max: 3000, step: 100, def: 1500, unit: " ms", note: "scored time of each of the 3 stages"},
    {key: "speed1",     c: "TRIAL_STAGE1_SPEED_PCT", w: 20, g: "攻击测试", label: "第 1 层光带速度（含准备）", min: 10, max: 200, step: 5, def: 35, unit: "%",   note: "band speed in the ready phase and stage 1, % of full"},
    {key: "speed2",     c: "TRIAL_STAGE2_SPEED_PCT", w: 20, g: "攻击测试", label: "第 2 层光带速度",      min: 10, max: 200, step: 5,   def: 65,   unit: "%",   note: "band speed in stage 2"},
    {key: "speed3",     c: "TRIAL_STAGE3_SPEED_PCT", w: 20, g: "攻击测试", label: "第 3 层光带速度",      min: 10, max: 200, step: 5,   def: 100,  unit: "%",   note: "band speed in stage 3"},
    {key: "readyMs",    c: "TRIAL_READY_MS",      w: 20, g: "攻击测试", label: "准备时间（光带先动，不计分）", min: 0, max: 1500, step: 100, def: 600, unit: " ms", note: "band moves this long before scoring starts"},
    {key: "bandPct",    c: "TRIAL_BAND_PCT",      w: 20, g: "攻击测试", label: "光带宽度",               min: 8,   max: 50,   step: 1,   def: 24,   unit: "",    note: "band width on the 0..100 level scale"},
    {key: "risePerS",   c: "TRIAL_RISE_PER_S",    w: 20, g: "攻击测试", label: "按住时指针每秒上升",     min: 40,  max: 400,  step: 10,  def: 140,  unit: "",    note: "no pressure pad: level rise per second holding A"},
    {key: "fallPerS",   c: "TRIAL_FALL_PER_S",    w: 20, g: "攻击测试", label: "松开时指针每秒下降",     min: 40,  max: 400,  step: 10,  def: 140,  unit: "",    note: "                 level fall per second released"},
    {key: "tierStrong", c: "TIER_STRONG_SCORE",   w: 20, g: "等级", label: "强力一击所需分数（2 次格挡）", min: 10, max: 95,  step: 5,   def: 50,   unit: " 分", note: "score for a strong attack (2 blocks)"},
    {key: "tierUlt",    c: "TIER_ULTIMATE_SCORE", w: 20, g: "等级", label: "全力一击所需分数（3 次格挡）", min: 15, max: 100, step: 5,   def: 80,   unit: " 分", note: "score for a full-power attack (3 blocks)"},
    {key: "narrowPct",  c: "DEFEND_NARROW_PCT",   w: 20, g: "连续格挡", label: "每升一级判定区变窄",     min: 0,   max: 30,   step: 5,   def: 20,   unit: "%",   note: "block zone narrower per tier, %"},
    {key: "speedupPct", c: "DEFEND_SPEEDUP_PCT",  w: 20, g: "连续格挡", label: "每升一级 / 每多一击扫描变快", min: 0, max: 20,  step: 1,   def: 12,   unit: "%",   note: "sweep faster per tier and per extra block, %"},
    {key: "gapMs",      c: "DEFEND_GAP_MS",       w: 20, g: "连续格挡", label: "两次格挡之间的间隔",     min: 100, max: 1000, step: 50,  def: 350,  unit: " ms", note: "pause between chained blocks"},
    {key: "resolveMs",  c: "RESOLVE_MS",         g: "节奏", label: "每个事件停留时间",              min: 300, max: 2000, step: 100, def: 900,  unit: " ms", note: "how long each event stays on screen", before: [""]},
    {key: "graceMs",    c: "DEFEND_GRACE_MS",                                                                                         def: 1500, note: "central treats a silent defender as missing",
      note2: ["every block after the whole chain (all", "sweeps + gaps) + this"]},
  ];
  const GROUPS = ["攻击测试", "等级", "连续格挡", "技能", "属性", "节奏"];
  const TUNABLE = PARAMS.filter(p => p.min !== undefined);

  const TEAM_SIZE = 3;
  const PETS = [
    {name: "焰灵 Ember",  short: "Ember",  el: "fire",  type: "火", skill: "灼烧"},
    {name: "潮影 Tide",   short: "Tide",   el: "water", type: "水", skill: "潮汐护盾"},
    {name: "叶芽 Sprout", short: "Sprout", el: "grass", type: "草", skill: "汲取"},
  ];
  const PLAYERS = [
    // keys: 蓄力 / 第 1 只，防御 / 第 2 只，技能 / 第 3 只，换宠物 / 取消
    {name: "玩家 1", keys: ["A", "S", "D", "F"]},
    {name: "玩家 2", keys: ["J", "K", "L", ";"]},
  ];
  const BEATS = {fire: "grass", grass: "water", water: "fire"};
  // block_result_t order in protocol.h
  const MISS = 0, GOOD = 1, PERFECT = 2;
  const RESULT_TXT = ["没挡住", "挡住", "完美"];
  const RESULT_CLS = ["miss", "good", "perfect"];
  const TIER_NAMES = ["普通一击", "强力一击", "全力一击"];
  const DEFEND_MAX_HITS = 3;
  // Sprites: 10x10 pixel art, each row is a 5-pixel left half mirrored to the right
  const SPRITES = {
    fire:  ["...o.", "..olo", ".olff", "olfff", "ofhef", "offff", "offfm", "olfff", ".olff", "..ooo"],
    water: ["....o", "...ol", "..olf", ".olff", ".ohef", "offff", "offfm", "oflll", ".offl", "..ooo"],
    grass: [".ol..", ".oll.", "..olo", "..ooo", ".offf", "ofhef", "offff", "offfm", ".olll", "..ooo"],
  };
  const PALETTE = {
    fire:  {o: "#5a2a1c", f: "#e8663d", l: "#f6b04a", e: "#1c1c1e", h: "#ffffff", m: "#5a2a1c"},
    water: {o: "#163a5a", f: "#2f8fd6", l: "#9fd6f4", e: "#1c1c1e", h: "#ffffff", m: "#163a5a"},
    grass: {o: "#1f4a1a", f: "#4a9e3a", l: "#a8dc72", e: "#1c1c1e", h: "#ffffff", m: "#1f4a1a"},
  };

  function spriteSvg(el, cls = "sprite") {
    const rows = SPRITES[el].map(h => h + [...h].reverse().join(""));
    let rects = "";
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== ".") rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PALETTE[el][ch]}"/>`;
    }));
    return `<svg class="${cls}" viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  }

  /* ---------------- params ---------------- */

  // v4: TRIAL_MS replaced by the three trial stages, ATTACK_MAX_DAMAGE added
  const PARAM_KEY = "pr.params.v4";
  let P = {};
  try { P = JSON.parse(store.get(PARAM_KEY) || "{}") || {}; } catch { P = {}; }
  PARAMS.forEach(p => {
    const v = P[p.key];
    P[p.key] = typeof v === "number" && p.min !== undefined && v >= p.min && v <= p.max ? v : p.def;
  });

  function renderParams() {
    $("#params").innerHTML = GROUPS.map(g => `<div class="pgroup">${esc(g)}</div>` +
      TUNABLE.filter(p => p.g === g).map(p => `<label>
        <span>${esc(p.label)}<b id="pv-${p.key}">${P[p.key]}${p.unit}</b></span>
        <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${P[p.key]}" data-p="${p.key}">
        <code class="cname">${p.c}</code>
      </label>`).join("")).join("");
    renderCSnippet();
  }

  // Reproduces game_config.h line for line (with defaults it matches the file exactly)
  function cConfig() {
    const pad = " ".repeat(8 + 19 + 6);  // continuation comment column
    const lines = [
      "// Pocket Rivals tuning knobs",
      "//",
      "// Names match the battle prototype on the progress site, which can export",
      "// its sliders as these #defines. TRIAL_* (except TRIAL_BONUS) and",
      "// DEFEND_GAP_MS are timed on the player boards; the central board applies",
      "// everything else and sends each attack's zones and sweep times in the state.",
      "// See docs/attack-trial.md.",
      "",
      "#pragma once",
      "",
    ];
    PARAMS.forEach(p => {
      if (p.before) lines.push(...p.before);
      // The comment starts in its usual column; a long name eats into the
      // value's padding but keeps at least one space before "//"
      const w = p.w || 18, head = `#define ${p.c.padEnd(w)} ${P[p.key]}`;
      lines.push(p.note ? `${head.padEnd(Math.max(8 + w + 7, head.length + 1))}// ${p.note}` : head);
      (p.note2 || []).forEach(n => lines.push(`${pad}// ${n}`));
    });
    return lines.join("\n") + "\n";
  }

  function renderCSnippet() {
    $("#param-c").textContent = cConfig();
  }

  $("#params").addEventListener("input", e => {
    const k = e.target.dataset.p;
    if (!k) return;
    const def = PARAMS.find(p => p.key === k);
    P[k] = +e.target.value;
    $("#pv-" + k).textContent = P[k] + def.unit;
    store.set(PARAM_KEY, JSON.stringify(P));
    renderCSnippet();
    if (S) render();
  });
  $("#copy-c").addEventListener("click", () => window.PR.copyText($("#param-c").textContent));
  $("#reset-params").addEventListener("click", () => {
    PARAMS.forEach(p => P[p.key] = p.def);
    store.set(PARAM_KEY, JSON.stringify(P));
    renderParams();
    if (S) render();
    window.PR.toast("已恢复默认参数");
  });

  /* ---------------- formulas (docs/attack-trial.md, rules.c) ---------------- */

  const rulesScale = (amount, pct) => Math.floor((amount * pct + 50) / 100);

  // §2: the trial timeline. Ready phase [0, R), stage k scored in
  // [R + k*S, R + (k+1)*S), done at R + 3*S
  const stageSpeeds = () => [P.speed1, P.speed2, P.speed3];
  const trialEnd = () => P.readyMs + 3 * P.stageMs;
  // Stage running at ms t: -1 while getting ready, then 0..2
  const stageAt = t => t < P.readyMs ? -1 : Math.min(Math.floor((t - P.readyMs) / P.stageMs), 2);

  // Band time τ * 100 for integer ms t (the distance travelled at the stage
  // speeds), all in integers like the firmware
  function tau100(t) {
    const R = P.readyMs, St = P.stageMs, s = stageSpeeds();
    if (t < R) return t * s[0];
    const u = Math.min(t - R, 3 * St);
    const k = Math.min(Math.floor(u / St), 2);
    let v = R * s[0];
    for (let j = 0; j < k; j++) v += St * s[j];
    return v + (u - k * St) * s[k];
  }

  // §2: band center from seed and ms since the trial started (ready part
  // included); same double math as trial_band_center() in trial.c, with
  // τ = τ100 / 100.0 in place of t
  function bandCenter(seed, t, w = P.bandPct) {
    const half = w / 2;
    const twoPi = 2 * Math.PI;
    const tau = tau100(t) / 100;
    const p1 = seed * twoPi / 256;
    const p2 = (seed * 7 % 256) * twoPi / 256;
    const c = 50 + 22 * Math.sin(twoPi * tau / 1300 + p1) + 12 * Math.sin(twoPi * tau / 700 + p2);
    return Math.floor(Math.min(Math.max(c, half), 100 - half) + 0.5);
  }
  // trial_in_band(): |level - center| <= w/2, in integers
  const inBand = (center, level, w = P.bandPct) => 2 * Math.abs(level - center) <= w;

  // §3
  const tierOf = score => score < P.tierStrong ? 0 : score < P.tierUlt ? 1 : 2;
  function attackDamage(score, typePct) {
    const raw = P.base * 100 + P.trialBonus * score;  // 1/100 HP
    // Capped after the type bonus, before blocks and shield
    return Math.min(Math.floor((Math.floor(raw * typePct / 100) + 50) / 100), P.maxDmg);
  }

  // §4
  const defendHits = tier => Math.min(tier + 1, DEFEND_MAX_HITS);
  const defendWidth = tier => rulesScale(P.windowPct, 100 - P.narrowPct * tier);
  const defendSweep = (tier, i) => Math.floor(P.sweepMs * (100 - P.speedupPct * (tier + i)) / 100);
  const defendZone = (width, random) => 10 + random % (85 - width + 1);
  const perfectRange = (zone, width) => [zone + Math.ceil(width * 35 / 100), zone + Math.floor(width * 65 / 100)];

  function blockResult(cursor, zone, width) {
    if (cursor === null || cursor < zone || cursor > zone + width) return MISS;
    const [lo, hi] = perfectRange(zone, width);
    return cursor >= lo && cursor <= hi ? PERFECT : GOOD;
  }

  // §5: equal shares, each scaled by its block result; the shield applies to the sum
  function chainDamage(D, results) {
    const hits = results.length;
    let sum = 0;
    results.forEach((r, i) => {
      const share = Math.floor(D * (i + 1) / hits) - Math.floor(D * i / hits);
      sum += rulesScale(share, r === PERFECT ? P.perfectPct : r === GOOD ? P.goodPct : 100);
    });
    return sum;
  }

  /* ---------------- rules (port of game.c) ---------------- */

  let S;
  let gameId = 0;
  const log = [];

  function addLog(html) {
    log.unshift(html);
    log.length = Math.min(log.length, 60);
    $("#log").innerHTML = log.map(l => `<li>${l}</li>`).join("");
  }

  const att = () => S.turn;
  const dfn = () => 1 - S.turn;
  const pl = i => S.pl[i];
  const activePet = i => PETS[pl(i).active];
  const pName = i => `<b>${esc(PLAYERS[i].name)}</b>`;
  const petName = i => esc(activePet(i).name);
  const anyAlive = i => pl(i).hp.some(h => h > 0);

  function typePct(a, d) {
    if (BEATS[a] === d) return P.strongPct;
    if (BEATS[d] === a) return P.weakPct;
    return 100;
  }
  const effectTxt = pct => pct > 100 ? "效果拔群！" : pct < 100 ? "效果一般…" : "";
  const effectHtml = pct => pct === 100 ? "" :
    ` <span class="eff ${pct > 100 ? "strong" : "weak"}">${effectTxt(pct)}</span>`;
  const tierHtml = t => `<span class="tier-tag t${t}">${TIER_NAMES[t]}</span>`;
  const blocked = rs => rs.filter(r => r !== MISS).length;

  function enter(phase, waiting = []) {
    S.phase = phase;
    S.waiting = waiting;
    S.step++;
    S.switching = null;  // like player_core: any new step ends the switch choice
  }

  // Runs fn after ms unless the game has moved on in the meantime
  function after(ms, fn) {
    const id = gameId, step = S.step;
    setTimeout(() => { if (id === gameId && S.step === step) fn(); }, ms);
  }

  function showEvent(next, html) {
    S.next = next;
    S.event = html;
    enter("resolve");
    render();
    after(P.resolveMs, resolveDone);
  }

  function popup(i, text, kind, sub) {
    const f = $("#f" + i);
    const el = document.createElement("div");
    el.className = "pop" + (kind ? " " + kind : "");
    el.innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : "");
    f.appendChild(el);
    setTimeout(() => el.remove(), 1100);
    if (kind !== "heal" && !kind?.startsWith("blk")) {
      f.classList.remove("hit");
      void f.offsetWidth;
      f.classList.add("hit");
    }
  }

  // Clamps to the target pet's HP; returns the damage actually dealt
  function damage(i, amount, pct = 100, sub) {
    const p = pl(i);
    amount = Math.min(amount, p.hp[p.active]);
    p.hp[p.active] -= amount;
    popup(i, "-" + amount, "", [sub, effectTxt(pct)].filter(Boolean).join(" · "));
    return amount;
  }

  function heal(i, amount) {
    const p = pl(i);
    amount = Math.min(amount, P.hp - p.hp[p.active]);
    p.hp[p.active] += amount;
    return amount;
  }

  // Applies the shield (if any) to incoming damage and consumes it
  function shielded(i, amount) {
    if (!pl(i).shield) return amount;
    pl(i).shield = false;
    return rulesScale(amount, P.shieldPct);
  }

  function startMatch(first) {
    gameId++;
    const hp = P.hp;
    S = {
      pl: [0, 1].map(() => ({hp: Array(TEAM_SIZE).fill(hp), active: null, burn: 0, shield: false, cd: 0})),
      hpMax: hp, pending: [null, null], waiting: [], step: 0,
      turn: first, first, round: 1, phase: "", next: "begin", justUsed: false,
      trial: null,   // attack trial of the current turn (player board, local)
      atk: null,     // attack the defender faces: score, tier, damage, zones...
      winner: null, event: "",
      switching: null,  // attacker choosing a pet to switch to (local, like player_core)
    };
    log.length = 0;
    addLog(`新的一局：${pName(first)} 先手。双方暗中选择出场宠物。`);
    enter("sendout", [0, 1]);
    render();
  }

  function beginTurn() {
    const a = att(), p = pl(a);
    if (p.burn > 0) {
      p.burn--;
      const n = damage(a, P.burnDmg);
      addLog(`${petName(a)}（${pName(a)}）被灼烧，受到 <b>${n}</b> 点伤害`);
      showEvent("ready", `🔥 ${petName(a)} 被灼烧 -${n}`);
      return;
    }
    toReady();
  }

  function toReady() {
    S.atk = null;
    // The central board hands out a fresh band seed every TURN
    S.trial = {seed: Math.floor(Math.random() * 256), started: false};
    enter("ready", [att()]);
    render();
  }

  function endTurn() {
    // Cooldown counts the attacker's own turns after the one the skill was used in
    const p = pl(att());
    if (S.justUsed) S.justUsed = false;
    else if (p.cd > 0) p.cd--;
    S.turn = dfn();
    if (S.turn === S.first) S.round++;  // a round = one turn each, like game.c
    beginTurn();
  }

  // Called when an event has been on screen for RESOLVE_MS
  function resolveDone() {
    // Each faint is its own event
    for (let i = 0; i < 2; i++) {
      const p = pl(i);
      if (p.active !== null && p.hp[p.active] === 0) {
        const name = petName(i);
        p.active = null;
        p.burn = 0;
        p.shield = false;
        addLog(`💫 ${pName(i)} 的 ${name} 倒下了`);
        showEvent(S.next, `💫 ${name} 倒下了`);
        return;
      }
    }

    const need = [];
    for (let i = 0; i < 2; i++) {
      if (pl(i).active !== null) continue;
      if (!anyAlive(i)) {
        S.winner = 1 - i;
        addLog(`🏆 ${pName(S.winner)} 获胜！`);
        enter("over", [0, 1]);
        render();
        return;
      }
      need.push(i);
    }
    if (need.length) {
      enter("sendout", need);
      render();
      return;
    }

    if (S.next === "begin") beginTurn();
    else if (S.next === "ready") toReady();
    else endTurn();
  }

  function pick(i, k) {
    if (S.phase !== "sendout" || !S.waiting.includes(i) || pl(i).hp[k] === 0) return;
    // Choices stay hidden until everyone we wait for has picked
    S.pending[i] = k;
    S.waiting = S.waiting.filter(w => w !== i);
    if (S.waiting.length) {
      addLog(`${pName(i)} 已选好`);
      render();
      return;
    }
    const shown = [];
    for (let j = 0; j < 2; j++) {
      if (S.pending[j] === null) continue;
      pl(j).active = S.pending[j];
      S.pending[j] = null;
      shown.push(j);
      addLog(`${pName(j)} 派出 ${petName(j)}`);
    }
    let html = shown.map(j => `${esc(PLAYERS[j].name)} 派出 <b>${petName(j)}</b>`).join("<br>");
    const pct = typePct(activePet(0).el, activePet(1).el);
    if (pct !== 100) {
      const w = pct > 100 ? 0 : 1;
      html += `<br><span class="muted">${esc(activePet(w).short)} 克制 ${esc(activePet(1 - w).short)}</span>`;
    }
    showEvent(S.next, html);
  }

  /* ---------------- attack trial (trial.c, no pressure pad) ---------------- */

  function startTrial() {
    Object.assign(S.trial, {
      started: true, t0: performance.now(), held: true,
      levelMilli: 0, levelMs: 0, level: 0,  // controls.c: no pad, level in 1/1000
      elapsed: 0, scoredMs: [0, 0, 0], insideMs: [0, 0, 0], center: bandCenter(S.trial.seed, 0), inBand: false,
      score: null, stageScores: null, cueStage: -1,
    });
    S.phase = "trial";  // same step: the trial is local to the attacker's board
    S.switching = null;
    loop();
    render();
  }

  // One update, in whole ms like the player board: controls.c moves the level
  // for the time since its last update, then trial_update() splits (elapsed,
  // now] over the three stages and scores each part in its own stage (inside
  // too if this level is in this band)
  function trialUpdate(now) {
    const T = S.trial;
    const ms = Math.floor(now - T.t0);
    const dl = ms - T.levelMs;
    if (dl > 0) {
      T.levelMilli = T.held ? Math.min(100000, T.levelMilli + P.risePerS * dl) : Math.max(0, T.levelMilli - P.fallPerS * dl);
      T.levelMs = ms;
    }
    T.level = Math.floor((T.levelMilli + 500) / 1000);
    const end = trialEnd();
    const e = Math.max(T.elapsed, Math.min(ms, end));
    const from = T.elapsed;
    T.elapsed = e;
    T.center = bandCenter(T.seed, e);
    T.inBand = inBand(T.center, T.level);
    for (let k = 0; k < 3; k++) {
      const lo = P.readyMs + k * P.stageMs, hi = lo + P.stageMs;
      const dt = Math.min(e, hi) - Math.max(from, lo);
      if (dt > 0) {
        T.scoredMs[k] += dt;
        if (T.inBand) T.insideMs[k] += dt;
      }
    }
    if (e >= end) finishTrial();
  }

  // round(inside * 100 / scored), half up, in integers; 0 with nothing scored
  const pctRound = (inside, scored) => scored ? Math.floor((inside * 200 + scored) / (scored * 2)) : 0;
  const sum = a => a.reduce((x, y) => x + y, 0);
  // trial_score(): inside share over all three stages
  const trialScore = T => pctRound(sum(T.insideMs), sum(T.scoredMs));
  // Per-stage share, for the screen only
  const stageScore = (T, k) => pctRound(T.insideMs[k], T.scoredMs[k]);

  function trialHold(held) {
    if (S.phase !== "trial" || S.trial.held === held) return;
    trialUpdate(performance.now());
    if (S.phase === "trial") S.trial.held = held;
    render();
  }

  // ACT_ATTACK(arg = score) arrives at the central board: tier, damage and the
  // defense difficulty go into the state, then PHASE_DEFEND
  function finishTrial() {
    const T = S.trial;
    T.score = trialScore(T);
    T.stageScores = [0, 1, 2].map(k => stageScore(T, k));
    T.held = false;
    const a = att(), d = dfn();
    const tier = tierOf(T.score);
    const hits = defendHits(tier), width = defendWidth(tier);
    const typeP = typePct(activePet(a).el, activePet(d).el);
    const zones = [], sweeps = [];
    let start = 0;
    const starts = [];
    for (let i = 0; i < hits; i++) {
      zones.push(defendZone(width, Math.floor(Math.random() * 0x100000000)));
      sweeps.push(defendSweep(tier, i));
      starts.push(start);
      start += sweeps[i] + P.gapMs;
    }
    S.atk = {
      score: T.score, stageScores: T.stageScores, tier, hits, width, zones, sweeps, starts, typePct: typeP,
      damage: attackDamage(T.score, typeP),
      capped: attackDamage(T.score, typeP) === P.maxDmg,
      cursors: Array(hits).fill(null), results: Array(hits).fill(null),
      t0: 0, idx: 0, cursor: 0, inGap: false,
    };
    addLog(`${petName(a)} 攻击测试 ${stagesTxt(T.stageScores)} → 总分 <b>${T.score}</b> → ${tierHtml(tier)}，来袭 <b>${S.atk.damage}</b> 点${S.atk.capped ? "（上限）" : ""}${effectHtml(typeP)}，` +
      `要连续格挡 ${hits} 次`);
    if (tier > 0) flare(a, tier);
    S.atk.t0 = performance.now();
    enter("defending", [d]);
    loop();
    render();
  }

  const stagesTxt = sc => sc.map((v, k) => `第${k + 1}层 ${v}%`).join(" · ");

  function flare(i, tier) {
    const f = $("#f" + i);
    f.classList.remove("flare1", "flare2");
    void f.offsetWidth;
    f.classList.add("flare" + tier);
  }

  /* ---------------- chained blocks ---------------- */

  // Advances the defender's local schedule: hit i runs from starts[i] for
  // sweeps[i] ms, then DEFEND_GAP_MS of nothing before the next one
  function defendUpdate(now) {
    const A = S.atk, t = now - A.t0;
    while (A.idx < A.hits) {
      const i = A.idx, local = t - A.starts[i];
      if (local < A.sweeps[i]) {
        A.inGap = false;
        A.cursor = Math.max(0, Math.floor(local * 100 / A.sweeps[i]));
        return;
      }
      if (A.results[i] === null) settleHit(i);  // swept through without a press
      if (i === A.hits - 1) break;
      if (t < A.starts[i + 1]) { A.inGap = true; A.cursor = 100; return; }
      A.idx++;
      renderHits();
    }
    finishDefense();
  }

  function settleHit(i) {
    const A = S.atk;
    A.results[i] = blockResult(A.cursors[i], A.zones[i], A.width);
    const r = A.results[i];
    popup(dfn(), RESULT_TXT[r], "blk " + RESULT_CLS[r]);
    renderHits();
  }

  function defendPress() {
    const now = performance.now();
    defendUpdate(now);
    const A = S.atk;
    if (S.phase !== "defending" || A.inGap || A.cursors[A.idx] !== null) return;
    const i = A.idx;
    A.cursors[i] = A.cursor;  // only the first press of each sweep counts
    settleHit(i);
    // After the last bar there is nothing to wait for
    if (i === A.hits - 1) finishDefense();
    else render();
  }

  // ACT_DEFEND(cursors) at the central board: §5
  function finishDefense() {
    if (S.phase !== "defending") return;
    const A = S.atk, d = dfn();
    A.results = A.cursors.map((c, i) => blockResult(c, A.zones[i], A.width));
    const raw = chainDamage(A.damage, A.results);
    const hadShield = pl(d).shield;
    const n = damage(d, shielded(d, raw), A.typePct, `挡住 ${blocked(A.results)}/${A.hits}`);
    A.dealt = n;
    const list = A.results.map(r => RESULT_TXT[r]).join("、");
    addLog(`${petName(d)} 挡住 ${blocked(A.results)}/${A.hits}（${list}）${hadShield ? "，护盾抵消一部分" : ""}，` +
      `受到 <b>${n}</b> 点伤害${effectHtml(A.typePct)}`);
    showEvent("end", `${tierHtml(A.tier)} 挡住 ${blocked(A.results)}/${A.hits}<br>${petName(d)} -${n}` +
      (hadShield ? ` <span class="muted">（护盾）</span>` : "") + effectHtml(A.typePct));
  }

  function useSkill() {
    const a = att(), d = dfn(), me = pl(a);
    me.cd = P.skillCd;
    S.justUsed = true;
    const pet = activePet(a);
    const pct = typePct(pet.el, activePet(d).el);
    let html;
    if (pet.el === "fire") {
      pl(d).burn = P.burnTurns;
      const n = damage(d, shielded(d, rulesScale(P.emberDmg, pct)), pct);
      addLog(`${petName(a)} 使用「灼烧」！${petName(d)} 受到 <b>${n}</b> 点伤害并开始灼烧${effectHtml(pct)}`);
      html = `「灼烧」${petName(d)} -${n}${effectHtml(pct)}`;
    } else if (pet.el === "water") {
      const n = heal(a, P.tideHeal);
      me.shield = true;
      popup(a, "+" + n, "heal");
      addLog(`${petName(a)} 使用「潮汐护盾」，回复 ${n} HP，获得护盾`);
      html = `「潮汐护盾」+${n} HP，获得护盾`;
    } else {
      const n = damage(d, shielded(d, rulesScale(P.drain, pct)), pct);
      const h = heal(a, n);
      if (h) popup(a, "+" + h, "heal");
      addLog(`${petName(a)} 使用「汲取」，${petName(d)} 受到 <b>${n}</b> 点伤害，自己回复 ${h} HP${effectHtml(pct)}`);
      html = `「汲取」${petName(d)} -${n}，回复 ${h}${effectHtml(pct)}`;
    }
    showEvent("end", html);
  }

  // Pets player i could switch to: alive and not the one on the field
  const canSwitchTo = (i, k) => pl(i).active !== null && k !== pl(i).active && pl(i).hp[k] > 0;
  const canSwitch = i => PETS.some((_, k) => canSwitchTo(i, k));

  // Same as do_switch() in game.c: costs the turn, burn and shield leave with
  // the old pet, the cooldown keeps counting down as after any turn
  function switchPet(i, k) {
    if (S.phase !== "ready" || i !== att() || !canSwitchTo(i, k)) return;
    const p = pl(i), old = petName(i);
    p.active = k;
    p.burn = 0;
    p.shield = false;
    addLog(`🔄 ${pName(i)} 收回 ${old}，换上 ${petName(i)}`);
    let html = `🔄 ${esc(PLAYERS[i].name)} 换上 <b>${petName(i)}</b>`;
    const pct = typePct(activePet(0).el, activePet(1).el);
    if (pct !== 100) {
      const w = pct > 100 ? 0 : 1;
      html += `<br><span class="muted">${esc(activePet(w).short)} 克制 ${esc(activePet(1 - w).short)}</span>`;
    }
    showEvent("end", html);
  }

  // slot = 0/1/2/3: the player's four keys / pad buttons
  function act(i, slot, down) {
    if (!S) return;
    const ph = S.phase;
    if (S.switching === i) {
      // Choosing a pet to switch to: slots 0-2 pick it, slot 3 cancels
      if (!down) return;
      if (slot === 3) {
        S.switching = null;
        render();
      } else {
        switchPet(i, slot);
      }
    } else if (ph === "sendout") {
      if (down && slot < 3) pick(i, slot);
    } else if (slot === 3) {
      if (down && ph === "ready" && i === att() && canSwitch(i)) {
        S.switching = i;
        render();
      }
    } else if (ph === "over") {
      if (down && slot === 0) startMatch(1 - S.winner);  // loser goes first
    } else if (slot === 0 && i === att()) {
      if (down && ph === "ready") startTrial();
      else if (ph === "trial") trialHold(down);
    } else if (slot === 1 && down && i === dfn() && ph === "defending") {
      defendPress();
    } else if (slot === 2 && down && i === att() && ph === "ready" && pl(i).cd === 0) {
      useSkill();
    }
  }

  /* ---------------- animation loop ---------------- */

  let looping = false;
  function loop() {
    if (looping) return;
    looping = true;
    const step = now => {
      const ph = S.phase;
      if (ph === "trial") trialUpdate(performance.now());
      else if (ph === "defending") defendUpdate(performance.now());
      if (S.phase !== "trial" && S.phase !== "defending") {
        looping = false;
        renderGauges();
        return;
      }
      renderGauges();
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------------- rendering ---------------- */

  function buildFighters() {
    PLAYERS.forEach((pp, i) => {
      $("#f" + i).innerHTML = `
        <div class="name">${esc(pp.name)}<span class="pname"></span></div>
        <div class="role-lbl"></div>
        <div class="stage"></div>
        <div class="hp"><i></i></div>
        <div class="hpnum"></div>
        <div class="badges"></div>
        <div class="roster">${PETS.map((pet, k) => `<div class="mini ${pet.el}" data-k="${k}">
            ${spriteSvg(pet.el, "msprite")}<span class="mname">${esc(pet.short)}</span>
            <span class="mhp"><i></i></span><span class="mnum"></span></div>`).join("")}</div>
        <div class="pad">${[0, 1, 2, 3].map(s => `<button data-i="${i}" data-s="${s}"${s === 3 ? ' class="wide"' : ""}><span></span><kbd></kbd></button>`).join("")}</div>`;
    });
  }

  // Trial gauge, tier badge, block gauge and per-hit chips
  function renderGauges() {
    const ph = S.phase, T = S.trial, A = S.atk;
    const trialOn = T && T.started;
    const band = $("#trial-band"), ptr = $("#trial-ptr"), tg = $("#trial-gauge");
    band.style.display = trialOn ? "" : "none";
    ptr.style.display = trialOn ? "" : "none";
    let val = "—", scoring = false, stage = -2, fills = [0, 0, 0, 0];
    if (trialOn) {
      band.style.left = (T.center - P.bandPct / 2) + "%";
      band.style.width = P.bandPct + "%";
      band.classList.toggle("in", T.inBand && ph === "trial");
      ptr.style.left = T.level + "%";
      const t = T.elapsed;
      const done = T.score !== null;
      stage = done ? 3 : stageAt(t);
      scoring = stage >= 0;
      // Segment 0 is the ready phase, 1..3 the stages
      fills = [P.readyMs ? Math.min(1, t / P.readyMs) : 1,
        ...[0, 1, 2].map(k => Math.min(1, Math.max(0, (t - P.readyMs - k * P.stageMs) / P.stageMs)))];
      if (done) val = `总分 ${T.score}`;
      else if (!scoring) val = `准备 ${((P.readyMs - t) / 1000).toFixed(1)} s`;
      else val = `本层光带内 ${stageScore(T, stage)}%`;
      // Cue once per stage start
      if (ph === "trial" && scoring && !done && T.cueStage !== stage) {
        T.cueStage = stage;
        cue(stage === 0 ? "开始计分！" : "加速！", stage);
      }
    } else if (ph === "ready") {
      val = "按攻击键开始";
    }
    tg.classList.toggle("scoring", scoring && ph === "trial");
    tg.classList.toggle("readying", trialOn && !scoring && ph === "trial");
    $("#trial-val").textContent = val;
    const stEl = $("#trial-stage");
    stEl.textContent = stage === -1 ? "准备" : stage >= 0 && stage < 3 ? `第 ${stage + 1} 层` : "";
    stEl.className = "stage-tag" + (stage >= 0 && stage < 3 ? " s" + stage : "");
    const segs = document.querySelectorAll("#trial-track .seg");
    segs.forEach((seg, j) => {
      seg.querySelector("i").style.width = fills[j] * 100 + "%";
      seg.classList.toggle("now", ph === "trial" && stage + 1 === j);
      if (j === 0) seg.style.flexGrow = P.readyMs / P.stageMs;
      else {
        const b = seg.querySelector("b");
        const txt = T && T.stageScores ? `${T.stageScores[j - 1]}%` : `第${j}层`;
        if (b.textContent !== txt) b.textContent = txt;
      }
    });

    const tierEl = $("#tier");
    const tierKey = A ? String(A.t0) : "";
    if (tierEl.dataset.k !== tierKey) {
      tierEl.dataset.k = tierKey;
      tierEl.className = "tier" + (A ? " t" + A.tier : "");
      tierEl.innerHTML = A ? `<b>${TIER_NAMES[A.tier]}</b><span class="stages">${stagesTxt(A.stageScores)} → 总分 ${A.score}</span>` +
        `<span>来袭 ${A.damage} 点${A.capped ? "（上限）" : ""} · 格挡 ${A.hits} 次</span>` : "";
    }

    const showDef = A && (ph === "defending" || ph === "resolve");
    const z = $("#def-zone"), cur = $("#def-cursor");
    z.style.display = showDef && !A.inGap ? "" : "none";
    cur.style.display = showDef && !A.inGap ? "" : "none";
    let dv = "—";
    if (showDef) {
      const i = Math.min(A.idx, A.hits - 1), w = A.width, zone = A.zones[i];
      z.style.left = zone + "%";
      z.style.width = w + "%";
      const [lo, hi] = perfectRange(0, w);
      $("#def-perfect").style.left = (lo / w * 100) + "%";
      $("#def-perfect").style.width = ((hi - lo + 1) / w * 100) + "%";
      const c = A.cursors[i] !== null ? A.cursors[i] : A.cursor;
      cur.style.left = `calc(${c}% - 1.5px)`;
      cur.classList.toggle("locked", A.cursors[i] !== null);
      dv = ph === "resolve" ? `挡住 ${blocked(A.results)}/${A.hits}` :
        A.inGap ? `下一击 ${A.idx + 2}/${A.hits}…` : `第 ${i + 1}/${A.hits} 击`;
    }
    $("#def-val").textContent = dv;
  }

  // Short text over the trial gauge when a stage starts
  function cue(text, stage) {
    const el = $("#trial-cue");
    el.textContent = text;
    el.className = "trial-cue";
    void el.offsetWidth;
    el.className = "trial-cue on s" + stage;
  }

  function renderHits() {
    const A = S.atk, ph = S.phase;
    const show = A && (ph === "defending" || ph === "resolve");
    $("#hits").innerHTML = !show ? "" : A.results.map((r, i) =>
      `<span class="hit-chip ${r === null ? (i === A.idx && ph === "defending" ? "now" : "") : RESULT_CLS[r]}">` +
      `${i + 1} · ${r === null ? "…" : RESULT_TXT[r]}</span>`).join("") +
      (ph === "resolve" ? `<span class="hit-sum">挡住 ${blocked(A.results)}/${A.hits}</span>` : "");
  }

  function padLabels(i) {
    const kb = PLAYERS[i].keys, p = pl(i), ph = S.phase;
    const isAtt = i === att();
    const switchBtn = {t: "换宠物", k: kb[3], on: isAtt && ph === "ready" && canSwitch(i)};
    if (S.switching === i) {
      return [...PETS.map((pet, k) => ({t: pet.short, k: kb[k], on: canSwitchTo(i, k)})),
        {t: "取消换宠物", k: kb[3], on: true}];
    }
    if (ph === "sendout") {
      const choosing = S.waiting.includes(i);
      return [...PETS.map((pet, k) => ({
        t: pet.short, k: kb[k], on: choosing && p.hp[k] > 0,
      })), {...switchBtn, on: false}];
    }
    if (ph === "over") {
      return [{t: "再来一局", k: kb[0], on: true}, {t: "格挡", k: kb[1], on: false}, {t: "技能", k: kb[2], on: false},
        {...switchBtn, on: false}];
    }
    const skill = p.active !== null ? PETS[p.active].skill : "技能";
    return [
      {t: isAtt && ph === "trial" ? "按住上升" : "攻击", k: isAtt && ph === "trial" ? "按住 " + kb[0] : kb[0],
        on: isAtt && (ph === "ready" || ph === "trial")},
      {t: "格挡", k: kb[1], on: !isAtt && ph === "defending"},
      {t: skill, k: kb[2], on: isAtt && ph === "ready" && p.cd === 0},
      switchBtn,
    ];
  }

  function render() {
    const ph = S.phase;
    PLAYERS.forEach((pp, i) => {
      const el = $("#f" + i), p = pl(i);
      const pet = p.active !== null ? PETS[p.active] : null;
      const isAtt = i === att();
      ["fire", "water", "grass"].forEach(e => el.classList.toggle(e, !!pet && pet.el === e));
      el.classList.toggle("turn", ph === "sendout" ? S.waiting.includes(i) :
        ph !== "over" && ph !== "resolve" && (ph === "defending" ? !isAtt : isAtt));
      el.classList.toggle("ko", ph === "over" && S.winner !== i);

      el.querySelector(".pname").textContent = pet ? " · " + pet.name : "";
      el.querySelector(".role-lbl").textContent =
        ph === "over" ? (S.winner === i ? "🏆 胜利" : "全部倒下") :
        ph === "sendout" ? (S.waiting.includes(i) ? "选择出场宠物…" : S.pending[i] !== null ? "✓ 已选好" : "等待对方选择") :
        S.switching === i ? "选择换上的宠物…" : isAtt ? "进攻方" : "防守方";

      const stage = el.querySelector(".stage");
      const key = pet ? pet.el : ph === "over" ? "out" : "none";
      if (stage.dataset.k !== key) {
        stage.dataset.k = key;
        stage.innerHTML = pet ? spriteSvg(pet.el) : `<div class="hidden-pet">${key === "out" ? "💫" : "?"}</div>`;
      }
      const hp = pet ? p.hp[p.active] : 0;
      el.querySelector(".hp i").style.width = (pet ? hp / S.hpMax * 100 : 0) + "%";
      el.querySelector(".hpnum").textContent = pet ? `HP ${hp} / ${S.hpMax}` : `剩余 ${p.hp.filter(h => h > 0).length} / ${TEAM_SIZE} 只`;

      const badges = [];
      if (p.burn) badges.push(`🔥 灼烧 ×${p.burn}`);
      if (p.shield) badges.push("🛡 护盾");
      badges.push(p.cd ? `技能冷却 ${p.cd}` : "技能就绪");
      el.querySelector(".badges").innerHTML = badges.map(b => `<span class="badge">${esc(b)}</span>`).join("");

      el.querySelectorAll(".mini").forEach(m => {
        const k = +m.dataset.k, h = p.hp[k];
        m.classList.toggle("fainted", h === 0);
        m.classList.toggle("active", p.active === k);
        m.classList.toggle("pickable", S.switching === i ? canSwitchTo(i, k) :
          ph === "sendout" && S.waiting.includes(i) && h > 0);
        m.querySelector(".mhp i").style.width = (h / S.hpMax * 100) + "%";
        m.querySelector(".mnum").textContent = h === 0 ? "倒下" : h;
      });

      const labels = padLabels(i);
      el.querySelectorAll(".pad button").forEach((b, s) => {
        b.querySelector("span").textContent = labels[s].t;
        b.querySelector("kbd").textContent = labels[s].k;
        b.disabled = !labels[s].on;
        b.classList.toggle("held", s === 0 && isAtt && ph === "trial" && S.trial.held);
      });
    });

    const a = att(), d = dfn();
    const kbd = k => `<kbd class="mono">${esc(k)}</kbd>`;
    const keyList = i => PLAYERS[i].keys.map(kbd).join("/");
    let prompt = "";
    if (ph === "sendout") {
      const status = [0, 1].filter(i => S.waiting.includes(i) || S.pending[i] !== null)
        .map(i => `${pName(i)}：${S.waiting.includes(i) ? `按 ${keyList(i)} 选择` : "✓ 已选好"}`).join("<br>");
      const first = S.round === 1 && pl(0).active === null && pl(1).active === null;
      prompt = `<span>${first ? `暗中选择出场宠物（先手：${pName(S.turn)}）` : "宠物倒下了，选择下一只"}<br>${status}</span>`;
    } else if (ph === "resolve") {
      prompt = `<span>${S.event}</span>`;
    } else if (ph === "ready" && S.switching === a) {
      const keys = PETS.map((_, k) => k).filter(k => canSwitchTo(a, k)).map(k => kbd(PLAYERS[a].keys[k])).join("/");
      prompt = `<span>${pName(a)} 换宠物：按 ${keys} 或点宠物选择换上谁（用掉这一回合，灼烧和护盾随旧宠物消失）<br>` +
        `<span class="muted">按 ${kbd(PLAYERS[a].keys[3])} 取消</span></span>`;
    } else if (ph === "ready") {
      prompt = `<span>${pName(a)} 的 ${petName(a)} 进攻：按 ${kbd(PLAYERS[a].keys[0])} 开始攻击测试` +
        (pl(a).cd ? `（技能冷却中）` : `；或按 ${kbd(PLAYERS[a].keys[2])} 使用「${esc(activePet(a).skill)}」`) +
        (canSwitch(a) ? `；按 ${kbd(PLAYERS[a].keys[3])} 换宠物` : "") + `</span>`;
    } else if (ph === "trial") {
      prompt = `<span>按住 ${kbd(PLAYERS[a].keys[0])} 指针右移，松开左移，让它一直待在光带里（共 3 层，一层比一层快）<br>` +
        `<span class="muted">≥${P.tierStrong} 分强力一击，≥${P.tierUlt} 分全力一击</span></span>`;
    } else if (ph === "defending") {
      const A = S.atk;
      prompt = `<span>${pName(d)} 连续格挡 ${A.hits} 次！光标到绿色区域按 ${kbd(PLAYERS[d].keys[1])}<br>` +
        `<span class="muted">${TIER_NAMES[A.tier]} · 来袭 ${A.damage} 点</span>${effectHtml(A.typePct)}</span>`;
    } else if (ph === "over") {
      prompt = `<span>🏆 ${pName(S.winner)} 获胜！按 ${kbd(PLAYERS[0].keys[0])} 或 ${kbd(PLAYERS[1].keys[0])} 再来一局（${esc(PLAYERS[1 - S.winner].name)} 先手）</span>`;
    }
    $("#prompt").innerHTML = prompt;
    $("#round").textContent = S.round;
    renderGauges();
    renderHits();
  }

  /* ---------------- input ---------------- */

  const KEYMAP = {};
  PLAYERS.forEach((pp, i) => pp.keys.forEach((k, s) => KEYMAP[k.toLowerCase()] = [i, s]));

  function typing(e) {
    const t = e.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
  }

  document.addEventListener("keydown", e => {
    if (window.currentTab !== "battle" || typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    const m = KEYMAP[e.key.toLowerCase()];
    if (!m) return;
    e.preventDefault();
    if (!e.repeat) act(m[0], m[1], true);
  });
  document.addEventListener("keyup", e => {
    const m = KEYMAP[e.key.toLowerCase()];
    if (m && m[1] === 0) act(m[0], 0, false);
  });

  const arena = document.querySelector(".arena");
  arena.addEventListener("pointerdown", e => {
    // The pet row picks a pet while sending out or switching
    const m = e.target.closest(".mini.pickable");
    if (m) {
      e.preventDefault();
      act(+m.closest(".fighter").id.slice(1), +m.dataset.k, true);
      return;
    }
    const b = e.target.closest(".pad button");
    if (!b || b.disabled) return;
    e.preventDefault();
    b.setPointerCapture?.(e.pointerId);
    act(+b.dataset.i, +b.dataset.s, true);
  });
  const release = e => {
    const b = e.target.closest?.(".pad button");
    if (b && b.dataset.s === "0") act(+b.dataset.i, 0, false);
  };
  arena.addEventListener("pointerup", release);
  arena.addEventListener("pointercancel", release);
  arena.addEventListener("contextmenu", e => { if (e.target.closest(".pad")) e.preventDefault(); });
  // A key held while switching tabs or windows never sends its keyup: let go
  window.addEventListener("blur", () => { if (S && S.phase === "trial") trialHold(false); });

  $("#restart").addEventListener("click", () => startMatch(Math.random() < 0.5 ? 0 : 1));

  // Read-only hooks for the automated playtest script
  window.PR.battle = {get state() { return S; }, params: P, bandCenter, tau100, stageAt, inBand, tierOf, attackDamage, chainDamage, cConfig};

  buildFighters();
  renderParams();
  startMatch(Math.random() < 0.5 ? 0 : 1);
})();
