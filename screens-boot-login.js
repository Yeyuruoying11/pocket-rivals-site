// Pocket Rivals handheld simulator: S01 boot, S02-S05 login and profile,
// S06 connect, S09 settings, S10 calibrate (docs/ui-design.md §4.1-4.3, §4.6)
//
// STEP-0 STUB (owner: agent A). Every screen this file owns is registered and
// draws a "TODO <id>" placeholder with just enough input to walk the whole
// flow: boot -> login (guest / new profile) -> connect -> settings. Replace
// the whole file; keep the screen ids and the dev.boot. / dev.login. /
// dev.conn. / dev.set. prefixes. API: the header of device-core.js.
(() => {
  const D = window.DEVICE, ui = D.ui;

  D.registerStrings("dev.boot.", {
    zh: {"dev.boot.sub": "口袋对决", "dev.boot.skip": "{A} 跳过"},
    en: {"dev.boot.sub": "", "dev.boot.skip": "{A} skip"},
  });
  D.registerStrings("dev.login.", {
    zh: {"dev.login.title": "谁在玩？", "dev.login.new": "新建", "dev.login.guest": "访客", "dev.login.lang": "{M} English",
      "dev.login.hintGo": "进入", "dev.login.nameTitle": "名字", "dev.login.avatarTitle": "头像", "dev.login.colorTitle": "颜色"},
    en: {"dev.login.title": "WHO'S PLAYING?", "dev.login.new": "NEW", "dev.login.guest": "GUEST", "dev.login.lang": "{M} 中文",
      "dev.login.hintGo": "Go", "dev.login.nameTitle": "NAME", "dev.login.avatarTitle": "AVATAR", "dev.login.colorTitle": "COLOR"},
  });
  D.registerStrings("dev.conn.", {
    zh: {"dev.conn.title": "连接", "dev.conn.finding": "正在寻找中央板…", "dev.conn.ok": "{OK} 已连接", "dev.conn.waiting": "等待中", "dev.conn.hintSetup": "设置"},
    en: {"dev.conn.title": "CONNECT", "dev.conn.finding": "Finding central...", "dev.conn.ok": "{OK} Connected", "dev.conn.waiting": "waiting", "dev.conn.hintSetup": "Set"},
  });
  D.registerStrings("dev.set.", {
    zh: {"dev.set.title": "设置", "dev.set.lang": "语言", "dev.set.pad": "压力垫", "dev.set.calibrate": "校准", "dev.set.channel": "无线信道",
      "dev.set.on": "开", "dev.set.off": "关", "dev.set.auto": "自动", "dev.set.calTitle": "校准", "dev.set.calRaw": "读数", "dev.set.langNote": "切换会重新开始模拟"},
    en: {"dev.set.title": "SETTINGS", "dev.set.lang": "Language", "dev.set.pad": "Pad", "dev.set.calibrate": "Calibrate", "dev.set.channel": "Channel",
      "dev.set.on": "On", "dev.set.off": "Off", "dev.set.auto": "Auto", "dev.set.calTitle": "CALIBRATE", "dev.set.calRaw": "raw", "dev.set.langNote": "Restarts simulator"},
  });

  const down = ev => ev.type === "down" || ev.type === "repeat";
  const otherLang = () => (window.I18N && I18N.lang === "en" ? "zh" : "en");

  // S01: 1.5 s or A, then routing moves on (ctx.local.booted)
  D.stubScreen("boot", {
    signal: false,
    enter(ctx) { ctx.s.t0 = ctx.now(); ctx.sfx("boot"); },
    tick(ctx) { if (ctx.now() - ctx.s.t0 >= 1500) ctx.local.booted = true; },
    input(ctx, ev) { if (ev.btn === "A" && ev.type === "down") ctx.local.booted = true; },
    lines: () => ["POCKET RIVALS", ["dev.boot.sub"], ["dev.boot.skip"]],
    art(ctx, g) {
      D.PETS.forEach((p, i) => g.sprite(p.sprite, 8 + 41 * i, 72, {scale: 3, frame: 0}));
      for (let i = 0; i < 16; i++) g.rect(i * 8, 152, 8, 8, D.PALETTE[i].name);
    },
    bot(ctx, ctl) { if (ctx.now() - ctx.s.t0 > 300 && !ctx.s.botDone) { ctx.s.botDone = true; ctl.press("A"); } },
  });

  // S02: saved profiles, NEW, GUEST (cursor starts on GUEST)
  const loginRows = ctx => {
    const rows = [];
    ctx.profiles.list().forEach((pr, i) => { if (pr) rows.push({kind: "slot", slot: i, label: pr.name}); });
    const free = ctx.profiles.list().findIndex(pr => !pr);
    if (free >= 0) rows.push({kind: "new", slot: free, label: ctx.t("dev.login.new")});
    rows.push({kind: "guest", label: ctx.t("dev.login.guest")});
    return rows;
  };
  D.stubScreen("login", {
    enter(ctx) { ctx.s.sel = loginRows(ctx).length - 1; },
    input(ctx, ev) {
      const rows = loginRows(ctx);
      if (down(ev) && (ev.btn === "UP" || ev.btn === "DOWN")) {
        ctx.s.sel = (ctx.s.sel + (ev.btn === "UP" ? -1 : 1) + rows.length) % rows.length;
        ctx.sfx("ui_move");
      } else if (ev.btn === "A" && ev.type === "down") {
        const r = rows[ctx.s.sel] || rows[rows.length - 1];
        ctx.sfx("ui_ok");
        if (r.kind === "guest") {
          const rival = ctx.rival();
          ctx.profiles.select("guest", D.guestProfile(ctx.rng, rival ? rival.color : -1));
        } else if (r.kind === "new") ctx.go("login.name", {slot: r.slot});
        else ctx.profiles.select(r.slot);
      } else if (ev.btn === "MENU" && ev.type === "click") ctx.setLanguage(otherLang());
    },
    lines: () => [],
    art(ctx, g) {
      const rows = loginRows(ctx);
      ui.list(g, 2, 32, 124, rows.map(r => ({label: r.label})), ctx.s.sel);
      g.text(4, 130, ctx.t("dev.login.lang"), {w: 80});
    },
    hints: [["A", "dev.login.hintGo"]],
    bot(ctx, ctl) { if (!ctx.s.botDone) { ctx.s.botDone = true; ctl.press("A"); } },
  });

  // S03-S05 placeholders: A = next step, B = back; the last step saves the profile
  const steps = [["login.name", "dev.login.nameTitle"], ["login.avatar", "dev.login.avatarTitle"], ["login.color", "dev.login.colorTitle"]];
  steps.forEach(([id, titleKey], k) => {
    D.stubScreen(id, {
      local: true,
      lines: ctx => [[titleKey], (k + 1) + "/3"],
      hints: [["A", "dev.ui.ok"], ["B", "dev.ui.back"]],
      input(ctx, ev) {
        if (ev.type !== "down") return;
        const params = (ctx.local.stack[ctx.local.stack.length - 1] || {}).params || {};
        if (ev.btn === "B") { ctx.back(); ctx.sfx("ui_back"); return; }
        if (ev.btn !== "A") return;
        ctx.sfx("ui_ok");
        if (k < 2) { ctx.go(steps[k + 1][0], params); return; }
        const pr = D.guestProfile(ctx.rng);
        ctx.profiles.save(params.slot || 0, pr);
        ctx.profiles.select(params.slot || 0);
        for (let i = 0; i < 3; i++) ctx.back();
      },
    });
  });

  // S06: wait for the central board and the rival
  D.stubScreen("connect", {
    lines: ctx => [["dev.conn.title"], ctx.link.gotState ? ["dev.conn.ok"] : ["dev.conn.finding"],
      (ctx.me() || {}).name || "", ctx.rival() ? ctx.rival().name : ["dev.conn.waiting"]],
    art(ctx, g) {
      if (ctx.me()) ui.avatar(g, 20, 96, ctx.me(), {scale: 2});
      if (ctx.rival()) ui.avatar(g, 88, 96, ctx.rival(), {scale: 2});
    },
    hints: [["B", "dev.ui.back"], ["M", "dev.conn.hintSetup"]],
    input(ctx, ev) {
      if (ev.btn === "B" && ev.type === "down") { ctx.sfx("ui_back"); ctx.profiles.logout(); }
      if (ev.btn === "MENU" && ev.type === "click") ctx.go("settings");
    },
  });

  // S09: language (switches and restarts), pad, calibrate, channel
  const PAD = ["auto", "on", "off"];
  const setRows = ctx => [
    {label: ctx.t("dev.set.lang"), value: I18N.lang === "en" ? "English" : "中文", arrows: true},
    {label: ctx.t("dev.set.pad"), value: ctx.t("dev.set." + ctx.settings.pad), arrows: true},
    {label: ctx.t("dev.set.calibrate"), value: "{R}"},
    {label: ctx.t("dev.set.channel"), value: String(ctx.settings.channel), arrows: true},
  ];
  D.stubScreen("settings", {
    local: true,
    enter(ctx) { ctx.s.sel = 0; },
    lines: () => [],
    art(ctx, g) {
      ui.list(g, 0, 30, 128, setRows(ctx), ctx.s.sel);
      if (ctx.s.sel === 0) g.text(4, 100, ctx.t("dev.set.langNote"), {w: 120, c: "muted"});
    },
    hints: [["A", "dev.ui.ok"], ["B", "dev.ui.back"]],
    input(ctx, ev) {
      if (down(ev) && (ev.btn === "UP" || ev.btn === "DOWN")) { ctx.s.sel = (ctx.s.sel + (ev.btn === "UP" ? 3 : 1)) % 4; ctx.sfx("ui_move"); return; }
      if (down(ev) && (ev.btn === "LEFT" || ev.btn === "RIGHT")) {
        const d = ev.btn === "LEFT" ? -1 : 1;
        if (ctx.s.sel === 0) ctx.setLanguage(otherLang());
        if (ctx.s.sel === 1) ctx.saveSettings({pad: PAD[(PAD.indexOf(ctx.settings.pad) + d + 3) % 3]});
        if (ctx.s.sel === 3) ctx.saveSettings({channel: 11 + ((ctx.settings.channel - 11 + d + 16) % 16)});
        ctx.sfx("ui_move");
        return;
      }
      if (ev.btn === "A" && ev.type === "down" && ctx.s.sel === 2) { ctx.sfx("ui_ok"); ctx.go("settings.cal"); }
      if ((ev.btn === "B" && ev.type === "down") || (ev.btn === "MENU" && ev.type === "click")) { ctx.sfx("ui_back"); ctx.back(); }
    },
    bot(ctx, ctl) { if (!ctx.s.botDone) { ctx.s.botDone = true; ctl.press("B"); } },
  });

  // S10: live raw reading and pad level
  D.stubScreen("settings.cal", {
    local: true,
    enter(ctx) { ctx.s.pad = D.padLevel.create(); ctx.s.level = 0; },
    tick(ctx, dt) { ctx.s.level = ctx.padLevel(ctx.s.pad, dt); },
    lines: ctx => [["dev.set.calTitle"], ctx.t("dev.set.calRaw") + " " + ctx.input.raw.fsr, "P " + ctx.input.pressure + "  L " + ctx.s.level + "%"],
    art(ctx, g) { ui.bandBar(g, 3, 80, 122, 14, {center: 52, width: 24, level: ctx.s.level, inside: Math.abs(ctx.s.level - 52) <= 12}); },
    hints: [["B", "dev.ui.back"]],
    input(ctx, ev) { if (ev.btn === "B" && ev.type === "down") { ctx.sfx("ui_back"); ctx.back(); } },
    bot(ctx, ctl) { if (!ctx.s.botDone) { ctx.s.botDone = true; ctl.press("B"); } },
  });
})();
