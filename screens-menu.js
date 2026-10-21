// Pocket Rivals handheld simulator: the central session rules
// (DEVICE.registerSession: vote, ready, score, pause, rematch, quit), S07 mode
// select, S08 lobby, S19 results (shared by the three modes), the overlays
// S15 pause, S16 no signal, S17 link lost, S18 error, the confirm box, and
// (round 2) S09 settings + S10 calibrate. Spec: docs/ui-design.md §1.3,
// §3, §4.4-4.6, §4.11-4.13, §7.6-7.7, §8.3. API: the header of device-core.js.
//
(() => {
  "use strict";
  const D = window.DEVICE, ui = D.ui, C = D.C, A = C.ACT, LB = C.LOBBY, SEV = C.SEV, PR = C.PRESENCE;
  const NONE = 0xff;

  /* ============================== strings ============================== */

  D.registerStrings("dev.menu.", {
    zh: {"dev.menu.battle": "对抗", "dev.menu.race": "双人赛车", "dev.menu.adv": "双人冒险",
      "dev.menu.battleSub": "宠物三对三", "dev.menu.raceSub": "{n}圈卡丁车", "dev.menu.advSub": "合作解谜",
      "dev.menu.settings": "设置", "dev.menu.beta": "试玩", "dev.menu.soon": "未做",
      "dev.menu.rivalVote": "对方：{mode}{OK}", "dev.menu.rivalLook": "对方在看：{mode}", "dev.menu.rivalSet": "对方在设置里",
      "dev.menu.differ": "不一样！{S}同意对方", "dev.menu.agreed": "一致！", "dev.menu.notBuilt": "固件还没有这个模式",
      "dev.menu.logout": "退出登录？", "dev.menu.rivalOut": "{name}退出登录了",
      "dev.menu.hintVote": "投票", "dev.menu.hintAgree": "同意", "dev.menu.hintUndo": "撤回", "dev.menu.hintLogout": "退出"},
    en: {"dev.menu.battle": "BATTLE", "dev.menu.race": "RACING", "dev.menu.adv": "ADVENTURE",
      "dev.menu.battleSub": "Pet duel 3v3", "dev.menu.raceSub": "{n} laps", "dev.menu.advSub": "Co-op",
      "dev.menu.settings": "SETTINGS", "dev.menu.beta": "BETA", "dev.menu.soon": "SOON",
      "dev.menu.rivalVote": "Rival: {mode} {OK}", "dev.menu.rivalLook": "Rival: {mode}?", "dev.menu.rivalSet": "Rival in settings",
      "dev.menu.differ": "Differ! {S} agree", "dev.menu.agreed": "AGREED!", "dev.menu.notBuilt": "Not built yet",
      "dev.menu.logout": "Log out?", "dev.menu.rivalOut": "{name} logged out",
      "dev.menu.hintVote": "Vote", "dev.menu.hintAgree": "Agree", "dev.menu.hintUndo": "Undo", "dev.menu.hintLogout": "Exit"},
  });
  D.registerStrings("dev.lobby.", {
    zh: {"dev.lobby.laps": "{n}圈", "dev.lobby.rooms": "{n}关", "dev.lobby.battleBadge": "3v3", "dev.lobby.ready": "已准备",
      "dev.lobby.pauseKey": "按住{M}：暂停", "dev.lobby.left": "{name}返回了菜单",
      "dev.lobby.hintReady": "准备", "dev.lobby.hintUndo": "撤回"},
    en: {"dev.lobby.laps": "{n} laps", "dev.lobby.rooms": "{n} rooms", "dev.lobby.battleBadge": "3v3", "dev.lobby.ready": "Ready",
      "dev.lobby.pauseKey": "Hold {M}: pause", "dev.lobby.left": "{name} left",
      "dev.lobby.hintReady": "Ready", "dev.lobby.hintUndo": "Undo"},
  });
  D.registerStrings("dev.res.", {
    zh: {"dev.res.victory": "胜利！", "dev.res.defeat": "失败", "dev.res.rivalQuit": "对方退出", "dev.res.youQuit": "你退出了",
      "dev.res.gaveUp": "放弃", "dev.res.rivalAgain": "对方：再来一局{OK}", "dev.res.partnerAgain": "搭档：再来一局{OK}",
      "dev.res.partnerRetry": "搭档：重来这一间{OK}", "dev.res.hintRetry": "重来", "dev.res.v5Again": "任一方按{A}重开",
      "dev.res.waitRival": "等对方…"},
    en: {"dev.res.victory": "VICTORY!", "dev.res.defeat": "DEFEAT", "dev.res.rivalQuit": "RIVAL QUIT", "dev.res.youQuit": "YOU QUIT",
      "dev.res.gaveUp": "GAVE UP", "dev.res.rivalAgain": "Rival: again? {OK}", "dev.res.partnerAgain": "Partner: again {OK}",
      "dev.res.partnerRetry": "Partner: retry {OK}", "dev.res.hintRetry": "Retry", "dev.res.v5Again": "Either {A}: rematch",
      "dev.res.waitRival": "Waiting..."},
  });
  D.registerStrings("dev.ov.", {
    zh: {"dev.ov.paused": "暂停", "dev.ov.pausedBy": "{name}暂停了", "dev.ov.peerInSettings": "{name}设置中",
      "dev.ov.resume": "继续", "dev.ov.settings": "设置", "dev.ov.quit": "退出", "dev.ov.quitAsk": "结束对局？",
      "dev.ov.hintResume": "继续", "dev.ov.yesNo": "{A}确定  {B}取消", "dev.ov.holdA": "按住{A}",
      "dev.ov.noSignal": "信号丢失", "dev.ov.reconnecting": "正在重连…", "dev.ov.closer": "靠近中央板",
      "dev.ov.safe1": "对局保存在中央板", "dev.ov.safe2": "", "dev.ov.reconnected": "{OK} 已重连",
      "dev.ov.peerLost": "掉线了", "dev.ov.gamePaused": "游戏已暂停", "dev.ov.selfLost": "中央板收不到本机",
      "dev.ov.holdQuit": "按住{M}退出", "dev.ov.peerBack": "对方回来了！", "dev.ov.centralReset": "中央板重启了",
      "dev.ov.error": "错误", "dev.ov.e1": "版本不一致", "dev.ov.e1fix": "三块板都重新烧录",
      "dev.ov.board": "本机", "dev.ov.central": "中央板", "dev.ov.e2": "两块板都是P1", "dev.ov.e2fix": "用PLAYER=2重新烧录",
      "dev.ov.w1": "没检测到摇杆", "dev.ov.w2": "没有音效卡", "dev.ov.w3": "资料已重置"},
    en: {"dev.ov.paused": "PAUSED", "dev.ov.pausedBy": "by {name}", "dev.ov.peerInSettings": "{name}: settings",
      "dev.ov.resume": "Resume", "dev.ov.settings": "Settings", "dev.ov.quit": "Quit", "dev.ov.quitAsk": "End match?",
      "dev.ov.hintResume": "Play", "dev.ov.yesNo": "{A}Yes  {B}Cancel", "dev.ov.holdA": "Hold {A}",
      "dev.ov.noSignal": "NO SIGNAL", "dev.ov.reconnecting": "Reconnecting...", "dev.ov.closer": "Move closer",
      "dev.ov.safe1": "Match is safe", "dev.ov.safe2": "on the central", "dev.ov.reconnected": "{OK} Reconnected",
      "dev.ov.peerLost": "lost signal", "dev.ov.gamePaused": "PAUSED", "dev.ov.selfLost": "Central lost you",
      "dev.ov.holdQuit": "Hold {M}: quit", "dev.ov.peerBack": "Rival is back!", "dev.ov.centralReset": "Central restarted",
      "dev.ov.error": "ERROR", "dev.ov.e1": "Version mismatch", "dev.ov.e1fix": "Reflash all 3 boards",
      "dev.ov.board": "board", "dev.ov.central": "central", "dev.ov.e2": "Both boards are P1", "dev.ov.e2fix": "Reflash with PLAYER=2",
      "dev.ov.w1": "No joystick", "dev.ov.w2": "No sound card", "dev.ov.w3": "Profile reset"},
  });
  D.registerStrings("dev.set.", {
    zh: {"dev.set.title": "设置", "dev.set.lang": "语言", "dev.set.volume": "音量", "dev.set.clicks": "按键音", "dev.set.pad": "压力垫",
      "dev.set.calibrate": "校准", "dev.set.channel": "无线信道", "dev.set.profile": "编辑资料", "dev.set.about": "关于", "dev.set.bright": "亮度",
      "dev.set.on": "开", "dev.set.off": "关", "dev.set.auto": "自动", "dev.set.langZh": "中文", "dev.set.langEn": "English",
      "dev.set.langNote": "切换会重新开始模拟", "dev.set.chNote": "离开时生效",
      "dev.set.aboutFw": "固件 {v}", "dev.set.aboutProto": "协议 v{n}", "dev.set.aboutRx": "信号 {n}/10",
      "dev.set.aboutPlayer": "玩家 P{n}", "dev.set.aboutCh": "信道 {n}",
      "dev.set.calTitle": "校准", "dev.set.cal1": "松开摇杆和压力垫", "dev.set.cal2": "用力捏 3 秒", "dev.set.cal3": "跟着光带 2 秒",
      "dev.set.calRaw": "读数", "dev.set.calPeak": "峰值", "dev.set.calSecs": "{n}秒", "dev.set.calSmall": "压力变化太小",
      "dev.set.calOk": "完成！{A}保存", "dev.set.noPad1": "没检测到压力垫", "dev.set.noPad2": "用{A}代替",
      "dev.set.hintSave": "保存", "dev.set.hintBack": "返回", "dev.set.hintRedo": "重来", "dev.set.hintOpen": "打开"},
    en: {"dev.set.title": "SETTINGS", "dev.set.lang": "Language", "dev.set.volume": "Volume", "dev.set.clicks": "Clicks", "dev.set.pad": "Pad",
      "dev.set.calibrate": "Calibrate", "dev.set.channel": "Channel", "dev.set.profile": "Edit profile", "dev.set.about": "About", "dev.set.bright": "Brightness",
      "dev.set.on": "On", "dev.set.off": "Off", "dev.set.auto": "Auto", "dev.set.langZh": "中文", "dev.set.langEn": "English",
      "dev.set.langNote": "Restarts simulator", "dev.set.chNote": "Applies on exit",
      "dev.set.aboutFw": "Firmware {v}", "dev.set.aboutProto": "Protocol v{n}", "dev.set.aboutRx": "Signal {n}/10",
      "dev.set.aboutPlayer": "Player P{n}", "dev.set.aboutCh": "Channel {n}",
      "dev.set.calTitle": "CALIBRATE", "dev.set.cal1": "Release all", "dev.set.cal2": "Squeeze hard 3 s", "dev.set.cal3": "Hold in band 2 s",
      "dev.set.calRaw": "raw", "dev.set.calPeak": "peak", "dev.set.calSecs": "{n}s", "dev.set.calSmall": "Too little change",
      "dev.set.calOk": "Done! {A} save", "dev.set.noPad1": "No pad found", "dev.set.noPad2": "Use {A} instead",
      "dev.set.hintSave": "Save", "dev.set.hintBack": "Back", "dev.set.hintRedo": "Redo", "dev.set.hintOpen": "Open"},
  });

  // 12x12 art for S16 / S18 (drawn at x2 = 24x24)
  D.registerSprites("ov.", {
    "ov.antenna": {w: 12, h: 12, map: {"#": "muted", x: "danger"}, frames: [[
      "#....#.....#", ".#...#....#.", "..#..#...#..", "...#.#..#...", "....###.....", ".....#......",
      ".....#.x...x", ".....#..x.x.", ".....#...x..", ".....#..x.x.", ".....#.x...x", "....###....."]]},
    "ov.warn": {w: 12, h: 12, map: {"#": "gold", o: "void"}, frames: [[
      ".....##.....", ".....##.....", "....####....", "....#oo#....", "...##oo##...", "...##oo##...",
      "..###oo###..", "..########..", ".####oo####.", ".####oo####.", "############", "############"]]},
  });

  /* ============================== helpers ============================== */

  const isDown = ev => ev.type === "down";
  const isMove = ev => ev.type === "down" || ev.type === "repeat";
  const other = ctx => 1 - ctx.p;
  const bit = (mask, p) => (mask >> p) & 1;
  const colorOf = pr => D.PLAYER_COLORS[(pr && pr.color | 0) % 6] || "white";
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const cards = () => D.modes().slice(0, 3);
  const nameOf = (lobby, p) => lobby && lobby.profile[p] ? D.bytesToStr(lobby.profile[p].name) : "";
  const presenceOf = (lobby, p) => lobby ? lobby.hover[p] >> 4 : PR.MENU;
  const mmss = ms => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
  const hasStick = ctx => ctx.hw.caps.joy !== false;
  // A results screen under an overlay (S17 after a QUIT(1), the rival still gone): let it through
  const baseCtx = ctx => Object.getPrototypeOf(ctx);
  function results(ctx) {
    const m = ctx.mode();
    if (!m || !m.player.results || !ctx.m) return null;
    try { return m.player.results(ctx) || null; } catch (e) { return null; }
  }
  // The mode card under the cursor needs a stick it does not have / is not built
  const cardState = (ctx, m) => {
    const L = ctx.lobby;
    const built = !L || bit(L.modesBuilt, m.modeId) || m.modeId >= 8;
    return {built, noStick: !!m.needsStick && !hasStick(ctx)};
  };
  // the session-event toasts and the shared sounds, on every board, every screen
  D.onLobby((ctx, L, prev) => {
    if (!prev) return;
    if (L.evId !== prev.evId && L.evWho !== ctx.p) {
      const name = nameOf(prev, L.evWho) || nameOf(L, L.evWho);
      if (L.evType === SEV.LEFT && name) ctx.toast("dev.lobby.left", {name});
      if (L.evType === SEV.LOGOUT && name) ctx.toast("dev.menu.rivalOut", {name});
    }
    if (L.phase === LB.AGREED && prev.phase !== LB.AGREED) ctx.sfx("mode_agree");
    if (L.phase === LB.IN_MODE && prev.phase === LB.LOBBY) ctx.sfx("ready_go");
  });

  /* ============================== session (central) ============================== */

  D.registerSession({
    create(api) {
      const s = {
        phase: LB.WAIT, mode: NONE, hover: [0x0f, 0x0f], presence: [PR.LOGIN, PR.LOGIN], vote: [NONE, NONE], ready: 0, rematch: 0,
        rematchArg: [0, 0], wins: [0, 0, 0, 0, 0, 0], ev: {id: 0, type: SEV.NONE, who: 0}, modeRes: [0, 0, 0, 0],
        waitUntil: null, agreedUntil: 0, pausedBy: NONE, pausePending: [false, false], wasPresent: [false, false],
      };
      const profiles = () => api.profiles();
      const present = p => api.links()[p] && !!profiles()[p] && s.presence[p] !== PR.LOGIN;
      const event = (type, who) => { s.ev = {id: ((s.ev.id + 1) & 0xff) || 1, type, who}; api.broadcast(); };
      const hasJoy = p => { const pr = profiles()[p]; return !pr || pr.caps == null || !!(pr.caps & 2); };
      // §1.3 rule 9: SELECT clears votes, ready and rematch (hover stays)
      function enterSelect() {
        s.phase = LB.SELECT; s.vote = [NONE, NONE]; s.ready = 0; s.rematch = 0; s.mode = NONE;
        api.nextStep(); api.broadcast();
      }
      function enterWait() {
        s.phase = LB.WAIT; s.vote = [NONE, NONE]; s.ready = 0; s.rematch = 0; s.waitUntil = null;
        api.nextStep(); api.broadcast();
      }
      function start(opts) {
        s.rematch = 0; s.rematchArg = [0, 0]; s.pausePending = [false, false]; s.pausedBy = NONE;
        s.phase = LB.IN_MODE;
        api.startMode(s.mode, opts);
        api.broadcast();
      }
      const loserOf = res => res && res.winner === 0 ? 1 : 0;   // the loser starts the rematch (game.c)

      return {
        get pausePending() { return s.pausePending; },
        get _s() { return s; },
        hello() { api.broadcast(); },
        ui(p, hover, presence) {
          if (s.hover[p] !== hover || s.presence[p] !== presence) api.broadcast();
          s.hover[p] = hover; s.presence[p] = presence;
        },
        action(p, a, arg) {
          switch (a) {
          case A.VOTE: {
            if (s.phase !== LB.SELECT) return false;                 // AGREED: no votes, no undo
            if (arg !== NONE) {
              const d = D.mode(arg);
              if (!d || d.hidden) return false;
              if (d.needsStick && !hasJoy(p)) return false;
            }
            s.vote[p] = arg;
            if (s.vote[0] !== NONE && s.vote[0] === s.vote[1]) {
              s.phase = LB.AGREED; s.mode = s.vote[0]; s.agreedUntil = api.now() + 1000; api.nextStep();
            }
            api.broadcast();
            return true;
          }
          case A.READY:
            if (s.phase !== LB.LOBBY || s.presence[p] === PR.SETTINGS) return false;
            s.ready = arg ? s.ready | (1 << p) : s.ready & ~(1 << p);
            api.broadcast();
            return true;
          case A.LEAVE:
            if (s.phase === LB.LOBBY) { enterSelect(); event(SEV.LEFT, p); return true; }
            if (s.phase === LB.IN_MODE && api.over()) { api.endMode(); enterSelect(); event(SEV.LEFT, p); return true; }
            return false;
          case A.PAUSE: {
            if (s.phase !== LB.IN_MODE || api.over()) return false;
            if (!arg) {
              s.pausePending[p] = false;
              if (!api.paused()) return true;
              // the rival is in the pause menu's settings subpage: wait for him
              if (s.pausedBy !== NONE && s.presence[1 - p] === PR.SETTINGS) return false;
              api.resume(); s.pausedBy = NONE;
              api.broadcast();
              return true;
            }
            if (api.paused() && s.pausedBy !== NONE) return true;
            const when = api.canPause(p);
            if (when === "now") { api.pause(p); s.pausedBy = p; api.broadcast(); return true; }
            if (when === "defer") { s.pausePending[p] = true; event(SEV.PAUSE_LATER, p); return true; }
            return false;
          }
          case A.REMATCH: {
            const res = api.over();
            if (s.phase !== LB.IN_MODE || !res) return false;
            s.rematch |= 1 << p; s.rematchArg[p] = arg ? 1 : 0;
            api.broadcast();
            if (s.rematch === 3) start({rematch: true, first: loserOf(res), retryRoom: s.rematchArg[0] === 1 && s.rematchArg[1] === 1});
            return true;
          }
          case A.QUIT: {
            if (s.phase !== LB.IN_MODE || api.over()) return false;
            // arg 1 = "the rival has been gone >= 30 s": only while his link is really down
            const who = arg === 1 ? 1 - p : p;
            if (arg === 1 && api.links()[who]) return false;
            s.pausedBy = NONE; s.pausePending = [false, false];
            api.resume();
            api.quitMode(who); event(SEV.QUIT, who);
            return true;
          }
          }
          return false;
        },
        tick(now) {
          for (let p = 0; p < 2; p++) {
            const pr = present(p);
            // logged out outside a mode: he is gone (profile and vote cleared, WAIT)
            if (s.wasPresent[p] && !pr && s.phase !== LB.IN_MODE && api.links()[p] && s.presence[p] === PR.LOGIN) event(SEV.LOGOUT, p);
            if (s.phase !== LB.IN_MODE) s.wasPresent[p] = pr;
          }
          if (s.phase !== LB.IN_MODE) {
            const both = present(0) && present(1);
            if (!both) {
              if (s.phase !== LB.WAIT) enterWait();
              s.waitUntil = null;
            } else if (s.phase === LB.WAIT) {
              if (s.waitUntil === null) s.waitUntil = now + 1000;            // both here for 1 s -> SELECT
              if (now >= s.waitUntil) { s.waitUntil = null; enterSelect(); }
            } else if (s.phase === LB.AGREED && now >= s.agreedUntil) {
              s.phase = LB.LOBBY; s.ready = 0; api.nextStep(); api.broadcast();
            } else if (s.phase === LB.LOBBY) {
              for (let p = 0; p < 2; p++) {
                if (s.presence[p] === PR.SETTINGS && bit(s.ready, p)) { s.ready &= ~(1 << p); api.broadcast(); }
              }
              if (s.ready === 3) start({first: api.randInt(2)});
            }
            return;
          }
          if (!api.mode()) { enterSelect(); return; }
          for (let p = 0; p < 2; p++) {
            if (s.pausePending[p] && !api.over() && api.canPause(p) === "now") {
              s.pausePending[p] = false;
              if (!api.paused()) { api.pause(p); s.pausedBy = p; api.broadcast(); }
            }
          }
          if (!api.paused() && s.pausedBy !== NONE) s.pausedBy = NONE;
        },
        snapshot() {
          const prof = profiles();
          return {
            phase: s.phase, mode: s.mode,
            hover: [0, 1].map(p => ((s.presence[p] & 0x0f) << 4) | (s.hover[p] & 0x0f)),
            vote: s.vote.slice(), readyMask: s.ready, rematchMask: s.rematch,
            pausedBy: api.paused() ? s.pausedBy : NONE,
            wins: s.wins.slice(),
            profile: [0, 1].map(p => prof[p] && (s.presence[p] !== PR.LOGIN || s.phase === LB.IN_MODE)
              ? {name: prof[p].name, avatar: prof[p].avatar, color: prof[p].color} : {name: [0, 0, 0, 0, 0, 0], avatar: 0, color: 0}),
            modesBuilt: D.registry.modes.reduce((m, d) => d.modeId < 8 ? m | (1 << d.modeId) : m, 0),
            evId: s.ev.id, evType: s.ev.type, evWho: s.ev.who, error: 0, modeRes: s.modeRes.slice(),
          };
        },
        modeOver(res) {
          if (res.winner === 0 || res.winner === 1) {
            const d = D.mode(s.mode);
            const k = res.winner * 3 + (d && d.modeId < 3 ? d.modeId : 0);
            s.wins[k] = Math.min(255, s.wins[k] + 1);
          }
          s.modeRes = Array.isArray(res.res) ? [0, 1, 2, 3].map(i => (res.res[i] | 0) & 0xff) : [0, 0, 0, 0];
          s.pausePending = [false, false];
          api.broadcast();
        },
      };
    },
  });

  /* ============================== S07 mode select ============================== */

  const CARD_Y = [16, 50, 84];
  D.registerScreen("menu", {
    fps: 15,
    enter(ctx) {
      const n = cards().length;
      // a new visit starts on the first card; coming back from settings keeps the cursor
      ctx.s.sel = ctx.local.menuKeep ? Math.min(ctx.local.hover | 0, n) : 0;
      ctx.local.menuKeep = false;
      ctx.setHover(ctx.s.sel);
      // W1 / W3 once per power-on
      if (!hasStick(ctx) && !ctx.local.w1Shown) { ctx.local.w1Shown = true; ctx.toast("dev.ov.w1"); }
      else if (ctx.local.flashReset && !ctx.local.w3Shown) { ctx.local.w3Shown = true; ctx.toast("dev.ov.w3"); }
    },
    state(ctx, L, prev) {
      if (L.phase === LB.AGREED && (!prev || prev.phase !== LB.AGREED)) ctx.s.agreedAt = ctx.now();
      const me = L.vote[ctx.p], them = L.vote[other(ctx)];
      if (me !== NONE && them !== NONE && me !== them) { if (ctx.s.differSince == null) ctx.s.differSince = ctx.now(); }
      else ctx.s.differSince = null;
    },
    draw(ctx, g) {
      const L = ctx.lobby, list = cards(), o = other(ctx);
      const me = ctx.me(), rival = ctx.rival();
      const rivalSet = !!rival && presenceOf(L, o) === PR.SETTINGS;
      // top bar: me vs rival
      ui.topBar(g, ctx, null, {title: ""});
      if (me) { ui.avatar(g, 2, 2, me); g.text(14, 0, me.name, {w: 36}); }
      g.text(52, 0, "vs", {font: "s", c: "muted"});
      if (rival) {
        g.text(66, 0, rival.name, {w: 36});
        if (rivalSet) g.sprite("icon.GEAR", 104, 3); else ui.avatar(g, 104, 2, rival);
      }
      const myC = ctx.color(), rvC = colorOf(rival);
      const agreed = L && L.phase === LB.AGREED;
      list.forEach((m, i) => {
        const y = CARD_Y[i], st = cardState(ctx, m), grey = !st.built || st.noStick;
        const flash = agreed && L.mode === m.modeId && Math.floor((ctx.now() - (ctx.s.agreedAt || 0)) / 167) % 2 === 0;
        g.frame(4, y, 120, 32, "line");
        if (ctx.s.sel === i || flash) g.frame(4, y, 120, 32, flash ? "gold" : "accent", 2);
        if (m.icon) g.sprite(m.icon, 8, y + 4, {scale: 2, color: grey ? "line" : null});
        g.text(38, y + 3, ctx.t(m.titleKey), {w: 60, c: grey ? "muted" : "white", key: m.titleKey});
        const badge = !st.built ? "dev.menu.soon" : m.status === "prototype" ? "dev.menu.beta" : null;
        const sub = m.subKey ? ctx.t(m.subKey, m.subVars ? m.subVars(D.params(m.id)) : null) : "";
        g.text(38, y + 17, sub, {w: badge ? 56 : 80, c: "muted", key: m.subKey});
        if (badge) g.text(120, y + 17, ctx.t(badge), {align: "r", w: 24, c: !st.built || grey ? "muted" : "gold", key: badge});
        if (L && L.vote[ctx.p] === m.modeId) g.sprite("icon.OK", 102, y + 5, {color: myC});
        if (L && L.vote[o] === m.modeId) g.sprite("icon.OK", 112, y + 5, {color: rvC});
        else if (rival && !rivalSet && L && (L.hover[o] & 0x0f) === i) g.frame(112, y + 5, 8, 8, rvC);
      });
      // settings row
      const sy = 118, onSet = ctx.s.sel === list.length;
      if (onSet) g.frame(4, sy - 1, 120, 15, "accent", 2);
      g.sprite("icon.GEAR", 8, sy + 3);
      g.text(20, sy, ctx.t("dev.menu.settings"), {w: 90, key: "dev.menu.settings"});
      // status line
      const status = menuStatus(ctx);
      if (status) g.text(4, 132, ctx.t(status[0], status[1]), {w: 120, c: "muted", key: status[0]});
      if (agreed) ui.banner(g, ctx, "dev.menu.agreed", null, {y: 56, scale: 2});
      const h = menuHints(ctx);
      ui.hintBar(g, ctx, h.items, {blink: h.blink, disabled: agreed});
    },
    input(ctx, ev) {
      const L = ctx.lobby, list = cards(), n = list.length + 1, o = other(ctx);
      if (!L || L.phase === LB.AGREED) return;
      const move = d => { ctx.s.sel = (ctx.s.sel + d + n) % n; ctx.setHover(ctx.s.sel); ctx.sfx("ui_move"); };
      if (isMove(ev) && (ev.btn === "UP" || ev.btn === "DOWN")) { move(ev.btn === "UP" ? -1 : 1); return; }
      const stick = hasStick(ctx);
      if (ev.btn === "B") {
        // no stick: short B = next, hold B = back (§3.1)
        if (!stick) { if (ev.type === "click") move(1); if (ev.type !== "long") return; }
        else if (!isDown(ev)) return;
        if (L.vote[ctx.p] !== NONE) { ctx.rt(A.VOTE, NONE); ctx.sfx("ui_back"); }
        else ctx.confirm({textKey: "dev.menu.logout", onYes: () => ctx.profiles.logout()});
        return;
      }
      if (ev.btn === "MENU" && ev.type === "click") { ctx.local.menuKeep = true; ctx.sfx("ui_ok"); ctx.go("settings"); return; }
      if (!isDown(ev)) return;
      if (ev.btn === "A") {
        if (ctx.s.sel === list.length) { ctx.local.menuKeep = true; ctx.sfx("ui_ok"); ctx.go("settings"); return; }
        const m = list[ctx.s.sel], st = cardState(ctx, m);
        if (!st.built) { ctx.sfx("ui_deny"); ctx.toast("dev.menu.notBuilt"); return; }
        if (st.noStick) { ctx.sfx("ui_deny"); ctx.toast("dev.core.needStick"); return; }
        if (L.vote[ctx.p] === m.modeId) return;
        ctx.rt(A.VOTE, m.modeId); ctx.sfx("ui_ok");
      } else if (ev.btn === "SKILL") {
        const v = L.vote[o];
        if (v === NONE || v === L.vote[ctx.p]) return;
        const i = list.findIndex(m => m.modeId === v);
        if (i >= 0 && cardState(ctx, list[i]).noStick) { ctx.sfx("ui_deny"); ctx.toast("dev.core.needStick"); return; }
        if (i >= 0) { ctx.s.sel = i; ctx.setHover(i); }
        ctx.rt(A.VOTE, v); ctx.sfx("ui_ok");
      }
    },
    // §8.3: after the rival votes, wait 1 s and agree; otherwise do nothing
    bot(ctx, ctl) {
      const L = ctx.lobby, o = other(ctx);
      if (!L || L.phase !== LB.SELECT || L.vote[o] === NONE || L.vote[o] === L.vote[ctx.p]) { ctx.s.botAt = null; return; }
      if (ctx.s.botAt == null) ctx.s.botAt = ctx.now();
      if (ctx.now() - ctx.s.botAt > 1000) { ctx.s.botAt = ctx.now() + 1000; ctl.press("SKILL"); }
    },
  });
  // status priority (§4.4): rival in settings > differ for 3 s > rival's vote > rival's cursor
  function menuStatus(ctx) {
    const L = ctx.lobby, o = other(ctx), rival = ctx.rival();
    if (!L || !rival) return null;
    if (presenceOf(L, o) === PR.SETTINGS) return ["dev.menu.rivalSet"];
    if (ctx.s.differSince != null && ctx.now() - ctx.s.differSince >= 3000) return ["dev.menu.differ"];
    const modeName = id => { const d = D.mode(id); return d ? ctx.t(d.titleKey) : ""; };
    if (L.vote[o] !== NONE) return ["dev.menu.rivalVote", {mode: modeName(L.vote[o])}];
    const h = L.hover[o] & 0x0f, list = cards();
    if (h < list.length) return ["dev.menu.rivalLook", {mode: ctx.t(list[h].titleKey)}];
    return null;
  }
  function menuHints(ctx) {
    const L = ctx.lobby, o = other(ctx), list = cards();
    const mine = L ? L.vote[ctx.p] : NONE, theirs = L ? L.vote[o] : NONE;
    const a = ctx.s.sel === list.length ? ["A", "dev.set.hintOpen"] : ["A", "dev.menu.hintVote"];
    const s = theirs !== NONE && theirs !== mine ? ["S", "dev.menu.hintAgree"] : null;
    const b = !hasStick(ctx) ? ["B", "dev.ui.next"] : ["B", mine !== NONE ? "dev.menu.hintUndo" : "dev.menu.hintLogout"];
    const differ = s && ctx.s.differSince != null && ctx.now() - ctx.s.differSince >= 3000;
    return {items: [a, s, b], blink: differ ? 1 : null};
  }

  /* ============================== S08 lobby ============================== */

  D.registerScreen("lobby", {
    fps: 10,
    draw(ctx, g) {
      const L = ctx.lobby, m = L ? D.mode(L.mode) : null, o = other(ctx);
      if (!m) { ui.topBar(g, ctx, null, {title: "", signal: false}); return; }
      const params = D.params(m.id), lob = m.lobby || {};
      const vars = lob.badgeVars ? lob.badgeVars(params) : {};
      ui.topBar(g, ctx, m.titleKey, {right: lob.badgeKey ? ctx.t(lob.badgeKey, vars) : "", signal: false});
      (lob.goals || []).slice(0, 2).forEach((k, i) => g.text(4, 16 + 14 * i, ctx.t(k, vars), {w: 120, key: k}));
      (lob.keys || []).slice(0, 5).forEach((row, i) => {
        const [icon, nameKey, whatKey] = row, y = 44 + 14 * i;
        if (icon) g.text(4, y, "{" + icon + "}");                 // {PAD} draws {A} without a pad
        if (nameKey) g.text(16, y, ctx.t(nameKey, vars), {w: 36, c: "muted", key: nameKey});
        if (whatKey) g.text(56, y, ctx.t(whatKey, vars), {w: 64, key: whatKey});
      });
      g.text(4, 114, ctx.t("dev.lobby.pauseKey"), {w: 120, c: "muted", key: "dev.lobby.pauseKey"});
      // ready row: me on the left, the rival on the right
      g.hline(4, 127, 120, "line");
      const me = ctx.me(), rival = ctx.rival();
      const mark = (x, on, color) => {
        if (on) g.sprite("icon.OK", x, 131, {color});
        else for (let k = 0; k < 3; k++) g.rect(x + k * 3, 136, 2, 2, "muted");
      };
      if (me) ui.avatar(g, 4, 130, me);
      g.text(16, 128, ctx.t("dev.ui.you"), {w: 36, key: "dev.ui.you"});
      mark(52, bit(L.readyMask, ctx.p), ctx.color());
      if (rival) {
        const inSet = presenceOf(L, o) === PR.SETTINGS;
        if (inSet) g.sprite("icon.GEAR", 66, 131); else ui.avatar(g, 66, 130, rival);
        g.text(78, 128, rival.name, {w: 36, c: inSet ? "muted" : "white"});
        mark(114, bit(L.readyMask, o), colorOf(rival));
      }
      const ready = bit(L.readyMask, ctx.p);
      ui.hintBar(g, ctx, [["A", ready ? "dev.lobby.hintUndo" : "dev.lobby.hintReady"], ["B", "dev.ui.back"]]);
    },
    input(ctx, ev) {
      const L = ctx.lobby;
      if (!L) return;
      if (ev.btn === "MENU" && ev.type === "click") {
        if (bit(L.readyMask, ctx.p)) ctx.rt(A.READY, 0);          // going to settings takes back my ready
        ctx.sfx("ui_ok"); ctx.go("settings"); return;
      }
      if (!isDown(ev)) return;
      if (ev.btn === "A") { const r = bit(L.readyMask, ctx.p); ctx.rt(A.READY, r ? 0 : 1); ctx.sfx(r ? "ui_back" : "ui_ok"); }
      else if (ev.btn === "B") { ctx.rt(A.LEAVE); ctx.sfx("ui_back"); }
    },
    bot(ctx, ctl) {
      const L = ctx.lobby;
      if (!L || bit(L.readyMask, ctx.p)) { ctx.s.botAt = null; return; }
      if (ctx.s.botAt == null) ctx.s.botAt = ctx.now();
      if (ctx.now() - ctx.s.botAt > 1000) { ctx.s.botAt = ctx.now(); ctl.press("A"); }
    },
  });

  /* ============================== S19 results ============================== */

  const RES_LOCK_MS = 1500;
  const CONFETTI = ["gold", "fire", "water", "grassLt", "accent", "danger", "white"];
  D.registerScreen("results", {
    fps: ctx => ctx.s.confetti ? 10 : 6,
    enter(ctx) {
      ctx.s.t0 = ctx.now();
      const r = results(ctx);
      ctx.s.confetti = !!(r && r.win === true);
      if (ctx.s.confetti) ctx.s.bits = Array.from({length: 18}, () => ({x: 4 + ctx.rng.int(120), y: ctx.rng.int(26), v: 8 + ctx.rng.int(14), c: CONFETTI[ctx.rng.int(CONFETTI.length)]}));
      const snd = r && r.sfx ? r.sfx : r && r.win === true ? "victory" : r && r.win === false ? "defeat" : null;
      if (snd) ctx.sfx(snd);
    },
    tick(ctx) {
      // the lock is over: record this board's stats once per match
      if (!ctx.s.bumped && ctx.now() - ctx.s.t0 >= RES_LOCK_MS) {
        ctx.s.bumped = true;
        const m = ctx.m;
        if (m && !m.__menuStatsBumped) {
          m.__menuStatsBumped = true;
          const r = results(ctx);
          if (r && r.stats) ctx.profiles.bumpStats(r.stats);
        }
      }
    },
    draw(ctx, g) {
      const r = results(ctx), md = ctx.mode(), L = ctx.lobby, o = other(ctx);
      ui.topBar(g, ctx, md ? md.titleKey : null, {title: md ? null : "", right: r && r.scoreText ? r.scoreText : ""});
      if (!r) return;
      if (ctx.s.confetti) {
        const t = (ctx.now() - ctx.s.t0) / 1000;
        for (const b of ctx.s.bits) g.rect(b.x, 14 + Math.floor(b.y + t * b.v) % 26, 2, 2, b.c);
      }
      g.text(64, 16, ctx.t(r.titleKey, r.titleVars), {align: "c", scale: 2, w: 120, c: r.titleColor || "gold", key: r.titleKey});
      if (r.drawArt) r.drawArt(g, ctx, 4, 42, 120, 20);
      const rows = (r.rows || []).slice(0, 4);
      if (r.noteKey) {
        const blink = r.noteBlink && Math.floor((ctx.now() - ctx.s.t0) / 400) % 2;
        if (!blink) g.text(4, 62, ctx.t(r.noteKey, r.noteVars), {w: 76, c: "gold", key: r.noteKey});
      }
      if (rows.some(row => row.shared == null)) {
        const me = ctx.me(), rival = ctx.rival();
        if (me) ui.avatar(g, 82, 64, me);
        if (rival) ui.avatar(g, 113, 64, rival);
      }
      rows.forEach((row, i) => {
        const y = 76 + 14 * i;
        let lx = 4, lw = 56;
        if (row.star != null) { g.sprite("icon.STAR", 4, y + 3, {color: row.star ? "gold" : "line"}); lx = 14; lw = 46; }
        g.text(lx, y, ctx.t(row.labelKey, row.labelVars), {w: lw, key: row.labelKey});
        if (row.shared != null) g.text(123, y, String(row.shared), {align: "r", w: 30});
        else {
          g.text(92, y, String(row.you == null ? "--" : row.you), {align: "r", w: 30});
          g.text(123, y, String(row.other == null ? "--" : row.other), {align: "r", w: 30});
        }
      });
      // rematch line
      const kind = r.again && r.again.kind === "retryRoom" ? "retryRoom" : "rematch";
      const coop = md && md.coop;
      if (L && bit(L.rematchMask, o)) {
        const k = kind === "retryRoom" ? "dev.res.partnerRetry" : coop ? "dev.res.partnerAgain" : "dev.res.rivalAgain";
        g.text(4, 132, ctx.t(k), {w: 120, key: k});
      } else if (L && bit(L.rematchMask, ctx.p)) g.text(4, 132, ctx.t("dev.res.waitRival"), {w: 120, c: "muted", key: "dev.res.waitRival"});
      const locked = ctx.now() - ctx.s.t0 < RES_LOCK_MS;
      const again = r.again && r.again.labelKey ? r.again.labelKey : "dev.ui.again";
      const sent = L && bit(L.rematchMask, ctx.p);
      ui.hintBar(g, ctx, [["A", again], ["B", "dev.ui.menu"]], {disabled: locked ? true : [!!sent, false]});
    },
    input(ctx, ev) {
      if (!isDown(ev) || ctx.now() - ctx.s.t0 < RES_LOCK_MS) return;
      const r = results(ctx), L = ctx.lobby;
      if (ev.btn === "A") {
        if (L && bit(L.rematchMask, ctx.p)) return;
        ctx.rt(A.REMATCH, r && r.again && r.again.kind === "retryRoom" ? 1 : 0); ctx.sfx("ui_ok");
      } else if (ev.btn === "B") { ctx.rt(A.LEAVE); ctx.sfx("ui_back"); }
    },
    bot(ctx, ctl) { if (!ctx.s.botDone && ctx.now() - ctx.s.t0 > 2000) { ctx.s.botDone = true; ctl.press("A"); } },
  });

  /* ============================== S15 pause ============================== */

  const PANEL = [12, 16, 104, 106];
  function pauseItems(ctx) {
    const md = ctx.mode();
    const items = [{labelKey: "dev.ov.resume", id: "resume"}, {labelKey: "dev.ov.settings", id: "settings"},
      {labelKey: "dev.ov.quit", id: "quit", confirmKey: "dev.ov.quitAsk", action: A.QUIT, arg: 0}];
    for (const it of (md && md.player.pauseItems) || []) if (items.length < 4) items.push(Object.assign({id: "mode"}, it));
    return items;
  }
  const rivalInSub = ctx => { const L = ctx.lobby; return !!L && presenceOf(L, other(ctx)) === PR.SETTINGS; };
  function drawRows(g, ctx, rows, sel, x, y, w) {
    rows.forEach((row, i) => {
      const ry = y + 14 * i;
      if (i === sel) { g.rect(x, ry, w, 14, "void"); g.rect(x, ry, 3, 14, "accent"); }
      g.text(x + 8, ry, row.label, {w: row.value != null ? 52 : w - 12, c: row.disabled ? "line" : "white", key: row.key});
      if (row.bars != null) drawBars(g, x + w - 8, ry, row.bars, i === sel && row.arrows);
      else if (row.value != null) valueWithArrows(g, x + w - 8, ry, row.value, i === sel && row.arrows);
    });
  }
  function valueWithArrows(g, right, y, value, arrows) {
    const r = arrows ? right - 10 : right;
    const m = g.text(r, y, value, {align: "r"});
    if (arrows) { g.sprite("icon.L", r - m.w - 10, y + 3); g.sprite("icon.R", r + 2, y + 3); }
  }
  // volume 0..4 as four 4x8 blocks, right-aligned
  function drawBars(g, right, y, n, arrows) {
    const r = arrows ? right - 10 : right, x0 = r - 23;
    if (n == null || n < 0) { g.text(r, y, "--", {align: "r"}); return; }
    for (let k = 0; k < 4; k++) g.rect(x0 + 6 * k, y + 3, 4, 8, k < n ? "white" : "line");
    if (arrows) { g.sprite("icon.L", x0 - 10, y + 3); g.sprite("icon.R", r + 2, y + 3); }
  }
  D.registerScreen("ov.pause", {
    overlay: true, fps: 10,
    enter(ctx) { ctx.s.sel = 0; ctx.s.ask = null; ctx.s.sub = false; ctx.s.subSel = 0; },
    exit(ctx) { ctx.setPresence(null); },
    draw(ctx, g) {
      ui.dim(g);
      ui.panel(g, ...PANEL);
      const L = ctx.lobby;
      g.text(64, 20, ctx.t("dev.ov.paused"), {align: "c", scale: 2, w: 96, c: "white", key: "dev.ov.paused"});
      const by = L && L.pausedBy !== NONE ? nameOf(L, L.pausedBy) : "";
      const rv = ctx.rival();
      if (rivalInSub(ctx) && rv) g.text(64, 46, ctx.t("dev.ov.peerInSettings", {name: rv.name}), {align: "c", w: 96, c: "muted", key: "dev.ov.peerInSettings"});
      else if (by) g.text(64, 46, ctx.t("dev.ov.pausedBy", {name: by}), {align: "c", w: 96, c: "muted", key: "dev.ov.pausedBy"});
      if (ctx.s.ask) {
        g.textBox(18, 62, 92, 28, ctx.t(ctx.s.ask.confirmKey), {key: ctx.s.ask.confirmKey});
        g.text(64, 90, ctx.t("dev.ov.yesNo"), {align: "c", w: 96, key: "dev.ov.yesNo"});
        ui.hintBar(g, ctx, [["A", "dev.ui.ok"], ["B", "dev.ui.back"]]);
        return;
      }
      if (ctx.s.sub) {
        const st = ctx.settings;
        drawRows(g, ctx, [
          {label: ctx.t("dev.set.volume"), key: "dev.set.volume", bars: ctx.hw.caps.snd === false ? -1 : st.volume | 0, arrows: true},
          {label: ctx.t("dev.set.clicks"), key: "dev.set.clicks", value: ctx.t(st.clicks ? "dev.set.on" : "dev.set.off"), arrows: true},
        ], ctx.s.subSel, 13, 62, 102);
        ui.hintBar(g, ctx, [["A", "dev.ui.ok"], ["B", "dev.ui.back"]]);
        return;
      }
      const items = pauseItems(ctx), wait = rivalInSub(ctx);
      drawRows(g, ctx, items.map(it => ({label: ctx.t(it.labelKey), key: it.labelKey, disabled: it.id === "resume" && wait})), ctx.s.sel, 13, 62, 102);
      ui.hintBar(g, ctx, [["A", "dev.ui.ok"], ["B", "dev.ov.hintResume"]], {disabled: [false, wait]});
    },
    input(ctx, ev) {
      if (ctx.s.ask) {
        if (!isDown(ev)) return;
        if (ev.btn === "A") { const a = ctx.s.ask; ctx.s.ask = null; ctx.rt(a.action, a.arg | 0); ctx.sfx("ui_ok"); }
        else if (ev.btn === "B") { ctx.s.ask = null; ctx.sfx("ui_back"); }
        return;
      }
      if (ctx.s.sub) {
        const st = ctx.settings;
        if (isMove(ev) && (ev.btn === "UP" || ev.btn === "DOWN")) { ctx.s.subSel = 1 - ctx.s.subSel; ctx.sfx("ui_move"); return; }
        const d = ev.btn === "LEFT" ? -1 : ev.btn === "RIGHT" || ev.btn === "A" ? 1 : 0;
        if (d && (isMove(ev) && ev.btn !== "A" || isDown(ev))) {
          if (ctx.s.subSel === 0 && ctx.hw.caps.snd !== false) ctx.saveSettings({volume: ev.btn === "A" ? ((st.volume | 0) + 1) % 5 : clamp((st.volume | 0) + d, 0, 4)});
          if (ctx.s.subSel === 1) ctx.saveSettings({clicks: !st.clicks});
          ctx.sfx("ui_move");
          return;
        }
        if (isDown(ev) && ev.btn === "B") { ctx.s.sub = false; ctx.setPresence(null); ctx.sfx("ui_back"); }
        return;
      }
      const items = pauseItems(ctx);
      if (isMove(ev) && (ev.btn === "UP" || ev.btn === "DOWN")) {
        ctx.s.sel = (ctx.s.sel + (ev.btn === "UP" ? -1 : 1) + items.length) % items.length; ctx.sfx("ui_move"); return;
      }
      if (!isDown(ev)) return;
      const resume = () => {
        if (rivalInSub(ctx)) { ctx.sfx("ui_deny"); return; }
        ctx.rt(A.PAUSE, 0); ctx.sfx("ui_ok");
      };
      if (ev.btn === "B") { resume(); return; }
      if (ev.btn !== "A") return;
      const it = items[ctx.s.sel];
      if (it.id === "resume") resume();
      else if (it.id === "settings") { ctx.s.sub = true; ctx.s.subSel = 0; ctx.setPresence(PR.SETTINGS); ctx.sfx("ui_ok"); }
      else { ctx.s.ask = {confirmKey: it.confirmKey || "dev.ov.quitAsk", action: it.action, arg: it.arg}; ctx.sfx("ui_ok"); }
    },
    // §8.3: the rival's pause: do nothing; my own: B resumes
    bot(ctx, ctl) {
      const L = ctx.lobby;
      if (L && L.pausedBy === ctx.p && !ctx.s.botDone && !rivalInSub(ctx)) { ctx.s.botDone = true; ctl.press("B"); }
    },
  });

  /* ============================== S16 no signal ============================== */

  D.registerScreen("ov.nosignal", {
    overlay: true, fps: 6,
    enter(ctx) { ctx.s.t0 = ctx.now(); ctx.sfx("link_lost"); },
    linger(ctx) { ctx.sfx("link_back"); return 600; },
    draw(ctx, g) {
      g.rect(0, 0, 128, 160, "void");
      g.rect(0, 0, 128, 13, "danger"); g.hline(0, 13, 128, "line");
      g.text(4, 0, ctx.t("dev.ov.noSignal"), {w: 120, key: "dev.ov.noSignal"});
      g.rect(0, 147, 128, 13, "panel"); g.hline(0, 146, 128, "line");
      if (ctx.lingering) {
        g.text(64, 72, ctx.t("dev.ov.reconnected"), {align: "c", w: 120, c: "grassLt", key: "dev.ov.reconnected"});
        return;
      }
      g.sprite("ov.antenna", 52, 24, {scale: 2});
      g.text(64, 58, ctx.t("dev.ov.reconnecting"), {align: "c", w: 120, key: "dev.ov.reconnecting"});
      g.text(64, 72, mmss(ctx.now() - ctx.s.t0 + C.CENTRAL_TIMEOUT_MS), {align: "c", font: "s", scale: 2, c: "white"});
      g.text(4, 100, ctx.t("dev.ov.closer"), {w: 120, c: "muted", key: "dev.ov.closer"});
      g.text(4, 114, ctx.t("dev.ov.safe1"), {w: 120, c: "muted", key: "dev.ov.safe1"});
      const s2 = ctx.t("dev.ov.safe2");
      if (s2) g.text(4, 128, s2, {w: 120, c: "muted", key: "dev.ov.safe2"});
    },
  });

  /* ============================== S17 link lost ============================== */

  const QUIT_AFTER_MS = 30000;
  // the mode's results are up (a QUIT(1) ended the match while the rival is still gone)
  const passThrough = ctx => ctx.screenId === "results";
  D.registerScreen("ov.linklost", {
    overlay: true, fps: 6,
    enter(ctx) { ctx.s.t0 = ctx.now(); },
    linger(ctx) {
      if (passThrough(ctx)) return 0;
      ctx.sfx("rival_join");
      return 800;
    },
    draw(ctx, g) {
      if (passThrough(ctx)) {
        const R = D.registry.screens.results;
        R.draw(baseCtx(ctx), g);
        g.sprite("icon.antenna", 104, 3);
        return;
      }
      ui.dim(g);
      ui.panel(g, ...PANEL);
      const st = ctx.state || ctx.lobby, f = st ? st.flags : 6;
      const selfLost = !(f & (ctx.p === 0 ? C.FLAG.P1_LINK : C.FLAG.P2_LINK));
      const who = selfLost ? ctx.me() : ctx.rival();
      if (ctx.lingering) {
        if (who) ui.avatar(g, 54, 30, who, {scale: 2});
        g.text(64, 58, ctx.t("dev.ov.peerBack"), {align: "c", w: 96, c: "grassLt", key: "dev.ov.peerBack"});
        return;
      }
      if (who) ui.avatar(g, 54, 20, who, {scale: 2, color: "muted"});
      g.text(64, 44, who ? who.name : "", {align: "c", w: 96});
      g.text(64, 58, ctx.t(selfLost ? "dev.ov.selfLost" : "dev.ov.peerLost"), {align: "c", w: 96, key: selfLost ? "dev.ov.selfLost" : "dev.ov.peerLost"});
      g.text(64, 72, ctx.t("dev.ov.gamePaused"), {align: "c", w: 96, c: "muted", key: "dev.ov.gamePaused"});
      const waited = ctx.now() - ctx.s.t0 + C.PLAYER_TIMEOUT_MS;
      g.text(64, 90, mmss(waited), {align: "c", font: "s", scale: 2, c: "white"});
      g.rect(0, 147, 128, 13, "panel"); g.hline(0, 146, 128, "line");
      if (!selfLost && waited >= QUIT_AFTER_MS) {
        const h = Math.min(1000, ctx.held("MENU"));
        if (h > 0) g.rect(0, 157, Math.round(128 * h / 1000), 3, "accent");
        g.text(64, 146, ctx.t("dev.ov.holdQuit"), {align: "c", w: 120, key: "dev.ov.holdQuit"});
      }
    },
    input(ctx, ev) {
      if (passThrough(ctx)) { const R = D.registry.screens.results; if (R.input) R.input(baseCtx(ctx), ev); return; }
      if (ev.btn !== "MENU" || ev.type !== "long") return;
      const st = ctx.state || ctx.lobby, f = st ? st.flags : 6;
      const selfLost = !(f & (ctx.p === 0 ? C.FLAG.P1_LINK : C.FLAG.P2_LINK));
      if (selfLost || ctx.now() - ctx.s.t0 + C.PLAYER_TIMEOUT_MS < QUIT_AFTER_MS) return;
      ctx.rt(A.QUIT, 1); ctx.sfx("ui_ok");
    },
    bot(ctx, ctl) {
      if (passThrough(ctx)) { const R = D.registry.screens.results; if (R.bot) R.bot(baseCtx(ctx), ctl); }
    },
  });

  /* ============================== S18 error ============================== */

  D.registerScreen("ov.error", {
    overlay: true, fps: 4,
    enter(ctx) { ctx.sfx("error"); },
    draw(ctx, g) {
      const e = ctx.error() || ctx.s.last;
      if (ctx.error()) ctx.s.last = ctx.error();
      g.rect(0, 0, 128, 160, "void");
      g.rect(0, 0, 128, 13, "danger"); g.hline(0, 13, 128, "line");
      g.text(4, 0, ctx.t("dev.ov.error"), {w: 76, key: "dev.ov.error"});
      if (!e) return;
      g.text(123, 0, e.code, {align: "r", w: 42});
      g.sprite("ov.warn", 52, 22, {scale: 2});
      const k = e.code === "E2" ? "dev.ov.e2" : "dev.ov.e1";
      g.text(4, 54, ctx.t(k), {w: 120, key: k});
      g.text(4, 72, ctx.t("dev.ov.board"), {w: 48, c: "muted", key: "dev.ov.board"});
      g.text(56, 72, "v" + (e.board == null ? "?" : e.board));
      if (e.code === "E1") {
        g.text(4, 86, ctx.t("dev.ov.central"), {w: 48, c: "muted", key: "dev.ov.central"});
        g.text(56, 86, "v" + (e.central == null ? "?" : e.central));
      }
      const fk = e.code === "E2" ? "dev.ov.e2fix" : "dev.ov.e1fix";
      g.textBox(4, 114, 120, 28, ctx.t(fk), {c: "gold", key: fk});
      ui.hintBar(g, ctx, [["A", "dev.ui.retry"]]);
    },
    // "Retry": the core re-checks every tick; A just acknowledges (and resends the HELLO via a fresh login is not exposed)
    input(ctx, ev) { if (isDown(ev) && ev.btn === "A") ctx.sfx("ui_ok"); },
  });

  /* ============================== confirm box ============================== */

  D.registerScreen("ov.confirm", {
    overlay: true, fps: 15,
    enter(ctx) { ctx.s.armed = false; },
    tick(ctx) {
      const c = ctx.local.confirm;
      if (!c || !c.holdMs) return;
      if (ctx.s.armed && ctx.held("A") >= c.holdMs) { ctx.s.armed = false; ctx.sfx("ui_ok"); ctx.closeConfirm(true); }
    },
    draw(ctx, g) {
      const c = ctx.local.confirm;
      ui.dim(g);
      ui.panel(g, 12, 44, 104, 66);
      if (!c) return;
      const txt = ctx.t(c.textKey, c.vars);
      g.textBox(18, 50, 92, 28, txt, {key: c.textKey});
      if (c.holdMs) {
        g.text(64, 78, ctx.t("dev.ov.holdA"), {align: "c", w: 96, key: "dev.ov.holdA"});
        g.frame(20, 96, 88, 6, "line");
        const h = ctx.s.armed ? Math.min(c.holdMs, ctx.held("A")) : 0;
        if (h > 0) g.rect(21, 97, Math.round(86 * h / c.holdMs), 4, "danger");
        ui.hintBar(g, ctx, [["A", "dev.ui.ok"], ["B", "dev.ui.back"]]);
      } else {
        g.text(64, 86, ctx.t("dev.ov.yesNo"), {align: "c", w: 96, key: "dev.ov.yesNo"});
        ui.hintBar(g, ctx, [["A", "dev.ui.ok"], ["B", "dev.ui.back"]]);
      }
    },
    input(ctx, ev) {
      const c = ctx.local.confirm;
      if (!c || !isDown(ev)) return;
      if (ev.btn === "A") {
        if (c.holdMs) { ctx.s.armed = true; return; }        // a press that began here; tick finishes it
        ctx.sfx("ui_ok"); ctx.closeConfirm(true);
      } else if (ev.btn === "B") { ctx.sfx("ui_back"); ctx.closeConfirm(false); }
    },
  });

  /* ============================== S09 settings ============================== */

  const PADS = ["auto", "on", "off"];
  function settingRows(ctx) {
    const st = ctx.settings, cur = ctx.profiles.current();
    const rows = [
      {id: "lang", key: "dev.set.lang", value: ctx.t(window.I18N && I18N.lang === "en" ? "dev.set.langEn" : "dev.set.langZh"), arrows: true},
      {id: "volume", key: "dev.set.volume", bars: ctx.hw.caps.snd === false ? -1 : st.volume | 0, arrows: ctx.hw.caps.snd !== false},
      {id: "clicks", key: "dev.set.clicks", value: ctx.t(st.clicks ? "dev.set.on" : "dev.set.off"), arrows: true},
      {id: "pad", key: "dev.set.pad", value: ctx.t("dev.set." + (PADS.includes(st.pad) ? st.pad : "auto")), arrows: true},
      {id: "cal", key: "dev.set.calibrate", value: "{R}"},
      {id: "channel", key: "dev.set.channel", value: String(st.channel), arrows: true},
    ];
    if (cur && cur.slot !== "guest") rows.push({id: "profile", key: "dev.set.profile", value: "{R}"});
    rows.push({id: "about", key: "dev.set.about", value: "{R}"});
    for (const r of rows) r.label = ctx.t(r.key);
    return rows;
  }
  function settingChange(ctx, row, d, cycle) {
    const st = ctx.settings;
    switch (row.id) {
    case "lang": ctx.setLanguage(window.I18N && I18N.lang === "en" ? "zh" : "en"); return true;
    case "volume":
      if (ctx.hw.caps.snd === false) return false;
      ctx.saveSettings({volume: cycle ? ((st.volume | 0) + 1) % 5 : clamp((st.volume | 0) + d, 0, 4)}); return true;
    case "clicks": ctx.saveSettings({clicks: !st.clicks}); return true;
    case "pad": ctx.saveSettings({pad: PADS[(PADS.indexOf(st.pad) + d + 3) % 3]}); return true;
    case "channel": ctx.saveSettings({channel: 11 + ((st.channel - 11 + d + 16) % 16)}); return true;
    }
    return false;
  }
  D.registerScreen("settings", {
    local: true, fps: 10,
    enter(ctx) { ctx.s.sel = 0; ctx.s.view = "list"; },
    draw(ctx, g) {
      if (ctx.s.view === "about") return drawAbout(ctx, g);
      ui.topBar(g, ctx, "dev.set.title", {signal: false});
      const rows = settingRows(ctx);
      ctx.s.sel = Math.min(ctx.s.sel, rows.length - 1);
      rows.forEach((row, i) => {
        const y = 16 + 14 * i, sel = i === ctx.s.sel;
        if (sel) { g.rect(0, y, 128, 14, "panel"); g.rect(0, y, 3, 14, "accent"); }
        g.text(8, y, row.label, {w: row.id === "profile" ? 72 : 64, key: row.key});
        if (row.bars != null) drawBars(g, 120, y, row.bars, sel && row.arrows);
        else valueWithArrows(g, 120, y, row.value, sel && row.arrows);
      });
      const cur = rows[ctx.s.sel];
      const note = cur.id === "lang" ? "dev.set.langNote" : cur.id === "channel" && ctx.settings.channel !== ctx.hw.channel ? "dev.set.chNote" : null;
      if (note) g.text(4, 130, ctx.t(note), {w: 120, c: "muted", key: note});
      const open = ["cal", "profile", "about"].includes(cur.id);
      ui.hintBar(g, ctx, [["A", open ? "dev.set.hintOpen" : "dev.ui.ok"], ["B", hasStick(ctx) ? "dev.ui.back" : "dev.ui.next"], cur.id !== "lang" && !open ? ["S", "dev.set.hintRedo"] : null]);
    },
    input(ctx, ev) {
      if (ctx.s.view === "about") {
        if (isDown(ev) && (ev.btn === "B" || ev.btn === "A") || ev.btn === "MENU" && ev.type === "click") { ctx.s.view = "list"; ctx.sfx("ui_back"); ctx.fx.wipe(); }
        return;
      }
      const rows = settingRows(ctx), n = rows.length, row = rows[ctx.s.sel];
      const leave = () => { ctx.sfx("ui_back"); ctx.back(); };
      if (isMove(ev) && (ev.btn === "UP" || ev.btn === "DOWN")) { ctx.s.sel = (ctx.s.sel + (ev.btn === "UP" ? -1 : 1) + n) % n; ctx.sfx("ui_move"); return; }
      if (isMove(ev) && (ev.btn === "LEFT" || ev.btn === "RIGHT")) {
        if (row.arrows && settingChange(ctx, row, ev.btn === "LEFT" ? -1 : 1, false)) ctx.sfx("ui_move");
        return;
      }
      if (ev.btn === "MENU" && ev.type === "click") { leave(); return; }
      if (ev.btn === "B") {
        if (!hasStick(ctx)) {             // no stick: short B = next row, hold B = back
          if (ev.type === "click") { ctx.s.sel = (ctx.s.sel + 1) % n; ctx.sfx("ui_move"); }
          if (ev.type === "long") leave();
          return;
        }
        if (isDown(ev)) leave();
        return;
      }
      if (!isDown(ev)) return;
      if (ev.btn === "A") {
        if (row.id === "cal") { ctx.sfx("ui_ok"); ctx.go("settings.cal"); }
        else if (row.id === "about") { ctx.sfx("ui_ok"); ctx.s.view = "about"; ctx.fx.wipe(); }
        else if (row.id === "profile") {
          const cur = ctx.profiles.current();
          if (cur && D.registry.screens["login.edit"]) { ctx.sfx("ui_ok"); ctx.go("login.edit", {slot: cur.slot}); }
          else ctx.sfx("ui_deny");
        } else if (settingChange(ctx, row, 1, true)) ctx.sfx("ui_ok");
      } else if (ev.btn === "SKILL") {
        const def = D.defaultSettings();
        const k = {volume: "volume", clicks: "clicks", pad: "pad", channel: "channel"}[row.id];
        if (k) { ctx.saveSettings({[k]: def[k]}); ctx.sfx("ui_ok"); }
        else if (row.id === "cal") { ctx.saveSettings({padCal: def.padCal, padCalSet: false}); ctx.sfx("ui_ok"); }
      }
    },
    bot(ctx, ctl) { if (!ctx.s.botDone) { ctx.s.botDone = true; ctl.press("B"); } },
  });
  function drawAbout(ctx, g) {
    ui.topBar(g, ctx, "dev.set.about", {signal: false});
    const lines = [
      ["dev.set.aboutFw", {v: "0." + ctx.hw.fwBuild}], ["dev.set.aboutProto", {n: ctx.hw.protocol}],
      ["dev.set.aboutPlayer", {n: ctx.p + 1}], ["dev.set.aboutCh", {n: ctx.hw.channel}],
      ["dev.set.aboutRx", {n: ctx.link.up ? ctx.link.rxPerSec : 0}],
    ];
    lines.forEach(([k, v], i) => g.text(4, 16 + 14 * i, ctx.t(k, v), {w: 120, key: k}));
    ui.hintBar(g, ctx, [["B", "dev.ui.back"]]);
  }

  /* ============================== S10 calibrate ============================== */

  const CAL = {STABLE_MS: 1000, STABLE_RANGE: 60, SQUEEZE_MS: 3000, MOVE: 100, MIN_SPAN: 200, BAND_MS: 2000, BAND_LO: 40, BAND_HI: 64};
  const noPad = ctx => ctx.hw.caps.pad === false || ctx.settings.pad === "off";
  function calReset(ctx, step) {
    const s = ctx.s;
    s.step = step; s.t = 0;
    if (step === 1) { s.win = []; s.rest = null; }
    if (step === 2) { s.started = null; s.peak = s.rest; }
    if (step === 3) { s.inBand = 0; s.done = false; s.pst = D.padLevel.create(); s.level = 0; }
  }
  D.registerScreen("settings.cal", {
    local: true, fps: 30,
    enter(ctx) {
      calReset(ctx, noPad(ctx) ? 3 : 1);
      ctx.s.small = 0;
    },
    tick(ctx, dt) {
      const s = ctx.s, raw = ctx.input.raw.fsr, now = ctx.now();
      if (s.step === 1) {
        s.win.push({t: now, v: raw});
        while (s.win.length && s.win[0].t < now - CAL.STABLE_MS) s.win.shift();
        const vs = s.win.map(w => w.v), span = Math.max(...vs) - Math.min(...vs);
        if (span > CAL.STABLE_RANGE) s.win = [{t: now, v: raw}];
        s.t = s.win.length ? now - s.win[0].t : 0;
        if (s.t >= CAL.STABLE_MS - 2) {
          s.rest = Math.round(vs.reduce((a, b) => a + b, 0) / vs.length);
          ctx.sfx("ui_ok"); calReset(ctx, 2);
        }
      } else if (s.step === 2) {
        if (Math.abs(raw - s.rest) > Math.abs(s.peak - s.rest)) s.peak = raw;
        if (s.started == null && Math.abs(raw - s.rest) > CAL.MOVE) s.started = now;
        s.t = s.started == null ? 0 : now - s.started;
        if (s.t >= CAL.SQUEEZE_MS) {
          const span = s.peak - s.rest;
          if (Math.abs(span) < CAL.MIN_SPAN) { s.small = now + 1500; ctx.sfx("ui_deny"); calReset(ctx, 2); return; }
          s.min = Math.round(s.rest + 0.05 * span); s.max = Math.round(s.rest + 0.9 * span);
          ctx.sfx("ui_ok"); calReset(ctx, 3);
        }
      } else if (s.step === 3 && !s.done) {
        if (noPad(ctx) || s.min == null) s.level = ctx.padLevel(s.pst, dt);
        else {
          const p = D.mapPressure(raw, s.min, s.max);
          s.level = clamp(Math.round((p - C.CTL_PRESS_START) * 100 / (C.CTL_PRESS_FULL - C.CTL_PRESS_START)), 0, 100);
        }
        const inside = s.level >= CAL.BAND_LO && s.level <= CAL.BAND_HI;
        s.inBand = inside ? s.inBand + dt : 0;
        s.t = s.inBand;
        if (s.inBand >= CAL.BAND_MS) { s.done = true; ctx.sfx("ui_ok"); }
      }
    },
    draw(ctx, g) {
      const s = ctx.s, raw = ctx.input.raw.fsr, np = noPad(ctx);
      ui.topBar(g, ctx, "dev.set.calTitle", {right: s.step + "/3", signal: false});
      const k = ["dev.set.cal1", "dev.set.cal2", "dev.set.cal3"][s.step - 1];
      if (np) {
        g.text(4, 16, ctx.t("dev.set.noPad1"), {w: 120, c: "gold", key: "dev.set.noPad1"});
        g.text(4, 30, ctx.t("dev.set.noPad2"), {w: 120, c: "gold", key: "dev.set.noPad2"});
      } else {
        g.text(4, 16, ctx.t(k), {w: 120, key: k});
        if (s.small > ctx.now()) g.text(4, 30, ctx.t("dev.set.calSmall"), {w: 120, c: "danger", key: "dev.set.calSmall"});
      }
      let total = CAL.STABLE_MS;
      if (s.step < 3) {
        total = s.step === 1 ? CAL.STABLE_MS : CAL.SQUEEZE_MS;
        // vertical raw bar x 24-39, y 50-129
        g.frame(24, 50, 16, 80, "line");
        const fill = Math.round(clamp(raw, 0, 4095) * 78 / 4095);
        if (fill > 0) g.rect(25, 129 - fill, 14, fill, "water");
        if (s.step === 2 && s.peak != null) g.hline(22, 129 - Math.round(clamp(s.peak, 0, 4095) * 78 / 4095), 20, "gold");
        g.text(56, 50, ctx.t("dev.set.calRaw"), {w: 36, c: "muted", key: "dev.set.calRaw"});
        g.text(56, 60, String(raw), {font: "s", scale: 2});
        if (s.step === 2) {
          g.text(56, 92, ctx.t("dev.set.calPeak"), {w: 36, c: "muted", key: "dev.set.calPeak"});
          g.text(56, 102, String(s.peak), {font: "s", scale: 2, c: "gold"});
        }
      } else {
        total = CAL.BAND_MS;
        ui.bandBar(g, 4, 60, 120, 14, {center: (CAL.BAND_LO + CAL.BAND_HI) / 2, width: CAL.BAND_HI - CAL.BAND_LO, level: s.level,
          inside: s.level >= CAL.BAND_LO && s.level <= CAL.BAND_HI});
        if (s.done) g.text(64, 90, ctx.t("dev.set.calOk"), {align: "c", w: 120, c: "gold", key: "dev.set.calOk"});
      }
      // progress y 132-137 + seconds left
      g.frame(4, 132, 96, 6, "line");
      const pr = s.done ? 1 : clamp(s.t / total, 0, 1);
      if (pr > 0) g.rect(5, 133, Math.round(94 * pr), 4, s.done ? "gold" : "accent");
      const left = s.done ? 0 : Math.ceil((total - s.t) / 1000);
      g.text(123, 128, ctx.t("dev.set.calSecs", {n: left}), {align: "r", w: 20, key: "dev.set.calSecs"});
      ui.hintBar(g, ctx, [["A", "dev.set.hintSave"], ["B", "dev.set.hintBack"], ["S", "dev.set.hintRedo"]], {disabled: [!s.done, false, false]});
    },
    input(ctx, ev) {
      if (!isDown(ev)) return;
      const s = ctx.s;
      if (ev.btn === "B") { ctx.sfx("ui_back"); ctx.back(); return; }
      if (ev.btn === "SKILL") { ctx.sfx("ui_back"); s.small = 0; calReset(ctx, s.step); return; }
      if (ev.btn === "A" && s.done) {
        if (!noPad(ctx) && s.min != null) ctx.saveSettings({padCal: {min: s.min, max: s.max}, padCalSet: true});
        ctx.sfx("ui_ok"); ctx.back();
      }
    },
    bot(ctx, ctl) { if (!ctx.s.botDone) { ctx.s.botDone = true; ctl.press("B"); } },
  });
})();
