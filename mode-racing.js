// Pocket Rivals handheld simulator: 双人赛车 Racing prototype
// (docs/ui-design.md §4.7 race pick, §4.9 S13 HUD, §4.13 results, §5 rules)
//
// One file, two halves (§8.1): the central board (pick, countdown, race
// clock, positions, gap, skills, vines, finish) and the player board (local
// 50 Hz physics, laps, heat, puddles, boosts, perfect start, uplink
// race.input every RACE_UPLINK_MS). Rules and physics are "C-like JS"
// (§8.13): integers only, position 1/256 px, speed 1/256 px/s, heading
// 0..65535 = 360°, a 256-entry sine table. Pure functions live in `rules`
// (DEVICE.rules("racing")), which also exports race_config.h (configH()).
// Screens: race.pick (DEVICE.ui.pickScreen, secret pick) and race.hud.
// Each pet has its own kart, rider and handling (§5.9): sprites
// race.car.<pet> / race.rider.<pet>, petTune() in the physics.
// The mode bot (AI rival, §5.8) follows a racing line with pure pursuit,
// lifts before the U-turns and puddles and watches its heat.
(() => {
  "use strict";
  const D = window.DEVICE, C = D.C, A = C.ACT, ui = D.ui;
  const NO_PET = C.NO_PET;
  const trunc = Math.trunc, abs = Math.abs, min = Math.min, max = Math.max;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* ============================== strings ============================== */

  // Tunables (§5.7) -> race_config.h. [+] RACE_GRASS_DRAG is an addition:
  // the spec slows a car that runs onto the grass at RACE_COAST only, which
  // made cutting corners almost free; RACE_SIM_BOT_PCT is simulator only.
  const PARAMS = [
    ["laps", "RACE_LAPS", 1, 9, 1, 3, "", "圈数", "Laps", "圈数，1..9（顶栏 \"LAP 9/9\" 42 px）"],
    ["topSpeed", "RACE_TOP_SPEED", 32, 128, 4, 64, "px/s", "最高速度", "Top speed", "px/s，路面最高速度（一屏宽 128 px = 2 s）"],
    ["grassSpeed", "RACE_GRASS_SPEED", 8, 64, 2, 28, "px/s", "草地速度", "Grass speed", "px/s，草地最高速度"],
    ["grassDrag", "RACE_GRASS_DRAG", 40, 400, 10, 120, "px/s2", "草地减速", "Grass drag", "px/s^2，冲上草地超速时的减速（模拟器新增）"],
    ["accel", "RACE_ACCEL", 30, 240, 10, 90, "px/s2", "加速", "Accel", "px/s^2"],
    ["coast", "RACE_COAST", 10, 160, 5, 40, "px/s2", "松油减速", "Coast", "松油门时的减速 px/s^2"],
    ["brake", "RACE_BRAKE", 40, 400, 10, 160, "px/s2", "刹车", "Brake", "B 刹车的额外减速 px/s^2"],
    ["reverseSpeed", "RACE_REVERSE_SPEED", 4, 40, 2, 16, "px/s", "倒车速度", "Reverse", "停住后按住 B 倒车的速度 px/s"],
    ["turnLo", "RACE_TURN_LO_DEG_S", 90, 540, 10, 300, "deg/s", "低速转向", "Turn slow", "车速 0 时车头每秒最多转多少度"],
    ["turnHi", "RACE_TURN_HI_DEG_S", 45, 360, 5, 120, "deg/s", "高速转向", "Turn fast", "最高速时（半径约 31 px，U 形弯要松油）"],
    ["stickDead", "RACE_STICK_DEAD", 10, 90, 5, 40, "", "摇杆死区", "Stick dead", "|摇杆| 超过这个才改方向"],
    ["heatLine", "RACE_HEAT_LINE", 50, 100, 1, 85, "%", "升温线", "Heat line", "油门 % 超过这个开始升温"],
    ["heatRise", "RACE_HEAT_RISE", 0, 100, 1, 25, "/s", "升温", "Heat rise", "每秒升温（一直捏满：4 s 熄火一次）"],
    ["heatCool", "RACE_HEAT_COOL", 0, 100, 1, 20, "/s", "降温", "Heat cool", "每秒降温"],
    ["stallMs", "RACE_STALL_MS", 200, 3000, 100, 1000, "ms", "熄火", "Stall", "过热熄火（油门最多 30%），之后热量 = 0"],
    ["heatWarn", "RACE_HEAT_WARN", 10, 99, 1, 60, "", "热量警告", "Heat warn", "热量条变红 + heat_warn"],
    ["heatSmoke", "RACE_HEAT_SMOKE", 10, 99, 1, 75, "", "冒烟", "Smoke", "车后冒烟"],
    ["puddleSafe", "RACE_PUDDLE_SAFE", 0, 100, 5, 60, "%", "水洼安全线", "Puddle safe", "过水洼不打滑的油门上限 %"],
    ["skidMs", "RACE_SKID_MS", 100, 2000, 50, 600, "ms", "打滑", "Skid", ""],
    ["boostPct", "RACE_BOOST_PCT", 0, 100, 5, 50, "%", "加速板", "Boost", "加速板 / 完美起步：最高速度 +%"],
    ["boostMs", "RACE_BOOST_MS", 100, 3000, 100, 800, "ms", "加速时长", "Boost ms", ""],
    ["startLo", "RACE_START_LO", 0, 100, 5, 40, "%", "起步下限", "Start lo", "完美起步：GO 那一刻油门在 LO..HI 之间"],
    ["startHi", "RACE_START_HI", 0, 100, 5, 70, "%", "起步上限", "Start hi", ""],
    ["startSpin", "RACE_START_SPIN", 50, 101, 1, 90, "%", "空转线", "Spin line", "超过这个值就空转"],
    ["spinMs", "RACE_SPIN_MS", 0, 2000, 50, 600, "ms", "空转", "Wheelspin", ""],
    ["perfectMs", "RACE_PERFECT_MS", 0, 3000, 100, 1000, "ms", "完美起步", "Perfect go", "完美起步的加速时长"],
    ["dashPct", "RACE_DASH_PCT", 0, 100, 5, 50, "%", "冲刺", "Dash", "焰灵 爆燃冲刺"],
    ["dashMs", "RACE_DASH_MS", 200, 3000, 100, 1200, "ms", "冲刺时长", "Dash ms", ""],
    ["splashMs", "RACE_SPLASH_MS", 200, 4000, 100, 1500, "ms", "浪花", "Splash", "潮影 浪花"],
    ["splashWindow", "RACE_SPLASH_WINDOW", 16, 96, 4, 40, "px", "浪花视野", "Splash view", "被浪花盖住时，车周围还看得清的方框边长 px"],
    ["vineMs", "RACE_VINE_MS", 1000, 30000, 1000, 15000, "ms", "藤蔓存在", "Vine life", "叶芽 藤蔓陷阱存在多久"],
    ["vinePct", "RACE_VINE_PCT", 10, 100, 5, 40, "%", "藤蔓速度", "Vine speed", "压到藤蔓后剩下的最高速度 %"],
    ["snareMs", "RACE_SNARE_MS", 100, 3000, 100, 800, "ms", "缠住", "Snare", ""],
    ["countdownMs", "RACE_COUNTDOWN_MS", 1000, 5000, 500, 3000, "ms", "倒数", "Countdown", ""],
    ["finishWaitMs", "RACE_FINISH_WAIT_MS", 1000, 15000, 500, 5000, "ms", "冲线等待", "Finish wait", "第一名冲线后另一人最多再跑多久"],
    ["timeLimitS", "RACE_TIME_LIMIT_S", 30, 600, 10, 120, "s", "时限", "Time limit", ""],
    ["uplinkMs", "RACE_UPLINK_MS", 20, 100, 10, 50, "ms", "上行间隔", "Uplink", "race.input 的发送间隔"],
    ["draftPct", "RACE_DRAFT_PCT", 0, 30, 1, 10, "%", "尾流", "Draft", "尾流，0 = 关（试玩默认开）"],
    ["catchupPct", "RACE_CATCHUP_PCT", 0, 30, 1, 0, "%", "拉车", "Catch-up", "隐形拉车，0 = 关"],
    // per-pet handling (§5.9); 100 = same as everyone
    ["emberTopPct", "RACE_EMBER_TOP_PCT", 90, 120, 1, 106, "%", "焰灵极速", "Ember top", "焰灵：路面最高速度 %"],
    ["emberHeatPct", "RACE_EMBER_HEAT_PCT", 50, 200, 5, 125, "%", "焰灵升温", "Ember heat", "焰灵：升温速度 %"],
    ["tideCoolPct", "RACE_TIDE_COOL_PCT", 50, 200, 5, 130, "%", "潮影降温", "Tide cool", "潮影：降温速度 %"],
    ["tidePuddleSafe", "RACE_TIDE_PUDDLE_SAFE", 0, 101, 1, 101, "%", "潮影水洼", "Tide puddle", "潮影：过水洼不打滑的油门上限 %（101 = 永不打滑）"],
    ["tidePuddleCool", "RACE_TIDE_PUDDLE_COOL", 0, 100, 5, 30, "", "潮影水冷", "Puddle cool", "潮影：每进一格水洼，热量 −这么多"],
    ["sproutTopPct", "RACE_SPROUT_TOP_PCT", 80, 110, 1, 96, "%", "叶芽极速", "Sprout top", "叶芽：路面最高速度 %"],
    ["sproutTurnPct", "RACE_SPROUT_TURN_PCT", 50, 200, 5, 125, "%", "叶芽转向", "Sprout turn", "叶芽：转向速度 %（最高速时半径约 24 px）"],
    ["botPct", "RACE_SIM_BOT_PCT", 50, 110, 5, 100, "%", "电脑难度", "Bot pace", "模拟器专用：AI 对手的油门 %"],
  ];
  const DEFAULTS = {};
  for (const p of PARAMS) DEFAULTS[p[0]] = p[5];

  const zh = {
    "dev.race.goal1": "先跑完{n}圈的赢", "dev.race.goal2": "一直捏满会过热",
    "dev.race.k1n": "摇杆", "dev.race.k1": "方向", "dev.race.k2n": "捏垫/A", "dev.race.k2": "油门",
    "dev.race.k3n": "B", "dev.race.k3": "刹车", "dev.race.k4n": "S", "dev.race.k4": "技能",
    // S11 pick driver (§4.7)
    "dev.race.pickTitle": "选择车手", "dev.race.secret": "暗选", "dev.race.pickNote": "对方看不到你的选择",
    "dev.race.sk.dash": "爆燃冲刺", "dev.race.sk.splash": "浪花", "dev.race.sk.vine": "藤蔓陷阱",
    "dev.race.skShort.dash": "冲刺", "dev.race.skShort.splash": "浪花", "dev.race.skShort.vine": "藤蔓",
    "dev.race.skDesc.dash": "加速，烧掉藤蔓", "dev.race.skDesc.splash": "挡住对方视线1.5秒", "dev.race.skDesc.vine": "在身后放藤蔓",
    "dev.race.skLine": "{S} {sk}",
    "dev.race.counter.splashDash": "浪花 打断 冲刺", "dev.race.counter.dashVine": "冲刺 烧掉 藤蔓", "dev.race.counter.vineSplash": "藤蔓 吸收 浪花",
    "dev.race.rivalChoosing": "对方：选择中…", "dev.race.rivalPicked": "对方：{OK} 已选好", "dev.race.waitRival": "等待对方…",
    "dev.race.sameDriver": "两人选了同一只", "dev.race.hintPick": "选", "dev.race.hintLock": "选定",
    // per-pet handling, one line each (§5.9)
    "dev.race.trait.ember": "跑得最快，但升温快", "dev.race.trait.tide": "降温快，水洼不打滑", "dev.race.trait.sprout": "转弯最灵，极速稍低",
    // S13 HUD (§4.9)
    "dev.race.lap": "第{n}/{m}圈", "dev.race.pos1": "第1", "dev.race.pos2": "第2",
    "dev.race.go": "出发！", "dev.race.finalLap": "最后一圈！", "dev.race.wrongWay": "逆行！",
    "dev.race.overheat": "过热！", "dev.race.skid": "打滑！", "dev.race.perfectStart": "完美起步！", "dev.race.wheelspin": "空转！",
    "dev.race.splashed": "被浪花打中！", "dev.race.snared": "被藤蔓缠住！", "dev.race.absorbed": "浪花被吸收",
    "dev.race.skillUsed": "本圈已用过", "dev.race.finish": "冲线！", "dev.race.dnf": "未完成",
    "dev.race.burned": "烧掉藤蔓！", "dev.race.lapTime": "本圈 {t}", "dev.race.holdM": "按住{M}暂停",
    "dev.race.waitLeft": "还剩{n}秒", "dev.race.dashStopped": "冲刺被打断！", "dev.race.stoppedDash": "打断冲刺！",
    // S19 results (§4.13)
    "dev.race.res.place1": "第1名！", "dev.race.res.place2": "第2名",
    "dev.race.res.total": "总用时", "dev.race.res.bestLap": "最快一圈", "dev.race.res.overheat": "过热", "dev.race.res.skills": "用技能",
    "dev.race.res.newBest": "新纪录！",
  };
  const en = {
    "dev.race.goal1": "First to {n} laps wins", "dev.race.goal2": "Full gas overheats",
    "dev.race.k1n": "Stick", "dev.race.k1": "steer", "dev.race.k2n": "Pad/A", "dev.race.k2": "gas",
    "dev.race.k3n": "B", "dev.race.k3": "brake", "dev.race.k4n": "S", "dev.race.k4": "skill",
    "dev.race.pickTitle": "PICK DRIVER", "dev.race.secret": "secret", "dev.race.pickNote": "Your pick is secret",
    "dev.race.sk.dash": "Flare Dash", "dev.race.sk.splash": "Splash", "dev.race.sk.vine": "Vine Snare",
    "dev.race.skShort.dash": "Dash", "dev.race.skShort.splash": "Splash", "dev.race.skShort.vine": "Vines",
    "dev.race.skDesc.dash": "Boost, burns vines", "dev.race.skDesc.splash": "Blinds rival 1.5 s", "dev.race.skDesc.vine": "Drops vines behind",
    "dev.race.skLine": "{S} {sk}",
    "dev.race.counter.splashDash": "Splash stops Dash", "dev.race.counter.dashVine": "Dash burns Vines", "dev.race.counter.vineSplash": "Vines soak Splash",
    "dev.race.rivalChoosing": "Rival: choosing...", "dev.race.rivalPicked": "Rival: ready {OK}", "dev.race.waitRival": "Waiting...",
    "dev.race.sameDriver": "Same driver", "dev.race.hintPick": "Pick", "dev.race.hintLock": "Lock",
    "dev.race.trait.ember": "Fastest, heats fast", "dev.race.trait.tide": "Cools fast, no skid", "dev.race.trait.sprout": "Sharp turns, slower",
    "dev.race.lap": "LAP {n}/{m}", "dev.race.pos1": "1ST", "dev.race.pos2": "2ND",
    "dev.race.go": "GO!", "dev.race.finalLap": "FINAL LAP!", "dev.race.wrongWay": "WRONG WAY!",
    "dev.race.overheat": "OVERHEAT!", "dev.race.skid": "Skid!", "dev.race.perfectStart": "PERFECT GO!", "dev.race.wheelspin": "Wheelspin!",
    "dev.race.splashed": "Splashed!", "dev.race.snared": "Snared!", "dev.race.absorbed": "Absorbed!",
    "dev.race.skillUsed": "Used this lap", "dev.race.finish": "FINISH!", "dev.race.dnf": "DNF",
    "dev.race.burned": "Burned!", "dev.race.lapTime": "Lap {t}", "dev.race.holdM": "Hold {M} 1s",
    "dev.race.waitLeft": "{n} s left", "dev.race.dashStopped": "Dash stopped!", "dev.race.stoppedDash": "Stopped Dash!",
    "dev.race.res.place1": "1ST PLACE!", "dev.race.res.place2": "2ND PLACE",
    "dev.race.res.total": "Total", "dev.race.res.bestLap": "Best lap", "dev.race.res.overheat": "Overheat", "dev.race.res.skills": "Skills",
    "dev.race.res.newBest": "NEW BEST!",
  };
  for (const p of PARAMS) { zh["dev.race.p." + p[0]] = p[7]; en["dev.race.p." + p[0]] = p[8]; }
  D.registerStrings("dev.race.", {zh, en});

  /* ============================== sounds (§2.6) ============================== */

  D.registerSfx("race", {
    race_go: {ch: "DF", file: 31, prio: 2, ms: 600},
    lap: {ch: "DF", file: 32, prio: 2, ms: 400},
    final_lap: {ch: "DF", file: 33, prio: 2, ms: 800},
    boost: {ch: "DF", file: 34, prio: 2, ms: 400},
    overheat: {ch: "DF", file: 35, prio: 2, ms: 700},
    skid: {ch: "DF", file: 36, prio: 2, ms: 400},
    wrong_way: {ch: "DF", file: 37, prio: 2, ms: 600},
    skill_race: {ch: "DF", file: 38, prio: 2, ms: 500},
    finish: {ch: "DF", file: 39, prio: 3, ms: 1200},
    heat_warn: {ch: "BEEP", tones: [[3000, 15]]},
  });

  /* ============================== messages (§7.6) ============================== */

  D.registerMessage("race.input", C.MSG.RACE_INPUT, [
    "step:u16", "tCs:u16", "x:u8", "y:u8", "hd:u8", "speed:u8", "lap:u8", "cp:u8", "flags:u8", "vineHits:u8",
    "finish:u16", "best:u16", "stalls:u8", "skills:u8"], {kind: "uplink"});
  D.registerMessage("race.state", C.MSG.RACE_STATE, [
    "step:u16", "phase:u8", "flags:u8", "match:u8", "laps:u8", "track:u8", "countdown:u16", "raceCs:u16",
    ["cars", 2, ["x:u8", "y:u8", "hd:u8", "speed:u8", "lap:u8", "cp:u8", "flags:u8", "pet:u8",
      "finish:u16", "best:u16", "stalls:u8", "skills:u8"]],
    ["vines", 2, ["tile:u8", "ttl:u8"]],
    "gap:i16", "leader:u8", "evId:u8", "evType:u8", "evTarget:u8", "evAmount:u8"], {kind: "mode"});

  const PH = {PICK: 0, COUNTDOWN: 1, RACE: 2, FINISH: 3, RESULTS: 4};
  // car flags (race.input / race.state cars[].flags)
  const CF = {DASH: 1, SKID: 2, BOOST: 4, STALL: 8, SNARED: 16, SPLASHED: 32, WRONGWAY: 64, FINISHED: 128};
  // central events (race.state evType); evTarget = the player it hits
  const EV = {NONE: 0, SPLASH: 1, ABSORB: 2, VINE: 3, DASH: 4, QUIT: 5};
  const GAP_NONE = -32768;
  const REVEAL_MS = 1500;      // both picks shown on S11 before the countdown
  const STEP_MS = 20;          // local physics, 50 Hz
  const PET_EMBER = 0, PET_TIDE = 1, PET_SPROUT = 2;
  const SKILL = ["dash", "splash", "vine"];

  /* ============================== cars and riders (§5.9) ============================== */

  // Each pet has its own kart: body in the pet's color and a tail you can
  // tell apart without color (Ember: pointed nose + two flame fins; Tide:
  // round nose + full-width wave wing with a fin; Sprout: square bumper +
  // one leaf spoiler on the right). 10x10, two frames (nose up, nose
  // up-right); the other 6 headings are flips / transposes (drawCar).
  // o = outline and wheels, b = body, d = body shade, l = light trim,
  // k = cockpit. The rider is the pet's head (5x4, light color, two void
  // eyes, the pet's own tuft: flame horns / water tip / two leaves), drawn
  // upright over the cockpit and 2 px up, so it sits "in" the kart at every
  // heading. Under both, a 1 px drop shadow in the player's color (P1 / P2).
  const CAR_ROWS = {
    ember: [[
      "....oo....",
      "...oblo...",
      ".ooobbooo.",
      ".oobbbboo.",
      "..obkkbo..",
      "..obkkbo..",
      ".oobbbboo.",
      ".oobddboo.",
      ".loddddol.",
      "l..oooo..l"], [
      "......oo..",
      "....ooolo.",
      "...oobbbo.",
      ".ooobbbbo.",
      "ooobkkbbo.",
      "oobbkkbooo",
      "loddbboo..",
      ".oddboo...",
      ".looooo...",
      "...l......"]],
    tide: [[
      "...oooo...",
      "..obbbbo..",
      ".oobbbboo.",
      ".oobbbboo.",
      "..obkkbo..",
      "..obkkbo..",
      ".oobbbboo.",
      ".oobllboo.",
      "llllllllll",
      ".oooooooo."], [
      "....oooo..",
      "....oobbo.",
      "...oobbbbo",
      ".ooobbbbbo",
      "loobkkbboo",
      "llbbkkbooo",
      "olllbboo..",
      ".ollboo...",
      "..olloo...",
      "...oll...."]],
    sprout: [[
      "..oooooo..",
      "..obbbbo..",
      ".oobbbboo.",
      ".oobbbboo.",
      "..obkkbo..",
      "..obkkbo..",
      ".oobbbboo.",
      ".oobddbol.",
      "..oddddoll",
      "...oooo.ll"], [
      "....oooo..",
      "....oobbo.",
      "...oobbbbo",
      ".ooobbbbbo",
      ".oobkkbboo",
      ".obbkkbooo",
      ".oddbboo..",
      ".oddbool..",
      "..oooolll.",
      "......ll.."]],
  };
  const RIDER_ROWS = {
    ember: [".l.l.", "lllll", "lolol", ".lll."],
    tide: ["..l..", ".lll.", "lolol", ".lll."],
    sprout: ["ll.ll", ".lll.", "lolol", ".lll."],
  };
  // Racing skill icons (8x8, §2.4): Flare Dash ">>", Splash fountain, Vine curl;
  // trait icons for the pick cards: fast, grip (drop over a tread), turn
  const RACE_ICONS = {
    dash: ["fire", "gold", "#...#...", "##..##..", ".##..##.", "..++..++", "..++..++", ".##..##.", "##..##..", "#...#..."],
    splash: ["water", "waterLt", "+..+..+.", "........", ".+.##.+.", "...##...", "..####..", "..####..", "#......#", ".######."],
    vine: ["grass", "grassLt", "...###..", "..#...#.", "..#.+.#.", "...#++..", "+...#...", "++..#...", ".+##....", "..#....."],
    fast: ["gold", "white", "........", "++++....", "....###.", "+++..###", "....###.", "++++....", "........", "........"],
    grip: ["waterLt", "white", "...#....", "..###...", ".#####..", ".#####..", "..###...", "........", "+.+.+.+.", ".+.+.+.+"],
    turn: ["grassLt", "white", "..####..", ".#....#.", "#......#", "#......#", "#....###", ".....##.", "......#.", "........"],
  };
  const TRAIT_ICON = ["fast", "grip", "turn"];
  {
    const defs = {};
    D.PETS.forEach(pt => {
      defs["race.car." + pt.id] = {w: 10, h: 10, map: {o: "void", b: pt.color, d: pt.dk, l: pt.lt, k: "void"}, frames: CAR_ROWS[pt.id]};
      defs["race.rider." + pt.id] = {w: 5, h: 4, map: {l: pt.lt, o: "void"}, frames: [RIDER_ROWS[pt.id]]};
    });
    for (const [k, [c1, c2, ...rows]] of Object.entries(RACE_ICONS)) defs["race.icon." + k] = {w: 8, h: 8, map: {"#": c1, "+": c2}, frames: [rows]};
    D.registerSprites("race.", defs);
  }
  // Per-pet handling (§5.9) from the params: the numbers stepCar uses
  function petTune(P, pet) {
    const t = {topPct: 100, heatPct: 100, coolPct: 100, turnPct: 100, puddleSafe: P.puddleSafe, puddleCool: 0};
    if (pet === PET_EMBER) { t.topPct = P.emberTopPct; t.heatPct = P.emberHeatPct; }
    else if (pet === PET_TIDE) { t.coolPct = P.tideCoolPct; t.puddleSafe = P.tidePuddleSafe; t.puddleCool = P.tidePuddleCool; }
    else if (pet === PET_SPROUT) { t.topPct = P.sproutTopPct; t.turnPct = P.sproutTurnPct; }
    return t;
  }

  /* ============================== track (§5.2) ============================== */

  const MAP = [
    "................",
    ".######=#######.",
    ".######=##~####.",
    ".##..........##.",
    ".##..........#v.",
    ".##..........##.",
    ".##..##2~##..##.",
    ".##..##2###..##.",
    ".^#..##..##..##.",
    ".##..##..##..##.",
    ".##..##..##..##.",
    ".##..##..##..##.",
    ".##3###..###1##.",
    ".##3###..###1##.",
    "...T....T....T..",
    "................",
  ];
  const K = {GRASS: 0, ROAD: 1, LINE: 2, CP1: 3, CP2: 4, CP3: 5, PUDDLE: 6, BOOST_UP: 7, BOOST_DN: 8, TREE: 9};
  const KIND_OF = {".": K.GRASS, "#": K.ROAD, "=": K.LINE, "1": K.CP1, "2": K.CP2, "3": K.CP3, "~": K.PUDDLE, "^": K.BOOST_UP, "v": K.BOOST_DN, "T": K.TREE};
  const isRoad = k => k >= K.ROAD && k <= K.BOOST_DN;
  const TRACK_Y = 16;          // screen y of track row 0
  const FINISH_X = 64;         // finish line: crossing x = 64 going right, y < 32 (rows 0-3)
  // Centre line (track px), clockwise from the finish line; 464 px = 58 tiles
  const LINE_PTS = [[64, 16], [112, 16], [112, 104], [80, 104], [80, 56], [48, 56], [48, 104], [16, 104], [16, 16], [64, 16]];
  // Racing line for the AI: upper lane on the top straight (misses the
  // puddle), outer lanes on both sides (takes both boost pads)
  const BOT_PTS = [[64, 13], [114, 13], [114, 104], [80, 104], [80, 56], [48, 56], [48, 104], [13, 104], [13, 13], [64, 13]];
  const START = [[68, 12], [68, 20]];   // P1 (8,1), P2 (8,2), nose right, just past the line

  function makeLine(pts) {
    const segs = [];
    let s0 = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
      const len = abs(bx - ax) + abs(by - ay);
      const hd = bx > ax ? 0 : by > ay ? 16384 : bx < ax ? 32768 : 49152;
      segs.push({ax, ay, bx, by, len, s0, hd});
      s0 += len;
    }
    return {segs, len: s0};
  }
  const CENTER = makeLine(LINE_PTS), BOTLINE = makeLine(BOT_PTS);
  const TRACK_LEN = CENTER.len;   // 464
  // Nearest point on an axis-aligned polyline -> {s, d2, seg}; ties go to the earlier segment
  function project(line, x, y) {
    let best = null;
    for (const sg of line.segs) {
      let px, py, along;
      if (sg.ay === sg.by) { px = clamp(x, min(sg.ax, sg.bx), max(sg.ax, sg.bx)); py = sg.ay; along = abs(px - sg.ax); }
      else { py = clamp(y, min(sg.ay, sg.by), max(sg.ay, sg.by)); px = sg.ax; along = abs(py - sg.ay); }
      const d2 = (x - px) * (x - px) + (y - py) * (y - py);
      if (!best || d2 < best.d2) best = {s: sg.s0 + along, d2, seg: sg};
    }
    return best;
  }
  function pointAt(line, s) {
    s = ((s % line.len) + line.len) % line.len;
    for (const sg of line.segs) {
      if (s <= sg.s0 + sg.len) {
        const a = s - sg.s0;
        return [sg.ax + Math.sign(sg.bx - sg.ax) * a, sg.ay + Math.sign(sg.by - sg.ay) * a];
      }
    }
    return [line.segs[0].ax, line.segs[0].ay];
  }
  // Tile tables (flash in C): kind, driving direction, distance number 0..57
  const KIND = new Uint8Array(256), DIR = new Uint16Array(256), PROG = new Uint8Array(256);
  for (let ty = 0; ty < 16; ty++) for (let tx = 0; tx < 16; tx++) {
    const i = ty * 16 + tx;
    KIND[i] = KIND_OF[MAP[ty][tx]];
    const pr = project(CENTER, tx * 8 + 4, ty * 8 + 4);
    DIR[i] = pr.seg.hd;
    PROG[i] = Math.floor(pr.s / 8) % 58;
  }
  const kindAt = (xpx, ypx) => (xpx < 0 || ypx < 0 || xpx > 127 || ypx > 127) ? K.GRASS : KIND[(ypx >> 3) * 16 + (xpx >> 3)];
  // Progress for ranking: laps * 464 + distance along the centre line,
  // corrected near the finish line with the next checkpoint
  function progress(lap, cp, xpx, ypx) {
    let s = project(CENTER, xpx, ypx).s;
    if (cp === 0 && s > TRACK_LEN / 2) s -= TRACK_LEN;
    if (cp === 3 && s < TRACK_LEN / 4) s += TRACK_LEN;
    return lap * TRACK_LEN + s;
  }

  /* ============================== fixed-point math ============================== */

  const SIN_T = new Int16Array(256);      // sin × 1024 (a const table in C)
  for (let i = 0; i < 256; i++) SIN_T[i] = Math.round(Math.sin(i * 2 * Math.PI / 256) * 1024);
  const ATAN_T = new Uint16Array(65);     // atan(i / 64) in 1/65536 turns
  for (let i = 0; i <= 64; i++) ATAN_T[i] = Math.round(Math.atan(i / 64) * 65536 / (2 * Math.PI));
  const isin = a => SIN_T[(a >> 8) & 255];
  const icos = a => SIN_T[((a >> 8) + 64) & 255];
  // angle of (x, y), screen axes (y down): 0 = east, 16384 = south
  function iatan2(y, x) {
    if (x === 0 && y === 0) return 0;
    const ax = abs(x), ay = abs(y);
    let a = ax >= ay ? ATAN_T[trunc(ay * 64 / ax)] : 16384 - ATAN_T[trunc(ax * 64 / ay)];
    if (x < 0) a = 32768 - a;
    if (y < 0) a = 65536 - a;
    return a & 0xffff;
  }
  const angDiff = (a, b) => ((a - b + 32768) & 0xffff) - 32768;   // signed shortest a - b

  /* ============================== car physics (§5.3) ============================== */

  function newCar(p) {
    return {
      x: START[p][0] * 256, y: START[p][1] * 256, hd: 0, v: 0, heat: 0, u: 0,
      lap: 0, cp: 0, tile: -1, steer: 1,
      stallUntil: 0, skidUntil: 0, skidDir: 1, boostUntil: 0, perfect: false, dashUntil: 0, snareUntil: 0, spinUntil: 0, splashUntil: 0,
      wrongMs: 0, wrong: false, vineTile: 255, vineHits: 0,
      stalls: 0, skills: 0, skillLap: -1, lapStart: 0, lastLapCs: 0, bestCs: 0, finishCs: 0, finished: false,
    };
  }
  function carFlags(c, t) {
    return (t < c.dashUntil ? CF.DASH : 0) | (t < c.skidUntil ? CF.SKID : 0) | (t < c.boostUntil ? CF.BOOST : 0)
      | (t < c.stallUntil ? CF.STALL : 0) | (t < c.snareUntil ? CF.SNARED : 0) | (t < c.splashUntil ? CF.SPLASHED : 0)
      | (c.wrong ? CF.WRONGWAY : 0) | (c.finished ? CF.FINISHED : 0);
  }
  // Effective top speed in px/s at this moment (before the throttle)
  function topSpeed(c, P, t, kind, env, tn) {
    tn = tn || petTune(P, env.pet);
    let top = (kind === K.GRASS || kind === K.TREE) ? P.grassSpeed : trunc(P.topSpeed * tn.topPct / 100);
    const boost = max(t < c.boostUntil ? P.boostPct : 0, t < c.dashUntil ? P.dashPct : 0);
    top = trunc(top * (100 + boost) / 100);
    if (env.draft && P.draftPct > 0) top = trunc(top * (100 + P.draftPct) / 100);
    if (env.catchup && P.catchupPct > 0) top = trunc(top * (100 + P.catchupPct) / 100);
    if (t < c.snareUntil) top = trunc(top * P.vinePct / 100);
    return top;
  }
  // One 20 ms step. ctl = {u: 0..100, brake, sx, sy (stick, + = up)};
  // env = {t (local race ms), laps, vineTile (rival's vine or 255), draft, catchup,
  // pet (this car's driver: per-pet handling, §5.9; missing = no trait)}.
  // Returns the events of this step (strings) for sounds and banners.
  function stepCar(c, P, ctl, env) {
    const ev = [];
    const t = env.t, dt = STEP_MS;
    let u = clamp(ctl.u | 0, 0, 100);
    if (c.finished) u = 0;
    if (t < c.stallUntil) u = min(u, 30);
    if (t < c.spinUntil) u = 0;
    c.u = u;
    const px = c.x >> 8, py = c.y >> 8;
    const ti = (py >> 3) * 16 + (px >> 3), kind = KIND[ti];
    const tn = petTune(P, env.pet);
    if (ti !== c.tile) {
      c.tile = ti;
      if (kind === K.PUDDLE && tn.puddleCool > 0 && c.heat > 0) { c.heat = max(0, c.heat - tn.puddleCool * 1000); ev.push("cooled"); }
      if (kind === K.PUDDLE && u > tn.puddleSafe && t >= c.skidUntil) {
        c.skidUntil = t + P.skidMs; c.skidDir = c.steer >= 0 ? 1 : -1;
        c.v = trunc(c.v * 70 / 100);
        ev.push("skid");
      }
      if (kind === K.BOOST_UP || kind === K.BOOST_DN) { c.boostUntil = max(c.boostUntil, t + P.boostMs); c.perfect = false; ev.push("boost"); }
    }
    // the rival's vines (checked locally: 50 ms reports would miss an 8 px tile)
    if (ti !== c.vineTile) c.vineTile = 255;
    if (env.vineTile !== 255 && ti === env.vineTile && c.vineTile !== ti) {
      c.vineTile = ti; c.vineHits = (c.vineHits + 1) & 255;
      if (t < c.dashUntil) ev.push("burned");
      else { c.snareUntil = t + P.snareMs; ev.push("snared"); }
    }
    // speed
    const grass = kind === K.GRASS || kind === K.TREE;
    const top = topSpeed(c, P, t, kind, env, tn);
    const target = trunc(top * 256 * u / 100);
    const st = k => trunc(k * 256 * dt / 1000);   // px/s^2 -> 1/256 px/s per step
    if (c.v < 0 && !ctl.brake) c.v = min(0, c.v + st(P.brake));
    else if (c.v < target) c.v = min(target, c.v + st(P.accel));
    else if (c.v > target) {
      const over = grass && c.v > P.grassSpeed * 256;
      c.v = max(target, c.v - st(over ? max(P.coast, P.grassDrag) : P.coast));
    }
    if (ctl.brake) {
      if (c.v > 0) c.v = max(0, c.v - st(P.brake));
      else c.v = max(-P.reverseSpeed * 256, c.v - st(P.accel));
    }
    // heat (milli-units, 100000 = full); boost and dash never heat up
    const hot = u > P.heatLine;
    if (hot && t >= c.boostUntil && t >= c.dashUntil) c.heat += trunc(P.heatRise * dt * tn.heatPct / 100);
    else if (!hot) c.heat = max(0, c.heat - trunc(P.heatCool * dt * tn.coolPct / 100));
    if (c.heat >= 100000) { c.heat = 0; c.stallUntil = t + P.stallMs; c.stalls++; ev.push("overheat"); }
    // steering: the stick is the wanted heading; slower turning at speed
    const vpx = min(abs(c.v) >> 8, P.topSpeed);
    let turn = trunc((P.turnLo - trunc((P.turnLo - P.turnHi) * vpx / P.topSpeed)) * tn.turnPct / 100);
    if (t < c.skidUntil || t < c.snareUntil) turn = trunc(turn / 2);
    const maxStep = trunc(turn * 65536 * dt / 360000);
    const sx = ctl.sx | 0, sy = ctl.sy | 0;
    if (sx * sx + sy * sy > P.stickDead * P.stickDead) {
      const want = iatan2(-sy, sx);
      const d = angDiff(want, c.hd);
      if (d !== 0) c.steer = d > 0 ? 1 : -1;
      c.hd = (c.hd + clamp(d, -maxStep, maxStep)) & 0xffff;
    }
    if (t < c.skidUntil) c.hd = (c.hd + c.skidDir * trunc(90 * 65536 * dt / 360000)) & 0xffff;
    // move; the screen edge stops the car in that direction
    const ox = c.x;
    c.x += trunc(c.v * icos(c.hd) * dt / 1024000);
    c.y += trunc(c.v * isin(c.hd) * dt / 1024000);
    const lo = 4 * 256, hi = 124 * 256 - 1;
    if (c.x < lo || c.x > hi) { c.x = clamp(c.x, lo, hi); c.v = trunc(c.v * abs(isin(c.hd)) / 1024); }
    if (c.y < lo || c.y > hi) { c.y = clamp(c.y, lo, hi); c.v = trunc(c.v * abs(icos(c.hd)) / 1024); }
    // checkpoints in order, then the finish line
    const nx = c.x >> 8, ny = c.y >> 8, nti = (ny >> 3) * 16 + (nx >> 3), nk = KIND[nti];
    if (!c.finished) {
      if (c.cp === 0 && nk === K.CP1) c.cp = 1;
      else if (c.cp === 1 && nk === K.CP2) c.cp = 2;
      else if (c.cp === 2 && nk === K.CP3) c.cp = 3;
      else if (c.cp === 3 && ox < FINISH_X * 256 && c.x >= FINISH_X * 256 && ny < 32) {
        const lapCs = trunc((t + dt - c.lapStart) / 10);
        c.lap++; c.cp = 0; c.lapStart = t + dt; c.lastLapCs = lapCs;
        if (!c.bestCs || lapCs < c.bestCs) c.bestCs = lapCs;
        if (c.lap >= env.laps) { c.finished = true; c.finishCs = max(1, trunc((t + dt) / 10)); ev.push("finish"); }
        else { ev.push("lap"); if (c.lap === env.laps - 1) ev.push("finalLap"); }
      }
    }
    // wrong way: heading > 120° off the road direction for 0.5 s
    if (isRoad(nk) && abs(c.v) > 4 * 256) {
      const hd = c.v < 0 ? (c.hd + 32768) & 0xffff : c.hd;
      c.wrongMs = abs(angDiff(hd, DIR[nti])) > 21845 ? c.wrongMs + dt : 0;
      const w = c.wrongMs >= 500;
      if (w && !c.wrong) ev.push("wrongWay");
      if (w || c.wrongMs === 0) c.wrong = w;
    }
    return ev;
  }
  // The tile behind the car (Vine Snare drops its vines there)
  function tileBehind(c) {
    const bx = (c.x >> 8) - trunc(10 * icos(c.hd) / 1024), by = (c.y >> 8) - trunc(10 * isin(c.hd) / 1024);
    const k = kindAt(bx, by);
    if (bx >= 0 && by >= 0 && bx < 128 && by < 128 && isRoad(k)) return (by >> 3) * 16 + (bx >> 3);
    return ((c.y >> 11) * 16 + (c.x >> 11)) & 255;
  }
  // race_config.h text (§5.7) for the export button
  function configH(params) {
    const P = Object.assign({}, DEFAULTS, params || {});
    const lines = ["// race_config.h: Pocket Rivals racing tunables (exported from the device simulator)", "#pragma once", ""];
    for (const p of PARAMS) {
      if (p[0] === "botPct") continue;   // simulator only
      const def = ("#define " + p[1] + " ").padEnd(31) + String(P[p[0]]).padEnd(6);
      lines.push(p[9] ? def + "// " + p[9] : def.trimEnd());
    }
    return lines.join("\n") + "\n";
  }

  /* ============================== central board ============================== */

  function centralCreate(api, opts) {
    const P = Object.assign({}, DEFAULTS, opts.params || {});
    const blankCar = p => ({x: START[p][0], y: START[p][1], hd: 0, speed: 0, lap: 0, cp: 0, flags: 0, finish: 0, best: 0, stalls: 0, skills: 0, vineHits: 0});
    const s = {
      phase: PH.PICK, pet: [NO_PET, NO_PET], pickedAt: null, cdEnd: -1, raceMs: 0, lastG: api.gameNow(),
      cars: [blankCar(0), blankCar(1)], vines: [{tile: 255, until: 0}, {tile: 255, until: 0}],
      passT: [[0], [0]], firstFinishMs: -1, finishOrder: [], skillLap: [-1, -1],
      ev: {id: 0, type: 0, target: 0, amount: 0}, evQ: [], evAt: -1e9, winner: null, quitBy: null,
    };
    const g = () => api.gameNow();
    function emit(type, target, amount) { s.evQ.push({type, target, amount: amount & 255}); }
    function startCountdown(isStart) {
      s.cdEnd = g() + P.countdownMs;
      if (isStart) s.phase = PH.COUNTDOWN;
      api.nextStep();
      api.broadcast();
    }
    const passes = c => c.lap * 4 + c.cp;
    function prog(i) { const c = s.cars[i]; return progress(c.lap, c.cp, c.x, c.y); }
    function leader() {
      const f = s.cars.map(c => c.finish);
      if (f[0] && f[1]) return f[0] < f[1] ? 0 : f[1] < f[0] ? 1 : s.finishOrder[0];
      if (f[0] || f[1]) return f[0] ? 0 : 1;
      return prog(1) > prog(0) ? 1 : 0;
    }
    function gap() {
      const k = min(passes(s.cars[0]), passes(s.cars[1]));
      if (k < 1 || s.passT[0][k] == null || s.passT[1][k] == null) return GAP_NONE;
      return clamp(s.passT[0][k] - s.passT[1][k], -32767, 32767);
    }
    function endRace() {
      if (s.phase === PH.RESULTS) return;
      s.winner = leader();
      s.phase = PH.RESULTS;
      api.nextStep();
      api.broadcast();
    }
    const inRace = () => s.phase === PH.COUNTDOWN || s.phase === PH.RACE || s.phase === PH.FINISH;
    return {
      tick() {
        const now = g(), dt = now - s.lastG;
        s.lastG = now;
        if (s.phase === PH.PICK) {
          if (s.pickedAt != null && now - s.pickedAt >= REVEAL_MS) startCountdown(true);
        } else if (inRace()) {
          if (s.cdEnd >= 0) {
            if (now >= s.cdEnd) { s.cdEnd = -1; if (s.phase === PH.COUNTDOWN) s.phase = PH.RACE; api.broadcast(); }
          } else {
            s.raceMs += dt;
            for (const v of s.vines) if (v.tile !== 255 && s.raceMs >= v.until) { v.tile = 255; api.broadcast(); }
            if (s.phase === PH.FINISH && s.raceMs - s.firstFinishMs >= P.finishWaitMs) endRace();
            else if (s.raceMs >= P.timeLimitS * 1000) endRace();
          }
        }
        // one event at a time, each on the air for at least 200 ms
        if (s.evQ.length && now - s.evAt >= 200) {
          const e = s.evQ.shift();
          s.ev = {id: s.ev.id % 255 + 1, type: e.type, target: e.target, amount: e.amount};
          s.evAt = now;
          api.broadcast();
        }
      },
      action(p, a, arg, data) {
        if (a === A.RACE_PICK) {
          if (s.phase !== PH.PICK || arg > 2 || s.pet[p] !== NO_PET) return false;
          s.pet[p] = arg;
          if (s.pet[0] !== NO_PET && s.pet[1] !== NO_PET) { s.pickedAt = g(); api.nextStep(); }
          api.broadcast();
          return true;
        }
        if (a === A.RACE_SKILL) {
          if ((s.phase !== PH.RACE && s.phase !== PH.FINISH) || s.cdEnd >= 0) return false;
          const lap = data && data[0] != null ? data[0] : 0;
          if (lap <= s.skillLap[p] || lap > s.cars[p].lap + 1) return false;   // once per lap
          s.skillLap[p] = lap;
          const q = 1 - p, pet = s.pet[p];
          if (pet === PET_EMBER) emit(EV.DASH, p, 0);
          else if (pet === PET_TIDE) {
            if (s.pet[q] === PET_SPROUT) emit(EV.ABSORB, q, 0);
            else emit(EV.SPLASH, q, (s.cars[q].flags & CF.DASH) ? 1 : 0);
          } else if (pet === PET_SPROUT) {
            if (!isRoad(KIND[arg & 255])) return false;
            s.vines[p] = {tile: arg & 255, until: s.raceMs + P.vineMs};
            emit(EV.VINE, q, arg);
          }
          return true;
        }
        return false;
      },
      message(p, name, f) {
        if (name !== "race.input" || !inRace()) return;
        const c = s.cars[p];
        const lap = min(f.lap, P.laps), cp = f.cp & 3;
        const was = passes(c), now = lap * 4 + cp;
        for (let k = was + 1; k <= now && k <= 40; k++) s.passT[p][k] = f.tCs;
        Object.assign(c, {x: f.x, y: f.y, hd: f.hd, speed: f.speed, lap, cp, flags: f.flags, best: f.best, stalls: f.stalls, skills: f.skills});
        if (f.vineHits !== c.vineHits) {
          c.vineHits = f.vineHits;
          if (s.vines[1 - p].tile !== 255) { s.vines[1 - p].tile = 255; api.broadcast(); }
        }
        if ((f.flags & CF.FINISHED) && !c.finish && f.finish > 0 && s.phase !== PH.COUNTDOWN) {
          c.finish = f.finish;
          s.finishOrder.push(p);
          if (s.firstFinishMs < 0) { s.firstFinishMs = s.raceMs; s.phase = PH.FINISH; }
          if (s.cars[0].finish && s.cars[1].finish) endRace();
          api.broadcast();
        }
      },
      snapshot() {
        const both = s.pet[0] !== NO_PET && s.pet[1] !== NO_PET;
        return {
          phase: s.phase, flags: (s.pet[0] !== NO_PET ? 8 : 0) | (s.pet[1] !== NO_PET ? 16 : 0),
          laps: P.laps, track: 0,
          countdown: s.cdEnd >= 0 ? clamp(s.cdEnd - g(), 0, 65535) : 0,
          raceCs: trunc(s.raceMs / 10) & 0xffff,
          cars: s.cars.map((c, i) => ({x: c.x, y: c.y, hd: c.hd, speed: c.speed, lap: c.lap, cp: c.cp, flags: c.flags,
            pet: both ? s.pet[i] : NO_PET, finish: c.finish, best: c.best, stalls: c.stalls, skills: c.skills})),
          vines: s.vines.map(v => ({tile: v.tile, ttl: v.tile === 255 ? 0 : clamp(Math.ceil((v.until - s.raceMs) / 1000), 0, 255)})),
          gap: gap(), leader: s.phase === PH.RESULTS && s.winner != null ? s.winner : leader(),
          evId: s.ev.id, evType: s.ev.type, evTarget: s.ev.target, evAmount: s.ev.amount,
        };
      },
      over() {
        if (s.phase !== PH.RESULTS) return null;
        const b = c => min(255, trunc(c.best / 10));
        return {winner: s.winner, coop: false, quit: s.quitBy, res: [b(s.cars[0]), b(s.cars[1]), min(255, s.cars[0].stalls), min(255, s.cars[1].stalls)]};
      },
      quit(p) {
        if (s.phase === PH.RESULTS) return;
        s.quitBy = p;
        s.winner = 1 - p;
        s.phase = PH.RESULTS;
        s.evQ = [];
        s.ev = {id: s.ev.id % 255 + 1, type: EV.QUIT, target: p, amount: 0};   // the boards title S19 from this
        api.nextStep();
        api.broadcast();
      },
      canPause: () => "now",
      pause() {},
      resume() { if (inRace()) startCountdown(s.phase === PH.COUNTDOWN); },
      // fixtures / tests: DEVICE.debug(cmd, arg)
      debug(cmd, arg) {
        if (cmd === "pick") {            // arg = P1 pet + 4 * P2 pet; skip the reveal wait
          if (s.phase !== PH.PICK) return "not pick";
          s.pet = [arg & 3, (arg >> 2) & 3].map(v => (v > 2 ? 0 : v));
          s.pickedAt = g() - REVEAL_MS;
          api.nextStep();
          return "ok";
        }
        if (cmd === "go") { if (s.cdEnd >= 0) s.cdEnd = g(); return "ok"; }
        if (cmd === "finish") {          // arg = the winner; the other one does not finish
          const w = arg & 1;
          s.cars[w].finish = max(1, trunc(s.raceMs / 10));
          s.finishOrder = [w];
          endRace();
          return "ok";
        }
        if (cmd === "splash") { emit(EV.SPLASH, arg & 1, 0); return "ok"; }
        if (cmd === "state") return JSON.parse(JSON.stringify(s));
        return "unknown";
      },
    };
  }

  /* ============================== player board ============================== */

  function paramsOf(ctx) { return Object.assign({}, DEFAULTS, ctx.params("racing")); }
  function colors(ctx) {
    const L = ctx.lobby;
    const named = q => L && L.profile[q] && L.profile[q].name && L.profile[q].name.some(b => b);
    const c0 = named(0) ? L.profile[0].color % 6 : 0;
    let c1 = named(1) ? L.profile[1].color % 6 : 4;
    if (c1 === c0) c1 = (c0 + 1) % 6;   // P2 takes the next free color for this match (§2.2)
    return [D.PLAYER_COLORS[c0], D.PLAYER_COLORS[c1]];
  }
  const racing = st => st && (st.phase === PH.COUNTDOWN || st.phase === PH.RACE || st.phase === PH.FINISH);
  const myPet = (ctx, m) => {
    const st = ctx.state;
    const v = st && st.cars[ctx.p].pet;
    return v != null && v !== NO_PET ? v : m.myPet;
  };

  function playerCreate(ctx) {
    return {
      P: paramsOf(ctx), car: newCar(ctx.p), pl: D.padLevel.create(), acc: 0, raceT: 0,
      goAt: null, cdStep: -1, cdIsStart: false, went: false, cdShown: 0, goShowUntil: 0, frozenNoSig: false,
      evSeen: -1, banner: null, parts: [], partAt: 0, lastSend: -1e9, toneHz: 0, warnAt: 0, myPet: NO_PET,
      noteKey: null, noteDone: false,
    };
  }
  function banner(ctx, key, c = "gold", ms = 1500, vars) {
    ctx.m.banner = {key, c, vars, until: ctx.now() + ms};
  }
  function onEvents(ctx, evs) {
    const m = ctx.m;
    for (const e of evs) {
      if (e === "skid") { banner(ctx, "dev.race.skid", "waterLt"); ctx.sfx("skid"); }
      else if (e === "boost") ctx.sfx("boost");
      else if (e === "overheat") { banner(ctx, "dev.race.overheat", "danger"); ctx.sfx("overheat"); ctx.hw.shake(); }
      else if (e === "wrongWay") ctx.sfx("wrong_way");
      else if (e === "snared") { banner(ctx, "dev.race.snared", "grassLt"); ctx.sfx("skid"); }
      else if (e === "burned") { banner(ctx, "dev.race.burned", "gold"); ctx.sfx("boost"); }
      else if (e === "cooled") {
        // Tide in a puddle: a ring of waterLt drops around the car (decoration)
        const c = m.car, x = c.x >> 8, y = c.y >> 8;
        for (const [dx, dy] of [[-5, -3], [5, -3], [-6, 2], [6, 2], [0, 5]]) m.parts.push({x: x + dx, y: y + dy, at: ctx.now(), c: "waterLt"});
        while (m.parts.length > 12) m.parts.shift();
      }
      else if (e === "lap") {
        ctx.fx.border("white");
        ctx.sfx("lap");
        banner(ctx, "dev.race.lapTime", "white", 1200, {t: fmtSec(m.car.lastLapCs)});
      } else if (e === "finalLap") { banner(ctx, "dev.race.finalLap", "gold"); ctx.sfx("final_lap"); }
      else if (e === "finish") { ctx.fx.border("gold", 300); banner(ctx, "dev.race.finish", "gold", 3000); ctx.sfx("finish"); }
    }
  }
  function handleEvent(ctx, msg) {
    const m = ctx.m, P = m.P, c = m.car, me = ctx.p;
    if (msg.evType === EV.SPLASH) {
      if (msg.evTarget === me) {
        c.splashUntil = m.raceT + P.splashMs;
        if (c.dashUntil > m.raceT) { c.dashUntil = 0; banner(ctx, "dev.race.dashStopped", "water"); }
        else banner(ctx, "dev.race.splashed", "waterLt");
        ctx.sfx("skill_race");
      } else if (msg.evAmount & 1) banner(ctx, "dev.race.stoppedDash", "waterLt");
    } else if (msg.evType === EV.ABSORB) {
      banner(ctx, "dev.race.absorbed", "grassLt");
    }
  }
  function playerOnState(ctx, msg, prev) {
    const m = ctx.m;
    if (!m) return;
    if (m.evSeen < 0) m.evSeen = msg.evId;
    else if (msg.evId !== m.evSeen) { m.evSeen = msg.evId; handleEvent(ctx, msg); }
    if (msg.cars[ctx.p].pet !== NO_PET) m.myPet = msg.cars[ctx.p].pet;
    if (racing(msg) && msg.countdown > 0 && msg.step !== m.cdStep) {
      m.cdStep = msg.step;
      m.goAt = ctx.gameNow() + msg.countdown;
      m.cdIsStart = msg.phase === PH.COUNTDOWN;
      m.went = false;
      m.cdShown = 4;
    }
    // came up mid-race (board reboot): take the race clock and our car from the state
    if (!m.went && m.goAt == null && (msg.phase === PH.RACE || msg.phase === PH.FINISH) && msg.countdown === 0) {
      m.went = true;
      m.raceT = msg.raceCs * 10;
      const sc = msg.cars[ctx.p], c = m.car;
      if (prev == null && (sc.lap || sc.cp || sc.x !== START[ctx.p][0])) {
        Object.assign(c, {x: sc.x * 256 + 128, y: sc.y * 256 + 128, hd: sc.hd << 8, lap: sc.lap, cp: sc.cp,
          stalls: sc.stalls, skills: sc.skills, bestCs: sc.best, lapStart: m.raceT});
        if (sc.finish) { c.finished = true; c.finishCs = sc.finish; }
      }
    }
  }
  function doGo(ctx) {
    const m = ctx.m, P = m.P, c = m.car, st = ctx.state;
    m.goAt = null;
    m.went = true;
    m.raceT = st ? st.raceCs * 10 : m.raceT;
    ctx.sfx("count_go");
    if (m.cdIsStart) {
      ctx.sfx("race_go");
      ctx.hw.invert(60);
      m.goShowUntil = ctx.now() + 900;
      c.lapStart = m.raceT;
      const u = c.u;
      if (u > P.startSpin) { c.spinUntil = m.raceT + P.spinMs; m.goShowUntil = 0; banner(ctx, "dev.race.wheelspin", "danger"); }
      else if (u >= P.startLo && u <= P.startHi) {
        c.boostUntil = m.raceT + P.perfectMs; c.perfect = true;
        m.goShowUntil = 0;
        banner(ctx, "dev.race.perfectStart", "gold"); ctx.sfx("boost");
      }
    } else m.goShowUntil = ctx.now() + 600;
  }
  function rivalView(ctx) {
    const st = ctx.state;
    if (!st) return null;
    const q = 1 - ctx.p, rc = st.cars[q];
    const age = min(100, max(0, ctx.stateAge()));
    const live = st.phase === PH.RACE || st.phase === PH.FINISH;
    const hd = rc.hd << 8;
    const adv = live && !(st.flags & C.FLAG.PAUSED) && st.countdown === 0 ? rc.speed * age : 0;
    return {
      x: clamp(rc.x + trunc(adv * icos(hd) / 1024000), 4, 123), y: clamp(rc.y + trunc(adv * isin(hd) / 1024000), 4, 123),
      hd, pet: rc.pet, flags: rc.flags, lap: rc.lap, cp: rc.cp,
    };
  }
  function playerTick(ctx, dt) {
    const m = ctx.m, st = ctx.state;
    if (!m || !st) return;
    const P = m.P, c = m.car;
    if (!racing(st)) { if (m.toneHz) { ctx.tone(0); m.toneHz = 0; } m.acc = 0; return; }
    const paused = !!(st.flags & C.FLAG.PAUSED), nosig = ctx.stateAge() > C.CENTRAL_TIMEOUT_MS;
    if (m.goAt != null && !paused && !nosig) {
      const left = m.goAt - ctx.gameNow();
      const sec = left > 0 ? Math.ceil(left / 1000) : 0;
      if (sec > 0 && sec < m.cdShown) { m.cdShown = sec; ctx.sfx("count_tick"); }
      if (left <= 0) doGo(ctx);
    }
    const live = m.went && m.goAt == null && !paused && !nosig && (st.phase === PH.RACE || st.phase === PH.FINISH);
    if (nosig) m.frozenNoSig = true;
    else if (m.frozenNoSig) { m.frozenNoSig = false; if (live) m.raceT = st.raceCs * 10; }
    m.acc += dt;
    while (m.acc >= STEP_MS) {
      m.acc -= STEP_MS;
      const u = ctx.padLevel(m.pl, STEP_MS);
      if (!live) { c.u = c.finished ? 0 : u; continue; }
      const rv = rivalView(ctx);
      const env = {t: m.raceT, laps: st.laps, vineTile: st.vines[1 - ctx.p].tile, draft: false, catchup: false, pet: myPet(ctx, m)};
      if (rv && P.draftPct > 0) {
        // rival 10-40 px ahead in my heading, within 6 px of my line
        const dx = rv.x - (c.x >> 8), dy = rv.y - (c.y >> 8);
        const along = trunc((dx * icos(c.hd) + dy * isin(c.hd)) / 1024), side = trunc((dy * icos(c.hd) - dx * isin(c.hd)) / 1024);
        env.draft = along >= 10 && along <= 40 && abs(side) <= 6 && c.v > 0;
      }
      if (rv && P.catchupPct > 0) env.catchup = progress(rv.lap, rv.cp, rv.x, rv.y) - progress(c.lap, c.cp, c.x >> 8, c.y >> 8) > TRACK_LEN / 2;
      const inp = ctx.input;
      const evs = stepCar(c, P, {u, brake: !!inp.b, sx: inp.x, sy: inp.y}, env);
      m.raceT += STEP_MS;
      if (evs.length) onEvents(ctx, evs);
      // smoke when hot, gold trail when boosted (decoration only)
      const t = m.raceT;
      if (ctx.now() - m.partAt >= 100 && abs(c.v) > 256 * 4 && (c.heat > P.heatSmoke * 1000 || t < c.boostUntil || t < c.dashUntil)) {
        m.partAt = ctx.now();
        const bx = (c.x >> 8) - trunc(6 * icos(c.hd) / 1024), by = (c.y >> 8) - trunc(6 * isin(c.hd) / 1024);
        m.parts.push({x: bx + ctx.rng.int(3) - 1, y: by + ctx.rng.int(3) - 1, at: ctx.now(), c: c.heat > P.heatSmoke * 1000 ? "muted" : "gold"});
        if (m.parts.length > 8) m.parts.shift();
      }
    }
    if (!live) c.u = c.finished ? 0 : c.u;
    // uplink: race.input every RACE_UPLINK_MS (also the heartbeat in a race)
    const now = ctx.now();
    if (now - m.lastSend >= P.uplinkMs) {
      m.lastSend = now;
      const t = m.raceT;
      ctx.send("race.input", {
        step: st.step, tCs: trunc(t / 10) & 0xffff, x: clamp(c.x >> 8, 0, 255), y: clamp(c.y >> 8, 0, 255),
        hd: (c.hd >> 8) & 255, speed: clamp(c.v >> 8, 0, 255), lap: min(c.lap, 255), cp: c.cp, flags: carFlags(c, t),
        vineHits: c.vineHits, finish: min(c.finishCs, 65535), best: min(c.bestCs, 65535), stalls: min(c.stalls, 255), skills: min(c.skills, 255),
      });
    }
    // engine tone (BEEP, 60-220 Hz with speed) and the heat warning beeps
    const hz = live && ctx.settings.clicks !== false ? 60 + trunc(160 * min(abs(c.v) >> 8, P.topSpeed) / P.topSpeed) : 0;
    if (hz !== m.toneHz) { m.toneHz = hz; ctx.tone(hz); }
    if (live && c.heat > P.heatWarn * 1000 && now - m.warnAt >= 300) { m.warnAt = now; ctx.sfx("heat_warn"); }
  }
  function useSkill(ctx) {
    const m = ctx.m, st = ctx.state, c = m && m.car;
    if (!m || !st) return;
    const live = m.went && m.goAt == null && (st.phase === PH.RACE || st.phase === PH.FINISH) && !(st.flags & C.FLAG.PAUSED);
    if (!live || c.finished) { ctx.sfx("ui_deny"); return; }
    if (c.skillLap === c.lap) { banner(ctx, "dev.race.skillUsed", "muted", 1000); ctx.sfx("ui_deny"); return; }
    const pet = myPet(ctx, m), P = m.P;
    if (pet === NO_PET) return;
    c.skillLap = c.lap;
    c.skills++;
    if (pet === PET_EMBER) { c.dashUntil = m.raceT + P.dashMs; c.heat = 0; ctx.rt(A.RACE_SKILL, 0, [c.lap, 0, 0]); }
    else if (pet === PET_TIDE) ctx.rt(A.RACE_SKILL, 0, [c.lap, 0, 0]);
    else { const tile = tileBehind(c); m.vinePending = {tile, until: ctx.now() + 400}; ctx.rt(A.RACE_SKILL, tile, [c.lap, 0, 0]); }
    ctx.sfx("skill_race");
  }

  /* ============================== drawing ============================== */

  const fmtSec = cs => { if (!cs) return "--"; const s = cs / 100; return s >= 100 ? String(Math.floor(s)) : (Math.floor(cs / 10) / 10).toFixed(1); };
  const fmtClock = ms => { const ds = Math.floor(max(0, ms) / 100); return Math.floor(ds / 600) + ":" + String(Math.floor(ds / 10) % 60).padStart(2, "0") + "." + (ds % 10); };
  const hash = (a, b) => ((a * 73856093) ^ (b * 19349663)) >>> 0;

  function drawTile(g, tx, ty, now) {
    const k = KIND[ty * 16 + tx], x = tx * 8, y = TRACK_Y + ty * 8;
    if (k === K.GRASS || k === K.TREE) {
      g.rect(x, y, 8, 8, "grassDk");
      const h = hash(tx, ty);
      g.px(x + (h & 7), y + ((h >> 3) & 7), "grass");
      g.px(x + ((h >> 6) & 7), y + ((h >> 9) & 7), "grass");
      if (k === K.TREE) {
        g.rect(x + 1, y + 1, 6, 5, "grass"); g.rect(x + 2, y, 4, 7, "grass");
        g.rect(x + 2, y + 1, 2, 2, "grassLt"); g.px(x + 1, y + 2, "grassLt");
        g.rect(x + 3, y + 6, 2, 2, "fireDk");
      }
      return;
    }
    g.rect(x, y, 8, 8, "line");
    if (k === K.LINE) {
      for (let r = 0; r < 4; r++) for (let q = 0; q < 4; q++) g.rect(x + q * 2, y + r * 2, 2, 2, (r + q + ty) & 1 ? "white" : "void");
    } else if (k === K.PUDDLE) {
      g.rect(x + 1, y + 1, 6, 6, "water"); g.rect(x, y + 2, 8, 4, "water"); g.rect(x + 2, y, 4, 8, "water");
      g.hline(x + 2, y + 2, 2, "waterLt"); g.hline(x + 4, y + 5, 2, "waterLt");
    } else if (k === K.BOOST_UP || k === K.BOOST_DN) {
      const c = Math.floor(now / 200) & 1 ? "gold" : "fire";
      for (const oy of [0, 4]) {
        const rows = k === K.BOOST_UP ? [[3, 2], [2, 4], [1, 6]] : [[1, 6], [2, 4], [3, 2]];
        rows.forEach(([cx, w], i) => g.hline(x + cx, y + oy + i, w, c));
      }
    }
  }
  // road edges: a 1 px muted kerb wherever road meets grass
  function drawKerbs(g) {
    for (let ty = 0; ty < 16; ty++) for (let tx = 0; tx < 16; tx++) {
      if (!isRoad(KIND[ty * 16 + tx])) continue;
      const x = tx * 8, y = TRACK_Y + ty * 8;
      const grassAt = (dx, dy) => { const nx = tx + dx, ny = ty + dy; return nx < 0 || ny < 0 || nx > 15 || ny > 15 || !isRoad(KIND[ny * 16 + nx]); };
      if (grassAt(0, -1)) g.hline(x, y, 8, "muted");
      if (grassAt(0, 1)) g.hline(x, y + 7, 8, "muted");
      if (grassAt(-1, 0)) g.vline(x, y, 8, "muted");
      if (grassAt(1, 0)) g.vline(x + 7, y, 8, "muted");
    }
  }
  function drawVine(g, tile, mine) {
    const x = (tile & 15) * 8, y = TRACK_Y + (tile >> 4) * 8;
    g.rect(x + 1, y + 1, 6, 6, "grassDk");
    for (const [dx, dy] of [[1, 1], [3, 2], [5, 1], [2, 4], [6, 4], [1, 6], [4, 6]]) g.px(x + dx, y + dy, "grassLt");
    for (const [dx, dy] of [[2, 2], [4, 3], [6, 2], [3, 5], [5, 5], [2, 6]]) g.px(x + dx, y + dy, "grass");
    if (mine) g.px(x + 4, y + 4, "white");
  }
  // 8 headings from frame 0 (nose up) and frame 1 (nose up-right) of race.car.<pet>
  const CAR_ORI = [
    [0, {transpose: true, flipX: true}], [1, {flipY: true}], [0, {flipY: true}], [1, {flipX: true, flipY: true}],
    [0, {transpose: true}], [1, {flipX: true}], [0, {}], [1, {}],
  ];
  // Kart + rider centred on (cx, cy); color = the player's color (drop
  // shadow); opt.color paints kart and rider in one color (stall blink);
  // opt.rider false = kart only. No pet yet (NO_PET) = a grey kart, no rider.
  function drawCar(g, cx, cy, hd, color, petIdx, opt = {}) {
    const dir = ((hd + 4096) >> 13) & 7;   // 0 E, 1 SE, 2 S, 3 SW, 4 W, 5 NW, 6 N, 7 NE
    const pet = D.PETS[petIdx];
    const s = opt.scale || 1;
    const [frame, o] = CAR_ORI[dir];
    const car = "race.car." + (pet ? pet.id : "ember"), rider = pet && opt.rider !== false ? "race.rider." + pet.id : null;
    const bx = cx - 5 * s, by = cy - 5 * s, rx = cx - 2 * s, ry = cy - 4 * s;
    // the shadow is 1 px at any scale (a thin edge on the pick cards and results)
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1]]) {
      g.sprite(car, bx + dx, by + dy, Object.assign({frame, scale: s, color}, o));
      if (rider) g.sprite(rider, rx + dx, ry + dy, {scale: s, color});
    }
    const paint = opt.color ? {color: opt.color} : pet ? {} : {map: {b: "muted", d: "line", l: "muted"}};
    g.sprite(car, bx, by, Object.assign({frame, scale: s}, o, paint));
    if (rider) g.sprite(rider, rx, ry, Object.assign({scale: s}, opt.color ? {color: opt.color} : {}));
  }
  function drawLights(g, n) {
    // panel + 3 lights (10x10) at x 44 / 59 / 74, y 46: danger -> gold -> grassLt
    g.rect(24, 40, 80, 24, "panel"); g.hline(24, 40, 80, "accent"); g.hline(24, 63, 80, "accent");
    const cols = ["danger", "gold", "grassLt"];
    const widths = [4, 8, 10, 10, 10, 10, 10, 10, 8, 4];
    for (let i = 0; i < 3; i++) {
      const c = i < n ? cols[i] : "line";
      widths.forEach((w, r) => g.hline(44 + 15 * i + (10 - w) / 2, 46 + r, w, c));
    }
  }
  // announcement strip on the inner grass (x 24-103, y 40-63), text budget 78
  function drawBanner(g, ctx, key, vars, c) {
    g.rect(24, 40, 80, 24, "panel"); g.hline(24, 40, 80, "accent"); g.hline(24, 63, 80, "accent");
    g.text(64, 45, ctx.t(key, vars), {align: "c", c, w: 78, key});
  }

  function drawHud(ctx, g) {
    const m = ctx.m, st = ctx.state;
    const now = ctx.now();
    const P = m ? m.P : DEFAULTS;
    const cols = colors(ctx), me = ctx.p;
    // track (static; the block compare pushes only what moves)
    for (let ty = 0; ty < 16; ty++) for (let tx = 0; tx < 16; tx++) drawTile(g, tx, ty, now);
    drawKerbs(g);
    if (!m || !st) { drawTopBar(g, ctx, null, null); return; }
    const c = m.car, t = m.raceT;
    for (let q = 0; q < 2; q++) {
      const v = st.vines[q];
      if (v.tile !== 255) drawVine(g, v.tile, q === me);
    }
    if (m.vinePending && now < m.vinePending.until && st.vines[me].tile === 255) drawVine(g, m.vinePending.tile, true);
    m.parts = m.parts.filter(pt => now - pt.at < 500);
    for (const pt of m.parts) g.rect(pt.x - 1, TRACK_Y + pt.y - 1, 2, 2, pt.c);
    // rival below, me on top
    const rv = rivalView(ctx);
    const myX = c.x >> 8, myY = c.y >> 8;
    if (rv && st.phase !== PH.PICK) drawCar(g, rv.x, TRACK_Y + rv.y, rv.hd, cols[1 - me], rv.pet);
    const blinkStall = t < c.stallUntil && (Math.floor(now / 120) & 1);
    drawCar(g, myX, TRACK_Y + myY, c.hd, cols[me], myPet(ctx, m), blinkStall ? {color: "muted"} : {});
    const counting = m.goAt != null || !m.went;
    const overlap = rv && abs(rv.x - myX) < 11 && abs(rv.y - myY) < 11;
    if (counting || overlap) {
      // above the rider, pointing down; when the rival sits just above (P2 on
      // the start grid) it goes right of the kart, pointing left, so it never
      // lands on the rival (below would be under the start lights)
      const side = rv && rv.y < myY && myY - rv.y < 14 && abs(rv.x - myX) < 11;
      if (side) {
        const ax = myX + 7, y = TRACK_Y + myY;
        g.px(ax, y, "white"); g.vline(ax + 1, y - 1, 3, "white"); g.vline(ax + 2, y - 2, 5, "white");
      } else {
        const ay = TRACK_Y + myY - 9;
        g.hline(myX - 2, ay, 5, "white"); g.hline(myX - 1, ay + 1, 3, "white"); g.px(myX, ay + 2, "white");
      }
    }
    // Splash: track under water except a window around my car
    if (t < c.splashUntil && m.went) {
      const w = P.splashWindow, wx = clamp(myX - (w >> 1), 0, 128 - w), wy = clamp(myY - (w >> 1), 0, 128 - w);
      const Y = TRACK_Y;
      g.dither(0, Y, 128, wy, "waterDk", "water");
      g.dither(0, Y + wy + w, 128, 128 - wy - w, "waterDk", "water");
      g.dither(0, Y + wy, wx, w, "waterDk", "water");
      g.dither(wx + w, Y + wy, 128 - wx - w, w, "waterDk", "water");
      g.frame(wx, Y + wy, w, w, "waterLt");
    }
    // announcements (inner grass, never on the road)
    const paused = !!(st.flags & C.FLAG.PAUSED);
    if (m.goAt != null && !paused) {
      const left = m.goAt - ctx.gameNow();
      drawLights(g, left > 2000 ? 1 : left > 1000 ? 2 : 3);
    } else if (now < m.goShowUntil) {
      g.rect(24, 40, 80, 24, "panel"); g.hline(24, 40, 80, "accent"); g.hline(24, 63, 80, "accent");
      g.text(64, 38, ctx.t("dev.race.go"), {align: "c", scale: 2, c: "grassLt", w: 78, key: "dev.race.go"});
    } else if (c.wrong && !c.finished && m.went) {
      drawBanner(g, ctx, "dev.race.wrongWay", null, Math.floor(now / 300) & 1 ? "danger" : "white");
    } else if (m.banner && now < m.banner.until) {
      drawBanner(g, ctx, m.banner.key, m.banner.vars, m.banner.c);
    } else if (st.phase === PH.FINISH && !c.finished && m.went) {
      // the rival is through: show how long is left
      const left = max(0, P.finishWaitMs - (st.raceCs * 10 - (st.cars[1 - me].finish * 10)));
      drawBanner(g, ctx, "dev.race.waitLeft", {n: Math.ceil(left / 1000)}, "danger");
    }
    drawTopBar(g, ctx, m, st);
    drawBottomBar(g, ctx, m, st);
  }
  function drawTopBar(g, ctx, m, st) {
    g.rect(0, 0, 128, 13, "panel");
    g.hline(0, 13, 128, "line");
    if (!m || !st) return;
    const c = m.car, laps = st.laps || 1;
    const lapN = c.finished ? laps : min(c.lap + 1, laps);
    g.text(4, 0, ctx.t("dev.race.lap", {n: lapN, m: laps}), {w: 42, key: "dev.race.lap", c: c.lap === laps - 1 && !c.finished ? "gold" : "white"});
    const first = st.leader === ctx.p;
    if (st.phase !== PH.PICK) g.text(52, 0, ctx.t(first ? "dev.race.pos1" : "dev.race.pos2"), {w: 18, c: first ? "gold" : "white", key: first ? "dev.race.pos1" : "dev.race.pos2"});
    const ms = c.finished ? c.finishCs * 10 : m.went ? m.raceT : st.raceCs * 10;
    g.text(123, 0, fmtClock(ms), {align: "r", w: 36, c: c.finished ? "gold" : "white"});
    // weak signal: blink the antenna left of the clock
    if (ctx.stateAge() > 300 && Math.floor(ctx.now() / 250) & 1) g.sprite("icon.antenna", 77, 3);
  }
  function drawBottomBar(g, ctx, m, st) {
    const P = m.P, c = m.car, now = ctx.now();
    g.rect(0, 147, 128, 13, "panel");
    g.hline(0, 146, 128, "line");
    // racing skill icon of my pet (its colors; "line" once used this lap)
    const petIdx = myPet(ctx, m), tn = petTune(P, petIdx);
    const used = c.skillLap === c.lap || c.finished;
    if (D.PETS[petIdx]) g.sprite("race.icon." + SKILL[petIdx], 3, 149, used ? {color: "line"} : {});
    // throttle (accent) with the puddle-safe and heat-line ticks
    const bx = 14, bw = 62;
    const at = pct => bx + trunc(clamp(pct, 0, 100) * (bw - 1) / 100);
    g.rect(bx, 148, bw, 4, "void");
    if (c.u > 0) g.rect(bx, 148, at(c.u) - bx + 1, 4, "accent");
    if (tn.puddleSafe <= 100) g.vline(at(tn.puddleSafe), 147, 6, "waterLt");   // Tide never skids: no tick
    g.vline(at(P.heatLine), 147, 6, "danger");
    // heat (gold, danger above the warning line, blinking while stalled)
    g.rect(bx, 154, bw, 4, "void");
    const stalled = m.raceT < c.stallUntil;
    const heat = trunc(c.heat / 1000);
    if (stalled) { if (Math.floor(now / 150) & 1) g.rect(bx, 154, bw, 4, "danger"); }
    else if (heat > 0) g.rect(bx, 154, at(heat) - bx + 1, 4, heat > P.heatWarn ? "danger" : "gold");
    // throttle source: pad or A
    g.sprite(ctx.padOn() ? "icon.PAD" : "icon.A", 80, 149);
    // gap to the rival at the last checkpoint both passed (+ = behind)
    const gap = st.gap === GAP_NONE ? null : ctx.p === 0 ? st.gap : -st.gap;
    if (gap == null) g.text(123, 146, "--", {align: "r", c: "muted", w: 32});
    else {
      const a = abs(gap), s = a >= 1000 ? String(Math.min(99, Math.floor(a / 100))) : (Math.floor(a / 10) / 10).toFixed(1);
      g.text(123, 146, (gap > 0 ? "+" : gap < 0 ? "-" : "") + s, {align: "r", c: gap > 0 ? "danger" : "grassLt", w: 32});
    }
  }

  /* ============================== screens ============================== */

  D.registerScreen("race.pick", {
    secret: true, fps: 10,
    enter(ctx) { ctx.s.pick = {sel: 0, locked: false}; },
    input(ctx, ev) {
      const st = ctx.state;
      if (!st || st.phase !== PH.PICK || (st.flags & (8 << ctx.p))) return;
      const r = ui.pickInput(ctx, ev, ctx.s.pick, {count: 3});
      if (r && r.pick != null) {
        ctx.rt(A.RACE_PICK, r.pick);
        if (ctx.m) ctx.m.myPet = r.pick;
      }
    },
    draw(ctx, g) {
      const st = ctx.state, s = ctx.s.pick || {sel: 0};
      const mineIn = !!(st && (st.flags & (8 << ctx.p)));
      const rivalIn = !!(st && (st.flags & (8 << (1 - ctx.p))));
      const locked = s.locked || mineIn;
      const mine = st && st.cars[ctx.p].pet !== NO_PET ? st.cars[ctx.p].pet : ctx.m && ctx.m.myPet !== NO_PET ? ctx.m.myPet : s.sel;
      const rivalPet = st ? st.cars[1 - ctx.p].pet : NO_PET;
      const rv = ctx.rival();
      const sel = locked ? mine : s.sel;
      // cards: kart + rider (3x, facing right), name, skill icon + trait icon;
      // the rival's revealed card also shows the rival's name (s font)
      const cards = D.PETS.map((pt, i) => ({line2: rivalPet === i ? (rv ? rv.name : "P" + (2 - ctx.p)) : null}));
      const sk = SKILL[sel];
      let noteKey = rivalIn ? "dev.race.rivalPicked" : "dev.race.rivalChoosing";
      if (rivalPet !== NO_PET && mine !== NO_PET) {
        // both revealed: the relation between the two skills (§4.7)
        const pair = mine + "" + rivalPet;
        noteKey = {"10": "dev.race.counter.splashDash", "01": "dev.race.counter.splashDash", "02": "dev.race.counter.dashVine",
          "20": "dev.race.counter.dashVine", "21": "dev.race.counter.vineSplash", "12": "dev.race.counter.vineSplash"}[pair] || "dev.race.sameDriver";
      }
      ui.pickScreen(g, ctx, {
        titleKey: "dev.race.pickTitle", badgeKey: "dev.race.secret", noteKey,
        sel, locked, statusKey: null, info: [["dev.race.skLine", {sk: ctx.t("dev.race.sk." + sk)}], "dev.race.skDesc." + sk], cards,
        hints: locked ? [] : [["LR", "dev.race.hintPick"], ["A", "dev.race.hintLock"], ["B", "dev.ui.next"]],
      });
      const cols = colors(ctx), me = ctx.p;
      D.PETS.forEach((pt, i) => {
        const x = 4 + 40 * i;
        const theirs = rivalPet === i && !(locked && mine === i);
        drawCar(g, x + 20, 46, 0, cols[theirs ? 1 - me : me], i, {scale: 3});
        g.text(x + 20, 61, ctx.t(pt.nameKey), {align: "c", w: 36, c: "white", key: pt.nameKey});
        g.sprite("race.icon." + SKILL[i], x + 9, 77);
        g.sprite("race.icon." + TRAIT_ICON[i], x + 23, 77);
        if (locked && i === mine) g.sprite("icon.OK", x + 30, 32, {color: cols[me]});
        // the rival's pick gets a marker in the rival's color once revealed
        if (rivalPet === i) { g.rect(x + 2, 32, 6, 6, cols[1 - me]); g.frame(x + 2, 32, 6, 6, "void"); }
      });
      // the selected pet's handling, one line in its light color (§5.9)
      g.text(4, 132, ctx.t("dev.race.trait." + D.PETS[sel].id), {w: 120, c: D.PETS[sel].lt, key: "dev.race.trait." + D.PETS[sel].id});
    },
  });

  D.registerScreen("race.hud", {
    fps: 30, toastY: 44, toastX: [24, 80], holdBarAt: [90, 147, 34, 12], antennaAt: [77, 3],
    input(ctx, ev) {
      if (ev.btn === "SKILL" && ev.type === "down") useSkill(ctx);
      else if (ev.btn === "MENU" && ev.type === "click") ctx.toast("dev.race.holdM", null, 1200);
    },
    draw(ctx, g) { drawHud(ctx, g); },
  });

  /* ============================== AI rival (§5.8) ============================== */

  // Distance along the bot line to the next corner, and whether it is the
  // first of a U (two corners within 48 px)
  function nextCorner(s) {
    const segs = BOTLINE.segs;
    for (let i = 0; i < segs.length; i++) {
      const sg = segs[i], end = sg.s0 + sg.len;
      if (s < end) {
        const nx = segs[(i + 1) % segs.length];
        return {d: end - s, u: nx.len <= 48, after: nx.len};
      }
    }
    return {d: 999, u: false, after: 999};
  }
  function botDrive(ctx, ctl) {
    const m = ctx.m, st = ctx.state, c = m.car, P = m.P;
    // each bot gets its own lane offset and a pace that changes a little every lap
    const B = m.bot || (m.bot = {stuckMs: 0, revUntil: 0, last: 0, lap: -1, jitter: 100, lane: ctx.p ? 3 : 0});
    const now = ctx.now();
    if (B.lap !== c.lap) { B.lap = c.lap; B.jitter = 95 + ctl.rng.int(9); }
    const pace = trunc(P.botPct * B.jitter / 100);
    const toPressure = u => (u <= 0 ? 0 : 41 + Math.ceil(clamp(u, 0, 100) * 180 / 100));
    if (m.goAt != null || !m.went) {
      // perfect start: about 55 % throttle at GO
      ctl.stick(0, 0);
      ctl.pressure(m.goAt != null && m.goAt - ctx.gameNow() < 1500 ? toPressure(55) : 0);
      ctl.hold("B", false);
      return;
    }
    if (c.finished) { ctl.pressure(0); ctl.stick(0, 0); ctl.hold("B", false); return; }
    const x = c.x / 256, y = c.y / 256, v = c.v / 256;
    const pr = project(BOTLINE, x, y);
    const look = 14 + max(0, v) * 0.22;
    let [tx, ty] = pointAt(BOTLINE, pr.s + look);
    // lane offset: to the right of the driving direction (inside of this clockwise track)
    const sg = project(BOTLINE, tx, ty).seg;
    tx += -Math.sign(sg.by - sg.ay) * B.lane; ty += Math.sign(sg.bx - sg.ax) * B.lane;
    let dx = tx - x, dy = ty - y;
    const len = Math.hypot(dx, dy) || 1;
    // throttle: 85 % on the straights; before a corner, lift or brake so the
    // speed is down to the corner speed in time (U-turns are slower)
    let u = 85, brake = false;
    const nc = nextCorner(pr.s);
    const vc = (nc.u ? 44 : 50) * pace / 100;
    const d = max(1, nc.d - 6);
    const need = v > vc ? (v * v - vc * vc) / (2 * d) : 0;
    if (need > P.coast * 1.6) { brake = true; u = 0; }
    else if (need > 0) u = 0;
    else if (nc.d < 20 && v >= vc - 2) u = trunc(vc * 100 / P.topSpeed);
    if (pr.d2 > 64) u = min(u, 70);   // off the line: slow down to get back
    const aheadK = kindAt(trunc(x + 10 * Math.cos(c.hd * Math.PI / 32768)), trunc(y + 10 * Math.sin(c.hd * Math.PI / 32768)));
    if (aheadK === K.PUDDLE) u = min(u, petTune(P, myPet(ctx, m)).puddleSafe - 4);
    if (c.heat > 62000) u = min(u, P.heatLine - 2);
    if (!brake && need <= 0) u = trunc(u * pace / 100);
    // stuck against the edge or on the grass: back up for a moment
    if (abs(v) < 3 && c.u > 30) B.stuckMs += 16; else B.stuckMs = 0;
    if (B.stuckMs > 1200) { B.revUntil = now + 700; B.stuckMs = 0; }
    const rev = now < B.revUntil;
    ctl.hold("B", rev || brake);
    ctl.pressure(rev ? 0 : toPressure(u));
    ctl.stick(trunc(dx * 100 / len), trunc(-dy * 100 / len));
    // skills, once per lap
    if (c.skillLap !== c.lap && st.phase !== PH.PICK && now - B.last > 500) {
      B.last = now;
      const pet = myPet(ctx, m), rv = rivalView(ctx);
      const mine = progress(c.lap, c.cp, trunc(x), trunc(y));
      const theirs = rv ? progress(rv.lap, rv.cp, rv.x, rv.y) : mine;
      const straight = nc.d > 40 && !nc.u;
      let go = false;
      if (pet === PET_EMBER) go = straight && (c.heat > 50000 || pr.s > 300);
      else if (pet === PET_TIDE) go = abs(theirs - mine) < 120 || pr.s > 330;
      else if (pet === PET_SPROUT) go = (mine - theirs > 8 && mine - theirs < 70) || pr.s > 400;
      if (go) ctl.press("SKILL");
    }
  }
  function botPick(ctx, ctl) {
    const s = ctx.s.pick, st = ctx.state;
    if (!s || !st || st.phase !== PH.PICK || s.locked || (st.flags & (8 << ctx.p))) return;
    const B = ctx.s.bot || (ctx.s.bot = {want: ctl.rng.int(3), at: ctx.now() + 400});
    if (ctx.now() < B.at) return;
    B.at = ctx.now() + 300;
    if (s.sel !== B.want) ctl.press("RIGHT", 60);
    else ctl.press("A");
  }

  /* ============================== mode ============================== */

  D.registerMode({
    id: "racing", modeId: 1, order: 1, titleKey: "dev.menu.race", subKey: "dev.menu.raceSub", subVars: p => ({n: p.laps}),
    icon: "ui.mode.race", coop: false, status: "prototype", needsStick: true, stateMsg: "race.state",
    params: PARAMS.map(p => ({key: p[0], c: p[1], labelKey: "dev.race.p." + p[0], min: p[2], max: p[3], step: p[4], def: p[5], unit: p[6]})),
    rules: {
      MAP, KIND: Array.from(KIND), DIR: Array.from(DIR), PROG: Array.from(PROG), K, PH, CF, EV, START, TRACK_LEN, DEFAULTS,
      newCar, stepCar, carFlags, progress, project: (x, y) => project(CENTER, x, y), tileBehind, iatan2, isin, icos, configH,
      petTune, CAR_ROWS, RIDER_ROWS,
    },
    lobby: {badgeKey: "dev.lobby.laps", badgeVars: p => ({n: p.laps}), goals: ["dev.race.goal1", "dev.race.goal2"],
      keys: [["STICK", "dev.race.k1n", "dev.race.k1"], ["PAD", "dev.race.k2n", "dev.race.k2"],
        ["B", "dev.race.k3n", "dev.race.k3"], ["S", "dev.race.k4n", "dev.race.k4"]]},
    central: {periodMs: 50, create: centralCreate},
    player: {
      create: playerCreate,
      destroy(ctx) { ctx.tone(0); },
      onState: playerOnState,
      tick: playerTick,
      route(ctx) {
        const st = ctx.state;
        if (!st || st.phase === PH.PICK) return "race.pick";
        return st.phase === PH.RESULTS ? "results" : "race.hud";
      },
      busy: () => false,
      inputBits: () => 0,
      heartbeat: false,   // race.input is the heartbeat while racing
      pauseItems: [],
      results(ctx) {
        const st = ctx.state, m = ctx.m;
        if (!st) return null;
        const me = ctx.p, q = 1 - me, L = ctx.lobby;
        const winsOf = p => (L && L.wins ? L.wins[p * 3 + 1] : 0);
        const quit = st.evType === EV.QUIT;
        const youQuit = quit && st.evTarget === me, rivalQuit = quit && st.evTarget === q;
        const win = st.leader === me;
        const titleKey = youQuit ? "dev.res.youQuit" : rivalQuit ? "dev.res.rivalQuit" : win ? "dev.race.res.place1" : "dev.race.res.place2";
        const mine = st.cars[me], other = st.cars[q];
        // NEW BEST!: decided once, before the results screen records the lap
        const myBest = mine.best;
        if (m && !m.noteDone) {
          m.noteDone = true;
          const cur = ctx.profiles.current(), pr = ctx.me();
          const guest = !cur || cur.slot === "guest";
          m.noteKey = !guest && myBest > 0 && (!pr || !pr.bestLapCs || myBest < pr.bestLapCs) ? "dev.race.res.newBest" : null;
        }
        const cols = colors(ctx);
        return {
          titleKey, titleColor: youQuit || rivalQuit ? "muted" : win ? "gold" : "muted",
          scoreText: winsOf(me) + ":" + winsOf(q),
          drawArt(g2, c2, x, y, w) {
            // a strip of road with the finish line; the winner's kart is past it
            g2.rect(x, y, w, 20, "line");
            g2.hline(x, y, w, "muted"); g2.hline(x, y + 19, w, "muted");
            const fx = x + w - 34;
            for (let r = 0; r < 9; r++) for (let k = 0; k < 2; k++) g2.rect(fx + k * 2, y + 1 + r * 2, 2, 2, (r + k) & 1 ? "white" : "void");
            const quit = youQuit || rivalQuit;
            const ahead = quit ? x + 44 : fx + 18, behind = quit ? x + 76 : fx - 30;
            const mx = quit ? (me === 0 ? ahead : behind) : win ? ahead : behind, ox = mx === ahead ? behind : ahead;
            drawCar(g2, ox, y + 10, 0, cols[q], other.pet, {scale: 2});
            drawCar(g2, mx, y + 10, 0, cols[me], mine.pet, {scale: 2});
          },
          rows: [
            {labelKey: "dev.race.res.total", you: mine.finish ? fmtSec(mine.finish) : "--", other: other.finish ? fmtSec(other.finish) : "--"},
            {labelKey: "dev.race.res.bestLap", you: fmtSec(mine.best), other: fmtSec(other.best)},
            {labelKey: "dev.race.res.overheat", you: String(mine.stalls), other: String(other.stalls)},
            {labelKey: "dev.race.res.skills", you: String(mine.skills), other: String(other.skills)},
          ],
          noteKey: m ? m.noteKey : null, noteBlink: true,
          again: {labelKey: "dev.ui.again", kind: "rematch"},
          stats: myBest > 0 ? {bestLapCs: myBest} : undefined,
          win: youQuit || rivalQuit ? null : win,
        };
      },
    },
    bot(ctx, ctl) {
      if (ctx.screenId === "race.pick") return botPick(ctx, ctl);
      if (ctx.screenId === "race.hud" && ctx.m && ctx.state && racing(ctx.state)) botDrive(ctx, ctl);
    },
  });

  /* ============================== fixtures (§8.11) ============================== */

  D.registerFixture("race.lap2", {titleKey: "dev.menu.race", run(T) {
    T.reset({seed: 21, mode: "racing", params: {racing: {laps: 2}}});
    T.bot(0, true); T.bot(1, true);
    T.step(1500); T.shot("pick");
    let guard = 0;
    while (T.central().mode && T.central().mode.snapshot && T.central().mode.snapshot.phase < PH.RACE && guard++ < 100) T.step(100);
    T.step(1500); T.shot("race");
    guard = 0;
    while (T.central().mode.snapshot.phase < PH.RESULTS && guard++ < 600) T.step(100);
    const sn = T.central().mode.snapshot;
    T.assert(sn.phase === PH.RESULTS, "race ends");
    T.assert(sn.cars.every(c => c.lap === 2 && c.finish > 0), "both cars run 2 laps: " + JSON.stringify(sn.cars.map(c => [c.lap, c.finish])));
    T.step(400); T.shot("results");
    T.assert(T.screen(0).id === "results" && T.screen(1).id === "results", "both on results");
  }});
  D.registerFixture("race.splash", {titleKey: "dev.menu.race", run(T) {
    T.reset({seed: 22, mode: "racing"});
    T.step(1200);
    T.debug("pick", 1 + 4 * 0);
    T.step(3800);
    T.debug("splash", 1); T.step(300);
    T.shot("splashed");
    T.assert(T.hh(1).ctx.m.car.splashUntil > T.hh(1).ctx.m.raceT, "P2 is under the splash");
    T.assert(T.find(1, T.hh(1).ctx.t("dev.race.splashed")), "P2 sees the splash banner");
  }});
})();
