// Pocket Rivals handheld simulator: debug panel, gamepads, gallery, fixture
// runner, exports, SPI budget table (docs/ui-design.md §8.9)
//
// STEP-0 STUB (owner: agent F). Shows the seed and lets either handheld be
// handed to its bot, so one person can walk the whole flow. Replace the whole
// file; keep the dev.dbg. prefix. The panel is built in DEVICE.onStart(dom),
// into dom.debug. API: the header of device-core.js.
(() => {
  const D = window.DEVICE;

  D.registerStrings("dev.dbg.", {
    zh: {"dev.dbg.title": "调试", "dev.dbg.todo": "调试面板还没做（device-debug.js）", "dev.dbg.seed": "种子 {seed}", "dev.dbg.bot": "玩家 {n} 交给电脑"},
    en: {"dev.dbg.title": "Debug", "dev.dbg.todo": "Debug panel not built yet (device-debug.js)", "dev.dbg.seed": "Seed {seed}", "dev.dbg.bot": "Player {n}: computer"},
  });

  D.onStart(dom => {
    const t = (k, v) => I18N.t(k, v);
    const card = document.createElement("div");
    card.className = "card";
    const h = document.createElement("h2");
    h.textContent = t("dev.dbg.title");
    const p = document.createElement("p");
    p.className = "muted";
    p.textContent = t("dev.dbg.todo") + " · " + t("dev.dbg.seed", {seed: D.seed()});
    const row = document.createElement("div");
    row.className = "row";
    [0, 1].forEach(i => {
      const label = document.createElement("label");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = D.bot(i);          // phones start with the computer playing P2 (§8.12)
      box.addEventListener("change", () => D.bot(i, box.checked));
      label.append(box, " " + t("dev.dbg.bot", {n: i + 1}));
      row.append(label);
    });
    card.append(h, p, row);
    dom.debug.append(card);
  });
})();
