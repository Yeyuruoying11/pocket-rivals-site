// Pocket Rivals handheld simulator: 对抗 Battle (docs/ui-design.md §4.7-4.8, §8.8)
//
// STEP-0 STUB (owner: agent C). A placeholder mode built with
// DEVICE.stubMode: pick (A) -> hud (A counts on the central board, B ends
// the match) -> results. It only proves the flow; replace the whole file with
// the real mode (battle.state 0x41 must then be the 47 B legacy layout,
// {kind: "mode", legacyLayout: true}). Keep the dev.battle. prefix and the
// screen ids battle.pick / battle.hud. API: the header of device-core.js.
(() => {
  const D = window.DEVICE;

  D.registerStrings("dev.battle.", {
    zh: {"dev.battle.goal1": "打倒对方3只宠物", "dev.battle.goal2": "跟住光带打得更重",
      "dev.battle.k1n": "A/捏垫", "dev.battle.k1": "攻击测试", "dev.battle.k2n": "S", "dev.battle.k2": "技能",
      "dev.battle.k3n": "M", "dev.battle.k3": "换宠物", "dev.battle.k4n": "A", "dev.battle.k4": "格挡"},
    en: {"dev.battle.goal1": "KO all 3 rival pets", "dev.battle.goal2": "Track band: hit hard",
      "dev.battle.k1n": "A/Pad", "dev.battle.k1": "Attack", "dev.battle.k2n": "S", "dev.battle.k2": "Skill",
      "dev.battle.k3n": "M", "dev.battle.k3": "Switch", "dev.battle.k4n": "A", "dev.battle.k4": "Block"},
  });

  D.registerMode(D.stubMode({
    id: "battle", modeId: 0, order: 0, titleKey: "dev.menu.battle", subKey: "dev.menu.battleSub", icon: "ui.mode.battle",
    status: "firmware", needsStick: false, stateMsg: "battle.state", typeId: D.C.MSG.BATTLE_STATE, prefix: "battle.",
    lobby: {badgeKey: "dev.lobby.battleBadge", badgeVars: () => ({}), goals: ["dev.battle.goal1", "dev.battle.goal2"],
      keys: [["A", "dev.battle.k1n", "dev.battle.k1"], ["S", "dev.battle.k2n", "dev.battle.k2"],
        ["M", "dev.battle.k3n", "dev.battle.k3"], ["A", "dev.battle.k4n", "dev.battle.k4"]]},
  }));
  D.stubModeScreens("battle.", "dev.menu.battle");
})();
