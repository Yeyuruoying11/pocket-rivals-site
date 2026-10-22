// Pocket Rivals handheld simulator: debug panel, gamepads, gallery, fixture
// runner, exports, SPI budget table (docs/ui-design.md §8.9)
//
// DOM only, built in DEVICE.onStart(dom) into dom.debug; colors come from the
// style.css tokens (light and dark). It never touches the simulation's random
// streams and only reads state on a timer, so ?test=1 runs stay deterministic;
// gamepads are polled only outside ?test=1. Strings: dev.dbg.* (m charset:
// they are linted like the handheld strings). The only checkboxes are the two
// "Player n: computer" boxes (P1, P2), the other switches are toggle buttons.
(() => {
  const D = window.DEVICE;
  const P = "dev.dbg.";

  D.registerStrings(P, {
    zh: {
      "dev.dbg.title": "调试面板", "dev.dbg.seed": "种子 {seed}", "dev.dbg.bot": "玩家 {n} 交给电脑",
      "dev.dbg.sim": "模拟", "dev.dbg.seedLabel": "种子", "dev.dbg.restart": "用这个种子重来", "dev.dbg.newSeed": "换个随机种子",
      "dev.dbg.speed": "速度", "dev.dbg.pause": "暂停", "dev.dbg.resume": "继续", "dev.dbg.step": "单步 {ms} ms",
      "dev.dbg.radio": "无线", "dev.dbg.preset": "预设", "dev.dbg.pPerfect": "完美", "dev.dbg.pTypical": "一般",
      "dev.dbg.pPoor": "很差", "dev.dbg.pDead": "几乎断开", "dev.dbg.loss": "丢包 {v}%", "dev.dbg.latency": "延迟 {a} 到 {b} ms",
      "dev.dbg.collisions": "同信道会冲突", "dev.dbg.radioStats": "发出 {sent}，丢掉 {lost}，{bps} B/s，占空 {air}%",
      "dev.dbg.boards": "板子", "dev.dbg.player": "玩家 {n}", "dev.dbg.central": "中央板",
      "dev.dbg.hand": "手的高度 {mm} mm",
      "dev.dbg.tilt": "倾斜 {deg} 度（x = {mg} mg）", "dev.dbg.acc": "拿掉加速度计", "dev.dbg.tiltInv": "手机倾斜反向",
      "dev.dbg.fair": "攻击测试公平表", "dev.dbg.fairRun": "跑一遍", "dev.dbg.fairRunning": "计算中…",
      "dev.dbg.fairNote": "每种 bot 跑 {n} 个种子（attack-trial.md 2C 的模型），参数用现在的调参；不符合目标的格子标红。",
      "dev.dbg.fairPet": "宠物", "dev.dbg.fairSkill": "玩家", "dev.dbg.fairFirst": "第一次玩", "dev.dbg.fairGood": "熟练",
      "dev.dbg.fairTop5": "熟练 bot 各打 {n} 局（每天每只 10 局，榜上留 5 个）：进前 5 的比例 焰灵 {a}%，潮影 {b}%，叶芽 {c}%",
      "dev.dbg.fairBad": "没达到的目标：{s}", "dev.dbg.fairOk": "2C 的目标都达到了",
      "dev.dbg.unplug": "拔掉无线", "dev.dbg.reboot": "重启", "dev.dbg.powerOff": "关掉电源", "dev.dbg.channel": "信道",
      "dev.dbg.version": "烧录版本", "dev.dbg.joy": "拔掉摇杆", "dev.dbg.sd": "拿掉SD卡", "dev.dbg.pad": "拔掉压力垫",
      "dev.dbg.hw": "硬件", "dev.dbg.fsrInv": "FSR分压反接", "dev.dbg.spi": "SPI时钟", "dev.dbg.blocks": "显示变化的块",
      "dev.dbg.cover": "暗选时遮住电脑的屏幕", "dev.dbg.coverText": "暗选中", "dev.dbg.peek": "按住偷看",
      "dev.dbg.readouts": "每台掌机", "dev.dbg.screen": "画面", "dev.dbg.fps": "帧率", "dev.dbg.pxFrame": "上一帧像素",
      "dev.dbg.peak": "1秒内最多", "dev.dbg.bytes": "字节", "dev.dbg.spiMs": "SPI ms", "dev.dbg.overBudget": "超预算帧",
      "dev.dbg.budget": "绿 <= {g} px，黄 <= {y} px，再多是红", "dev.dbg.levels": "最近1秒：绿 {g}，黄 {y}，红 {r}",
      "dev.dbg.centralCard": "中央板", "dev.dbg.mode": "模式", "dev.dbg.phase": "阶段", "dev.dbg.stepN": "step",
      "dev.dbg.links": "链路", "dev.dbg.paused": "暂停中", "dev.dbg.none": "无", "dev.dbg.yes": "是", "dev.dbg.no": "否",
      "dev.dbg.snapshot": "快照", "dev.dbg.off": "没电",
      "dev.dbg.rank": "今日排行榜", "dev.dbg.rankClear": "清空排行榜", "dev.dbg.rankHoldAB": "开机时按住 A+B",
      "dev.dbg.rankLine": "今日编号 {e}，记录 {n}/255，第 {p} 页", "dev.dbg.rankPend": "待填名次：{s}", "dev.dbg.rankEmpty": "（空）",
      "dev.dbg.msgs": "消息大小", "dev.dbg.flash": "flash 预算",
      "dev.dbg.glyphLine": "汉字和全角标点 {n} 个 x 18 B = {b} B", "dev.dbg.spriteLine": "sprite {n} 个 = {b} B",
      "dev.dbg.drawn": "画过的字 {n} 个", "dev.dbg.missing": "缺字：{s}", "dev.dbg.fontNull": "字库表没有加载，中文用 fillText 代替",
      "dev.dbg.lint": "lint {n} 条", "dev.dbg.lintNone": "没有问题", "dev.dbg.clear": "清空", "dev.dbg.errors": "错误 {n} 条",
      "dev.dbg.tune": "调参和导出", "dev.dbg.noParams": "没有可调参数", "dev.dbg.defaults": "恢复默认",
      "dev.dbg.export": "导出 {file}", "dev.dbg.applyNote": "下一局开始时生效，存在这台电脑上",
      "dev.dbg.exportGlyphs": "导出用到的字", "dev.dbg.exportStrings": "导出字符串 JSON", "dev.dbg.png": "P{n} 画面 PNG x4",
      "dev.dbg.makeFont": "给 make_font.py 用：两份 JSON 都传给 --export",
      "dev.dbg.pads": "手柄", "dev.dbg.padNone": "没有手柄。接上以后按一下任意键。",
      "dev.dbg.padMap": "摇杆和十字键 = 摇杆，A = A，B = B，X 或 Y = SKILL，Start = MENU，右扳机 = 压力垫",
      "dev.dbg.padFor": "控制", "dev.dbg.padOff": "不用",
      "dev.dbg.gallery": "Gallery 和 fixture", "dev.dbg.runAll": "全部运行", "dev.dbg.run": "运行", "dev.dbg.pass": "通过",
      "dev.dbg.fail": "失败", "dev.dbg.running": "运行中…", "dev.dbg.noFixtures": "还没有注册 fixture",
      "dev.dbg.galleryNote": "fixture 会重置模拟。跑完以后点「用这个种子重来」回到正常模拟。",
      "dev.dbg.summary": "{ok} 个通过，{bad} 个失败",
    },
    en: {
      "dev.dbg.title": "Debug panel", "dev.dbg.seed": "Seed {seed}", "dev.dbg.bot": "Player {n}: computer",
      "dev.dbg.sim": "Simulation", "dev.dbg.seedLabel": "Seed", "dev.dbg.restart": "Restart with this seed", "dev.dbg.newSeed": "Random seed",
      "dev.dbg.speed": "Speed", "dev.dbg.pause": "Pause", "dev.dbg.resume": "Resume", "dev.dbg.step": "Step {ms} ms",
      "dev.dbg.radio": "Radio", "dev.dbg.preset": "Preset", "dev.dbg.pPerfect": "Perfect", "dev.dbg.pTypical": "Typical",
      "dev.dbg.pPoor": "Poor", "dev.dbg.pDead": "Nearly dead", "dev.dbg.loss": "Loss {v}%", "dev.dbg.latency": "Latency {a} to {b} ms",
      "dev.dbg.collisions": "Same-channel collisions", "dev.dbg.radioStats": "sent {sent}, lost {lost}, {bps} B/s, air {air}%",
      "dev.dbg.boards": "Boards", "dev.dbg.player": "Player {n}", "dev.dbg.central": "Central",
      "dev.dbg.hand": "Hand height {mm} mm",
      "dev.dbg.tilt": "Tilt {deg} deg (x = {mg} mg)", "dev.dbg.acc": "Remove accelerometer", "dev.dbg.tiltInv": "Flip phone tilt",
      "dev.dbg.fair": "Attack trial fairness", "dev.dbg.fairRun": "Run", "dev.dbg.fairRunning": "Working...",
      "dev.dbg.fairNote": "Each bot plays {n} seeds (the models of attack-trial.md 2C) at the current tuning; cells that miss a target are red.",
      "dev.dbg.fairPet": "Pet", "dev.dbg.fairSkill": "Player", "dev.dbg.fairFirst": "first time", "dev.dbg.fairGood": "skilled",
      "dev.dbg.fairTop5": "Skilled bots, {n} games each (days of 10 per pet, a board of 5): share of the top 5 Ember {a}%, Tide {b}%, Sprout {c}%",
      "dev.dbg.fairBad": "Targets missed: {s}", "dev.dbg.fairOk": "All 2C targets met",
      "dev.dbg.unplug": "Unplug radio", "dev.dbg.reboot": "Reboot", "dev.dbg.powerOff": "Power off", "dev.dbg.channel": "Channel",
      "dev.dbg.version": "Firmware", "dev.dbg.joy": "Unplug stick", "dev.dbg.sd": "Remove SD card", "dev.dbg.pad": "Unplug pad",
      "dev.dbg.hw": "Hardware", "dev.dbg.fsrInv": "FSR wired backwards", "dev.dbg.spi": "SPI clock", "dev.dbg.blocks": "Show changed blocks",
      "dev.dbg.cover": "Hide the computer's secret pick", "dev.dbg.coverText": "Secret pick", "dev.dbg.peek": "Hold to peek",
      "dev.dbg.readouts": "Handhelds", "dev.dbg.screen": "Screen", "dev.dbg.fps": "fps", "dev.dbg.pxFrame": "px last frame",
      "dev.dbg.peak": "max in 1 s", "dev.dbg.bytes": "bytes", "dev.dbg.spiMs": "SPI ms", "dev.dbg.overBudget": "over budget",
      "dev.dbg.budget": "green <= {g} px, yellow <= {y} px, more is red", "dev.dbg.levels": "last 1 s: green {g}, yellow {y}, red {r}",
      "dev.dbg.centralCard": "Central board", "dev.dbg.mode": "Mode", "dev.dbg.phase": "Phase", "dev.dbg.stepN": "step",
      "dev.dbg.links": "Links", "dev.dbg.paused": "Paused", "dev.dbg.none": "none", "dev.dbg.yes": "yes", "dev.dbg.no": "no",
      "dev.dbg.snapshot": "Snapshot", "dev.dbg.off": "off",
      "dev.dbg.rank": "Today's leaderboard", "dev.dbg.rankClear": "Clear leaderboard", "dev.dbg.rankHoldAB": "Power up holding A+B",
      "dev.dbg.rankLine": "day {e}, records {n}/255, page {p}", "dev.dbg.rankPend": "waiting for initials: {s}", "dev.dbg.rankEmpty": "(empty)",
      "dev.dbg.msgs": "Message sizes", "dev.dbg.flash": "Flash budget",
      "dev.dbg.glyphLine": "{n} CJK glyphs x 18 B = {b} B", "dev.dbg.spriteLine": "{n} sprites = {b} B",
      "dev.dbg.drawn": "{n} glyphs drawn so far", "dev.dbg.missing": "Missing: {s}", "dev.dbg.fontNull": "Font table not loaded: CJK drawn with fillText",
      "dev.dbg.lint": "Lint: {n}", "dev.dbg.lintNone": "All clean", "dev.dbg.clear": "Clear", "dev.dbg.errors": "Errors: {n}",
      "dev.dbg.tune": "Tuning and export", "dev.dbg.noParams": "No parameters", "dev.dbg.defaults": "Defaults",
      "dev.dbg.export": "Export {file}", "dev.dbg.applyNote": "Takes effect next match; saved on this computer",
      "dev.dbg.exportGlyphs": "Export used glyphs", "dev.dbg.exportStrings": "Export strings JSON", "dev.dbg.png": "P{n} screen PNG x4",
      "dev.dbg.makeFont": "For make_font.py: pass both JSON files with --export",
      "dev.dbg.pads": "Gamepads", "dev.dbg.padNone": "No gamepad. Connect one and press any button.",
      "dev.dbg.padMap": "Stick and d-pad = stick, A = A, B = B, X or Y = SKILL, Start = MENU, right trigger = pad",
      "dev.dbg.padFor": "Drives", "dev.dbg.padOff": "Off",
      "dev.dbg.gallery": "Gallery and fixtures", "dev.dbg.runAll": "Run all", "dev.dbg.run": "Run", "dev.dbg.pass": "pass",
      "dev.dbg.fail": "fail", "dev.dbg.running": "Running…", "dev.dbg.noFixtures": "No fixtures registered yet",
      "dev.dbg.galleryNote": "Fixtures reset the simulation. Afterwards press 'Restart with this seed' to play again.",
      "dev.dbg.summary": "{ok} passed, {bad} failed",
    },
  });

  const t = (k, v) => I18N.t(P + k, v);
  const store = {
    get(k, def) { try { const v = localStorage.getItem("pr.device.dbg." + k); return v == null ? def : JSON.parse(v); } catch { return def; } },
    set(k, v) { try { localStorage.setItem("pr.device.dbg." + k, JSON.stringify(v)); } catch {} },
  };

  function el(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === "class") e.className = v;
      else if (k === "text") e.textContent = v;
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? "" : v);
    }
    for (const kid of kids) if (kid != null && kid !== false) e.append(kid);
    return e;
  }
  const card = (title, ...kids) => el("section", {class: "dbg-card"}, el("h3", {text: title}), ...kids);
  const row = (...kids) => el("div", {class: "dbg-row"}, ...kids);
  const btn = (label, onclick, cls) => el("button", {type: "button", class: "dbg-btn" + (cls ? " " + cls : ""), text: label, onclick});
  // a switch: aria-pressed button; get() is read on every refresh so it follows the simulation
  const toggles = [];
  function toggle(label, get, set) {
    const b = el("button", {type: "button", class: "dbg-tog", text: label});
    b.addEventListener("click", () => { set(!get()); sync(); });
    const sync = () => b.setAttribute("aria-pressed", String(!!get()));
    toggles.push(sync);
    sync();
    return b;
  }
  function select(label, options, get, set) {
    const s = el("select", {class: "dbg-sel", "aria-label": label});
    for (const [v, text] of options) s.append(el("option", {value: String(v), text}));
    s.addEventListener("change", () => set(s.value));
    const sync = () => { const v = String(get()); if (s.value !== v && document.activeElement !== s) s.value = v; };
    toggles.push(sync);
    sync();
    return el("label", {class: "dbg-field"}, el("span", {text: label}), s);
  }
  function download(name, data, type) {
    const a = el("a", {download: name});
    a.href = typeof data === "string" && data.startsWith("data:") ? data : URL.createObjectURL(new Blob([data], {type: type || "text/plain"}));
    document.body.append(a);
    a.click();
    a.remove();
    if (!a.href.startsWith("data:")) setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  const W = () => D.world();
  const json = v => JSON.stringify(v, (k, x) => x instanceof Uint8Array ? Array.from(x) : x);

  const CSS = `
.dbg { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 16px; align-items: start; }
.dbg-head { grid-column: 1 / -1; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 14px; }
.dbg-head h2 { margin: 0; font-size: 20px; }
.dbg-card { min-width: 0; padding: 14px 16px 16px; border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); font-size: 13px; color: var(--ink); }
.dbg-card.wide { grid-column: 1 / -1; }
.dbg-card h3 { margin: 0 0 10px; font-size: 15px; }
.dbg-card h4 { margin: 12px 0 6px; font-size: 13px; color: var(--muted); font-weight: 600; }
.dbg-row { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin: 6px 0; }
.dbg-muted { color: var(--muted); }
.dbg-btn, .dbg-tog, .dbg-sel, .dbg-num { font: inherit; font-size: 13px; color: var(--ink); background: var(--surface-2); border: 1px solid var(--line); border-radius: 8px; padding: 4px 10px; min-height: 30px; }
.dbg-btn, .dbg-tog { cursor: pointer; }
.dbg-btn:hover, .dbg-tog:hover { border-color: var(--muted); }
.dbg-btn.primary { background: var(--accent); border-color: var(--accent); color: var(--surface); }
.dbg-tog[aria-pressed="true"] { background: var(--accent-soft); border-color: var(--accent); color: var(--accent); font-weight: 600; }
.dbg-num { width: 8.5em; padding: 4px 6px; }
.dbg-field { display: inline-flex; align-items: center; gap: 6px; }
.dbg-field span { color: var(--muted); }
.dbg-slider { display: grid; grid-template-columns: minmax(0, 1fr); gap: 2px; margin: 6px 0; }
.dbg-slider input { width: 100%; accent-color: var(--accent); }
.dbg-check { display: inline-flex; align-items: center; gap: 6px; cursor: pointer; }
.dbg-check input { accent-color: var(--accent); width: 16px; height: 16px; }
.dbg-board { border-top: 1px solid var(--line); padding-top: 8px; margin-top: 8px; }
.dbg-board b { display: block; margin-bottom: 2px; }
.dbg-table-wrap { max-width: 100%; overflow-x: auto; }
.dbg-table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
.dbg-table th, .dbg-table td { padding: 3px 8px 3px 0; text-align: left; vertical-align: top; white-space: nowrap; }
.dbg-table thead th { color: var(--muted); font-weight: 600; }
.dbg-table td.num { text-align: right; }
.dbg-meter { position: relative; height: 8px; min-width: 60px; border-radius: 4px; background: var(--surface-2); overflow: hidden; }
.dbg-meter i { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: var(--good); }
.dbg-meter i.yellow { background: var(--doing); }
.dbg-meter i.red { background: var(--danger); }
.dbg-pre { margin: 6px 0 0; max-height: 220px; overflow: auto; padding: 8px; border-radius: 8px; background: var(--surface-2); font: 12px/1.45 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; word-break: break-all; }
.dbg-lint { max-height: 240px; overflow: auto; margin: 6px 0 0; padding: 0; list-style: none; }
.dbg-lint li { padding: 4px 0; border-bottom: 1px solid var(--line); overflow-wrap: anywhere; }
.dbg-lint code { font-size: 12px; }
.dbg-kind { display: inline-block; padding: 0 6px; margin-right: 6px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); font-weight: 600; font-size: 12px; }
.dbg-kind.bad { background: color-mix(in srgb, var(--danger) 14%, transparent); color: var(--danger); }
.dbg-ok { color: var(--good); font-weight: 600; }
.dbg-bad { color: var(--danger); font-weight: 600; }
.dbg-fix { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 4px 10px; align-items: center; }
.dbg-fix > span { overflow-wrap: anywhere; }
.dbg-shots { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 10px; }
.dbg-shot { margin: 0; display: flex; flex-direction: column; gap: 4px; }
.dbg-shot div { display: flex; gap: 4px; }
.dbg-shot img { width: 128px; height: 160px; image-rendering: pixelated; border-radius: 4px; background: #000; }
.dbg-shot figcaption { max-width: 260px; font-size: 12px; color: var(--muted); overflow-wrap: anywhere; }
.dbg-cover { position: absolute; inset: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; border-radius: 4px; background: repeating-linear-gradient(45deg, #1b1e2e 0 10px, #23273a 10px 20px); color: #e9e9f2; font-size: 14px; font-weight: 600; line-height: 1.3; text-align: center; cursor: pointer; user-select: none; -webkit-user-select: none; touch-action: none; }
.dbg-cover small { font-weight: 400; color: #b9bad0; }
.dbg-cover[hidden] { display: none; }
.dbg-blocks { position: absolute; left: 8px; top: 8px; pointer-events: none; }
.dbg-blocks i { position: absolute; box-sizing: border-box; background: rgba(255, 0, 200, .35); border: 1px solid rgba(255, 0, 200, .9); }
`;

  D.onStart(dom => {
    if (!document.getElementById("dbg-style")) document.head.append(el("style", {id: "dbg-style", text: CSS}));
    const opt = {blocks: store.get("blocks", false), cover: store.get("cover", true)};
    const root = el("div", {class: "dbg"});
    const seedLine = el("span", {class: "dbg-muted"});
    root.append(el("div", {class: "dbg-head"}, el("h2", {text: t("title")}), seedLine));

    /* ---------- simulation ---------- */
    const seedIn = el("input", {class: "dbg-num", type: "number", min: "0", step: "1", "aria-label": t("seedLabel")});
    const restart = seed => { D.reset({seed: seed >>> 0}); seedIn.value = String(D.seed()); };
    const pauseBtn = btn(t("pause"), () => { if (W().running) D.pause(); else D.resume(); refresh(); });
    const speeds = [[0.25, "0.25x"], [0.5, "0.5x"], [1, "1x"], [1.5, "1.5x"], [2, "2x"]];
    const lossOut = el("span"), latOut = el("span");
    const lossIn = el("input", {type: "range", min: "0", max: "60", step: "1", "aria-label": t("radio")});
    const latIn = el("input", {type: "range", min: "4", max: "200", step: "2", "aria-label": t("radio")});
    const setLat = v => D.radio.set({latency: [Math.max(1, Math.round(v / 4)), v]});
    lossIn.addEventListener("input", () => { D.radio.set({loss: +lossIn.value / 100}); refresh(); });
    latIn.addEventListener("input", () => { setLat(+latIn.value); refresh(); });
    const presets = [["pPerfect", 0, 4, false], ["pTypical", 5, 12, true], ["pPoor", 20, 60, true], ["pDead", 60, 160, true]];
    const radioStats = el("div", {class: "dbg-muted"});
    toggles.push(() => {
      const r = W().radio;
      if (document.activeElement !== lossIn) lossIn.value = String(Math.round(r.loss * 100));
      if (document.activeElement !== latIn) latIn.value = String(r.latency[1]);
      lossOut.textContent = t("loss", {v: Math.round(r.loss * 100)});
      latOut.textContent = t("latency", {a: r.latency[0], b: r.latency[1]});
      pauseBtn.textContent = W().running ? t("pause") : t("resume");
    });
    root.append(card(t("sim"),
      row(seedIn, btn(t("restart"), () => restart(+seedIn.value || 0), "primary"),
        btn(t("newSeed"), () => restart(Math.floor(Math.random() * 0x7fffffff)))),
      row(select(t("speed"), speeds, () => D.speed(), v => D.speed(+v)),
        pauseBtn, btn(t("step", {ms: 50}), () => { D.pause(); D.step(50); refresh(); }),
        btn(t("step", {ms: 1000}), () => { D.pause(); D.step(1000); refresh(); })),
      el("h4", {text: t("radio")}),
      row(el("span", {class: "dbg-muted", text: t("preset")}),
        ...presets.map(([k, loss, lat, col]) => btn(t(k), () => { D.radio.set({loss: loss / 100, collisions: col}); setLat(lat); refresh(); }))),
      el("label", {class: "dbg-slider"}, lossOut, lossIn),
      el("label", {class: "dbg-slider"}, latOut, latIn),
      row(toggle(t("collisions"), () => W().radio.collisions, v => D.radio.set({collisions: v}))),
      radioStats,
      el("h4", {text: t("hw")}),
      row(select(t("spi"), [[8, "8 MHz"], [16, "16 MHz"]], () => W().spiMhz, v => { W().spiMhz = +v; }),
        toggle(t("fsrInv"), () => W().fsrInverted, v => { W().fsrInverted = v; })),
      row(toggle(t("blocks"), () => opt.blocks, v => { opt.blocks = v; store.set("blocks", v); }),
        toggle(t("cover"), () => opt.cover, v => { opt.cover = v; store.set("cover", v); }))));

    /* ---------- boards ---------- */
    const channels = [];
    for (let c = 11; c <= 26; c++) channels.push([c, String(c)]);
    const V = D.C.PROTOCOL_VERSION;
    const versions = [V - 2, V - 1, V, V + 1].filter(v => v > 0).map(v => [v, "v" + v]);
    const node = i => W().radio.nodes[i];
    const boards = [0, 1].map(p => {
      const box = el("input", {type: "checkbox"});
      box.checked = D.bot(p);
      box.addEventListener("change", () => D.bot(p, box.checked));
      toggles.push(() => { box.checked = D.bot(p); });
      const caps = k => !D.caps(p)[k];
      // the handheld's left-right tilt (ui-design §8.6): degrees -> mg = round(1000 sin)
      const tiltIn = el("input", {type: "range", min: "-90", max: "90", step: "1", value: "0", "aria-label": t("tilt", {deg: "", mg: ""})});
      const tiltOut = el("span");
      tiltIn.addEventListener("input", () => D.tilt(p, Math.round(1000 * Math.sin(+tiltIn.value * Math.PI / 180)), "slider"));
      toggles.push(() => {
        const mg = D.tilt(p), deg = Math.round(Math.asin(Math.max(-1, Math.min(1, mg / 1000))) * 180 / Math.PI);
        if (document.activeElement !== tiltIn) tiltIn.value = String(deg);
        tiltOut.textContent = t("tilt", {deg, mg});
      });
      const handIn = el("input", {type: "range", min: "0", max: "1300", step: "10", "aria-label": t("hand", {mm: ""})});
      const handOut = el("span");
      handIn.addEventListener("input", () => D.hand(p, +handIn.value));
      toggles.push(() => {
        const v = D.hand(p);
        if (document.activeElement !== handIn) handIn.value = String(v);
        handOut.textContent = t("hand", {mm: v});
      });
      return el("div", {class: "dbg-board"}, el("b", {text: t("player", {n: p + 1})}),
        row(el("label", {class: "dbg-check"}, box, t("bot", {n: p + 1}))),
        row(toggle(t("unplug"), () => !node(p + 1).plugged, v => D.radio.unplug(p, v)),
          btn(t("reboot"), () => D.reboot(p)),
          select(t("channel"), channels, () => node(p + 1).ch, v => D.radio.channel(p, +v)),
          select(t("version"), versions, () => node(p + 1).ver, v => D.radio.version(p + 1, +v))),
        row(toggle(t("joy"), () => caps("joy"), v => D.caps(p, {joy: !v})),
          toggle(t("pad"), () => caps("pad"), v => D.caps(p, {pad: !v})),
          toggle(t("sd"), () => caps("snd"), v => D.caps(p, {snd: !v}))),
        row(toggle(t("acc"), () => caps("acc"), v => D.caps(p, {acc: !v})),
          toggle(t("tiltInv"), () => D.tiltInvert(p), v => D.tiltInvert(p, v))),
        el("label", {class: "dbg-slider"}, handOut, handIn),
        el("label", {class: "dbg-slider"}, tiltOut, tiltIn));
    });
    const centralBoard = el("div", {class: "dbg-board"}, el("b", {text: t("central")}),
      row(toggle(t("powerOff"), () => !W().central.powered, v => D.radio.powerCentral(!v)),
        select(t("channel"), channels, () => node(0).ch, v => D.radio.channel("central", +v)),
        select(t("version"), versions, () => node(0).ver, v => D.radio.version(0, +v))));
    root.append(card(t("boards"), ...boards, centralBoard));

    /* ---------- attack trial fairness (attack-trial.md §2C, ui-design §8.9) ---------- */
    const fairBody = el("tbody"), fairTop = el("p", {class: "dbg-muted"}), fairChecks = el("p");
    const SEEDS = 400, GAMES = 1000;
    const fairBtn = btn(t("fairRun"), () => runFair(), "primary");
    let fairSig = null;
    const fairCols = ["p10", "median", "p90", "ge50", "ge80"];
    function runFair() {
      fairBtn.disabled = true;
      fairBtn.textContent = t("fairRunning");
      setTimeout(() => {
        const bp = D.battleParams();
        fairSig = JSON.stringify(bp);
        let r;
        try { r = D.petTrials.fairness(bp, {seeds: SEEDS, games: GAMES}); } finally { fairBtn.disabled = false; fairBtn.textContent = t("fairRun"); }
        const bad = new Set(r.checks.filter(c => !c.ok).map(c => c.what));
        const badCell = (row, col) => {
          const pre = row.pet + " " + row.skill;
          if (col === "median") return bad.has(pre + " median 50-60") || bad.has(row.pet + " skilled median 80-90") && row.skill === "good" || bad.has(row.skill + " medians within 5");
          if (col === "p90") return bad.has(row.skill + " p90 within 5") || row.skill === "good" && bad.has(row.pet + " skilled p90 under 100");
          if (col === "ge80") return row.skill === "first" ? bad.has(row.pet + " first >= 80 at most 10%") : bad.has(row.pet + " skilled >= 80 at least half");
          return false;
        };
        const petName = k => I18N.t("dev.pet." + k);
        fairBody.textContent = "";
        for (const row of r.rows) {
          fairBody.append(el("tr", null, el("th", {scope: "row", text: petName(row.pet)}), el("td", {text: t(row.skill === "good" ? "fairGood" : "fairFirst")}),
            ...fairCols.map(c => el("td", {class: "num" + (badCell(row, c) ? " dbg-bad" : ""), text: String(row[c]) + (c.startsWith("ge") ? "%" : "")}))));
        }
        fairTop.textContent = t("fairTop5", {n: GAMES, a: r.top5.ember, b: r.top5.tide, c: r.top5.sprout});
        const miss = r.checks.filter(c => !c.ok);
        fairChecks.className = miss.length ? "dbg-bad" : "dbg-ok";
        fairChecks.textContent = miss.length ? t("fairBad", {s: miss.map(c => c.what + " (" + c.detail + ")").join(", ")}) : t("fairOk");
      }, 30);
    }
    // the prototype's tuning lives in this browser: run again when it changed
    toggles.push(() => { if (fairSig != null && fairSig !== JSON.stringify(D.battleParams()) && !fairBtn.disabled) runFair(); });
    root.append(el("section", {class: "dbg-card wide"}, el("h3", {text: t("fair")}),
      el("p", {class: "dbg-muted", text: t("fairNote", {n: SEEDS})}), row(fairBtn),
      el("div", {class: "dbg-table-wrap"}, el("table", {class: "dbg-table"},
        el("thead", null, el("tr", null, el("th", {text: t("fairPet")}), el("th", {text: t("fairSkill")}),
          ...["p10", "p50", "p90", ">= 50", ">= 80"].map(h => el("th", {class: "num", text: h})))), fairBody)),
      fairTop, fairChecks));

    /* ---------- per handheld readouts (SPI budget table) ---------- */
    const C = D.C;
    const hist = [[], []];            // [{t, px, level}] for the last second, from "frame" events
    const flashes = [[], []];         // changed blocks to flash: {t, rects}
    D.on("frame", f => {
      const now = performance.now();
      const h = hist[f.p];
      h.push({t: now, px: f.stats.px, level: f.stats.level});
      while (h.length && h[0].t < now - 1000) h.shift();
      if (opt.blocks && f.rects && f.rects.length) flashes[f.p].push({t: now, rects: f.rects.map(r => r.slice())});
    });
    const readRows = ["screen", "fps", "pxFrame", "peak", "bytes", "spiMs", "overBudget"];
    const readCells = readRows.map(() => [el("td"), el("td")]);
    const meters = [0, 1].map(() => el("i"));
    const levelLines = [0, 1].map(() => el("div", {class: "dbg-muted"}));
    const readTable = el("table", {class: "dbg-table"},
      el("thead", null, el("tr", null, el("th"), el("th", {text: "P1"}), el("th", {text: "P2"}))),
      el("tbody", null, ...readRows.map((k, i) => el("tr", null, el("th", {scope: "row", text: t(k)}), ...readCells[i])),
        el("tr", null, el("th", {scope: "row", text: "SPI"}), ...meters.map(m => el("td", null, el("div", {class: "dbg-meter"}, m))))));
    root.append(card(t("readouts"), el("div", {class: "dbg-table-wrap"}, readTable),
      el("p", {class: "dbg-muted", text: t("budget", {g: C.BUDGET_GREEN, y: C.BUDGET_YELLOW})}), ...levelLines.map((l, p) => (l.dataset.p = p, l))));

    /* ---------- central board ---------- */
    const centralLine = el("div");
    const snapPre = el("pre", {class: "dbg-pre"});
    // today's leaderboard (§9.9): every board, the store, the open window; clear = the central's A+B
    const rankPre = el("pre", {class: "dbg-pre"});
    const rankRow = row(btn(t("rankClear"), () => { D.rank.clear(); setTimeout(refresh, 0); }),
      btn(t("rankHoldAB"), () => { D.radio.powerCentral(false); D.radio.powerCentral(true, {holdAB: 3000}); setTimeout(refresh, 0); }));
    rankRow.dataset.rank = "1";
    root.append(card(t("centralCard"), centralLine, el("h4", {text: t("snapshot")}), snapPre, el("h4", {text: t("rank")}), rankRow, rankPre));
    function rankText() {
      if (!W().central.powered) return t("off");
      const d = D.rank.dump(), defs = D.rank.defs();
      const lines = [t("rankLine", {e: d.epoch, n: d.recCount, p: d.pageSeq})];
      for (const b of defs) {
        lines.push("0x" + b.id.toString(16).padStart(2, "0") + " " + I18N.t(b.titleKey));
        const rows = d.boards[b.id] || [];
        if (!rows.length) lines.push("  " + t("rankEmpty"));
        rows.forEach((e, i) => lines.push("  " + (i + 1) + " " + e.ini.filter(Boolean).join(" + ").padEnd(9) + " " + (b.format ? b.format(e.value).main : e.value) + "  seq " + e.seq));
      }
      if (d.pending.length) lines.push(t("rankPend", {s: d.pending.map(q => "P" + (q.p + 1) + " #" + q.rank + (q.open ? " open" : "") + (q.excluded ? " " + q.why : "")).join(", ")}));
      return lines.join("\n");
    }

    /* ---------- message sizes + flash ---------- */
    const msgBody = el("tbody");
    const flashBox = el("div");
    root.append(card(t("msgs"), el("div", {class: "dbg-table-wrap"}, el("table", {class: "dbg-table"}, msgBody)),
      el("h4", {text: t("flash")}), flashBox));
    function fillMsgs() {
      msgBody.textContent = "";
      const sizes = D.msgSizes();
      for (const [name, size] of Object.entries(sizes).sort((a, b) => a[0].localeCompare(b[0]))) {
        const i = el("i", {class: size > 64 ? "red" : size > 56 ? "yellow" : ""});
        i.style.width = Math.min(100, size / 64 * 100) + "%";
        msgBody.append(el("tr", null, el("td", null, el("code", {text: name})), el("td", {class: "num", text: size + "/64 B"}),
          el("td", {style: "width: 40%"}, el("div", {class: "dbg-meter"}, i))));
      }
    }

    /* ---------- lint + errors ---------- */
    const lintHead = el("h3"), lintList = el("ul", {class: "dbg-lint"});
    const errHead = el("h4"), errList = el("ul", {class: "dbg-lint"});
    let lintSig = "";
    const BAD = new Set(["overflow", "missingGlyph", "charset", "msgSize", "mathRandom", "redFrame", "sFont"]);
    root.append(el("section", {class: "dbg-card"}, lintHead,
      row(btn(t("clear"), () => { D.clearLint(); lintSig = ""; refresh(); })), lintList, errHead, errList));
    function fillLint() {
      const lint = D.lint(), errs = D.errors();
      const sig = lint.length + "|" + errs.length + "|" + errs.reduce((a, e) => a + e.count, 0);
      if (sig === lintSig) return;
      lintSig = sig;
      lintHead.textContent = t("lint", {n: lint.length});
      lintList.textContent = "";
      if (!lint.length) lintList.append(el("li", {class: "dbg-ok", text: t("lintNone")}));
      for (const l of lint.slice(0, 200)) {
        const d = l.detail == null ? "" : typeof l.detail === "string" ? l.detail : json(l.detail);
        lintList.append(el("li", null, el("span", {class: "dbg-kind" + (BAD.has(l.kind) ? " bad" : ""), text: l.kind}),
          el("code", {text: l.where}), d ? " " : null, d ? el("span", {class: "dbg-muted", text: d.slice(0, 240)}) : null));
      }
      errHead.textContent = t("errors", {n: errs.length});
      errList.textContent = "";
      for (const e of errs.slice(0, 50)) {
        errList.append(el("li", null, el("span", {class: "dbg-kind bad", text: "x" + e.count}), el("code", {text: e.where}), " ",
          el("span", {text: e.message})));
      }
    }

    /* ---------- tuning + exports ---------- */
    const tune = card(t("tune"));
    for (const m of D.modes()) {
      const params = m.params || [];
      tune.append(el("h4", {text: I18N.t(m.titleKey)}));
      if (!params.length) { tune.append(el("div", {class: "dbg-muted", text: t("noParams")})); continue; }
      for (const p of params) {
        const out = el("span");
        const input = el("input", {type: "range", min: String(p.min), max: String(p.max), step: String(p.step || 1), "aria-label": I18N.t(p.labelKey)});
        const show = () => {
          const v = D.params(m.id)[p.key];
          if (document.activeElement !== input) input.value = String(v);
          out.textContent = I18N.t(p.labelKey) + ": " + v + (p.unit ? " " + p.unit : "") + "   " + (p.c || "");
        };
        input.addEventListener("input", () => { D.setParams(m.id, {[p.key]: +input.value}); show(); });
        toggles.push(show);
        show();
        tune.append(el("label", {class: "dbg-slider"}, out, input));
      }
      const file = (m.id === "racing" ? "race" : m.id === "adventure" ? "adv" : m.id) + "_config.h";
      tune.append(row(
        btn(t("defaults"), () => { D.setParams(m.id, Object.fromEntries(params.map(p => [p.key, p.def]))); refresh(); }),
        btn(t("export", {file}), () => download(file, configHeader(m, file), "text/x-c"))));
    }
    tune.append(el("div", {class: "dbg-muted", text: t("applyNote")}));
    tune.append(el("h4", {text: "make_font.py"}),
      row(btn(t("exportGlyphs"), () => download("device-glyphs.json", JSON.stringify(D.glyphs(), null, 1), "application/json")),
        btn(t("exportStrings"), () => download("device-strings.json", JSON.stringify(D.exportStrings(), null, 1), "application/json"))),
      el("div", {class: "dbg-muted", text: t("makeFont")}),
      el("h4", {text: "PNG"}),
      row(...[0, 1].map(p => btn(t("png", {n: p + 1}), () => download("p" + (p + 1) + "-" + D.screen(p).id + ".png", D.png(p, 4))))));
    root.append(tune);
    function configHeader(m, file) {
      const vals = D.params(m.id);
      const guard = file.replace(/\W/g, "_").toUpperCase();
      const lines = ["// " + file + ": exported from the device simulator (device.html, docs/ui-design.md)",
        "#ifndef " + guard, "#define " + guard, ""];
      for (const p of m.params || []) {
        const name = p.c || (m.id.toUpperCase() + "_" + p.key.toUpperCase());
        lines.push(("#define " + name).padEnd(32) + " " + String(vals[p.key]).padEnd(6) + " // " + I18N.t(p.labelKey) + (p.unit ? " (" + p.unit + ")" : "") + ", " + p.min + ".." + p.max);
      }
      lines.push("", "#endif", "");
      return lines.join("\n");
    }

    /* ---------- gamepads ---------- */
    const padBox = el("div");
    const padFor = store.get("pads", {});      // gamepad index -> player (0, 1) or -1
    root.append(card(t("pads"), padBox, el("p", {class: "dbg-muted", text: t("padMap")})));
    let padSig = null;
    const padPrev = {};
    function fillPads(list) {
      const sig = list.map(g => g.index + g.id).join("|");
      if (sig === padSig) return;
      padSig = sig;
      padBox.textContent = "";
      if (!list.length) { padBox.append(el("div", {class: "dbg-muted", text: t("padNone")})); return; }
      list.forEach((g, i) => {
        if (padFor[g.index] == null) padFor[g.index] = i < 2 ? i : -1;
        padBox.append(row(el("span", {text: "#" + g.index + " " + g.id.slice(0, 40)}),
          select(t("padFor"), [[-1, t("padOff")], [0, "P1"], [1, "P2"]], () => padFor[g.index], v => { padFor[g.index] = +v; store.set("pads", padFor); })));
      });
    }
    function pollPads() {
      if (!navigator.getGamepads || D.opts.test) return;
      let list = [];
      try { list = [...navigator.getGamepads()].filter(Boolean); } catch { return; }
      fillPads(list);
      for (const g of list) {
        const p = padFor[g.index];
        if (p !== 0 && p !== 1) continue;
        const b = i => !!(g.buttons[i] && g.buttons[i].pressed);
        let x = Math.round((g.axes[0] || 0) * 100), y = Math.round(-(g.axes[1] || 0) * 100);
        if (Math.hypot(x, y) < 15) { x = 0; y = 0; }
        if (b(14)) x = -100; if (b(15)) x = 100; if (b(12)) y = 100; if (b(13)) y = -100;
        const st = {A: b(0), B: b(1), SKILL: b(2) || b(3), MENU: b(9), x, y,
          force: Math.round(((g.buttons[7] && g.buttons[7].value) || 0) * 255)};
        const prev = padPrev[g.index] || {};
        let ctl;
        try { ctl = D.ctl(p, "pad"); } catch { continue; }
        for (const k of ["A", "B", "SKILL", "MENU"]) if (st[k] !== !!prev[k]) ctl.hold(k, st[k]);
        if (st.x !== prev.x || st.y !== prev.y) ctl.stick(st.x, st.y);
        if (st.force !== prev.force) ctl.pressure(st.force);
        padPrev[g.index] = st;
      }
    }
    fillPads([]);
    window.addEventListener("gamepadconnected", () => { padSig = null; });

    /* ---------- gallery + fixtures ---------- */
    const fixList = el("div", {class: "dbg-fix"});
    const shots = el("div", {class: "dbg-shots"});
    const sumLine = el("span", {class: "dbg-muted"});
    let busy = false;
    const status = {};
    async function runFixtures(ids) {
      if (busy) return;
      busy = true;
      shots.textContent = "";
      let ok = 0, bad = 0;
      for (const id of ids) {
        status[id].textContent = t("running");
        status[id].className = "dbg-muted";
        let r;
        try { r = await D.fixture(id); } catch (e) { r = {id, ok: false, error: String(e), shots: []}; }
        if (r.ok) ok++; else bad++;
        status[id].textContent = r.ok ? t("pass") : t("fail") + (r.error ? ": " + r.error : "");
        status[id].className = r.ok ? "dbg-ok" : "dbg-bad";
        for (const s of r.shots || []) {
          const imgs = (s.png || []).map((src, p) => el("img", {src, alt: "P" + (p + 1) + " " + (s.screens[p] ? s.screens[p].id : "")}));
          shots.append(el("figure", {class: "dbg-shot"}, el("div", null, ...imgs),
            el("figcaption", {text: id + ": " + s.label + " (" + s.screens.map(x => x.id + (x.overlay ? "+" + x.overlay : "")).join(", ") + ")"})));
        }
        await new Promise(res => setTimeout(res, 0));
      }
      sumLine.textContent = t("summary", {ok, bad});
      busy = false;
      refresh();
    }
    const fixtures = D.fixtures();
    const gallery = el("section", {class: "dbg-card wide", id: "device-gallery"}, el("h3", {text: t("gallery")}),
      row(btn(t("runAll"), () => runFixtures(fixtures), "primary"), sumLine),
      el("p", {class: "dbg-muted", text: t("galleryNote")}), fixList, shots);
    if (!fixtures.length) fixList.append(el("span", {class: "dbg-muted", text: t("noFixtures")}));
    for (const id of fixtures) {
      const f = D.registry.fixtures[id];
      const title = f && f.titleKey ? I18N.t(f.titleKey) : id;
      status[id] = el("span", {class: "dbg-muted"});
      fixList.append(el("span", null, el("code", {text: id}), title !== id ? " " + title : ""), status[id], btn(t("run"), () => runFixtures([id])));
    }
    root.append(gallery);

    dom.debug.append(root);

    /* ---------- screen overlays: changed blocks, secret-pick cover ---------- */
    const over = dom.handhelds.map((h, p) => {
      const scr = h.screen || h.canvas.parentElement;
      scr.style.position = "relative";
      const cv = el("div", {class: "dbg-blocks", "aria-hidden": "true"});   // divs, not a canvas: tests select ".dv-hh canvas"
      const cover = el("div", {class: "dbg-cover", hidden: true}, el("span", {text: t("coverText")}), el("small", {text: t("peek")}));
      let peek = false;
      cover.addEventListener("pointerdown", e => { peek = true; cover.hidden = true; e.preventDefault(); });
      const unpeek = () => { peek = false; };
      window.addEventListener("pointerup", unpeek);
      window.addEventListener("pointercancel", unpeek);
      scr.append(cv, cover);
      return {h, cv, cover, isPeek: () => peek};
    });
    function drawOverlays() {
      const now = performance.now();
      over.forEach((o, p) => {
        const hh = D.hh(p);
        const def = (hh.ov && hh.ov.def) || hh.screenDef;
        const secret = !!(def && def.secret) && D.bot(p) && opt.cover && !o.isPeek();
        if (o.cover.hidden === secret) o.cover.hidden = !secret;
        const cw = o.h.canvas.clientWidth, ch = o.h.canvas.clientHeight;
        const list = flashes[p];
        while (list.length && list[0].t < now - 300) list.shift();
        if (!opt.blocks) list.length = 0;
        o.cv.style.width = cw + "px"; o.cv.style.height = ch + "px";
        const k = cw / 128;
        let n = 0;
        for (const f of list) {
          const a = (1 - (now - f.t) / 300).toFixed(3);
          for (const [x, y, w, h] of f.rects) {
            if (n >= 400) break;
            const b = o.cv.children[n] || o.cv.appendChild(el("i"));
            b.style.cssText = "left:" + x * k + "px;top:" + y * k + "px;width:" + w * k + "px;height:" + h * k + "px;opacity:" + a;
            n++;
          }
        }
        while (o.cv.children.length > n) o.cv.lastChild.remove();
      });
      pollPads();
      requestAnimationFrame(drawOverlays);
    }
    requestAnimationFrame(drawOverlays);

    /* ---------- refresh (timer; reads only) ---------- */
    function refresh() {
      const w = W();
      if (!w) return;
      seedLine.textContent = t("seed", {seed: D.seed()});
      if (document.activeElement !== seedIn) seedIn.value = String(D.seed());
      toggles.forEach(s => s());
      const rs = D.radio.stats();
      radioStats.textContent = [t("central"), "P1", "P2"].map((n, i) =>
        n + ": " + t("radioStats", {sent: rs[i].sent, lost: rs[i].lost, bps: rs[i].bytesPerSec, air: rs[i].airPct})).join("\n");
      radioStats.style.whiteSpace = "pre-line";
      const now = performance.now();
      [0, 1].forEach(p => {
        const s = D.stats(p), sc = D.screen(p);
        const h = hist[p].filter(x => x.t >= now - 1000);
        const peak = h.reduce((m, x) => Math.max(m, x.px), 0);
        const vals = [sc.id + (sc.overlay ? " + " + sc.overlay : ""), s.fps, s.px, peak, s.bytes, s.spiMs.toFixed(2), s.overBudget];
        vals.forEach((v, i) => { readCells[i][p].textContent = String(v); });
        const lvl = peak <= C.BUDGET_GREEN ? "" : peak <= C.BUDGET_YELLOW ? "yellow" : "red";
        meters[p].className = lvl;
        meters[p].style.width = Math.min(100, peak / (C.BUDGET_YELLOW * 1.25) * 100) + "%";
        const n = lv => h.filter(x => x.level === lv).length;
        levelLines[p].textContent = "P" + (p + 1) + " " + t("levels", {g: n("green"), y: n("yellow"), r: n("red")});
      });
      const cv = D.central();
      const yn = b => b ? t("yes") : t("no");
      centralLine.textContent = !cv.powered ? t("off") :
        t("mode") + ": " + (cv.mode ? cv.mode.id : t("none")) + "   " + t("phase") + ": " + cv.session.phase + "   " +
        t("stepN") + ": " + cv.step + "   " + t("links") + ": " + cv.links.map(yn).join(" / ") + "   " + t("paused") + ": " + yn(cv.paused);
      const snap = cv.mode ? cv.mode.snapshot : cv.session;
      const txt = json(snap);
      if (snapPre.textContent !== txt) snapPre.textContent = txt;
      const rtxt = rankText();
      if (rankPre.textContent !== rtxt) rankPre.textContent = rtxt;
      const gl = D.glyphs();
      const sprites = Object.values(D.registry.sprites);
      const spriteBytes = sprites.reduce((a, s) => a + Math.ceil(s.w * s.h / 2) * (s.frames ? s.frames.length : 1), 0);
      const font = window.DEVICE_FONT_M;
      const cjk = new Set([...gl.used, ...gl.registered]).size;
      const lines = [t("glyphLine", {n: cjk, b: gl.bytes}), t("drawn", {n: gl.used.length}), t("spriteLine", {n: sprites.length, b: spriteBytes})];
      if (!font) lines.push(t("fontNull"));
      if (gl.missing.length) lines.push(t("missing", {s: gl.missing.join("")}));
      const ftxt = lines.join("\n");
      if (flashBox.textContent !== ftxt) { flashBox.textContent = ftxt; flashBox.style.whiteSpace = "pre-line"; }
      fillLint();
    }
    fillMsgs();
    D.on("reset", () => { hist[0].length = hist[1].length = 0; setTimeout(refresh, 0); });
    refresh();
    setInterval(() => { if (!document.hidden) refresh(); }, 400);
    if (D.opts.gallery) {
      setTimeout(() => { gallery.scrollIntoView({block: "start"}); runFixtures(fixtures); }, 50);
    }
  });
})();
