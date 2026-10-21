// Pocket Rivals handheld simulator: 双人冒险 Adventure prototype (docs/ui-design.md §4.10, §6)
//
// STEP-0 STUB (owner: agent E). A placeholder co-op mode built with
// DEVICE.stubMode: pick (A) -> room (A counts, B ends) -> results. Replace
// the whole file with the real mode (adv.state 0x44, rooms, central world,
// core strike with DEVICE.trial, BFS solve fixture). Keep the dev.adv.
// prefix and the screen ids adv.pick / adv.room. API: device-core.js.
(() => {
  const D = window.DEVICE;

  D.registerStrings("dev.adv.", {
    zh: {"dev.adv.goal1": "两人一起闯{n}关", "dev.adv.goal2": "心是共用的",
      "dev.adv.k1n": "摇杆", "dev.adv.k1": "走", "dev.adv.k2n": "A", "dev.adv.k2": "互动、攻击", "dev.adv.k3n": "S", "dev.adv.k3": "元素能力",
      "dev.adv.k4n": "捏垫", "dev.adv.k4": "绞盘、一击", "dev.adv.k5n": "M", "dev.adv.k5": "神龛换宠物"},
    en: {"dev.adv.goal1": "Team: clear {n} rooms", "dev.adv.goal2": "Hearts are shared",
      "dev.adv.k1n": "Stick", "dev.adv.k1": "walk", "dev.adv.k2n": "A", "dev.adv.k2": "use/hit", "dev.adv.k3n": "S", "dev.adv.k3": "power",
      "dev.adv.k4n": "Pad", "dev.adv.k4": "winch/hit", "dev.adv.k5n": "M", "dev.adv.k5": "switch pet"},
  });

  D.registerMode(D.stubMode({
    id: "adventure", modeId: 2, order: 2, titleKey: "dev.menu.adv", subKey: "dev.menu.advSub", icon: "ui.mode.adv",
    coop: true, status: "prototype", needsStick: true, stateMsg: "adv.state", typeId: D.C.MSG.ADV_STATE, prefix: "adv.", hud: "room",
    lobby: {badgeKey: "dev.lobby.rooms", badgeVars: () => ({n: 4}), goals: ["dev.adv.goal1", "dev.adv.goal2"],
      keys: [["STICK", "dev.adv.k1n", "dev.adv.k1"], ["A", "dev.adv.k2n", "dev.adv.k2"], ["S", "dev.adv.k3n", "dev.adv.k3"],
        ["PAD", "dev.adv.k4n", "dev.adv.k4"], ["M", "dev.adv.k5n", "dev.adv.k5"]]},
  }));
  D.stubModeScreens("adv.", "dev.menu.adv", "room");
})();
