// Pocket Rivals handheld simulator: 双人冒险 Adventure prototype (docs/ui-design.md §4.7, §4.10, §6)
//
// Co-op: the two players vote a world (adv.world), each picks a different
// pet (the third rests on the shrine), then the team clears that world's 4
// one-screen rooms (10 x 9 tiles of 12 px) with 5 shared hearts:
//   World 1: 1-1 ENTRY (elemental barriers), 1-2 WINCH (one holds the gate
//     with the pad, the other passes), 1-3 LEVERS (crate on a plate, two
//     levers within 1 s), 1-4 WARDEN (boss; core strike = the attack trial,
//     DEVICE.trial, while it is stunned).
//   World 2 (shrines): 2-1 NOOKS, 2-2 TRIAD, 2-3 TRADE, 2-4 IDOL (boss: it
//     slams whoever is nearest; only the other pet, two tiles behind it, may
//     strike the core).
//   World 3 (teamwork): 3-1 RELAY, 3-2 SPLIT, 3-3 SYNC, 3-4 RHINO (boss: it
//     follows one pet's column and charges; a rock stuns it, a wall only
//     bonks; only the pet it did not chase may strike).
// After a world's boss: results with that world's 3 stars, A = next world
// (REMATCH arg 1 -> carry() {next: true}), keeping the pets.
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
    // worlds 2 and 3
    ["starTimeW2S", "ADV_STAR_TIME_W2_S", 240, 30, 900, 10, "s"],
    ["starTimeW3S", "ADV_STAR_TIME_W3_S", 240, 30, 900, 10, "s"],
    ["idolHp", "ADV_IDOL_HP", 80, 10, 250, 5, ""],
    ["idolPhase2Hp", "ADV_IDOL_PHASE2_HP", 40, 0, 250, 5, ""],
    ["idolIdleMs", "ADV_IDOL_IDLE_MS", 1000, 200, 5000, 100, "ms"],
    ["idolLockMs", "ADV_IDOL_LOCK_MS", 1200, 300, 3000, 100, "ms"],
    ["idolLock2Ms", "ADV_IDOL_LOCK2_MS", 900, 300, 3000, 100, "ms"],
    ["idolStunMs", "ADV_IDOL_STUN_MS", 3000, 1000, 8000, 100, "ms"],
    ["idolFaceMs", "ADV_IDOL_FACE_MS", 250, 50, 1000, 50, "ms"],
    ["rhinoHp", "ADV_RHINO_HP", 72, 10, 250, 2, ""],
    ["rhinoPhase2Hp", "ADV_RHINO_PHASE2_HP", 36, 0, 250, 2, ""],
    ["rhinoTrackMs", "ADV_RHINO_TRACK_MS", 1000, 0, 5000, 50, "ms"],
    ["rhinoTrackMaxMs", "ADV_RHINO_TRACK_MAX_MS", 2500, 500, 8000, 100, "ms"],
    ["rhinoTrackStepMs", "ADV_RHINO_TRACK_STEP_MS", 250, 50, 1000, 50, "ms"],
    ["rhinoSettleMs", "ADV_RHINO_SETTLE_MS", 500, 0, 2000, 50, "ms"],
    ["rhinoAimMs", "ADV_RHINO_AIM_MS", 1200, 300, 3000, 100, "ms"],
    ["rhinoAim2Ms", "ADV_RHINO_AIM2_MS", 800, 300, 3000, 100, "ms"],
    ["rhinoChargeStepMs", "ADV_RHINO_CHARGE_STEP_MS", 100, 50, 500, 50, "ms"],
    ["rhinoStunMs", "ADV_RHINO_STUN_MS", 3000, 1000, 8000, 100, "ms"],
    ["rhinoBonkMs", "ADV_RHINO_BONK_MS", 600, 0, 3000, 50, "ms"],
    ["rhinoJumpMs", "ADV_RHINO_JUMP_MS", 450, 0, 2000, 50, "ms"],
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
    starTimeW2S: ["时间星2", "Star time W2"], starTimeW3S: ["时间星3", "Star time W3"],
    idolHp: ["独眼血量", "Idol HP"], idolPhase2Hp: ["独眼二阶", "Idol phase 2"], idolIdleMs: ["独眼待机", "Idol idle"],
    idolLockMs: ["盯人时长", "Idol lock"], idolLock2Ms: ["二阶盯人", "Idol lock 2"], idolStunMs: ["独眼喘气", "Idol stun"],
    idolFaceMs: ["转身间隔", "Idol turn"],
    rhinoHp: ["石犀血量", "Rhino HP"], rhinoPhase2Hp: ["石犀二阶", "Rhino phase 2"], rhinoTrackMs: ["追踪最短", "Track min"],
    rhinoTrackMaxMs: ["追踪最长", "Track max"], rhinoTrackStepMs: ["横移一列", "Track step"], rhinoSettleMs: ["站稳计时", "Settle"],
    rhinoAimMs: ["冲锋预警", "Charge warn"], rhinoAim2Ms: ["冲锋预警2", "Charge warn 2"], rhinoChargeStepMs: ["冲锋一行", "Charge step"],
    rhinoStunMs: ["石犀晕倒", "Rhino stun"], rhinoBonkMs: ["撞墙震退", "Wall bonk"], rhinoJumpMs: ["扬尘跳回", "Jump back"],
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
      // worlds 2 and 3
      "dev.adv.room5": "2-1 双口袋", "dev.adv.room6": "2-2 三色廊", "dev.adv.room7": "2-3 墙中龛", "dev.adv.room8": "2-4 独眼像",
      "dev.adv.room9": "3-1 接力", "dev.adv.room10": "3-2 分头", "dev.adv.room11": "3-3 同步", "dev.adv.room12": "3-4 石犀",
      "dev.adv.tip21": "分头进口袋，一起拉", "dev.adv.tip22": "先用能力，再换宠物", "dev.adv.tip23": "隔墙在神龛交换宠物",
      "dev.adv.tip24": "被盯的人别动", "dev.adv.tip24b": "搭档绕到背后打",
      "dev.adv.tip31": "你撑闸门，我去开门", "dev.adv.tip32": "一人进去，两边同拉", "dev.adv.tip33": "推箱开闸，分头拉杆",
      "dev.adv.tip34": "站石头上方引它冲", "dev.adv.tip34b": "撞晕后搭档去打",
      "dev.adv.hintBait": "诱饵",
      "dev.adv.worldTitle": "选择世界", "dev.adv.world": "世界{n}",
      "dev.adv.wsub1": "初次合作", "dev.adv.wsub2": "神龛元素", "dev.adv.wsub3": "机关分头",
      "dev.adv.partnerWorld": "搭档：{world}{OK}",
      "dev.adv.nextWorld": "下一世界：{world}", "dev.adv.partnerNext": "搭档：下一世界{OK}", "dev.adv.hintNext": "继续",
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
      "dev.adv.room5": "2-1 NOOKS", "dev.adv.room6": "2-2 TRIAD", "dev.adv.room7": "2-3 TRADE", "dev.adv.room8": "2-4 IDOL",
      "dev.adv.room9": "3-1 RELAY", "dev.adv.room10": "3-2 SPLIT", "dev.adv.room11": "3-3 SYNC", "dev.adv.room12": "3-4 RHINO",
      "dev.adv.tip21": "A nook each, pull", "dev.adv.tip22": "Clear, then swap", "dev.adv.tip23": "Trade via shrine",
      "dev.adv.tip24": "Bait: stand still", "dev.adv.tip24b": "Hit it from behind",
      "dev.adv.tip31": "Hold gates in turn", "dev.adv.tip32": "Split, pull both", "dev.adv.tip33": "Crate, then split",
      "dev.adv.tip34": "Lure it to a rock", "dev.adv.tip34b": "Stun: other hits",
      "dev.adv.hintBait": "Bait",
      "dev.adv.worldTitle": "PICK WORLD", "dev.adv.world": "WORLD {n}",
      "dev.adv.wsub1": "Basics", "dev.adv.wsub2": "Shrines", "dev.adv.wsub3": "Teamwork",
      "dev.adv.partnerWorld": "Partner: {world} {OK}",
      "dev.adv.nextWorld": "Next world: {world}", "dev.adv.partnerNext": "Partner: next {OK}", "dev.adv.hintNext": "Next",
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
    // 2-4 Idol 24 x 24: frame 0 faces down (the eye), frame 1 faces up (its back, c = core);
    // e = pupil (danger while it locks on), w = eye white
    "adv.idol": {w: 24, h: 24, mirror: true, map: {o: "void", m: "muted", l: "line", w: "white", e: "void", c: "line"}, frames: [
      ["....oooooooo", "...ommmmmmmm", "..ommmmmmmmm", ".ommlmmmmmmm", ".ommmmmmmmmm", "ommmmmmmmmmm",
        "ommmmmmooooo", "ommmmmowwwww", "ommmmowwwwww", "ommmmowwweee", "ommmmowwweee", "ommmmowwweee",
        "ommmmowwwwww", "ommmmmowwwww", "ommmmmmooooo", "ommlmmmmmmmm", "ommmmmmmmmmm", ".ommmmmmmmmm",
        ".ommmmllllll", ".ommmmmmmmmm", "..ommmmmmmmm", "..ommmmmmmmm", ".oooolllllll", "oooooooooooo"],
      ["....oooooooo", "...ommmmmmmm", "..ommmmmmmmm", ".ommlmmmmmmm", ".ommmmmmmmmm", "ommmmmmmmmmm",
        "ommmmmmmmmmm", "ommmlmmmmmmm", "ommmmmmmoooo", "ommmmmmmoccc", "ommmmmmmoccc", "ommmmmmmoccc",
        "ommmmmmmoooo", "ommmmmmmmmmm", "ommmmmmmmlmm", "ommlmmmmmmmm", "ommmmmmmmmmm", ".ommmmmmmmmm",
        ".ommmmmmmmmm", ".ommmmmmmmmm", "..ommmmmmmmm", "..ommmmmmmmm", ".oooolllllll", "oooooooooooo"]]},
    // the Idol facing right (flipX = left)
    "adv.idolSide": {w: 24, h: 24, map: {o: "void", m: "muted", l: "line", w: "white", e: "void"}, frames: [[
      "....oooooooooooooooo....", "...ommmmmmmmmmmmmmmmo...", "..ommmmmmmmmmmmmmmmmmo..", ".ommlmmmmmmmmmmmmmmlmmo.",
      ".ommmmmmmmmmmmmmmmmmmmo.", "ommmmmmmmmmmmmmmmmmmmmmo", "ommmmmmmmmmmmmmooooooomo", "ommmlmmmmmmmmmowwwwwwwoo",
      "ommmmmmmmmmmmmowwweeeeoo", "ommmmmmmmmmmmmowwweeeeoo", "ommmmmmmmmmmmmowwweeeeoo", "ommmmmmmmmmmmmowwweeeeoo",
      "ommmmmmmmmmmmmowwweeeeoo", "ommmmmmmmmmmmmowwwwwwwoo", "ommmmmmmmlmmmmmooooooomo", "ommlmmmmmmmmmmmmmmmmlmmo",
      "ommmmmmmmmmmmmmmmmmmmmmo", ".ommmmmmmmmmmmmmmmmmmmo.", ".ommmmmmmmmmmmmmmmmmmmo.", ".ommmmmmmmmmmmmmmmmmmmo.",
      "..ommmmmmmmmmmmmmmmmmo..", "..ommmmmmmmmmmmmmmmmmo..", ".oooolllllllllllllloooo.", "oooooooooooooooooooooooo"]]},
    // 3-4 Rhino 24 x 24, head down; frame 1 = charging (dust lines); h = horn (gold while stunned), e = eyes
    "adv.rhino": {w: 24, h: 24, mirror: true, map: {o: "void", m: "muted", l: "line", e: "void", n: "void", h: "white"}, frames: [
      ["............", "..oo........", ".olmo..ooooo", ".ommmooommmm", "..ommmmmmmmm", "..ommmmmmmmm",
        ".ommmmmmmmmm", ".ommlmmmmmmm", "ommmmmmmmmmm", "ommmmeemmmmm", "ommmmeemmmmm", "ommmmmmmmmmm",
        "ommmmmmmmlmm", ".ommmmmmmmmm", ".ommmmmmmmmm", "..ommmmmmmoh", "..ommmmmmmoh", "...ommnmmmoh",
        "...ommmmmmoh", "....oooooooh", "..........oh", "..........oh", "...........o", "............"],
      [".l...l......", "..l...l.....", ".olmo..ooooo", ".ommmooommmm", "..ommmmmmmmm", "..ommmmmmmmm",
        ".ommmmmmmmmm", ".ommlmmmmmmm", "ommmmmmmmmmm", "ommmmeemmmmm", "ommmmeemmmmm", "ommmmmmmmmmm",
        "ommmmmmmmlmm", ".ommmmmmmmmm", ".ommmmmmmmmm", "..ommmmmmmoh", "..ommmmmmmoh", "...ommnmmmoh",
        "...ommmmmmoh", "....oooooooh", "..........oh", "..........oh", "...........o", "............"]]},
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
    GATE_CLOSE: 31, WAKE: 32, BONK: 33, WORLD: 34};
  // boss_state bits 0-3. Warden: 1 idle, 2 slam warning. Idol: 1 idle, 2 locked on (3x3 warning).
  // Rhino: 1 tracking a column, 2 lane warning, 7 charging, 8 bonked a wall, 9 dust before the jump back.
  const BS = {SLEEP: 0, IDLE: 1, TELE: 2, STUN: 3, ROCK_WAIT: 4, ROCK_TELE: 5, DEAD: 6, CHARGE: 7, BONK: 8, RETURN: 9};
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
      "..........",
      "..........",
      "....12....",
      "..........",
      "....R....."]},
    {key: "dev.adv.room3", tips: [["dev.adv.tip3"]], gateBack: 3, map: [
      "....#..L.$",
      ".1..#.....",
      "..C.#.....",
      "....G....E",
      "..V.#..s.E",
      ".#P##....E",
      "....#.....",
      ".2..#.....",
      "S...#..L.+"]},
    {key: "dev.adv.room4", tips: [["dev.adv.tip4"]], boss: "warden", map: [
      "..........",
      "....BB....",
      "....BB....",
      "..........",
      "..........",
      "..........",
      "..........",
      "...1..2...",
      ".........."]},
    // ---- World 2: shrines and elements ----
    // 2-1: the left nook only lets Tide in (douse, swim), the right one only Ember (burn, walk
    // through fire); both levers within 1 s. A team without one of them sends Sprout to the shrine.
    {key: "dev.adv.room5", tips: [["dev.adv.tip21"]], map: [
      "....EE....",
      "..........",
      ".1......2.",
      "####..####",
      "L.WF..VF.L",
      "####..####",
      "..........",
      "....S.....",
      "$........."]},
    // 2-2: one corridor of vines, water, fire; two powers in the team, the third on the shrine (6,4)
    {key: "dev.adv.room6", tips: [["dev.adv.tip22"]], map: [
      ".1.....2..",
      "..........",
      "###V######",
      "###.W.####",
      "#####.S###",
      "###.F.####",
      "###.######",
      "..........",
      "...EE....$"]},
    // 2-3: two pipes (vine fire water / water vine fire); the shrine (4,1) sits in the middle wall
    // and both sides reach it: one leaves a pet, the other takes it
    {key: "dev.adv.room7", tips: [["dev.adv.tip23"]], map: [
      ".1..#..2..",
      "....S.....",
      "....#.....",
      "#V#####W##",
      "#.#####.##",
      "#F#####V##",
      "#.#####.##",
      "#W#####F##",
      "+...EE...$"]},
    // 2-4: the Idol (body fixed at (4,3)-(5,4))
    {key: "dev.adv.room8", tips: [["dev.adv.tip24"], ["dev.adv.tip24b"]], boss: "idol", map: [
      "..........",
      "..........",
      "..........",
      "....BB....",
      "....BB....",
      "..........",
      "..........",
      "...1..2...",
      ".........."]},
    // ---- World 3: machines and splitting up ----
    // 3-1: three "you hold, I pass" hand-overs; one gate group (3,7)+(6,0), winch (5,4), plate (9,8)
    {key: "dev.adv.room9", tips: [["dev.adv.tip31"]], gateBack: 3, map: [
      ".1.#..G..E",
      "...#..#..E",
      "...#..#...",
      "...#..#...",
      "...#.R#...",
      "...#..###W",
      "...#..###.",
      "F..G.2###.",
      "$#.#..###P"]},
    // 3-2: winch lets one in, both levers at once across the wall, the plate lets the other in
    {key: "dev.adv.room10", tips: [["dev.adv.tip32"]], gateBack: 3, map: [
      "......#..E",
      ".R....#..E",
      "......#..E",
      "......#...",
      "......G...",
      "......#.P.",
      ".1..2.#...",
      "W#....#.#F",
      "L#...$#.#L"]},
    // 3-3: (shrine for Tide) douse, crate along the lane onto the plate, then one lever up, one down
    {key: "dev.adv.room11", tips: [["dev.adv.tip33"]], gateBack: 2, map: [
      "#L#####.EE",
      "#V......##",
      "######G###",
      "#####..###",
      "#####..###",
      "..C.F..###",
      "#...#..###",
      "W+1.#$P###",
      "L#2S######"]},
    // 3-4: the Rhino (body starts at (4,0)-(5,1) and moves); rocks (2,8) and (7,8)
    {key: "dev.adv.room12", tips: [["dev.adv.tip34"], ["dev.adv.tip34b"]], boss: "rhino", map: [
      "....BB....",
      "....BB....",
      "..........",
      "..........",
      "..........",
      "..........",
      "..........",
      "...1..2...",
      "..#....#.."]},
  ];
  const RPW = 4, WORLDS = ROOMS.length / RPW;          // rooms per world (the 4th is the boss)
  const worldOf = ri => (ri / RPW) | 0;
  const WORLD_ICONS = ["adv.boss", "adv.idol", "adv.rhino"];
  const WORLD_SUBS = ["dev.adv.wsub1", "dev.adv.wsub2", "dev.adv.wsub3"];
  // Precomputed per room (the "flash" tables): objects with their obj_bits index
  const INFO = ROOMS.map((r, ri) => {
    const at = (x, y) => r.map[y][x];
    const I = {ri, key: r.key, tips: r.tips, boss: !!r.boss, gateBack: r.gateBack == null ? -1 : r.gateBack,
      world: worldOf(ri), bossType: r.boss || null, bossMoves: r.boss === "rhino", bossTiles: [],
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
      else if (ch === "B") I.bossTiles.push(t);
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
  // 2 x 2 body with its top-left tile at (x, y)
  const bodyTiles = (x, y) => [y * COLS + x, y * COLS + x + 1, (y + 1) * COLS + x, (y + 1) * COLS + x + 1];
  // the (up to) 8 tiles 4-adjacent to a 2 x 2 body, in the Warden's BOSS_ADJ order
  function adjTiles(x, y) {
    const out = [];
    for (const [ax, ay] of [[x - 1, y], [x - 1, y + 1], [x + 2, y], [x + 2, y + 1], [x, y - 1], [x + 1, y - 1], [x, y + 2], [x + 1, y + 2]])
      if (ax >= 0 && ay >= 0 && ax < COLS && ay < ROWS) out.push(ay * COLS + ax);
    return out;
  }
  // Idol: the 2 tiles right behind the body (opposite the way it faces)
  function backTiles(x, y, face) {
    const c = face === 2 ? [[x, y - 1], [x + 1, y - 1]] : face === 0 ? [[x, y + 2], [x + 1, y + 2]]
      : face === 1 ? [[x - 1, y], [x - 1, y + 1]] : [[x + 2, y], [x + 2, y + 1]];
    return c.filter(([a, b]) => a >= 0 && b >= 0 && a < COLS && b < ROWS).map(([a, b]) => b * COLS + a);
  }
  // Idol facing toward tile t, from the body centre in half tiles (both axes odd, never 0):
  // the larger axis wins; a tie keeps the current facing when it is one of the two, else vertical
  function idolFace(bx, by, t, cur) {
    const dx = 2 * (t % COLS) + 1 - (2 * bx + 2), dy = 2 * ((t / COLS) | 0) + 1 - (2 * by + 2);
    const h = dx > 0 ? 1 : 3, v = dy > 0 ? 2 : 0;
    if (Math.abs(dx) > Math.abs(dy)) return h;
    if (Math.abs(dy) > Math.abs(dx)) return v;
    return cur === h || cur === v ? cur : v;
  }
  // Manhattan distance from tile t to the nearest tile of a 2 x 2 body
  const distBody = (x, y, t) => Math.min(...bodyTiles(x, y).map(b => Math.abs(b % COLS - t % COLS) + Math.abs(((b / COLS) | 0) - ((t / COLS) | 0))));

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
    if (ch === "#" || ch === "R" || ch === "L" || ch === "S") return false;
    if (ch === "B") return I.bossMoves;                // the Rhino's start tiles are floor once it moves
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
    if (ch === "B") return I.bossMoves;
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
  // the time star has its own limit per world (ADV_STAR_TIME_S, _W2_S, _W3_S)
  const starTime = (P, world) => [P.starTimeS, P.starTimeW2S, P.starTimeW3S][world | 0] || P.starTimeS;
  function stars(P, phase, totalDs, hearts, world = 0) {
    if (phase !== PH.CLEAR) return [false, false, false];
    return [true, totalDs <= starTime(P, world) * 10, hearts >= P.starHearts];
  }
  const bossHpMax = (P, kind) => (kind === "idol" ? P.idolHp : kind === "rhino" ? P.rhinoHp : P.bossHp);
  const bossPhase2 = (P, kind) => (kind === "idol" ? P.idolPhase2Hp : kind === "rhino" ? P.rhinoPhase2Hp : P.bossPhase2Hp);
  function trialCfg(P) {
    const bp = D.battleParams();
    return {readyMs: P.coreReadyMs, stageMs: P.coreStageMs, stages: 3, bandPct: bp.bandPct, speeds: [bp.speed1, bp.speed2, bp.speed3]};
  }

  /* ================= central board: the world (50 ms steps) ================= */

  function createCentral(api, opts) {
    const P = Object.assign({}, PDEF, opts.params || {});
    const carry = opts.retryRoom && opts.carry ? opts.carry : null;
    const s = {
      phase: PH.PICK, room: 0, world: NONE, wvote: [NONE, NONE], t: 0, base: api.gameNow(), countdownMs: 0, roomMs: 0, totalMs: 0,
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

    // boss state (central RAM): the Warden and the Idol never move; the Rhino's top-left is (bx, by)
    function makeBoss(R) {
      const top = Math.min(...R.bossTiles), kind = R.bossType;
      return {kind, hp: bossHpMax(P, kind), st: BS.SLEEP, until: s.t + 1500, round: 0, targets: [NONE, NONE], window: 0, stunEnd: -1e9,
        graceUntil: 0, phase2: false, tgt: 0, hit: [-1, -1], hitDmg: [0, 0], stunTgt: NONE,
        bx: top % COLS, by: (top / COLS) | 0, face: 2, faceAt: 0, area: NONE,
        lane: -1, land: NONE, landRock: false, nextStep: 0, trackEnd: 0, alignedAt: -1};
    }
    function enterRoom(ri, fresh) {
      s.room = ri;
      s.world = worldOf(ri);
      const R = INFO[ri];
      s.bits = 0;
      if (R.gem >= 0 && (s.gemMask >> ri) & 1) s.bits |= 1 << R.gem;          // gems and hearts stay taken
      if (R.heart >= 0 && (s.heartMask >> ri) & 1) s.bits |= 1 << R.heart;
      s.crates = [R.crates[0] != null ? R.crates[0] : NONE, R.crates[1] != null ? R.crates[1] : NONE];
      s.slimes = [0, 1, 2, 3].map(i => R.slimes[i] != null ? {pos: R.slimes[i], hp: P.slimeHp, next: s.t + P.slimeStepMs, dir: 2, steps: 0} : null);
      s.heroes.forEach((h, p) => { h.pos = R.spawn[p]; h.dir = 0; h.nextMove = 0; h.hurtUntil = 0; });
      s.needMilli = P.winchOpenPct * 1000; s.winchIdle = 0; s.winching = [false, false]; s.gateCloseAt = -1;
      s.leverUntil = 0; s.ping = 0x7f; s.pingUntil = 0; s.rocks = [NONE, NONE, NONE, NONE];
      s.boss = R.boss ? makeBoss(R) : null;
      s.roomMs = 0;
      s.phase = PH.PLAY;
      if (!fresh) ev(EV.ROOM, 0, ri);
      api.nextStep();
    }
    function startPlay() {
      s.heroes.forEach((h, p) => { h.pet = s.picks[p]; });
      s.shrine = 3 - s.picks[0] - s.picks[1];
      enterRoom((s.world === NONE ? 0 : s.world) * RPW, true);
    }
    if (carry && carry.next) {
      // next world (REMATCH arg 1 after a world's boss, §6.7): same pets, fresh hearts, time and gems
      s.picks = carry.pets.slice(); s.shrine = carry.shrine;
      s.heroes.forEach((h, p) => { h.pet = carry.pets[p]; });
      s.world = carry.world;
      enterRoom(carry.world * RPW, true);
      s.countdownMs = P.resumeCountMs;
    } else if (carry) {
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
    const bossTilesNow = () => (!s.boss ? [] : s.boss.kind === "rhino" ? bodyTiles(s.boss.bx, s.boss.by) : I().bossTiles);
    const bossAt = t => !!s.boss && s.boss.st !== BS.DEAD && bossTilesNow().includes(t);
    const freeFor = (p, t) => t >= 0 && walkable(I(), s.bits, s.heroes[p].pet, t) && !bossAt(t);

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
    // falling rocks (1-4 every other round, 2-4 / 3-4 phase 2): ADV_ROCKS tiles near the pets,
    // never on a pet that is striking the core
    function rocksStart() {
      const R = I(), cand = [];
      for (let t = 0; t < COLS * ROWS; t++) {
        if (!floorish(R, s.bits, t) || bossAt(t)) continue;
        if ([0, 1].some(p => busy(p) && s.heroes[p].pos === t)) continue;
        const nearPet = [0, 1].some(p => !busy(p) && Math.abs(s.heroes[p].pos % COLS - t % COLS) <= 2 && Math.abs(((s.heroes[p].pos / COLS) | 0) - ((t / COLS) | 0)) <= 2);
        if (nearPet) cand.push(t);
      }
      s.rocks = [NONE, NONE, NONE, NONE];
      for (let k = 0; k < Math.min(P.rocks, 4) && cand.length; k++) s.rocks[k] = cand.splice(api.randInt(cand.length), 1)[0];
    }
    // -> false when that ended the run (team down)
    function rocksLand() {
      ev(EV.ROCK);
      for (let p = 0; p < 2; p++) if (s.rocks.includes(s.heroes[p].pos)) { hurt(p, -1); if (s.phase !== PH.PLAY) return false; }
      s.rocks = [NONE, NONE, NONE, NONE];
      return true;
    }
    function stunStart(ms) {
      const b = s.boss;
      b.st = BS.STUN; b.until = s.t + ms; b.stunEnd = b.until; b.stunTgt = b.tgt;
      b.window = (b.window + 1) & 0xff; s.trialSeed = api.randInt(256);
      ev(EV.STUN, 0, b.window);
    }
    // 1-4 Stone Warden (§6.6)
    function wardenTick() {
      const b = s.boss;
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
        rocksStart();
        b.st = BS.ROCK_TELE; b.until = s.t + P.rockTeleMs;
      } else if (b.st === BS.ROCK_TELE && s.t >= b.until) {
        if (!rocksLand()) return;
        b.st = BS.IDLE; b.until = s.t + P.bossIdleMs;
      } else if (b.st === BS.DEAD && s.t >= b.until) {
        s.phase = PH.CLEAR; ev(EV.CLEAR); api.nextStep();
        if (api.rank) api.rank.submit(0x20 | (s.world === NONE ? 0 : s.world), [{who: [0, 1], value: (s.totalMs / 100) | 0, pets: s.heroes.map(h => h.pet)}]);   // today's leaderboard, keyed by world (§9.2; only World 1 has a board while RANK_MAX_BOARDS = 4)
      }
    }
    // 2-4 Idol: idle -> lock on the nearest pet (3x3 around it) -> slam -> stun (only the
    // other pet, on one of the 2 tiles behind it, may strike); it turns toward the target
    // every ADV_IDOL_FACE_MS while locking and stunned. Phase 2: shorter lock + rocks after each stun.
    function idolTick() {
      const b = s.boss;
      if ((b.st === BS.TELE || b.st === BS.STUN) && s.t >= b.faceAt) {
        b.faceAt = s.t + P.idolFaceMs; b.face = idolFace(b.bx, b.by, s.heroes[b.tgt].pos, b.face);
      }
      if (b.st === BS.SLEEP && s.t >= b.until) { b.st = BS.IDLE; b.until = s.t + P.idolIdleMs; ev(EV.WAKE); }
      else if (b.st === BS.IDLE && s.t >= b.until) {
        const d0 = distBody(b.bx, b.by, s.heroes[0].pos), d1 = distBody(b.bx, b.by, s.heroes[1].pos);
        if (b.round === 0) b.tgt = d1 < d0 ? 1 : 0;
        else if (d0 !== d1) b.tgt = d0 < d1 ? 0 : 1;               // a tie keeps the last target
        b.round++;
        b.face = idolFace(b.bx, b.by, s.heroes[b.tgt].pos, b.face); b.faceAt = s.t + P.idolFaceMs;
        b.area = s.heroes[b.tgt].pos;                               // fixed when the lock starts
        b.st = BS.TELE; b.until = s.t + (b.phase2 ? P.idolLock2Ms : P.idolLockMs);
      } else if (b.st === BS.TELE && s.t >= b.until) {
        const c = b.area;
        ev(EV.SLAM);
        for (let p = 0; p < 2; p++) {
          const t = s.heroes[p].pos;
          if (Math.abs(c % COLS - t % COLS) <= 1 && Math.abs(((c / COLS) | 0) - ((t / COLS) | 0)) <= 1) { hurt(p, -1); if (s.phase !== PH.PLAY) return; }
        }
        b.area = NONE;
        stunStart(P.idolStunMs);
      } else if (b.st === BS.STUN && s.t >= b.until) {
        if (b.phase2 && P.rocks > 0) { b.st = BS.ROCK_WAIT; b.graceUntil = s.t + P.coreGraceMs; }
        else { b.st = BS.IDLE; b.until = s.t + P.idolIdleMs; }
      } else if (b.st === BS.ROCK_WAIT && ((!busy(0) && !busy(1)) || s.t >= b.graceUntil)) {
        rocksStart();
        b.st = BS.ROCK_TELE; b.until = s.t + P.rockTeleMs;
      } else if (b.st === BS.ROCK_TELE && s.t >= b.until) {
        if (!rocksLand()) return;
        b.st = BS.IDLE; b.until = s.t + P.idolIdleMs;
      } else if (b.st === BS.DEAD && s.t >= b.until) {
        s.phase = PH.CLEAR; ev(EV.CLEAR); api.nextStep();
      }
    }
    // 3-4 Rhino: track the target's column (1 column per ADV_RHINO_TRACK_STEP_MS until that
    // column is under its body) -> lane warning -> charge down 1 row per ADV_RHINO_CHARGE_STEP_MS
    // -> rock: stun / wall: bonk -> dust, jump back to row 0 -> next round (the other pet).
    function startTrack() {
      const b = s.boss;
      if (b.round > 0) b.tgt ^= 1;
      b.round++;
      b.st = BS.IDLE; b.until = s.t + P.rhinoTrackMs; b.trackEnd = s.t + P.rhinoTrackMaxMs; b.alignedAt = -1; b.nextStep = s.t;
      b.lane = -1; b.land = NONE; b.landRock = false;
    }
    function rhinoTick() {
      const b = s.boss, R = I();
      if (b.st === BS.SLEEP) { if (s.t >= b.until) { ev(EV.WAKE); startTrack(); } return; }
      if (b.st === BS.IDLE) {
        if (s.t >= b.nextStep) {
          b.nextStep = s.t + P.rhinoTrackStepMs;
          const tx = s.heroes[b.tgt].pos % COLS;
          const d = tx < b.bx ? -1 : tx > b.bx + 1 ? 1 : 0;
          if (d) {
            const nx = d > 0 ? b.bx + 2 : b.bx - 1, nt = [b.by * COLS + nx, (b.by + 1) * COLS + nx];
            let ok = nt.every(t => chAt(R, t) !== "#");
            // a pet in the two tiles it moves into: 1 heart, pushed 1 tile on; cannot be pushed -> it waits
            for (let p = 0; p < 2 && ok; p++) {
              if (!nt.includes(s.heroes[p].pos)) continue;
              const push = stepTile(s.heroes[p].pos, d > 0 ? 1 : 3);
              hurt(p, -1);
              if (s.phase !== PH.PLAY) return;
              if (freeFor(p, push)) s.heroes[p].pos = push; else ok = false;
            }
            if (ok) b.bx += d;
          }
        }
        // lock once lined up for ADV_RHINO_SETTLE_MS after ADV_RHINO_TRACK_MS, or at TRACK_MAX_MS anyway
        const tx = s.heroes[b.tgt].pos % COLS, aligned = tx === b.bx || tx === b.bx + 1;
        if (!aligned) b.alignedAt = -1; else if (b.alignedAt < 0) b.alignedAt = s.t;
        if ((aligned && s.t >= b.until && s.t - b.alignedAt >= P.rhinoSettleMs) || s.t >= b.trackEnd) {
          b.st = BS.TELE; b.lane = b.bx;
          // landing: scan down until the next row has a rock (#) in the lane or is outside the room (wall)
          let y = b.by;
          while (y + 2 < ROWS && chAt(R, (y + 2) * COLS + b.lane) !== "#" && chAt(R, (y + 2) * COLS + b.lane + 1) !== "#") y++;
          b.land = y * COLS + b.lane; b.landRock = y + 2 < ROWS;
          b.until = s.t + (b.phase2 ? P.rhinoAim2Ms : P.rhinoAimMs);
        }
        return;
      }
      if (b.st === BS.TELE && s.t >= b.until) { b.st = BS.CHARGE; b.nextStep = s.t; }
      if (b.st === BS.CHARGE) {
        if (s.t < b.nextStep) return;
        b.nextStep = s.t + P.rhinoChargeStepMs;
        if (b.by * COLS + b.bx === b.land) {
          b.land = NONE;
          if (b.landRock) { ev(EV.SLAM); stunStart(P.rhinoStunMs); }
          else { b.st = BS.BONK; b.until = s.t + P.rhinoBonkMs; ev(EV.BONK); }
          return;
        }
        b.by++;
        // pets in the new bottom row (or under the body): 1 heart, knocked out of the lane
        // (left column -> left first, right column -> right first; neither free -> stays)
        const row = [(b.by + 1) * COLS + b.bx, (b.by + 1) * COLS + b.bx + 1], body = bossTilesNow();
        for (let p = 0; p < 2; p++) {
          const h = s.heroes[p];
          if (!row.includes(h.pos) && !body.includes(h.pos)) continue;
          hurt(p, -1);
          if (s.phase !== PH.PLAY) return;
          const y = (h.pos / COLS) | 0;
          const l = b.bx - 1 >= 0 ? y * COLS + b.bx - 1 : -1, r = b.bx + 2 < COLS ? y * COLS + b.bx + 2 : -1;
          const to = (h.pos % COLS === b.bx ? [l, r] : [r, l]).find(t => t >= 0 && freeFor(p, t));
          if (to != null) h.pos = to;
        }
        return;
      }
      if (b.st === BS.STUN && s.t >= b.until) {
        if (b.phase2 && P.rocks > 0) { b.st = BS.ROCK_WAIT; b.graceUntil = s.t + P.coreGraceMs; }
        else { b.st = BS.RETURN; b.until = s.t + P.rhinoJumpMs; }
      } else if (b.st === BS.BONK && s.t >= b.until) { b.st = BS.RETURN; b.until = s.t + P.rhinoJumpMs; }
      else if (b.st === BS.ROCK_WAIT && ((!busy(0) && !busy(1)) || s.t >= b.graceUntil)) {
        rocksStart();
        b.st = BS.ROCK_TELE; b.until = s.t + P.rockTeleMs;
      } else if (b.st === BS.ROCK_TELE && s.t >= b.until) {
        if (!rocksLand()) return;
        b.st = BS.RETURN; b.until = s.t + P.rhinoJumpMs;
      } else if (b.st === BS.RETURN && s.t >= b.until) {
        // jump back to row 0 (same columns); a pet on the 4 new body tiles goes straight down to row 2+ (no damage)
        b.by = 0;
        const body = bossTilesNow();
        for (let p = 0; p < 2; p++) {
          const h = s.heroes[p];
          if (!body.includes(h.pos)) continue;
          const x = h.pos % COLS;
          let y = 2;
          while (y < ROWS - 1 && !freeFor(p, y * COLS + x)) y++;
          h.pos = y * COLS + x;
        }
        startTrack();
      } else if (b.st === BS.DEAD && s.t >= b.until) {
        s.phase = PH.CLEAR; ev(EV.CLEAR); api.nextStep();
      }
    }
    function bossTick() {
      const b = s.boss;
      if (!b) return;
      if (b.kind === "idol") idolTick();
      else if (b.kind === "rhino") rhinoTick();
      else wardenTick();
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
      const R = I(), b = s.boss, pick = s.phase === PH.PICK;
      const heroes = s.heroes.map((h, p) => {
        let f = (pick ? (s.picks[p] === NONE ? 3 : s.picks[p]) : h.pet) & 3;
        if (s.t < h.hurtUntil) f |= PF.HURT;
        if (busy(p)) f |= PF.BUSY;
        if (s.winching[p]) f |= PF.WINCH;
        if (!pick && R.exits.includes(h.pos)) f |= PF.EXIT;
        // PICK: dir_anim = this player's world vote + 1 (0 = none)
        const dirAnim = pick ? (s.wvote[p] === NONE ? 0 : s.wvote[p] + 1) : (h.dir & 3) | ((h.steps & 63) << 2);
        return {pos: pick ? NONE : h.pos, dirAnim, petFlags: f};
      });
      const enemies = s.slimes.map(e => e ? {pos: e.pos, hpType: 0x10 | Math.min(15, e.hp), state: (e.dir & 3) | ((e.steps & 63) << 2)} : {pos: NONE, hpType: 0, state: 0});
      let bossState = 0, bossTarget = NONE;
      if (b) {
        if (b.kind === "warden") {
          if (b.st === BS.TELE && b.targets[1] !== NONE) enemies[0] = {pos: b.targets[1], hpType: 0x20, state: 0};
          bossTarget = b.st === BS.TELE ? b.targets[0] : NONE;
        } else if (b.kind === "idol") {
          // enemies[3] = the Idol: top-left, 0x50 | target, facing
          enemies[3] = {pos: b.by * COLS + b.bx, hpType: 0x50 | (b.tgt & 1), state: b.face & 3};
          bossTarget = b.st === BS.TELE ? b.area : NONE;
        } else {
          // enemies[3] = the Rhino: top-left, 0x40 | target, lane column | rock ahead (bit 4)
          enemies[3] = {pos: b.by * COLS + b.bx, hpType: 0x40 | (b.tgt & 1), state: (b.lane >= 0 ? b.lane & 15 : 0) | (b.landRock ? 16 : 0)};
          bossTarget = b.st === BS.TELE || b.st === BS.CHARGE ? b.land : NONE;
        }
        const left = Math.max(0, b.until - s.t);
        bossState = b.st | (Math.min(7, Math.ceil(left / 500)) << 4) | (b.phase2 ? 0x80 : 0);
      }
      return {
        phase: s.phase, flags: 0, room: pick ? (s.world === NONE ? NONE : s.world * RPW) : s.room,
        countdownDs: Math.min(255, Math.ceil(s.countdownMs / 100)),
        roomMs10: ((s.roomMs / 10) | 0) & 0xffff, totalDs: Math.min(65535, (s.totalMs / 100) | 0), hearts: s.hearts,
        heroes, shrinePet: s.shrine === NONE ? NONE : s.shrine, objBits: s.bits & 0xffff, cratePos: s.crates.slice(),
        enemies, bossHp: b ? b.hp : 0, bossState, bossTarget,
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
        // ADV_PICK(0x10 + world): vote for a world (0x1f = take the vote back); the same vote from both starts the pet pick
        if (arg !== NONE && (arg & 0xf0) === 0x10) {
          if (s.world !== NONE) return false;
          const w = arg & 0x0f;
          if (w === 0x0f) { s.wvote[p] = NONE; return true; }
          if (w >= WORLDS) return false;
          s.wvote[p] = w;
          if (s.wvote[0] === s.wvote[1]) { s.world = w; ev(EV.WORLD, p, w); api.nextStep(); }
          return true;
        }
        if (s.world === NONE) return false;
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
    // up to ADV_CORE_GRACE_MS after the stun, once per player per window; also while paused.
    // Idol / Rhino: never from the pet that was the target of that window.
    function core(p, score, w) {
      const b = s.boss;
      if (!b || b.st === BS.DEAD || s.phase !== PH.PLAY || score > 100) return false;
      if (w !== b.window || b.hit[p] === w) return false;
      if (!(b.st === BS.STUN || s.t <= b.stunEnd + P.coreGraceMs)) return false;
      if (b.kind !== "warden" && p === b.stunTgt) return false;
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
      if (!b.phase2 && b.hp <= bossPhase2(P, b.kind)) b.phase2 = true;
      if (b.hp === 0) {
        b.st = BS.DEAD; b.until = s.t + 1200; b.targets = [NONE, NONE]; s.rocks = [NONE, NONE, NONE, NONE];
        b.area = NONE; b.land = NONE; b.lane = -1;
      }
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
          const st = stars(P, s.phase, (s.totalMs / 100) | 0, s.hearts, s.world === NONE ? 0 : s.world).filter(Boolean).length;
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
      // REMATCH arg 1: after a world's boss -> the next world (same pets); otherwise retry this room
      carry: () => (s.phase === PH.CLEAR && s.world !== NONE && s.world + 1 < WORLDS
        ? {next: true, world: s.world + 1, pets: s.heroes.map(h => h.pet), shrine: s.shrine}
        : {room: s.room, totalMs: s.totalMs, gems: s.gems, gemMask: s.gemMask, heartMask: s.heartMask,
          pets: s.heroes.map(h => h.pet), shrine: s.shrine, coreDmg: s.coreDmg.slice(), winchMs: s.winchMs.slice()}),
      // DEVICE.debug(cmd, arg): fixtures and tests
      debug(cmd, arg) {
        if (cmd === "room" && s.phase !== PH.PICK) { s.phase = PH.PLAY; enterRoom(arg | 0, false); }
        else if (cmd === "world") {
          // PICK: both vote world arg; in a room: jump to that world's first room
          const w = Math.max(0, Math.min(WORLDS - 1, arg | 0));
          if (s.phase === PH.PICK) { s.wvote = [w, w]; s.world = w; api.nextStep(); }
          else { s.phase = PH.PLAY; enterRoom(w * RPW, false); }
        }
        else if (cmd === "pick") { if (s.world === NONE) s.world = 0; s.picks = [arg >> 4 & 3, arg & 3]; startPlay(); }
        else if (cmd === "hearts") s.hearts = arg | 0;
        else if (cmd === "bossHp" && s.boss) s.boss.hp = arg | 0;
        else if (cmd === "stun" && s.boss) {
          if (s.boss.kind === "warden") { s.boss.st = BS.TELE; s.boss.until = s.t; s.boss.targets = [NONE, NONE]; }
          else { s.boss.land = NONE; s.boss.area = NONE; stunStart(s.boss.kind === "idol" ? P.idolStunMs : P.rhinoStunMs); }
        }
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
  // the boss as the state shows it: kind, top-left tile, target (Idol / Rhino), facing, lane
  function bossView(st) {
    const I = INFO[st.room], kind = I.bossType || "warden", e = st.enemies[3];
    const own = e && (e.hpType >> 4) === (kind === "idol" ? 5 : 4);
    const pos = kind !== "warden" && own ? e.pos : Math.min(...I.bossTiles);
    return {kind, pos, x: pos % COLS, y: (pos / COLS) | 0, tgt: kind !== "warden" && own ? e.hpType & 1 : NONE,
      face: own ? e.state & 3 : 2, lane: own ? e.state & 15 : -1, rock: own && (e.state & 16) !== 0};
  }
  // tiles from which a core strike may start (Warden: the 8 around it; Idol: the 2 behind it;
  // Rhino: the 8 around it except rocks)
  function strikeTiles(st) {
    const v = bossView(st), I = INFO[st.room];
    if (v.kind === "warden") return BOSS_ADJ;
    if (v.kind === "idol") return backTiles(v.x, v.y, v.face);
    return adjTiles(v.x, v.y).filter(t => chAt(I, t) !== "#");
  }
  const bossTilesOf = st => { const v = bossView(st); return bodyTiles(v.x, v.y); };
  function canStrike(ctx) {
    const m = ctx.m, st = ctx.state;
    if (!m || !st || st.phase !== PH.PLAY || st.countdownDs > 0 || m.trial || !INFO[st.room].boss) return false;
    const b = bossInfo(st), v = bossView(st);
    if (v.kind !== "warden" && v.tgt === ctx.p) return false;      // the bait never strikes
    return b.st === BS.STUN && strikeTiles(st).includes(st.heroes[ctx.p].pos) && m.struckWindow !== st.bossWindow;
  }
  // Idol / Rhino: I am the one it is after (hint "Bait")
  function amBait(ctx) {
    const st = ctx.state;
    if (!st || st.phase !== PH.PLAY || !INFO[st.room].boss) return false;
    const v = bossView(st), b = bossInfo(st);
    if (v.kind === "warden" || v.tgt !== ctx.p) return false;
    return v.kind === "idol" ? b.st === BS.TELE || b.st === BS.STUN
      : b.st === BS.IDLE || b.st === BS.TELE || b.st === BS.CHARGE || b.st === BS.STUN;
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
    const kind = INFO[st.room].bossType;
    if (kind === "idol") return drawIdol(g, ctx, st);
    if (kind === "rhino") return drawRhino(g, ctx, st);
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
  // 2-4 Idol: 3 frames (down = the eye, up = its back, side mirrored); the 2 tiles behind it
  // get a gold frame while it is stunned (static, redrawn when it turns: <= 4 Hz)
  function drawIdol(g, ctx, st) {
    const b = bossInfo(st), v = bossView(st), x = tileX(v.pos), y = tileY(v.pos), P = params(ctx);
    const side = v.face === 1 || v.face === 3;
    const spr = side ? "adv.idolSide" : "adv.idol", base = {frame: v.face === 0 ? 1 : 0, flipX: v.face === 3};
    if (b.st === BS.DEAD) {
      if (blink(ctx, 6)) g.sprite(spr, x, y, Object.assign({color: "line"}, base));
      return;
    }
    const map = {};
    if (b.st === BS.TELE) map.e = "danger";
    if (b.st === BS.SLEEP || b.st === BS.STUN) { map.e = "line"; map.w = "muted"; }
    if (b.st === BS.STUN) map.c = blink(ctx, 3) ? "gold" : "fire";
    g.sprite(spr, x, y, Object.assign({map}, base));
    if (b.phase2) { g.px(x + 6, y + 4, "void"); g.px(x + 7, y + 5, "void"); g.px(x + 7, y + 6, "void"); g.px(x + 17, y + 17, "void"); g.px(x + 16, y + 18, "void"); }
    if (b.st === BS.STUN) {
      for (const t of backTiles(v.x, v.y, v.face)) g.frame(tileX(t), tileY(t), TS, TS, "gold");
      g.text(x + 12, y - 12, "z", {font: "s", c: "gold", align: "c"});
    }
    D.ui.hpBar(g, x - 6, OY + 2, 36, st.bossHp, P.idolHp, {h: 4});
    if (b.st === BS.STUN) g.hline(x - 5, OY + 7, Math.round(34 * Math.min(1, b.left * 500 / P.idolStunMs)), "gold");
  }
  // 3-4 Rhino: tweens 250 ms per column while tracking, 100 ms per row while charging, jumps back
  // in one go. The lane is drawn once (static dither), only the 2 x 2 landing blinks at 4 Hz.
  function drawRhino(g, ctx, st) {
    const b = bossInfo(st), v = bossView(st), P = params(ctx), m = ctx.m, now = ctx.now();
    const dur = b.st === BS.CHARGE ? P.rhinoChargeStepMs : b.st === BS.IDLE ? P.rhinoTrackStepMs : 0;
    let [x, y] = tweenPos(m, "boss", v.pos, now, dur);
    if ((b.st === BS.TELE || b.st === BS.CHARGE) && st.bossTarget !== NONE) {
      const ly = (st.bossTarget / COLS) | 0, lx = st.bossTarget % COLS;
      for (let ry = v.y + 2; ry <= ly + 1 && ry < ROWS; ry++) for (let cx = lx; cx <= lx + 1; cx++) {
        if (ry >= ly) { if (blink(ctx, 4)) g.dither(OX + cx * TS, OY + ry * TS, TS, TS, "danger", null); }
        else g.dither(OX + cx * TS, OY + ry * TS, TS, TS, "danger", null);
      }
    }
    if (b.st === BS.DEAD) {
      if (blink(ctx, 6)) g.sprite("adv.rhino", x, y, {color: "line"});
      return;
    }
    const map = {};
    if (b.st === BS.TELE || b.st === BS.CHARGE) map.e = "danger";
    if (b.st === BS.SLEEP || b.st === BS.STUN || b.st === BS.BONK) map.e = "line";
    if (b.st === BS.STUN) map.h = blink(ctx, 3) ? "gold" : "fire";
    if (b.st === BS.BONK) x += blink(ctx, 8) ? 1 : -1;
    g.sprite("adv.rhino", x, y, {map, frame: b.st === BS.CHARGE ? 1 : 0});
    if (b.phase2) { g.px(x + 6, y + 6, "void"); g.px(x + 7, y + 7, "void"); g.px(x + 17, y + 12, "void"); g.px(x + 16, y + 13, "void"); }
    if (b.st === BS.RETURN && blink(ctx, 4)) g.dither(x, y, 24, 24, "muted", null);
    if (b.st === BS.STUN || b.st === BS.BONK) g.text(x + 12, y + 1, "z", {font: "s", c: "gold", align: "c"});
    // HP bar in row 8 between the rocks (the body starts in rows 0-1)
    const hx = OX + 3 * TS, hy = OY + 8 * TS + 7;
    D.ui.hpBar(g, hx, hy, 48, st.bossHp, P.rhinoHp, {h: 4});
    if (b.st === BS.STUN) g.hline(hx + 1, hy - 2, Math.round(46 * Math.min(1, b.left * 500 / P.rhinoStunMs)), "gold");
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
      if (b.st === BS.TELE && blink(ctx, 4) && I.bossType !== "rhino") {
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
    else if (amBait(ctx)) first = ["STICK", "dev.adv.hintBait", "gold"];
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

  // S11a world vote (before the pet pick): like S07, each player votes, the same vote from both
  // starts that world; S = take the partner's vote. Cards show this profile's best stars per world.
  const WCARD_Y = [16, 50, 84];
  const voteOf = (st, p) => (st.heroes[p].dirAnim > 0 && st.heroes[p].dirAnim <= WORLDS ? st.heroes[p].dirAnim - 1 : NONE);
  function bestStars(ctx) {
    const cur = ctx.profiles && ctx.profiles.current ? ctx.profiles.current() : null, pr = cur ? cur.profile : null;
    if (!pr) return [0, 0, 0];
    const w = Array.isArray(pr.advW) ? pr.advW : [pr.advStars | 0, 0, 0];      // before worlds: advStars was World 1
    return [0, 1, 2].map(i => Math.min(3, w[i] | 0));
  }
  D.registerScreen("adv.world", {
    fps: 10,
    toastY: 128,
    enter(ctx) {
      const st = ctx.state, mine = st ? voteOf(st, ctx.p) : NONE;
      ctx.s.sel = mine !== NONE ? mine : 0;
    },
    input(ctx, ev) {
      const st = ctx.state;
      if (!st || st.phase !== PH.PICK || st.room !== NONE) return;
      if (ev.type !== "down" && ev.type !== "repeat") return;
      if (ev.btn === "UP" || ev.btn === "DOWN") { ctx.s.sel = (ctx.s.sel + (ev.btn === "UP" ? -1 : 1) + WORLDS) % WORLDS; ctx.sfx("ui_move"); return; }
      if (ev.type !== "down") return;
      const mine = voteOf(st, ctx.p), theirs = voteOf(st, 1 - ctx.p);
      if (ev.btn === "A") {
        if (mine === ctx.s.sel) return;
        ctx.rt(A.ADV_PICK, 0x10 | ctx.s.sel); ctx.sfx("ui_ok");
      } else if (ev.btn === "SKILL") {
        if (theirs === NONE || theirs === mine) return;
        ctx.s.sel = theirs; ctx.rt(A.ADV_PICK, 0x10 | theirs); ctx.sfx("ui_ok");
      } else if (ev.btn === "B" && mine !== NONE) { ctx.rt(A.ADV_PICK, 0x1f); ctx.sfx("ui_back"); }
    },
    draw(ctx, g) {
      const st = ctx.state;
      D.ui.topBar(g, ctx, "dev.adv.worldTitle", {signal: false});
      if (!st) return;
      const mine = voteOf(st, ctx.p), theirs = voteOf(st, 1 - ctx.p), best = bestStars(ctx);
      const myC = ctx.color(), cols = teamColors(ctx), rvC = cols[1 - ctx.p];
      for (let w = 0; w < WORLDS; w++) {
        const y = WCARD_Y[w];
        g.frame(4, y, 120, 32, "line");
        if ((ctx.s.sel | 0) === w) g.frame(4, y, 120, 32, "accent", 2);
        g.sprite(WORLD_ICONS[w], 9, y + 4);
        g.text(38, y + 3, ctx.t("dev.adv.world", {n: w + 1}), {w: 60, key: "dev.adv.world"});
        g.text(38, y + 17, ctx.t(WORLD_SUBS[w]), {w: 56, c: "muted", key: WORLD_SUBS[w]});
        for (let k = 0; k < 3; k++) g.sprite("icon.STAR", 96 + 9 * k, y + 21, {color: k < best[w] ? "gold" : "line"});
        if (mine === w) g.sprite("icon.OK", 102, y + 5, {color: myC});
        if (theirs === w) g.sprite("icon.OK", 112, y + 5, {color: rvC});
      }
      const name = theirs !== NONE ? ctx.t("dev.adv.world", {n: theirs + 1}) : "";
      if (theirs !== NONE) g.text(4, 118, ctx.t("dev.adv.partnerWorld", {world: name}), {w: 120, c: "muted", key: "dev.adv.partnerWorld"});
      else g.text(4, 118, ctx.t("dev.adv.partnerPicking"), {w: 120, c: "muted", key: "dev.adv.partnerPicking"});
      D.ui.hintBar(g, ctx, [["A", "dev.menu.hintVote"], theirs !== NONE && theirs !== mine ? ["S", "dev.menu.hintAgree"] : null,
        mine !== NONE ? ["B", "dev.menu.hintUndo"] : null]);
    },
  });

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
        badgeKey: st.room !== NONE ? "dev.adv.world" : null, badgeVars: {n: st.room !== NONE ? worldOf(st.room) + 1 : 1},
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
          if (INFO[st.room].boss && bossTilesOf(st).includes(f) && bossInfo(st).st !== BS.STUN) ctx.sfx("ui_deny");
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
      case EV.BONK: ctx.hw.shake(); ctx.sfx("ui_deny"); break;
      case EV.WORLD: ctx.sfx("ui_ok"); break;
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
      if (st.phase === PH.PICK) return st.room === NONE ? "adv.world" : "adv.pick";
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
      const world = st && st.room !== NONE && st.room < INFO.length ? worldOf(st.room) : 0;
      const got = stars(P, phase, totalDs, hearts, world);
      const n = got.filter(Boolean).length;
      const secs = (totalDs / 10) | 0;
      const time = Math.floor(secs / 60) + ":" + String(secs % 60).padStart(2, "0");
      const cd = st ? st.coreDmg : [0, 0], wd = st ? st.winchDs : [0, 0];
      const title = phase === PH.CLEAR ? "dev.adv.res.clear" : phase === PH.TEAM_DOWN ? "dev.adv.teamDown" : "dev.adv.res.gaveUp";
      const totalGems = INFO.filter(I => I.world === world && I.gem >= 0).length;
      // after a world's boss: A = next world (REMATCH arg 1, the central's carry() says next: true)
      const next = phase === PH.CLEAR && world + 1 < WORLDS;
      const again = phase === PH.TEAM_DOWN ? {labelKey: "dev.res.hintRetry", kind: "retryRoom"}
        : next ? {labelKey: "dev.adv.hintNext", kind: "retryRoom", partnerKey: "dev.adv.partnerNext",
          lineKey: "dev.adv.nextWorld", lineVars: {world: ctx.t("dev.adv.world", {n: world + 2})}}
        : {labelKey: "dev.ui.again", kind: "rematch"};
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
        again,
        stats: phase === PH.CLEAR ? {advStars: n, advWorld: world} : {},
        win: phase === PH.CLEAR ? true : phase === PH.TEAM_DOWN ? false : null,
        sfx: phase === PH.CLEAR ? "adv_clear" : phase === PH.TEAM_DOWN ? "team_down" : undefined,
      };
    },
  };

  /* ================= bot: a co-op partner that only reads its own board ================= */

  // PLANS-BEGIN (generated from the judge's solver paths: levels/adv/impl/make_plans.js)
  const PLANS = {
    4: {   // dev.adv.room5
      "10": "m22|m27 m23|m26 m24|m25 m34|m35 m44|m45 a3@44|a1@45 m43|m46 m42|m47 m41|m48 a3@41|a1@48 m42|m47 m43|m46 m44|m45 m34|m35 m24|m25 m14|m15 m4|m5",
      "12": "m22|m27 m23|m26 m24|m25 m34|m35 m44|m45 m54|m55 m64|m65 s@64|m64 m54|s@64 m44|m54 m45|m44 a1@45|a3@44 m46|m43 m47|m42 m48|m41 a1@48|a3@41 m47|m42 m46|m43 m45|m44 m35|m34 m25|m24 m15|m14 m5|m4",
      "20": "m22|. m23|. m24|. m34|. m44|. m54|m27 m64|m26 s@64|m25 m54|m35 m44|m45 a3@44|a1@45 m43|m46 m42|m47 m41|m48 a3@41|a1@48 m42|m47 m43|m46 m44|m45 m34|m35 m24|m25 m14|m15 m4|m5",
      "21": "m22|. m23|. m24|. m34|. m44|. m54|m27 m64|m26 s@64|m25 m54|m35 m44|m45 m45|m44 a1@45|a3@44 m46|m43 m47|m42 m48|m41 a1@48|a3@41 m47|m42 m46|m43 m45|m44 m35|m34 m25|m24 m15|m14 m5|m4",
      "01": "m22|m27 m23|m26 m24|m25 m25|m35 m35|m45 m45|m44 a1@45|a3@44 m46|m43 m47|m42 m48|m41 a1@48|a3@41 m47|m42 m46|m43 m45|m44 m35|m34 m25|m24 m15|m14 m5|m4",
      "02": ".|m27 .|m26 .|m25 .|m35 .|m45 m22|m55 m23|m65 m24|m64 m25|s@64 m35|m54 m45|m44 a1@45|a3@44 m46|m43 m47|m42 m48|m41 a1@48|a3@41 m47|m42 m46|m43 m45|m44 m35|m34 m25|m24 m15|m14 m5|m4",
    },
    5: {   // dev.adv.room6
      "10": ".|m17 .|m16 .|m15 m2|m14 m3|m13 m13|a2@13 m23|. m33|. m34|. m35|. m45|. s@45|. m35|m23 a3@35|m33 m45|m34 s@45|m35 m55|m45 a3@55|m55 m54|m54 m53|m53 m63|m63 m73|m73 m83|m83",
      "12": ".|m17 .|m16 .|m15 .|m14 .|m13 .|m23 .|m33 .|a1@33 .|m34 .|m35 .|m45 .|s@45 .|m35 m2|m34 m3|m33 m13|a0@33 m23|. m33|. m34|. m35|m34 m45|m35 m55|m45 a3@55|m55 m54|m54 m53|m53 m63|m63 m73|m73 m83|m83",
      "20": "m2|m17 m3|m16 m13|m15 m23|m14 m33|m13 a1@33|a2@13 m34|m23 m35|m33 m45|m34 s@45|m35 m55|m45 a3@55|m55 m54|m54 m53|m53 m63|m63 m73|m73 m83|m83",
      "21": "m2|. m3|. m13|. m23|. m33|. a1@33|. m34|. m35|. m45|. s@45|m17 m35|m16 m34|m15 m33|m14 a0@33|m13 .|m23 .|m33 .|m34 m34|m35 m35|m45 m45|m55 m55|a3@55 m54|m54 m53|m53 m63|m63 m73|m73 m83|m83",
      "01": ".|m17 m2|m16 m3|m15 m13|m14 a2@13|m13 .|m23 .|m33 .|m34 .|m35 .|m45 .|s@45 m23|m35 m33|a3@35 m34|m45 m35|s@45 m45|m55 m55|a3@55 m54|m54 m53|m53 m63|m63 m73|m73 m83|m83",
      "02": ".|m17 .|m16 .|m15 .|m14 m2|m13 m3|m23 m13|m33 a2@13|a1@33 m23|m34 m33|m35 m34|m45 m35|s@45 m45|m55 m55|a3@55 m54|m54 m53|m53 m63|m63 m73|m73 m83|m83",
    },
    6: {   // dev.adv.room7
      "10": ".|m17 m2|m16 m3|m15 m13|s@15 s@13|. m23|. m22|m16 m21|m17 a2@21|m27 m11|a2@27 m12|m17 m13|m16 s@13|m15 m23|s@15 m22|m16 m21|m17 m31|m27 m41|m37 a2@41|m47 m51|a2@47 m61|m57 m71|m67 m81|m77 m82|m87 m83|m86 m84|m85",
      "12": "m2|. m3|. m13|. s@13|. m23|. m22|. m21|m17 a2@21|m27 m11|a2@27 m12|m17 m13|m16 s@13|m15 m23|s@15 m22|m16 m21|m17 m31|m27 m41|m37 a2@41|m47 m51|a2@47 m61|m57 m71|m67 m81|m77 m82|m87 m83|m86 m84|m85",
      "20": ".|m17 m2|m16 m3|m15 m13|s@15 s@13|. m23|s@15 m22|m16 m21|m17 a2@21|m27 m11|a2@27 m12|m17 m13|m16 s@13|m15 m23|s@15 m22|m16 m21|m17 m31|m27 m41|m37 a2@41|m47 m51|a2@47 m61|m57 m71|m67 m81|m77 m82|m87 m83|m86 m84|m85",
      "21": "m2|. m3|m17 m13|m16 s@13|m15 m23|s@15 m22|m16 m21|m17 a2@21|m27 m11|a2@27 m12|m17 m13|m16 s@13|m15 m23|s@15 m22|m16 m21|m17 m31|m27 m41|m37 a2@41|m47 m51|a2@47 m61|m57 m71|m67 m81|m77 m82|m87 m83|m86 m84|m85",
      "01": ".|m17 .|m16 .|m15 .|s@15 m11|m16 m21|m17 a2@21|m27 m11|a2@27 m12|m17 m13|m16 s@13|m15 m23|s@15 m22|m16 m21|m17 m31|m27 m41|m37 a2@41|m47 m51|a2@47 m61|m57 m71|m67 m81|m77 m82|m87 m83|m86 m84|m85",
      "02": "m11|. m21|m17 a2@21|m27 m11|a2@27 m12|m17 m13|m16 s@13|m15 m23|s@15 m22|m16 m21|m17 m31|m27 m41|m37 a2@41|m47 m51|a2@47 m61|m57 m71|m67 m81|m77 m82|m87 m83|m86 m84|m85",
    },
    8: {   // dev.adv.room9
      "10": "m2|. m12|. m22|. m32|. m42|. m52|m65 m62|m55 m72|h0@55 m73|. m74|. m64|. m54|. m44|. m34|. m24|. m14|. m4|. m5|h0@55 m6|. m7|. m8|. m9|. m19|. m29|. m39|m54 m49|m44 m59|m34 m69|m24 m79|m14 m89|m4 m79|m5 m69|m6 m59|m7 m49|. m39|. m29|m8 m19|m9",
      "12": "m2|. m12|. m22|. m32|. m42|m65 m52|m55 m62|h0@55 m72|m54 m73|m44 m74|m34 m64|m24 m54|m14 m44|m4 h1@44|m5 .|m6 .|m7 .|m8 .|m9 .|m19 .|m29 .|m39 .|m49 .|a2@49 m34|m59 m24|m69 m14|m79 m4|m89 m5|m79 m6|m69 m7|m59 .|m49 .|m39 m8|m29 m9|m19",
      "20": "m2|. m12|. m22|. m32|. m42|. m52|m65 m62|m55 m72|h0@55 m73|. m74|. m64|. m54|. m44|. m34|. m24|. m14|. m4|. m5|h0@55 m6|. m7|. m8|. m9|. m19|. m29|. m39|. m49|m54 a2@49|m44 m59|m34 m69|m24 m79|m14 m89|m4 m79|m5 m69|m6 m59|m7 m49|. m39|. m29|m8 m19|m9",
      "21": "m2|. m12|. m22|. m32|. m42|m65 m52|m55 m62|h0@55 m72|m54 m73|m44 m74|m34 m64|m24 m54|m14 m44|m4 h1@44|m5 .|m6 .|m7 .|m8 .|m9 .|m19 .|m29 .|m39 .|m49 m34|m59 m24|m69 m14|m79 m4|m89 m5|m79 m6|m69 m7|m59 .|m49 .|m39 m8|m29 m9|m19",
      "01": "m2|. m12|. m22|. m32|. m42|m65 m52|m55 m62|h0@55 m72|m54 m73|m44 m74|m34 m64|m24 m54|m14 m44|m4 h1@44|m5 .|m6 .|m7 .|m8 .|m9 .|m19 .|m29 .|m39 .|m49 m34|m59 m24|m69 m14|m79 m4|m89 m5|m79 m6|m69 m7|m59 .|m49 .|m39 m8|m29 m9|m19",
      "02": "m2|. m12|. m22|. m32|. m42|m65 m52|m55 m62|h0@55 m72|m54 m73|m44 m74|m34 m64|m24 m54|m14 m44|m4 h1@44|m5 .|m6 .|m7 .|m8 .|m9 .|m19 .|m29 .|m39 .|m49 .|a2@49 m34|m59 m24|m69 m14|m79 m4|m89 m5|m79 m6|m69 m7|m59 .|m49 .|m39 m8|m29 m9|m19",
    },
    9: {   // dev.adv.room10
      "10": "m51|. m41|. m31|. m21|m54 h0@21|m44 m31|m45 m41|m46 m51|m47 m61|. m60|. m70|m48 a2@70|m49 m60|m59 m50|m69 m40|m79 m41|a2@79 m42|. m43|m69 m44|m59 m45|m58 m46|. m47|. m37|m48 m27|m38 m28|m28 m29|m29",
      "12": ".|m54 .|m44 .|m34 m51|m24 m41|m23 m42|m22 m43|m21 m44|h0@21 m45|m31 m46|m41 m47|m51 .|m61 .|m60 m48|a2@60 m49|m70 m59|a2@70 m69|m60 a2@69|m50 m79|m40 a2@79|m41 .|m42 m69|m43 m59|m44 m58|m45 .|m46 .|m47 m48|m37 m38|m27 m28|m28 m29|m29",
      "20": "m51|. m41|. m31|. m21|m54 h0@21|m44 m31|m45 m41|m46 m51|m47 m61|. m60|. a2@60|. m70|m48 a2@70|m49 m60|m59 m50|m69 m40|m79 m41|a2@79 m42|. m43|m69 m44|m59 m45|m58 m46|. m47|. m37|m48 m27|m38 m28|m28 m29|m29",
      "21": "m51|. m41|. m31|. m21|m54 h0@21|m44 m31|m45 m41|m46 m51|m47 m61|. m60|. a2@60|m48 m70|m49 a2@70|m59 m60|m69 m50|a2@69 m40|m79 m41|a2@79 m42|. m43|m69 m44|m59 m45|m58 m46|. m47|. m37|m48 m27|m38 m28|m28 m29|m29",
      "01": ".|m54 .|m44 .|m34 m51|m24 m41|m23 m42|m22 m43|m21 m44|h0@21 m45|m31 m46|m41 m47|m51 .|m61 .|m60 m48|m70 m49|a2@70 m59|m60 m69|m50 m79|m40 a2@79|m41 .|m42 m69|m43 m59|m44 m58|m45 .|m46 .|m47 m48|m37 m38|m27 m28|m28 m29|m29",
      "02": ".|m54 .|m44 .|m34 m51|m24 m41|m23 m42|m22 m43|m21 m44|h0@21 m45|m31 m46|m41 m47|m51 .|m61 .|m60 .|a2@60 m48|m70 m49|a2@70 m59|m60 m69|m50 m79|m40 a2@79|m41 .|m42 m69|m43 m59|m44 m58|m45 .|m46 .|m47 m48|m37 m38|m27 m28|m28 m29|m29",
    },
    10: {   // dev.adv.room11
      "10": "m62|m72 m63|m62 m53|m61 a1@53|m51 m54|m52 m55|m53 m45|m54 m46|m55 m56|m56 m55|m66 m54|m56 m53|m46 m63|m36 m73|m26 m72|m16 m71|m15 m70|m14 a2@70|m13 m71|m12 m61|a3@12 m51|m11 m52|a0@11 m53|. m54|. m55|. m45|m12 m35|m13 m36|m14 m26|m15 m16|m16 m17|m17 m7|m7 m8|m8",
      "12": "m62|m72 m63|m62 m53|m61 a1@53|m51 m54|m52 m55|m53 m45|m54 m46|m55 m56|. m55|m56 m54|m66 m53|m56 m63|m46 m73|m36 m72|m26 m71|m16 m70|m15 a2@70|m14 m71|m13 m61|m12 m51|m11 m52|a0@11 m53|. m54|. m55|. m45|m12 m35|m13 m36|m14 m26|m15 m16|m16 m17|m17 m7|m7 m8|m8",
      "20": "m73|. s@73|m72 m63|m62 m53|m61 a1@53|m51 m54|m52 m55|m53 m45|m54 m46|m55 m56|m56 m55|m66 m54|m56 m53|m46 m63|m36 m73|m26 m72|m16 m71|m15 m70|m14 a2@70|m13 m71|m12 m61|a3@12 m51|m11 m52|a0@11 m53|. m54|. m55|. m45|m12 m35|m13 m36|m14 m26|m15 m16|m16 m17|m17 m7|m7 m8|m8",
      "21": ".|m72 .|m62 .|m63 m62|m53 m61|a1@53 m51|m54 m52|m55 m53|m45 m54|m46 m55|m56 m56|m55 m66|m54 m56|m53 m46|m63 m36|m73 m26|m72 m16|m71 m15|m70 m14|a2@70 m13|m71 m12|m61 m11|m51 a0@11|m52 .|m53 .|m54 .|m55 m12|m45 m13|m35 m14|m36 m15|m26 m16|m16 m17|m17 m7|m7 m8|m8",
      "01": "m73|m72 s@73|m62 m63|m63 m62|m53 m61|a1@53 m51|m54 m52|m55 m53|m45 m54|m46 m55|m56 m56|m55 m66|m54 m56|m53 m46|m63 m36|m73 m26|m72 m16|m71 m15|m70 m14|a2@70 m13|m71 m12|m61 m11|m51 a0@11|m52 .|m53 .|m54 .|m55 m12|m45 m13|m35 m14|m36 m15|m26 m16|m16 m17|m17 m7|m7 m8|m8",
      "02": "m73|. s@73|m72 m63|m62 m53|m61 a1@53|m51 m54|m52 m55|m53 m45|m54 m46|m55 m56|. m55|m56 m54|m66 m53|m56 m63|m46 m73|m36 m72|m26 m71|m16 m70|m15 a2@70|m14 m71|m13 m61|m12 m51|m11 m52|a0@11 m53|. m54|. m55|. m45|m12 m35|m13 m36|m14 m26|m15 m16|m16 m17|m17 m7|m7 m8|m8",
    },
  };
  // PLANS-END

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
      if (b.st === BS.TELE && I.bossType !== "rhino") {
        const centers = [st.bossTarget].concat(st.enemies.filter(e => (e.hpType >> 4) === 2).map(e => e.pos));
        for (const c of centers) if (c !== NONE) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const x = c % COLS + dx, y = ((c / COLS) | 0) + dy;
          if (inRoom(x, y)) danger.add(y * COLS + x);
        }
      }
      if (I.bossType === "rhino" && (b.st === BS.TELE || b.st === BS.CHARGE) && st.bossTarget !== NONE) {
        const v = bossView(st), ly = (st.bossTarget / COLS) | 0, lx = st.bossTarget % COLS;
        for (let y = v.y; y <= ly + 1 && y < ROWS; y++) { danger.add(y * COLS + lx); danger.add(y * COLS + lx + 1); }
      }
      if (b.st === BS.ROCK_TELE || b.st === BS.ROCK_WAIT) for (const r of st.rocks) if (r !== NONE) danger.add(r);
    }
    const bossNow = I.boss ? bossTilesOf(st) : [];
    const free = t => walkable(I, bits, pet, t) && !crates.includes(t) && !slimes.includes(t) && !bossNow.includes(t);
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

    if (I.bossType === "idol") return idolBot(ctx, B, st, I, {pos, free, go});
    if (I.bossType === "rhino") return rhinoBot(ctx, B, st, I, {pos, free, go});
    if (PLANS[I.ri]) return planBot(ctx, B, st, I, {pos, dir, free, go});
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

  // World 2 / 3 puzzle rooms: PLANS[ri][pets] is a joint solution (the designers' solver, replayed
  // in this central code), one slot per 200 ms step, "P1|P2" tokens:
  //   .  wait        mNN  walk (or push) to tile NN        aD@NN  at NN face D, press (lever A, barrier S)
  //   hD@NN  at NN face D and hold the winch               s@NN  swap at the shrine from NN
  // Each bot follows its own list. An instruction starts once the partner has finished everything
  // that comes before it (earlier slots; in the same slot presses before steps, P1's step before
  // P2's), read from the state (position, pet, bits, winching flag). The earliest unfinished
  // instruction of the two can always start, so the two lists never wait for each other forever.
  const PLAN_GATE_SLOTS = 3;
  function compilePlan(I, pets) {
    const src = PLANS[I.ri] && PLANS[I.ri]["" + pets[0] + pets[1]];
    if (!src) return null;
    const ins = [[], []], pet = pets.slice();
    let shrine = 3 - pets[0] - pets[1];
    src.split(" ").forEach((slot, k) => slot.split("|").forEach((tok, p) => {
      if (!tok || tok === ".") return;
      const c = tok[0], [a, b] = tok.slice(1).split("@");
      if (c === "m") ins[p].push({k, t: "m", tile: +a});
      else if (c === "s") { const was = pet[p]; pet[p] = shrine; shrine = was; ins[p].push({k, t: "s", at: +b, pet: pet[p]}); }
      else {
        const dir = +a, at = +b, f = stepTile(at, dir), oi = f >= 0 ? I.objAt[f] : -1;
        ins[p].push({k, t: c, dir, at, oi, lever: oi >= 0 && I.objs[oi].kind === "lever"});
      }
    }));
    // the solver lets go of the winch / steps off the plate just before the partner reaches the
    // gate (it falls ADV_GATE_CLOSE_MS later); a bot keeps holding / standing PLAN_GATE_SLOTS
    // slots longer instead. (Delaying one's own instructions can never deadlock the two lists.)
    const plate = I.plate >= 0 ? I.objs[I.plate].tiles[0] : -1;
    for (let p = 0; p < 2; p++) {
      const list = ins[p];
      for (let j = 1; j < list.length; j++) {
        const x = list[j], prev = list[j - 1];
        if (prev.t === "h" && x.t !== "h") x.k = Math.max(x.k, prev.k + 1 + PLAN_GATE_SLOTS);
        else if (prev.t === "m" && prev.tile === plate && x.t === "m") x.k += PLAN_GATE_SLOTS;
        x.k = Math.max(x.k, prev.k);
      }
    }
    // both levers in the same slot (the later one): the 1 s window then never runs out on a bot
    const lv = ins.map(list => list.findIndex(x => x.t === "a" && x.lever));
    if (lv[0] >= 0 && lv[1] >= 0) {
      const K = Math.max(ins[0][lv[0]].k, ins[1][lv[1]].k);
      for (let p = 0; p < 2; p++) for (let j = lv[p]; j < ins[p].length; j++) ins[p][j].k = Math.max(ins[p][j].k, K);
    }
    // order inside a slot as the central runs it: both presses first, then P1's step, then P2's step
    for (let p = 0; p < 2; p++) for (const x of ins[p]) x.key = 4 * x.k + (x.t === "m" ? 1 + p : 0);
    return ins;
  }
  function planBot(ctx, B, st, I, L) {
    const p = ctx.p, q = 1 - p, bits = st.objBits;
    if (!B.plan || B.plan.ri !== I.ri || st.roomMs10 < B.plan.ms) {
      B.plan = {ri: I.ri, ins: compilePlan(I, [petOf(st.heroes[0]), petOf(st.heroes[1])]), ptr: [0, 0], ms: 0};
    }
    const PL = B.plan;
    PL.ms = st.roomMs10;
    if (!PL.ins) return {};
    const done = (who, x) => {
      const h = st.heroes[who];
      if (x.t === "m") return h.pos === x.tile;
      if (x.t === "s") return petOf(h) === x.pet;
      if (x.t === "h") return (h.petFlags & PF.WINCH) !== 0;
      return bit(bits, x.oi) || (x.lever && bit(bits, I.door));
    };
    for (const who of [p, q]) {
      const list = PL.ins[who];
      // a lever that sprang back (the other came too late): go back and pull it again
      const back = list.findIndex((x, j) => j < PL.ptr[who] && x.t === "a" && x.lever && !bit(bits, x.oi) && !bit(bits, I.door));
      if (back >= 0) PL.ptr[who] = back;
      while (PL.ptr[who] < list.length && done(who, list[PL.ptr[who]])) PL.ptr[who]++;
      // one step seen late (a lost state): it already stands on the step after the next one
      const h = st.heroes[who], j = PL.ptr[who], pv = j > 0 ? list[j - 1] : null;
      const cur = pv ? (pv.t === "m" ? pv.tile : pv.at) : I.spawn[who];
      if (j + 1 < list.length && list[j].t === "m" && list[j + 1].t === "m" && list[j + 1].tile === h.pos && list[j + 1].tile !== cur
        && near4(list[j].tile, h.pos)) PL.ptr[who] = j + 2;
    }
    const list = PL.ins[p], i = PL.ptr[p];
    const nextKey = who => (PL.ptr[who] < PL.ins[who].length ? PL.ins[who][PL.ptr[who]].key : 1e9);
    const goTo = t => {
      if (L.pos === t) return null;
      const d = dirTo(L.pos, t);
      if (d >= 0) return {move: d};                        // also pushes a crate
      return L.go(x => x === t, false) || {};
    };
    const hold = x => goTo(x.at) || (L.dir !== x.dir ? {move: x.dir} : {hold: true});
    if (i >= list.length) return {};
    const x = list[i], prev = i > 0 ? list[i - 1] : null;
    if (nextKey(q) < x.key) return prev && prev.t === "h" ? hold(prev) : {};     // partner not there yet: keep holding
    if (x.t === "m") return goTo(x.tile) || {};
    if (x.t === "h") return hold(x);
    if (x.t === "s") return goTo(x.at) || {act: "MENU"};
    return goTo(x.at) || (L.dir !== x.dir ? {move: x.dir} : {act: x.lever ? "A" : "SKILL"});
  }
  const man = (a, b) => Math.abs(a % COLS - b % COLS) + Math.abs(((a / COLS) | 0) - ((b / COLS) | 0));
  const firstStep = (pos, path) => (path && path.length >= 2 ? {move: dirTo(pos, path[1])} : null);
  // 2-4 Idol (the judge's eye bot): the bait stands 2 tiles from the body and dodges along its
  // facing axis (so the back stays toward the partner); the other waits farther away, one step
  // from a back tile, and strikes from there while it is stunned
  function idolBot(ctx, B, st, I, L) {
    const p = ctx.p, b = bossInfo(st), v = bossView(st), pos = L.pos;
    if (b.st === BS.DEAD || b.st === BS.SLEEP) return {};
    const danger = new Set();
    if (b.st === BS.TELE && st.bossTarget !== NONE) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const x = st.bossTarget % COLS + dx, y = ((st.bossTarget / COLS) | 0) + dy;
      if (inRoom(x, y)) danger.add(y * COLS + x);
    }
    if (b.st === BS.ROCK_TELE || b.st === BS.ROCK_WAIT) for (const r of st.rocks) if (r !== NONE) danger.add(r);
    if (danger.has(pos)) {
      const keep = p === v.tgt;
      return firstStep(pos, bfs(pos, L.free, t => !danger.has(t) && (!keep || idolFace(v.x, v.y, t, v.face) === v.face)))
        || firstStep(pos, bfs(pos, L.free, t => !danger.has(t))) || {};
    }
    if (b.st === BS.STUN && p !== v.tgt && ctx.m.struckWindow !== st.bossWindow) {
      const tiles = backTiles(v.x, v.y, v.face);
      if (tiles.includes(pos)) return {strike: true};
      return L.go(t => tiles.includes(t), false) || {};
    }
    if (b.st !== BS.IDLE) return {};                       // the bait holds still while it is stunned
    if (st.bossWindow === 0 ? p === 0 : p === v.tgt) {
      const sp = [64, 65, 14, 15, 32, 47].filter(t => L.free(t)).sort((a, c) => man(a, pos) - man(c, pos))[0];   // (4,6) (5,6) (4,1) (5,1) (2,3) (7,4)
      return sp == null || pos === sp ? {} : L.go(t => t === sp, false) || {};
    }
    const bt = st.heroes[1 - p].pos, back = backTiles(v.x, v.y, idolFace(v.x, v.y, bt, v.face)), db = distBody(v.x, v.y, bt);
    const cand = [];
    for (let t = 0; t < COLS * ROWS; t++) {
      const d = distBody(v.x, v.y, t);
      if (L.free(t) && d > db && d <= 3 && back.some(k => near4(k, t)) && !back.includes(t)) cand.push(t);
    }
    const w = cand.sort((a, c) => man(a, pos) - man(c, pos))[0];
    return w == null || pos === w ? {} : L.go(t => t === w, false) || {};
  }
  // 3-4 Rhino (the judge's rhino bot): the one it chases stands over a rock (column 2 or 7,
  // rows 2-5) and steps out of the lane when it lights up; the other waits 2 columns beside
  // that rock and strikes from any tile next to the stunned body
  function rhinoBot(ctx, B, st, I, L) {
    const p = ctx.p, b = bossInfo(st), v = bossView(st), pos = L.pos;
    if (b.st === BS.DEAD || b.st === BS.SLEEP) return {};
    const danger = new Set();
    if ((b.st === BS.TELE || b.st === BS.CHARGE) && st.bossTarget !== NONE) {
      const ly = (st.bossTarget / COLS) | 0, lx = st.bossTarget % COLS;
      for (let y = v.y; y <= ly + 1 && y < ROWS; y++) { danger.add(y * COLS + lx); danger.add(y * COLS + lx + 1); }
    }
    if (b.st === BS.ROCK_TELE || b.st === BS.ROCK_WAIT) for (const r of st.rocks) if (r !== NONE) danger.add(r);
    if (danger.has(pos)) return firstStep(pos, bfs(pos, L.free, t => !danger.has(t))) || {};
    const rockCols = [];
    for (let x = 0; x < COLS; x++) if (chAt(I, (ROWS - 1) * COLS + x) === "#") rockCols.push(x);
    const nearest = x => rockCols.slice().sort((a, c) => Math.abs(a - x) - Math.abs(c - x))[0];
    if (b.st === BS.STUN && p !== v.tgt && ctx.m.struckWindow !== st.bossWindow) {
      const tiles = adjTiles(v.x, v.y).filter(t => chAt(I, t) !== "#");
      if (tiles.includes(pos)) return {strike: true};
      return L.go(t => tiles.includes(t), false) || {};
    }
    if (p === v.tgt) {
      if (b.st !== BS.IDLE) return {};
      const good = t => rockCols.includes(t % COLS) && ((t / COLS) | 0) >= 2 && ((t / COLS) | 0) <= 5;
      if (good(pos)) return {};
      if (!rockCols.includes(pos % COLS)) {                // sideways first, toward the nearest rock column
        const d = nearest(pos % COLS) > pos % COLS ? 1 : 3, n = stepTile(pos, d);
        if (n >= 0 && L.free(n) && !danger.has(n)) return {move: d};
      }
      return L.go(good, false) || {};
    }
    if (b.st === BS.IDLE || b.st === BS.TELE || b.st === BS.CHARGE) {
      const rc = nearest(st.heroes[v.tgt].pos % COLS);
      const spots = [[rc - 2, 6], [rc + 2, 6], [rc - 2, 5], [rc + 2, 5]].filter(([x]) => x >= 0 && x < COLS)
        .map(([x, y]) => y * COLS + x).filter(t => L.free(t) && !danger.has(t));
      const w = spots.sort((a, c) => man(a, pos) - man(c, pos))[0];
      return w == null || pos === w ? {} : L.go(t => t === w, false) || {};
    }
    return {};
  }

  function bot(ctx, ctl) {
    const st = ctx.state, m = ctx.m;
    if (!st || !m) return;
    const now = ctx.now();
    const B = m.bot || (m.bot = {next: 0, actAt: 0, stick: -2, pressure: -1, role: null, since: 0, struck: -1, jit: 0, jitAt: 0, seen: 0, world: 0});
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
    if (st.phase === PH.PICK && st.room === NONE) {
      // world vote: follow the partner's vote; P1 (or P2 after 1.5 s alone) votes B.world (World 1)
      if (now - B.actAt < 300 || !ctx.s || ctx.screenId !== "adv.world") return;
      const mine = voteOf(st, ctx.p), theirs = voteOf(st, 1 - ctx.p);
      if (!B.wsince) B.wsince = now;
      const want = theirs !== NONE ? theirs : ctx.p === 0 || now - B.wsince > 1500 ? (B.world | 0) : -1;
      if (want < 0 || mine === want) return;
      B.actAt = now;
      if ((ctx.s.sel | 0) !== want) ctl.press("DOWN", 60); else ctl.press("A", 60);
      return;
    }
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
      trialCfg, stepTile, faceTile, near4, exitOpen, BOSS_TILES, BOSS_ADJ, bfs,
      RPW, WORLDS, worldOf, starTime, bodyTiles, adjTiles, backTiles, idolFace, distBody, PLANS, compilePlan},
    lobby: {badgeKey: "dev.lobby.rooms", badgeVars: () => ({n: RPW}), goals: ["dev.adv.goal1", "dev.adv.goal2"],
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

  // Gallery / regression: two bots clear World 2 (Ember + Tide) or World 3 (Tide + Sprout), key
  // frames of every room and of the boss (warning, stun, core strike); World 2's results then go
  // on to World 3 with the same pets (REMATCH arg 1 -> carry {next: true})
  const PROFILES = [{name: "ANNA", avatar: 3, color: 0}, {name: "BENJI", avatar: 5, color: 4}];
  const roomId = ri => (worldOf(ri) + 1) + "-" + (ri % RPW + 1);
  for (const [id, w, pets] of [["adv.w2", 1, 0x01], ["adv.w3", 2, 0x12]]) D.registerFixture(id, {titleKey: "dev.menu.adv", async run(T) {
    T.reset({seed: 5, skipBoot: true, mode: "adventure", profiles: PROFILES});
    T.step(1500);
    const snap = () => { const c = T.central(); return c.mode && c.mode.snapshot; };
    T.step(300);
    T.shot("world vote");
    T.debug("world", w); T.step(400);
    T.shot("pick, " + (w + 1));
    T.debug("pick", pets); T.step(300);
    T.bot(0, true); T.bot(1, true);
    let room = -1, seen = {};
    for (let i = 0; i < 1600; i++) {
      T.step(125);
      const s = snap();
      if (!s) continue;
      if (s.phase === PH.PLAY && s.room !== room) { room = s.room; T.step(700); T.shot("room " + roomId(room)); continue; }
      if (s.phase === PH.PLAY && INFO[s.room].boss) {
        const b = bossInfo(s), tag = b.st + (b.phase2 ? "p2" : "");
        const strike = [0, 1].some(p => T.hh(p).m && T.hh(p).m.trial && T.hh(p).m.trial.phase === 1);
        if (b.st === BS.TELE && !seen[tag]) { seen[tag] = 1; T.step(250); T.shot(INFO[s.room].bossType === "rhino" ? "lane" + (b.phase2 ? " 2" : "") : "lock-on" + (b.phase2 ? " 2" : "")); }
        else if (b.st === BS.CHARGE && !seen.c) { seen.c = 1; T.shot("charge"); }
        else if (b.st === BS.STUN && !seen.s) { seen.s = 1; T.step(150); T.shot("stunned"); }
        else if (strike && !seen.k) { seen.k = 1; T.step(400); T.shot("core strike"); }
        else if (b.st === BS.ROCK_TELE && !seen.r) { seen.r = 1; T.shot("rocks"); }
      }
      if (s.phase >= PH.TEAM_DOWN) break;
    }
    let s = snap();
    T.log("phase " + s.phase + " room " + s.room + " hearts " + s.hearts + " time " + s.totalDs / 10 + " s gems " + s.gems);
    T.assert(s.phase === PH.CLEAR && s.room === w * RPW + 3, "bots should clear world " + (w + 1) + " (phase " + s.phase + ", room " + s.room + ")");
    T.step(1700);
    T.shot("results");
    if (w + 1 < WORLDS) {
      // the results bots press A: both -> REMATCH arg 1 -> next world, same pets
      const pets0 = s.heroes.map(h => h.petFlags & 3).join();
      for (let i = 0; i < 40 && !(snap() && snap().room === (w + 1) * RPW && snap().phase === PH.PLAY); i++) T.step(250);
      s = snap();
      T.step(600);
      T.shot("next world");
      T.assert(s.phase === PH.PLAY && s.room === (w + 1) * RPW && s.heroes.map(h => h.petFlags & 3).join() === pets0 && s.hearts === PDEF.hearts,
        "next world: room " + s.room + " pets " + s.heroes.map(h => h.petFlags & 3) + " hearts " + s.hearts);
    }
    T.bot(0, false); T.bot(1, false);
  }});

  // Regression: every World 2 / 3 room with every pet assignment (P1/P2 both ways), bots only
  D.registerFixture("adv.pairs", {titleKey: "dev.menu.adv", async run(T) {
    const fails = [];
    for (let ri = RPW; ri < ROOMS.length; ri++) for (const [a, b] of [[0, 1], [1, 0], [0, 2], [2, 0], [1, 2], [2, 1]]) {
      T.reset({seed: 5 + ri, skipBoot: true, mode: "adventure", profiles: PROFILES});
      T.step(1500);
      T.debug("world", worldOf(ri)); T.step(200);
      T.debug("pick", (a << 4) | b); T.step(200);
      if (ri % RPW) { T.debug("room", ri); T.step(300); }
      T.bot(0, true); T.bot(1, true);
      const boss = INFO[ri].boss, c0 = T.central().mode.snapshot.totalDs;
      let s = null;
      for (let i = 0; i < (boss ? 1200 : 400); i++) {
        T.step(250);
        s = T.central().mode.snapshot;
        if (!boss && (s.phase === PH.ROOM_CLEAR || s.room !== ri)) break;
        if (s.phase >= PH.TEAM_DOWN) break;
      }
      T.bot(0, false); T.bot(1, false);
      const ok = boss ? s.phase === PH.CLEAR : s.phase === PH.ROOM_CLEAR || s.room === ri + 1;
      T.log(roomId(ri) + " " + a + b + ": " + (ok ? "clear" : "FAIL") + " " + (s.totalDs - c0) / 10 + " s, hearts " + s.hearts);
      if (!ok) fails.push(ri + "/" + a + b);
    }
    T.assert(!fails.length, "not cleared: " + fails.join(" "));
  }});
})();
