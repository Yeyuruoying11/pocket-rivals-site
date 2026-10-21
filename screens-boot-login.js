// Pocket Rivals handheld simulator: S01 boot, S02-S05 login and profile,
// S06 connect, S09 settings, S10 calibrate (docs/ui-design.md §4.1-4.3, §4.6)
//
// S01-S06 are the real screens; S09 / S10 are still the step-0 stubs (owned
// by a later step). API: the header of device-core.js.
//
// Local page stack used here (ctx.go / ctx.back, at most 4 deep):
//   new profile: login.name -> login.avatar -> login.color (params = one
//     shared {slot, flow: "new", draft} object, so stepping back keeps edits)
//   edit (S on a profile row in S02, or ctx.go("login.edit", {slot}) from
//     settings): login.edit -> login.name | login.avatar | login.color
//     with {slot, flow: "edit", draft}; done saves that one field and pops.
// Without a joystick (hw.caps.joy false, §3.1): short B = next item, hold
// B 1 s = back, A = choose; the name keyboard only takes S (random) and M.
(() => {
  const D = window.DEVICE, ui = D.ui, C = D.C;

  D.registerStrings("dev.boot.", {
    zh: {"dev.boot.sub": "口袋对决", "dev.boot.skip": "{A} 跳过", "dev.boot.ok": "ok", "dev.boot.missing": "--",
      "dev.boot.unknown": "?", "dev.boot.rf": "RF ch{ch} P{p} v{v}"},
    en: {"dev.boot.sub": "", "dev.boot.skip": "{A} skip", "dev.boot.ok": "ok", "dev.boot.missing": "--",
      "dev.boot.unknown": "?", "dev.boot.rf": "RF ch{ch} P{p} v{v}"},
  });
  D.registerStrings("dev.login.", {
    zh: {"dev.login.title": "谁在玩？", "dev.login.wins": "{n}胜", "dev.login.new": "新建", "dev.login.newSub": "创建资料",
      "dev.login.guest": "访客", "dev.login.guestSub": "快速开始", "dev.login.lang": "{M} English",
      "dev.login.hintGo": "进入", "dev.login.hintEdit": "编辑", "dev.login.editTitle": "编辑资料",
      "dev.login.rename": "改名字", "dev.login.reavatar": "换头像", "dev.login.recolor": "换颜色", "dev.login.delete": "删除资料",
      "dev.login.deleteAsk": "删除{name}？", "dev.login.deleteHold": "按住{A}",
      "dev.login.nameTitle": "名字", "dev.login.nameTip": "{S}随机 最多6位", "dev.login.nameEmpty": "名字不能为空",
      "dev.login.hintAdd": "输入", "dev.login.hintDel": "删除", "dev.login.hintOk": "完成", "dev.login.hintRnd": "随机",
      "dev.login.avatarTitle": "头像", "dev.login.colorTitle": "颜色", "dev.login.avatarNote": "只是外观",
      "dev.login.av.kid": "笑脸", "dev.login.av.robot": "机器人", "dev.login.av.cat": "小猫",
      "dev.login.c.red": "红", "dev.login.c.orange": "橙", "dev.login.c.gold": "金", "dev.login.c.green": "绿",
      "dev.login.c.blue": "蓝", "dev.login.c.white": "白", "dev.login.colorClash": "撞色：这局用{c}"},
    en: {"dev.login.title": "WHO'S PLAYING?", "dev.login.wins": "{n} wins", "dev.login.new": "NEW", "dev.login.newSub": "new profile",
      "dev.login.guest": "GUEST", "dev.login.guestSub": "quick play", "dev.login.lang": "{M} 中文",
      "dev.login.hintGo": "Go", "dev.login.hintEdit": "Edit", "dev.login.editTitle": "EDIT PROFILE",
      "dev.login.rename": "Rename", "dev.login.reavatar": "Avatar", "dev.login.recolor": "Color", "dev.login.delete": "Delete",
      "dev.login.deleteAsk": "Delete {name}?", "dev.login.deleteHold": "Hold {A}",
      "dev.login.nameTitle": "NAME", "dev.login.nameTip": "{S} random, max 6", "dev.login.nameEmpty": "Name is empty",
      "dev.login.hintAdd": "Add", "dev.login.hintDel": "Del", "dev.login.hintOk": "OK", "dev.login.hintRnd": "Rand",
      "dev.login.avatarTitle": "AVATAR", "dev.login.colorTitle": "COLOR", "dev.login.avatarNote": "Looks only",
      "dev.login.av.kid": "Kid", "dev.login.av.robot": "Robot", "dev.login.av.cat": "Cat",
      "dev.login.c.red": "Red", "dev.login.c.orange": "Orange", "dev.login.c.gold": "Gold", "dev.login.c.green": "Green",
      "dev.login.c.blue": "Blue", "dev.login.c.white": "White", "dev.login.colorClash": "Clash: now {c}"},
  });
  D.registerStrings("dev.conn.", {
    zh: {"dev.conn.title": "连接", "dev.conn.finding": "正在寻找中央板…", "dev.conn.ok": "{OK} 已连接", "dev.conn.ch": "信道{ch} 玩家{p}",
      "dev.conn.waiting": "等待中", "dev.conn.waitRival": "等对方…", "dev.conn.rivalLogin": "对方在选资料",
      "dev.conn.help1": "中央板开着吗？", "dev.conn.help2": "三块板信道要相同", "dev.conn.hintSetup": "设置"},
    en: {"dev.conn.title": "CONNECT", "dev.conn.finding": "Finding central...", "dev.conn.ok": "{OK} Connected", "dev.conn.ch": "ch {ch}  player {p}",
      "dev.conn.waiting": "waiting", "dev.conn.waitRival": "Waiting for rival", "dev.conn.rivalLogin": "Rival logging in",
      "dev.conn.help1": "Is central on?", "dev.conn.help2": "Same ch on all 3", "dev.conn.hintSetup": "Set"},
  });
  D.registerStrings("dev.set.", {
    zh: {"dev.set.title": "设置", "dev.set.lang": "语言", "dev.set.pad": "压力垫", "dev.set.calibrate": "校准", "dev.set.channel": "无线信道",
      "dev.set.on": "开", "dev.set.off": "关", "dev.set.auto": "自动", "dev.set.calTitle": "校准", "dev.set.calRaw": "读数", "dev.set.langNote": "切换会重新开始模拟"},
    en: {"dev.set.title": "SETTINGS", "dev.set.lang": "Language", "dev.set.pad": "Pad", "dev.set.calibrate": "Calibrate", "dev.set.channel": "Channel",
      "dev.set.on": "On", "dev.set.off": "Off", "dev.set.auto": "Auto", "dev.set.calTitle": "CALIBRATE", "dev.set.calRaw": "raw", "dev.set.langNote": "Restarts simulator"},
  });

  const down = ev => ev.type === "down" || ev.type === "repeat";
  const otherLang = () => (window.I18N && I18N.lang === "en" ? "zh" : "en");
  const DIRS = {UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0]};
  const COLOR_KEYS = ["red", "orange", "gold", "green", "blue", "white"];
  const colorName = (ctx, i) => ctx.t("dev.login.c." + COLOR_KEYS[(i | 0) % 6]);
  const AVATAR_KEYS = ["dev.pet.ember", "dev.pet.tide", "dev.pet.sprout", "dev.login.av.kid", "dev.login.av.robot", "dev.login.av.cat"];
  const noJoy = ctx => !ctx.hw.caps.joy;
  // no-stick list navigation (§3.1): short B = next, hold B = back
  const noJoyNav = (ctx, ev, count, sel) => {
    if (ev.btn !== "B") return null;
    if (ev.type === "click") { ctx.sfx("ui_move"); return {sel: (sel + 1) % count}; }
    if (ev.type === "long") return {back: true};
    return {};
  };
  // pop every login.* page (finishing or cancelling a profile flow)
  const popLogin = ctx => {
    const st = ctx.local.stack;
    while (st.length && st[st.length - 1].id.startsWith("login.")) ctx.back();
  };
  const params = ctx => {
    const st = ctx.local.stack;
    return (st[st.length - 1] || {}).params || {};
  };
  // throttled bot presses (one every `gap` ms)
  const botPress = (ctx, ctl, btn, gap = 160) => {
    if (ctx.s.botAt != null && ctx.now() - ctx.s.botAt < gap) return;
    ctx.s.botAt = ctx.now();
    ctl.press(btn);
  };

  /* ================= S01 boot / self-test ================= */

  D.registerScreen("boot", {
    enter(ctx) { ctx.s.t0 = ctx.now(); ctx.sfx("boot"); },
    tick(ctx) { if (ctx.now() - ctx.s.t0 >= 1500) ctx.local.booted = true; },
    input(ctx, ev) { if (ev.btn === "A" && ev.type === "down") ctx.local.booted = true; },
    draw(ctx, g) {
      // logo: s x2, gold with a fireDk shadow 1 px right / down; glyph tops at y 10 / 28
      for (const [word, y] of [["POCKET", 10], ["RIVALS", 28]]) {
        g.text(29, y - 6 + 1, word, {font: "s", scale: 2, c: "fireDk"});
        g.text(28, y - 6, word, {font: "s", scale: 2, c: "gold"});
      }
      const sub = ctx.t("dev.boot.sub");
      if (sub) g.text(64, 45, sub, {align: "c", w: 120, key: "dev.boot.sub"});
      const hop = Math.floor((ctx.now() - ctx.s.t0) / 150) % 3;
      D.PETS.forEach((p, i) => g.sprite(p.sprite, 8 + 41 * i, 62 - (i === hop ? 2 : 0), {scale: 3}));
      // self-test (s font, two columns)
      const caps = ctx.hw.caps;
      const st = (x, y, label, v) => {
        g.text(x, y, label, {font: "s", c: "muted"});
        const k = v === true ? "ok" : v === false ? "missing" : "unknown";
        g.text(x + 24, y, ctx.t("dev.boot." + k), {font: "s", c: v === true ? "grassLt" : v === false ? "gold" : "muted", w: 12});
      };
      st(8, 97, "TFT", true); st(68, 97, "JOY", !!caps.joy);
      st(8, 107, "PAD", !!(caps.pad && ctx.input.padPresent)); st(68, 107, "SND", !!caps.snd);
      g.text(8, 117, ctx.t("dev.boot.rf", {ch: ctx.hw.channel, p: ctx.p + 1, v: ctx.hw.protocol}), {font: "s", c: "muted", w: 90, key: "dev.boot.rf"});
      g.text(64, 132, ctx.t("dev.boot.skip"), {align: "c", w: 80, key: "dev.boot.skip"});
      for (let i = 0; i < 16; i++) g.rect(i * 8, 152, 8, 8, D.PALETTE[i].name);
    },
    bot(ctx, ctl) { if (ctx.now() - ctx.s.t0 > 300 && !ctx.s.botDone) { ctx.s.botDone = true; ctl.press("A"); } },
  });

  /* ================= S02 who's playing ================= */

  const loginRows = ctx => {
    const rows = [], list = ctx.profiles.list();
    list.forEach((pr, i) => { if (pr) rows.push({kind: "slot", slot: i, pr}); });
    const free = list.findIndex(pr => !pr);
    if (free >= 0) rows.push({kind: "new", slot: free});
    rows.push({kind: "guest"});
    return rows;
  };
  const rowKey = r => r.kind === "slot" ? "slot" + r.slot : r.kind;
  const ROW_Y = [16, 44, 72, 100];

  const startNew = (ctx, slot) => {
    const rival = ctx.rival();
    let color = ctx.rng.int(6);
    if (rival && color === rival.color) color = (color + 1) % 6;
    ctx.go("login.name", {slot, flow: "new", draft: {name: "", avatar: ctx.rng.int(6), color}});
  };

  D.registerScreen("login", {
    enter(ctx) {
      const rows = loginRows(ctx);
      let i = rows.findIndex(r => rowKey(r) === ctx.local.loginRow);
      if (i < 0) i = rows[0].kind === "slot" ? 0 : rows.length - 1;   // first profile, else GUEST
      ctx.s.sel = i;
    },
    input(ctx, ev) {
      const rows = loginRows(ctx);
      ctx.s.sel = Math.min(ctx.s.sel, rows.length - 1);
      if (noJoy(ctx)) {
        const r = noJoyNav(ctx, ev, rows.length, ctx.s.sel);
        if (r && r.sel != null) ctx.s.sel = r.sel;
        if (r) return;
      }
      if (down(ev) && (ev.btn === "UP" || ev.btn === "DOWN")) {
        ctx.s.sel = (ctx.s.sel + (ev.btn === "UP" ? -1 : 1) + rows.length) % rows.length;
        ctx.sfx("ui_move");
        return;
      }
      const r = rows[ctx.s.sel];
      if (ev.btn === "A" && ev.type === "down") {
        ctx.sfx("ui_ok");
        ctx.local.loginRow = rowKey(r);
        if (r.kind === "guest") {
          const rival = ctx.rival();
          ctx.profiles.select("guest", D.guestProfile(ctx.rng, rival ? rival.color : -1));
        } else if (r.kind === "new") startNew(ctx, r.slot);
        else ctx.profiles.select(r.slot);
      } else if (ev.btn === "SKILL" && ev.type === "down") {
        if (r.kind !== "slot") { ctx.sfx("ui_deny"); return; }
        ctx.sfx("ui_ok");
        ctx.local.loginRow = rowKey(r);
        ctx.go("login.edit", {slot: r.slot});
      } else if (ev.btn === "MENU" && ev.type === "click") ctx.setLanguage(otherLang());
    },
    draw(ctx, g) {
      ui.topBar(g, ctx, "dev.login.title", {titleW: 84});
      const rows = loginRows(ctx);
      const sel = Math.min(ctx.s.sel, rows.length - 1);
      rows.forEach((r, i) => {
        const y = ROW_Y[i];
        if (y == null) return;
        let name, sub;
        if (r.kind === "slot") {
          ui.avatar(g, 6, y + 4, r.pr, {scale: 2});
          name = r.pr.name; sub = ctx.t("dev.login.wins", {n: r.pr.wins || 0});
        } else if (r.kind === "new") {
          g.frame(6, y + 4, 20, 20, "muted");
          g.rect(15, y + 8, 2, 12, "white"); g.rect(10, y + 13, 12, 2, "white");
          name = ctx.t("dev.login.new"); sub = ctx.t("dev.login.newSub");
        } else {
          g.dither(6, y + 4, 20, 20, "panel", "line");
          g.text(16, y + 1, "?", {align: "c", scale: 2, font: "s", c: "white"});
          name = ctx.t("dev.login.guest"); sub = ctx.t("dev.login.guestSub");
        }
        g.text(32, y + 1, name, {w: 90, c: i === sel ? "white" : "white"});
        g.text(32, y + 13, sub, {w: 90, c: "muted"});
        if (i === sel) {
          g.frame(2, y + 1, 124, 27, "accent", 2);
          g.sprite("icon.R", 114, y + 10, {color: "accent"});
        }
      });
      g.text(4, 130, ctx.t("dev.login.lang"), {w: 80, c: "muted", key: "dev.login.lang"});
      const r = rows[sel] || {};
      const hints = [["A", "dev.login.hintGo"]];
      if (noJoy(ctx)) hints.push(["B", "dev.ui.next"]);
      if (r.kind === "slot") hints.push(["S", "dev.login.hintEdit"]);
      ui.hintBar(g, ctx, hints);
    },
    bot(ctx, ctl) {
      // §8.3: the bot plays as a guest
      const rows = loginRows(ctx);
      const r = rows[Math.min(ctx.s.sel, rows.length - 1)];
      if (r.kind === "guest") { if (!ctx.s.botDone) { ctx.s.botDone = true; ctl.press("A"); } }
      else botPress(ctx, ctl, noJoy(ctx) ? "B" : "DOWN");
    },
  });

  /* ================= edit menu (S on a profile row) ================= */

  const EDIT_ITEMS = [["dev.login.rename", "login.name"], ["dev.login.reavatar", "login.avatar"],
    ["dev.login.recolor", "login.color"], ["dev.login.delete", null]];

  D.registerScreen("login.edit", {
    local: true,
    enter(ctx) { ctx.s.sel = params(ctx).sel || 0; ctx.s.ask = false; },   // the cursor survives a sub-page
    input(ctx, ev) {
      const pa = params(ctx), pr = ctx.profiles.list()[pa.slot];
      if (!pr) { ctx.back(); return; }
      if (ctx.s.ask) {
        // delete: hold A 1 s (tick checks), B cancels
        if (ev.btn === "A" && ev.type === "down") ctx.s.holdT0 = ctx.now();
        if (ev.btn === "A" && ev.type === "up") ctx.s.holdT0 = null;
        if (ev.btn === "B" && ev.type === "down") { ctx.sfx("ui_back"); ctx.s.ask = false; ctx.s.holdT0 = null; }
        return;
      }
      if (noJoy(ctx)) {
        const r = noJoyNav(ctx, ev, EDIT_ITEMS.length, ctx.s.sel);
        if (r && r.sel != null) ctx.s.sel = r.sel;
        if (r && r.back) { ctx.sfx("ui_back"); ctx.back(); }
        if (r) return;
      }
      if (down(ev) && (ev.btn === "UP" || ev.btn === "DOWN")) {
        ctx.s.sel = (ctx.s.sel + (ev.btn === "UP" ? 3 : 1)) % 4;
        ctx.sfx("ui_move");
      } else if (ev.btn === "A" && ev.type === "down") {
        const [, id] = EDIT_ITEMS[ctx.s.sel];
        pa.sel = ctx.s.sel;
        ctx.sfx("ui_ok");
        if (id) ctx.go(id, {slot: pa.slot, flow: "edit", draft: {name: pr.name, avatar: pr.avatar, color: pr.color}});
        else { ctx.s.ask = true; ctx.s.holdT0 = null; }
      } else if (ev.btn === "B" && ev.type === "down") { ctx.sfx("ui_back"); ctx.back(); }
    },
    tick(ctx) {
      if (!ctx.s.ask || ctx.s.holdT0 == null) return;
      if (!ctx.input.a) { ctx.s.holdT0 = null; return; }
      if (ctx.now() - ctx.s.holdT0 >= 1000) {
        const slot = params(ctx).slot;
        ctx.s.ask = false; ctx.s.holdT0 = null;
        ctx.sfx("ui_back");
        if (ctx.local.loginRow === "slot" + slot) ctx.local.loginRow = null;
        ctx.back();
        ctx.profiles.remove(slot);
      }
    },
    draw(ctx, g) {
      ui.topBar(g, ctx, "dev.login.editTitle");
      const pa = params(ctx), pr = ctx.profiles.list()[pa.slot];
      if (!pr) return;
      ui.avatar(g, 6, 18, pr, {scale: 2});
      g.text(32, 16, pr.name, {w: 90});
      g.text(32, 28, ctx.t("dev.login.wins", {n: pr.wins || 0}), {w: 90, c: "muted"});
      ui.list(g, 0, 44, 128, EDIT_ITEMS.map(([k], i) => ({label: ctx.t(k), disabled: false})), ctx.s.sel);
      if (ctx.s.ask) {
        ui.dim(g);
        ui.panel(g, 4, 56, 120, 60);
        g.text(64, 62, ctx.t("dev.login.deleteAsk", {name: pr.name}), {align: "c", w: 112, c: "danger", key: "dev.login.deleteAsk"});
        g.text(64, 78, ctx.t("dev.login.deleteHold"), {align: "c", w: 112, key: "dev.login.deleteHold"});
        const f = ctx.s.holdT0 == null ? 0 : Math.min(1, (ctx.now() - ctx.s.holdT0) / 1000);
        g.frame(14, 98, 100, 8, "line");
        if (f > 0) g.rect(15, 99, Math.round(98 * f), 6, "danger");
        ui.hintBar(g, ctx, [["A", "dev.ui.ok"], ["B", "dev.ui.back"]]);
      } else {
        ui.hintBar(g, ctx, noJoy(ctx) ? [["A", "dev.ui.ok"], ["B", "dev.ui.next"]] : [["A", "dev.ui.ok"], ["B", "dev.ui.back"]]);
      }
    },
    bot(ctx, ctl) { if (!ctx.s.botDone) { ctx.s.botDone = true; ctl.press("B"); } },
  });

  /* ================= S03 name keyboard ================= */

  const KB = ["ABCDEFG", "HIJKLMN", "OPQRSTU", "VWXYZ-.", "0123456"];
  // last row: 7 8 9 DEL DICE OK OK (OK spans columns 5-6)
  const kbKey = (c, r) => {
    if (r < 5) return KB[r][c];
    return ["7", "8", "9", "DEL", "DICE", "OK", "OK"][c];
  };
  const randomName = (ctx, cur) => {
    let n;
    for (let i = 0; i < 4; i++) { n = D.GUEST_NAMES[ctx.rng.int(D.GUEST_NAMES.length)]; if (n !== cur) break; }
    return n;
  };
  const stepBadge = (ctx, k) => params(ctx).flow === "new" ? k + "/3" : "";

  const nameDone = ctx => {
    const pa = params(ctx);
    if (!pa.draft.name) { ctx.sfx("ui_deny"); ctx.toast("dev.login.nameEmpty"); ctx.local.nameEmptyAt = ctx.now(); return; }
    // the "Name is empty" toast must not follow onto the avatar grid
    if (ctx.local.nameEmptyAt != null && ctx.now() - ctx.local.nameEmptyAt < D.C.TOAST_MS) ctx.toast("dev.login.nameEmpty", null, 0);
    ctx.local.nameEmptyAt = null;
    ctx.sfx("ui_ok");
    if (pa.flow === "new") ctx.go("login.avatar", pa);
    else { saveField(ctx, pa, "name"); ctx.back(); }
  };
  const saveField = (ctx, pa, field) => {
    const pr = ctx.profiles.list()[pa.slot];
    if (!pr) return;
    ctx.profiles.save(pa.slot, Object.assign({name: pr.name, avatar: pr.avatar, color: pr.color}, {[field]: pa.draft[field]}));
  };

  D.registerScreen("login.name", {
    local: true,
    repeat: {delay: 300, rate: 120},
    enter(ctx) { ctx.s.c = 0; ctx.s.r = 0; },
    input(ctx, ev) {
      const pa = params(ctx), d = pa.draft;
      if (!d) return;
      const del = () => { d.name = d.name.slice(0, -1); ctx.sfx("key_type"); };
      if (noJoy(ctx)) {
        if (ev.btn === "B" && ev.type === "click") { if (d.name) del(); else { ctx.sfx("ui_back"); ctx.back(); } }
        if (ev.btn === "B" && ev.type === "long") { ctx.sfx("ui_back"); ctx.back(); }
        if (ev.btn === "B") return;
      }
      if (down(ev) && DIRS[ev.btn] && !noJoy(ctx)) {
        const [dx, dy] = DIRS[ev.btn];
        let {c, r} = ctx.s;
        if (dy) r = (r + dy + 6) % 6;
        if (dx) {
          if (r === 5 && c >= 5) c = dx > 0 ? 0 : 4;
          else c = (c + dx + 7) % 7;
        }
        if (r === 5 && c === 6) c = 5;
        ctx.s.c = c; ctx.s.r = r;
        ctx.sfx("ui_move");
        return;
      }
      if (ev.type !== "down" && !(ev.btn === "MENU" && ev.type === "click")) return;
      if (ev.btn === "A" && !noJoy(ctx)) {
        const k = kbKey(ctx.s.c, ctx.s.r);
        if (k === "DEL") { if (d.name) del(); else ctx.sfx("ui_deny"); }
        else if (k === "DICE") { d.name = randomName(ctx, d.name); ctx.sfx("key_type"); }
        else if (k === "OK") nameDone(ctx);
        else if (d.name.length >= 6) ctx.sfx("ui_deny");
        else { d.name += k; ctx.sfx("key_type"); if (d.name.length === 6) { ctx.s.c = 5; ctx.s.r = 5; } }
      } else if (ev.btn === "B" && ev.type === "down") {
        if (d.name) del(); else { ctx.sfx("ui_back"); ctx.back(); }
      } else if (ev.btn === "SKILL" && ev.type === "down") { d.name = randomName(ctx, d.name); ctx.sfx("key_type"); }
      else if (ev.btn === "MENU" && ev.type === "click") nameDone(ctx);
    },
    draw(ctx, g) {
      const pa = params(ctx), d = pa.draft || {name: ""};
      ui.topBar(g, ctx, "dev.login.nameTitle", {right: stepBadge(ctx, 1)});
      const blink = Math.floor(ctx.now() / 250) % 2 === 0;
      for (let i = 0; i < 6; i++) {
        const x = 28 + 12 * i;
        if (d.name[i]) g.text(x, 14, d.name[i], {scale: 2});
        const cur = i === d.name.length;
        g.rect(x + 1, 41, 10, cur ? 2 : 1, cur ? (blink ? "accent" : "void") : "line");
      }
      const off = noJoy(ctx);
      for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
        const k = kbKey(c, r);
        if (k === "OK" && c === 6) continue;
        const x = 4 + 17 * c, y = 46 + 14 * r, w = k === "OK" ? 34 : 17;
        const sel = !off && ctx.s.r === r && (ctx.s.c === c || (k === "OK" && ctx.s.c >= 5));
        if (sel) g.rect(x, y, w, 14, "accent");
        const col = sel ? "void" : off ? "line" : k === "OK" ? "grassLt" : "white";
        const label = k === "DEL" ? "{DEL}" : k === "DICE" ? "{DICE}" : k === "OK" ? ctx.t("dev.ui.done") : k;
        g.text(x + Math.floor(w / 2), y, label, {align: "c", c: col, w: w});
      }
      g.text(4, 132, ctx.t("dev.login.nameTip"), {w: 120, c: "muted", key: "dev.login.nameTip"});
      ui.hintBar(g, ctx, off ? [["S", "dev.login.hintRnd"], ["B", "dev.login.hintDel"], ["M", "dev.login.hintOk"]]
        : [["A", "dev.login.hintAdd"], ["B", "dev.login.hintDel"], ["M", "dev.login.hintOk"]]);
    },
    bot(ctx, ctl) {
      // a bot that lands here takes a random name and finishes
      const d = params(ctx).draft;
      if (!d) return;
      botPress(ctx, ctl, d.name ? "MENU" : "SKILL", 300);
    },
  });

  /* ================= S04 avatar / S05 color (3 x 2 grids) ================= */

  const gridMove = (ctx, ev) => {
    const [dx, dy] = DIRS[ev.btn];
    let c = ctx.s.sel % 3, r = Math.floor(ctx.s.sel / 3);
    c = (c + dx + 3) % 3; r = (r + dy + 2) % 2;
    ctx.s.sel = r * 3 + c;
    ctx.sfx("ui_move");
  };
  const gridInput = (ctx, ev, field, onOk) => {
    const pa = params(ctx);
    if (!pa.draft) return;
    if (noJoy(ctx)) {
      const r = noJoyNav(ctx, ev, 6, ctx.s.sel);
      if (r && r.sel != null) { ctx.s.sel = r.sel; pa.draft[field] = r.sel; }
      if (r && r.back) { ctx.sfx("ui_back"); ctx.back(); }
      if (r) return;
    }
    if (down(ev) && DIRS[ev.btn]) { gridMove(ctx, ev); pa.draft[field] = ctx.s.sel; return; }
    if (ev.type !== "down") return;
    if (ev.btn === "A") { pa.draft[field] = ctx.s.sel; onOk(pa); }
    else if (ev.btn === "B") { ctx.sfx("ui_back"); ctx.back(); }
  };
  const gridHints = (ctx, okKey) => noJoy(ctx) ? [["A", okKey], ["B", "dev.ui.next"]] : [["A", okKey], ["B", "dev.ui.back"]];

  D.registerScreen("login.avatar", {
    local: true,
    enter(ctx) { const d = params(ctx).draft; ctx.s.sel = d ? d.avatar % 6 : 0; },
    input(ctx, ev) {
      gridInput(ctx, ev, "avatar", pa => {
        ctx.sfx("ui_ok");
        if (pa.flow === "new") ctx.go("login.color", pa);
        else { saveField(ctx, pa, "avatar"); ctx.back(); }
      });
    },
    draw(ctx, g) {
      const d = params(ctx).draft || {name: "", avatar: 0, color: 0};
      ui.topBar(g, ctx, "dev.login.avatarTitle", {right: stepBadge(ctx, 2)});
      for (let i = 0; i < 6; i++) {
        const x = 6 + 40 * (i % 3), y = i < 3 ? 15 : 67, sel = i === ctx.s.sel;
        g.frame(x, y, 36, 36, sel ? "accent" : "line", sel ? 2 : 1);
        ui.avatar(g, x + 3, y + 3, {avatar: i, color: d.color}, {scale: 3});
        g.text(x + 18, y + 37, ctx.t(AVATAR_KEYS[i]), {align: "c", w: 36, c: sel ? "white" : "muted", key: AVATAR_KEYS[i]});
      }
      g.sprite("icon.R", 4, 121, {color: "accent"});
      g.text(14, 118, ctx.t(AVATAR_KEYS[ctx.s.sel]), {w: 110});
      g.text(14, 132, ctx.t("dev.login.avatarNote"), {w: 110, c: "muted", key: "dev.login.avatarNote"});
      ui.hintBar(g, ctx, gridHints(ctx, "dev.ui.ok"));
    },
    bot(ctx, ctl) { botPress(ctx, ctl, "A", 300); },
  });

  D.registerScreen("login.color", {
    local: true,
    enter(ctx) { const d = params(ctx).draft; ctx.s.sel = d ? d.color % 6 : 0; },
    input(ctx, ev) {
      gridInput(ctx, ev, "color", pa => {
        if (pa.flow === "new") {
          ctx.sfx("ui_ok");
          ctx.profiles.save(pa.slot, pa.draft);
          ctx.local.loginRow = "slot" + pa.slot;
          popLogin(ctx);
          ctx.profiles.select(pa.slot);
        } else { ctx.sfx("ui_ok"); saveField(ctx, pa, "color"); ctx.back(); }
      });
    },
    draw(ctx, g) {
      const d = params(ctx).draft || {name: "", avatar: 0, color: 0};
      const pc = D.PLAYER_COLORS[ctx.s.sel];
      ui.topBar(g, ctx, "dev.login.colorTitle", {right: stepBadge(ctx, 3)});
      // preview: 3x avatar in a 2 px colored frame, name x2, a 2x car
      g.frame(11, 19, 36, 36, pc, 2);
      ui.avatar(g, 14, 22, {avatar: d.avatar, color: ctx.s.sel}, {scale: 3});
      g.text(50, 18, d.name, {scale: 2, c: pc, w: 72});
      g.sprite("ui.car", 52, 42, {scale: 2, map: {c: pc, p: "white"}});
      for (let i = 0; i < 6; i++) {
        const x = 6 + 40 * (i % 3), y = i < 3 ? 70 : 106, sel = i === ctx.s.sel;
        g.rect(x, y, 36, 20, D.PLAYER_COLORS[i]);
        if (sel) { g.frame(x - 2, y - 2, 40, 24, "accent", 2); g.sprite("icon.OK", x + 14, y + 6, {color: "void"}); }
        g.text(x + 18, y + 20, colorName(ctx, i), {align: "c", w: 36, c: sel ? "white" : "muted"});
      }
      ui.hintBar(g, ctx, gridHints(ctx, "dev.ui.done"));
    },
    bot(ctx, ctl) { botPress(ctx, ctl, "A", 300); },
  });

  /* ================= S06 connect / waiting for the rival ================= */

  // 32 x 24 radio icon at (48, 22): the central board with 3 arcs each side
  const drawRadio = (g, x, y, arcs, color) => {
    g.rect(x + 10, y + 6, 12, 12, "panel");
    g.frame(x + 10, y + 6, 12, 12, "muted");
    g.rect(x + 13, y + 9, 6, 6, "line");
    g.rect(x + 15, y + 2, 2, 4, "muted");
    for (let k = 0; k < 3; k++) {
      if (k >= arcs) continue;
      const h = 6 + 6 * k, top = y + 12 - h / 2;
      for (const side of [-1, 1]) {
        const ax = side < 0 ? x + 7 - 3 * k : x + 24 + 3 * k;
        g.vline(ax, top + 1, h - 2, color);
        g.px(ax - side, top, color); g.px(ax - side, top + h - 1, color);
      }
    }
  };
  const rivalLinked = ctx => {
    const l = ctx.lobby;
    if (!l) return false;
    return !!(l.flags & (ctx.p === 0 ? C.FLAG.P2_LINK : C.FLAG.P1_LINK));
  };
  const card = (ctx, g, x, labelKey, pr, color) => {
    g.frame(x, 92, 56, 50, pr ? color : "line");
    g.text(x + 28, 92, ctx.t(labelKey), {align: "c", w: 52, c: "muted", key: labelKey});
    if (pr) {
      ui.avatar(g, x + 18, 107, pr, {scale: 2});
      g.text(x + 28, 127, pr.name, {align: "c", w: 52});
    } else {
      g.dither(x + 18, 107, 20, 20, "panel", null);
      g.text(x + 28, 107, "?", {align: "c", font: "s", scale: 2, c: "muted"});
      g.text(x + 28, 127, ctx.t("dev.conn.waiting"), {align: "c", w: 52, c: "muted", key: "dev.conn.waiting"});
    }
  };

  D.registerScreen("connect", {
    enter(ctx) { ctx.s.t0 = ctx.now(); ctx.s.hadRival = !!ctx.rival(); },
    tick(ctx) {
      if (!ctx.link.gotState) { if (ctx.s.gotState) { ctx.s.t0 = ctx.now(); ctx.s.gotState = false; } }
      else ctx.s.gotState = true;
      const rival = ctx.rival();
      if (rival && !ctx.s.hadRival) {
        ctx.sfx("rival_join");
        // §2.2: same color -> P2 takes the next free one for now (guests only:
        // the core has no per-match color override for a saved profile)
        const cur = ctx.profiles.current(), me = ctx.me();
        if (ctx.p === 1 && me && cur && cur.slot === "guest" && me.color === rival.color) {
          const c = (me.color + 1) % 6;
          ctx.profiles.select("guest", Object.assign({}, me, {color: c}));
          ctx.toast("dev.login.colorClash", {c: colorName(ctx, c)});
        }
      }
      ctx.s.hadRival = !!rival;
    },
    input(ctx, ev) {
      if (ev.btn === "B" && ev.type === "down") { ctx.sfx("ui_back"); ctx.profiles.logout(); }
      if (ev.btn === "MENU" && ev.type === "click") { ctx.sfx("ui_ok"); ctx.go("settings"); }
    },
    draw(ctx, g) {
      ui.topBar(g, ctx, "dev.conn.title", {right: "P" + (ctx.p + 1)});
      const got = ctx.link.gotState, rival = ctx.rival();
      const arcs = got ? 3 : Math.floor(ctx.now() / 300) % 4;
      drawRadio(g, 48, 22, arcs, got ? "grassLt" : "accent");
      let key, c = "white";
      if (!got) key = "dev.conn.finding";
      else if (rival) { key = "dev.conn.ok"; c = "grassLt"; }
      else key = rivalLinked(ctx) && (ctx.lobby.hover[1 - ctx.p] >> 4) === C.PRESENCE.LOGIN ? "dev.conn.rivalLogin" : "dev.conn.waitRival";
      g.text(64, 58, ctx.t(key), {align: "c", w: 120, c, key});
      g.text(64, 72, ctx.t("dev.conn.ch", {ch: ctx.hw.channel, p: ctx.p + 1}), {align: "c", w: 120, c: "muted", key: "dev.conn.ch"});
      if (!got && ctx.now() - ctx.s.t0 >= 10000) {
        g.frame(4, 98, 120, 44, "gold");
        g.text(64, 104, ctx.t("dev.conn.help1"), {align: "c", w: 116, key: "dev.conn.help1"});
        g.text(64, 122, ctx.t("dev.conn.help2"), {align: "c", w: 116, key: "dev.conn.help2"});
      } else {
        card(ctx, g, 6, "dev.ui.you", ctx.me(), ctx.color());
        card(ctx, g, 66, "dev.ui.rival", rival, rival ? D.PLAYER_COLORS[rival.color % 6] : "line");
      }
      ui.hintBar(g, ctx, [["B", "dev.ui.back"], ["M", "dev.conn.hintSetup"]]);
    },
  });
  // S09 settings and S10 calibrate live in screens-menu.js.
})();
