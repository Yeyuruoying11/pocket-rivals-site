// Pocket Rivals battle prototype: hold to charge, timed defense, skills.
// Mirrors the planned firmware rules so the team can tune numbers before
// they go into the central board's battle logic.

(() => {
  const $ = s => document.querySelector(s);
  const store = window.PR.store;

  const PARAMS = [
    {key: "base",      c: "BASE_DAMAGE",       label: "基础伤害",                 min: 4,   max: 20,   step: 1,   def: 10,   unit: ""},
    {key: "bonus",     c: "CHARGE_BONUS",      label: "满蓄力额外伤害",           min: 0,   max: 40,   step: 1,   def: 20,   unit: ""},
    {key: "chargeMs",  c: "CHARGE_TIME_MS",    label: "蓄满所需时间",             min: 400, max: 2500, step: 100, def: 1200, unit: " ms"},
    {key: "overMs",    c: "OVERLOAD_MS",       label: "蓄满后再按多久会过载",     min: 200, max: 2000, step: 100, def: 700,  unit: " ms"},
    {key: "windowPct", c: "DEFEND_WINDOW_PCT", label: "防御窗口宽度",             min: 8,   max: 50,   step: 1,   def: 24,   unit: "%"},
    {key: "sweepMs",   c: "DEFEND_SWEEP_MS",   label: "防御条扫过时间",           min: 500, max: 2500, step: 100, def: 1100, unit: " ms"},
    {key: "hp",        c: "START_HP",          label: "初始 HP（重新开始后生效）", min: 40,  max: 200,  step: 10,  def: 100,  unit: ""},
    {key: "skillCd",   c: "SKILL_COOLDOWN",    label: "技能冷却（自己的回合数）", min: 1,   max: 5,    step: 1,   def: 3,    unit: ""},
  ];

  const BURN_DAMAGE = 5, BURN_TURNS = 2, EMBER_SKILL_DAMAGE = 8, TIDE_HEAL = 12;
  const MULT = {perfect: 0.2, good: 0.5, miss: 1};
  const RESULT_TXT = {perfect: "完美格挡！", good: "格挡成功", miss: "没挡住"};

  // Sprites: 10x10 pixel art, each row is a 5-pixel left half mirrored to the right
  const SPRITES = {
    fire:  ["...o.", "..olo", ".olff", "olfff", "ofhef", "offff", "offfm", "olfff", ".olff", "..ooo"],
    water: ["....o", "...ol", "..olf", ".olff", ".ohef", "offff", "offfm", "oflll", ".offl", "..ooo"],
  };
  const PALETTE = {
    fire:  {o: "#5a2a1c", f: "#e8663d", l: "#f6b04a", e: "#1c1c1e", h: "#ffffff", m: "#5a2a1c"},
    water: {o: "#163a5a", f: "#2f8fd6", l: "#9fd6f4", e: "#1c1c1e", h: "#ffffff", m: "#163a5a"},
  };

  const FIGHTERS = [
    {name: "焰灵 Ember", el: "fire",  keys: {charge: "A", defend: "S", skill: "D"}, skill: "灼烧"},
    {name: "潮影 Tide",  el: "water", keys: {charge: "J", defend: "K", skill: "L"}, skill: "潮汐护盾"},
  ];

  function spriteSvg(el) {
    const rows = SPRITES[el].map(h => h + [...h].reverse().join(""));
    let rects = "";
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== ".") rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PALETTE[el][ch]}"/>`;
    }));
    return `<svg class="sprite" viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  }

  /* ---------------- params ---------------- */

  let P = {};
  try { P = JSON.parse(store.get("pr.params") || "{}") || {}; } catch { P = {}; }
  PARAMS.forEach(p => { if (typeof P[p.key] !== "number") P[p.key] = p.def; });

  function renderParams() {
    $("#params").innerHTML = PARAMS.map(p => `<label>
        <span>${p.label}<b id="pv-${p.key}">${P[p.key]}${p.unit}</b></span>
        <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${P[p.key]}" data-p="${p.key}">
      </label>`).join("");
    renderCSnippet();
  }

  function renderCSnippet() {
    const w = Math.max(...PARAMS.map(p => p.c.length));
    $("#param-c").textContent = "// Pocket Rivals 战斗参数（来自网页原型）\n" +
      PARAMS.map(p => `#define ${p.c.padEnd(w)}  ${P[p.key]}`).join("\n");
  }

  $("#params").addEventListener("input", e => {
    const k = e.target.dataset.p;
    if (!k) return;
    const def = PARAMS.find(p => p.key === k);
    P[k] = +e.target.value;
    $("#pv-" + k).textContent = P[k] + def.unit;
    store.set("pr.params", JSON.stringify(P));
    renderCSnippet();
  });
  $("#copy-c").addEventListener("click", () => window.PR.copyText($("#param-c").textContent));
  $("#reset-params").addEventListener("click", () => {
    PARAMS.forEach(p => P[p.key] = p.def);
    store.set("pr.params", JSON.stringify(P));
    renderParams();
    window.PR.toast("已恢复默认参数");
  });

  /* ---------------- game state ---------------- */

  let S;
  let gameId = 0;
  const log = [];

  function addLog(msg) {
    log.unshift(msg);
    log.length = Math.min(log.length, 40);
    $("#log").innerHTML = log.map(l => `<li>${l}</li>`).join("");
  }

  function newGame() {
    gameId++;
    S = {
      hp: [P.hp, P.hp], burn: [0, 0], shield: [false, false], cd: [0, 0],
      turn: 0, round: 1, phase: "ready",
      charge: 0, over: false, t0: 0, raw: 0,
      zone: 40, cursor: 0, result: null, winner: null, justUsed: false,
    };
    log.length = 0;
    addLog("对战开始！焰灵 Ember 先攻。");
    render();
  }

  const att = () => S.turn;
  const def = () => 1 - S.turn;

  function popup(i, text, heal) {
    const f = $("#f" + i);
    const el = document.createElement("div");
    el.className = "pop" + (heal ? " heal" : "");
    el.textContent = text;
    f.appendChild(el);
    setTimeout(() => el.remove(), 1000);
    if (!heal) {
      f.classList.remove("hit");
      void f.offsetWidth;
      f.classList.add("hit");
    }
  }

  // Returns true if the game ended
  function damage(i, amount, why) {
    S.hp[i] = Math.max(0, S.hp[i] - amount);
    popup(i, "-" + amount);
    addLog(`${FIGHTERS[i].name} ${why}，受到 <b>${amount}</b> 点伤害`);
    if (S.hp[i] === 0) {
      S.phase = "over";
      S.winner = 1 - i;
      addLog(`🏆 ${FIGHTERS[1 - i].name} 获胜！`);
      render();
      return true;
    }
    return false;
  }

  function endTurn() {
    // Cooldown counts the attacker's own turns that pass after the skill's turn
    if (S.justUsed) S.justUsed = false;
    else if (S.cd[att()] > 0) S.cd[att()]--;
    S.phase = "wait";
    render();
    const id = gameId;
    setTimeout(() => {
      if (id !== gameId || S.phase === "over") return;
      S.turn = def();
      if (S.turn === 0) S.round++;
      startTurn();
    }, 800);
  }

  function startTurn() {
    const a = att();
    S.phase = "ready";
    S.charge = 0;
    S.over = false;
    S.result = null;
    if (S.burn[a] > 0) {
      S.burn[a]--;
      if (damage(a, BURN_DAMAGE, "被灼烧")) return;
    }
    render();
  }

  /* ---------------- actions ---------------- */

  function startCharge() {
    S.phase = "charging";
    S.t0 = performance.now();
    S.charge = 0;
    S.over = false;
    loop();
    render();
  }

  function releaseCharge() {
    const raw = (P.base + P.bonus * S.charge) * (S.over ? 0.5 : 1);
    S.raw = raw;
    addLog(`${FIGHTERS[att()].name} 出招：蓄力 ${Math.round(S.charge * 100)}%${S.over ? "（过载，伤害减半）" : ""}`);
    S.phase = "defending";
    S.zone = 10 + Math.random() * (85 - P.windowPct);
    S.cursor = 0;
    S.t0 = performance.now();
    loop();
    render();
  }

  function defend(byPress) {
    const c = S.cursor, z = S.zone, w = P.windowPct;
    let r = "miss";
    if (byPress && c >= z && c <= z + w) {
      r = (c >= z + w * 0.35 && c <= z + w * 0.65) ? "perfect" : "good";
    }
    S.result = r;
    const d = def();
    let mult = MULT[r];
    let why = RESULT_TXT[r];
    if (S.shield[d]) {
      mult *= 0.5;
      S.shield[d] = false;
      why += "，护盾抵消一半";
    }
    if (damage(d, Math.round(S.raw * mult), why)) return;
    endTurn();
  }

  function useSkill() {
    const a = att(), d = def();
    S.cd[a] = P.skillCd;
    S.justUsed = true;
    if (FIGHTERS[a].el === "fire") {
      S.burn[d] = BURN_TURNS;
      addLog(`${FIGHTERS[a].name} 使用「灼烧」！`);
      let amount = EMBER_SKILL_DAMAGE;
      let why = "被火焰击中";
      if (S.shield[d]) { amount = Math.round(amount / 2); S.shield[d] = false; why += "，护盾抵消一半"; }
      if (damage(d, amount, why)) return;
    } else {
      const healed = Math.min(TIDE_HEAL, P.hp - S.hp[a]);
      S.hp[a] += healed;
      S.shield[a] = true;
      popup(a, "+" + healed, true);
      addLog(`${FIGHTERS[a].name} 使用「潮汐护盾」，回复 ${healed} HP，获得护盾`);
    }
    endTurn();
  }

  function act(i, action, down) {
    if (!S) return;
    if (action === "charge" && i === att()) {
      if (down && S.phase === "ready") startCharge();
      else if (!down && S.phase === "charging") releaseCharge();
    } else if (action === "defend" && down && i === def() && S.phase === "defending") {
      defend(true);
    } else if (action === "skill" && down && i === att() && S.phase === "ready" && S.cd[i] === 0) {
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
        S.charge = Math.min(1, held / P.chargeMs);
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
    FIGHTERS.forEach((f, i) => {
      $("#f" + i).innerHTML = `
        <div class="name">${f.name}</div>
        <div class="role-lbl"></div>
        ${spriteSvg(f.el)}
        <div class="hp"><i></i></div>
        <div class="hpnum"></div>
        <div class="badges"></div>
        <div class="pad">
          <button data-i="${i}" data-a="charge">蓄力<kbd>按住 ${f.keys.charge}</kbd></button>
          <button data-i="${i}" data-a="defend">防御<kbd>${f.keys.defend}</kbd></button>
          <button data-i="${i}" data-a="skill">${f.skill}<kbd>${f.keys.skill}</kbd></button>
        </div>`;
    });
  }

  function renderGauges() {
    const fill = $("#charge-fill");
    fill.style.width = (S.charge * 100) + "%";
    fill.classList.toggle("over", S.over);
    $("#charge-val").textContent = S.over ? "过载！" : Math.round(S.charge * 100) + "%";

    const showZone = S.phase === "defending" || S.result;
    $("#def-zone").style.display = showZone ? "" : "none";
    $("#def-zone").style.left = S.zone + "%";
    $("#def-zone").style.width = P.windowPct + "%";
    $("#def-perfect").style.left = "35%";
    $("#def-perfect").style.width = "30%";
    $("#def-cursor").style.left = `calc(${S.cursor}% - 1.5px)`;
    $("#def-cursor").style.display = showZone ? "" : "none";
    $("#def-val").textContent = S.result ? RESULT_TXT[S.result] : (S.phase === "defending" ? "看准时机！" : "—");
  }

  function render() {
    FIGHTERS.forEach((f, i) => {
      const el = $("#f" + i);
      const isAtt = i === att();
      el.classList.toggle("turn", S.phase !== "over" && ((isAtt && S.phase !== "defending") || (!isAtt && S.phase === "defending")));
      el.classList.toggle("ko", S.hp[i] === 0);
      el.querySelector(".role-lbl").textContent =
        S.phase === "over" ? (S.winner === i ? "🏆 胜利" : "倒下了") : isAtt ? "进攻方" : "防守方";
      el.querySelector(".hp i").style.width = (S.hp[i] / P.hp * 100) + "%";
      el.querySelector(".hpnum").textContent = `HP ${S.hp[i]} / ${P.hp}`;

      const badges = [];
      if (S.burn[i]) badges.push(`🔥 灼烧 ×${S.burn[i]}`);
      if (S.shield[i]) badges.push("🛡 护盾");
      badges.push(S.cd[i] ? `技能冷却 ${S.cd[i]}` : "技能就绪");
      el.querySelector(".badges").innerHTML = badges.map(b => `<span class="badge">${b}</span>`).join("");

      const [bc, bd, bs] = el.querySelectorAll(".pad button");
      bc.disabled = !(isAtt && (S.phase === "ready" || S.phase === "charging"));
      bc.classList.toggle("held", isAtt && S.phase === "charging");
      bd.disabled = !(!isAtt && S.phase === "defending");
      bs.disabled = !(isAtt && S.phase === "ready" && S.cd[i] === 0);
    });

    const a = FIGHTERS[att()], d = FIGHTERS[def()];
    const kbd = k => `<kbd class="mono">${k}</kbd>`;
    const prompts = {
      ready: `<span><b>${a.name}</b> 进攻：按住 ${kbd(a.keys.charge)} 蓄力，松开出招` +
        (S.cd[att()] ? `（技能冷却中）` : `；或按 ${kbd(a.keys.skill)} 使用「${a.skill}」`) + `</span>`,
      charging: S.over ? `<span style="color:var(--danger)">过载了！现在松开伤害减半</span>` : `蓄力中… 松开 ${kbd(a.keys.charge)} 出招`,
      defending: `<span><b>${d.name}</b> 防御！光标在绿色区域时按 ${kbd(d.keys.defend)}</span>`,
      wait: `<span class="muted">${S.result ? RESULT_TXT[S.result] : "回合结束"}…</span>`,
      over: S.winner !== null ? `<span>🏆 <b>${FIGHTERS[S.winner].name}</b> 获胜！点“重新开始”再来一局</span>` : "",
    };
    $("#prompt").innerHTML = prompts[S.phase];
    $("#round").textContent = S.round;
    renderGauges();
  }

  /* ---------------- input ---------------- */

  const KEYMAP = {};
  FIGHTERS.forEach((f, i) => Object.entries(f.keys).forEach(([a, k]) => KEYMAP[k.toLowerCase()] = [i, a]));

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
    if (m && m[1] === "charge") act(m[0], "charge", false);
  });

  const arena = document.querySelector(".arena");
  arena.addEventListener("pointerdown", e => {
    const b = e.target.closest(".pad button");
    if (!b || b.disabled) return;
    e.preventDefault();
    b.setPointerCapture?.(e.pointerId);
    act(+b.dataset.i, b.dataset.a, true);
  });
  const release = e => {
    const b = e.target.closest?.(".pad button");
    if (b && b.dataset.a === "charge") act(+b.dataset.i, "charge", false);
  };
  arena.addEventListener("pointerup", release);
  arena.addEventListener("pointercancel", release);
  arena.addEventListener("contextmenu", e => { if (e.target.closest(".pad")) e.preventDefault(); });
  // Releasing a held key while switching tabs or windows should still fire the attack
  window.addEventListener("blur", () => { if (S && S.phase === "charging") releaseCharge(); });

  $("#restart").addEventListener("click", newGame);

  buildFighters();
  renderParams();
  newGame();
})();
