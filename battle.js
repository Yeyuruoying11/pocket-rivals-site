// Pocket Rivals battle prototype: teams of 3, secret send-out, attack trial
// (one per pet: Ember tracks the moving band, Tide tilts the handheld, Sprout
// taps on the beat; the trial code is pet-trials.js, shared with the handheld
// simulator), chained blocks, skills, type matchups. Follows
// pocket-rivals/docs/attack-trial.md and the firmware rules in software/lib
// (integer math and rounding included) so numbers tuned here behave the same
// after they go into game_config.h.

(() => {
  const $ = s => document.querySelector(s);
  // app.js sets window.PR; don't let a failure there stop this module
  const store = (window.PR && window.PR.store) || {get: () => null, set: () => {}};

  /* ---------------- strings (wording follows the glossary in i18n.js) ---------------- */

  // Values passed in are already HTML-escaped where the result goes into
  // innerHTML; the strings themselves are ours
  I18N.add({
    zh: {
      // index.html, battle section
      "battle.title": "战斗玩法原型",
      "battle.titleSub": "两人同屏对战，边玩边调参数；规则与固件一致（docs/attack-trial.md）",
      "battle.trialLbl": "攻击测试",
      "battle.blockLbl": "连续格挡",
      "battle.restart": "重新开始",
      "battle.round": "回合",
      "battle.rulesTitle": "规则",
      "battle.rule1": "每人 3 只宠物，开局暗中选出场：<b style=\"color:var(--fire)\">火</b> 克 <b style=\"color:var(--grass)\">草</b> 克 <b style=\"color:var(--water)\">水</b> 克 <b style=\"color:var(--fire)\">火</b>。",
      "battle.rule2": "<b>攻击测试</b>，每只宠物一种：焰灵按住攻击键让指针跟住光带；潮影用攻击 / 防御键（或 ← / →）左右转动掌机，让水珠留在浪尖上；叶芽跟着拍子，音符到线时按攻击键，灰点是空拍别按。",
      "battle.rule3": "共 3 层，一层比一层快；得分决定<b>普通</b> / <b>强力</b> / <b>全力一击</b>。",
      "battle.rule4": "<b>防守</b>：光标进入绿区时按格挡，连挡 1–3 次。",
      "battle.rule5": "也可以不攻击，改用<b>技能</b>或<b>换宠物</b>。",
      "battle.rule6": "宠物倒下就派下一只，3 只全倒下就输了。",
      "battle.paramsTitle": "参数调节",
      "battle.paramsSub": "名字和默认值与 game_config.h 相同，复制后可以直接替换整个文件",
      "battle.copyC": "复制 C 代码",
      "battle.resetParams": "恢复默认",

      // Sliders: group titles, labels (by param key), units
      "battle.group.trial": "攻击测试",
      "battle.group.tier": "等级",
      "battle.group.block": "连续格挡",
      "battle.group.skill": "技能",
      "battle.group.type": "属性",
      "battle.group.pace": "节奏",
      "battle.group.pet": "宠物测试（潮影倾斜 / 叶芽节拍）",
      "battle.param.tideBandPct": "潮影：光带宽度（倾斜时）",
      "battle.param.tiltFullMg": "潮影：转到头的重力分量",
      "battle.param.tiltSmoothPct": "潮影：每个样本指针跟上",
      "battle.param.beatStage1Ms": "叶芽：第 1 层拍子间隔",
      "battle.param.beatStage2Ms": "叶芽：第 2 层拍子间隔",
      "battle.param.beatStage3Ms": "叶芽：第 3 层拍子间隔",
      "battle.param.beatRests": "叶芽：空拍（1 = 第 2、3 层各一个）",
      "battle.param.beatPerfectMs": "叶芽：完美判定窗（±）",
      "battle.param.beatGoodMs": "叶芽：不错判定窗（±）",
      "battle.param.beatGoodPts": "叶芽：不错的得分",
      "battle.param.beatStrayPts": "叶芽：每次多按扣分",
      "battle.param.beatLanePxPerS": "叶芽：音符速度（只影响画面）",
      "battle.check.goodWindow": "不错判定窗要小于最短拍子间隔的一半",
      "battle.check.perfectWindow": "完美判定窗不能比不错判定窗宽",
      "battle.check.rests": "有空拍时第 2、3 层至少要 2 拍",
      "battle.check.notes": "每层至少要 1 拍",
      "battle.check.lastNote": "最后一个音符的判定窗 + 100 ms 要在测试结束前",
      "battle.check.ready": "准备时间要比不错判定窗长",
      "battle.param.base": "基础伤害（测试 0 分）",
      "battle.param.windowPct": "判定区宽度（普通一击）",
      "battle.param.sweepMs": "扫过时间（普通一击）",
      "battle.param.hp": "每只宠物 HP（下一局生效）",
      "battle.param.skillCd": "技能冷却（自己的回合数）",
      "battle.param.burnDmg": "Ember 灼烧每回合伤害",
      "battle.param.burnTurns": "灼烧持续回合",
      "battle.param.emberDmg": "Ember 技能直接伤害",
      "battle.param.tideHeal": "Tide 回复量",
      "battle.param.drain": "Sprout 汲取（伤害 = 回复）",
      "battle.param.perfectPct": "完美格挡后承受伤害",
      "battle.param.goodPct": "普通格挡后承受伤害",
      "battle.param.shieldPct": "护盾后承受伤害",
      "battle.param.strongPct": "属性克制伤害（效果拔群）",
      "battle.param.weakPct": "被克制伤害（效果一般）",
      "battle.param.trialBonus": "测试满分额外伤害",
      "battle.param.maxDmg": "一次攻击伤害上限（属性克制之后）",
      "battle.param.stageMs": "每层计分时长（共 3 层）",
      "battle.param.speed1": "第 1 层光带速度（含准备）",
      "battle.param.speed2": "第 2 层光带速度",
      "battle.param.speed3": "第 3 层光带速度",
      "battle.param.readyMs": "准备时间（光带先动，不计分）",
      "battle.param.bandPct": "光带宽度",
      "battle.param.risePerS": "按住时指针每秒上升",
      "battle.param.fallPerS": "松开时指针每秒下降",
      "battle.param.tierStrong": "强力一击所需分数（2 次格挡）",
      "battle.param.tierUlt": "全力一击所需分数（3 次格挡）",
      "battle.param.narrowPct": "每升一级判定区变窄",
      "battle.param.speedupPct": "每升一级 / 每多一击扫描变快",
      "battle.param.gapMs": "两次格挡之间的间隔",
      "battle.param.resolveMs": "每个事件停留时间",
      "battle.unit.score": " 分",
      "battle.toast.reset": "已恢复默认参数",

      // Pets, players, results, tiers
      "battle.pet.fire": "焰灵 Ember",
      "battle.pet.water": "潮影 Tide",
      "battle.pet.grass": "叶芽 Sprout",
      "battle.skill.fire": "灼烧",
      "battle.skill.water": "潮汐护盾",
      "battle.skill.grass": "汲取",
      "battle.player": "玩家 {n}",
      "battle.result.miss": "没挡住",
      "battle.result.good": "挡住",
      "battle.result.perfect": "完美",
      "battle.tier.0": "普通一击",
      "battle.tier.1": "强力一击",
      "battle.tier.2": "全力一击",
      "battle.eff.strong": "效果拔群！",
      "battle.eff.weak": "效果一般…",
      "battle.edge": "{a} 克制 {b}",
      "battle.blocked": "挡住 {b}/{h}",
      "battle.cap": "（上限）",

      // Log lines and events (the box over the gauges while an event resolves)
      "battle.log.newMatch": "新的一局，{p} 先手",
      "battle.log.burn": "{pet} 受到 <b>{n}</b> 点灼烧伤害",
      "battle.ev.burn": "🔥 {pet} -{n}",
      "battle.log.faint": "💫 {p} 的 {pet} 倒下了",
      "battle.ev.faint": "💫 {pet} 倒下了",
      "battle.log.win": "🏆 {p} 获胜！",
      "battle.log.picked": "{p} 已选好",
      "battle.log.sendout": "{p} 派出 {pet}",
      "battle.ev.sendout": "{p} 派出 <b>{pet}</b>",
      "battle.ev.vs": "<b>{a}</b> 对战 <b>{b}</b>",
      "battle.log.trial": "{pet} 得分 <b>{score}</b>（{stages}）→ {tier}，伤害 <b>{dmg}</b>{cap}{eff}",
      "battle.log.defense": "{pet} 挡住 {b}/{h}，受到 <b>{n}</b> 点伤害{shield}{eff}",
      "battle.log.shielded": "（护盾）",
      "battle.ev.defense": "挡住 {b}/{h} · {pet} -{n}",
      "battle.ev.shielded": "（护盾）",
      "battle.log.skillFire": "{pet} 使用「{skill}」：{target} -<b>{n}</b>，开始灼烧{eff}",
      "battle.ev.skillFire": "「{skill}」{target} -{n}{eff}",
      "battle.log.skillWater": "{pet} 使用「{skill}」：+{n} HP，加护盾",
      "battle.ev.skillWater": "「{skill}」+{n} HP 🛡",
      "battle.log.skillGrass": "{pet} 使用「{skill}」：{target} -<b>{n}</b>，自己 +{h} HP{eff}",
      "battle.ev.skillGrass": "「{skill}」{target} -{n}，+{h} HP{eff}",
      "battle.log.switch": "🔄 {p}：{old} → {pet}",
      "battle.ev.switch": "🔄 {p} 换上 <b>{pet}</b>",

      // Gauges
      "battle.trial.total": "总分 {n}",
      "battle.trial.ready": "准备 {s} s",
      "battle.trial.inBand": "光带内 {n}%",
      "battle.trial.pressStart": "按攻击键开始",
      "battle.trial.beatLive": "这一层 {n}",
      "battle.trial.kind.band": "焰灵：跟住光带",
      "battle.trial.kind.tilt": "潮影：水珠留在浪尖",
      "battle.trial.kind.beat": "叶芽：跟着拍子按",
      "battle.sound.on": "拍子声：开",
      "battle.sound.off": "拍子声：关",
      "battle.cue.start": "开始计分！",
      "battle.cue.faster": "加速！",
      "battle.stage.ready": "准备",
      "battle.stage.n": "第 {n} 层",
      "battle.seg": "第{n}层",
      "battle.tier.info": "{score} 分 · 伤害 {dmg}{cap} · 格挡 ×{n}",
      "battle.def.next": "下一击 {n}/{h}…",
      "battle.def.hit": "第 {n}/{h} 击",

      // Fighter cards and pad buttons
      "battle.role.win": "🏆 胜利",
      "battle.role.allOut": "全部倒下",
      "battle.role.picking": "选宠物…",
      "battle.picked": "✓ 已选好",
      "battle.role.waitOther": "等对方…",
      "battle.role.switching": "换上哪只？",
      "battle.role.att": "进攻方",
      "battle.role.def": "防守方",
      "battle.hpLeft": "剩余 {n} / {total} 只",
      "battle.badge.burn": "🔥 灼烧 ×{n}",
      "battle.badge.shield": "🛡 护盾",
      "battle.badge.cd": "技能冷却 {n}",
      "battle.badge.ready": "技能就绪",
      "battle.mini.fainted": "倒下",
      "battle.pad.attack": "攻击",
      "battle.pad.hold": "按住",
      "battle.pad.right": "右转",
      "battle.pad.left": "左转",
      "battle.pad.tap": "打拍",
      "battle.pad.block": "格挡",
      "battle.pad.skill": "技能",
      "battle.pad.switch": "换宠物",
      "battle.pad.cancel": "取消",
      "battle.pad.again": "再来一局",

      // Prompt: one short line per phase
      "battle.prompt.firstPick": "暗中选出场宠物 · {p} 先手",
      "battle.prompt.nextPick": "宠物倒下了，选下一只",
      "battle.prompt.ready": "{p}：{opts}",
      "battle.opt.attack": "{k} 攻击",
      "battle.opt.skill": "{k} {skill}",
      "battle.opt.switch": "{k} 换宠物",
      "battle.prompt.switch": "{p} 换上哪只？{keys} · {k} 取消",
      "battle.prompt.trial": "按住 {k} 跟住光带",
      "battle.prompt.tilt": "按住 {k}（右转）或 {k2}（左转），让水珠留在浪尖上",
      "battle.prompt.beat": "音符到线时按 {k}，灰点是空拍别按",
      "battle.prompt.defend": "按 {k} 格挡 ×{n}",
      "battle.prompt.over": "🏆 {p} 获胜！按 {k0} 或 {k1} 再来一局",
    },
    en: {
      "battle.title": "Battle prototype",
      "battle.titleSub": "Two players on one screen, tuning as they play; same rules as the firmware (docs/attack-trial.md)",
      "battle.trialLbl": "Attack trial",
      "battle.blockLbl": "Chained blocks",
      "battle.restart": "Restart",
      "battle.round": "Round",
      "battle.rulesTitle": "Rules",
      "battle.rule1": "3 pets each; secretly send one out. <b style=\"color:var(--fire)\">Fire</b> beats <b style=\"color:var(--grass)\">grass</b> beats <b style=\"color:var(--water)\">water</b> beats <b style=\"color:var(--fire)\">fire</b>.",
      "battle.rule2": "<b>Attack trial</b>, one per pet: Ember holds the attack key to keep the pointer in the band; Tide turns the handheld with the attack / block keys (or ← / →) to keep the drop on the crest; Sprout taps the attack key as each note reaches the line, skipping the grey rests.",
      "battle.rule3": "3 ever-faster stages; the score gives a <b>Normal</b>, <b>Strong</b> or <b>Full Power</b> strike.",
      "battle.rule4": "<b>Defend</b>: press block while the cursor is in the green, 1–3 times.",
      "battle.rule5": "Instead of attacking, use a <b>skill</b> or <b>switch</b> pets.",
      "battle.rule6": "When a pet faints, send out the next; if all 3 faint, you lose.",
      "battle.paramsTitle": "Tuning",
      "battle.paramsSub": "Same names and defaults as game_config.h; the copied code can replace the whole file",
      "battle.copyC": "Copy C code",
      "battle.resetParams": "Reset defaults",

      "battle.group.trial": "Attack trial",
      "battle.group.tier": "Tiers",
      "battle.group.block": "Chained blocks",
      "battle.group.skill": "Skills",
      "battle.group.type": "Types",
      "battle.group.pace": "Pace",
      "battle.group.pet": "Pet trials (Tide tilt / Sprout beat)",
      "battle.param.tideBandPct": "Tide: band width when tilting",
      "battle.param.tiltFullMg": "Tide: tilt reading for a full turn",
      "battle.param.tiltSmoothPct": "Tide: pointer catch-up per sample",
      "battle.param.beatStage1Ms": "Sprout: stage 1 beat interval",
      "battle.param.beatStage2Ms": "Sprout: stage 2 beat interval",
      "battle.param.beatStage3Ms": "Sprout: stage 3 beat interval",
      "battle.param.beatRests": "Sprout: rests (1 = one in stages 2 and 3)",
      "battle.param.beatPerfectMs": "Sprout: perfect window (±)",
      "battle.param.beatGoodMs": "Sprout: good window (±)",
      "battle.param.beatGoodPts": "Sprout: points for a good tap",
      "battle.param.beatStrayPts": "Sprout: cost of each stray tap",
      "battle.param.beatLanePxPerS": "Sprout: note speed (screen only)",
      "battle.check.goodWindow": "The good window must be under half the shortest beat interval",
      "battle.check.perfectWindow": "The perfect window cannot be wider than the good window",
      "battle.check.rests": "With rests, stages 2 and 3 need at least 2 beats",
      "battle.check.notes": "Every stage needs at least 1 beat",
      "battle.check.lastNote": "The last note's window + 100 ms must end before the trial does",
      "battle.check.ready": "The ready phase must be longer than the good window",
      "battle.param.base": "Base damage (trial score 0)",
      "battle.param.windowPct": "Block zone width (Normal strike)",
      "battle.param.sweepMs": "Sweep time (Normal strike)",
      "battle.param.hp": "HP per pet (from the next match)",
      "battle.param.skillCd": "Skill cooldown (own turns)",
      "battle.param.burnDmg": "Ember Burn damage per turn",
      "battle.param.burnTurns": "Burn duration (turns)",
      "battle.param.emberDmg": "Ember skill direct damage",
      "battle.param.tideHeal": "Tide heal amount",
      "battle.param.drain": "Sprout Drain (damage = heal)",
      "battle.param.perfectPct": "Damage taken after a Perfect block",
      "battle.param.goodPct": "Damage taken after a normal block",
      "battle.param.shieldPct": "Damage taken with a shield",
      "battle.param.strongPct": "Damage with type advantage (super effective)",
      "battle.param.weakPct": "Damage with type disadvantage (not very effective)",
      "battle.param.trialBonus": "Extra damage at trial score 100",
      "battle.param.maxDmg": "Max damage per attack (after the type bonus)",
      "battle.param.stageMs": "Scored time per stage (3 stages)",
      "battle.param.speed1": "Stage 1 band speed (also while getting ready)",
      "battle.param.speed2": "Stage 2 band speed",
      "battle.param.speed3": "Stage 3 band speed",
      "battle.param.readyMs": "Get-ready time (band moves, not scored)",
      "battle.param.bandPct": "Band width",
      "battle.param.risePerS": "Pointer rise per second while held",
      "battle.param.fallPerS": "Pointer fall per second when released",
      "battle.param.tierStrong": "Score for a Strong strike (2 blocks)",
      "battle.param.tierUlt": "Score for a Full Power strike (3 blocks)",
      "battle.param.narrowPct": "Block zone narrower per tier",
      "battle.param.speedupPct": "Sweep faster per tier / per extra block",
      "battle.param.gapMs": "Pause between two blocks",
      "battle.param.resolveMs": "Time each event stays on screen",
      "battle.unit.score": " pts",
      "battle.toast.reset": "Default settings restored",

      "battle.pet.fire": "Ember",
      "battle.pet.water": "Tide",
      "battle.pet.grass": "Sprout",
      "battle.skill.fire": "Burn",
      "battle.skill.water": "Tide Shield",
      "battle.skill.grass": "Drain",
      "battle.player": "Player {n}",
      "battle.result.miss": "Missed",
      "battle.result.good": "Blocked",
      "battle.result.perfect": "Perfect",
      "battle.tier.0": "Normal strike",
      "battle.tier.1": "Strong strike",
      "battle.tier.2": "Full Power strike",
      "battle.eff.strong": "Super effective!",
      "battle.eff.weak": "Not very effective…",
      "battle.edge": "{a} beats {b}",
      "battle.blocked": "Blocked {b}/{h}",
      "battle.cap": " (max)",

      "battle.log.newMatch": "New match, {p} goes first",
      "battle.log.burn": "{pet} takes <b>{n}</b> Burn damage",
      "battle.ev.burn": "🔥 {pet} -{n}",
      "battle.log.faint": "💫 {p}'s {pet} fainted",
      "battle.ev.faint": "💫 {pet} fainted",
      "battle.log.win": "🏆 {p} wins!",
      "battle.log.picked": "{p} has picked",
      "battle.log.sendout": "{p} sends out {pet}",
      "battle.ev.sendout": "{p} sends out <b>{pet}</b>",
      "battle.ev.vs": "<b>{a}</b> vs <b>{b}</b>",
      "battle.log.trial": "{pet} scores <b>{score}</b> ({stages}) → {tier}, <b>{dmg}</b> damage{cap}{eff}",
      "battle.log.defense": "{pet} blocks {b}/{h}, takes <b>{n}</b> damage{shield}{eff}",
      "battle.log.shielded": " (shield)",
      "battle.ev.defense": "Blocked {b}/{h} · {pet} -{n}",
      "battle.ev.shielded": "(shield)",
      "battle.log.skillFire": "{pet} uses {skill}: {target} -<b>{n}</b> and is burning{eff}",
      "battle.ev.skillFire": "{skill}: {target} -{n}{eff}",
      "battle.log.skillWater": "{pet} uses {skill}: +{n} HP and a shield",
      "battle.ev.skillWater": "{skill}: +{n} HP 🛡",
      "battle.log.skillGrass": "{pet} uses {skill}: {target} -<b>{n}</b>, {pet} +{h} HP{eff}",
      "battle.ev.skillGrass": "{skill}: {target} -{n}, +{h} HP{eff}",
      "battle.log.switch": "🔄 {p}: {old} → {pet}",
      "battle.ev.switch": "🔄 {p} switches to <b>{pet}</b>",

      "battle.trial.total": "Score {n}",
      "battle.trial.ready": "Get ready {s} s",
      "battle.trial.inBand": "In band {n}%",
      "battle.trial.pressStart": "Press attack",
      "battle.trial.beatLive": "This stage {n}",
      "battle.trial.kind.band": "Ember: follow the band",
      "battle.trial.kind.tilt": "Tide: drop on the crest",
      "battle.trial.kind.beat": "Sprout: tap on the beat",
      "battle.sound.on": "Beat sound: on",
      "battle.sound.off": "Beat sound: off",
      "battle.cue.start": "Go!",
      "battle.cue.faster": "Faster!",
      "battle.stage.ready": "Get ready",
      "battle.stage.n": "Stage {n}",
      "battle.seg": "Stage {n}",
      "battle.tier.info": "Score {score} · {dmg} damage{cap} · block ×{n}",
      "battle.def.next": "Next block {n}/{h}…",
      "battle.def.hit": "Block {n}/{h}",

      "battle.role.win": "🏆 Winner",
      "battle.role.allOut": "All fainted",
      "battle.role.picking": "Picking…",
      "battle.picked": "✓ Picked",
      "battle.role.waitOther": "Waiting…",
      "battle.role.switching": "Who comes in?",
      "battle.role.att": "Attacker",
      "battle.role.def": "Defender",
      "battle.hpLeft": "{n} / {total} left",
      "battle.badge.burn": "🔥 Burn ×{n}",
      "battle.badge.shield": "🛡 Shield",
      "battle.badge.cd": "Skill cooldown {n}",
      "battle.badge.ready": "Skill ready",
      "battle.mini.fainted": "Fainted",
      "battle.pad.attack": "Attack",
      "battle.pad.hold": "Hold",
      "battle.pad.right": "Right",
      "battle.pad.left": "Left",
      "battle.pad.tap": "Tap",
      "battle.pad.block": "Block",
      "battle.pad.skill": "Skill",
      "battle.pad.switch": "Switch",
      "battle.pad.cancel": "Cancel",
      "battle.pad.again": "Again",

      "battle.prompt.firstPick": "Pick a pet in secret · {p} goes first",
      "battle.prompt.nextPick": "A pet fainted: pick the next one",
      "battle.prompt.ready": "{p}: {opts}",
      "battle.opt.attack": "{k} attack",
      "battle.opt.skill": "{k} {skill}",
      "battle.opt.switch": "{k} switch",
      "battle.prompt.switch": "{p}: who comes in? {keys} · {k} cancel",
      "battle.prompt.trial": "Hold {k} to follow the band",
      "battle.prompt.tilt": "Hold {k} (turn right) or {k2} (turn left): keep the drop on the crest",
      "battle.prompt.beat": "Tap {k} as each note reaches the line; skip the grey rests",
      "battle.prompt.defend": "Press {k} to block ×{n}",
      "battle.prompt.over": "🏆 {p} wins! Press {k0} or {k1} for a rematch",
    },
  });
  const tr = I18N.t;

  // Same names, defaults, order and comments as software/lib/game_config.h, so
  // the exported block can replace that file. Entries without min/max are
  // exported but not tuned here. g is the slider group; the slider label is
  // the string "battle.param.<key>".
  const PTS = tr("battle.unit.score");
  const PT = window.PetTrials, PTD = PT.DEFAULTS;
  const PARAMS = [
    {key: "base",       c: "BASE_DAMAGE",        g: "trial", min: 4,   max: 20,   step: 1,   def: 10,   unit: "",    note: "attack damage at trial score 0"},
    {key: "windowPct",  c: "DEFEND_WINDOW_PCT",  g: "block", min: 8,   max: 50,   step: 1,   def: 24,   unit: "%",   note: "width of the block zone at tier 0, % of the sweep"},
    {key: "sweepMs",    c: "DEFEND_SWEEP_MS",    g: "block", min: 500, max: 2500, step: 100, def: 1100, unit: " ms", note: "time for the cursor to cross the bar at tier 0"},
    {key: "hp",         c: "START_HP",           g: "pace",  min: 20,  max: 200,  step: 5,   def: 60,   unit: "",    note: "HP of each pet (TEAM_SIZE pets per player)"},
    {key: "skillCd",    c: "SKILL_COOLDOWN",     g: "skill", min: 1,   max: 5,    step: 1,   def: 3,    unit: "",    note: "own turns before the skill is ready again"},
    {key: "burnDmg",    c: "BURN_DAMAGE",        g: "skill", min: 0,   max: 15,   step: 1,   def: 5,    unit: "",    note: "Ember skill: damage per turn while burning", before: [""]},
    {key: "burnTurns",  c: "BURN_TURNS",         g: "skill", min: 0,   max: 5,    step: 1,   def: 2,    unit: ""},
    {key: "emberDmg",   c: "EMBER_SKILL_DAMAGE", g: "skill", min: 0,   max: 25,   step: 1,   def: 8,    unit: ""},
    {key: "tideHeal",   c: "TIDE_HEAL",          g: "skill", min: 0,   max: 40,   step: 1,   def: 12,   unit: "",    note: "Tide skill: heal and shield the next hit"},
    {key: "drain",      c: "SPROUT_DRAIN",       g: "skill", min: 0,   max: 25,   step: 1,   def: 6,    unit: "",    note: "Sprout skill: deal this much, heal as much"},
    {key: "perfectPct", c: "BLOCK_PERFECT_PCT",  g: "block", min: 0,   max: 100,  step: 5,   def: 20,   unit: "%",   note: "damage taken on a perfect block", before: [""]},
    {key: "goodPct",    c: "BLOCK_GOOD_PCT",     g: "block", min: 0,   max: 100,  step: 5,   def: 50,   unit: "%"},
    {key: "shieldPct",  c: "SHIELD_PCT",         g: "skill", min: 0,   max: 100,  step: 5,   def: 50,   unit: "%"},
    {key: "strongPct",  c: "TYPE_STRONG_PCT",    g: "type",  min: 100, max: 250,  step: 10,  def: 150,  unit: "%",   note: "fire > grass > water > fire"},
    {key: "weakPct",    c: "TYPE_WEAK_PCT",      g: "type",  min: 30,  max: 100,  step: 5,   def: 70,   unit: "%"},
    // The new block uses a wider name column, like the file
    {key: "trialBonus", c: "TRIAL_BONUS",         w: 20, g: "trial", min: 0,   max: 40,   step: 1,   def: 20,   unit: "",    note: "extra damage at trial score 100", before: ["", "// Attack trial + chained blocks (docs/attack-trial.md)"]},
    {key: "maxDmg",     c: "ATTACK_MAX_DAMAGE",   w: 20, g: "trial", min: 10,  max: 60,   step: 1,   def: 30,   unit: "",    note: "cap on one attack after the type bonus (half a pet's HP)"},
    {key: "stageMs",    c: "TRIAL_STAGE_MS",      w: 20, g: "trial", min: 500, max: 3000, step: 100, def: 1500, unit: " ms", note: "scored time of each of the 3 stages"},
    {key: "speed1",     c: "TRIAL_STAGE1_SPEED_PCT", w: 20, g: "trial", min: 10, max: 200, step: 5,  def: 35,   unit: "%",   note: "band speed in the ready phase and stage 1, % of full"},
    {key: "speed2",     c: "TRIAL_STAGE2_SPEED_PCT", w: 20, g: "trial", min: 10, max: 200, step: 5,  def: 65,   unit: "%",   note: "band speed in stage 2"},
    {key: "speed3",     c: "TRIAL_STAGE3_SPEED_PCT", w: 20, g: "trial", min: 10, max: 200, step: 5,  def: 100,  unit: "%",   note: "band speed in stage 3"},
    {key: "readyMs",    c: "TRIAL_READY_MS",      w: 20, g: "trial", min: 0,   max: 1500, step: 100, def: 600,  unit: " ms", note: "band moves this long before scoring starts"},
    {key: "bandPct",    c: "TRIAL_BAND_PCT",      w: 20, g: "trial", min: 8,   max: 50,   step: 1,   def: 24,   unit: "",    note: "band width on the 0..100 level scale"},
    {key: "risePerS",   c: "TRIAL_RISE_PER_S",    w: 20, g: "trial", min: 40,  max: 400,  step: 10,  def: 140,  unit: "",    note: "no pressure pad: level rise per second holding A"},
    {key: "fallPerS",   c: "TRIAL_FALL_PER_S",    w: 20, g: "trial", min: 40,  max: 400,  step: 10,  def: 140,  unit: "",    note: "                 level fall per second released"},
    {key: "tierStrong", c: "TIER_STRONG_SCORE",   w: 20, g: "tier",  min: 10,  max: 95,   step: 5,   def: 50,   unit: PTS,   note: "score for a strong attack (2 blocks)"},
    {key: "tierUlt",    c: "TIER_ULTIMATE_SCORE", w: 20, g: "tier",  min: 15,  max: 100,  step: 5,   def: 80,   unit: PTS,   note: "score for a full-power attack (3 blocks)"},
    {key: "narrowPct",  c: "DEFEND_NARROW_PCT",   w: 20, g: "block", min: 0,   max: 30,   step: 5,   def: 20,   unit: "%",   note: "block zone narrower per tier, %"},
    {key: "speedupPct", c: "DEFEND_SPEEDUP_PCT",  w: 20, g: "block", min: 0,   max: 20,   step: 1,   def: 12,   unit: "%",   note: "sweep faster per tier and per extra block, %"},
    {key: "gapMs",      c: "DEFEND_GAP_MS",       w: 20, g: "block", min: 100, max: 1000, step: 50,  def: 350,  unit: " ms", note: "pause between chained blocks"},
    {key: "resolveMs",  c: "RESOLVE_MS",         g: "pace",  min: 300, max: 2000, step: 100, def: 900,  unit: " ms", note: "how long each event stays on screen", before: [""]},
    {key: "graceMs",    c: "DEFEND_GRACE_MS",                                                               def: 1500, note: "central treats a silent defender as missing",
      note2: ["every block after the whole chain (all", "sweeps + gaps) + this"]},
    // Per-pet attack trials (attack-trial.md §2A / §2B); defaults from pet-trials.js
    {key: "tideBandPct",   c: "TIDE_BAND_PCT",      w: 20, g: "pet", min: 10,  max: 60,   step: 1,   def: PTD.tideBandPct,   unit: "",      note: "Tide tilting: band width (tilting is slower than squeezing)",
      before: ["", "// Per-pet attack trials (docs/attack-trial.md 2A / 2B): Ember keeps the", "// band above; Tide tilts the handheld"]},
    {key: "tiltFullMg",    c: "TILT_FULL_MG",       w: 20, g: "pet", min: 200, max: 1000, step: 50,  def: PTD.tiltFullMg,    unit: " mg",   note: "x reading (mg) that puts the pointer at an end (~30 deg)"},
    {key: "tiltSmoothPct", c: "TILT_SMOOTH_PCT",    w: 20, g: "pet", min: 10,  max: 100,  step: 5,   def: PTD.tiltSmoothPct, unit: "%",     note: "per new sample the pointer moves this % toward the tilt"},
    {key: "tiltSampleMs",  c: "TILT_SAMPLE_MS",     w: 20,                                           def: PTD.tiltSampleMs,                 note: "accelerometer sample period (50 Hz); change with the driver"},
    {key: "tiltStaleMs",   c: "TILT_STALE_MS",      w: 20,                                           def: PTD.tiltStaleMs,                  note: "no sample this long: no tilt (at the start) / pointer holds"},
    {key: "beatStage1Ms",  c: "BEAT_STAGE1_MS",     w: 20, g: "pet", min: 250, max: 1000, step: 25,  def: PTD.beatStage1Ms,  unit: " ms",   note: "Sprout: stage 1 beat (120 BPM), also the count-in",
      before: ["// Sprout taps A on the beat of the on-board speaker"]},
    {key: "beatStage2Ms",  c: "BEAT_STAGE2_MS",     w: 20, g: "pet", min: 250, max: 1000, step: 25,  def: PTD.beatStage2Ms,  unit: " ms",   note: "stage 2 (160 BPM)"},
    {key: "beatStage3Ms",  c: "BEAT_STAGE3_MS",     w: 20, g: "pet", min: 200, max: 1000, step: 25,  def: PTD.beatStage3Ms,  unit: " ms",   note: "stage 3 (200 BPM)"},
    {key: "beatRests",     c: "BEAT_RESTS",         w: 20, g: "pet", min: 0,   max: 1,    step: 1,   def: PTD.beatRests,     unit: "",      note: "1 = one rest (seeded) in stages 2 and 3"},
    {key: "beatPerfectMs", c: "BEAT_PERFECT_MS",    w: 20, g: "pet", min: 5,   max: 100,  step: 5,   def: PTD.beatPerfectMs, unit: " ms",   note: "|tap - beat| up to this: perfect, 100 points"},
    {key: "beatGoodMs",    c: "BEAT_GOOD_MS",       w: 20, g: "pet", min: 20,  max: 200,  step: 5,   def: PTD.beatGoodMs,    unit: " ms",   note: "up to this: good (under half the shortest interval)"},
    {key: "beatGoodPts",   c: "BEAT_GOOD_PTS",      w: 20, g: "pet", min: 0,   max: 100,  step: 5,   def: PTD.beatGoodPts,   unit: "",      note: "points for a good tap"},
    {key: "beatStrayPts",  c: "BEAT_STRAY_PTS",     w: 20, g: "pet", min: 0,   max: 100,  step: 5,   def: PTD.beatStrayPts,  unit: "",      note: "each stray tap costs this (a missed note of the stage forgives one)"},
    {key: "beatLanePxPerS", c: "BEAT_LANE_PX_PER_S", w: 20, g: "pet", min: 40, max: 200,  step: 10,  def: PTD.beatLanePxPerS, unit: " px/s", note: "note speed on the TFT (picture only)"},
  ];
  const GROUPS = ["trial", "pet", "tier", "block", "skill", "type", "pace"];
  const TUNABLE = PARAMS.filter(p => p.min !== undefined);

  const TEAM_SIZE = 3;
  // name: shown on the fighter card; short: the English name, also used in Chinese
  const PETS = ["fire", "water", "grass"].map((el, k) => ({
    name: tr("battle.pet." + el), short: ["Ember", "Tide", "Sprout"][k], el, skill: tr("battle.skill." + el),
  }));
  const PLAYERS = [
    // keys: 蓄力 / 第 1 只，防御 / 第 2 只，技能 / 第 3 只，换宠物 / 取消
    {name: tr("battle.player", {n: 1}), keys: ["A", "S", "D", "F"]},
    {name: tr("battle.player", {n: 2}), keys: ["J", "K", "L", ";"]},
  ];
  const BEATS = {fire: "grass", grass: "water", water: "fire"};
  // block_result_t order in protocol.h
  const MISS = 0, GOOD = 1, PERFECT = 2;
  const RESULT_CLS = ["miss", "good", "perfect"];
  const RESULT_TXT = RESULT_CLS.map(c => tr("battle.result." + c));
  const TIER_NAMES = [0, 1, 2].map(k => tr("battle.tier." + k));
  const DEFEND_MAX_HITS = 3;
  // Sprites: 10x10 pixel art, each row is a 5-pixel left half mirrored to the right
  const SPRITES = {
    fire:  ["...o.", "..olo", ".olff", "olfff", "ofhef", "offff", "offfm", "olfff", ".olff", "..ooo"],
    water: ["....o", "...ol", "..olf", ".olff", ".ohef", "offff", "offfm", "oflll", ".offl", "..ooo"],
    grass: [".ol..", ".oll.", "..olo", "..ooo", ".offf", "ofhef", "offff", "offfm", ".olll", "..ooo"],
  };
  const PALETTE = {
    fire:  {o: "#5a2a1c", f: "#e8663d", l: "#f6b04a", e: "#1c1c1e", h: "#ffffff", m: "#5a2a1c"},
    water: {o: "#163a5a", f: "#2f8fd6", l: "#9fd6f4", e: "#1c1c1e", h: "#ffffff", m: "#163a5a"},
    grass: {o: "#1f4a1a", f: "#4a9e3a", l: "#a8dc72", e: "#1c1c1e", h: "#ffffff", m: "#1f4a1a"},
  };

  function spriteSvg(el, cls = "sprite") {
    const rows = SPRITES[el].map(h => h + [...h].reverse().join(""));
    let rects = "";
    rows.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== ".") rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${PALETTE[el][ch]}"/>`;
    }));
    return `<svg class="${cls}" viewBox="0 0 10 10" shape-rendering="crispEdges" aria-hidden="true">${rects}</svg>`;
  }

  /* ---------------- params ---------------- */

  // v4: TRIAL_MS replaced by the three trial stages, ATTACK_MAX_DAMAGE added
  const PARAM_KEY = "pr.params.v4";
  let P = {};
  try { P = JSON.parse(store.get(PARAM_KEY) || "{}") || {}; } catch { P = {}; }
  PARAMS.forEach(p => {
    const v = P[p.key];
    P[p.key] = typeof v === "number" && p.min !== undefined && v >= p.min && v <= p.max ? v : p.def;
  });

  function renderParams() {
    $("#params").innerHTML = GROUPS.map(g => `<div class="pgroup">${esc(tr("battle.group." + g))}</div>` +
      TUNABLE.filter(p => p.g === g).map(p => `<label>
        <span>${esc(tr("battle.param." + p.key))}<b id="pv-${p.key}">${P[p.key]}${p.unit}</b></span>
        <input type="range" min="${p.min}" max="${p.max}" step="${p.step}" value="${P[p.key]}" data-p="${p.key}">
        <code class="cname">${p.c}</code>
      </label>`).join("") + (g === "pet" ? `<p class="pcheck" id="param-check" role="status"></p>` : "")).join("");
    renderCSnippet();
  }

  // Reproduces game_config.h line for line (with defaults it matches the file exactly)
  function cConfig() {
    const pad = " ".repeat(8 + 19 + 6);  // continuation comment column
    const lines = [
      "// Pocket Rivals tuning knobs",
      "//",
      "// Names match the battle prototype on the progress site, which can export",
      "// its sliders as these #defines. TRIAL_* (except TRIAL_BONUS) and",
      "// DEFEND_GAP_MS are timed on the player boards; the central board applies",
      "// everything else and sends each attack's zones and sweep times in the state.",
      "// See docs/attack-trial.md.",
      "",
      "#pragma once",
      "",
    ];
    PARAMS.forEach(p => {
      if (p.before) lines.push(...p.before);
      // The comment starts in its usual column; a long name eats into the
      // value's padding but keeps at least one space before "//"
      const w = p.w || 18, head = `#define ${p.c.padEnd(w)} ${P[p.key]}`;
      lines.push(p.note ? `${head.padEnd(Math.max(8 + w + 7, head.length + 1))}// ${p.note}` : head);
      (p.note2 || []).forEach(n => lines.push(`${pad}// ${n}`));
    });
    return lines.join("\n") + "\n";
  }

  function renderCSnippet() {
    $("#param-c").textContent = cConfig();
    // attack-trial.md §2B timing rules: the beat sliders that break one turn red
    const bad = PT.beat.check(PT.beat.cfgFrom(P));
    const box = $("#param-check");
    if (box) box.textContent = bad.map(k => "⚠ " + tr("battle.check." + k)).join("  ");
    document.querySelectorAll("#params input[data-p^='beat']").forEach(i => i.closest("label").classList.toggle("bad", bad.length > 0));
  }

  $("#params").addEventListener("input", e => {
    const k = e.target.dataset.p;
    if (!k) return;
    const def = PARAMS.find(p => p.key === k);
    P[k] = +e.target.value;
    $("#pv-" + k).textContent = P[k] + def.unit;
    store.set(PARAM_KEY, JSON.stringify(P));
    renderCSnippet();
    if (S) render();
  });
  $("#copy-c").addEventListener("click", () => window.PR.copyText($("#param-c").textContent));
  $("#reset-params").addEventListener("click", () => {
    PARAMS.forEach(p => P[p.key] = p.def);
    store.set(PARAM_KEY, JSON.stringify(P));
    renderParams();
    if (S) render();
    window.PR.toast(tr("battle.toast.reset"));
  });

  /* ---------------- formulas (docs/attack-trial.md, rules.c) ---------------- */

  const rulesScale = (amount, pct) => Math.floor((amount * pct + 50) / 100);

  // §2: the trial timeline. Ready phase [0, R), stage k scored in
  // [R + k*S, R + (k+1)*S), done at R + 3*S
  const trialEnd = () => P.readyMs + 3 * P.stageMs;
  // Stage running at ms t: -1 while getting ready, then 0..2
  const stageAt = t => t < P.readyMs ? -1 : Math.min(Math.floor((t - P.readyMs) / P.stageMs), 2);

  // Band time τ * 100 for integer ms t (the distance travelled at the stage
  // speeds), all in integers like the firmware (pet-trials.js, shared with
  // the simulator)
  const tau100 = t => PT.band.tau100(t, PT.band.cfgFrom(P));

  // §2: band center from seed and ms since the trial started (ready part
  // included); same double math as trial_band_center() in trial.c, with
  // τ = τ100 / 100.0 in place of t. w = this trial's band width (Tide: tideBandPct)
  const bandCenter = (seed, t, w = P.bandPct) => PT.band.bandCenter(seed, t, PT.band.cfgFrom(P, w));
  // trial_in_band(): |level - center| <= w/2, in integers
  const inBand = (center, level, w = P.bandPct) => 2 * Math.abs(level - center) <= w;

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

  /* ---------------- rules (port of game.c) ---------------- */

  let S;
  let gameId = 0;
  const log = [];

  function addLog(html) {
    log.unshift(html);
    log.length = Math.min(log.length, 60);
    $("#log").innerHTML = log.map(l => `<li>${l}</li>`).join("");
  }

  const att = () => S.turn;
  const dfn = () => 1 - S.turn;
  const pl = i => S.pl[i];
  const activePet = i => PETS[pl(i).active];
  const pName = i => `<b>${esc(PLAYERS[i].name)}</b>`;
  const petName = i => esc(activePet(i).name);
  const anyAlive = i => pl(i).hp.some(h => h > 0);

  function typePct(a, d) {
    if (BEATS[a] === d) return P.strongPct;
    if (BEATS[d] === a) return P.weakPct;
    return 100;
  }
  const effectTxt = pct => pct > 100 ? tr("battle.eff.strong") : pct < 100 ? tr("battle.eff.weak") : "";
  const effectHtml = pct => pct === 100 ? "" :
    ` <span class="eff ${pct > 100 ? "strong" : "weak"}">${effectTxt(pct)}</span>`;
  const tierHtml = t => `<span class="tier-tag t${t}">${TIER_NAMES[t]}</span>`;
  const blocked = rs => rs.filter(r => r !== MISS).length;

  function enter(phase, waiting = []) {
    S.phase = phase;
    S.waiting = waiting;
    S.step++;
    S.switching = null;  // like player_core: any new step ends the switch choice
  }

  // Runs fn after ms unless the game has moved on in the meantime
  function after(ms, fn) {
    const id = gameId, step = S.step;
    setTimeout(() => { if (id === gameId && S.step === step) fn(); }, ms);
  }

  function showEvent(next, html) {
    S.next = next;
    S.event = html;
    enter("resolve");
    render();
    after(P.resolveMs, resolveDone);
  }

  function popup(i, text, kind, sub) {
    const f = $("#f" + i);
    const el = document.createElement("div");
    el.className = "pop" + (kind ? " " + kind : "");
    el.innerHTML = esc(text) + (sub ? `<small>${esc(sub)}</small>` : "");
    f.appendChild(el);
    setTimeout(() => el.remove(), 1100);
    if (kind !== "heal" && !kind?.startsWith("blk")) {
      f.classList.remove("hit");
      void f.offsetWidth;
      f.classList.add("hit");
    }
  }

  // Clamps to the target pet's HP; returns the damage actually dealt. The
  // popup's small line is the block count, or else the type effect
  function damage(i, amount, pct = 100, sub) {
    const p = pl(i);
    amount = Math.min(amount, p.hp[p.active]);
    p.hp[p.active] -= amount;
    popup(i, "-" + amount, "", sub || effectTxt(pct));
    return amount;
  }

  function heal(i, amount) {
    const p = pl(i);
    amount = Math.min(amount, P.hp - p.hp[p.active]);
    p.hp[p.active] += amount;
    return amount;
  }

  // Applies the shield (if any) to incoming damage and consumes it
  function shielded(i, amount) {
    if (!pl(i).shield) return amount;
    pl(i).shield = false;
    return rulesScale(amount, P.shieldPct);
  }

  function startMatch(first) {
    gameId++;
    const hp = P.hp;
    S = {
      pl: [0, 1].map(() => ({hp: Array(TEAM_SIZE).fill(hp), active: null, burn: 0, shield: false, cd: 0})),
      hpMax: hp, pending: [null, null], waiting: [], step: 0,
      turn: first, first, round: 1, phase: "", next: "begin", justUsed: false,
      trial: null,   // attack trial of the current turn (player board, local)
      atk: null,     // attack the defender faces: score, tier, damage, zones...
      winner: null, event: "",
      switching: null,  // attacker choosing a pet to switch to (local, like player_core)
    };
    log.length = 0;
    addLog(tr("battle.log.newMatch", {p: pName(first)}));
    enter("sendout", [0, 1]);
    render();
  }

  function beginTurn() {
    const a = att(), p = pl(a);
    if (p.burn > 0) {
      p.burn--;
      const n = damage(a, P.burnDmg);
      addLog(tr("battle.log.burn", {pet: petName(a), n}));
      showEvent("ready", tr("battle.ev.burn", {pet: petName(a), n}));
      return;
    }
    toReady();
  }

  function toReady() {
    S.atk = null;
    // The central board hands out a fresh band seed every TURN
    S.trial = {seed: Math.floor(Math.random() * 256), started: false};
    enter("ready", [att()]);
    render();
  }

  function endTurn() {
    // Cooldown counts the attacker's own turns after the one the skill was used in
    const p = pl(att());
    if (S.justUsed) S.justUsed = false;
    else if (p.cd > 0) p.cd--;
    S.turn = dfn();
    if (S.turn === S.first) S.round++;  // a round = one turn each, like game.c
    beginTurn();
  }

  // Called when an event has been on screen for RESOLVE_MS
  function resolveDone() {
    // Each faint is its own event
    for (let i = 0; i < 2; i++) {
      const p = pl(i);
      if (p.active !== null && p.hp[p.active] === 0) {
        const name = petName(i);
        p.active = null;
        p.burn = 0;
        p.shield = false;
        addLog(tr("battle.log.faint", {p: pName(i), pet: name}));
        showEvent(S.next, tr("battle.ev.faint", {pet: name}));
        return;
      }
    }

    const need = [];
    for (let i = 0; i < 2; i++) {
      if (pl(i).active !== null) continue;
      if (!anyAlive(i)) {
        S.winner = 1 - i;
        addLog(tr("battle.log.win", {p: pName(S.winner)}));
        enter("over", [0, 1]);
        render();
        return;
      }
      need.push(i);
    }
    if (need.length) {
      enter("sendout", need);
      render();
      return;
    }

    if (S.next === "begin") beginTurn();
    else if (S.next === "ready") toReady();
    else endTurn();
  }

  function pick(i, k) {
    if (S.phase !== "sendout" || !S.waiting.includes(i) || pl(i).hp[k] === 0) return;
    // Choices stay hidden until everyone we wait for has picked
    S.pending[i] = k;
    S.waiting = S.waiting.filter(w => w !== i);
    if (S.waiting.length) {
      addLog(tr("battle.log.picked", {p: pName(i)}));
      render();
      return;
    }
    const shown = [];
    for (let j = 0; j < 2; j++) {
      if (S.pending[j] === null) continue;
      pl(j).active = S.pending[j];
      S.pending[j] = null;
      shown.push(j);
      addLog(tr("battle.log.sendout", {p: pName(j), pet: petName(j)}));
    }
    const html = shown.length === 2 ? tr("battle.ev.vs", {a: petName(0), b: petName(1)}) :
      tr("battle.ev.sendout", {p: esc(PLAYERS[shown[0]].name), pet: petName(shown[0])});
    showEvent(S.next, html + edgeHtml());
  }

  // "Ember beats Sprout" under a send-out or switch when the types matter
  function edgeHtml() {
    const pct = typePct(activePet(0).el, activePet(1).el);
    if (pct === 100) return "";
    const w = pct > 100 ? 0 : 1;
    return `<br><span class="muted">${tr("battle.edge", {a: esc(activePet(w).short), b: esc(activePet(1 - w).short)})}</span>`;
  }

  /* ---------------- attack trial (trial.c, no pressure pad) ---------------- */

  // The pet on the field picks the trial (attack-trial.md §2-§2B): Ember
  // "band" (hold the attack key, no pad here), Tide "tilt" (the attack / block
  // keys or ← / → turn the handheld), Sprout "beat" (tap the attack key)
  const KIND_OF = {fire: "band", water: "tilt", grass: "beat"};
  function startTrial(ts) {
    const kind = KIND_OF[activePet(att()).el];
    const w = kind === "tilt" ? P.tideBandPct : P.bandPct;
    Object.assign(S.trial, {
      started: true, t0: kind === "beat" && ts != null ? ts : performance.now(), held: true, kind, w,
      levelMilli: 0, levelMs: 0, level: 0,  // controls.c: no pad, level in 1/1000
      elapsed: 0, scoredMs: [0, 0, 0], insideMs: [0, 0, 0], center: bandCenter(S.trial.seed, 0, w), inBand: false,
      score: null, stageScores: null, cueStage: -1,
    });
    const T = S.trial;
    if (kind === "tilt") {
      // the handheld starts level; the key that started the trial turns it only after it is let go
      Object.assign(T, {held: false, armed: false, keys: {r: false, l: false, ar: false, al: false}, mg: 0, mgMs: 0,
        nextSample: P.tiltSampleMs});
      T.levelM = PT.tilt.step(0, PT.tilt.quantize(0), true, P.tiltFullMg, P.tiltSmoothPct);
      T.level = PT.tilt.level(T.levelM);
    } else if (kind === "beat") {
      Object.assign(T, {held: false, B: PT.beat.create(T.seed, PT.beat.cfgFrom(P), 0), marks: []});
      beatSounds(T);
    }
    S.phase = "trial";  // same step: the trial is local to the attacker's board
    S.switching = null;
    loop();
    render();
  }

  // Tide: the handheld turns at the hold-A speed (140 pointer / s = 2.8 x
  // TILT_FULL_MG mg / s) while a turn key is held; the accelerometer gives a
  // sample every TILT_SAMPLE_MS (4 mg steps) and each one goes through the
  // §2A filter
  function tiltDir(T) {
    const r = (T.armed && T.keys.r) || T.keys.ar, l = T.keys.l || T.keys.al;
    return (r ? 1 : 0) - (l ? 1 : 0);
  }
  function tiltAdvance(T, ms) {
    const rate = 2.8 * P.tiltFullMg / 1000, dir = tiltDir(T);
    const turn = to => { T.mg = Math.max(-1000, Math.min(1000, T.mg + dir * rate * (to - T.mgMs))); T.mgMs = to; };
    while (T.nextSample <= ms) {
      turn(T.nextSample);
      T.levelM = PT.tilt.step(T.levelM, PT.tilt.quantize(T.mg), false, P.tiltFullMg, P.tiltSmoothPct);
      T.nextSample += P.tiltSampleMs;
    }
    if (ms > T.mgMs) turn(ms);
    T.level = PT.tilt.level(T.levelM);
  }
  function tiltKey(k, down) {
    const T = S.trial;
    if (!S || S.phase !== "trial" || T.kind !== "tilt") return;
    trialUpdate(performance.now());            // the old direction up to now
    if (S.phase !== "trial") return;
    if (k === "r" && !down) T.armed = true;
    T.keys[k] = down;
    render();
  }

  // One update, in whole ms like the player board: controls.c moves the level
  // for the time since its last update, then trial_update() splits (elapsed,
  // now] over the three stages and scores each part in its own stage (inside
  // too if this level is in this band)
  function trialUpdate(now) {
    const T = S.trial;
    if (T.kind === "beat") { beatUpdate(now); return; }
    const ms = Math.floor(now - T.t0);
    if (T.kind === "tilt") tiltAdvance(T, ms);
    else {
      const dl = ms - T.levelMs;
      if (dl > 0) {
        T.levelMilli = T.held ? Math.min(100000, T.levelMilli + P.risePerS * dl) : Math.max(0, T.levelMilli - P.fallPerS * dl);
        T.levelMs = ms;
      }
      T.level = Math.floor((T.levelMilli + 500) / 1000);
    }
    const end = trialEnd();
    const e = Math.max(T.elapsed, Math.min(ms, end));
    const from = T.elapsed;
    T.elapsed = e;
    T.center = bandCenter(T.seed, e, T.w);
    T.inBand = inBand(T.center, T.level, T.w);
    for (let k = 0; k < 3; k++) {
      const lo = P.readyMs + k * P.stageMs, hi = lo + P.stageMs;
      const dt = Math.min(e, hi) - Math.max(from, lo);
      if (dt > 0) {
        T.scoredMs[k] += dt;
        if (T.inBand) T.insideMs[k] += dt;
      }
    }
    if (e >= end) finishTrial();
  }

  // round(inside * 100 / scored), half up, in integers; 0 with nothing scored
  const pctRound = (inside, scored) => scored ? Math.floor((inside * 200 + scored) / (scored * 2)) : 0;
  const sum = a => a.reduce((x, y) => x + y, 0);
  // trial_score(): inside share over all three stages
  const trialScore = T => pctRound(sum(T.insideMs), sum(T.scoredMs));
  // Per-stage share, for the screen only
  const stageScore = (T, k) => pctRound(T.insideMs[k], T.scoredMs[k]);

  function trialHold(held) {
    if (S.phase !== "trial" || S.trial.held === held) return;
    trialUpdate(performance.now());
    if (S.phase === "trial") S.trial.held = held;
    render();
  }

  // Sprout (§2B): taps at their event time; notes whose window closed are
  // missed; done a moment after R + 3S so a key event from just before the
  // end is still counted
  function beatUpdate(now) {
    const T = S.trial, B = T.B, e = Math.floor(now - T.t0);
    PT.beat.update(B, Math.min(e, PT.beat.endMs(B.cfg)));
    T.elapsed = Math.min(Math.max(T.elapsed, e), trialEnd());
    if (e >= PT.beat.endMs(B.cfg) + 30) {
      PT.beat.finish(B);
      finishTrial();
    }
  }
  function beatTap(ts) {
    const T = S.trial;
    const now = performance.now();
    trialUpdate(Math.max(now, ts));
    if (S.phase !== "trial") return;
    const r = PT.beat.tap(T.B, Math.round(ts - T.t0));
    if (r.kind === "ignored") return;
    T.marks.push({kind: r.kind, at: now});
    if (r.kind === "stray") sound.beep([[180, 40]], 0);
    renderGauges();
  }

  // ACT_ATTACK(arg = score) arrives at the central board: tier, damage and the
  // defense difficulty go into the state, then PHASE_DEFEND
  function finishTrial() {
    const T = S.trial;
    if (T.kind === "beat") {
      T.score = PT.beat.score(T.B);
      T.stageScores = [0, 1, 2].map(k => PT.beat.stageScore(T.B, k));
      sound.cancel();
    } else {
      T.score = trialScore(T);
      T.stageScores = [0, 1, 2].map(k => stageScore(T, k));
    }
    T.held = false;
    const a = att(), d = dfn();
    const tier = tierOf(T.score);
    const hits = defendHits(tier), width = defendWidth(tier);
    const typeP = typePct(activePet(a).el, activePet(d).el);
    const zones = [], sweeps = [];
    let start = 0;
    const starts = [];
    for (let i = 0; i < hits; i++) {
      zones.push(defendZone(width, Math.floor(Math.random() * 0x100000000)));
      sweeps.push(defendSweep(tier, i));
      starts.push(start);
      start += sweeps[i] + P.gapMs;
    }
    S.atk = {
      score: T.score, stageScores: T.stageScores, tier, hits, width, zones, sweeps, starts, typePct: typeP,
      damage: attackDamage(T.score, typeP),
      capped: attackDamage(T.score, typeP) === P.maxDmg,
      cursors: Array(hits).fill(null), results: Array(hits).fill(null),
      t0: 0, idx: 0, cursor: 0, inGap: false,
    };
    addLog(tr("battle.log.trial", {pet: petName(a), stages: T.stageScores.join("/"), score: T.score, tier: tierHtml(tier),
      dmg: S.atk.damage, cap: S.atk.capped ? tr("battle.cap") : "", eff: effectHtml(typeP)}));
    if (tier > 0) flare(a, tier);
    S.atk.t0 = performance.now();
    enter("defending", [d]);
    loop();
    render();
  }

  function flare(i, tier) {
    const f = $("#f" + i);
    f.classList.remove("flare1", "flare2");
    void f.offsetWidth;
    f.classList.add("flare" + tier);
  }

  /* ---------------- chained blocks ---------------- */

  // Advances the defender's local schedule: hit i runs from starts[i] for
  // sweeps[i] ms, then DEFEND_GAP_MS of nothing before the next one
  function defendUpdate(now) {
    const A = S.atk, t = now - A.t0;
    while (A.idx < A.hits) {
      const i = A.idx, local = t - A.starts[i];
      if (local < A.sweeps[i]) {
        A.inGap = false;
        A.cursor = Math.max(0, Math.floor(local * 100 / A.sweeps[i]));
        return;
      }
      if (A.results[i] === null) settleHit(i);  // swept through without a press
      if (i === A.hits - 1) break;
      if (t < A.starts[i + 1]) { A.inGap = true; A.cursor = 100; return; }
      A.idx++;
      renderHits();
    }
    finishDefense();
  }

  function settleHit(i) {
    const A = S.atk;
    A.results[i] = blockResult(A.cursors[i], A.zones[i], A.width);
    const r = A.results[i];
    popup(dfn(), RESULT_TXT[r], "blk " + RESULT_CLS[r]);
    renderHits();
  }

  function defendPress() {
    const now = performance.now();
    defendUpdate(now);
    const A = S.atk;
    if (S.phase !== "defending" || A.inGap || A.cursors[A.idx] !== null) return;
    const i = A.idx;
    A.cursors[i] = A.cursor;  // only the first press of each sweep counts
    settleHit(i);
    // After the last bar there is nothing to wait for
    if (i === A.hits - 1) finishDefense();
    else render();
  }

  // ACT_DEFEND(cursors) at the central board: §5
  function finishDefense() {
    if (S.phase !== "defending") return;
    const A = S.atk, d = dfn();
    A.results = A.cursors.map((c, i) => blockResult(c, A.zones[i], A.width));
    const raw = chainDamage(A.damage, A.results);
    const hadShield = pl(d).shield;
    const b = blocked(A.results), h = A.hits;
    const n = damage(d, shielded(d, raw), A.typePct, tr("battle.blocked", {b, h}));
    A.dealt = n;
    addLog(tr("battle.log.defense", {pet: petName(d), b, h, shield: hadShield ? tr("battle.log.shielded") : "", n,
      eff: effectHtml(A.typePct)}));
    showEvent("end", tr("battle.ev.defense", {b, h, pet: petName(d), n}) +
      (hadShield ? ` <span class="muted">${tr("battle.ev.shielded")}</span>` : "") + effectHtml(A.typePct));
  }

  function useSkill() {
    const a = att(), d = dfn(), me = pl(a);
    me.cd = P.skillCd;
    S.justUsed = true;
    const pet = activePet(a);
    const pct = typePct(pet.el, activePet(d).el);
    const v = {pet: petName(a), target: petName(d), skill: esc(pet.skill), eff: effectHtml(pct)};
    let html;
    if (pet.el === "fire") {
      pl(d).burn = P.burnTurns;
      const n = damage(d, shielded(d, rulesScale(P.emberDmg, pct)), pct);
      addLog(tr("battle.log.skillFire", {...v, n}));
      html = tr("battle.ev.skillFire", {...v, n});
    } else if (pet.el === "water") {
      const n = heal(a, P.tideHeal);
      me.shield = true;
      popup(a, "+" + n, "heal");
      addLog(tr("battle.log.skillWater", {...v, n}));
      html = tr("battle.ev.skillWater", {...v, n});
    } else {
      const n = damage(d, shielded(d, rulesScale(P.drain, pct)), pct);
      const h = heal(a, n);
      if (h) popup(a, "+" + h, "heal");
      addLog(tr("battle.log.skillGrass", {...v, n, h}));
      html = tr("battle.ev.skillGrass", {...v, n, h});
    }
    showEvent("end", html);
  }

  // Pets player i could switch to: alive and not the one on the field
  const canSwitchTo = (i, k) => pl(i).active !== null && k !== pl(i).active && pl(i).hp[k] > 0;
  const canSwitch = i => PETS.some((_, k) => canSwitchTo(i, k));

  // Same as do_switch() in game.c: costs the turn, burn and shield leave with
  // the old pet, the cooldown keeps counting down as after any turn
  function switchPet(i, k) {
    if (S.phase !== "ready" || i !== att() || !canSwitchTo(i, k)) return;
    const p = pl(i), old = petName(i);
    p.active = k;
    p.burn = 0;
    p.shield = false;
    addLog(tr("battle.log.switch", {p: pName(i), old, pet: petName(i)}));
    showEvent("end", tr("battle.ev.switch", {p: esc(PLAYERS[i].name), pet: petName(i)}) + edgeHtml());
  }

  // slot = 0/1/2/3: the player's four keys / pad buttons; ts = the event's time
  // (performance.now clock) for Sprout's taps
  function act(i, slot, down, ts) {
    if (!S) return;
    const ph = S.phase;
    if (S.switching === i) {
      // Choosing a pet to switch to: slots 0-2 pick it, slot 3 cancels
      if (!down) return;
      if (slot === 3) {
        S.switching = null;
        render();
      } else {
        switchPet(i, slot);
      }
    } else if (ph === "sendout") {
      if (down && slot < 3) pick(i, slot);
    } else if (slot === 3) {
      if (down && ph === "ready" && i === att() && canSwitch(i)) {
        S.switching = i;
        render();
      }
    } else if (ph === "over") {
      if (down && slot === 0) startMatch(1 - S.winner);  // loser goes first
    } else if (slot === 0 && i === att()) {
      if (down && ph === "ready") startTrial(ts);
      else if (ph === "trial" && S.trial.kind === "tilt") tiltKey("r", down);
      else if (ph === "trial" && S.trial.kind === "beat") { if (down) beatTap(ts != null ? ts : performance.now()); }
      else if (ph === "trial") trialHold(down);
    } else if (slot === 1 && i === att() && ph === "trial" && S.trial.kind === "tilt") {
      tiltKey("l", down);
    } else if (slot === 1 && down && i === dfn() && ph === "defending") {
      defendPress();
    } else if (slot === 2 && down && i === att() && ph === "ready" && pl(i).cd === 0) {
      useSkill();
    }
  }

  /* ---------------- Sprout's beat on WebAudio ---------------- */

  // Square-wave beeps like the handheld's PWM speaker (ui-design §2.6), timed
  // with WebAudio (not setTimeout) and moved earlier by the output latency.
  // The toggle under the gauges is stored in this browser.
  const SOUND_KEY = "pr.battle.sound";
  const sound = {
    ac: null, nodes: [],
    get on() { return store.get(SOUND_KEY) !== "off"; },
    ctx() {
      if (!this.on) return null;
      if (!this.ac) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        try { this.ac = new AC(); } catch { return null; }
      }
      if (this.ac.state === "suspended") this.ac.resume().catch(() => {});
      return this.ac;
    },
    // tones [[hz, ms]...] starting `inMs` from now
    beep(tones, inMs) {
      const ac = this.ctx();
      if (!ac) return;
      const lat = ac.outputLatency || ac.baseLatency || 0;
      let t = ac.currentTime + Math.max(0, inMs / 1000 - lat);
      const out = ac.createGain();
      out.gain.value = 0.06;
      out.connect(ac.destination);
      for (const [hz, ms] of tones) {
        const o = ac.createOscillator();
        o.type = "square"; o.frequency.value = hz;
        o.connect(out); o.start(t); o.stop(t + ms / 1000);
        t += ms / 1000;
        this.nodes.push(o);
      }
      if (this.nodes.length > 64) this.nodes.splice(0, this.nodes.length - 64);
    },
    cancel() { for (const o of this.nodes) { try { o.disconnect(); } catch {} } this.nodes = []; },
  };
  const BEAT_TONES = {beat_count: [[1000, 20]], beat_tick: [[1600, 30]], beat_accent: [[2400, 40]]};
  function beatSounds(T) {
    const now = performance.now() - T.t0;
    for (const c of PT.beat.cues(T.B)) if (c.t >= now) sound.beep(BEAT_TONES[c.id], c.t - now);
  }
  function renderSoundBtn() {
    const b = $("#battle-sound");
    if (!b) return;
    b.textContent = tr(sound.on ? "battle.sound.on" : "battle.sound.off");
    b.setAttribute("aria-pressed", String(sound.on));
  }
  $("#battle-sound")?.addEventListener("click", () => {
    store.set(SOUND_KEY, sound.on ? "off" : "on");
    if (!sound.on) sound.cancel();
    renderSoundBtn();
  });

  /* ---------------- animation loop ---------------- */

  let looping = false;
  function loop() {
    if (looping) return;
    looping = true;
    const step = now => {
      const ph = S.phase;
      if (ph === "trial") trialUpdate(performance.now());
      else if (ph === "defending") defendUpdate(performance.now());
      if (S.phase !== "trial" && S.phase !== "defending") {
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
    PLAYERS.forEach((pp, i) => {
      $("#f" + i).innerHTML = `
        <div class="name">${esc(pp.name)}<span class="pname"></span></div>
        <div class="role-lbl"></div>
        <div class="stage"></div>
        <div class="hp"><i></i></div>
        <div class="hpnum"></div>
        <div class="badges"></div>
        <div class="roster">${PETS.map((pet, k) => `<div class="mini ${pet.el}" data-k="${k}">
            ${spriteSvg(pet.el, "msprite")}<span class="mname">${esc(pet.short)}</span>
            <span class="mhp"><i></i></span><span class="mnum"></span></div>`).join("")}</div>
        <div class="pad">${[0, 1, 2, 3].map(s => `<button data-i="${i}" data-s="${s}"${s === 3 ? ' class="wide"' : ""}><span></span><kbd></kbd></button>`).join("")}</div>`;
    });
  }

  // Trial gauge, tier badge, block gauge and per-hit chips
  function renderGauges() {
    const ph = S.phase, T = S.trial, A = S.atk;
    const trialOn = T && T.started;
    const band = $("#trial-band"), ptr = $("#trial-ptr"), tg = $("#trial-gauge");
    const kind = trialOn ? T.kind : null, beat = kind === "beat";
    band.style.display = trialOn && !beat ? "" : "none";
    ptr.style.display = trialOn && !beat ? "" : "none";
    tg.classList.toggle("tide", kind === "tilt");
    tg.classList.toggle("beat", beat);
    renderLane(beat ? T : null);
    const kindEl = $("#trial-kind");
    if (kindEl) kindEl.textContent = trialOn ? tr("battle.trial.kind." + kind) : "";
    let val = "—", scoring = false, stage = -2, fills = [0, 0, 0, 0];
    if (trialOn) {
      if (!beat) {
        band.style.left = (T.center - T.w / 2) + "%";
        band.style.width = T.w + "%";
        band.classList.toggle("in", T.inBand && ph === "trial");
        ptr.style.left = T.level + "%";
        ptr.classList.toggle("in", T.inBand && ph === "trial");
      }
      const t = T.elapsed;
      const done = T.score !== null;
      stage = done ? 3 : stageAt(t);
      scoring = stage >= 0;
      // Segment 0 is the ready phase, 1..3 the stages
      fills = [P.readyMs ? Math.min(1, t / P.readyMs) : 1,
        ...[0, 1, 2].map(k => Math.min(1, Math.max(0, (t - P.readyMs - k * P.stageMs) / P.stageMs)))];
      if (done) val = tr("battle.trial.total", {n: T.score});
      else if (!scoring) val = tr("battle.trial.ready", {s: (Math.max(0, P.readyMs - t) / 1000).toFixed(1)});
      else if (beat) { const v = PT.beat.stageLive(T.B, stage); val = tr("battle.trial.beatLive", {n: v == null ? "--" : v + "%"}); }
      else val = tr("battle.trial.inBand", {n: stageScore(T, stage)});
      // Cue once per stage start
      if (ph === "trial" && scoring && !done && T.cueStage !== stage) {
        T.cueStage = stage;
        cue(tr(stage === 0 ? "battle.cue.start" : "battle.cue.faster"), stage);
      }
    } else if (ph === "ready") {
      val = tr("battle.trial.pressStart");
    }
    tg.classList.toggle("scoring", scoring && ph === "trial");
    tg.classList.toggle("readying", trialOn && !scoring && ph === "trial");
    $("#trial-val").textContent = val;
    const stEl = $("#trial-stage");
    stEl.textContent = stage === -1 ? tr("battle.stage.ready") : stage >= 0 && stage < 3 ? tr("battle.stage.n", {n: stage + 1}) : "";
    stEl.className = "stage-tag" + (stage >= 0 && stage < 3 ? " s" + stage : "");
    const segs = document.querySelectorAll("#trial-track .seg");
    segs.forEach((seg, j) => {
      seg.querySelector("i").style.width = fills[j] * 100 + "%";
      seg.classList.toggle("now", ph === "trial" && stage + 1 === j);
      if (j === 0) seg.style.flexGrow = P.readyMs / P.stageMs;
      else {
        const b = seg.querySelector("b");
        const txt = T && T.stageScores ? `${T.stageScores[j - 1]}%` : tr("battle.seg", {n: j});
        if (b.textContent !== txt) b.textContent = txt;
      }
    });

    const tierEl = $("#tier");
    const tierKey = A ? String(A.t0) : "";
    if (tierEl.dataset.k !== tierKey) {
      tierEl.dataset.k = tierKey;
      tierEl.className = "tier" + (A ? " t" + A.tier : "");
      tierEl.innerHTML = A ? `<b>${TIER_NAMES[A.tier]}</b>` +
        `<span>${tr("battle.tier.info", {score: A.score, dmg: A.damage, cap: A.capped ? tr("battle.cap") : "", n: A.hits})}</span>` : "";
    }

    const showDef = A && (ph === "defending" || ph === "resolve");
    const z = $("#def-zone"), cur = $("#def-cursor");
    z.style.display = showDef && !A.inGap ? "" : "none";
    cur.style.display = showDef && !A.inGap ? "" : "none";
    let dv = "—";
    if (showDef) {
      const i = Math.min(A.idx, A.hits - 1), w = A.width, zone = A.zones[i];
      z.style.left = zone + "%";
      z.style.width = w + "%";
      const [lo, hi] = perfectRange(0, w);
      $("#def-perfect").style.left = (lo / w * 100) + "%";
      $("#def-perfect").style.width = ((hi - lo + 1) / w * 100) + "%";
      const c = A.cursors[i] !== null ? A.cursors[i] : A.cursor;
      cur.style.left = `calc(${c}% - 1.5px)`;
      cur.classList.toggle("locked", A.cursors[i] !== null);
      dv = ph === "resolve" ? tr("battle.blocked", {b: blocked(A.results), h: A.hits}) :
        A.inGap ? tr("battle.def.next", {n: A.idx + 2, h: A.hits}) : tr("battle.def.hit", {n: i + 1, h: A.hits});
    }
    $("#def-val").textContent = dv;
  }

  // Sprout's lane (ui-design §4.8 C3, drawn like the TFT): notes slide in from
  // the right and reach the judge line (8 %) on their beat; rests are grey
  // dots; a hit turns into ★ / ✓ on the line, a stray tap flashes ✗ left of it
  const LANE_X = 8, LANE_LEAD_MS = 1200;
  function renderLane(T) {
    const lane = $("#trial-lane");
    if (!lane) return;
    lane.hidden = !T;
    if (!T) { if (lane.dataset.k) { lane.innerHTML = ""; lane.dataset.k = ""; } return; }
    const B = T.B, e = Math.floor(performance.now() - T.t0);
    if (lane.dataset.k !== String(T.t0)) {
      lane.dataset.k = String(T.t0);
      lane.innerHTML = `<i class="judge"></i>` + B.sc.slots.map(sl => `<b class="${sl.rest ? "rest" : "note"}"></b>`).join("") +
        `<em class="mark"></em><em class="stray">✗</em>`;
    }
    const els = lane.querySelectorAll("b");
    B.sc.slots.forEach((sl, i) => {
      const x = LANE_X + (sl.b - e) / LANE_LEAD_MS * (100 - LANE_X);
      const el = els[i], ni = sl.rest ? -1 : B.sc.notes.indexOf(sl), r = ni >= 0 ? B.res[ni] : null;
      const show = x <= 100 && x >= 0 && r !== "perfect" && r !== "good";
      el.style.display = show ? "" : "none";
      if (show) el.style.left = x + "%";
      el.classList.toggle("miss", r === "miss");
    });
    const now = performance.now(), recent = k => T.marks.some(mk => mk.kind === k && now - mk.at < 150);
    const mark = lane.querySelector(".mark");
    mark.textContent = recent("perfect") ? "★" : recent("good") ? "✓" : "";
    mark.className = "mark" + (recent("perfect") ? " perfect" : recent("good") ? " good" : "");
    lane.querySelector(".stray").classList.toggle("on", recent("stray"));
    const flash = B.sc.notes.some(nt => e >= nt.b && e - nt.b < 80) || B.sc.counts.some(c => e >= c && e - c < 80);
    lane.querySelector(".judge").classList.toggle("on", flash);
  }

  // Short text over the trial gauge when a stage starts
  function cue(text, stage) {
    const el = $("#trial-cue");
    el.textContent = text;
    el.className = "trial-cue";
    void el.offsetWidth;
    el.className = "trial-cue on s" + stage;
  }

  function renderHits() {
    const A = S.atk, ph = S.phase;
    const show = A && (ph === "defending" || ph === "resolve");
    $("#hits").innerHTML = !show ? "" : A.results.map((r, i) =>
      `<span class="hit-chip ${r === null ? (i === A.idx && ph === "defending" ? "now" : "") : RESULT_CLS[r]}">` +
      `${i + 1} · ${r === null ? "…" : RESULT_TXT[r]}</span>`).join("") +
      (ph === "resolve" ? `<span class="hit-sum">${tr("battle.blocked", {b: blocked(A.results), h: A.hits})}</span>` : "");
  }

  function padLabels(i) {
    const kb = PLAYERS[i].keys, p = pl(i), ph = S.phase;
    const isAtt = i === att();
    const switchBtn = {t: tr("battle.pad.switch"), k: kb[3], on: isAtt && ph === "ready" && canSwitch(i)};
    if (S.switching === i) {
      return [...PETS.map((pet, k) => ({t: pet.short, k: kb[k], on: canSwitchTo(i, k)})),
        {t: tr("battle.pad.cancel"), k: kb[3], on: true}];
    }
    if (ph === "sendout") {
      const choosing = S.waiting.includes(i);
      return [...PETS.map((pet, k) => ({
        t: pet.short, k: kb[k], on: choosing && p.hp[k] > 0,
      })), {...switchBtn, on: false}];
    }
    if (ph === "over") {
      return [{t: tr("battle.pad.again"), k: kb[0], on: true}, {t: tr("battle.pad.block"), k: kb[1], on: false},
        {t: tr("battle.pad.skill"), k: kb[2], on: false}, {...switchBtn, on: false}];
    }
    const skill = p.active !== null ? PETS[p.active].skill : tr("battle.pad.skill");
    const holding = isAtt && ph === "trial", kind = holding ? S.trial.kind : null;
    return [
      {t: tr(kind === "tilt" ? "battle.pad.right" : kind === "beat" ? "battle.pad.tap" : holding ? "battle.pad.hold" : "battle.pad.attack"),
        k: kb[0], on: isAtt && (ph === "ready" || ph === "trial")},
      kind === "tilt" ? {t: tr("battle.pad.left"), k: kb[1], on: true} :
      {t: tr("battle.pad.block"), k: kb[1], on: !isAtt && ph === "defending"},
      {t: skill, k: kb[2], on: isAtt && ph === "ready" && p.cd === 0},
      switchBtn,
    ];
  }

  function render() {
    const ph = S.phase;
    PLAYERS.forEach((pp, i) => {
      const el = $("#f" + i), p = pl(i);
      const pet = p.active !== null ? PETS[p.active] : null;
      const isAtt = i === att();
      ["fire", "water", "grass"].forEach(e => el.classList.toggle(e, !!pet && pet.el === e));
      el.classList.toggle("turn", ph === "sendout" ? S.waiting.includes(i) :
        ph !== "over" && ph !== "resolve" && (ph === "defending" ? !isAtt : isAtt));
      el.classList.toggle("ko", ph === "over" && S.winner !== i);

      el.querySelector(".pname").textContent = pet ? " · " + pet.name : "";
      el.querySelector(".role-lbl").textContent = tr(
        ph === "over" ? (S.winner === i ? "battle.role.win" : "battle.role.allOut") :
        ph === "sendout" ? (S.waiting.includes(i) ? "battle.role.picking" : S.pending[i] !== null ? "battle.picked" : "battle.role.waitOther") :
        S.switching === i ? "battle.role.switching" : isAtt ? "battle.role.att" : "battle.role.def");

      const stage = el.querySelector(".stage");
      const key = pet ? pet.el : ph === "over" ? "out" : "none";
      if (stage.dataset.k !== key) {
        stage.dataset.k = key;
        stage.innerHTML = pet ? spriteSvg(pet.el) : `<div class="hidden-pet">${key === "out" ? "💫" : "?"}</div>`;
      }
      const hp = pet ? p.hp[p.active] : 0;
      el.querySelector(".hp i").style.width = (pet ? hp / S.hpMax * 100 : 0) + "%";
      el.querySelector(".hpnum").textContent = pet ? `HP ${hp} / ${S.hpMax}` :
        tr("battle.hpLeft", {n: p.hp.filter(h => h > 0).length, total: TEAM_SIZE});

      const badges = [];
      if (p.burn) badges.push(tr("battle.badge.burn", {n: p.burn}));
      if (p.shield) badges.push(tr("battle.badge.shield"));
      badges.push(p.cd ? tr("battle.badge.cd", {n: p.cd}) : tr("battle.badge.ready"));
      el.querySelector(".badges").innerHTML = badges.map(b => `<span class="badge">${esc(b)}</span>`).join("");

      el.querySelectorAll(".mini").forEach(m => {
        const k = +m.dataset.k, h = p.hp[k];
        m.classList.toggle("fainted", h === 0);
        m.classList.toggle("active", p.active === k);
        m.classList.toggle("pickable", S.switching === i ? canSwitchTo(i, k) :
          ph === "sendout" && S.waiting.includes(i) && h > 0);
        m.querySelector(".mhp i").style.width = (h / S.hpMax * 100) + "%";
        m.querySelector(".mnum").textContent = h === 0 ? tr("battle.mini.fainted") : h;
      });

      const labels = padLabels(i);
      el.querySelectorAll(".pad button").forEach((b, s) => {
        b.querySelector("span").textContent = labels[s].t;
        b.querySelector("kbd").textContent = labels[s].k;
        b.disabled = !labels[s].on;
        b.classList.toggle("held", isAtt && ph === "trial" && (s === 0 && S.trial.held ||
          S.trial.kind === "tilt" && (s === 0 && S.trial.keys.r || s === 1 && S.trial.keys.l)));
      });
    });

    const a = att(), d = dfn();
    const kbd = k => `<kbd class="mono">${esc(k)}</kbd>`;
    let prompt = "";
    if (ph === "sendout") {
      // Who still has to pick shows on the fighter cards
      const first = S.round === 1 && pl(0).active === null && pl(1).active === null;
      prompt = `<span>${first ? tr("battle.prompt.firstPick", {p: pName(S.turn)}) : tr("battle.prompt.nextPick")}</span>`;
    } else if (ph === "resolve") {
      prompt = `<span>${S.event}</span>`;
    } else if (ph === "ready" && S.switching === a) {
      const keys = PETS.map((_, k) => k).filter(k => canSwitchTo(a, k)).map(k => kbd(PLAYERS[a].keys[k])).join("/");
      prompt = `<span>${tr("battle.prompt.switch", {p: pName(a), keys, k: kbd(PLAYERS[a].keys[3])})}</span>`;
    } else if (ph === "ready") {
      const k = PLAYERS[a].keys.map(kbd);
      const opts = [tr("battle.opt.attack", {k: k[0]})];
      if (!pl(a).cd) opts.push(tr("battle.opt.skill", {k: k[2], skill: esc(activePet(a).skill)}));
      if (canSwitch(a)) opts.push(tr("battle.opt.switch", {k: k[3]}));
      prompt = `<span>${tr("battle.prompt.ready", {p: pName(a), opts: opts.join(" · ")})}</span>`;
    } else if (ph === "trial") {
      const kind = S.trial.kind, k = kbd(PLAYERS[a].keys[0]);
      prompt = `<span>${kind === "tilt" ? tr("battle.prompt.tilt", {k, k2: kbd(PLAYERS[a].keys[1])}) :
        kind === "beat" ? tr("battle.prompt.beat", {k}) : tr("battle.prompt.trial", {k})}</span>`;
    } else if (ph === "defending") {
      prompt = `<span>${tr("battle.prompt.defend", {k: kbd(PLAYERS[d].keys[1]), n: S.atk.hits})}</span>`;
    } else if (ph === "over") {
      prompt = `<span>${tr("battle.prompt.over", {p: pName(S.winner), k0: kbd(PLAYERS[0].keys[0]), k1: kbd(PLAYERS[1].keys[0])})}</span>`;
    }
    $("#prompt").innerHTML = prompt;
    $("#round").textContent = S.round;
    renderGauges();
    renderHits();
  }

  /* ---------------- input ---------------- */

  const KEYMAP = {};
  PLAYERS.forEach((pp, i) => pp.keys.forEach((k, s) => KEYMAP[k.toLowerCase()] = [i, s]));

  function typing(e) {
    const t = e.target;
    return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
  }

  document.addEventListener("keydown", e => {
    if (window.currentTab !== "battle" || typing(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    const m = KEYMAP[e.key.toLowerCase()];
    if (!m) return;
    e.preventDefault();
    if (!e.repeat) act(m[0], m[1], true, e.timeStamp);
  });
  document.addEventListener("keyup", e => {
    const m = KEYMAP[e.key.toLowerCase()];
    if (m && m[1] <= 1) act(m[0], m[1], false, e.timeStamp);
  });
  // ← / → also turn the attacker's handheld in Tide's trial
  const ARROWS = {ArrowRight: "ar", ArrowLeft: "al"};
  document.addEventListener("keydown", e => {
    if (window.currentTab !== "battle" || typing(e) || !ARROWS[e.key] || !S || S.phase !== "trial" || S.trial.kind !== "tilt") return;
    e.preventDefault();
    if (!e.repeat) tiltKey(ARROWS[e.key], true);
  });
  document.addEventListener("keyup", e => { if (ARROWS[e.key] && S && S.phase === "trial" && S.trial.kind === "tilt") tiltKey(ARROWS[e.key], false); });

  const arena = document.querySelector(".arena");
  arena.addEventListener("pointerdown", e => {
    // The pet row picks a pet while sending out or switching
    const m = e.target.closest(".mini.pickable");
    if (m) {
      e.preventDefault();
      act(+m.closest(".fighter").id.slice(1), +m.dataset.k, true);
      return;
    }
    const b = e.target.closest(".pad button");
    if (!b || b.disabled) return;
    e.preventDefault();
    b.setPointerCapture?.(e.pointerId);
    act(+b.dataset.i, +b.dataset.s, true, e.timeStamp);
  });
  const release = e => {
    const b = e.target.closest?.(".pad button");
    if (b && (b.dataset.s === "0" || b.dataset.s === "1")) act(+b.dataset.i, +b.dataset.s, false, e.timeStamp);
  };
  arena.addEventListener("pointerup", release);
  arena.addEventListener("pointercancel", release);
  arena.addEventListener("contextmenu", e => { if (e.target.closest(".pad")) e.preventDefault(); });
  // A key held while switching tabs or windows never sends its keyup: let go
  window.addEventListener("blur", () => {
    if (!S || S.phase !== "trial") return;
    if (S.trial.kind === "tilt") { for (const k of ["r", "l", "ar", "al"]) if (S.trial.keys[k]) tiltKey(k, false); }
    else trialHold(false);
  });

  $("#restart").addEventListener("click", () => startMatch(Math.random() < 0.5 ? 0 : 1));

  // Read-only hooks for the automated playtest script
  window.PR.battle = {get state() { return S; }, params: P, bandCenter, tau100, stageAt, inBand, tierOf, attackDamage, chainDamage, cConfig,
    petTrials: PT, act, get sound() { return sound.on; }};

  buildFighters();
  renderParams();
  renderSoundBtn();
  startMatch(Math.random() < 0.5 ? 0 : 1);
})();
