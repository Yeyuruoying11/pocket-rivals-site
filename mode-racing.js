// Pocket Rivals handheld simulator: 双人赛车 Racing prototype (docs/ui-design.md §4.9, §5)
//
// STEP-0 STUB (owner: agent D). A placeholder mode built with
// DEVICE.stubMode: pick (A) -> hud (A counts, B ends) -> results. Replace the
// whole file with the real mode (race.input 0x04, race.state 0x43, track,
// local physics, AI rival). Keep the dev.race. prefix and the screen ids
// race.pick / race.hud. API: the header of device-core.js.
(() => {
  const D = window.DEVICE;

  D.registerStrings("dev.race.", {
    zh: {"dev.race.goal1": "先跑完{n}圈的赢", "dev.race.goal2": "一直捏满会过热", "dev.race.p.laps": "圈数",
      "dev.race.k1n": "摇杆", "dev.race.k1": "方向", "dev.race.k2n": "捏垫/A", "dev.race.k2": "油门",
      "dev.race.k3n": "B", "dev.race.k3": "刹车", "dev.race.k4n": "S", "dev.race.k4": "技能"},
    en: {"dev.race.goal1": "First to {n} laps wins", "dev.race.goal2": "Full gas overheats", "dev.race.p.laps": "Laps",
      "dev.race.k1n": "Stick", "dev.race.k1": "steer", "dev.race.k2n": "Pad/A", "dev.race.k2": "gas",
      "dev.race.k3n": "B", "dev.race.k3": "brake", "dev.race.k4n": "S", "dev.race.k4": "skill"},
  });

  D.registerMode(D.stubMode({
    id: "racing", modeId: 1, order: 1, titleKey: "dev.menu.race", subKey: "dev.menu.raceSub", subVars: p => ({n: p.laps}),
    icon: "ui.mode.race", status: "prototype", needsStick: true, stateMsg: "race.state", typeId: D.C.MSG.RACE_STATE, prefix: "race.",
    params: [{key: "laps", c: "RACE_LAPS", labelKey: "dev.race.p.laps", min: 1, max: 9, step: 1, def: 3, unit: ""}],
    lobby: {badgeKey: "dev.lobby.laps", badgeVars: p => ({n: p.laps}), goals: ["dev.race.goal1", "dev.race.goal2"],
      keys: [["STICK", "dev.race.k1n", "dev.race.k1"], ["PAD", "dev.race.k2n", "dev.race.k2"],
        ["B", "dev.race.k3n", "dev.race.k3"], ["S", "dev.race.k4n", "dev.race.k4"]]},
  }));
  D.stubModeScreens("race.", "dev.menu.race");
})();
