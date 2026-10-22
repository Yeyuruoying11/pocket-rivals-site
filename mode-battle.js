// Pocket Rivals handheld simulator: 对抗 Battle (docs/ui-design.md §4.7-4.8, §8.8)
//
// One file, both halves (§8.1):
//   1. strings, sounds, the battle.state message (msg_state_t, 47 B, v5 layout)
//   2. formulas copied word for word from battle.js (rulesScale, tierOf,
//      attackDamage, defendSweep, defendZone, perfectRange, blockResult,
//      chainDamage, pctRound), parameterised by the prototype's tuning
//      (DEVICE.battleParams(): localStorage pr.params.v4, read only)
//   3. central board: game.c's phase machine (skills.c, rules.c), with the
//      v6 changes of §7.8: host step counter, the session starts the match,
//      canPause (§4.11), ATTACK / DEFEND still taken while paused, QUIT,
//      over().res = best trial and perfect blocks of each player
//   4. player board: controls.c / player_core.c behaviour; the attack trial
//      of the pet on the field (attack-trial.md §2-§2C, pet-trials.js): Ember
//      follows the band with DEVICE.padLevel (pad or hold A), Tide tilts the
//      handheld (the accelerometer samples through PetTrials.tilt; hold A
//      without one), Sprout taps A on the beat (PetTrials.beat, edges at ev.t,
//      the beat on ctx.sfxAt); chained blocks start when this board first sees
//      DEFEND and are judged at ev.t
//   5. screens battle.pick (S11, DEVICE.ui.pickScreen) and battle.hud (S12)
//   6. results hook, bot
// Keep the dev.battle. prefix and the screen ids battle.pick / battle.hud.
(() => {
  const D = window.DEVICE;
  const C = D.C, ACT = C.ACT;
  const W = 128;

  /* ================= 1. strings, sounds, message ================= */

  D.registerStrings("dev.battle.", {
    zh: {
      // lobby (S08)
      "dev.battle.goal1": "打倒对方3只宠物", "dev.battle.goal2": "测试越准打得越重",
      "dev.battle.k1n": "A", "dev.battle.k1": "攻击测试", "dev.battle.k2n": "S", "dev.battle.k2": "技能",
      "dev.battle.k3n": "M", "dev.battle.k3": "换宠物", "dev.battle.k4n": "A", "dev.battle.k4": "格挡",
      "dev.battle.p.attackerFlag": "实验：对方攻击测试中提示",
      // S11
      "dev.battle.sendOut": "派出宠物", "dev.battle.nextPet": "选择下一只", "dev.battle.secret": "暗选",
      "dev.battle.secretNote": "对方看不到你的选择",
      "dev.battle.beatsShort": "{UP}{pet}", "dev.battle.weakShort": "{DN}{pet}",
      "dev.battle.how.ember": "攻击：{PAD}捏压力垫", "dev.battle.how.tide": "攻击：{TILT}倾斜掌机",
      "dev.battle.how.sprout": "攻击：{NOTE}跟拍子按{A}", "dev.battle.how.hold": "攻击：按住{A}",
      "dev.battle.rivalChoosing": "对方：选择中…", "dev.battle.rivalPicked": "对方：{OK} 已选好",
      "dev.battle.waitRival": "等待对方…", "dev.battle.ko": "倒下", "dev.battle.matchup": "{a} 克制 {b}",
      "dev.battle.hintPick": "选", "dev.battle.hintGo": "派出", "dev.battle.hintHold": "按住",
      // S12 status bar
      "dev.battle.yourTurn": "轮到你", "dev.battle.rivalTurn": "对方行动", "dev.battle.blockPhase": "格挡！", "dev.battle.wait": "等待",
      "dev.battle.round": "第{n}回合",
      // A
      "dev.battle.attack": "攻击测试",
      "dev.battle.sk.burn": "灼烧", "dev.battle.sk.shield": "潮汐护盾", "dev.battle.sk.drain": "汲取",
      "dev.battle.skReady": "就绪", "dev.battle.skCd": "冷却{n}",
      "dev.battle.switch": "换宠物",
      // B
      "dev.battle.switchTo": "换上哪只？", "dev.battle.hintSwitch": "换上", "dev.battle.hintBack": "返回",
      // C
      "dev.battle.ready": "准备", "dev.battle.go": "开始计分！", "dev.battle.stage": "第{n}层", "dev.battle.faster": "第{n}层 加速！",
      "dev.battle.hintPad": "捏住压力垫跟随", "dev.battle.hintHoldA": "按住{A}右移",
      "dev.battle.hintTilt": "倾斜掌机，跟住浪尖", "dev.battle.hintNoTilt": "无倾斜：按住{A}右移",
      "dev.battle.hintBeat": "听拍子，到线按{A}", "dev.battle.hintBeatMute": "静音：到线按{A}",
      // D
      "dev.battle.tier0": "普通一击", "dev.battle.tier1": "强力一击", "dev.battle.tier2": "全力一击",
      "dev.battle.banner0": "普通一击！", "dev.battle.banner1": "强力一击！", "dev.battle.banner2": "全力一击！",
      "dev.battle.trialResult": "{score} > {tier}", "dev.battle.rivalBlocking": "对方格挡中…",
      // E
      "dev.battle.rivalOptions": "攻击、技能或换宠物",
      "dev.battle.rivalAttacking": "对方攻击测试中！", "dev.battle.getReady": "准备格挡",
      // F
      "dev.battle.block": "格挡！", "dev.battle.hintBlock": "格挡",
      "dev.battle.perfect": "完美", "dev.battle.blocked": "挡住", "dev.battle.missed": "没挡住",
      // G
      "dev.battle.evSendOut": "{name}派出{pet}", "dev.battle.evBoth": "双方派出！",
      "dev.battle.evHit": "{tier} 挡住{k}/{n}", "dev.battle.evDmg": "{pet} -{n}",
      "dev.battle.evSuper": "效果拔群！", "dev.battle.evWeak": "效果一般…",
      "dev.battle.evSkill": "{skill}：{pet} -{n}", "dev.battle.evHeal": "{pet} +{n} 护盾", "dev.battle.evDrainHeal": "{pet} +{n}",
      "dev.battle.evBurn": "{pet} 灼烧 -{n}", "dev.battle.evKo": "{pet}倒下了", "dev.battle.evSwitch": "{name}换上{pet}",
      "dev.battle.evWin": "{name}获胜！",
      // I
      "dev.battle.rivalPicking": "对方在选下一只…",
      // S19
      "dev.battle.res.petsLeft": "剩余宠物", "dev.battle.res.bestTrial": "最高测试", "dev.battle.res.perfect": "完美格挡",
      "dev.battle.res.rounds": "回合",
    },
    en: {
      "dev.battle.goal1": "KO all 3 rival pets", "dev.battle.goal2": "Aim well: hit hard",
      "dev.battle.k1n": "A", "dev.battle.k1": "Attack", "dev.battle.k2n": "S", "dev.battle.k2": "Skill",
      "dev.battle.k3n": "M", "dev.battle.k3": "Switch", "dev.battle.k4n": "A", "dev.battle.k4": "Block",
      "dev.battle.p.attackerFlag": "Exp: rival attacking cue",
      "dev.battle.sendOut": "SEND OUT", "dev.battle.nextPet": "NEXT PET", "dev.battle.secret": "secret",
      "dev.battle.secretNote": "Your pick is secret",
      "dev.battle.beatsShort": "{UP}{pet}", "dev.battle.weakShort": "{DN}{pet}",
      "dev.battle.how.ember": "Attack: {PAD}squeeze", "dev.battle.how.tide": "Attack: {TILT}tilt",
      "dev.battle.how.sprout": "Attack: {NOTE}tap {A}", "dev.battle.how.hold": "Attack: hold {A}",
      "dev.battle.rivalChoosing": "Rival: choosing...", "dev.battle.rivalPicked": "Rival: ready {OK}",
      "dev.battle.waitRival": "Waiting...", "dev.battle.ko": "KO", "dev.battle.matchup": "{a} beats {b}",
      "dev.battle.hintPick": "Pick", "dev.battle.hintGo": "Go", "dev.battle.hintHold": "Hold",
      "dev.battle.yourTurn": "YOUR TURN", "dev.battle.rivalTurn": "RIVAL'S TURN", "dev.battle.blockPhase": "BLOCK!", "dev.battle.wait": "WAIT",
      "dev.battle.round": "R{n}",
      "dev.battle.attack": "Attack",
      "dev.battle.sk.burn": "Burn", "dev.battle.sk.shield": "Tide Shield", "dev.battle.sk.drain": "Drain",
      "dev.battle.skReady": "ready", "dev.battle.skCd": "CD {n}",
      "dev.battle.switch": "Switch",
      "dev.battle.switchTo": "Switch to:", "dev.battle.hintSwitch": "Go", "dev.battle.hintBack": "Back",
      "dev.battle.ready": "GET READY", "dev.battle.go": "GO!", "dev.battle.stage": "STAGE {n}", "dev.battle.faster": "STAGE {n} FASTER!",
      "dev.battle.hintPad": "Squeeze to follow", "dev.battle.hintHoldA": "Hold {A}: right",
      "dev.battle.hintTilt": "Tilt to follow", "dev.battle.hintNoTilt": "No tilt: hold {A}",
      "dev.battle.hintBeat": "Tap {A} at line", "dev.battle.hintBeatMute": "Muted: watch line",
      "dev.battle.tier0": "NORMAL", "dev.battle.tier1": "STRONG", "dev.battle.tier2": "FULL POWER",
      "dev.battle.banner0": "NORMAL!", "dev.battle.banner1": "STRONG!", "dev.battle.banner2": "FULL POWER",
      "dev.battle.trialResult": "{score} > {tier}", "dev.battle.rivalBlocking": "Rival blocking...",
      "dev.battle.rivalOptions": "Attack/skill/switch",
      "dev.battle.rivalAttacking": "Rival attacking!", "dev.battle.getReady": "Get ready",
      "dev.battle.block": "BLOCK!", "dev.battle.hintBlock": "Block",
      "dev.battle.perfect": "Perfect", "dev.battle.blocked": "Blocked", "dev.battle.missed": "Missed",
      "dev.battle.evSendOut": "{name} sent {pet}", "dev.battle.evBoth": "Both sent out!",
      "dev.battle.evHit": "{tier} blk {k}/{n}", "dev.battle.evDmg": "{pet} -{n}",
      "dev.battle.evSuper": "Super effective!", "dev.battle.evWeak": "Not very effective…",
      "dev.battle.evSkill": "{skill}: {pet} -{n}", "dev.battle.evHeal": "{pet} +{n} shield", "dev.battle.evDrainHeal": "{pet} +{n}",
      "dev.battle.evBurn": "{pet} burn -{n}", "dev.battle.evKo": "{pet} fainted!", "dev.battle.evSwitch": "{name}: now {pet}",
      "dev.battle.evWin": "{name} wins!",
      "dev.battle.rivalPicking": "Rival picking...",
      "dev.battle.res.petsLeft": "Pets left", "dev.battle.res.bestTrial": "Top trial", "dev.battle.res.perfect": "Perfects",
      "dev.battle.res.rounds": "Rounds",
    },
  });

  // §2.6 DF table (battle part); BEEP sounds are the core's
  D.registerSfx("battle", {
    send_out: {ch: "DF", file: 10, prio: 2, ms: 500},
    your_turn: {ch: "DF", file: 11, prio: 1, ms: 400},
    tier_normal: {ch: "DF", file: 12, prio: 2, ms: 500},
    tier_strong: {ch: "DF", file: 13, prio: 2, ms: 600},
    tier_full: {ch: "DF", file: 14, prio: 3, ms: 900},
    hit_small: {ch: "DF", file: 15, prio: 2, ms: 400},
    hit_big: {ch: "DF", file: 16, prio: 2, ms: 500},
    eff_super: {ch: "DF", file: 17, prio: 2, ms: 500},
    eff_weak: {ch: "DF", file: 18, prio: 2, ms: 500},
    skill_burn: {ch: "DF", file: 19, prio: 2, ms: 600},
    skill_shield: {ch: "DF", file: 20, prio: 2, ms: 600},
    skill_drain: {ch: "DF", file: 21, prio: 2, ms: 600},
    burn_tick: {ch: "DF", file: 22, prio: 2, ms: 400},
    switch: {ch: "DF", file: 23, prio: 2, ms: 400},
    faint: {ch: "DF", file: 24, prio: 3, ms: 800},
    // Sprout's beat (ui-design §2.6, attack-trial.md §2B): rhythm sounds, not clicks
    beat_tick: {ch: "BEEP", tones: [[1600, 30]]},
    beat_accent: {ch: "BEEP", tones: [[2400, 40]]},
    beat_count: {ch: "BEEP", tones: [[1000, 20]]},
    beat_bad: {ch: "BEEP", tones: [[180, 40]]},
  });

  // §4.8 C2 / C3 (ui-design §2.4): Tide's drop pointer and Sprout's leaf note
  D.registerSprites("battle.", {
    "battle.drop": {w: 5, h: 9, map: {"#": "waterLt", "+": "white"},
      frames: [["..#..", "..#..", ".###.", ".#+##", "#+###", "#+###", "#####", "#####", ".###."]]},
    "battle.leaf": {w: 6, h: 8, map: {"#": "grassLt", "+": "grass"},
      frames: [["....##", "...#+#", "..#++#", ".#++#.", "#++#..", "#+#...", "##....", "#....."]]},
  });
  const PT = D.petTrials;

  // msg_state_t (protocol.h), field for field: 47 B with the header
  D.registerMessage("battle.state", C.MSG.BATTLE_STATE, [
    "step:u16", "phase:u8", "turn:u8", "round:u8", "flags:u8", "waiting:u8", "winner:u8",
    ["players", 2, ["active:u8", "hp:u8[3]", "burn:u8", "shield:u8", "cooldown:u8"]],
    "trialSeed:u8", "attackScore:u8", "attackTier:u8", "defendHits:u8", "defendWidth:u8",
    "defendZone:u8[3]", "defendSweep:u16[3]", "attackDamage:u8",
    "evId:u8", "evType:u8", "evTarget:u8", "evAmount:u8", "evResult:u8",
  ], {kind: "mode", legacyLayout: true});

  // protocol.h enums
  const PH = {LOBBY: 0, SEND_OUT: 1, TURN: 2, DEFEND: 3, RESOLVE: 4, GAME_OVER: 5};
  const EV = {NONE: 0, SEND_OUT: 1, HIT: 2, SKILL_DAMAGE: 3, HEAL: 4, BURN: 5, KO: 6, WIN: 7, SWITCH: 8};
  const MISS = 0, GOOD = 1, PERFECT = 2;
  const NO_PET = 0xff, BOTH = 0xff, NO_PRESS = 0xff, TEAM_SIZE = 3, DEFEND_MAX_HITS = 3;
  const FLAG_TRIAL = C.FLAG.ATTACKER_TRIAL;   // bit 3 (v6 experiment)
  const FLAG_QUIT = 0x10;                     // bit 4 (simulator): GAME_OVER came from a QUIT; the quitter is 1 - winner
  const ELEMENTS = ["fire", "water", "grass"];  // pet index -> element (pets.c)
  const BEATS = {fire: "grass", grass: "water", water: "fire"};
  const SKILL_KEYS = ["dev.battle.sk.burn", "dev.battle.sk.shield", "dev.battle.sk.drain"];
  const blockAt = (packed, i) => (packed >> (2 * i)) & 3;   // BLOCK_RESULT_AT

  /* ================= 2. formulas (copied from battle.js) ================= */

  // Everything between the two lines below is battle.js's code, word for
  // word, except that P is the parameter of makeRules instead of the
  // prototype's global; change one, change both (§8.8).
  function makeRules(P) {
    // ---- battle.js ----
    const rulesScale = (amount, pct) => Math.floor((amount * pct + 50) / 100);

    // §3
    const tierOf = score => score < P.tierStrong ? 0 : score < P.tierUlt ? 1 : 2;
    function attackDamage(score, typePct) {
      const raw = P.base * 100 + P.trialBonus * score;  // 1/100 HP
      // Capped after the type bonus, before blocks and shield
      return Math.min(Math.floor((Math.floor(raw * typePct / 100) + 50) / 100), P.maxDmg);
    }

    // §4
    const defendHits = tier => Math.min(tier + 1, DEFEND_MAX_HITS);
    const defendWidth = tier => rulesScale(P.windowPct, 100 - P.narrowPct * tier);
    const defendSweep = (tier, i) => Math.floor(P.sweepMs * (100 - P.speedupPct * (tier + i)) / 100);
    const defendZone = (width, random) => 10 + random % (85 - width + 1);
    const perfectRange = (zone, width) => [zone + Math.ceil(width * 35 / 100), zone + Math.floor(width * 65 / 100)];

    function blockResult(cursor, zone, width) {
      if (cursor === null || cursor < zone || cursor > zone + width) return MISS;
      const [lo, hi] = perfectRange(zone, width);
      return cursor >= lo && cursor <= hi ? PERFECT : GOOD;
    }

    // §5: equal shares, each scaled by its block result; the shield applies to the sum
    function chainDamage(D, results) {
      const hits = results.length;
      let sum = 0;
      results.forEach((r, i) => {
        const share = Math.floor(D * (i + 1) / hits) - Math.floor(D * i / hits);
        sum += rulesScale(share, r === PERFECT ? P.perfectPct : r === GOOD ? P.goodPct : 100);
      });
      return sum;
    }

    // round(inside * 100 / scored), half up, in integers; 0 with nothing scored
    const pctRound = (inside, scored) => scored ? Math.floor((inside * 200 + scored) / (scored * 2)) : 0;

    function typePct(a, d) {
      if (BEATS[a] === d) return P.strongPct;
      if (BEATS[d] === a) return P.weakPct;
      return 100;
    }
    // ---- end of battle.js ----
    // protocol cursor (0xff = no press) -> battle.js cursor (null)
    const judge = (cursor, zone, width) => blockResult(cursor === NO_PRESS ? null : cursor, zone, width);
    const petTypePct = (a, d) => typePct(ELEMENTS[a], ELEMENTS[d]);
    return {P, rulesScale, tierOf, attackDamage, defendHits, defendWidth, defendSweep, defendZone, perfectRange,
      blockResult, chainDamage, pctRound, typePct, judge, petTypePct};
  }

  // DEVICE.rules("battle"): pure functions at the current tuning (+ withParams)
  const cur = () => makeRules(D.battleParams());
  const RULES = {withParams: makeRules, MISS, GOOD, PERFECT, NO_PRESS, ELEMENTS, PH, EV, FLAG_QUIT};
  for (const k of ["rulesScale", "tierOf", "attackDamage", "defendHits", "defendWidth", "defendSweep", "defendZone",
    "perfectRange", "blockResult", "chainDamage", "pctRound", "typePct", "judge", "petTypePct"]) RULES[k] = (...a) => cur()[k](...a);
  // trial (DEVICE.trial with the battle parameters), for the cross-check of §8.8
  RULES.trialCfg = () => D.trial.cfgFrom(D.battleParams());
  RULES.tau100 = t => D.trial.tau100(t, RULES.trialCfg());
  RULES.bandCenter = (seed, t) => D.trial.bandCenter(seed, t, RULES.trialCfg());
  RULES.inBand = (center, level) => D.trial.inBand(level, center, RULES.trialCfg());
  // per-pet trials (attack-trial.md §2A-§2C): the shared code and this tuning's configs
  RULES.petTrials = D.petTrials;
  RULES.tideCfg = () => D.trial.cfgFrom(D.battleParams(), D.battleParams().tideBandPct);
  RULES.beatCfg = () => D.petTrials.beat.cfgFrom(D.battleParams());

  /* ================= 3. central board (game.c) ================= */

  function createCentral(api, opts) {
    const P = D.battleParams();     // one tuning for the whole match
    const R = makeRules(P);
    const g = {
      phase: PH.LOBBY, turn: 0, round: 1, first: 0, waiting: 0, winner: 0,
      players: [0, 1].map(() => ({active: NO_PET, hp: [0, 0, 0], burn: 0, shield: 0, cooldown: 0})),
      pending: [NO_PET, NO_PET], justUsed: false,
      trialSeed: 0, attackScore: 0, attackTier: 0, defendHits: 0, defendWidth: 0,
      defendZone: [0, 0, 0], defendSweep: [0, 0, 0], attackDamage: 0, defendTimeout: 0,
      ev: {id: 0, type: EV.NONE, target: 0, amount: 0, result: 0},
      next: "begin", phaseAt: 0,
      best: [0, 0], perfects: [0, 0], quitBy: null, trialFlag: false,
      bestPet: [NO_PET, NO_PET],      // §9.2: the pet out when best[] was scored (leaderboard icon)
    };
    const rand32 = () => api.randInt(0x10000) * 0x10000 + api.randInt(0x10000);
    const pl = i => g.players[i];
    const hpOf = i => pl(i).hp[pl(i).active];

    function enterPhase(phase, waiting) {
      g.phase = phase;
      g.waiting = waiting;
      g.phaseAt = api.gameNow();
      g.trialFlag = false;
      api.nextStep();            // game.c: step_id++ (§7.6: the host's counter)
      api.broadcast();           // "10 Hz + at once on a change"
    }
    function setEvent(type, target, amount, result) {
      g.ev = {id: (g.ev.id + 1) & 0xff, type, target, amount, result};
    }
    const showEvent = next => { g.next = next; enterPhase(PH.RESOLVE, 0); };
    function damage(target, amount, type, result) {
      const p = pl(target);
      if (amount > p.hp[p.active]) amount = p.hp[p.active];
      p.hp[p.active] -= amount;
      setEvent(type, target, amount, result);
      return amount;
    }
    function heal(i, amount) {
      const p = pl(i);
      if (p.hp[p.active] + amount > P.hp) amount = P.hp - p.hp[p.active];
      p.hp[p.active] += amount;
      return amount;
    }
    function shielded(target, amount) {
      if (!pl(target).shield) return amount;
      pl(target).shield = 0;
      return R.rulesScale(amount, P.shieldPct);
    }
    function startMatch(first) {
      for (let i = 0; i < 2; i++) {
        Object.assign(pl(i), {active: NO_PET, hp: [P.hp, P.hp, P.hp], burn: 0, shield: 0, cooldown: 0});
        g.pending[i] = NO_PET;
      }
      g.turn = first; g.first = first; g.round = 1; g.justUsed = false; g.next = "begin";
      enterPhase(PH.SEND_OUT, 3);
    }
    function enterTurn() {
      g.trialSeed = api.randInt(256);
      enterPhase(PH.TURN, 1 << g.turn);
    }
    function beginTurn() {
      const a = pl(g.turn);
      if (a.burn > 0) {
        a.burn--;
        damage(g.turn, P.burnDmg, EV.BURN, 0);
        showEvent("ready");
        return;
      }
      enterTurn();
    }
    function endTurn() {
      const a = pl(g.turn);
      if (g.justUsed) g.justUsed = false;
      else if (a.cooldown > 0) a.cooldown--;
      g.turn = 1 - g.turn;
      if (g.turn === g.first) g.round = Math.min(255, g.round + 1);
      beginTurn();
    }
    const anyAlive = i => pl(i).hp.some(h => h > 0);
    function resolveDone() {
      for (let i = 0; i < 2; i++) {
        const p = pl(i);
        if (p.active !== NO_PET && p.hp[p.active] === 0) {
          p.active = NO_PET; p.burn = 0; p.shield = 0;
          setEvent(EV.KO, i, 0, 0);
          showEvent(g.next);
          return;
        }
      }
      let need = 0;
      for (let i = 0; i < 2; i++) {
        if (pl(i).active !== NO_PET) continue;
        if (!anyAlive(i)) {
          g.winner = 1 - i;
          setEvent(EV.WIN, g.winner, 0, 0);
          enterPhase(PH.GAME_OVER, 3);
          // today's leaderboard (§9.2): best trial of the match, ties on perfect blocks; a QUIT never gets here
          if (api.rank) api.rank.submit(0x00, [0, 1].filter(p => g.best[p] > 0)
            .map(p => ({who: [p], value: g.best[p] << 8 | Math.min(g.perfects[p], 255), pets: [g.bestPet[p]]})));
          return;
        }
        need |= 1 << i;
      }
      if (need) { enterPhase(PH.SEND_OUT, need); return; }
      if (g.next === "begin") beginTurn();
      else if (g.next === "ready") enterTurn();
      else endTurn();
    }
    function revealPets() {
      let n = 0, who = 0;
      for (let i = 0; i < 2; i++) {
        if (g.pending[i] === NO_PET) continue;
        pl(i).active = g.pending[i];
        g.pending[i] = NO_PET;
        n++; who = i;
      }
      if (n === 1) setEvent(EV.SEND_OUT, who, pl(who).active, 0);
      else setEvent(EV.SEND_OUT, BOTH, NO_PET, 0);
      showEvent(g.next);
    }
    function doAttack(score) {
      const d = 1 - g.turn;
      const pct = R.petTypePct(pl(g.turn).active, pl(d).active);
      g.attackScore = Math.min(score, 100);
      if (g.attackScore > g.best[g.turn]) g.bestPet[g.turn] = pl(g.turn).active;
      g.best[g.turn] = Math.max(g.best[g.turn], g.attackScore);
      g.attackTier = R.tierOf(g.attackScore);
      g.attackDamage = R.attackDamage(g.attackScore, pct);
      g.defendHits = R.defendHits(g.attackTier);
      g.defendWidth = R.defendWidth(g.attackTier);
      g.defendTimeout = P.gapMs * (g.defendHits - 1) + P.graceMs;
      for (let i = 0; i < DEFEND_MAX_HITS; i++) {
        const used = i < g.defendHits;
        g.defendZone[i] = used ? R.defendZone(g.defendWidth, rand32()) : 0;
        g.defendSweep[i] = used ? R.defendSweep(g.attackTier, i) : 0;
        g.defendTimeout += g.defendSweep[i];
      }
      enterPhase(PH.DEFEND, 1 << d);
    }
    function doDefend(cursors) {
      const d = 1 - g.turn;
      const results = [];
      let packed = 0;
      for (let i = 0; i < g.defendHits; i++) {
        results.push(R.judge(cursors[i], g.defendZone[i], g.defendWidth));
        packed |= results[i] << (2 * i);
        if (results[i] === PERFECT) g.perfects[d] = Math.min(255, g.perfects[d] + 1);
      }
      const amount = R.chainDamage(g.attackDamage, results);
      damage(d, shielded(d, amount), EV.HIT, packed);
      showEvent("end");
    }
    // skills.c
    function doSkill() {
      const a = g.turn, d = 1 - a;
      pl(a).cooldown = P.skillCd;
      g.justUsed = true;
      const pct = R.petTypePct(pl(a).active, pl(d).active);
      const el = ELEMENTS[pl(a).active];
      if (el === "fire") {
        pl(d).burn = P.burnTurns;
        damage(d, shielded(d, R.rulesScale(P.emberDmg, pct)), EV.SKILL_DAMAGE, 0);
      } else if (el === "water") {
        const healed = heal(a, P.tideHeal);
        pl(a).shield = 1;
        setEvent(EV.HEAL, a, healed, 0);
      } else {
        const before = hpOf(d);
        damage(d, shielded(d, R.rulesScale(P.drain, pct)), EV.SKILL_DAMAGE, 0);
        heal(a, before - hpOf(d));
      }
      showEvent("end");
    }
    function doSwitch(pet) {
      const a = pl(g.turn);
      a.active = pet; a.burn = 0; a.shield = 0;
      setEvent(EV.SWITCH, g.turn, pet, 0);
      showEvent("end");
    }

    startMatch(opts.first === 1 ? 1 : 0);

    return {
      tick() {
        const t = api.gameNow() - g.phaseAt;
        if (g.phase === PH.RESOLVE && t >= P.resolveMs) resolveDone();
        else if (g.phase === PH.DEFEND && t >= g.defendTimeout) doDefend([NO_PRESS, NO_PRESS, NO_PRESS]);
      },
      // game_action() with the v6 changes: while paused only the current
      // step's ATTACK / DEFEND still count (a local trial / chain that was
      // running when the pause hit, §4.11)
      action(p, a, arg, data) {
        if (p !== 0 && p !== 1 || !(g.waiting & (1 << p))) return false;
        if (api.paused() && a !== ACT.ATTACK && a !== ACT.DEFEND) return false;
        switch (a) {
          case ACT.SEND_OUT:
            if (g.phase !== PH.SEND_OUT || arg >= TEAM_SIZE || pl(p).hp[arg] === 0) return false;
            g.pending[p] = arg;
            g.waiting &= ~(1 << p);
            if (g.waiting === 0) revealPets();
            else api.broadcast();
            return true;
          case ACT.ATTACK:
            if (g.phase !== PH.TURN) return false;
            doAttack(arg);
            return true;
          case ACT.SKILL:
            if (g.phase !== PH.TURN || pl(p).cooldown > 0) return false;
            doSkill();
            return true;
          case ACT.SWITCH:
            if (g.phase !== PH.TURN || arg >= TEAM_SIZE || arg === pl(p).active || pl(p).hp[arg] === 0) return false;
            doSwitch(arg);
            return true;
          case ACT.DEFEND:
            if (g.phase !== PH.DEFEND || arg !== g.defendHits) return false;
            doDefend(data || [NO_PRESS, NO_PRESS, NO_PRESS]);
            return true;
        }
        return false;   // ACT_REMATCH (v5) is the session's REMATCH now
      },
      input(p, f) {
        // §4.8 E experiment: the attacker's heartbeat bit 7 = "my trial is running"
        if (g.phase !== PH.TURN || p !== g.turn) return;
        const v = !!D.params("battle").attackerFlag && !!(f.buttons & 0x80);
        if (v !== g.trialFlag) { g.trialFlag = v; api.broadcast(); }
      },
      snapshot() {
        return {
          phase: g.phase, turn: g.turn, round: g.round,
          flags: (g.trialFlag ? FLAG_TRIAL : 0) | (g.quitBy != null ? FLAG_QUIT : 0),
          waiting: g.waiting, winner: g.winner,
          players: g.players.map(p => ({active: p.active, hp: p.hp.slice(), burn: p.burn, shield: p.shield, cooldown: p.cooldown})),
          trialSeed: g.trialSeed, attackScore: g.attackScore, attackTier: g.attackTier, defendHits: g.defendHits,
          defendWidth: g.defendWidth, defendZone: g.defendZone.slice(), defendSweep: g.defendSweep.slice(),
          attackDamage: g.attackDamage,
          evId: g.ev.id, evType: g.ev.type, evTarget: g.ev.target, evAmount: g.ev.amount, evResult: g.ev.result,
        };
      },
      over() {
        if (g.phase !== PH.GAME_OVER) return null;
        return {winner: g.winner, coop: false, quit: g.quitBy, res: [g.best[0], g.best[1], g.perfects[0], g.perfects[1]]};
      },
      // §4.11: TURN pauses now only for the attacker; DEFEND defers both
      canPause(p) {
        if (g.phase === PH.TURN) return p === g.turn ? "now" : "defer";
        if (g.phase === PH.DEFEND) return "defer";
        return "now";
      },
      pause() {}, resume() {},   // phase timers use api.gameNow(), which stops while paused
      quit(p) {
        if (g.phase === PH.GAME_OVER) return;
        g.quitBy = p;
        g.winner = 1 - p;
        setEvent(EV.WIN, g.winner, 0, 0);
        enterPhase(PH.GAME_OVER, 3);
      },
      debug(cmd, arg) {
        if (cmd === "state") return JSON.parse(JSON.stringify(g));
        if (cmd === "set" && arg) {     // fixtures / screenshots: patch the game (players: [{...}, {...}])
          if (arg.players) arg.players.forEach((q, i) => q && Object.assign(pl(i), q));
          for (const k of ["round", "turn", "attackScore", "attackTier"]) if (arg[k] != null) g[k] = arg[k];
          api.broadcast();
          return true;
        }
        return undefined;
      },
    };
  }

  /* ================= 4. player board ================= */

  const PETS = () => D.PETS;
  const petName = (ctx, i) => i < TEAM_SIZE ? ctx.t(D.PETS[i].nameKey) : "?";
  const meOf = ctx => ctx.p, rivalOf = ctx => 1 - ctx.p;
  function playerName(ctx, p) {
    if (p === ctx.p) { const pr = ctx.me(); return pr ? pr.name : "P" + (p + 1); }
    const r = ctx.rival();
    return r ? r.name : "P" + (p + 1);
  }
  function playerColor(ctx, p) {
    if (p === ctx.p) return ctx.color();
    const r = ctx.rival();
    return r ? D.PLAYER_COLORS[(r.color | 0) % 6] : p === 0 ? "danger" : "water";
  }
  const myMove = (ctx, m) => {
    const st = ctx.state;
    return !!st && !(st.flags & C.FLAG.PAUSED) && !!((st.waiting >> ctx.p) & 1) && m.actedStep !== st.step;
  };
  const switchTargets = (st, p) => {
    const pl = st.players[p];
    if (pl.active >= TEAM_SIZE) return [];
    return [0, 1, 2].filter(k => k !== pl.active && pl.hp[k] > 0);
  };
  const canStartTrial = (ctx, m) => {
    const st = ctx.state;
    return !!st && ctx.screenId === "battle.hud" && !ctx.overlayId && st.phase === PH.TURN && st.turn === ctx.p &&
      myMove(ctx, m) && !m.trial && !m.switching && !(m.trialResult && m.trialResult.step === st.step);
  };
  function act(ctx, m, action, arg = 0, data) {
    m.actedStep = ctx.state.step;
    ctx.act(action, arg, data);
  }

  // Which trial the pet on the field plays (attack-trial.md §2A: decided when
  // the trial starts, kept to its end). Ember: "pad" or "btn" (hold A, no pad);
  // Tide: "tilt", or "btn" without a usable accelerometer; Sprout: "beat"
  const myPet = ctx => { const st = ctx.state; return st ? st.players[ctx.p].active : NO_PET; };
  function startTrial(ctx, m, t, src) {
    const st = ctx.state, pet = myPet(ctx);
    if (pet === 1 && ctx.tiltOn()) {
      const tr = {step: st.step, kind: "tilt", pet, T: D.trial.create(st.trialSeed, D.trial.cfgFrom(m.P, m.P.tideBandPct), t), src: "tilt",
        lastT: t, cue: -2, cueAt: t, tickAt: -1e9, accSeq: ctx.input.accSeq, levelM: 0};
      // §2A: start from the last sample before the trial, not from 0
      tr.levelM = PT.tilt.step(0, ctx.input.acc.x, true, m.P.tiltFullMg, m.P.tiltSmoothPct);
      m.trial = tr;
      ctx.tiltSteer(true);
    } else if (pet === 2) {
      const B = PT.beat.create(st.trialSeed, PT.beat.cfgFrom(m.P), t);
      m.trial = {step: st.step, kind: "beat", pet, B, start: t, src: "beat", cues: PT.beat.cues(B), cueI: 0,
        epoch: ctx.sfxEpoch(), marks: [], endSeen: false, cue: -2, cueAt: t};
    } else {
      // Ember (pad or hold A), or Tide without tilt: the band trial as before
      m.trial = {step: st.step, kind: "band", pet, T: D.trial.create(st.trialSeed, m.cfg, t), src: pet === 1 ? "btn" : src,
        pad: D.padLevel.create(), lastT: t, cue: -2, cueAt: t, tickAt: -1e9};
    }
    m.switching = null;
    m.anim = Math.max(m.anim, t + 200);
  }
  // A trial that is over or cancelled lets go of the tilt keys and the queued beat
  function dropTrial(ctx, m) {
    const tr = m.trial;
    m.trial = null;
    if (tr && tr.kind === "tilt") ctx.tiltSteer(false);
    if (tr && tr.kind === "beat") ctx.sfxCancel();
  }
  function finishTrial(ctx, m, score, stages) {
    const tr = m.trial;
    const tier = m.R.tierOf(score);
    m.trialResult = {step: tr.step, score, stages, tier};
    dropTrial(ctx, m);
    act(ctx, m, ACT.ATTACK, score);
    showTierBanner(ctx, m, tier);
  }
  function trialTick(ctx, m) {
    const tr = m.trial, now = ctx.now();
    const st = ctx.state;
    if (!st || st.step !== tr.step) { dropTrial(ctx, m); return; }
    if (tr.kind === "beat") { beatTick(ctx, m); return; }
    let lvl;
    if (tr.kind === "tilt") {
      // every new sample through the filter, in order (two this loop = two steps)
      for (const q of ctx.accSamples(tr.accSeq)) {
        tr.levelM = PT.tilt.step(tr.levelM, q.x, false, m.P.tiltFullMg, m.P.tiltSmoothPct);
        tr.accSeq = q.seq;
      }
      lvl = PT.tilt.level(tr.levelM);
    } else {
      lvl = D.padLevel.update(tr.pad, ctx.input, {pad: tr.src === "pad" ? "on" : "off"}, now - tr.lastT);
    }
    tr.lastT = now;
    const done = D.trial.update(tr.T, lvl, now);
    const stg = D.trial.ready(tr.T) ? -1 : D.trial.stage(tr.T);
    if (stg !== tr.cue && !done) { tr.cue = stg; tr.cueAt = now; ctx.sfx("stage_up"); }
    if (tr.T.inside && now - tr.tickAt >= 120) { tr.tickAt = now; ctx.sfx("tick_in_band"); }
    if (!done) return;
    finishTrial(ctx, m, D.trial.score(tr.T), [0, 1, 2].map(k => D.trial.stageScore(tr.T, k)));
  }
  // Sprout (§2B): the beat goes out ahead on WebAudio (200 ms), notes whose
  // window closed are missed; the trial ends one loop after R + 3S so a press
  // edge from just before the end, delivered after this tick, still counts
  function beatTick(ctx, m) {
    const tr = m.trial, B = tr.B, now = ctx.now(), e = now - tr.start;
    if (tr.epoch !== ctx.sfxEpoch()) {          // the queued beat was dropped (simulation paused): queue it again
      tr.epoch = ctx.sfxEpoch();
      tr.cueI = tr.cues.findIndex(c => tr.start + c.t > now);
      if (tr.cueI < 0) tr.cueI = tr.cues.length;
    }
    while (tr.cueI < tr.cues.length && tr.cues[tr.cueI].t <= e + 200) {
      const c = tr.cues[tr.cueI++];
      ctx.sfxAt(c.id, tr.start + c.t);
    }
    PT.beat.update(B, e);
    const stg = PT.beat.ready(B) ? -1 : PT.beat.stage(B);
    if (stg !== tr.cue && e < PT.beat.endMs(B.cfg)) { tr.cue = stg; tr.cueAt = now; }
    if (e < PT.beat.endMs(B.cfg)) return;
    if (!tr.endSeen) { tr.endSeen = true; return; }
    PT.beat.finish(B);
    finishTrial(ctx, m, PT.beat.score(B), [0, 1, 2].map(k => PT.beat.stageScore(B, k)));
  }
  // An A press edge during Sprout's trial, timed at the edge (ev.t)
  function beatTap(ctx, m, t) {
    const tr = m.trial;
    const r = PT.beat.tap(tr.B, t - tr.start);
    if (r.kind === "ignored") return;
    tr.marks.push({kind: r.kind, at: ctx.now()});
    if (tr.marks.length > 8) tr.marks.shift();
    if (r.kind === "stray") ctx.sfx("beat_bad");
    m.anim = Math.max(m.anim, ctx.now() + 200);
  }
  function showTierBanner(ctx, m, tier) {
    const now = ctx.now();
    m.banner = {key: "dev.battle.banner" + tier, c: ["white", "fire", "gold"][tier], at: now, until: now + 800};
    m.anim = Math.max(m.anim, now + 900);
    ctx.sfx(["tier_normal", "tier_strong", "tier_full"][tier]);
    if (tier === 2) ctx.hw.invert(60);
  }

  // chained blocks (player_core.c chain_locate / sweep_cursor)
  function chainLocate(Dd, t) {
    t -= Dd.start;
    for (let i = 0; i < Dd.hits; i++) {
      if (i > 0) {
        if (t < Dd.gap) return {i, t, gap: true};
        t -= Dd.gap;
      }
      if (t < Dd.sweeps[i]) return {i, t, gap: false};
      t -= Dd.sweeps[i];
    }
    return {i: Dd.hits, t: 0, gap: false};
  }
  const sweepCursor = (Dd, i, t) => Math.floor(t * 100 / Dd.sweeps[i]);
  function chainStart(ctx, m, st) {
    const hits = Math.max(1, Math.min(DEFEND_MAX_HITS, st.defendHits || 1));
    m.defend = {step: st.step, start: ctx.now(), hits, width: st.defendWidth, gap: m.P.gapMs,
      zones: st.defendZone.slice(0, hits), sweeps: st.defendSweep.slice(0, hits).map(s => s || 1),
      cursors: [NO_PRESS, NO_PRESS, NO_PRESS], done: [false, false, false], results: [null, null, null],
      sent: false, sweepSfx: 0, judgedAt: [0, 0, 0]};
    m.anim = Math.max(m.anim, ctx.now() + 200);
  }
  function settle(ctx, m, i, cursor, t) {
    const Dd = m.defend;
    Dd.cursors[i] = cursor == null ? NO_PRESS : cursor;
    Dd.done[i] = true;
    const r = m.R.judge(Dd.cursors[i], Dd.zones[i], Dd.width);
    Dd.results[i] = r;
    Dd.judgedAt[i] = t;
    if (r === PERFECT) { ctx.sfx("block_perfect"); ctx.fx.border("gold"); }
    else if (r === GOOD) ctx.sfx("block_good");
    else { ctx.sfx("block_miss"); ctx.fx.border("danger"); m.flashAt[ctx.p] = t; }
  }
  function chainSubmitIfDone(ctx, m) {
    const Dd = m.defend;
    if (Dd.sent) return;
    for (let i = 0; i < Dd.hits; i++) if (!Dd.done[i]) return;
    Dd.sent = true;
    act(ctx, m, ACT.DEFEND, Dd.hits, Dd.cursors.slice(0, 3));
  }
  function defendTick(ctx, m) {
    const Dd = m.defend, st = ctx.state;
    if (!Dd || Dd.sent) return;
    if (!st || st.step !== Dd.step) return;
    const now = ctx.now();
    const loc = chainLocate(Dd, now);
    for (let i = 0; i < Math.min(loc.i, Dd.hits); i++) if (!Dd.done[i]) settle(ctx, m, i, null, now);
    if (loc.i < Dd.hits && !loc.gap && Dd.sweepSfx <= loc.i) { Dd.sweepSfx = loc.i + 1; ctx.sfx("sweep_start"); }
    chainSubmitIfDone(ctx, m);
  }
  // First press during a sweep counts; gaps and later presses do nothing
  function defendPress(ctx, m, t) {
    const Dd = m.defend;
    if (!Dd || Dd.sent || !ctx.state || ctx.state.step !== Dd.step) return;
    const loc = chainLocate(Dd, t);
    for (let i = 0; i < Math.min(loc.i, Dd.hits); i++) if (!Dd.done[i]) settle(ctx, m, i, null, t);
    if (loc.i < Dd.hits && !loc.gap && !Dd.done[loc.i]) settle(ctx, m, loc.i, sweepCursor(Dd, loc.i, loc.t), t);
    chainSubmitIfDone(ctx, m);
  }
  const defendRunning = m => !!m.defend && !m.defend.sent;

  // HP bar animation: 1 px every 20 ms (§4.8 G); snaps on a new pet
  function hpTick(ctx, m) {
    const st = ctx.state;
    if (!st) return;
    const now = ctx.now();
    for (let p = 0; p < 2; p++) {
      const pl = st.players[p];
      const target = pl.active < TEAM_SIZE ? Math.round(pl.hp[pl.active] * 64 / m.P.hp) : 0;
      if (pl.active !== m.hpPet[p]) { m.hpPet[p] = pl.active; m.hpPx[p] = target; m.hpAt[p] = now; continue; }
      if (m.hpPx[p] === target) { m.hpAt[p] = now; continue; }
      while (now - m.hpAt[p] >= 20 && m.hpPx[p] !== target) {
        m.hpPx[p] += m.hpPx[p] < target ? 1 : -1;
        m.hpAt[p] += 20;
      }
      m.anim = Math.max(m.anim, now + 40);
    }
  }

  // New event on the state: animations and sounds (§4.8 G / H)
  function onEvent(ctx, m, st, prev) {
    const now = ctx.now();
    const me = ctx.p;
    const tgt = st.evTarget;
    m.anim = Math.max(m.anim, now + 1000);
    const sideXY = p => p === me ? [29, 50] : [101, 36];
    switch (st.evType) {
      case EV.SEND_OUT:
        for (const p of tgt === BOTH ? [0, 1] : [tgt]) m.dropAt[p] = now;
        ctx.sfx("send_out");
        break;
      case EV.SWITCH:
        m.dropAt[tgt] = now;
        ctx.sfx("switch");
        break;
      case EV.HIT: {
        const [x, y] = sideXY(tgt);
        m.flashAt[tgt] = now;
        m.lungeAt[1 - tgt] = now;
        ctx.fx.pop("-" + st.evAmount, x, y, "danger");
        ctx.sfx(st.evAmount >= 15 ? "hit_big" : "hit_small");
        if (tgt === me && st.evAmount >= 15) { ctx.hw.shake(); ctx.fx.border("danger"); }
        break;
      }
      case EV.SKILL_DAMAGE: {
        const a = 1 - tgt, el = ELEMENTS[st.players[a].active] || "fire";
        const [x, y] = sideXY(tgt);
        m.flashAt[tgt] = now;
        ctx.fx.pop("-" + st.evAmount, x, y, "danger");
        if (el === "grass") {
          m.parts.push({kind: "drain", from: tgt, to: a, at: now});
          const h = prev && prev.players[a].active === st.players[a].active ? st.players[a].hp[st.players[a].active] - prev.players[a].hp[prev.players[a].active] : 0;
          m.drainHeal = {evId: st.evId, n: Math.max(0, h)};
          if (h > 0) { const [ax, ay] = sideXY(a); m.popLater = {text: "+" + h, x: ax, y: ay, c: "grassLt", at: now + 400}; }
          ctx.sfx("skill_drain");
        } else {
          m.parts.push({kind: "flame", side: tgt, t0: now});
          ctx.sfx("skill_burn");
        }
        break;
      }
      case EV.HEAL: {
        const [x, y] = sideXY(tgt);
        ctx.fx.pop("+" + st.evAmount, x, y, "grassLt");
        ctx.sfx("skill_shield");
        break;
      }
      case EV.BURN: {
        const [x, y] = sideXY(tgt);
        m.flashAt[tgt] = now;
        m.parts.push({kind: "flame", side: tgt, t0: now});
        ctx.fx.pop("-" + st.evAmount, x, y, "danger");
        ctx.sfx("burn_tick");
        break;
      }
      case EV.KO: {
        m.koAt[tgt] = now;
        const [sx, sy] = tgt === me ? [14, 43] : [86, 30];
        ctx.fx.dissolve(sx, sy, 30, 30);
        ctx.hw.invert(60);
        ctx.sfx("faint");
        break;
      }
    }
  }

  // T0 statistics, kept on every board from what it sees (deduplicated by
  // step / event id): the fallback when the lobby's mode_res is missing
  function statsTrack(m, st) {
    if (st.phase === PH.DEFEND && m.statStep !== st.step) {
      m.statStep = st.step;
      m.best[st.turn] = Math.max(m.best[st.turn], st.attackScore);
      m.seenTrial[st.turn] = true;
    }
    if (st.evType === EV.HIT && m.statEv !== st.evId) {
      m.statEv = st.evId;
      for (let i = 0; i < st.defendHits; i++) if (blockAt(st.evResult, i) === PERFECT) m.perfects[st.evTarget]++;
    }
  }

  const player = {
    create(ctx) {
      const P = D.battleParams();
      return {
        P, R: makeRules(P), cfg: D.trial.cfgFrom(P),
        actedStep: -1, lastStep: -1, lastEv: null,
        trial: null, trialResult: null, defend: null, switching: null,
        picked: null, sendOutMask: 0, sendOutStep: -1, sendOutAt: 0,
        padArmed: false, overAt: null, flagAt: null,
        hpPx: [0, 0], hpPet: [NO_PET, NO_PET], hpAt: [0, 0],
        lastActive: [NO_PET, NO_PET], dropAt: [-1e9, -1e9], flashAt: [-1e9, -1e9], lungeAt: [-1e9, -1e9], koAt: [-1e9, -1e9],
        parts: [], banner: null, popLater: null, drainHeal: null, denyAt: -1e9, anim: 0,
        best: [0, 0], perfects: [0, 0], seenTrial: [false, false], statStep: -1, statEv: -1,
      };
    },
    destroy(ctx) { if (ctx && ctx.m && ctx.m.trial) dropTrial(ctx, ctx.m); },
    // battle.state has no match field (v5 layout): GAME_OVER -> SEND_OUT is a new match
    newMatch: (ctx, msg, prev) => prev.phase === PH.GAME_OVER && msg.phase === PH.SEND_OUT,
    onState(ctx, st, prev) {
      const m = ctx.m;
      if (!m) return;
      const now = ctx.now();
      const me = ctx.p;
      const newStep = st.step !== m.lastStep;
      if (newStep) {
        const oldStep = m.lastStep;
        m.lastStep = st.step;
        // a chain from an older step is over (the central timed it out)
        if (m.defend && m.defend.step !== st.step) m.defend = null;
        // my trial result carries over into the DEFEND step it caused
        if (m.trialResult && st.phase === PH.DEFEND && st.turn === me && m.trialResult.step === oldStep) m.trialResult.defStep = st.step;
        m.switching = null;                 // player_core: any new step ends the switch choice
        if (m.trial && m.trial.step !== st.step) dropTrial(ctx, m);
        if (st.phase === PH.TURN) m.padArmed = false;   // a squeeze held from before does not count
        if (st.phase === PH.DEFEND && ((st.waiting >> me) & 1) && (!m.defend || m.defend.step !== st.step)) chainStart(ctx, m, st);
        if (st.phase === PH.DEFEND && st.turn !== me && prev) showTierBanner(ctx, m, st.attackTier);
        if (st.phase === PH.TURN && st.turn === me && ((st.waiting >> me) & 1) && prev) {
          ctx.fx.border("accent"); ctx.sfx("your_turn");
        }
        if (st.phase === PH.SEND_OUT && m.sendOutStep !== st.step) { m.sendOutStep = st.step; m.sendOutMask = st.waiting; m.sendOutAt = now; }
        if (st.phase === PH.GAME_OVER && m.overAt == null) m.overAt = now;
        if (st.phase !== PH.GAME_OVER) m.overAt = null;
        if (st.phase !== PH.TURN) m.flagAt = null;
      }
      if (st.phase === PH.SEND_OUT) m.sendOutMask |= st.waiting;
      if ((st.flags & FLAG_TRIAL) && m.flagAt == null) m.flagAt = now;
      if (!(st.flags & FLAG_TRIAL)) m.flagAt = null;
      if (m.lastEv !== st.evId) {
        if (m.lastEv !== null && prev) onEvent(ctx, m, st, prev);
        m.lastEv = st.evId;
      }
      for (let p = 0; p < 2; p++) if (st.players[p].active < TEAM_SIZE) m.lastActive[p] = st.players[p].active;
      statsTrack(m, st);
    },
    tick(ctx) {
      const m = ctx.m, st = ctx.state;
      if (!m || !st) return;
      const now = ctx.now();
      if (ctx.input.pressure < C.CTL_PRESS_RELEASE) m.padArmed = true;
      if (m.trial) trialTick(ctx, m);
      // a squeeze starts only Ember's trial (§2A / §2B: Tide and Sprout start with A)
      else if (canStartTrial(ctx, m) && myPet(ctx) === 0 && ctx.padOn() && m.padArmed && ctx.input.pressure > C.CTL_PRESS_START) {
        startTrial(ctx, m, now, "pad");
        m.padArmed = false;
      }
      defendTick(ctx, m);
      hpTick(ctx, m);
      if (m.popLater && now >= m.popLater.at) { const q = m.popLater; m.popLater = null; ctx.fx.pop(q.text, q.x, q.y, q.c); }
    },
    route(ctx) {
      const st = ctx.state, m = ctx.m;
      if (!st || !m) return "battle.hud";
      if (st.phase === PH.SEND_OUT && (((st.waiting >> ctx.p) & 1) || (m.picked && m.picked.step === st.step))) return "battle.pick";
      if (st.phase === PH.GAME_OVER && ((st.flags & FLAG_QUIT) || (m.overAt != null && ctx.now() - m.overAt >= 1500))) return "results";
      return "battle.hud";
    },
    busy: ctx => !!ctx.m && (!!ctx.m.trial || defendRunning(ctx.m)),
    inputBits: ctx => ctx.m && ctx.m.trial ? 0x80 : 0,
    heartbeat: true,
    pauseItems: [],
    results(ctx) { return results(ctx); },
  };

  /* ================= 5. screens ================= */

  // ---- S11: secret send-out (§4.7) ----
  // y 118: how the pet under the cursor attacks on this handheld (hold A without its sensor)
  const howKey = (ctx, pet) => pet === 0 ? (ctx.padOn() ? "dev.battle.how.ember" : "dev.battle.how.hold")
    : pet === 1 ? (ctx.tiltOn() ? "dev.battle.how.tide" : "dev.battle.how.hold") : "dev.battle.how.sprout";
  const firstAlive = (pl, from = 0) => { for (let i = 0; i < 3; i++) { const k = (from + i) % 3; if (pl.hp[k] > 0) return k; } return 0; };
  D.registerScreen("battle.pick", {
    secret: true,
    fps: 10,
    enter(ctx) {
      const st = ctx.state, m = ctx.m;
      const pl = st ? st.players[ctx.p] : null;
      ctx.s.sel = pl ? firstAlive(pl, m && m.lastActive[ctx.p] < 3 ? m.lastActive[ctx.p] : 0) : 0;
      ctx.s.locked = false;
    },
    input(ctx, ev) {
      const st = ctx.state, m = ctx.m;
      if (!st || !m || st.phase !== PH.SEND_OUT) return;
      const pl = st.players[ctx.p];
      ctx.s.locked = !!(m.picked && m.picked.step === st.step) || !((st.waiting >> ctx.p) & 1);
      const before = ctx.s.sel;
      const r = D.ui.pickInput(ctx, ev, ctx.s, {count: 3, canPick: i => pl.hp[i] > 0});
      // the cursor skips fainted pets (player_core step_alive_pet)
      if (ctx.s.sel !== before && pl.hp[ctx.s.sel] === 0) {
        const dir = ev.btn === "LEFT" ? 2 : 1;
        let k = ctx.s.sel;
        for (let n = 0; n < 2 && pl.hp[k] === 0; n++) k = (k + dir) % 3;
        ctx.s.sel = k;
      }
      if (r && r.pick != null && myMove(ctx, m)) {
        m.picked = {step: st.step, pet: r.pick};
        act(ctx, m, ACT.SEND_OUT, r.pick);
      }
    },
    draw(ctx, g) {
      const st = ctx.state, m = ctx.m;
      if (!st || !m) return;
      const me = ctx.p, rv = 1 - me, pl = st.players[me];
      const locked = !!(m.picked && m.picked.step === st.step) || !((st.waiting >> me) & 1);
      const replace = pl.hp.some(h => h === 0);
      const sel = locked && m.picked ? m.picked.pet : ctx.s.sel;
      const el = ELEMENTS[sel];
      const beatsIdx = ELEMENTS.indexOf(BEATS[el]);
      const weakIdx = ELEMENTS.findIndex(e => BEATS[e] === el);
      const rivalIn = (m.sendOutMask >> rv) & 1;
      const rivalPicking = (st.waiting >> rv) & 1;
      const waitedLong = locked && rivalPicking && ctx.now() - m.sendOutAt > 30000;
      D.ui.pickScreen(g, ctx, {
        titleKey: replace ? "dev.battle.nextPet" : "dev.battle.sendOut", badgeKey: "dev.battle.secret",
        noteKey: "dev.battle.secretNote", sel, locked,
        statusKey: rivalIn ? (rivalPicking ? "dev.battle.rivalChoosing" : "dev.battle.rivalPicked") : null,
        info: locked ? ["dev.battle.waitRival", null] : [null, howKey(ctx, sel)],
        cards: [0, 1, 2].map(i => pl.hp[i] > 0
          ? {pet: i, line1: {hp: pl.hp[i], max: m.P.hp}, line2: String(pl.hp[i]), mark: locked && m.picked && m.picked.pet === i ? "ok" : null}
          : {pet: i, line1: "dev.battle.ko", disabled: true}),
        hints: locked ? (waitedLong ? [null, null, ["M", "dev.battle.hintHold"]] : [])
          : [["LR", "dev.battle.hintPick"], ["A", "dev.battle.hintGo"], waitedLong ? ["M", "dev.battle.hintHold"] : ["B", "dev.ui.next"]],
      });
      // y 104: {UP} the pet it beats (grassLt), {DN} the pet that beats it (danger), §4.7
      if (!locked) {
        g.text(4, 104, ctx.t("dev.battle.beatsShort", {pet: petName(ctx, beatsIdx)}), {c: "grassLt", w: 56});
        g.text(64, 104, ctx.t("dev.battle.weakShort", {pet: petName(ctx, weakIdx)}), {c: "danger", w: 56});
      }
    },
  });

  // ---- S12: battle HUD (§4.8) ----
  const SPR = {me: [14, 43], rival: [86, 30]};
  function drawPlatform(g, x, y) {
    const rows = [24, 34, 40, 40, 34, 24];
    rows.forEach((w, i) => g.dither(x + 20 - w / 2, y + i, w, 1, "line", null));
  }
  function drawPet(ctx, g, m, st, p, hidden, busyTrial) {
    const me = ctx.p, now = ctx.now();
    const [bx, by] = p === me ? SPR.me : SPR.rival;
    const pl = st.players[p];
    let pet = pl.active;
    let x = bx, y = by;
    // fainted: sink for 300 ms (the core's dissolve dithers over it)
    if (pet >= TEAM_SIZE) {
      const k = now - m.koAt[p];
      if (k < 300 && m.lastActive[p] < TEAM_SIZE) { pet = m.lastActive[p]; y += Math.floor(k / 40); }
      else return;
    }
    if (hidden) return;
    const drop = now - m.dropAt[p];
    if (drop < 160) y -= Math.round(36 * (1 - drop / 160));
    const lunge = now - m.lungeAt[p];
    if (lunge < 200) x += (p === me ? 1 : -1) * Math.round(6 * (1 - Math.abs(lunge - 100) / 100));
    const idle = st.phase === PH.TURN || st.phase === PH.SEND_OUT || st.phase === PH.GAME_OVER;
    if (idle && !busyTrial && Math.floor(now / 500) % 2 === (p === me ? 0 : 1)) y -= 1;
    // Sprout's trial: my pet hops 2 px on every beat (§4.8 C3), so the rhythm shows without the lane
    if (p === me && m.trial && m.trial.kind === "beat") {
      const e = now - m.trial.start;
      if (m.trial.B.sc.notes.some(nt => e >= nt.b && e - nt.b < 100)) y -= 2;
    }
    const flash = now - m.flashAt[p] < 120;
    g.sprite(D.PETS[pet].sprite, x, y, {scale: 3, color: flash ? "white" : null});
    if (pl.shield && pl.active < TEAM_SIZE) g.frame(x - 2, y - 2, 34, 34, "waterLt");
  }
  function drawParticles(ctx, g, m) {
    const now = ctx.now(), me = ctx.p;
    const center = p => p === me ? [SPR.me[0] + 15, SPR.me[1] + 15] : [SPR.rival[0] + 15, SPR.rival[1] + 15];
    m.parts = m.parts.filter(q => now - (q.t0 != null ? q.t0 : q.at) < 700);
    for (const q of m.parts) {
      if (q.kind === "flame") {
        const k = (now - q.t0) / 700, [cx, cy] = center(q.side);
        [-9, 0, 9].forEach((dx, i) => {
          const yy = cy + 6 - Math.round(k * 26) - i * 3;
          g.rect(cx + dx - 2, yy, 4, 4, i === 1 ? "gold" : "fire");
        });
      } else if (q.kind === "drain") {
        const k = Math.min(1, (now - q.at) / 400);
        if (k >= 1) continue;
        const [fx, fy] = center(q.from), [tx, ty] = center(q.to);
        for (let i = 0; i < 4; i++) {
          const kk = Math.max(0, Math.min(1, k * 1.3 - i * 0.1));
          g.rect(Math.round(fx + (tx - fx) * kk) - 1 + (i % 2) * 3, Math.round(fy + (ty - fy) * kk) - 1 + (i >> 1) * 3, 2, 2, "grassLt");
        }
      }
    }
  }
  function drawPanel(ctx, g, m, st, p, y0, hidden) {
    const me = ctx.p;
    const pl = st.players[p];
    g.rect(0, y0, W, 27, "panel");
    if (y0 > 0) g.hline(0, y0, W, "line");
    g.hline(0, y0 + 27, W, "line");
    g.rect(2, y0 + 2, 3, 10, playerColor(ctx, p));
    g.text(6, y0 + 1, playerName(ctx, p), {w: 36});
    const pet = hidden ? NO_PET : pl.active;
    g.text(46, y0 + 1, pet < TEAM_SIZE ? petName(ctx, pet) : "?", {w: 38, c: pet < TEAM_SIZE ? "white" : "muted"});
    if (pet < TEAM_SIZE) g.sprite(D.PETS[pet].icon, 96, y0 + 3);
    // matchup arrow on my panel: {UP} I beat it, {DN} it beats me
    const rp = st.players[1 - p].active;
    if (p === me && pet < TEAM_SIZE && rp < TEAM_SIZE && !hidden) {
      const pct = m.R.petTypePct(pet, rp);
      if (pct > 100) g.sprite("icon.UP", 86, y0 + 3, {color: "grassLt"});
      else if (pct < 100) g.sprite("icon.DN", 86, y0 + 3, {color: "danger"});
    }
    for (let k = 0; k < 3; k++) {
      const x = 106 + 7 * k, y = y0 + 4;
      if (pl.hp[k] > 0) {
        g.rect(x, y, 5, 5, D.PETS[k].color);
        if (k === pet) g.frame(x - 1, y - 1, 7, 7, "white");
      } else {
        g.rect(x, y, 5, 5, "line");
        for (let d = 0; d < 5; d++) { g.px(x + d, y + d, "void"); g.px(x + 4 - d, y + d, "void"); }
      }
    }
    // HP bar: frame x 4-69, inside 64 px, y 16-21
    g.frame(4, y0 + 16, 66, 6, "line");
    if (pet < TEAM_SIZE) {
      const px = Math.max(0, Math.min(64, m.hpPx[p]));
      const c = px * 100 > 50 * 64 ? "grassLt" : px * 100 >= 20 * 64 ? "gold" : "danger";
      if (px > 0) g.rect(5, y0 + 17, px, 4, c);
      g.text(74, y0 + 13, pl.hp[pet] + "/" + m.P.hp, {font: "s", w: 32});
      if (pl.burn) g.sprite("icon.flame", 106, y0 + 15);
      if (pl.shield) g.sprite("icon.shield", 116, y0 + 15);
    }
  }
  function signalBars(ctx) {
    const n = ctx.link.up ? ctx.link.rxPerSec : 0;
    return n >= 8 ? 3 : n >= 5 ? 2 : n >= 1 ? 1 : 0;
  }
  function statusBar(ctx, g, st, left, color) {
    g.rect(0, 147, W, 13, "panel");
    g.hline(0, 146, W, "line");
    if (left) g.text(4, 146, left, {c: color || "white", w: 72});
    if (st) g.text(110, 146, ctx.t("dev.battle.round", {n: st.round}), {align: "r", c: "muted", w: 48});
    D.ui.signal(g, 116, 149, signalBars(ctx));
  }
  const ROW = [104, 118, 132];

  function eventRows(ctx, m, st) {
    const t = (k, v) => ctx.t(k, v);
    const act = p => st.players[p].active;
    const matchup = () => {
      const a = act(0), b = act(1);
      if (a >= TEAM_SIZE || b >= TEAM_SIZE) return null;
      const pct = m.R.petTypePct(a, b);
      if (pct === 100) return null;
      const [w, l] = pct > 100 ? [a, b] : [b, a];
      return [t("dev.battle.matchup", {a: petName(ctx, w), b: petName(ctx, l)}), "muted"];
    };
    const eff = (a, d) => {
      if (act(a) >= TEAM_SIZE || act(d) >= TEAM_SIZE) return null;
      const pct = m.R.petTypePct(act(a), act(d));
      return pct > 100 ? [t("dev.battle.evSuper"), "gold"] : pct < 100 ? [t("dev.battle.evWeak"), "muted"] : null;
    };
    const tg = st.evTarget;
    switch (st.evType) {
      case EV.SEND_OUT:
        if (tg === BOTH) return [[t("dev.battle.evBoth"), "white"], matchup()];
        return [[t("dev.battle.evSendOut", {name: playerName(ctx, tg), pet: petName(ctx, act(tg))}), "white"], matchup()];
      case EV.HIT: {
        let k = 0;
        for (let i = 0; i < st.defendHits; i++) if (blockAt(st.evResult, i) !== MISS) k++;
        return [[t("dev.battle.evHit", {tier: t("dev.battle.tier" + st.attackTier), k, n: st.defendHits}), ["white", "fire", "gold"][st.attackTier]],
          [t("dev.battle.evDmg", {pet: petName(ctx, act(tg)), n: st.evAmount}), "white"], eff(1 - tg, tg)];
      }
      case EV.SKILL_DAMAGE: {
        const a = 1 - tg, sk = act(a) < TEAM_SIZE ? SKILL_KEYS[act(a)] : SKILL_KEYS[0];
        const rows = [[t("dev.battle.evSkill", {skill: t(sk), pet: petName(ctx, act(tg)), n: st.evAmount}), "white"]];
        if (act(a) === 2 && m.drainHeal && m.drainHeal.evId === st.evId && m.drainHeal.n > 0)
          rows.push([t("dev.battle.evDrainHeal", {pet: petName(ctx, act(a)), n: m.drainHeal.n}), "grassLt"]);
        rows.push(eff(a, tg));
        return rows;
      }
      case EV.HEAL: return [[t("dev.battle.evHeal", {pet: petName(ctx, act(tg)), n: st.evAmount}), "waterLt"]];
      case EV.BURN: return [[t("dev.battle.evBurn", {pet: petName(ctx, act(tg)), n: st.evAmount}), "fire"]];
      case EV.KO: return [[t("dev.battle.evKo", {pet: petName(ctx, m.lastActive[tg])}), "danger"]];
      case EV.SWITCH: return [[t("dev.battle.evSwitch", {name: playerName(ctx, tg), pet: petName(ctx, act(tg))}), "white"], matchup()];
      case EV.WIN: return [[t("dev.battle.evWin", {name: playerName(ctx, tg)}), "gold"]];
    }
    return [];
  }
  function drawRows(g, rows) {
    rows.filter(Boolean).slice(0, 3).forEach(([s, c], i) => g.text(4, ROW[i], s, {c, w: 120}));
  }

  // C: the attack trial, horizontal, like the web prototype. C1 Ember (and
  // every hold-A fallback): the band; C2 Tide tilting: the wave and the drop;
  // C3 Sprout: the note lane. Progress bar and text row are the same for all.
  function drawTrial(ctx, g, m) {
    const tr = m.trial, P = m.P, now = ctx.now();
    let ready, stg, stageScore, right;
    if (tr.kind === "beat") {
      const B = tr.B;
      drawLane(ctx, g, m, tr);
      ready = PT.beat.ready(B); stg = ready ? -1 : PT.beat.stage(B);
      stageScore = k => PT.beat.stageScore(B, k);
      if (!ready) { const v = PT.beat.stageLive(B, stg); right = v == null ? "--" : v + "%"; }
    } else {
      const T = tr.T;
      if (tr.kind === "tilt") drawWave(ctx, g, T);
      else D.ui.bandBar(g, 3, 106, 122, 14, {center: T.center, width: P.bandPct, level: T.level, inside: T.inside});
      ready = D.trial.ready(T); stg = ready ? -1 : D.trial.stage(T);
      stageScore = k => D.trial.stageScore(T, k);
      if (!ready) right = D.trial.stageScore(T, stg) + "%";
    }
    // progress: ready 14 px (x 4-17), three stages of 35 px (x 18-52 / 53-87 / 88-122)
    g.rect(4, 123, 14, 5, ready ? "accent" : "muted");
    for (let k = 0; k < 3; k++) {
      let c = "line";
      if (k < stg) {
        const s = stageScore(k);
        c = s < P.tierStrong ? "white" : s < P.tierUlt ? "fire" : "gold";
      } else if (k === stg) c = "accent";
      g.rect(18 + 35 * k, 123, 34, 5, c);
    }
    let left, lc = "white";
    if (ready) left = ctx.t("dev.battle.ready");
    else if (now - tr.cueAt < 700 && stg === 0) { left = ctx.t("dev.battle.go"); lc = "gold"; }
    else if (now - tr.cueAt < 700) { left = ctx.t("dev.battle.faster", {n: stg + 1}); lc = "gold"; }
    else left = ctx.t("dev.battle.stage", {n: stg + 1});
    g.text(4, 130, left, {c: lc, w: 96});
    if (!ready) g.text(123, 130, right, {align: "r", w: 24});
  }
  // C2 (ui-design §4.8): the band is a wave (water, a waterLt crest with 2 px
  // bumps every 4 px that flow with the band time), the pointer a drop
  function drawWave(ctx, g, T) {
    const x = 3, y = 106, w = 122, h = 14;
    g.frame(x, y, w, h, "line");
    const ix = x + 1, iw = w - 2, iy = y + 1, ih = h - 2;
    g.rect(ix, iy, iw, ih, "void");
    const at = L => ix + Math.round(Math.max(0, Math.min(100, L)) * (iw - 1) / 100);
    const half = T.cfg.bandPct / 2, a = at(T.center - half), b = at(T.center + half);
    g.rect(a, iy, b - a + 1, ih, "water");
    g.hline(a, iy, b - a + 1, "waterLt");
    const phase = Math.floor(D.trial.tau100(T.elapsed, T.cfg) / 100 / 120) % 4;
    for (let xx = a; xx <= b; xx++) if ((xx - ix + 4 - phase) % 4 < 2) g.px(xx, iy + 1, "waterLt");
    for (const t of [25, 50, 75]) { g.rect(at(t), iy + ih - 2, 2, 2, "line"); g.rect(at(t), iy, 2, 2, "line"); }
    const cx = 4 + Math.round(Math.max(0, Math.min(100, T.level)) * 119 / 100);
    g.sprite("battle.drop", cx - 2, 108, T.inside ? {map: {"#": "white", "+": "gold"}} : {});
    g.px(cx, 106, "white");
    g.px(cx, 119, "white");
  }
  // C3: the note lane. Notes come from the right at BEAT_LANE_PX_PER_S and
  // reach the judge line (x 13-14) on their beat; rests are small grey dots
  function drawLane(ctx, g, m, tr) {
    const B = tr.B, now = ctx.now(), e = now - tr.start, cfg = B.cfg;
    g.frame(3, 106, 122, 14, "line");
    g.rect(4, 107, 120, 12, "void");
    g.hline(4, 112, 120, "line");
    const xOf = b => 14 + Math.trunc((b - e) * cfg.lanePxPerS / 1000);
    g.clip(4, 107, 120, 12);
    for (const sl of B.sc.slots) {
      const x = xOf(sl.b);
      if (x > 123 || x < 4) continue;
      if (sl.rest) { g.rect(x - 1, 111, 2, 2, "line"); continue; }
      const i = B.sc.notes.indexOf(sl), r = B.res[i];
      if (r === "perfect" || r === "good") continue;    // hit: shown as a mark on the line
      g.sprite("battle.leaf", x - 3, 109, r === "miss" ? {color: "muted"} : {});
    }
    g.unclip();
    // the judge line flashes gold for 80 ms on every beat and count-in click
    const flash = B.sc.notes.some(nt => e >= nt.b && e - nt.b < 80) || B.sc.counts.some(c => e >= c && e - c < 80);
    g.rect(13, 105, 2, 16, flash ? "gold" : "white");
    for (const mk of tr.marks) {
      if (now - mk.at >= 150) continue;
      if (mk.kind === "stray") g.sprite("icon.NO", 4, 109);
      else g.sprite(mk.kind === "perfect" ? "icon.STAR" : "icon.OK", 10, 109, mk.kind === "good" ? {color: "grassLt"} : {});
    }
  }

  // F: chained blocks
  function drawChain(ctx, g, m) {
    const Dd = m.defend, now = ctx.now();
    const lay = Dd.hits === 3 ? [[106, 11], [119, 11], [132, 11]] : Dd.hits === 2 ? [[108, 14], [126, 14]] : [[114, 17]];
    const loc = Dd.sent ? {i: Dd.hits, t: 0, gap: false} : chainLocate(Dd, now);
    const X = v => 13 + Math.round(Math.max(0, Math.min(100, v)) * 109 / 100);
    for (let i = 0; i < Dd.hits; i++) {
      const [y, h] = lay[i];
      const isCur = i === loc.i && !Dd.done[i];
      const done = Dd.done[i];
      g.frame(12, y, 112, h, isCur ? "accent" : "line");
      const z = Dd.zones[i], [lo, hi] = m.R.perfectRange(z, Dd.width);
      g.rect(X(z), y + 1, X(z + Dd.width) - X(z) + 1, h - 2, isCur ? "grass" : "grassDk");
      if (hi >= lo) g.rect(X(lo), y + 1, X(hi) - X(lo) + 1, h - 2, isCur ? "gold" : "fireDk");
      // icon slot x 2-9: number, then the result
      const iy = y + Math.floor((h - 8) / 2);
      if (done) g.sprite(Dd.results[i] === PERFECT ? "icon.STAR" : Dd.results[i] === GOOD ? "icon.OK" : "icon.NO", 2, iy);
      else g.text(6, iy - 3, String(i + 1), {font: "s", align: "c", c: isCur ? "white" : "muted"});
      if (done && Dd.cursors[i] !== NO_PRESS) g.rect(X(Dd.cursors[i]), y - 1, 2, h + 2, "muted");
      if (isCur && !loc.gap) g.rect(X(sweepCursor(Dd, i, loc.t)), y - 1, 2, h + 2, "white");
    }
  }

  // B: switch box (two candidates side by side; controls.c only reads joy_x)
  function drawSwitch(ctx, g, m, st) {
    g.text(4, 104, ctx.t("dev.battle.switchTo"), {w: 120});
    const cands = switchTargets(st, ctx.p), pl = st.players[ctx.p];
    cands.forEach((k, i) => {
      const x = i === 0 ? 4 : 66;
      if (i === m.switching.sel) { g.rect(x, 118, 58, 28, "panel"); g.frame(x, 118, 58, 28, "accent", 2); }
      g.sprite(D.PETS[k].sprite, x + 2, 120);
      g.text(x + 14, 118, petName(ctx, k), {w: 42});
      g.text(x + 14, 131, pl.hp[k] + "/" + m.P.hp, {font: "s", w: 42, c: "muted"});
    });
  }

  function trialHint(ctx, tr) {
    if (tr.kind === "tilt") return "dev.battle.hintTilt";
    if (tr.kind === "beat") return ctx.settings.volume ? "dev.battle.hintBeat" : "dev.battle.hintBeatMute";
    if (tr.pet === 1) return "dev.battle.hintNoTilt";
    return tr.src === "pad" ? "dev.battle.hintPad" : "dev.battle.hintHoldA";
  }

  function hudPhase(ctx, m, st) {
    const me = ctx.p;
    if (m.trial) return "trial";
    if (m.defend && st.phase === PH.DEFEND && m.defend.step === st.step) return "chain";
    if (st.phase === PH.TURN && st.turn === me) {
      if (m.trialResult && m.trialResult.step === st.step) return "result";
      if (m.switching && myMove(ctx, m)) return "switch";
      if (m.actedStep === st.step) return "wait";
      return "turn";
    }
    if (st.phase === PH.TURN) return "rival";
    if (st.phase === PH.DEFEND) return st.turn === me ? "result" : "wait";
    if (st.phase === PH.SEND_OUT) return "picking";
    return "event";   // RESOLVE, GAME_OVER
  }

  D.registerScreen("battle.hud", {
    toastY: 28,
    holdBarAt: [62, 147, 48, 12],
    antennaAt: [116, 149],
    fps(ctx) {
      const m = ctx.m;
      if (!m) return 6;
      if (defendRunning(m)) return 60;
      if (m.trial || ctx.now() < m.anim) return 30;
      return 6;
    },
    input(ctx, ev) {
      const st = ctx.state, m = ctx.m;
      if (!st || !m) return;
      const me = ctx.p;
      // F: every A press edge is one block (the stick click does not count)
      if (m.defend && !m.defend.sent && ev.btn === "A" && ev.type === "down" && !ev.fromStick) { defendPress(ctx, m, ev.t); return; }
      // Sprout's trial: every A press edge is a tap at its edge time (the stick click does not count)
      if (m.trial && m.trial.kind === "beat" && ev.btn === "A" && ev.type === "down" && !ev.fromStick) { beatTap(ctx, m, ev.t); return; }
      if (m.trial) return;
      // B: switch box
      if (m.switching) {
        if (!myMove(ctx, m) || st.phase !== PH.TURN) { m.switching = null; return; }
        const cands = switchTargets(st, me);
        if ((ev.type === "down" || ev.type === "repeat") && (ev.btn === "LEFT" || ev.btn === "RIGHT" || (ev.btn === "B" && ev.type === "down"))) {
          if (cands.length > 1) { m.switching.sel = 1 - m.switching.sel; ctx.sfx("ui_move"); }
          return;
        }
        if (ev.btn === "A" && ev.type === "down" && !ev.fromStick) {
          const k = cands[m.switching.sel];
          m.switching = null;
          if (k != null) { act(ctx, m, ACT.SWITCH, k); ctx.sfx("ui_ok"); }
          return;
        }
        if (ev.btn === "MENU" && ev.type === "click") { m.switching = null; ctx.sfx("ui_back"); }
        return;
      }
      // A: my turn, before the trial
      if (!canStartTrial(ctx, m)) return;
      if (ev.btn === "A" && ev.type === "down" && !ev.fromStick) { startTrial(ctx, m, ev.t, ctx.padOn() ? "pad" : "btn"); return; }
      if ((ev.btn === "B" || ev.btn === "SKILL") && ev.type === "down") {
        if (st.players[me].cooldown === 0) { act(ctx, m, ACT.SKILL); ctx.sfx("ui_ok"); }
        else { ctx.sfx("ui_deny"); m.denyAt = ctx.now(); m.anim = Math.max(m.anim, ctx.now() + 300); }
        return;
      }
      if (ev.btn === "MENU" && ev.type === "click") {
        if (switchTargets(st, me).length) { m.switching = {sel: 0}; ctx.sfx("ui_ok"); }
        else ctx.sfx("ui_deny");
      }
    },
    draw(ctx, g) {
      const st = ctx.state, m = ctx.m;
      if (!st || !m) { statusBar(ctx, g, null, ctx.t("dev.battle.wait"), "muted"); return; }
      const me = ctx.p, rv = 1 - me, now = ctx.now();
      const ph = hudPhase(ctx, m, st);
      // rival's pet stays hidden while it is being picked (state I)
      const rivalHidden = st.phase === PH.SEND_OUT && ((st.waiting >> rv) & 1);
      // field y 28-75
      drawPlatform(g, 81, 58);
      drawPlatform(g, 9, 70);
      drawPet(ctx, g, m, st, rv, rivalHidden, false);
      if (rivalHidden) g.text(101, 36, "?", {align: "c", scale: 2, c: "muted"});
      drawPet(ctx, g, m, st, me, false, !!m.trial);
      if (m.trial && m.trial.kind !== "beat" && Math.floor(now / 125) % 2 === 0) {
        const stg = D.trial.ready(m.trial.T) ? -1 : D.trial.stage(m.trial.T);
        g.frame(SPR.me[0] - 3, SPR.me[1] - 3, 36, 36, stg <= 0 ? "waterLt" : stg === 1 ? "gold" : "fire");
      }
      drawParticles(ctx, g, m);
      if (m.banner && now < m.banner.until) D.ui.banner(g, ctx, m.banner.key, {}, {c: m.banner.c, scale: 2, y: 40});
      drawPanel(ctx, g, m, st, rv, 0, rivalHidden);
      drawPanel(ctx, g, m, st, me, 76, false);
      // action area y 104-145 + status bar
      const t = (k, v) => ctx.t(k, v);
      const pl = st.players[me];
      switch (ph) {
        case "turn": {
          // {A} + this pet's trial icon (§4.8 A): Ember {PAD}, Tide {TILT}, Sprout {NOTE};
          // without the pad / a usable accelerometer only {A}
          const pet = pl.active;
          const icon2 = pet === 0 ? (ctx.padOn() ? "{PAD}" : "") : pet === 1 ? (ctx.tiltOn() ? "{TILT}" : "") : pet === 2 ? "{NOTE}" : "";
          g.text(4, 104, "{A}" + icon2);
          g.text(icon2 ? 26 : 16, 104, t("dev.battle.attack"), {w: 62});
          const cd = pl.cooldown, deny = now - m.denyAt < 250;
          const c2 = cd || deny ? "muted" : "white";
          g.text(4, 118, "{S}", {c: c2});
          g.text(16, 118, t(pl.active < TEAM_SIZE ? SKILL_KEYS[pl.active] : SKILL_KEYS[0]), {c: c2, w: 70});
          if (cd) {
            const v = t("dev.battle.skCd", {n: cd});
            const r = g.measure(v);
            g.text(123, 118, v, {align: "r", c: "muted", w: 40});
            g.sprite("icon.hourglass", 123 - r.w - 10, 121);
          } else g.text(123, 118, t("dev.battle.skReady"), {align: "r", c: "grassLt", w: 40});
          const can = switchTargets(st, me).length > 0;
          g.text(4, 132, "{M}", {c: can ? "white" : "line"});
          g.text(16, 132, t("dev.battle.switch"), {c: can ? "white" : "line", w: 64});
          statusBar(ctx, g, st, t("dev.battle.yourTurn"), "accent");
          break;
        }
        case "switch":
          drawSwitch(ctx, g, m, st);
          D.ui.hintBar(g, ctx, [["LR", "dev.battle.hintPick"], ["A", "dev.battle.hintSwitch"], ["M", "dev.battle.hintBack"]]);
          break;
        case "trial":
          drawTrial(ctx, g, m);
          statusBar(ctx, g, null, null);
          g.text(4, 146, t(trialHint(ctx, m.trial)), {w: 110});
          break;
        case "result": {
          const r = m.trialResult && (m.trialResult.step === st.step || m.trialResult.defStep === st.step) ? m.trialResult : null;
          const score = r ? r.score : st.attackScore, tier = r ? r.tier : st.attackTier;
          g.text(4, 104, t("dev.battle.trialResult", {score, tier: t("dev.battle.tier" + tier)}), {c: ["white", "fire", "gold"][tier], w: 120});
          if (r) g.text(4, 118, r.stages.map(s => s + "%").join("  "), {w: 120});
          if (st.phase === PH.DEFEND) g.text(4, 132, t("dev.battle.rivalBlocking"), {c: "muted", w: 120});
          statusBar(ctx, g, st, t("dev.battle.wait"), "muted");
          break;
        }
        case "rival": {
          if ((st.flags & FLAG_TRIAL) && m.flagAt != null) {
            g.text(4, 104, t("dev.battle.rivalAttacking"), {c: "danger", w: 120});
            g.text(4, 118, t("dev.battle.getReady"), {w: 120});
            const total = D.trial.endMs(m.cfg), k = Math.min(1, (now - m.flagAt) / total);
            g.frame(4, 134, 120, 6, "line");
            g.rect(5, 135, Math.round(118 * k), 4, "accent");
          } else {
            g.text(4, 104, t("dev.battle.rivalTurn"), {w: 120});
            g.textBox(4, 118, 120, 28, t("dev.battle.rivalOptions"), {c: "muted"});
          }
          statusBar(ctx, g, st, t("dev.battle.rivalTurn"), "muted");
          break;
        }
        case "chain": {
          drawChain(ctx, g, m);
          const Dd = m.defend;
          if (Dd.sent) statusBar(ctx, g, st, t("dev.battle.wait"), "muted");
          else {
            statusBar(ctx, g, null, null);
            g.text(4, 146, "{A}");
            g.text(14, 146, t("dev.battle.hintBlock"), {w: 30});
            const loc = chainLocate(Dd, now);
            g.text(110, 146, Math.min(loc.i + 1, Dd.hits) + "/" + Dd.hits, {align: "r", w: 24});
          }
          break;
        }
        case "picking":
          g.text(4, 104, t(((st.waiting >> rv) & 1) ? "dev.battle.rivalPicking" : "dev.battle.waitRival"), {c: "muted", w: 120});
          statusBar(ctx, g, st, t("dev.battle.wait"), "muted");
          break;
        case "wait":
          statusBar(ctx, g, st, t("dev.battle.wait"), "muted");
          break;
        default:
          drawRows(g, eventRows(ctx, m, st));
          statusBar(ctx, g, st, t("dev.battle.wait"), "muted");
      }
    },
  });

  /* ================= 6. results, bot, registration ================= */

  const hasKey = k => { try { return I18N.t(k) !== k; } catch { return false; } };
  function results(ctx) {
    const st = ctx.state, m = ctx.m || {};
    const me = ctx.p, rv = 1 - me;
    if (!st) return {titleKey: "dev.res.defeat", titleColor: "muted", scoreText: "", rows: [], again: {labelKey: "dev.ui.again", kind: "rematch"}};
    const quit = !!(st.flags & FLAG_QUIT);
    const quitter = quit ? 1 - st.winner : null;
    const won = st.winner === me;
    let titleKey = won ? "dev.res.victory" : "dev.res.defeat";
    if (quit && quitter === me && hasKey("dev.res.youQuit")) titleKey = "dev.res.youQuit";
    else if (quit && quitter === rv && hasKey("dev.res.rivalQuit")) titleKey = "dev.res.rivalQuit";
    const L = ctx.lobby;
    const wins = L ? [L.wins[me * 3], L.wins[rv * 3]] : [0, 0];
    // v6: the lobby's mode_res (filled at GAME_OVER, so its step is not older
    // than this state's); T0 fallback: what this board counted itself
    const res = L && L.step >= st.step ? L.modeRes : null;
    const fmt = (v, ok) => ok ? String(v) : "--";
    const best = p => Math.max(res ? res[p] : 0, m.best ? m.best[p] : 0);
    const perf = p => Math.max(res ? res[2 + p] : 0, m.perfects ? m.perfects[p] : 0);
    const haveBest = p => !!res || (m.seenTrial && m.seenTrial[p]);
    const alive = p => st.players[p].hp.filter(h => h > 0).length;
    return {
      titleKey, titleColor: won ? "gold" : "muted",
      scoreText: wins[0] + ":" + wins[1],
      drawArt(g, c2, x, y) {
        const pl = st.players[me], now = c2.now();
        for (let i = 0; i < 3; i++) {
          // the 2x title ends at y 41 and the avatars start at y 64: hop down 1 px, never into the title
          const hop = pl.hp[i] > 0 && Math.floor(now / 250 + i) % 2 === 0 ? 1 : 0;
          g.sprite(D.PETS[i].sprite, x + 22 + i * 28, y + hop, {scale: 2, color: pl.hp[i] > 0 ? null : "line"});
        }
      },
      rows: [
        {labelKey: "dev.battle.res.petsLeft", you: String(alive(me)), other: String(alive(rv))},
        {labelKey: "dev.battle.res.bestTrial", you: fmt(best(me), haveBest(me)), other: fmt(best(rv), haveBest(rv))},
        {labelKey: "dev.battle.res.perfect", you: fmt(perf(me), true), other: fmt(perf(rv), true)},
        {labelKey: "dev.battle.res.rounds", shared: String(st.round)},
      ],
      again: {labelKey: "dev.ui.again", kind: "rematch"},
      stats: {battleWins: won ? 1 : 0},
      win: quit && quitter === me ? null : won,
    };
  }

  // Bot: plays only from what this board can see (§8.3)
  function bot(ctx, ctl) {
    const st = ctx.state, m = ctx.m;
    if (!st || !m) return;
    const rng = ctl.rng || ctx.rng;
    const now = ctx.now(), me = ctx.p;
    const b = m.bot || (m.bot = {step: -1, next: 0, plan: null, aHeld: false, aim: 0, aimAt: 0, targets: null, pressed: []});
    const holdA = v => { if (b.aHeld !== v) { b.aHeld = v; ctl.hold("A", v); } };
    if (b.step !== st.step) {
      b.step = st.step; b.next = now + 450 + rng.int(600); b.plan = null; b.targets = null; b.pressed = [];
      b.sloppy = [6, 22, 45][rng.int(3)];   // how well it tracks the band this turn
    }
    if (ctx.screenId === "battle.pick") {
      holdA(false);
      if (!((st.waiting >> me) & 1) || (m.picked && m.picked.step === st.step) || now < b.next) return;
      const pl = st.players[me];
      if (b.plan == null) {
        const alive = [0, 1, 2].filter(k => pl.hp[k] > 0);
        // counter-pick a visible rival pet half of the time
        const rp = st.players[1 - me].active;
        const counter = rp < TEAM_SIZE ? ELEMENTS.findIndex(e => BEATS[e] === ELEMENTS[rp]) : -1;
        b.plan = counter >= 0 && pl.hp[counter] > 0 && rng.int(2) ? counter : alive[rng.int(alive.length)];
      }
      if (ctx.s.sel !== b.plan) { ctl.press("RIGHT"); b.next = now + 160; }
      else { ctl.press("A"); b.next = now + 1500; }
      return;
    }
    if (ctx.screenId !== "battle.hud") return;
    // chained blocks: aim at the zone with an error, sometimes no press at all
    if (m.defend && !m.defend.sent) {
      holdA(false);
      const Dd = m.defend;
      if (!b.targets) b.targets = Dd.zones.map(z => rng.int(10) === 0 ? 999 : z + Math.round(Dd.width / 2 + (rng.float() * 2 - 1) * Dd.width * 0.8));
      const loc = chainLocate(Dd, now);
      if (loc.i < Dd.hits && !loc.gap && !Dd.done[loc.i] && !b.pressed[loc.i] && sweepCursor(Dd, loc.i, loc.t) >= b.targets[loc.i]) {
        b.pressed[loc.i] = true;
        ctl.press("A", 30);
      }
      return;
    }
    // Tide and Sprout play the attack-trial.md §2C models (PetTrials.MODELS), a
    // first-time or a skilled player, picked per trial
    if (m.trial && m.trial.kind !== "band") {
      const tr = m.trial;
      holdA(false);
      if (b.trial !== tr) {
        b.trial = tr;
        b.skill = rng.int(2) ? "good" : "first";
        const model = PT.MODELS[tr.kind][b.skill];
        if (tr.kind === "beat") { b.presses = PT.beatPresses(tr.B, model, rng); b.pi = 0; }
        else {
          b.tracker = PT.tracker(model, rng, e => D.trial.bandCenter(tr.T.seed, e, tr.T.cfg), tr.levelM / 1000);
          b.jitter = 0; b.jitterAt = -1e9;
        }
      }
      if (tr.kind === "beat") {
        // one press per planned time (§2C: late on average, forgotten notes, some on rests, a stray one)
        while (b.pi < b.presses.length && now - tr.start >= b.presses[b.pi]) { ctl.press("A", 25); b.pi++; }
      } else {
        const model = PT.MODELS.tilt[b.skill], pos = b.tracker.hand(now - tr.T.start);
        if (now - b.jitterAt >= 20) { b.jitterAt = now; b.jitter = PT.normal(rng, 0, model.jitterMg); }
        ctl.tilt(PT.tilt.mgFor(pos, m.P.tiltFullMg) + b.jitter);
        b.tilted = true;
      }
      return;
    }
    if (b.tilted && !m.trial) { b.tilted = false; ctl.tilt(0); }    // put the handheld down level again
    // attack trial: hold A while the pointer is under the band (bang-bang), with a drifting aim error
    if (m.trial) {
      const T = m.trial.T;
      if (now - b.aimAt > 300) { b.aimAt = now; b.aim = rng.int(2 * b.sloppy + 1) - b.sloppy; }
      holdA(T.level < T.center + b.aim);
      return;
    }
    holdA(false);
    if (m.switching && myMove(ctx, m)) { if (now >= b.next) { ctl.press("A"); b.next = now + 800; } return; }
    if (!canStartTrial(ctx, m) || now < b.next) return;
    const pl = st.players[me];
    if (b.plan == null) {
      const rp = st.players[1 - me].active;
      const bad = pl.active < TEAM_SIZE && rp < TEAM_SIZE && m.R.petTypePct(pl.active, rp) < 100;
      const r = rng.int(100);
      b.plan = bad && switchTargets(st, me).length && r < 40 ? "switch" : pl.cooldown === 0 && r < 60 ? "skill" : "attack";
    }
    if (b.plan === "attack") { holdA(true); b.next = now + 400; }
    else if (b.plan === "skill") { ctl.press(rng.int(2) ? "SKILL" : "B"); b.next = now + 800; }
    else { ctl.press("MENU", 60); b.plan = "attack"; b.next = now + 500; }
  }

  D.registerMode({
    id: "battle", modeId: 0, order: 0, titleKey: "dev.menu.battle", subKey: "dev.menu.battleSub", subVars: () => ({}),
    icon: "ui.mode.battle", coop: false, status: "firmware", needsStick: false, stateMsg: "battle.state",
    params: [{key: "attackerFlag", c: "EXP_ATTACKER_TRIAL", labelKey: "dev.battle.p.attackerFlag", min: 0, max: 1, step: 1, def: 0, unit: ""}],
    rules: RULES,
    lobby: {badgeKey: "dev.lobby.battleBadge", badgeVars: () => ({}), goals: ["dev.battle.goal1", "dev.battle.goal2"],
      keys: [["A", "dev.battle.k1n", "dev.battle.k1"], ["S", "dev.battle.k2n", "dev.battle.k2"],
        ["M", "dev.battle.k3n", "dev.battle.k3"], ["A", "dev.battle.k4n", "dev.battle.k4"]]},
    central: {periodMs: C.STATE_PERIOD_MS, create: createCentral},
    // today's leaderboard (§9.2): top trial score 0..100, ties on perfect blocks (value = score << 8 | perfects)
    rank: [{variant: 0, titleKey: "dev.rank.battle", subKey: "dev.rank.battleSub", ruleKey: "dev.rank.tieBattle", better: "high",
      valid: v => (v >> 8) >= 1 && (v >> 8) <= 100, format: D.rankFmt.score}],
    player,
    bot,
  });
})();
