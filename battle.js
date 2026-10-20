// Pocket Rivals battle prototype: teams of 3, secret send-out, hold to charge,
// timed defense, skills, type matchups. Follows the firmware rules in
// pocket-rivals/software/lib/game.c (integer math and rounding included) so
// numbers tuned here behave the same after they go into game_config.h.

(() => {
  const $ = s => document.querySelector(s);
  const store = window.PR.store;

  // Same names, defaults, order and comments as software/lib/game_config.h, so
  // the exported block can replace that file. Entries without min/max are
  // exported but not tuned here.
  const PARAMS = [
    {key: "base",       c: "BASE_DAMAGE",        g: "出招", label: "基础伤害（0% 蓄力）",           min: 4,   max: 20,   step: 1,   def: 10,   unit: "",    note: "attack damage at 0% charge"},
    {key: "bonus",      c: "CHARGE_BONUS",       g: "出招", label: "满蓄力额外伤害",                min: 0,   max: 40,   step: 1,   def: 20,   unit: "",    note: "extra damage at 100% charge"},
    {key: "chargeMs",   c: "CHARGE_TIME_MS",     g: "出招", label: "蓄满所需时间",                  min: 400, max: 2500, step: 100, def: 1200, unit: " ms", note: "hold time for 100% charge"},
    {key: "overMs",     c: "OVERLOAD_MS",        g: "出招", label: "蓄满后再按多久会过载",          min: 200, max: 2000, step: 100, def: 700,  unit: " ms", note: "holding this long past full charge halves damage"},
    {key: "windowPct",  c: "DEFEND_WINDOW_PCT",  g: "防御", label: "防御窗口宽度",                  min: 8,   max: 50,   step: 1,   def: 24,   unit: "%",   note: "width of the block zone, % of the sweep"},
    {key: "sweepMs",    c: "DEFEND_SWEEP_MS",    g: "防御", label: "防御条扫过时间",                min: 500, max: 2500, step: 100, def: 1100, unit: " ms", note: "time for the cursor to cross the bar"},
    {key: "hp",         c: "START_HP",           g: "节奏", label: "每只宠物 HP（下一局生效）",     min: 20,  max: 200,  step: 5,   def: 60,   unit: "",    note: "HP of each pet (TEAM_SIZE pets per player)"},
    {key: "skillCd",    c: "SKILL_COOLDOWN",     g: "技能", label: "技能冷却（自己的回合数）",      min: 1,   max: 5,    step: 1,   def: 3,    unit: "",    note: "own turns before the skill is ready again"},
    {key: "burnDmg",    c: "BURN_DAMAGE",        g: "技能", label: "Ember 灼烧每回合伤害",          min: 0,   max: 15,   step: 1,   def: 5,    unit: "",    note: "Ember skill: damage per turn while burning", gap: true},
    {key: "burnTurns",  c: "BURN_TURNS",         g: "技能", label: "灼烧持续回合",                  min: 0,   max: 5,    step: 1,   def: 2,    unit: ""},
    {key: "emberDmg",   c: "EMBER_SKILL_DAMAGE", g: "技能", label: "Ember 技能直接伤害",            min: 0,   max: 25,   step: 1,   def: 8,    unit: ""},
    {key: "tideHeal",   c: "TIDE_HEAL",          g: "技能", label: "Tide 回复量",                   min: 0,   max: 40,   step: 1,   def: 12,   unit: "",    note: "Tide skill: heal and shield the next hit"},
    {key: "drain",      c: "SPROUT_DRAIN",       g: "技能", label: "Sprout 汲取（伤害 = 回复）",    min: 0,   max: 25,   step: 1,   def: 6,    unit: "",    note: "Sprout skill: deal this much, heal as much"},
    {key: "perfectPct", c: "BLOCK_PERFECT_PCT",  g: "防御", label: "完美格挡后承受伤害",            min: 0,   max: 100,  step: 5,   def: 20,   unit: "%",   note: "damage taken on a perfect block", gap: true},
    {key: "goodPct",    c: "BLOCK_GOOD_PCT",     g: "防御", label: "普通格挡后承受伤害",            min: 0,   max: 100,  step: 5,   def: 50,   unit: "%"},
    {key: "shieldPct",  c: "SHIELD_PCT",         g: "技能", label: "护盾后承受伤害",                min: 0,   max: 100,  step: 5,   def: 50,   unit: "%"},
    {key: "strongPct",  c: "TYPE_STRONG_PCT",    g: "属性", label: "属性克制伤害（效果拔群）",      min: 100, max: 250,  step: 10,  def: 150,  unit: "%",   note: "fire > grass > water > fire"},
    {key: "weakPct",    c: "TYPE_WEAK_PCT",      g: "属性", label: "被克制伤害（效果一般）",        min: 30,  max: 100,  step: 5,   def: 70,   unit: "%"},
    {key: "resolveMs",  c: "RESOLVE_MS",         g: "节奏", label: "每个事件停留时间",              min: 300, max: 2000, step: 100, def: 900,  unit: " ms", note: "how long each event stays on screen", gap: true},
    {key: "graceMs",    c: "DEFEND_GRACE_MS",                                                                                         def: 1500, note: "central treats a silent defender as a miss", note2: "after DEFEND_SWEEP_MS + this"},
  ];
  const GROUPS = ["出招", "防御", "技能", "属性", "节奏"];
  const TUNABLE = PARAMS.filter(p => p.min !== undefined);

  const TEAM_SIZE = 3;
  const PETS = [
    {name: "焰灵 Ember",  short: "Ember",  el: "fire",  type: "火", skill: "灼烧"},
    {name: "潮影 Tide",   short: "Tide",   el: "water", type: "水", skill: "潮汐护盾"},
    {name: "叶芽 Sprout", short: "Sprout", el: "grass", type: "草", skill: "汲取"},
  ];
  const PLAYERS = [
    {name: "玩家 1", keys: ["A", "S", "D"]},
    {name: "玩家 2", keys: ["J", "K", "L"]},
  ];
  const BEATS = {fire: "grass", grass: "water", water: "fire"};
  const RESULT_TXT = {perfect: "完美格挡！", good: "格挡成功", miss: "没挡住"};

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

  // v2: START_HP changed from 100 per player to 60 per pet, so old saves would mislead
  const PARAM_KEY = "pr.params.v2";
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
    const pad = " ".repeat(8 + 19 + 6);
    const lines = [
      "// Pocket Rivals tuning knobs",
      "//",
      "// Names match the battle prototype on the progress site, which can export",
      "// its sliders as these #defines. CHARGE_* and DEFEND_SWEEP_MS are measured on",
      "// the player boards; everything else is applied by the central board.",
      "",
      "#pragma once",
      "",
    ];
    PARAMS.forEach(p => {
      if (p.gap) lines.push("");
      const head = `#define ${p.c.padEnd(18)} `;
      lines.push(p.note ? `${head}${String(P[p.key]).padEnd(5)} // ${p.note}` : `${head}${P[p.key]}`);
      if (p.note2) lines.push(`${pad}// ${p.note2}`);
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

  function enter(phase, waiting = []) {
    S.phase = phase;
    S.waiting = waiting;
    S.step++;
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
    if (kind !== "heal") {
      f.classList.remove("hit");
      void f.offsetWidth;
      f.classList.add("hit");
    }
  }

  // Clamps to the target pet's HP; returns the damage actually dealt
  function damage(i, amount, pct = 100) {
    const p = pl(i);
    amount = Math.min(amount, p.hp[p.active]);
    p.hp[p.active] -= amount;
    popup(i, "-" + amount, "", effectTxt(pct));
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
    return Math.floor((amount * P.shieldPct + 50) / 100);
  }

  function startMatch(first) {
    gameId++;
    const hp = P.hp;
    S = {
      pl: [0, 1].map(() => ({hp: Array(TEAM_SIZE).fill(hp), active: null, burn: 0, shield: false, cd: 0})),
      hpMax: hp, pending: [null, null], waiting: [], step: 0,
      turn: first, round: 1, phase: "", next: "begin", justUsed: false,
      charge: 0, over: false, t0: 0, atk: 0, atkPct: 100,
      zone: 40, cursor: 0, result: null, winner: null, event: "",
    };
    log.length = 0;
    addLog(`新的一局：${pName(first)} 先手。双方暗中选择出场宠物。`);
    enter("sendout", [0, 1]);
    render();
  }

  function beginTurn() {
    const a = att(), p = pl(a);
    S.result = null;
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
    S.charge = 0;
    S.over = false;
    S.result = null;
    enter("ready", [att()]);
    render();
  }

  function endTurn() {
    // Cooldown counts the attacker's own turns after the one the skill was used in
    const p = pl(att());
    if (S.justUsed) S.justUsed = false;
    else if (p.cd > 0) p.cd--;
    S.turn = dfn();
    if (S.turn === 0) S.round++;
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

  function startCharge() {
    S.phase = "charging";
    S.t0 = performance.now();
    S.charge = 0;
    S.over = false;
    loop();
    render();
  }

  // Same integer math as player_core_charge() + do_attack()
  function releaseCharge() {
    const held = performance.now() - S.t0;
    const charge = held >= P.chargeMs ? 100 : Math.floor(held * 100 / P.chargeMs);
    const over = held > P.chargeMs + P.overMs;
    const a = att(), d = dfn();
    let raw = P.base * 100 + P.bonus * charge;
    if (over) raw = Math.floor(raw / 2);
    S.atkPct = typePct(activePet(a).el, activePet(d).el);
    raw = Math.floor(raw * S.atkPct / 100);
    S.atk = Math.floor((raw + 50) / 100);
    S.charge = charge;
    S.over = over;
    addLog(`${petName(a)} 出招：蓄力 ${charge}%${over ? "（过载，伤害减半）" : ""}，来袭 <b>${S.atk}</b> 点${effectHtml(S.atkPct)}`);
    S.zone = 10 + Math.floor(Math.random() * (85 - P.windowPct + 1));
    S.cursor = 0;
    S.t0 = performance.now();
    enter("defending", [d]);
    loop();
    render();
  }

  function defend(pressed) {
    const d = dfn(), z = S.zone, w = P.windowPct;
    const c = Math.floor(S.cursor);
    let r = "miss";
    if (pressed && c >= z && c <= z + w) {
      // Perfect = middle 30% of the zone
      const lo = z + Math.floor(w * 35 / 100), hi = z + Math.floor(w * 65 / 100);
      r = c >= lo && c <= hi ? "perfect" : "good";
    }
    S.result = r;
    const pct = r === "perfect" ? P.perfectPct : r === "good" ? P.goodPct : 100;
    const hadShield = pl(d).shield;
    const n = damage(d, shielded(d, Math.floor((S.atk * pct + 50) / 100)), S.atkPct);
    const why = RESULT_TXT[r] + (hadShield ? "，护盾抵消一部分" : "");
    addLog(`${petName(d)} ${why}，受到 <b>${n}</b> 点伤害${effectHtml(S.atkPct)}`);
    showEvent("end", `${RESULT_TXT[r]} ${petName(d)} -${n}${effectHtml(S.atkPct)}`);
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
      const n = damage(d, shielded(d, Math.floor((P.emberDmg * pct + 50) / 100)), pct);
      addLog(`${petName(a)} 使用「灼烧」！${petName(d)} 受到 <b>${n}</b> 点伤害并开始灼烧${effectHtml(pct)}`);
      html = `「灼烧」${petName(d)} -${n}${effectHtml(pct)}`;
    } else if (pet.el === "water") {
      const n = heal(a, P.tideHeal);
      me.shield = true;
      popup(a, "+" + n, "heal");
      addLog(`${petName(a)} 使用「潮汐护盾」，回复 ${n} HP，获得护盾`);
      html = `「潮汐护盾」+${n} HP，获得护盾`;
    } else {
      const n = damage(d, shielded(d, Math.floor((P.drain * pct + 50) / 100)), pct);
      const h = heal(a, n);
      if (h) popup(a, "+" + h, "heal");
      addLog(`${petName(a)} 使用「汲取」，${petName(d)} 受到 <b>${n}</b> 点伤害，自己回复 ${h} HP${effectHtml(pct)}`);
      html = `「汲取」${petName(d)} -${n}，回复 ${h}${effectHtml(pct)}`;
    }
    showEvent("end", html);
  }

  // slot = 0/1/2: the player's three keys / pad buttons
  function act(i, slot, down) {
    if (!S) return;
    const ph = S.phase;
    if (ph === "sendout") {
      if (down) pick(i, slot);
    } else if (ph === "over") {
      if (down && slot === 0) startMatch(1 - S.winner);  // loser goes first
    } else if (slot === 0 && i === att()) {
      if (down && ph === "ready") startCharge();
      else if (!down && ph === "charging") releaseCharge();
    } else if (slot === 1 && down && i === dfn() && ph === "defending") {
      defend(true);
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
      if (S.phase === "charging") {
        const held = now - S.t0;
        S.charge = held >= P.chargeMs ? 100 : Math.floor(held * 100 / P.chargeMs);
        const wasOver = S.over;
        S.over = held > P.chargeMs + P.overMs;
        if (S.over !== wasOver) render();
      } else if (S.phase === "defending") {
        S.cursor = Math.min(100, (now - S.t0) / P.sweepMs * 100);
        if (S.cursor >= 100) { looping = false; renderGauges(); defend(false); return; }
      } else {
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
        <div class="pad">${[0, 1, 2].map(s => `<button data-i="${i}" data-s="${s}"><span></span><kbd></kbd></button>`).join("")}</div>`;
    });
  }

  function renderGauges() {
    const fill = $("#charge-fill");
    const showCharge = S.phase === "charging" || S.phase === "defending" || (S.phase === "resolve" && S.result);
    fill.style.width = (showCharge ? S.charge : 0) + "%";
    fill.classList.toggle("over", S.over && showCharge);
    $("#charge-val").textContent = !showCharge ? "—" : S.over ? "过载！" : S.charge + "%";

    const w = P.windowPct;
    const showZone = S.phase === "defending" || (S.phase === "resolve" && S.result);
    $("#def-zone").style.display = showZone ? "" : "none";
    $("#def-zone").style.left = S.zone + "%";
    $("#def-zone").style.width = w + "%";
    const lo = Math.floor(w * 35 / 100), hi = Math.floor(w * 65 / 100);
    $("#def-perfect").style.left = (lo / w * 100) + "%";
    $("#def-perfect").style.width = ((hi - lo + 1) / w * 100) + "%";
    $("#def-cursor").style.left = `calc(${S.cursor}% - 1.5px)`;
    $("#def-cursor").style.display = showZone ? "" : "none";
    $("#def-val").textContent = showZone && S.result ? RESULT_TXT[S.result] :
      S.phase === "defending" ? "看准时机！" : "—";
  }

  function padLabels(i) {
    const kb = PLAYERS[i].keys, p = pl(i), ph = S.phase;
    if (ph === "sendout") {
      const choosing = S.waiting.includes(i);
      return PETS.map((pet, k) => ({
        t: pet.short, k: kb[k], on: choosing && p.hp[k] > 0,
      }));
    }
    if (ph === "over") {
      return [{t: "再来一局", k: kb[0], on: true}, {t: "防御", k: kb[1], on: false}, {t: "技能", k: kb[2], on: false}];
    }
    const isAtt = i === att();
    const skill = p.active !== null ? PETS[p.active].skill : "技能";
    return [
      {t: "蓄力", k: "按住 " + kb[0], on: isAtt && (ph === "ready" || ph === "charging")},
      {t: "防御", k: kb[1], on: !isAtt && ph === "defending"},
      {t: skill, k: kb[2], on: isAtt && ph === "ready" && p.cd === 0},
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
        isAtt ? "进攻方" : "防守方";

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
        m.querySelector(".mhp i").style.width = (h / S.hpMax * 100) + "%";
        m.querySelector(".mnum").textContent = h === 0 ? "倒下" : h;
      });

      const labels = padLabels(i);
      el.querySelectorAll(".pad button").forEach((b, s) => {
        b.querySelector("span").textContent = labels[s].t;
        b.querySelector("kbd").textContent = labels[s].k;
        b.disabled = !labels[s].on;
        b.classList.toggle("held", s === 0 && isAtt && ph === "charging");
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
    } else if (ph === "ready") {
      prompt = `<span>${pName(a)} 的 ${petName(a)} 进攻：按住 ${kbd(PLAYERS[a].keys[0])} 蓄力，松开出招` +
        (pl(a).cd ? `（技能冷却中）` : `；或按 ${kbd(PLAYERS[a].keys[2])} 使用「${esc(activePet(a).skill)}」`) + `</span>`;
    } else if (ph === "charging") {
      prompt = S.over ? `<span style="color:var(--danger)">过载了！现在松开伤害减半</span>` :
        `<span>蓄力中… 松开 ${kbd(PLAYERS[a].keys[0])} 出招</span>`;
    } else if (ph === "defending") {
      prompt = `<span>${pName(d)} 防御！光标在绿色区域时按 ${kbd(PLAYERS[d].keys[1])}<br>` +
        `<span class="muted">来袭 ${S.atk} 点</span>${effectHtml(S.atkPct)}</span>`;
    } else if (ph === "over") {
      prompt = `<span>🏆 ${pName(S.winner)} 获胜！按 ${kbd(PLAYERS[0].keys[0])} 或 ${kbd(PLAYERS[1].keys[0])} 再来一局（${esc(PLAYERS[1 - S.winner].name)} 先手）</span>`;
    }
    $("#prompt").innerHTML = prompt;
    $("#round").textContent = S.round;
    renderGauges();
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
  // Releasing a held key while switching tabs or windows should still fire the attack
  window.addEventListener("blur", () => { if (S && S.phase === "charging") releaseCharge(); });

  $("#restart").addEventListener("click", () => startMatch(Math.random() < 0.5 ? 0 : 1));

  buildFighters();
  renderParams();
  startMatch(Math.random() < 0.5 ? 0 : 1);
})();
