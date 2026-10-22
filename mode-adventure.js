// Pocket Rivals handheld simulator: 双人冒险 Adventure prototype (docs/ui-design.md §4.7, §4.10, §6)
//
// Co-op: each player picks a different pet (the third rests on the shrine),
// then the team clears 4 one-screen rooms (10 x 9 tiles of 12 px) with 5
// shared hearts: 1-1 ENTRY (elemental barriers), 1-2 WINCH (one holds the
// gate with the pad, the other passes), 1-3 LEVERS (crate on a plate, two
// levers within 1 s), 1-4 WARDEN (boss; core strike = the attack trial,
// DEVICE.trial, while it is stunned).
//
// Who computes what (§6.8): the central board simulates the whole world in
// ADV_TICK_MS steps (C-like integer code, `central.create`); the boards only
// send MSG_INPUT (stick, pad, bit 7 = core strike running) and live actions
// 0x30-0x36, and draw adv.state (0x44, 61 B) with 200 ms tweens. The room
// tables are "flash" data shared by all three boards.
//
// Simulator only: Tab swaps which handheld the keys drive (core); the mode
// bot (DEVICE.bot(p, true)) is a co-op partner that solves every room.
// Every tunable is a param with its adv_config.h name.
(() => {
  "use strict";
  const D = window.DEVICE;
  const C = D.C, A = C.ACT, NONE = 0xff;

  /* ================= params (adv_config.h) ================= */

  const PARAMS = [
    ["tickMs", "ADV_TICK_MS", 50, 10, 100, 10, "ms"],
    ["stepMs", "ADV_STEP_MS", 200, 100, 500, 10, "ms"],
    ["inputStaleMs", "ADV_INPUT_STALE_MS", 130, 60, 400, 10, "ms"],
    ["resumeCountMs", "ADV_RESUME_COUNT_MS", 3000, 0, 5000, 500, "ms"],
    ["hearts", "ADV_HEARTS", 5, 1, 6, 1, ""],
    ["heartsMax", "ADV_HEARTS_MAX", 6, 1, 6, 1, ""],
    ["retryHearts", "ADV_RETRY_HEARTS", 3, 1, 6, 1, ""],
    ["invulnMs", "ADV_INVULN_MS", 1000, 0, 3000, 100, "ms"],
    ["useCdMs", "ADV_USE_CD_MS", 400, 100, 1500, 50, "ms"],
    ["powerCdMs", "ADV_POWER_CD_MS", 400, 100, 1500, 50, "ms"],
    ["slimeHp", "ADV_SLIME_HP", 2, 1, 9, 1, ""],
    ["slimeStepMs", "ADV_SLIME_STEP_MS", 600, 200, 2000, 50, "ms"],
    ["winchOpenPct", "ADV_WINCH_OPEN_PCT", 60, 10, 100, 5, "%"],
    ["winchStrainPerS", "ADV_WINCH_STRAIN_PER_S", 4, 0, 30, 1, "%/s"],
    ["winchMaxPct", "ADV_WINCH_MAX_PCT", 90, 10, 100, 5, "%"],
    ["winchNopadMs", "ADV_WINCH_NOPAD_MS", 6000, 1000, 20000, 500, "ms"],
    ["winchReholdMs", "ADV_WINCH_REHOLD_MS", 1000, 0, 5000, 100, "ms"],
    ["winchResetMs", "ADV_WINCH_RESET_MS", 1000, 0, 5000, 100, "ms"],
    ["gateCloseMs", "ADV_GATE_CLOSE_MS", 400, 0, 2000, 50, "ms"],
    ["leverWindowMs", "ADV_LEVER_WINDOW_MS", 1000, 200, 5000, 100, "ms"],
    ["pingMs", "ADV_PING_MS", 2000, 500, 5000, 100, "ms"],
    ["bossHp", "ADV_BOSS_HP", 80, 10, 250, 5, ""],
    ["bossPhase2Hp", "ADV_BOSS_PHASE2_HP", 40, 0, 250, 5, ""],
    ["bossIdleMs", "ADV_BOSS_IDLE_MS", 1500, 200, 5000, 100, "ms"],
    ["bossTeleMs", "ADV_BOSS_TELE_MS", 1200, 300, 3000, 100, "ms"],
    ["bossTele2Ms", "ADV_BOSS_TELE2_MS", 1000, 300, 3000, 100, "ms"],
    ["bossStunMs", "ADV_BOSS_STUN_MS", 3000, 1000, 8000, 100, "ms"],
    ["rockTeleMs", "ADV_ROCK_TELE_MS", 800, 200, 3000, 100, "ms"],
    ["rocks", "ADV_ROCKS", 4, 0, 4, 1, ""],
    ["coreReadyMs", "ADV_CORE_READY_MS", 400, 0, 2000, 50, "ms"],
    ["coreStageMs", "ADV_CORE_STAGE_MS", 500, 200, 2000, 50, "ms"],
    ["coreBase", "ADV_CORE_BASE", 4, 0, 50, 1, ""],
    ["coreBonus", "ADV_CORE_BONUS", 10, 0, 50, 1, ""],
    ["comboPct", "ADV_COMBO_PCT", 150, 100, 300, 10, "%"],
    ["coreGraceMs", "ADV_CORE_GRACE_MS", 2500, 0, 5000, 100, "ms"],
    ["starTimeS", "ADV_STAR_TIME_S", 180, 30, 900, 10, "s"],
    ["starHearts", "ADV_STAR_HEARTS", 3, 1, 6, 1, ""],
  ].map(([key, c, def, min, max, step, unit]) => ({key, c, labelKey: "dev.adv.p." + key, def, min, max, step, unit}));
  const PDEF = {};
  for (const p of PARAMS) PDEF[p.key] = p.def;

  /* ================= strings ================= */

  const PL = {   // param labels [zh, en]
    tickMs: ["中央步长", "Tick"], stepMs: ["走一格", "Step time"], inputStaleMs: ["输入过期", "Input stale"],
    resumeCountMs: ["继续倒数", "Resume count"], hearts: ["开局心", "Hearts"], heartsMax: ["心上限", "Max hearts"],
    retryHearts: ["重来时的心", "Retry hearts"], invulnMs: ["受伤无敌", "Invuln"], useCdMs: ["A冷却", "A cooldown"],
    powerCdMs: ["能力冷却", "S cooldown"], slimeHp: ["史莱姆血", "Slime HP"], slimeStepMs: ["史莱姆步长", "Slime step"],
    winchOpenPct: ["绞盘起始", "Winch open"], winchStrainPerS: ["绞盘加重", "Winch strain"], winchMaxPct: ["绞盘上限", "Winch max"],
    winchNopadMs: ["无垫最长", "No-pad hold"], winchReholdMs: ["无垫再按", "No-pad rehold"], winchResetMs: ["绞盘复原", "Winch reset"],
    gateCloseMs: ["闸门落下", "Gate close"], leverWindowMs: ["拉杆窗口", "Lever window"], pingMs: ["标记时长", "Ping time"],
    bossHp: ["守卫血量", "Boss HP"], bossPhase2Hp: ["二阶段血", "Phase 2 HP"], bossIdleMs: ["守卫待机", "Boss idle"],
    bossTeleMs: ["砸地预警", "Slam warn"], bossTele2Ms: ["二阶预警", "Slam warn 2"], bossStunMs: ["晕倒时长", "Stun time"],
    rockTeleMs: ["落石预警", "Rock warn"], rocks: ["落石数", "Rocks"], coreReadyMs: ["一击准备", "Strike ready"],
    coreStageMs: ["一击每层", "Strike stage"], coreBase: ["一击基础", "Strike base"], coreBonus: ["一击加成", "Strike bonus"],
    comboPct: ["合击倍率", "Combo"], coreGraceMs: ["一击宽限", "Strike grace"], starTimeS: ["时间星", "Star time"],
    starHearts: ["心星", "Star hearts"],
  };
  const pz = {}, pe = {};
  for (const [k, [z, e]] of Object.entries(PL)) { pz["dev.adv.p." + k] = z; pe["dev.adv.p." + k] = e; }

  D.registerStrings("dev.adv.", {
    zh: Object.assign({
      "dev.adv.goal1": "两人一起闯{n}关", "dev.adv.goal2": "心是共用的",
      "dev.adv.k1n": "摇杆", "dev.adv.k1": "走", "dev.adv.k2n": "A", "dev.adv.k2": "互动、攻击", "dev.adv.k3n": "S", "dev.adv.k3": "元素能力",
      "dev.adv.k4n": "捏垫", "dev.adv.k4": "绞盘、一击", "dev.adv.k5n": "M", "dev.adv.k5": "神龛换宠物",
      "dev.adv.pickTitle": "选择宠物", "dev.adv.pickNote": "队伍共用3只宠物",
      "dev.adv.passes": "能穿过：{bar}", "dev.adv.blockedBy": "过不去：{bar}",
      "dev.adv.bar.vine": "藤蔓", "dev.adv.bar.fire": "火焰", "dev.adv.bar.water": "深水",
      "dev.adv.shrineIs": "神龛：{pet}", "dev.adv.partnerPicking": "搭档选择中…", "dev.adv.taken": "已被选",
      "dev.adv.hintPick": "选", "dev.adv.hintLock": "锁定", "dev.adv.hintUnlock": "撤回",
      "dev.adv.room1": "1-1 入口", "dev.adv.room2": "1-2 绞盘", "dev.adv.room3": "1-3 双拉杆", "dev.adv.room4": "1-4 守卫",
      "dev.adv.pw.burn": "烧藤", "dev.adv.pw.douse": "灭火", "dev.adv.pw.lily": "荷叶",
      "dev.adv.hintUse": "互动", "dev.adv.hintPing": "标记", "dev.adv.hintSwap": "换宠", "dev.adv.hintHold": "拉起",
      "dev.adv.hintPass": "可过", "dev.adv.hintNo": "不通", "dev.adv.hintStrike": "一击",
      "dev.adv.tip1": "两人都站上出口", "dev.adv.tip1b": "{S} 用元素能力开路", "dev.adv.tipShrine": "在神龛旁按{M}换宠物",
      "dev.adv.tip2": "捏住压力垫拉绞盘", "dev.adv.tip3": "两个拉杆要一起拉", "dev.adv.tip4": "晕倒时核心一击",
      "dev.adv.blocked": "{pet}过不去", "dev.adv.onlyPass": "只有{pet}能过去", "dev.adv.pullNow": "快拉！",
      "dev.adv.doorOpen": "门开了", "dev.adv.swapped": "换成了{pet}",
      "dev.adv.coreStrike": "核心一击！", "dev.adv.combo": "合击！", "dev.adv.teamDown": "全员倒下", "dev.adv.exitCount": "{n}/2",
      "dev.adv.stage": "第{n}层", "dev.adv.ready": "准备",
      "dev.adv.restartRoom": "重来这一间", "dev.adv.restartAsk": "重来这一间？",
      "dev.adv.res.clear": "通关！", "dev.adv.res.gaveUp": "放弃", "dev.adv.res.time": "用时", "dev.adv.res.hearts": "剩余心",
      "dev.adv.res.coreDmg": "核心伤害", "dev.adv.res.winch": "绞盘", "dev.adv.res.gems": "宝石 {n}/{m}",
    }, pz),
    en: Object.assign({
      "dev.adv.goal1": "Team: clear {n} rooms", "dev.adv.goal2": "Hearts are shared",
      "dev.adv.k1n": "Stick", "dev.adv.k1": "walk", "dev.adv.k2n": "A", "dev.adv.k2": "use/hit", "dev.adv.k3n": "S", "dev.adv.k3": "power",
      "dev.adv.k4n": "Pad", "dev.adv.k4": "winch/hit", "dev.adv.k5n": "M", "dev.adv.k5": "switch pet",
      "dev.adv.pickTitle": "PICK PET", "dev.adv.pickNote": "Team shares 3 pets",
      "dev.adv.passes": "Passes: {bar}", "dev.adv.blockedBy": "Blocked: {bar}",
      "dev.adv.bar.vine": "vines", "dev.adv.bar.fire": "flames", "dev.adv.bar.water": "deep water",
      "dev.adv.shrineIs": "Shrine: {pet}", "dev.adv.partnerPicking": "Partner picking…", "dev.adv.taken": "Taken",
      "dev.adv.hintPick": "Pick", "dev.adv.hintLock": "Lock", "dev.adv.hintUnlock": "Undo",
      "dev.adv.room1": "1-1 ENTRY", "dev.adv.room2": "1-2 WINCH", "dev.adv.room3": "1-3 LEVERS", "dev.adv.room4": "1-4 WARDEN",
      "dev.adv.pw.burn": "BURN", "dev.adv.pw.douse": "DOUSE", "dev.adv.pw.lily": "LILY",
      "dev.adv.hintUse": "Use", "dev.adv.hintPing": "Ping", "dev.adv.hintSwap": "Swap", "dev.adv.hintHold": "Hold",
      "dev.adv.hintPass": "Pass", "dev.adv.hintNo": "No", "dev.adv.hintStrike": "Hit!",
      "dev.adv.tip1": "Both stand on exit", "dev.adv.tip1b": "{S}: clear the way", "dev.adv.tipShrine": "{M} by shrine: swap",
      "dev.adv.tip2": "Squeeze: hold gate", "dev.adv.tip3": "Pull both levers", "dev.adv.tip4": "Stunned: strike!",
      "dev.adv.blocked": "{pet} can't pass", "dev.adv.onlyPass": "Only {pet} passes", "dev.adv.pullNow": "Pull now!",
      "dev.adv.doorOpen": "Door open", "dev.adv.swapped": "Now {pet}",
      "dev.adv.coreStrike": "STRIKE!", "dev.adv.combo": "COMBO!", "dev.adv.teamDown": "TEAM DOWN", "dev.adv.exitCount": "{n}/2",
      "dev.adv.stage": "STAGE {n}", "dev.adv.ready": "READY",
      "dev.adv.restartRoom": "Retry room", "dev.adv.restartAsk": "Retry room?",
      "dev.adv.res.clear": "CLEAR!", "dev.adv.res.gaveUp": "GAVE UP", "dev.adv.res.time": "Time", "dev.adv.res.hearts": "Hearts",
      "dev.adv.res.coreDmg": "Core dmg", "dev.adv.res.winch": "Winch", "dev.adv.res.gems": "Gems {n}/{m}",
    }, pe),
  });

  /* ================= sprites, sounds, message ================= */

  D.registerSprites("adv.", {
    // §2.4: 10 x 8, muted body + void eyes, 2-frame squash
    "adv.slime": {w: 10, h: 8, mirror: true, map: {o: "line", m: "muted", e: "void"}, frames: [
      [".....", "..ooo", ".ommm", "ommmm", "omemm", "ommmm", "ommmm", ".oooo"],
      [".....", ".....", "..ooo", ".ommm", "omemm", "ommmm", "ommmm", "ooooo"]]},
    // Stone Warden 24 x 24 (2 x 2 tiles); e = eyes, c = core (gold while stunned)
    "adv.boss": {w: 24, h: 24, mirror: true, map: {o: "void", m: "muted", l: "line", e: "void", c: "line"}, frames: [[
      "......oooooo", "....oommmmmm", "...ommmmmmmm", "..ommmmmmmmm", "..ommllmmmmm", ".ommleeelmmm",
      ".ommleeelmmm", ".ommmllmmmmm", ".ommmmmmmmmm", "oommmmmmmooo", "ommmmmmmoccc", "ommmmmmmoccc",
      "ommmmmmmoccc", "ommmlmmmoooo", "ommmlmmmmmmm", "ommllmmmmmmm", ".ommmmmmmmmm", ".ommmmmmmmmm",
      "..ommmllmmmm", "..ommmmmmmmm", "..oommmoommm", "...ommmoommm", "...ommmo.omm", "...oooo..ooo"]]},
  });

  D.registerSfx("adv", {
    step: {ch: "BEEP", tones: [[400, 5]]},
    ping: {ch: "BEEP", tones: [[2000, 30], [2600, 40]]},
    adv_burn: {ch: "DF", file: 40, prio: 2, ms: 600}, adv_douse: {ch: "DF", file: 41, prio: 2, ms: 600},
    adv_lily: {ch: "DF", file: 42, prio: 2, ms: 600}, adv_push: {ch: "DF", file: 43, prio: 2, ms: 300},
    adv_plate: {ch: "DF", file: 44, prio: 2, ms: 300}, adv_gate: {ch: "DF", file: 45, prio: 2, ms: 500},
    adv_lever: {ch: "DF", file: 46, prio: 2, ms: 300}, adv_gem: {ch: "DF", file: 47, prio: 2, ms: 500},
    adv_hurt: {ch: "DF", file: 48, prio: 2, ms: 400}, adv_heart: {ch: "DF", file: 49, prio: 2, ms: 500},
    adv_switch: {ch: "DF", file: 50, prio: 2, ms: 500}, adv_room: {ch: "DF", file: 51, prio: 2, ms: 800},
    adv_boss_hit: {ch: "DF", file: 52, prio: 2, ms: 500},
    adv_clear: {ch: "DF", file: 53, prio: 3, ms: 2500}, team_down: {ch: "DF", file: 54, prio: 3, ms: 2000},
  });

  // msg_adv_state_t 0x44 (§7.6), 61 B
  D.registerMessage("adv.state", C.MSG.ADV_STATE, [
    "step:u16", "phase:u8", "flags:u8", "match:u8", "room:u8", "countdownDs:u8", "roomMs10:u16", "totalDs:u16", "hearts:u8",
    ["heroes", 2, ["pos:u8", "dirAnim:u8", "petFlags:u8"]],
    "shrinePet:u8", "objBits:u16", "cratePos:u8[2]",
    ["enemies", 4, ["pos:u8", "hpType:u8", "state:u8"]],
    "bossHp:u8", "bossState:u8", "bossTarget:u8", "bossWindow:u8", "rocks:u8[4]", "trialSeed:u8", "winchNeed:u8",
    "leverMs10:u8", "ping:u8", "gems:u8", "coreDmg:u8[2]", "winchDs:u8[2]",
    "evId:u8", "evType:u8", "evTarget:u8", "evAmount:u8"], {kind: "mode"});

  /* ================= rules: rooms and pure functions ================= */

  const PH = {PICK: 0, PLAY: 1, ROOM_CLEAR: 2, TEAM_DOWN: 3, CLEAR: 4, GAVE_UP: 5};
  const EV = {NONE: 0, TAKEN: 1, BLOCKED: 2, ONLY: 3, BURN: 4, DOUSE: 5, LILY: 6, PUSH: 7, PLATE: 8, GATE: 9, LEVER: 10,
    PULL_NOW: 11, DOOR: 12, LEVER_RESET: 13, GEM: 14, HURT: 15, HEART: 16, SWITCH: 17, ROOM: 18, HIT: 19, SLIME_DIE: 20,
    BOSS_HIT: 21, COMBO: 22, SLAM: 23, ROCK: 24, STUN: 25, TEAM_DOWN: 26, CLEAR: 27, PING: 28, DENY: 29, RESTART: 30,
    GATE_CLOSE: 31, WAKE: 32};
  const BS = {SLEEP: 0, IDLE: 1, TELE: 2, STUN: 3, ROCK_WAIT: 4, ROCK_TELE: 5, DEAD: 6};
  // petFlags: bits 0-1 pet (3 = none), bit 3 hurt blink, bit 4 core strike running, bit 5 winching, bit 6 on exit
  const PF = {HURT: 8, BUSY: 16, WINCH: 32, EXIT: 64};
  const COLS = 10, ROWS = 9, TS = 12, OX = 4, OY = 16;
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];       // 0 up, 1 right, 2 down, 3 left
  const BAR_TYPES = "VFW";                             // vine, fire, water
  const PASS = [1, 2, 0];                              // pet -> barrier it walks through (Ember fire, Tide water, Sprout vine)
  const CLEARS = [0, 1, 2];                            // pet -> barrier its S power clears (Ember vine, Tide fire, Sprout water)
  const BAR_KEYS = ["dev.adv.bar.vine", "dev.adv.bar.fire", "dev.adv.bar.water"];
  const PW_KEYS = ["dev.adv.pw.burn", "dev.adv.pw.douse", "dev.adv.pw.lily"];
  const passes = (pet, t) => PASS[pet] === t;
  const clears = (pet, t) => CLEARS[pet] === t;
  const passerOf = t => PASS.indexOf(t);

  // §6.5 (column, row); 1 2 = start tiles, C crate, s slime: floor underneath
  const ROOMS = [
    {key: "dev.adv.room1", tips: [["dev.adv.tip1"], ["dev.adv.tip1b"]], map: [
      "....##....",
      ".1..VV..$.",
      "....##....",
      ".S..##...E",
      "....FF...E",
      "....##...E",
      ".2..##....",
      "....WW....",
      "....##...."]},
    {key: "dev.adv.room2", tips: [["dev.adv.tip2"]], gateBack: 2, map: [
      "..$.s...PE",
      ".........E",
      "##GGGG####",
      "..........",
      ".R........",
      "..........",
      "....12....",
      "..........",
      ".........."]},
    {key: "dev.adv.room3", tips: [["dev.adv.tip3"]], gateBack: 3, map: [
      "....#....$",
      ".1..#..L..",
      "..C.#.....",
      "....G....E",
      "..V.#..s.E",
      ".#P##....E",
      "....#.....",
      ".2..#..L..",
      "S...#....+"]},
    {key: "dev.adv.room4", tips: [["dev.adv.tip4"]], boss: true, map: [
      "..........",
      "....BB....",
      "....BB....",
      "..........",
      "..........",
      "..........",
      "..........",
      "...1..2...",
      ".........."]},
  ];
  // Precomputed per room (the "flash" tables): objects with their obj_bits index
  const INFO = ROOMS.map((r, ri) => {
    const at = (x, y) => r.map[y][x];
    const I = {ri, key: r.key, tips: r.tips, boss: !!r.boss, gateBack: r.gateBack == null ? -1 : r.gateBack,
      objs: [], objAt: new Array(COLS * ROWS).fill(-1), spawn: [0, 0], exits: [], shrines: [], winch: -1,
      crates: [], slimes: [], plate: -1, gate: -1, levers: [], door: -1, gem: -1, heart: -1, gemPos: -1, heartPos: -1};
    const add = (o, tiles) => { o.tiles = tiles; const i = I.objs.push(o) - 1; for (const t of tiles) I.objAt[t] = i; return i; };
    const seen = new Set();
    for (let y = 0; y < ROWS; y++) for (let x = 0; x < COLS; x++) {
      const ch = at(x, y), t = y * COLS + x;
      if (ch === "1") I.spawn[0] = t;
      else if (ch === "2") I.spawn[1] = t;
      else if (ch === "E") I.exits.push(t);
      else if (ch === "S") I.shrines.push(t);
      else if (ch === "R") I.winch = t;
      else if (ch === "C") I.crates.push(t);
      else if (ch === "s") I.slimes.push(t);
      else if (ch === "P") I.plate = add({kind: "plate"}, [t]);
      else if (ch === "L") I.levers.push(add({kind: "lever"}, [t]));
      else if (ch === "$") { I.gem = add({kind: "gem"}, [t]); I.gemPos = t; }
      else if (ch === "+") { I.heart = add({kind: "heart"}, [t]); I.heartPos = t; }
      else if (ch === "G" && !seen.has(t)) {
        const tiles = [];
        for (let k = 0; k < COLS * ROWS; k++) if (r.map[(k / COLS) | 0][k % COLS] === "G") { tiles.push(k); seen.add(k); }
        I.gate = add({kind: "gate"}, tiles);
      } else if (BAR_TYPES.includes(ch) && !seen.has(t)) {
        // a barrier group = 4-connected tiles of one type (cleared together, §6.2)
        const tiles = [], stack = [t];
        seen.add(t);
        while (stack.length) {
          const k = stack.pop(); tiles.push(k);
          const kx = k % COLS, ky = (k / COLS) | 0;
          for (let d = 0; d < 4; d++) {
            const nx = kx + DX[d], ny = ky + DY[d], n = ny * COLS + nx;
            if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS && !seen.has(n) && at(nx, ny) === ch) { seen.add(n); stack.push(n); }
          }
        }
        add({kind: "bar", type: BAR_TYPES.indexOf(ch)}, tiles);
      }
    }
    if (I.levers.length === 2) I.door = add({kind: "door"}, []);
    if (I.objs.length > 16) throw new Error("adventure room " + ri + ": more than 16 objects");
    return I;
  });
  const BOSS_TILES = [14, 15, 24, 25];
  const BOSS_ADJ = [13, 23, 16, 26, 4, 5, 34, 35];     // (3,1)(3,2)(6,1)(6,2)(4,0)(5,0)(4,3)(5,3)

  const bit = (bits, i) => i >= 0 && ((bits >> i) & 1) === 1;
  const inRoom = (x, y) => x >= 0 && y >= 0 && x < COLS && y < ROWS;
  const chAt = (I, t) => ROOMS[I.ri].map[(t / COLS) | 0][t % COLS];
  const near4 = (a, b) => Math.abs(a % COLS - b % COLS) + Math.abs(((a / COLS) | 0) - ((b / COLS) | 0)) === 1;
  const stepTile = (t, d) => {
    const x = t % COLS + DX[d], y = ((t / COLS) | 0) + DY[d];
    return inRoom(x, y) ? y * COLS + x : -1;
  };
  const faceTile = (pos, dir) => (pos === NONE ? -1 : stepTile(pos, dir));
  const exitOpen = (I, bits) => I.door < 0 || bit(bits, I.door);
  // static + obj state only (crates, slimes, heroes are separate): can this pet stand on t?
  function walkable(I, bits, pet, t) {
    if (t < 0) return false;
    const ch = chAt(I, t);
    if (ch === "#" || ch === "R" || ch === "L" || ch === "S" || ch === "B") return false;
    const b = BAR_TYPES.indexOf(ch);
    if (b >= 0) return bit(bits, I.objAt[t]) || passes(pet, b);
    if (ch === "G") return bit(bits, I.gate);
    return true;
  }
  // plain floor for crates and slimes: no barrier (unless cleared), no gate, no item still lying there
  function floorish(I, bits, t) {
    if (t < 0) return false;
    const ch = chAt(I, t);
    if (".PE12Cs".includes(ch)) return true;
    if (BAR_TYPES.includes(ch)) return bit(bits, I.objAt[t]);
    if (ch === "$" || ch === "+") return bit(bits, I.objAt[t]);
    return false;
  }
  // stick -> 0..3 or -1: push past CTL_JOY_PUSH, the larger axis wins (§6.3)
  function quantize(x, y) {
    const ax = Math.abs(x), ay = Math.abs(y);
    if (Math.max(ax, ay) <= C.CTL_JOY_PUSH) return -1;
    if (ax > ay) return x > 0 ? 1 : 3;
    return y > 0 ? 0 : 2;
  }
  const padPct = pressure => Math.max(0, Math.min(100, Math.floor((pressure - C.CTL_PRESS_START) * 100 / (C.CTL_PRESS_FULL - C.CTL_PRESS_START))));
  const coreDamage = (P, score) => P.coreBase + Math.floor((P.coreBonus * score + 50) / 100);
  function stars(P, phase, totalDs, hearts) {
    if (phase !== PH.CLEAR) return [false, false, false];
    return [true, totalDs <= P.starTimeS * 10, hearts >= P.starHearts];
  }
  function trialCfg(P) {
    const bp = D.battleParams();
    return {readyMs: P.coreReadyMs, stageMs: P.coreStageMs, stages: 3, bandPct: bp.bandPct, speeds: [bp.speed1, bp.speed2, bp.speed3]};
  }

  /* ================= central board: the world (50 ms steps) ================= */

  function createCentral(api, opts) {
    const P = Object.assign({}, PDEF, opts.params || {});
    const carry = opts.retryRoom && opts.carry ? opts.carry : null;
    const s = {
      phase: PH.PICK, room: 0, t: 0, base: api.gameNow(), countdownMs: 0, roomMs: 0, totalMs: 0,
      hearts: P.hearts, gems: 0, gemMask: 0, heartMask: 0,
      picks: [NONE, NONE], shrine: NONE,
      heroes: [0, 1].map(() => ({pos: NONE, dir: 0, steps: 0, pet: 3, nextMove: 0, hurtUntil: 0, useAt: -1e9, powerAt: -1e9, blockedAt: -1e9})),
      bits: 0, crates: [NONE, NONE], slimes: [null, null, null, null],
      needMilli: P.winchOpenPct * 1000, winchIdle: 0, winching: [false, false], gateCloseAt: -1,
      leverUntil: 0,
      boss: null, rocks: [NONE, NONE, NONE, NONE], trialSeed: 0,
      ping: 0x7f, pingUntil: 0, coreDmg: [0, 0], winchMs: [0, 0],
      inp: [null, null], paused: false,
      ev: {id: 0, type: 0, target: 0, amount: 0}, evq: [],
      clearAt: 0, quitBy: NONE, lastJson: "",
    };
    const ev = (type, target = 0, amount = 0) => { if (s.evq.length < 16) s.evq.push([type, target & 0xff, amount & 0xff]); };
    const I = () => INFO[s.room];
    const busy = p => !!s.inp[p] && (s.inp[p].buttons & 0x80) !== 0 && api.now() - s.inp[p].at < 1000;

    function enterRoom(ri, fresh) {
      s.room = ri;
      const R = INFO[ri];
      s.bits = 0;
      if (R.gem >= 0 && (s.gemMask >> ri) & 1) s.bits |= 1 << R.gem;          // gems and hearts stay taken
      if (R.heart >= 0 && (s.heartMask >> ri) & 1) s.bits |= 1 << R.heart;
      s.crates = [R.crates[0] != null ? R.crates[0] : NONE, R.crates[1] != null ? R.crates[1] : NONE];
      s.slimes = [0, 1, 2, 3].map(i => R.slimes[i] != null ? {pos: R.slimes[i], hp: P.slimeHp, next: s.t + P.slimeStepMs, dir: 2, steps: 0} : null);
      s.heroes.forEach((h, p) => { h.pos = R.spawn[p]; h.dir = 0; h.nextMove = 0; h.hurtUntil = 0; });
      s.needMilli = P.winchOpenPct * 1000; s.winchIdle = 0; s.winching = [false, false]; s.gateCloseAt = -1;
      s.leverUntil = 0; s.ping = 0x7f; s.pingUntil = 0; s.rocks = [NONE, NONE, NONE, NONE];
      s.boss = R.boss ? {hp: P.bossHp, st: BS.SLEEP, until: s.t + 1500, round: 0, targets: [NONE, NONE], window: 0, stunEnd: -1e9,
        graceUntil: 0, phase2: false, tgt: 0, hit: [-1, -1], hitDmg: [0, 0]} : null;
      s.roomMs = 0;
      s.phase = PH.PLAY;
      if (!fresh) ev(EV.ROOM, 0, ri);
      api.nextStep();
    }
    function startPlay() {
      s.heroes.forEach((h, p) => { h.pet = s.picks[p]; });
      s.shrine = 3 - s.picks[0] - s.picks[1];
      enterRoom(0, true);
    }
    if (carry) {
      // retry from this room after TEAM DOWN (REMATCH arg 1, §6.7)
      s.picks = carry.pets.slice(); s.shrine = carry.shrine;
      s.heroes.forEach((h, p) => { h.pet = carry.pets[p]; });
      s.totalMs = carry.totalMs; s.gems = carry.gems; s.gemMask = carry.gemMask; s.heartMask = carry.heartMask;
      s.coreDmg = carry.coreDmg.slice(); s.winchMs = carry.winchMs.slice();
      s.hearts = P.retryHearts;
      enterRoom(carry.room, true);
      s.countdownMs = P.resumeCountMs;
    }

    const heroAt = t => s.heroes.findIndex(h => h.pos === t);
    const crateAt = t => s.crates.indexOf(t);
    const slimeAt = t => s.slimes.findIndex(e => e && e.pos === t);
    const bossAt = t => !!s.boss && s.boss.st !== BS.DEAD && BOSS_TILES.includes(t);

    function hurt(p, kdir) {
      const h = s.heroes[p];
      if (s.t < h.hurtUntil || busy(p) || s.phase !== PH.PLAY) return false;
      s.hearts = Math.max(0, s.hearts - 1);
      h.hurtUntil = s.t + P.invulnMs;
      ev(EV.HURT, p, s.hearts);
      if (kdir >= 0) {
        const n = stepTile(h.pos, kdir);
        if (n >= 0 && walkable(I(), s.bits, h.pet, n) && crateAt(n) < 0 && slimeAt(n) < 0 && !bossAt(n)) h.pos = n;
      }
      if (s.hearts === 0) { s.phase = PH.TEAM_DOWN; ev(EV.TEAM_DOWN); api.nextStep(); }
      return true;
    }
    function pickup(p) {
      const R = I(), h = s.heroes[p];
      if (h.pos === R.gemPos && !bit(s.bits, R.gem)) { s.bits |= 1 << R.gem; s.gems++; s.gemMask |= 1 << s.room; ev(EV.GEM, p, s.gems); }
      if (h.pos === R.heartPos && !bit(s.bits, R.heart)) {
        s.bits |= 1 << R.heart; s.heartMask |= 1 << s.room;
        s.hearts = Math.min(P.heartsMax, s.hearts + 1); ev(EV.HEART, p, s.hearts);
      }
    }
    function tryMove(p, d) {
      const R = I(), h = s.heroes[p], n = stepTile(h.pos, d);
      if (n < 0 || bossAt(n)) return;
      if (slimeAt(n) >= 0) return;                     // walking into a slime only turns you (it hurts when it moves into you)
      const ch = chAt(R, n), b = BAR_TYPES.indexOf(ch);
      if (!walkable(R, s.bits, h.pet, n)) {
        if (b >= 0 && s.t - h.blockedAt > 1500) { h.blockedAt = s.t; ev(EV.BLOCKED, p, h.pet); }
        return;
      }
      const c = crateAt(n);
      if (c >= 0) {
        const n2 = stepTile(n, d);
        if (!floorish(R, s.bits, n2) || crateAt(n2) >= 0 || slimeAt(n2) >= 0 || heroAt(n2) >= 0 || bossAt(n2)) return;
        s.crates[c] = n2;
        ev(EV.PUSH, p);
      }
      h.pos = n; h.steps = (h.steps + 1) & 63;
      pickup(p);
    }
    function clearGroup(oi) { s.bits |= 1 << oi; }

    function moveHeroes(now) {
      for (let p = 0; p < 2; p++) {
        const h = s.heroes[p], inp = s.inp[p];
        let d = -1;
        if (inp && now - inp.at <= P.inputStaleMs && !busy(p)) d = quantize(inp.joyX, inp.joyY);
        if (d < 0) continue;
        h.dir = d;
        if (s.t >= h.nextMove) { h.nextMove = s.t + P.stepMs; tryMove(p, d); }
        if (s.phase !== PH.PLAY) return;
      }
    }
    function mechanisms(now) {
      const R = I();
      // pressure plate: a pet or a crate on it
      if (R.plate >= 0) {
        const t = R.objs[R.plate].tiles[0];
        const down = heroAt(t) >= 0 || s.heroes[1].pos === t || crateAt(t) >= 0;
        if (down && !bit(s.bits, R.plate)) { s.bits |= 1 << R.plate; ev(EV.PLATE); }
        if (!down) s.bits &= ~(1 << R.plate);
      }
      // winch: next to it, facing it, squeezing at least the current need (§6.3)
      let any = false;
      for (let p = 0; p < 2; p++) {
        const h = s.heroes[p], inp = s.inp[p];
        const on = R.winch >= 0 && !busy(p) && !!inp && now - inp.at <= 300 && faceTile(h.pos, h.dir) === R.winch && near4(h.pos, R.winch)
          && padPct(inp.pressure) * 1000 >= s.needMilli;
        s.winching[p] = on;
        if (on) { any = true; s.winchMs[p] = Math.min(25500, s.winchMs[p] + P.tickMs); }
      }
      if (R.winch >= 0) {
        if (any) { s.winchIdle = 0; s.needMilli = Math.min(P.winchMaxPct * 1000, s.needMilli + P.winchStrainPerS * P.tickMs); }
        else { s.winchIdle += P.tickMs; if (s.winchIdle >= P.winchResetMs) s.needMilli = P.winchOpenPct * 1000; }
      }
      // gate: open while the winch is held or the plate is down; falls GATE_CLOSE_MS later
      if (R.gate >= 0) {
        const want = any || bit(s.bits, R.plate);
        if (want) {
          if (!bit(s.bits, R.gate)) { s.bits |= 1 << R.gate; ev(EV.GATE, 0, 1); }
          s.gateCloseAt = -1;
        } else if (bit(s.bits, R.gate)) {
          if (s.gateCloseAt < 0) s.gateCloseAt = s.t + P.gateCloseMs;
          if (s.t >= s.gateCloseAt) {
            s.bits &= ~(1 << R.gate); s.gateCloseAt = -1;
            ev(EV.GATE_CLOSE);
            const tiles = R.objs[R.gate].tiles;
            for (let p = 0; p < 2; p++) {
              const h = s.heroes[p];
              if (tiles.includes(h.pos)) {        // pushed back to the winch / plate side, 1 heart
                const back = stepTile(h.pos, R.gateBack);
                if (back >= 0) h.pos = back;
                hurt(p, -1);
                if (s.phase !== PH.PLAY) return;
              }
            }
          }
        }
      }
      // twin levers: the partner has LEVER_WINDOW_MS, else both spring back
      if (s.leverUntil && s.t >= s.leverUntil && !bit(s.bits, R.door)) {
        for (const li of R.levers) s.bits &= ~(1 << li);
        s.leverUntil = 0;
        ev(EV.LEVER_RESET);
      }
    }
    function slimes() {
      const R = I();
      for (const e of s.slimes) {
        if (!e || s.t < e.next) continue;
        e.next = s.t + P.slimeStepMs;
        let best = -1, bd = 1e9;
        for (let p = 0; p < 2; p++) {
          const h = s.heroes[p];
          const dd = Math.abs(h.pos % COLS - e.pos % COLS) + Math.abs(((h.pos / COLS) | 0) - ((e.pos / COLS) | 0));
          if (dd < bd) { bd = dd; best = p; }
        }
        if (best < 0) continue;
        const h = s.heroes[best];
        const dx = h.pos % COLS - e.pos % COLS, dy = ((h.pos / COLS) | 0) - ((e.pos / COLS) | 0);
        const hx = dx > 0 ? 1 : 3, vy = dy > 0 ? 2 : 0;
        const order = Math.abs(dx) >= Math.abs(dy) ? [dx ? hx : -1, dy ? vy : -1] : [dy ? vy : -1, dx ? hx : -1];
        for (const d of order) {
          if (d < 0) continue;
          const n = stepTile(e.pos, d);
          const hp = heroAt(n) >= 0 ? heroAt(n) : s.heroes[1].pos === n ? 1 : -1;
          if (hp >= 0) {
            e.dir = d;
            hurt(hp, d);
            break;
          }
          if (floorish(R, s.bits, n) && chAt(R, n) !== "E" && crateAt(n) < 0 && slimeAt(n) < 0 && !bossAt(n)) {
            e.pos = n; e.dir = d; e.steps = (e.steps + 1) & 63; break;
          }
        }
        if (s.phase !== PH.PLAY) return;
      }
    }
    function bossTick() {
      const b = s.boss;
      if (!b) return;
      const tele = b.phase2 ? P.bossTele2Ms : P.bossTeleMs;
      if (b.st === BS.SLEEP && s.t >= b.until) { b.st = BS.IDLE; b.until = s.t + P.bossIdleMs; ev(EV.WAKE); }
      else if (b.st === BS.IDLE && s.t >= b.until) {
        b.st = BS.TELE; b.until = s.t + tele;
        if (b.phase2) b.targets = [s.heroes[0].pos, s.heroes[1].pos];
        else { b.targets = [s.heroes[b.tgt].pos, NONE]; b.tgt ^= 1; }
      } else if (b.st === BS.TELE && s.t >= b.until) {
        const inArea = t => b.targets.some(c => c !== NONE && Math.abs(c % COLS - t % COLS) <= 1 && Math.abs(((c / COLS) | 0) - ((t / COLS) | 0)) <= 1);
        ev(EV.SLAM);
        for (let p = 0; p < 2; p++) if (inArea(s.heroes[p].pos)) { hurt(p, -1); if (s.phase !== PH.PLAY) return; }
        b.targets = [NONE, NONE];
        b.st = BS.STUN; b.until = s.t + P.bossStunMs; b.stunEnd = b.until;
        b.window = (b.window + 1) & 0xff; s.trialSeed = api.randInt(256);
        ev(EV.STUN, 0, b.window);
      } else if (b.st === BS.STUN && s.t >= b.until) {
        const rocks = b.phase2 || (b.round & 1) === 1;
        b.round++;
        if (rocks && P.rocks > 0) { b.st = BS.ROCK_WAIT; b.graceUntil = s.t + P.coreGraceMs; }
        else { b.st = BS.IDLE; b.until = s.t + P.bossIdleMs; }
      } else if (b.st === BS.ROCK_WAIT && ((!busy(0) && !busy(1)) || s.t >= b.graceUntil)) {
        // ADV_ROCKS tiles near the pets, never on a pet that is striking the core
        const R = I(), cand = [];
        for (let t = 0; t < COLS * ROWS; t++) {
          if (!floorish(R, s.bits, t) || bossAt(t)) continue;
          if ([0, 1].some(p => busy(p) && s.heroes[p].pos === t)) continue;
          const nearPet = [0, 1].some(p => !busy(p) && Math.abs(s.heroes[p].pos % COLS - t % COLS) <= 2 && Math.abs(((s.heroes[p].pos / COLS) | 0) - ((t / COLS) | 0)) <= 2);
          if (nearPet) cand.push(t);
        }
        s.rocks = [NONE, NONE, NONE, NONE];
        for (let k = 0; k < Math.min(P.rocks, 4) && cand.length; k++) s.rocks[k] = cand.splice(api.randInt(cand.length), 1)[0];
        b.st = BS.ROCK_TELE; b.until = s.t + P.rockTeleMs;
      } else if (b.st === BS.ROCK_TELE && s.t >= b.until) {
        ev(EV.ROCK);
        for (let p = 0; p < 2; p++) if (s.rocks.includes(s.heroes[p].pos)) { hurt(p, -1); if (s.phase !== PH.PLAY) return; }
        s.rocks = [NONE, NONE, NONE, NONE];
        b.st = BS.IDLE; b.until = s.t + P.bossIdleMs;
      } else if (b.st === BS.DEAD && s.t >= b.until) {
        s.phase = PH.CLEAR; ev(EV.CLEAR); api.nextStep();
        if (api.rank) api.rank.submit(0x20 | ((s.world || 1) - 1), [{who: [0, 1], value: (s.totalMs / 100) | 0, pets: s.heroes.map(h => h.pet)}]);   // today's leaderboard, keyed by world (§9.2)
      }
    }
    function exits() {
      const R = I();
      if (!R.exits.length || !exitOpen(R, s.bits)) return;
      if (s.heroes.every(h => R.exits.includes(h.pos))) {
        s.phase = PH.ROOM_CLEAR; s.clearAt = s.t + 700;
        api.nextStep();
      }
    }

    function step(now) {
      if (s.phase === PH.ROOM_CLEAR) {
        s.totalMs += P.tickMs;
        if (s.t >= s.clearAt) enterRoom(s.room + 1, false);
        return;
      }
      if (s.phase !== PH.PLAY) return;
      if (s.countdownMs > 0) { s.countdownMs = Math.max(0, s.countdownMs - P.tickMs); return; }
      s.roomMs += P.tickMs; s.totalMs += P.tickMs;
      moveHeroes(now);
      if (s.phase === PH.PLAY) mechanisms(now);
      if (s.phase === PH.PLAY) slimes();
      if (s.phase === PH.PLAY) bossTick();
      if (s.phase === PH.PLAY) exits();
      if (s.pingUntil && s.t >= s.pingUntil) { s.ping = 0x7f; s.pingUntil = 0; }
    }

    function snapshot() {
      const R = I(), b = s.boss;
      const heroes = s.heroes.map((h, p) => {
        let f = (s.phase === PH.PICK ? (s.picks[p] === NONE ? 3 : s.picks[p]) : h.pet) & 3;
        if (s.t < h.hurtUntil) f |= PF.HURT;
        if (busy(p)) f |= PF.BUSY;
        if (s.winching[p]) f |= PF.WINCH;
        if (R.exits.includes(h.pos)) f |= PF.EXIT;
        return {pos: s.phase === PH.PICK ? NONE : h.pos, dirAnim: (h.dir & 3) | ((h.steps & 63) << 2), petFlags: f};
      });
      const enemies = s.slimes.map(e => e ? {pos: e.pos, hpType: 0x10 | Math.min(15, e.hp), state: (e.dir & 3) | ((e.steps & 63) << 2)} : {pos: NONE, hpType: 0, state: 0});
      let bossState = 0;
      if (b) {
        if (b.st === BS.TELE && b.targets[1] !== NONE) enemies[0] = {pos: b.targets[1], hpType: 0x20, state: 0};
        const left = Math.max(0, b.until - s.t);
        bossState = b.st | (Math.min(7, Math.ceil(left / 500)) << 4) | (b.phase2 ? 0x80 : 0);
      }
      return {
        phase: s.phase, flags: 0, room: s.room, countdownDs: Math.min(255, Math.ceil(s.countdownMs / 100)),
        roomMs10: ((s.roomMs / 10) | 0) & 0xffff, totalDs: Math.min(65535, (s.totalMs / 100) | 0), hearts: s.hearts,
        heroes, shrinePet: s.shrine === NONE ? NONE : s.shrine, objBits: s.bits & 0xffff, cratePos: s.crates.slice(),
        enemies, bossHp: b ? b.hp : 0, bossState, bossTarget: b && b.st === BS.TELE ? b.targets[0] : NONE,
        bossWindow: b ? b.window : 0, rocks: s.rocks.slice(), trialSeed: s.trialSeed,
        winchNeed: R.winch >= 0 ? Math.floor(s.needMilli / 1000) : 0,
        leverMs10: s.leverUntil ? Math.min(255, Math.ceil((s.leverUntil - s.t) / 10)) : 0,
        ping: s.ping, gems: s.gems, coreDmg: s.coreDmg.map(v => Math.min(255, v)),
        winchDs: s.winchMs.map(v => Math.min(255, (v / 100) | 0)),
        evId: s.ev.id, evType: s.ev.type, evTarget: s.ev.target, evAmount: s.ev.amount,
      };
    }

    function act(p, action, arg, data) {
      if (action === A.ADV_PICK) {
        if (s.phase !== PH.PICK) return false;
        if (arg === NONE) { s.picks[p] = NONE; return true; }
        if (arg > 2) return false;
        if (s.picks[1 - p] === arg) { ev(EV.TAKEN, p, arg); return false; }   // first come, first served
        s.picks[p] = arg;
        if (s.picks[0] !== NONE && s.picks[1] !== NONE) startPlay();
        return true;
      }
      if (action === A.ADV_RESTART_ROOM) {
        if (s.phase !== PH.PLAY) return false;
        enterRoom(s.room, true);
        s.countdownMs = P.resumeCountMs;
        ev(EV.RESTART);
        return true;
      }
      if (action === A.ADV_CORE) return core(p, arg, data[0]);
      if (s.phase !== PH.PLAY || s.paused || s.countdownMs > 0) return false;
      const R = I(), h = s.heroes[p], f = faceTile(h.pos, h.dir);
      if (action === A.ADV_USE) {
        if (s.t - h.useAt < P.useCdMs || busy(p)) return false;
        h.useAt = s.t;
        const li = f >= 0 ? R.objAt[f] : -1;
        if (li >= 0 && R.objs[li].kind === "lever") {
          if (bit(s.bits, li) || bit(s.bits, R.door)) return true;
          s.bits |= 1 << li;
          const other = R.levers.find(x => x !== li);
          if (bit(s.bits, other)) { s.bits |= 1 << R.door; s.leverUntil = 0; ev(EV.DOOR, p); }
          else { s.leverUntil = s.t + P.leverWindowMs; ev(EV.PULL_NOW, p, R.levers.indexOf(li)); }
          return true;
        }
        const e = slimeAt(f);
        if (e >= 0) { hitSlime(e, 1, p); return true; }
        if (bossAt(f)) ev(EV.DENY, p);
        return true;
      }
      if (action === A.ADV_POWER) {
        if (s.t - h.powerAt < P.powerCdMs || busy(p)) return false;
        h.powerAt = s.t;
        const e = slimeAt(f);
        if (e >= 0) { hitSlime(e, 2, p); return true; }
        const oi = f >= 0 ? R.objAt[f] : -1;
        if (oi >= 0 && R.objs[oi].kind === "bar" && !bit(s.bits, oi)) {
          const type = R.objs[oi].type;
          if (clears(h.pet, type)) { clearGroup(oi); ev([EV.BURN, EV.DOUSE, EV.LILY][type], p); }
          else ev(EV.ONLY, p, passerOf(type));
          return true;
        }
        ev(EV.DENY, p);
        return true;
      }
      if (action === A.ADV_PING) {
        if (f < 0) return false;
        s.ping = (p << 7) | f; s.pingUntil = s.t + P.pingMs;
        ev(EV.PING, p, f);
        return true;
      }
      if (action === A.ADV_SWAP) {
        if (!R.shrines.some(t => near4(t, h.pos)) || s.shrine === NONE || busy(p)) return false;
        const was = h.pet;
        h.pet = s.shrine; s.shrine = was;
        // standing on a barrier the new pet cannot cross is fine: it can still walk off
        ev(EV.SWITCH, p, h.pet);
        return true;
      }
      return false;
    }
    function hitSlime(e, dmg, p) {
      const sl = s.slimes[e];
      sl.hp -= dmg;
      if (sl.hp <= 0) { s.slimes[e] = null; ev(EV.SLIME_DIE, p); }
      else ev(EV.HIT, p, sl.hp);
    }
    // ACT_ADV_CORE(arg = score, data[0] = stun window): accepted while stunned or
    // up to ADV_CORE_GRACE_MS after the stun, once per player per window; also while paused
    function core(p, score, w) {
      const b = s.boss;
      if (!b || b.st === BS.DEAD || s.phase !== PH.PLAY || score > 100) return false;
      if (w !== b.window || b.hit[p] === w) return false;
      if (!(b.st === BS.STUN || s.t <= b.stunEnd + P.coreGraceMs)) return false;
      let dmg = coreDamage(P, score), extra = 0;
      const q = 1 - p;
      if (b.hit[q] === w) {
        // combo: both hit in the same stun window -> each x ADV_COMBO_PCT (the partner's hit is topped up now)
        dmg = Math.floor((dmg * P.comboPct + 50) / 100);
        extra = Math.floor((b.hitDmg[q] * (P.comboPct - 100) + 50) / 100);
        ev(EV.COMBO, p);
      }
      b.hit[p] = w; b.hitDmg[p] = dmg;
      s.coreDmg[p] += dmg; s.coreDmg[q] += extra;
      b.hp = Math.max(0, b.hp - dmg - extra);
      ev(EV.BOSS_HIT, p, dmg + extra);
      if (!b.phase2 && b.hp <= P.bossPhase2Hp) b.phase2 = true;
      if (b.hp === 0) { b.st = BS.DEAD; b.until = s.t + 1200; b.targets = [NONE, NONE]; s.rocks = [NONE, NONE, NONE, NONE]; }
      return true;
    }

    return {
      tick(now) {
        const g = api.gameNow();
        let n = 0;
        while (g - s.base >= P.tickMs && n < 50) { s.base += P.tickMs; s.t += P.tickMs; step(now); n++; }
        if (n === 50) s.base = g;
        if (n) {
          const snap = snapshot();
          const js = JSON.stringify([snap.phase, snap.room, snap.hearts, snap.heroes, snap.shrinePet, snap.objBits, snap.cratePos,
            snap.enemies, snap.bossHp, snap.bossState, snap.bossTarget, snap.rocks, snap.ping, snap.gems, snap.countdownDs > 0]);
          if (js !== s.lastJson) { s.lastJson = js; api.broadcast(); }
        }
        if (s.evq.length) {
          const [type, target, amount] = s.evq.shift();
          s.ev = {id: (s.ev.id + 1) & 0xff || 1, type, target, amount};
          api.broadcast();
        }
      },
      action(p, action, arg, data) { const r = act(p, action, arg, data || [0, 0, 0]); api.broadcast(); return r; },
      input(p, f) { s.inp[p] = {joyX: f.joyX, joyY: f.joyY, buttons: f.buttons, pressure: f.pressure, at: api.now()}; },
      message() {},
      snapshot,
      over() {
        if (s.phase === PH.CLEAR || s.phase === PH.TEAM_DOWN || s.phase === PH.GAVE_UP) {
          const st = stars(P, s.phase, (s.totalMs / 100) | 0, s.hearts).filter(Boolean).length;
          return {winner: null, coop: true, quit: s.phase === PH.GAVE_UP ? s.quitBy : null,
            res: [st, s.gems, s.hearts, Math.min(255, (s.totalMs / 10000) | 0)]};
        }
        return null;
      },
      // a core strike in progress (heartbeat bit 7) defers a pause until it ends (§4.11)
      canPause: () => (busy(0) || busy(1) ? "defer" : "now"),
      pause() { s.paused = true; },
      resume() {
        s.paused = false;
        s.base = api.gameNow();
        if (s.phase === PH.PLAY) s.countdownMs = P.resumeCountMs;
      },
      quit(p) { s.quitBy = p; s.phase = PH.GAVE_UP; api.nextStep(); api.broadcast(); },
      carry: () => ({room: s.room, totalMs: s.totalMs, gems: s.gems, gemMask: s.gemMask, heartMask: s.heartMask,
        pets: s.heroes.map(h => h.pet), shrine: s.shrine, coreDmg: s.coreDmg.slice(), winchMs: s.winchMs.slice()}),
      // DEVICE.debug(cmd, arg): fixtures and tests
      debug(cmd, arg) {
        if (cmd === "room" && s.phase !== PH.PICK) { s.phase = PH.PLAY; enterRoom(arg | 0, false); }
        else if (cmd === "pick") { s.picks = [arg >> 4 & 3, arg & 3]; startPlay(); }
        else if (cmd === "hearts") s.hearts = arg | 0;
        else if (cmd === "bossHp" && s.boss) s.boss.hp = arg | 0;
        else if (cmd === "stun" && s.boss) { s.boss.st = BS.TELE; s.boss.until = s.t; s.boss.targets = [NONE, NONE]; }
        else if (cmd === "clear") { s.phase = PH.CLEAR; api.nextStep(); }
        else if (cmd === "down") { s.hearts = 0; s.phase = PH.TEAM_DOWN; api.nextStep(); }
        else if (cmd === "place") { s.heroes[arg >> 8 & 1].pos = arg & 0xff; }
        else if (cmd === "state") return JSON.parse(JSON.stringify(s));
        api.broadcast();
        return true;
      },
    };
  }

  /* ================= player board: helpers ================= */

  const params = ctx => (ctx.params ? ctx.params("adventure") : D.params("adventure"));
  const petOf = h => h.petFlags & 3;
  const tileX = t => OX + (t % COLS) * TS, tileY = t => OY + ((t / COLS) | 0) * TS;
  // the two players' colors on this screen (P2 takes the next free one when they match, §2.2)
  function teamColors(ctx) {
    const L = ctx.lobby, PC = D.PLAYER_COLORS;
    const c = [0, 1].map(p => (L && L.profile && L.profile[p] ? L.profile[p].color : p === 0 ? 0 : 4) % 6);
    if (c[0] === c[1]) { for (let k = 1; k < 6; k++) { const n = (c[0] + k) % 6; if (n !== c[0]) { c[1] = n; break; } } }
    return c.map(i => PC[i] || "white");
  }
  function partnerName(ctx) {
    const L = ctx.lobby, pr = L && L.profile ? L.profile[1 - ctx.p] : null;
    const n = pr ? D.bytesToStr(pr.name) : "";
    return n || (ctx.p === 0 ? "P2" : "P1");
  }
  const petName = (ctx, pet) => (D.PETS[pet] ? ctx.t(D.PETS[pet].nameKey) : "?");
  function bossInfo(st) {
    return {st: st.bossState & 15, left: (st.bossState >> 4) & 7, phase2: (st.bossState & 0x80) !== 0};
  }
  function canStrike(ctx) {
    const m = ctx.m, st = ctx.state;
    if (!m || !st || st.phase !== PH.PLAY || st.countdownDs > 0 || m.trial || !INFO[st.room].boss) return false;
    const b = bossInfo(st);
    return b.st === BS.STUN && BOSS_ADJ.includes(st.heroes[ctx.p].pos) && m.struckWindow !== st.bossWindow;
  }
  function startStrike(ctx) {
    const m = ctx.m, st = ctx.state, P = params(ctx);
    m.trial = D.trial.create(st.trialSeed, trialCfg(P), ctx.now());
    m.trialWindow = st.bossWindow; m.struckWindow = st.bossWindow;
    m.trialPad = D.padLevel.create(); m.trialStage = -1; m.tickAt = 0;
    m.bannerKey = "dev.adv.coreStrike"; m.bannerUntil = ctx.now() + Math.max(600, P.coreReadyMs);
    ctx.sfx("sweep_start");
    ctx.sendInputNow();
  }
  // where a hero / slime is drawn now (200 ms tween towards the newest tile)
  function tweenPos(m, key, pos, now, dur) {
    const tw = m.tw[key];
    const px = tileX(pos), py = tileY(pos);
    if (!tw || tw.pos !== pos) {
      let fx = px, fy = py;
      if (tw && tw.pos !== NONE && pos !== NONE && near4(tw.pos, pos)) { const c = tweenNow(tw, now); fx = c[0]; fy = c[1]; }
      m.tw[key] = {pos, fx, fy, tx: px, ty: py, t0: now, dur};
    }
    return tweenNow(m.tw[key], now);
  }
  function tweenNow(tw, now) {
    const k = tw.dur > 0 ? Math.max(0, Math.min(1, (now - tw.t0) / tw.dur)) : 1;
    return [Math.round(tw.fx + (tw.tx - tw.fx) * k), Math.round(tw.fy + (tw.ty - tw.fy) * k)];
  }

  /* ================= drawing ================= */

  const blink = (ctx, hz) => Math.floor(ctx.now() * hz * 2 / 1000) % 2 === 0;

  function drawTile(g, I, st, t, ctx, frame) {
    const x = tileX(t), y = tileY(t), ch = chAt(I, t), bits = st.objBits;
    const floor = () => { g.rect(x, y, TS, TS, "panel"); g.px(x + 3, y + 3, "line"); g.px(x + 8, y + 8, "line"); };
    const b = BAR_TYPES.indexOf(ch);
    if (ch === "#") { g.rect(x, y, TS, TS, "line"); g.hline(x, y, TS, "muted"); g.px(x + 3, y + 6, "panel"); g.px(x + 8, y + 9, "panel"); return; }
    if (ch === "B") { floor(); return; }
    if (b === 0) {                                   // vines
      if (bit(bits, I.objAt[t])) { floor(); g.px(x + 5, y + 6, "grassDk"); return; }
      g.rect(x, y, TS, TS, "grassDk");
      for (const [vx, vy] of [[1, 2], [6, 1], [3, 6], [8, 5], [1, 9], [6, 9]]) { g.rect(x + vx, y + vy, 3, 2, "grass"); g.px(x + vx + 1, y + vy + 2, "grass"); }
      return;
    }
    if (b === 1) {                                   // flames
      if (bit(bits, I.objAt[t])) { floor(); g.px(x + 4, y + 7, "fireDk"); g.px(x + 7, y + 6, "fireDk"); return; }
      g.rect(x, y, TS, TS, "fireDk");
      const o = frame ? 1 : 0;
      for (const fx of [1, 7]) { g.rect(x + fx, y + 4 - o, 4, 7 + o, "fire"); g.rect(x + fx + 1, y + 7 - o, 2, 3, "gold"); }
      g.rect(x + 4, y + 1 + o, 4, 9 - o, "fire"); g.rect(x + 5, y + 5 + o, 2, 4, "gold");
      return;
    }
    if (b === 2) {                                   // deep water (lily once cleared)
      g.rect(x, y, TS, TS, "waterDk");
      const o = frame ? 3 : 0;
      g.hline(x + ((1 + o) % 6), y + 3, 4, "water"); g.hline(x + ((6 + o) % 8), y + 8, 4, "water");
      if (bit(bits, I.objAt[t])) { g.rect(x + 3, y + 2, 6, 8, "grassLt"); g.rect(x + 2, y + 3, 8, 6, "grassLt"); g.rect(x + 6, y + 5, 3, 2, "grass"); }
      return;
    }
    floor();
    if (ch === "G") {
      if (bit(bits, I.gate)) { for (const gx of [2, 6, 10]) g.rect(x + gx - 1, y, 2, 2, "muted"); }
      else { g.hline(x, y + 1, TS, "muted"); g.hline(x, y + 10, TS, "muted"); for (const gx of [2, 6, 10]) g.rect(x + gx - 1, y, 2, TS, "muted"); }
    } else if (ch === "P") {
      const down = bit(bits, I.plate);
      g.frame(x + 2, y + 2, 8, 8, "line"); g.rect(x + 3, y + 3, 6, 6, down ? "void" : "line");
    } else if (ch === "R") {
      // wheel: ring + spokes, gold crank handle
      g.hline(x + 4, y + 1, 4, "muted"); g.hline(x + 4, y + 10, 4, "muted");
      g.vline(x + 1, y + 4, 4, "muted"); g.vline(x + 10, y + 4, 4, "muted");
      g.px(x + 2, y + 3, "muted"); g.px(x + 3, y + 2, "muted"); g.px(x + 8, y + 2, "muted"); g.px(x + 9, y + 3, "muted");
      g.px(x + 2, y + 8, "muted"); g.px(x + 3, y + 9, "muted"); g.px(x + 8, y + 9, "muted"); g.px(x + 9, y + 8, "muted");
      g.px(x + 4, y + 4, "line"); g.px(x + 7, y + 4, "line"); g.px(x + 4, y + 7, "line"); g.px(x + 7, y + 7, "line");
      g.rect(x + 5, y + 5, 2, 2, "muted");
      g.hline(x + 7, y + 6, 3, "gold"); g.rect(x + 9, y + 5, 2, 3, "gold");
    } else if (ch === "L") {
      const down = bit(bits, I.objAt[t]);
      g.rect(x + 3, y + 9, 6, 2, "muted");
      if (down) { for (let k = 0; k < 5; k++) g.px(x + 6 + k, y + 8 - k, "muted"); g.rect(x + 9, y + 2, 3, 3, "gold"); }
      else { for (let k = 0; k < 5; k++) g.px(x + 5 - k, y + 8 - k, "muted"); g.rect(x, y + 2, 3, 3, "gold"); }
    } else if (ch === "$") {
      if (!bit(bits, I.gem)) { g.rect(x + 5, y + 2, 2, 8, "waterLt"); g.rect(x + 4, y + 3, 4, 6, "waterLt"); g.rect(x + 3, y + 5, 6, 2, "waterLt"); g.px(x + 5, y + 4, "white"); }
    } else if (ch === "+") {
      if (!bit(bits, I.heart)) g.sprite("icon.heart", x + 2, y + 3);
    } else if (ch === "S") {
      g.rect(x + 1, y + 4, 10, 8, "muted"); g.rect(x + 2, y + 2, 8, 2, "muted"); g.hline(x + 1, y + 11, 10, "line");
      const pet = D.PETS[st.shrinePet];
      if (pet) { g.rect(x + 4, y + 5, 4, 4, pet.color); g.px(x + 4, y + 5, pet.lt); }
    } else if (ch === "E") {
      const c = exitOpen(I, bits) ? "gold" : "danger";
      g.rect(x + 2, y + 5, 5, 2, c);
      for (let k = 0; k < 4; k++) g.vline(x + 6 + k, y + 2 + k, 8 - 2 * k, c);
    }
  }

  function drawPet(g, ctx, x, y, pet, dir, color, me, hurtBlink) {
    if (hurtBlink && !blink(ctx, 5)) return;
    const P2 = D.PETS[pet];
    if (P2) g.sprite(P2.sprite, x + 1, y, {flipX: dir === 3});
    g.hline(x + 1, y + 11, 10, color);
    if (dir === 0) g.rect(x + 5, y - 1, 2, 1, color);
    else if (dir === 1) g.rect(x + 11, y + 4, 1, 2, color);
    else if (dir === 2) g.rect(x + 5, y + 10, 2, 1, color);
    else g.rect(x, y + 4, 1, 2, color);
    if (me) { g.rect(x + 4, y - 4, 3, 1, "white"); g.px(x + 5, y - 3, "white"); }
  }

  function drawBoss(g, ctx, st) {
    const b = bossInfo(st), x = tileX(14), y = tileY(14);
    if (b.st === BS.DEAD) {
      if (blink(ctx, 6)) g.sprite("adv.boss", x, y, {color: "line"});
      return;
    }
    const map = {};
    if (b.st === BS.STUN) map.c = blink(ctx, 3) ? "gold" : "fire";
    if (b.st === BS.TELE) map.e = "danger";
    if (b.st === BS.SLEEP) map.e = "line";
    g.sprite("adv.boss", x, y, {map});
    if (b.phase2) { g.px(x + 6, y + 4, "void"); g.px(x + 7, y + 5, "void"); g.px(x + 7, y + 6, "void"); g.px(x + 17, y + 15, "void"); g.px(x + 16, y + 16, "void"); }
    if (b.st === BS.STUN) {
      g.text(x + 12, y - 12, "z", {font: "s", c: "gold", align: "c"});
    }
    // HP bar in row 0 above the boss, stun time under it
    const P = params(ctx);
    D.ui.hpBar(g, x - 6, OY + 2, 36, st.bossHp, P.bossHp, {h: 4});
    if (b.st === BS.STUN) g.hline(x - 5, OY + 7, Math.round(34 * Math.min(1, b.left * 500 / P.bossStunMs)), "gold");
  }

  function drawRoom(g, ctx) {
    const st = ctx.state, m = ctx.m, I = INFO[st.room], now = ctx.now();
    const frame = blink(ctx, 2) ? 0 : 1;
    const cols = teamColors(ctx);
    // frame + tiles
    g.rect(2, 14, 124, 112, "line");
    g.rect(2, 14, 124, 1, "muted");
    for (let t = 0; t < COLS * ROWS; t++) drawTile(g, I, st, t, ctx, frame);
    const P = params(ctx);
    // own no-pad winch hold bar / pressure meter on the winch tile
    if (I.winch >= 0) {
      const wx = tileX(I.winch), wy = tileY(I.winch);
      const me = st.heroes[ctx.p];
      if (faceTile(me.pos, me.dirAnim & 3) === I.winch && near4(me.pos, I.winch)) {
        if (!ctx.padOn() && m.nopad.holding && !m.nopad.exhausted) {
          const left = Math.max(0, P.winchNopadMs - (now - m.nopad.start));
          g.rect(wx, wy + 10, Math.round(TS * left / P.winchNopadMs), 2, "gold");
        } else if (ctx.padOn()) {
          const lvl = padPct(ctx.input.pressure);
          g.rect(wx + 11, wy, 1, TS, "void");
          g.rect(wx + 11, wy + TS - Math.round(TS * lvl / 100), 1, Math.round(TS * lvl / 100), "gold");
          g.px(wx + 10, wy + TS - 1 - Math.round((TS - 1) * st.winchNeed / 100), "white");
        }
      }
    }
    // twin levers: countdown ring around the lever that is still up
    if (st.leverMs10 > 0) {
      for (const li of I.levers) {
        if (bit(st.objBits, li)) continue;
        const t = I.objs[li].tiles[0], x = tileX(t), y = tileY(t);
        const k = Math.round(44 * st.leverMs10 / Math.max(1, P.leverWindowMs / 10));
        for (let i = 0; i < 44; i++) {
          if (i >= k) break;
          const side = (i / 11) | 0, o = i % 11;
          if (side === 0) g.px(x + o, y - 1, "gold"); else if (side === 1) g.px(x + 12, y + o, "gold");
          else if (side === 2) g.px(x + 11 - o, y + 12, "gold"); else g.px(x - 1, y + 11 - o, "gold");
        }
      }
    }
    // crates
    for (const c of st.cratePos) {
      if (c === NONE || c >= COLS * ROWS) continue;
      const x = tileX(c), y = tileY(c);
      g.rect(x + 1, y + 1, 10, 10, "fireDk"); g.rect(x + 2, y + 2, 8, 8, "gold");
      g.hline(x + 2, y + 5, 8, "fireDk"); g.hline(x + 2, y + 8, 8, "fireDk");
    }
    // boss telegraph (3x3, 4 Hz) and rocks
    if (I.boss) {
      const b = bossInfo(st);
      if (b.st === BS.TELE && blink(ctx, 4)) {
        const centers = [st.bossTarget].concat(st.enemies.filter(e => (e.hpType >> 4) === 2).map(e => e.pos));
        for (const c of centers) {
          if (c === NONE) continue;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const x = c % COLS + dx, y = ((c / COLS) | 0) + dy;
            if (inRoom(x, y)) g.dither(OX + x * TS, OY + y * TS, TS, TS, "danger", null);
          }
        }
      }
      if (b.st === BS.ROCK_TELE) {
        for (const r of st.rocks) {
          if (r === NONE) continue;
          const x = tileX(r), y = tileY(r);
          if (blink(ctx, 4)) { g.rect(x + 3, y + 4, 6, 4, "void"); g.rect(x + 2, y + 5, 8, 2, "void"); }
          g.rect(x + 4, y + 1, 4, 3, "muted");
        }
      }
      drawBoss(g, ctx, st);
    }
    // slimes
    st.enemies.forEach((e, i) => {
      if (e.pos === NONE || (e.hpType >> 4) !== 1) return;
      const [x, y] = tweenPos(m, "e" + i, e.pos, now, 200);
      g.sprite("adv.slime", x + 1, y + 3, {frame: blink(ctx, 2) ? 0 : 1});
    });
    // heroes (partner first, mine on top)
    for (const p of [1 - ctx.p, ctx.p]) {
      const h = st.heroes[p];
      if (h.pos === NONE) continue;
      const [x, y] = tweenPos(m, "h" + p, h.pos, now, P.stepMs);
      drawPet(g, ctx, x, y, petOf(h), h.dirAnim & 3, cols[p], p === ctx.p, (h.petFlags & PF.HURT) !== 0);
    }
    // exit counter "1/2"
    if (I.exits.length) {
      const n = st.heroes.filter(h => I.exits.includes(h.pos)).length;
      if (n > 0) {
        const top = I.exits[0], y = tileY(top) - 9;
        const yy = y < OY ? tileY(I.exits[I.exits.length - 1]) + TS + 1 : y;
        g.rect(97, yy, 26, 9, "void");
        g.text(122, yy - 3, ctx.t("dev.adv.exitCount", {n}), {font: "s", align: "r", c: n === 2 ? "gold" : "white", w: 24, key: "dev.adv.exitCount"});
      }
    }
    // ping "!" (2 s, the pinger's color)
    if ((st.ping & 0x7f) < COLS * ROWS) {
      const t = st.ping & 0x7f, who = st.ping >> 7, x = tileX(t), y = tileY(t);
      g.rect(x + 4, y, 4, 12, "void");
      g.rect(x + 5, y + 1, 2, 6, cols[who]); g.rect(x + 5, y + 9, 2, 2, cols[who]);
    }
  }

  function drawTop(g, ctx) {
    const st = ctx.state, I = INFO[st.room], P = params(ctx);
    g.rect(0, 0, 128, 13, "panel");
    g.hline(0, 13, 128, "line");
    g.text(4, 0, ctx.t(I.key), {w: 60, key: I.key});
    const slots = Math.max(st.hearts, Math.min(P.heartsMax, P.hearts));
    const x0 = 124 - 9 * slots;
    for (let i = 0; i < slots; i++) g.sprite(i < st.hearts ? "icon.heart" : "icon.heartEmpty", x0 + 9 * i, 3);
  }

  function drawInfo(g, ctx) {
    const st = ctx.state, me = st.heroes[ctx.p], pa = st.heroes[1 - ctx.p];
    const mp = petOf(me), pp = petOf(pa);
    if (D.PETS[mp]) {
      g.sprite(D.PETS[mp].sprite, 4, 130);
      g.sprite("icon.S", 16, 131);
      g.text(26, 128, ctx.t(PW_KEYS[mp]), {w: 34, key: PW_KEYS[mp]});
    }
    if (D.PETS[pp]) {
      g.sprite(D.PETS[pp].sprite, 64, 130);
      g.text(76, 128, ctx.t(PW_KEYS[pp]), {w: 34, c: "muted", key: PW_KEYS[pp]});
    }
    if (D.PETS[st.shrinePet]) g.sprite(D.PETS[st.shrinePet].sprite, 114, 130, {color: "muted"});
  }

  // S14 hint bar: the first cell follows the tile in front of you (§4.10)
  function hintCells(ctx) {
    const st = ctx.state, I = INFO[st.room], me = st.heroes[ctx.p], pet = petOf(me);
    const f = faceTile(me.pos, me.dirAnim & 3);
    let first = ["A", "dev.adv.hintUse", "white"];
    if (canStrike(ctx)) first = ["PAD", "dev.adv.hintStrike", "gold"];
    else if (f >= 0 && f === I.winch) first = ["PAD", "dev.adv.hintHold", "white"];
    else if (f >= 0) {
      const b = BAR_TYPES.indexOf(chAt(I, f));
      if (b >= 0 && !bit(st.objBits, I.objAt[f])) {
        if (clears(pet, b)) first = ["S", PW_KEYS[pet], "white"];
        else if (passes(pet, b)) first = ["STICK", "dev.adv.hintPass", "white"];
        else first = ["NO", "dev.adv.hintNo", "danger"];
      }
    }
    const atShrine = I.shrines.some(t => near4(t, me.pos));
    return [first, ["B", "dev.adv.hintPing", "white"], ["M", "dev.adv.hintSwap", atShrine ? "white" : "line"]];
  }
  function drawHints(g, ctx) {
    g.rect(0, 147, 128, 13, "panel");
    g.hline(0, 146, 128, "line");
    hintCells(ctx).forEach(([icon, key, c], i) => {
      const x = [2, 44, 86][i];
      let name = icon;
      if (name === "PAD" && !ctx.padOn()) name = "A";
      const opt = {};
      if (c === "line") opt.color = "line";
      else if (name === "NO") opt.color = "danger";
      g.sprite("icon." + name, x, 149, opt);
      g.text(x + 10, 146, ctx.t(key), {w: 30, c, key});
    });
  }

  // core strike: band bar over the info row and hint bar (§4.10)
  function drawStrike(g, ctx) {
    const m = ctx.m, T = m.trial || m.trialLast;
    g.rect(0, 126, 128, 34, "void");
    if (!T) return;
    D.ui.bandBar(g, 3, 127, 122, 14, {center: T.center, width: T.cfg.bandPct, level: T.level, inside: T.inside});
    const ready = T.phase === 0;
    const stage = D.trial.stage(T);
    const stageStart = T.cfg.readyMs + stage * T.cfg.stageMs;
    const prog = ready ? T.elapsed / Math.max(1, T.cfg.readyMs) : Math.min(1, (T.elapsed - stageStart) / T.cfg.stageMs);
    g.rect(4, 142, 120, 3, "panel");
    g.rect(4, 142, Math.round(120 * prog), 3, ready ? "muted" : "water");
    for (let k = 1; k < 3; k++) g.vline(4 + 40 * k, 142, 3, "void");
    g.rect(0, 146, 128, 14, "panel");
    if (ready) g.text(4, 146, ctx.t("dev.adv.ready"), {w: 76, c: "muted", key: "dev.adv.ready"});
    else g.text(4, 146, ctx.t("dev.adv.stage", {n: stage + 1}), {w: 76, key: "dev.adv.stage"});
    const sc = T.phase === 2 ? D.trial.score(T) : D.trial.stageScore(T, stage);
    g.text(123, 146, String(sc), {align: "r", c: T.phase === 2 ? "gold" : T.inside ? "gold" : "white", w: 30});
  }

  /* ================= screens ================= */

  // S11 adventure pick: public, first come first served (§4.7)
  D.registerScreen("adv.pick", {
    fps: 15,
    toastY: 14,
    enter(ctx) { ctx.s.sel = ctx.p === 1 ? 1 : 0; ctx.s.locked = false; ctx.s.pendingUntil = 0; syncPick(ctx); },
    state(ctx) { syncPick(ctx); },
    input(ctx, ev) {
      const st = ctx.state;
      if (!st) return;
      const theirs = petOf(st.heroes[1 - ctx.p]);
      const r = D.ui.pickInput(ctx, ev, ctx.s, {count: 3, canPick: i => theirs !== i, bUnlocks: true});
      if (r && r.pick != null) { ctx.rt(A.ADV_PICK, r.pick); ctx.s.pendingUntil = ctx.now() + 600; }
      else if (r && r.unlock) { ctx.rt(A.ADV_PICK, NONE); ctx.s.pendingUntil = ctx.now() + 600; }
      else if (ev.type === "down" && ev.btn === "A" && !ctx.s.locked && theirs === ctx.s.sel) ctx.toast("dev.adv.taken");
    },
    draw(ctx, g) {
      const st = ctx.state;
      if (!st) { D.ui.topBar(g, ctx, "dev.adv.pickTitle", {signal: false}); return; }
      const mine = petOf(st.heroes[ctx.p]), theirs = petOf(st.heroes[1 - ctx.p]);
      const sel = ctx.s.sel | 0;
      // the partner's card shows their name instead of the power (the two would overlap)
      const cards = [0, 1, 2].map(i => ({pet: i, line1: theirs === i ? null : PW_KEYS[i], takenBy: theirs === i ? partnerName(ctx) : null,
        mark: mine === i ? "ok" : null}));
      let shrine = 3;
      if (mine < 3 && theirs < 3) shrine = 3 - mine - theirs;
      else if (theirs < 3 && sel !== theirs) shrine = 3 - theirs - sel;
      else if (mine < 3 && theirs === 3) shrine = 3;
      const statusKey = shrine < 3 ? "dev.adv.shrineIs" : theirs === 3 ? "dev.adv.partnerPicking" : null;
      D.ui.pickScreen(g, ctx, {
        titleKey: "dev.adv.pickTitle", noteKey: "dev.adv.pickNote", sel, locked: ctx.s.locked, cards,
        info: [["dev.adv.passes", {bar: ctx.t(BAR_KEYS[PASS[sel]])}], ["dev.adv.blockedBy", {bar: ctx.t(BAR_KEYS[3 - PASS[sel] - CLEARS[sel]])}]],
        statusKey, statusVars: {pet: shrine < 3 ? petName(ctx, shrine) : ""},
        hints: ctx.s.locked ? [null, null, ["B", "dev.adv.hintUnlock"]] : [["LR", "dev.adv.hintPick"], ["A", "dev.adv.hintLock"], ["B", "dev.ui.next"]],
      });
    },
  });
  function syncPick(ctx) {
    const st = ctx.state;
    if (!st) return;
    const mine = petOf(st.heroes[ctx.p]);
    if (mine < 3) { ctx.s.locked = true; ctx.s.sel = mine; }
    else if (ctx.s.locked && ctx.now() > (ctx.s.pendingUntil || 0)) ctx.s.locked = false;
  }

  // S14 adventure room HUD (§4.10)
  D.registerScreen("adv.room", {
    fps: 30,
    toastY: 128,
    antennaAt: [62, 3],
    input(ctx, ev) {
      const st = ctx.state, m = ctx.m;
      if (!st || !m || st.phase !== PH.PLAY || st.countdownDs > 0 || m.trial) return;
      if (ev.type === "down") {
        if (ev.btn === "A" && !ev.fromStick) {
          if (canStrike(ctx)) { startStrike(ctx); return; }
          const me = st.heroes[ctx.p], f = faceTile(me.pos, me.dirAnim & 3);
          if (INFO[st.room].boss && BOSS_TILES.includes(f) && bossInfo(st).st !== BS.STUN) ctx.sfx("ui_deny");
          ctx.rt(A.ADV_USE);
        } else if (ev.btn === "SKILL") ctx.rt(A.ADV_POWER);
        else if (ev.btn === "B") ctx.rt(A.ADV_PING);
      } else if (ev.type === "click" && ev.btn === "MENU") {
        const me = st.heroes[ctx.p];
        if (INFO[st.room].shrines.some(t => near4(t, me.pos))) ctx.rt(A.ADV_SWAP);
        else ctx.toast("dev.core.holdPause");
      }
    },
    draw(ctx, g) {
      const st = ctx.state, m = ctx.m;
      if (!st || !m || st.room >= INFO.length) { g.clear("void"); return; }
      drawTop(g, ctx);
      drawRoom(g, ctx);
      const showStrike = m.trial || (m.trialLast && ctx.now() < m.trialLastUntil);
      if (showStrike) drawStrike(g, ctx);
      else { drawInfo(g, ctx); drawHints(g, ctx); }
      const now = ctx.now();
      if (st.countdownDs > 0 && st.phase === PH.PLAY) {
        const n = Math.ceil(st.countdownDs / 10);
        D.ui.panel(g, 50, 52, 28, 30);
        g.text(64, 56, String(n), {align: "c", scale: 3, c: "gold"});
      }
      if (st.phase === PH.TEAM_DOWN) D.ui.banner(g, ctx, "dev.adv.teamDown", null, {c: "danger", scale: 2, y: 56});
      else if (st.phase === PH.CLEAR) D.ui.banner(g, ctx, "dev.adv.res.clear", null, {c: "gold", scale: 2, y: 56});
      else if (m.bannerKey && now < m.bannerUntil) D.ui.banner(g, ctx, m.bannerKey, null, {c: "gold", scale: 2, y: 56});
    },
  });

  /* ================= player board: mode half ================= */

  function onEvent(ctx, st) {
    const m = ctx.m, me = ctx.p, tgt = st.evTarget, P = params(ctx);
    const mine = tgt === me;
    switch (st.evType) {
      case EV.TAKEN: if (mine) { ctx.sfx("ui_deny"); ctx.toast("dev.adv.taken"); m.pickBounced = true; } break;
      case EV.BLOCKED: if (mine) { ctx.sfx("ui_deny"); ctx.toast("dev.adv.blocked", {pet: petName(ctx, st.evAmount)}); } break;
      case EV.ONLY: if (mine) { ctx.sfx("ui_deny"); ctx.toast("dev.adv.onlyPass", {pet: petName(ctx, st.evAmount)}); } break;
      case EV.BURN: ctx.sfx("adv_burn"); break;
      case EV.DOUSE: ctx.sfx("adv_douse"); break;
      case EV.LILY: ctx.sfx("adv_lily"); break;
      case EV.PUSH: ctx.sfx("adv_push"); break;
      case EV.PLATE: ctx.sfx("adv_plate"); break;
      case EV.GATE: case EV.GATE_CLOSE: ctx.sfx("adv_gate"); break;
      case EV.PULL_NOW: ctx.sfx("adv_lever"); ctx.toast("dev.adv.pullNow", null, P.leverWindowMs); break;
      case EV.DOOR: ctx.sfx("adv_lever"); ctx.toast("dev.adv.doorOpen"); ctx.fx.border("gold", 200); break;
      case EV.LEVER_RESET: ctx.sfx("ui_deny"); break;
      case EV.GEM: ctx.sfx("adv_gem"); break;
      case EV.HEART: ctx.sfx("adv_heart"); break;
      case EV.HURT:
        ctx.sfx("adv_hurt"); ctx.fx.border("danger", 200);
        if (mine) ctx.hw.shake();
        break;
      case EV.SWITCH: ctx.sfx("adv_switch"); if (mine) ctx.toast("dev.adv.swapped", {pet: petName(ctx, st.evAmount)}); break;
      case EV.HIT: ctx.sfx("block_good"); break;
      case EV.SLIME_DIE: ctx.sfx("block_perfect"); break;
      case EV.BOSS_HIT: {
        ctx.sfx("adv_boss_hit");
        ctx.fx.pop("-" + st.evAmount, 64, 30, "gold");
        break;
      }
      case EV.COMBO: m.bannerKey = "dev.adv.combo"; m.bannerUntil = ctx.now() + 1000; ctx.hw.invert(120); break;
      case EV.SLAM: ctx.hw.shake(); break;
      case EV.ROCK: ctx.hw.shake(); break;
      case EV.STUN: ctx.sfx("stage_up"); break;
      case EV.TEAM_DOWN: ctx.sfx("team_down"); break;
      case EV.CLEAR: ctx.sfx("adv_clear"); break;
      case EV.PING: ctx.sfx("ping"); break;
      case EV.DENY: if (mine) ctx.sfx("ui_deny"); break;
      case EV.RESTART: ctx.fx.wipe(); break;
      default: break;
    }
  }
  function roomEntered(ctx, st) {
    const m = ctx.m, I = INFO[st.room];
    m.room = st.room;
    m.tw = {};
    m.tipQ = I.tips.slice();
    m.tipUntil = 0;
    ctx.fx.wipe();
  }

  const player = {
    create(ctx) {
      return {room: -1, tw: {}, tipQ: [], tipUntil: 0, lastEv: ctx.state ? ctx.state.evId : 0, endAt: 0,
        trial: null, trialLast: null, trialLastUntil: 0, struckWindow: -1, bannerKey: null, bannerUntil: 0,
        lastDir: -1, lastPress: 0, aHeld: false, nopad: {holding: false, start: 0, releasedAt: -1e9, exhausted: false},
        shrineTip: false, lastCount: 0, lastPos: NONE, bot: null};
    },
    destroy() {},
    onState(ctx, st, prev) {
      const m = ctx.m;
      if (!m) return;
      if (prev && st.evId !== m.lastEv && st.evId !== 0) onEvent(ctx, st);
      m.lastEv = st.evId;
      if (st.phase !== PH.PICK && st.room !== m.room) roomEntered(ctx, st);
      if ((st.phase === PH.TEAM_DOWN || st.phase === PH.CLEAR || st.phase === PH.GAVE_UP) && !m.endAt) m.endAt = ctx.now();
      const me = st.heroes[ctx.p];
      if (st.phase === PH.PLAY && me.pos !== m.lastPos && m.lastPos !== NONE && near4(me.pos, m.lastPos)) ctx.sfx("step");
      m.lastPos = me.pos;
      // 3-2-1
      const n = st.phase === PH.PLAY ? Math.ceil(st.countdownDs / 10) : 0;
      if (n !== m.lastCount) { if (n > 0) ctx.sfx("count_tick"); else if (m.lastCount > 0) ctx.sfx("count_go"); m.lastCount = n; }
    },
    tick(ctx, dt) {
      const m = ctx.m, st = ctx.state;
      if (!m || !st) return;
      const now = ctx.now();
      // core strike (local attack trial with the adventure timings)
      if (m.trial) {
        const lvl = ctx.padLevel(m.trialPad, dt);
        const done = D.trial.update(m.trial, lvl, now);
        const stg = m.trial.phase === 0 ? -1 : D.trial.stage(m.trial);
        if (stg !== m.trialStage) { if (stg >= 0) ctx.sfx("stage_up"); m.trialStage = stg; }
        if (m.trial.inside && m.trial.phase === 1 && now - m.tickAt >= 120) { m.tickAt = now; ctx.sfx("tick_in_band"); }
        if (done) {
          const score = D.trial.score(m.trial);
          ctx.rt(A.ADV_CORE, score, [m.trialWindow, 0, 0]);
          m.trialLast = m.trial; m.trialLastUntil = now + 900; m.trial = null;
          ctx.sendInputNow();
        }
        return;
      }
      if (st.phase !== PH.PLAY) return;
      // squeeze next to the stunned Warden = start the core strike
      if (ctx.padOn() && ctx.input.pressure >= C.CTL_PRESS_START && canStrike(ctx)) { startStrike(ctx); return; }
      // stick direction changed -> MSG_INPUT now (+20 ms, core); pad change > 8 -> now
      const d = quantize(ctx.input.x, ctx.input.y);
      if (d !== m.lastDir) { m.lastDir = d; ctx.sendInputNow(); }
      if (ctx.padOn() && Math.abs(ctx.input.pressure - m.lastPress) > 8) { m.lastPress = ctx.input.pressure; ctx.sendInputNow(); }
      // no pad: hold A on the winch, at most ADV_WINCH_NOPAD_MS, re-hold after ADV_WINCH_REHOLD_MS (§6.3)
      const P = params(ctx), w = m.nopad, held = !!ctx.input.aBtn;
      if (held && !w.holding) {
        w.holding = true;
        if (now - w.releasedAt >= P.winchReholdMs) { w.start = now; w.exhausted = false; }
        ctx.sendInputNow();
      } else if (!held && w.holding) { w.holding = false; w.releasedAt = now; ctx.sendInputNow(); }
      if (w.holding && !w.exhausted && now - w.start >= P.winchNopadMs) { w.exhausted = true; ctx.sendInputNow(); }
      // room tips (2 s each) and the shrine tip the first time you stand next to it
      if (st.countdownDs === 0 && m.tipQ.length && now >= m.tipUntil) {
        const [key, vars] = m.tipQ.shift();
        ctx.toast(key, vars, 2000); m.tipUntil = now + 2000;
      }
      const me = st.heroes[ctx.p];
      if (!m.shrineTip && INFO[st.room].shrines.some(t => near4(t, me.pos)) && now >= m.tipUntil) {
        m.shrineTip = true; ctx.toast("dev.adv.tipShrine", null, 2000); m.tipUntil = now + 2000;
      }
    },
    route(ctx) {
      const st = ctx.state, m = ctx.m;
      if (!st) return "adv.pick";
      if (st.phase === PH.PICK) return "adv.pick";
      if (st.phase === PH.GAVE_UP) return "results";
      if (st.phase === PH.TEAM_DOWN || st.phase === PH.CLEAR) return m && m.endAt && ctx.now() - m.endAt < 1500 ? "adv.room" : "results";
      return "adv.room";
    },
    busy: ctx => !!(ctx.m && ctx.m.trial),
    inputBits: ctx => (ctx.m && ctx.m.trial ? 0x80 : 0),
    uplink(ctx, f) {
      const m = ctx.m;
      if (m && !ctx.padOn() && m.nopad.holding && m.nopad.exhausted) f.pressure = 0;
      if (m && m.trial) { f.joyX = 0; f.joyY = 0; }
      return f;
    },
    heartbeat: true,
    pauseItems: [{labelKey: "dev.adv.restartRoom", confirmKey: "dev.adv.restartAsk", action: A.ADV_RESTART_ROOM, arg: 0}],
    results(ctx) {
      const st = ctx.state, P = params(ctx);
      const phase = st ? st.phase : PH.GAVE_UP;
      const totalDs = st ? st.totalDs : 0, hearts = st ? st.hearts : 0;
      const got = stars(P, phase, totalDs, hearts);
      const n = got.filter(Boolean).length;
      const secs = (totalDs / 10) | 0;
      const time = Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0");
      const cd = st ? st.coreDmg : [0, 0], wd = st ? st.winchDs : [0, 0];
      const title = phase === PH.CLEAR ? "dev.adv.res.clear" : phase === PH.TEAM_DOWN ? "dev.adv.teamDown" : "dev.adv.res.gaveUp";
      const totalGems = INFO.filter(I => I.gem >= 0).length;
      return {
        titleKey: title, titleColor: phase === PH.CLEAR ? "gold" : phase === PH.TEAM_DOWN ? "danger" : "muted",
        scoreText: "{STAR}".repeat(n),
        drawArt(g, c2, x, y) {
          got.forEach((ok, i) => g.sprite("icon.STAR", x + 22 + 30 * i, y + 2, {scale: 2, color: ok ? null : "line"}));
        },
        noteKey: "dev.adv.res.gems", noteVars: {n: st ? st.gems : 0, m: totalGems},
        rows: [
          {labelKey: "dev.adv.res.time", shared: time, star: got[1]},
          {labelKey: "dev.adv.res.hearts", shared: String(hearts), star: got[2]},
          {labelKey: "dev.adv.res.coreDmg", you: String(cd[ctx.p]), other: String(cd[1 - ctx.p])},
          {labelKey: "dev.adv.res.winch", you: ((wd[ctx.p] / 10) | 0) + "s", other: ((wd[1 - ctx.p] / 10) | 0) + "s"},
        ],
        again: phase === PH.TEAM_DOWN ? {labelKey: "dev.res.hintRetry", kind: "retryRoom"} : {labelKey: "dev.ui.again", kind: "rematch"},
        stats: phase === PH.CLEAR ? {advStars: n} : {},
        win: phase === PH.CLEAR ? true : phase === PH.TEAM_DOWN ? false : null,
        sfx: phase === PH.CLEAR ? "adv_clear" : phase === PH.TEAM_DOWN ? "team_down" : undefined,
      };
    },
  };

  /* ================= bot: a co-op partner that only reads its own board ================= */

  function bfs(start, passFn, goalFn) {
    if (start === NONE) return null;
    if (goalFn(start)) return [start];
    const prev = new Int16Array(COLS * ROWS).fill(-1);
    prev[start] = start;
    const q = [start];
    while (q.length) {
      const t = q.shift();
      for (let d = 0; d < 4; d++) {
        const n = stepTile(t, d);
        if (n < 0 || prev[n] >= 0 || !passFn(n)) continue;
        prev[n] = t;
        if (goalFn(n)) {
          const path = [n];
          let k = n;
          while (prev[k] !== start) { k = prev[k]; path.unshift(k); }
          path.unshift(start);
          return path;
        }
        q.push(n);
      }
    }
    return null;
  }
  const dirTo = (a, b) => { for (let d = 0; d < 4; d++) if (stepTile(a, d) === b) return d; return -1; };

  function botPlan(ctx, B) {
    const st = ctx.state, I = INFO[st.room], p = ctx.p, me = st.heroes[p], pa = st.heroes[1 - p];
    const pet = petOf(me), bits = st.objBits, pos = me.pos, dir = me.dirAnim & 3;
    const crates = st.cratePos.filter(c => c !== NONE);
    const slimes = st.enemies.filter(e => e.pos !== NONE && (e.hpType >> 4) === 1).map(e => e.pos);
    const danger = new Set();
    if (I.boss) {
      const b = bossInfo(st);
      if (b.st === BS.TELE) {
        const centers = [st.bossTarget].concat(st.enemies.filter(e => (e.hpType >> 4) === 2).map(e => e.pos));
        for (const c of centers) if (c !== NONE) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = c % COLS + dx, y = ((c / COLS) | 0) + dy;
          if (inRoom(x, y)) danger.add(y * COLS + x);
        }
      }
      if (b.st === BS.ROCK_TELE || b.st === BS.ROCK_WAIT) for (const r of st.rocks) if (r !== NONE) danger.add(r);
    }
    const free = t => walkable(I, bits, pet, t) && !crates.includes(t) && !slimes.includes(t) && !(I.boss && BOSS_TILES.includes(t));
    const safe = t => free(t) && !danger.has(t);
    // movement toward any goal tile; uncleared barriers this pet can clear are allowed (cleared on the way)
    const clearable = t => { const b = BAR_TYPES.indexOf(chAt(I, t)); return b >= 0 && !bit(bits, I.objAt[t]) && clears(pet, b); };
    // a slime in the way is attacked (power, 2 damage) once the bot stands next to it
    const go = (goal, allowClear) => {
      const slimeOk = t => slimes.includes(t) && walkable(I, bits, pet, t) && !danger.has(t);
      const path = bfs(pos, t => safe(t) || (allowClear && clearable(t)) || slimeOk(t), goal);
      if (!path) return null;
      if (path.length < 2) return {arrived: true};
      const n = path[1], d = dirTo(pos, n);
      if (slimes.includes(n)) return dir === d ? {act: "SKILL"} : {move: d};
      if (clearable(n) && !walkable(I, bits, pet, n)) return dir === d ? {act: "SKILL"} : {move: d};
      return {move: d};
    };
    const faceAct = (t, act) => { const d = dirTo(pos, t); if (d < 0) return null; return dir === d ? {act} : {move: d}; };
    const attackNear = () => {
      const s2 = slimes.find(e => near4(e, pos));
      return s2 != null ? faceAct(s2, "SKILL") : null;
    };
    const wait = () => ({});

    if (I.ri === 0) {
      if (I.exits.includes(pos)) return wait();
      return attackNear() || go(t => I.exits.includes(t), true) || wait();
    }
    if (I.ri === 1) {
      const gateOpen = bit(bits, I.gate), plate = I.objs[I.plate].tiles[0];
      const north = t => ((t / COLS) | 0) <= 1;
      const atWinch = h => near4(h.pos, I.winch) && faceTile(h.pos, h.dirAnim & 3) === I.winch;
      if (north(pos)) {
        const a = attackNear();
        if (a) return a;
        if (slimes.length) return go(t => slimes.some(e => near4(e, t)), false) || wait();
        if (!north(pa.pos)) return pos === plate ? wait() : go(t => t === plate, false) || wait();
        if (I.exits.includes(pos)) return wait();
        return go(t => I.exits.includes(t), false) || wait();
      }
      if (north(pa.pos)) {
        if (gateOpen) return go(t => I.exits.includes(t), false) || wait();
        return wait();
      }
      if ((atWinch(pa) && (B.role !== "holder" || p === 1)) || (B.role === "runner" && gateOpen)) {
        B.role = "runner";
        if (gateOpen) return go(t => north(t), false) || wait();
        return go(t => ((t / COLS) | 0) === 3 && t % COLS >= 2 && t % COLS <= 5, false) || wait();
      }
      if (B.role !== "holder") {
        if (p === 0 || ctx.now() - (B.since || (B.since = ctx.now())) > 2500) B.role = "holder";
        else return go(t => ((t / COLS) | 0) === 3 && t % COLS >= 2 && t % COLS <= 5, false) || wait();
      }
      if (near4(pos, I.winch)) { const f = faceAct(I.winch, "HOLD"); return f.act ? {hold: true} : f; }
      return go(t => near4(t, I.winch), false) || wait();
    }
    if (I.ri === 2) {
      if (exitOpen(I, bits)) return attackNear() || (I.exits.includes(pos) ? wait() : go(t => I.exits.includes(t), false) || wait());
      const right = pos % COLS >= 5;
      if (right) {
        const a = attackNear();
        if (a) return a;
        const L = I.levers.map(li => I.objs[li].tiles[0]);
        let mineL = p === 0 ? 0 : 1;
        if (near4(pa.pos, L[mineL]) && pa.pos % COLS >= 5) mineL = 1 - mineL;
        const lt = L[mineL], li = I.levers[mineL];
        if (!near4(pos, lt)) return go(t => near4(t, lt) && t % COLS >= 5, false) || wait();
        if (bit(bits, li)) return wait();
        const otherDown = bit(bits, I.levers[1 - mineL]);
        const partnerReady = near4(pa.pos, L[1 - mineL]);
        const f = faceAct(lt, "A");
        if (f.move != null) return f;
        return otherDown || partnerReady ? f : wait();
      }
      const vineT = I.objs.findIndex(o => o.kind === "bar");
      const vine = I.objs[vineT].tiles[0];
      const plate = I.objs[I.plate].tiles[0];
      if (!bit(bits, vineT)) {
        if (clears(pet, 0)) {
          if (near4(pos, vine) && !crates.includes(pos)) return faceAct(vine, "SKILL");
          return go(t => near4(t, vine), false) || wait();
        }
        if (clears(petOf(pa), 0)) return pos === 12 ? wait() : go(t => t === 12, false) || wait();     // wait above the crate
        if (clears(st.shrinePet, 0)) {
          const sh = I.shrines[0];
          if (near4(pos, sh)) return {act: "MENU"};
          return go(t => near4(t, sh), false) || wait();
        }
        return wait();
      }
      const c = crates[0];
      if (c !== plate) {
        if (c == null || c % COLS !== 2) return wait();     // pushed off the column: needs "Retry room"
        const above = c - COLS;
        if (pos === above) return {move: 2};
        return go(t => t === above, false) || wait();
      }
      return go(t => t % COLS >= 5, false) || wait();
    }
    // 1-4 the Warden
    const b = bossInfo(st);
    if (danger.has(pos)) return go(t => !danger.has(t), false) || wait();
    if (b.st === BS.STUN && B.struck !== st.bossWindow) {
      if (BOSS_ADJ.includes(pos)) return {strike: true};
      return go(t => BOSS_ADJ.includes(t), false) || wait();
    }
    const home = p === 0 ? 33 : 36;
    if (pos === home) return wait();
    return go(t => t === home, false) || wait();
  }

  function bot(ctx, ctl) {
    const st = ctx.state, m = ctx.m;
    if (!st || !m) return;
    const now = ctx.now();
    const B = m.bot || (m.bot = {next: 0, actAt: 0, stick: -2, pressure: -1, role: null, since: 0, struck: -1, jit: 0, jitAt: 0, seen: 0});
    // the core lets go of everything when a bot is switched off: re-send after a gap
    if (now - B.seen > 100) { B.stick = -2; B.pressure = -1; }
    B.seen = now;
    const setStick = d => { if (d === B.stick) return; B.stick = d; ctl.stick(d < 0 ? 0 : DX[d] * 100, d < 0 ? 0 : -DY[d] * 100); };
    const setPress = v => { if (v === B.pressure) return; B.pressure = v; ctl.pressure(v); };
    if (m.trial) {
      // follow the band with a little human wobble
      if (now - B.jitAt > 250) { B.jitAt = now; B.jit = ctl.rng.int(21) - 10; }
      const lvl = Math.max(0, Math.min(100, m.trial.center + B.jit));
      setStick(-1);
      setPress(C.CTL_PRESS_START + Math.round(lvl * (C.CTL_PRESS_FULL - C.CTL_PRESS_START) / 100) + 2);
      return;
    }
    if (now < B.next) return;
    B.next = now + 40;
    if (st.phase === PH.PICK) {
      const mine = petOf(st.heroes[ctx.p]), theirs = petOf(st.heroes[1 - ctx.p]);
      if (mine < 3 || now - B.actAt < 300 || !ctx.s || ctx.screenId !== "adv.pick") return;
      B.actAt = now;
      const want = [0, 1, 2].find(i => i !== theirs && (ctx.p === 1 ? i >= 1 : true)) ?? [0, 1, 2].find(i => i !== theirs);
      if ((ctx.s.sel | 0) !== want) ctl.press("RIGHT", 60); else ctl.press("A", 60);
      return;
    }
    if (st.phase !== PH.PLAY || st.countdownDs > 0) { setStick(-1); setPress(0); return; }
    if (B.room !== st.room) { B.room = st.room; B.role = null; B.since = 0; }
    const plan = botPlan(ctx, B) || {};
    if (plan.hold) { setStick(-1); setPress(230); return; }
    if (plan.strike) {
      setStick(-1);
      B.struck = st.bossWindow;
      setPress(150);
      if (!ctx.padOn() && now - B.actAt > 300) { B.actAt = now; ctl.press("A", 60); }
      return;
    }
    if (B.pressure && !m.trial) setPress(0);
    if (plan.move != null) { setStick(plan.move); return; }
    setStick(-1);
    if (plan.act && now - B.actAt > 450) { B.actAt = now; ctl.press(plan.act, plan.act === "MENU" ? 120 : 60); }
  }

  /* ================= registration ================= */

  D.registerMode({
    id: "adventure", modeId: 2, order: 2, titleKey: "dev.menu.adv", subKey: "dev.menu.advSub", icon: "ui.mode.adv",
    coop: true, status: "prototype", needsStick: true, stateMsg: "adv.state",
    params: PARAMS,
    rules: {ROOMS, INFO, PH, EV, BS, PF, PASS, CLEARS, passes, clears, walkable, floorish, quantize, padPct, coreDamage, stars,
      trialCfg, stepTile, faceTile, near4, exitOpen, BOSS_TILES, BOSS_ADJ, bfs},
    lobby: {badgeKey: "dev.lobby.rooms", badgeVars: () => ({n: ROOMS.length}), goals: ["dev.adv.goal1", "dev.adv.goal2"],
      keys: [["STICK", "dev.adv.k1n", "dev.adv.k1"], ["A", "dev.adv.k2n", "dev.adv.k2"], ["S", "dev.adv.k3n", "dev.adv.k3"],
        ["PAD", "dev.adv.k4n", "dev.adv.k4"], ["M", "dev.adv.k5n", "dev.adv.k5"]]},
    central: {periodMs: 100, create: createCentral},
    rank: [{variant: 0, titleKey: "dev.rank.adv", subKey: "dev.rank.world", subVars: {n: 1}, ruleKey: "dev.rank.ruleAdv", better: "low", coop: true, pause: "add", pauseExtraMs: p => p.resumeCountMs, format: D.rankFmt.clockDs}],
    player,
    bot,
  });

  // Gallery / regression: two bots clear all 4 rooms (seeded, deterministic)
  D.registerFixture("adv.bots", {titleKey: "dev.menu.adv", async run(T) {
    T.reset({seed: 5, skipBoot: true, mode: "adventure", profiles: [{name: "ANNA", avatar: 3, color: 0}, {name: "BENJI", avatar: 5, color: 4}]});
    T.bot(0, true); T.bot(1, true);
    const snap = () => { const c = T.central(); return c.mode && c.mode.snapshot; };
    let room = -1;
    for (let i = 0; i < 400; i++) {
      T.step(500);
      const s = snap();
      if (!s) continue;
      if (s.phase === PH.PLAY && s.room !== room) { room = s.room; T.step(600); T.shot("room " + (room + 1)); }
      if (s.phase >= PH.TEAM_DOWN) break;
    }
    const s = snap();
    T.bot(0, false); T.bot(1, false);
    T.log("phase " + s.phase + " room " + s.room + " hearts " + s.hearts + " time " + s.totalDs / 10 + " s");
    T.assert(s.phase === PH.CLEAR, "bots should clear the Warden (phase " + s.phase + ", room " + s.room + ")");
  }});
})();
