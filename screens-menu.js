// Pocket Rivals handheld simulator: S07 mode select, S08 lobby, S19 results,
// overlays S15 pause, S16 no signal, S17 link lost, S18 error, confirm
// (docs/ui-design.md §1.3, §4.4-4.5, §4.11-4.13), and later the central
// session rules (DEVICE.registerSession)
//
// STEP-0 STUB (owner: agent B). Registers every screen and overlay this file
// owns with a "TODO <id>" placeholder and just enough input to walk the flow
// on the core's stub session (vote -> agree -> lobby -> ready -> mode ->
// results -> again / menu). Replace the whole file; keep the ids and the
// dev.menu. / dev.lobby. / dev.res. / dev.ov. prefixes. API: device-core.js.
(() => {
  const D = window.DEVICE, ui = D.ui, C = D.C, A = C.ACT;

  D.registerStrings("dev.menu.", {
    zh: {"dev.menu.battle": "对抗", "dev.menu.race": "双人赛车", "dev.menu.adv": "双人冒险",
      "dev.menu.battleSub": "宠物三对三", "dev.menu.raceSub": "{n}圈卡丁车", "dev.menu.advSub": "合作解谜",
      "dev.menu.settings": "设置", "dev.menu.beta": "试玩", "dev.menu.agreed": "一致！", "dev.menu.logout": "退出登录？",
      "dev.menu.rivalVote": "对方：{mode}{OK}", "dev.menu.hintVote": "投票", "dev.menu.hintAgree": "同意", "dev.menu.hintUndo": "撤回", "dev.menu.hintLogout": "退出"},
    en: {"dev.menu.battle": "BATTLE", "dev.menu.race": "RACING", "dev.menu.adv": "ADVENTURE",
      "dev.menu.battleSub": "Pet duel 3v3", "dev.menu.raceSub": "{n} laps", "dev.menu.advSub": "Co-op",
      "dev.menu.settings": "SETTINGS", "dev.menu.beta": "BETA", "dev.menu.agreed": "AGREED!", "dev.menu.logout": "Log out?",
      "dev.menu.rivalVote": "Rival: {mode} {OK}", "dev.menu.hintVote": "Vote", "dev.menu.hintAgree": "Agree", "dev.menu.hintUndo": "Undo", "dev.menu.hintLogout": "Exit"},
  });
  D.registerStrings("dev.lobby.", {
    zh: {"dev.lobby.laps": "{n}圈", "dev.lobby.rooms": "{n}关", "dev.lobby.battleBadge": "3v3", "dev.lobby.ready": "已准备",
      "dev.lobby.pauseKey": "按住{M}：暂停", "dev.lobby.hintReady": "准备", "dev.lobby.hintUndo": "撤回"},
    en: {"dev.lobby.laps": "{n} laps", "dev.lobby.rooms": "{n} rooms", "dev.lobby.battleBadge": "3v3", "dev.lobby.ready": "Ready",
      "dev.lobby.pauseKey": "Hold {M}: pause", "dev.lobby.hintReady": "Ready", "dev.lobby.hintUndo": "Undo"},
  });
  D.registerStrings("dev.res.", {
    zh: {"dev.res.victory": "胜利！", "dev.res.defeat": "失败", "dev.res.rivalAgain": "对方：再来一局{OK}", "dev.res.hintRetry": "重来"},
    en: {"dev.res.victory": "VICTORY!", "dev.res.defeat": "DEFEAT", "dev.res.rivalAgain": "Rival: again? {OK}", "dev.res.hintRetry": "Retry"},
  });
  D.registerStrings("dev.ov.", {
    zh: {"dev.ov.paused": "暂停", "dev.ov.pausedBy": "{name}暂停了", "dev.ov.resume": "继续", "dev.ov.quit": "退出", "dev.ov.quitAsk": "结束对局？",
      "dev.ov.hintResume": "继续", "dev.ov.noSignal": "信号丢失", "dev.ov.reconnecting": "正在重连…", "dev.ov.reconnected": "{OK} 已重连",
      "dev.ov.peerLost": "掉线了", "dev.ov.gamePaused": "游戏已暂停", "dev.ov.peerBack": "对方回来了！", "dev.ov.error": "错误",
      "dev.ov.e1": "版本不一致", "dev.ov.e2": "两块板都是P1", "dev.ov.centralReset": "中央板重启了"},
    en: {"dev.ov.paused": "PAUSED", "dev.ov.pausedBy": "by {name}", "dev.ov.resume": "Resume", "dev.ov.quit": "Quit", "dev.ov.quitAsk": "End match?",
      "dev.ov.hintResume": "Play", "dev.ov.noSignal": "NO SIGNAL", "dev.ov.reconnecting": "Reconnecting...", "dev.ov.reconnected": "{OK} Reconnected",
      "dev.ov.peerLost": "lost signal", "dev.ov.gamePaused": "PAUSED", "dev.ov.peerBack": "Rival is back!", "dev.ov.error": "ERROR",
      "dev.ov.e1": "Version mismatch", "dev.ov.e2": "Both boards are P1", "dev.ov.centralReset": "Central restarted"},
  });

  const down = ev => ev.type === "down" || ev.type === "repeat";
  const me = ctx => ctx.p, other = ctx => 1 - ctx.p;

  // S07: cards = registered modes + the settings row; A votes, S agrees, B undoes / logs out
  D.stubScreen("menu", {
    enter(ctx) { ctx.s.sel = 0; ctx.setHover(0); },
    lines: () => [],
    art(ctx, g) {
      const modes = D.modes(), L = ctx.lobby;
      modes.forEach((m, i) => {
        const y = 18 + i * 26;
        if (ctx.s.sel === i) g.frame(4, y, 120, 24, "accent", 2); else g.frame(4, y, 120, 24, "line");
        g.sprite(m.icon || "ui.mode.battle", 8, y + 6);
        g.text(24, y + 1, ctx.t(m.titleKey), {w: 60});
        if (m.status === "prototype") g.text(120, y + 1, ctx.t("dev.menu.beta"), {align: "r", c: "gold", w: 24});
        if (L && L.vote[me(ctx)] === m.modeId) g.sprite("icon.OK", 92, y + 14, {color: ctx.color()});
        if (L && L.vote[other(ctx)] === m.modeId) g.sprite("icon.OK", 108, y + 14);
        else if (L && (L.hover[other(ctx)] & 15) === i) g.frame(108, y + 14, 8, 8, "white");
      });
      const sy = 18 + modes.length * 26;
      if (ctx.s.sel === modes.length) g.frame(4, sy, 120, 16, "accent", 2);
      g.sprite("icon.GEAR", 8, sy + 4);
      g.text(20, sy + 1, ctx.t("dev.menu.settings"), {w: 90});
      const rv = L ? L.vote[other(ctx)] : 0xff;
      const rm = rv !== 0xff ? D.mode(rv) : null;
      if (rm) g.text(4, 132, ctx.t("dev.menu.rivalVote", {mode: ctx.t(rm.titleKey)}), {w: 120, c: "muted"});
      if (L && L.phase === C.LOBBY.AGREED) ui.banner(ctx.g, ctx, "dev.menu.agreed", null, {y: 56, scale: 2});
    },
    hints: ctx => {
      const L = ctx.lobby, mine = L ? L.vote[me(ctx)] : 0xff, theirs = L ? L.vote[other(ctx)] : 0xff;
      return [["A", "dev.menu.hintVote"], theirs !== 0xff ? ["S", "dev.menu.hintAgree"] : null,
        ["B", mine !== 0xff ? "dev.menu.hintUndo" : "dev.menu.hintLogout"]];
    },
    input(ctx, ev) {
      const modes = D.modes(), n = modes.length + 1, L = ctx.lobby;
      if (down(ev) && (ev.btn === "UP" || ev.btn === "DOWN")) {
        ctx.s.sel = (ctx.s.sel + (ev.btn === "UP" ? -1 : 1) + n) % n;
        ctx.setHover(ctx.s.sel);
        ctx.sfx("ui_move");
        return;
      }
      if (ev.type !== "down" && ev.type !== "click") return;
      if (ev.btn === "A" && ev.type === "down") {
        if (ctx.s.sel === modes.length) { ctx.go("settings"); return; }
        ctx.rt(A.VOTE, modes[ctx.s.sel].modeId); ctx.sfx("ui_ok");
      } else if (ev.btn === "SKILL" && ev.type === "down" && L && L.vote[other(ctx)] !== 0xff) {
        const i = modes.findIndex(m => m.modeId === L.vote[other(ctx)]);
        if (i >= 0) { ctx.s.sel = i; ctx.setHover(i); }
        ctx.rt(A.VOTE, L.vote[other(ctx)]); ctx.sfx("ui_ok");
      } else if (ev.btn === "B" && ev.type === "down") {
        if (L && L.vote[me(ctx)] !== 0xff) { ctx.rt(A.VOTE, 0xff); ctx.sfx("ui_back"); }
        else ctx.confirm({textKey: "dev.menu.logout", onYes: () => ctx.profiles.logout()});
      } else if (ev.btn === "MENU" && ev.type === "click") ctx.go("settings");
    },
    bot(ctx, ctl) {
      const L = ctx.lobby;
      if (!L || L.vote[other(ctx)] === 0xff || L.vote[other(ctx)] === L.vote[me(ctx)]) { ctx.s.botAt = null; return; }
      if (ctx.s.botAt == null) ctx.s.botAt = ctx.now();
      if (ctx.now() - ctx.s.botAt > 1000) { ctx.s.botAt = null; ctl.press("SKILL"); }
    },
  });

  // S08: mode goals + keys from registerMode's lobby; A = ready, B = both back to the menu
  D.stubScreen("lobby", {
    lines: ctx => {
      const L = ctx.lobby, m = L ? D.mode(L.mode) : null;
      if (!m) return [];
      const vars = m.lobby && m.lobby.badgeVars ? m.lobby.badgeVars(D.params(m.id)) : {};
      return [[m.titleKey], ...((m.lobby && m.lobby.goals) || []).map(k => [k, vars]), ["dev.lobby.pauseKey"]];
    },
    art(ctx, g) {
      const L = ctx.lobby;
      if (!L) return;
      const mine = (L.readyMask >> me(ctx)) & 1, theirs = (L.readyMask >> other(ctx)) & 1;
      if (ctx.me()) ui.avatar(g, 6, 116, ctx.me());
      g.text(20, 114, ctx.t("dev.ui.you"), {w: 30});
      if (mine) g.sprite("icon.OK", 52, 117, {color: ctx.color()});
      if (ctx.rival()) { ui.avatar(g, 68, 116, ctx.rival()); g.text(82, 114, ctx.rival().name, {w: 36}); }
      if (theirs) g.sprite("icon.OK", 116, 117);
    },
    hints: ctx => [["A", ctx.lobby && (ctx.lobby.readyMask >> me(ctx)) & 1 ? "dev.lobby.hintUndo" : "dev.lobby.hintReady"], ["B", "dev.ui.back"]],
    input(ctx, ev) {
      if (ev.type === "click" && ev.btn === "MENU") { ctx.go("settings"); return; }
      if (ev.type !== "down") return;
      const L = ctx.lobby;
      if (ev.btn === "A" && L) { ctx.rt(A.READY, (L.readyMask >> me(ctx)) & 1 ? 0 : 1); ctx.sfx("ui_ok"); }
      if (ev.btn === "B") { ctx.rt(A.LEAVE); ctx.sfx("ui_back"); }
    },
    bot(ctx, ctl) {
      const L = ctx.lobby;
      if (!L || (L.readyMask >> me(ctx)) & 1) return;
      if (ctx.s.botAt == null) ctx.s.botAt = ctx.now();
      if (ctx.now() - ctx.s.botAt > 1000) { ctx.s.botAt = ctx.now(); ctl.press("A"); }
    },
  });

  // S19: everything from the mode's player.results(ctx); 1.5 s lock, A again, B menu
  D.stubScreen("results", {
    enter(ctx) { ctx.s.t0 = ctx.now(); },
    lines: () => [],
    art(ctx, g) {
      const m = ctx.mode();
      const r = m && m.player.results ? m.player.results(ctx) : null;
      if (!r) return;
      g.text(64, 20, ctx.t(r.titleKey), {align: "c", scale: 2, c: r.titleColor || "gold", w: 120});
      if (r.drawArt) r.drawArt(g, ctx, 4, 50, 120, 20);
      (r.rows || []).slice(0, 4).forEach((row, i) => {
        const y = 76 + i * 14;
        g.text(4, y, ctx.t(row.labelKey), {w: 56});
        if (row.shared != null) g.text(123, y, row.shared, {align: "r", w: 30});
        else { g.text(92, y, row.you, {align: "r", w: 30}); g.text(123, y, row.other, {align: "r", w: 30}); }
      });
      const L = ctx.lobby;
      if (L && (L.rematchMask >> other(ctx)) & 1) g.text(4, 132, ctx.t("dev.res.rivalAgain"), {w: 120});
    },
    hints: ctx => {
      const m = ctx.mode(), r = m && m.player.results ? m.player.results(ctx) : null;
      const again = r && r.again ? r.again.labelKey : "dev.ui.again";
      return [["A", again], ["B", "dev.ui.menu"]];
    },
    input(ctx, ev) {
      if (ev.type !== "down" || ctx.now() - ctx.s.t0 < 1500) return;
      const m = ctx.mode(), r = m && m.player.results ? m.player.results(ctx) : null;
      if (ev.btn === "A") { ctx.rt(A.REMATCH, r && r.again && r.again.kind === "retryRoom" ? 1 : 0); ctx.sfx("ui_ok"); }
      if (ev.btn === "B") { ctx.rt(A.LEAVE); ctx.sfx("ui_back"); }
    },
    bot(ctx, ctl) { if (!ctx.s.botDone && ctx.now() - ctx.s.t0 > 2000) { ctx.s.botDone = true; ctl.press("A"); } },
  });

  // S15: resume / quit (with confirm); B = resume
  D.stubScreen("ov.pause", {
    overlay: true,
    enter(ctx) { ctx.s.sel = 0; ctx.s.ask = false; },
    lines: ctx => {
      const L = ctx.lobby, by = L && L.pausedBy !== 0xff ? L.profile[L.pausedBy] : null;
      const name = by ? D.bytesToStr(by.name) : "";
      if (ctx.s.ask) return [["dev.ov.paused"], ["dev.ov.quitAsk"], "{A} / {B}"];
      return [["dev.ov.paused"], name ? ["dev.ov.pausedBy", {name}] : "",
        (ctx.s.sel === 0 ? "> " : "  ") + ctx.t("dev.ov.resume"), (ctx.s.sel === 1 ? "> " : "  ") + ctx.t("dev.ov.quit")];
    },
    hints: [["A", "dev.ui.ok"], ["B", "dev.ov.hintResume"]],
    input(ctx, ev) {
      if (down(ev) && (ev.btn === "UP" || ev.btn === "DOWN") && !ctx.s.ask) { ctx.s.sel = 1 - ctx.s.sel; ctx.sfx("ui_move"); return; }
      if (ev.type !== "down") return;
      if (ctx.s.ask) {
        if (ev.btn === "A") { ctx.rt(A.QUIT, 0); ctx.sfx("ui_ok"); }
        if (ev.btn === "B") { ctx.s.ask = false; ctx.sfx("ui_back"); }
        return;
      }
      if (ev.btn === "B" || (ev.btn === "A" && ctx.s.sel === 0)) { ctx.rt(A.PAUSE, 0); ctx.sfx("ui_ok"); }
      else if (ev.btn === "A") ctx.s.ask = true;
    },
    bot(ctx, ctl) {
      const L = ctx.lobby;
      if (L && L.pausedBy === ctx.p && !ctx.s.botDone) { ctx.s.botDone = true; ctl.press("B"); }
    },
  });
  D.stubScreen("ov.nosignal", {
    overlay: true,
    enter(ctx) { ctx.s.t0 = ctx.now(); ctx.sfx("link_lost"); },
    linger: () => 600,
    lines: ctx => ctx.lingering ? [["dev.ov.reconnected"]] : [["dev.ov.noSignal"], ["dev.ov.reconnecting"], Math.floor((ctx.now() - ctx.s.t0) / 1000) + " s"],
  });
  D.stubScreen("ov.linklost", {
    overlay: true,
    linger: () => 800,
    lines: ctx => ctx.lingering ? [["dev.ov.peerBack"]] : [["dev.ov.gamePaused"], ctx.rival() ? ctx.rival().name : "", ["dev.ov.peerLost"]],
  });
  D.stubScreen("ov.error", {
    overlay: true,
    lines: ctx => { const e = ctx.error(); return e ? [["dev.ov.error"], e.code, e.code === "E1" ? ["dev.ov.e1"] : ["dev.ov.e2"]] : []; },
  });
  D.stubScreen("ov.confirm", {
    overlay: true,
    lines: ctx => { const c = ctx.local.confirm; return c ? [[c.textKey, c.vars], "{A} / {B}"] : []; },
    hints: [["A", "dev.ui.yes"], ["B", "dev.ui.no"]],
    input(ctx, ev) {
      if (ev.type !== "down") return;
      if (ev.btn === "A") { ctx.sfx("ui_ok"); ctx.closeConfirm(true); }
      if (ev.btn === "B") { ctx.sfx("ui_back"); ctx.closeConfirm(false); }
    },
  });
})();
