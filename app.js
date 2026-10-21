// Pocket Rivals progress site: tabs, member filter, timeline, hardware, updates

/* ---------------- strings (中文 / English) ---------------- */

// Keys ending in ".one" are the singular form, picked by trn() when n is 1
I18N.add({
  zh: {
    "app.title": "Pocket Rivals 项目进展",
    "app.description": "CE346 Pocket Rivals：基于 micro:bit V2 的无线双人对战游戏，项目进展与分工。",
    "app.hero.tagline": "基于 micro:bit V2 的无线双人回合制对战游戏",
    "app.cd.d": "天", "app.cd.h": "时", "app.cd.m": "分", "app.cd.s": "秒",
    "app.cd.cap": "距离 Final demo（12 月 7 日）",
    "app.tab.overview": "总览", "app.tab.timeline": "时间线", "app.tab.hardware": "硬件与 Pin",
    "app.tab.battle": "玩法原型", "app.tab.updates": "进展", "app.tab.reviews": "留言",
    "app.tab.device": "掌机模拟器 ↗", "app.simLink": "在掌机模拟器里看 →",
    "app.who.label": "按成员看：",
    "app.all": "全部",
    "app.everyone": "全员",
    "app.owner": "负责人：{name}",
    "app.copied": "已复制",
    "app.loadFailed": "数据加载失败：{msg}",

    "app.overview.arch": "系统架构",
    "app.overview.archHint": "点击任意模块查看详情",
    "app.overview.archIntro": "两块玩家板负责输入和显示，中央板负责战斗逻辑，三块板之间用 802.15.4 无线通信。每块板按传感器（输入）和执行器（输出）分组，虚线框是计划中的部件。",
    "app.overview.team": "团队分工",
    "app.overview.teamHint": "点击成员只看 TA 的任务",
    "app.overview.latest": "最新进展",
    "app.overview.seeAll": "查看全部进展 →",
    "app.stats.current": "当前",
    "app.stats.notStarted": "未开学",
    "app.stats.ended": "已结束",
    "app.stats.progress": "整体进度",
    "app.stats.progressOf": "{who} 的整体进度",
    "app.stats.active": "进行中的任务",
    "app.stats.activeOf": "{who} 的进行中的任务",
    "app.stats.total": "共 {n} 项任务", "app.stats.total.one": "共 {n} 项任务",
    "app.stats.parts": "零件到手",
    "app.stats.toBuy": "还有 {n} 项待购买",
    "app.arch.hw": "硬件", "app.arch.sw": "软件",
    "app.arch.introSw": "软件按模块拆分，改一个功能只动一个文件（docs/modules.md）。点模块看文件、负责人和进度。",
    "app.board.playerFw": "玩家板固件", "app.board.playerFwSub": "两块玩家板运行同一份固件",
    "app.board.centralFw": "中央板固件", "app.board.centralFwSub": "规则和状态都在这里",
    "app.board.shared": "共用模块与工具", "app.board.sharedSub": "两边共用的代码、测试和网页工具",
    "app.board.player": "玩家板",
    "app.board.playerN": "玩家板 {n}",
    "app.board.playerSub": "输入 · 显示 · 音效",
    "app.kind.sensor": "传感器（输入）", "app.kind.actuator": "执行器（输出）", "app.kind.comms": "通讯", "app.kind.other": "其它", "app.kind.planned": "计划中",
    "app.board.central": "中央板",
    "app.board.centralSub": "游戏状态的唯一来源",
    "app.team.count": "{n} 项负责任务 · {doing} 项进行中 · 进度 {pct}%",
    "app.team.count.one": "{n} 项负责任务 · {doing} 项进行中 · 进度 {pct}%",

    "app.timeline.title": "时间线",
    "app.timeline.hint": "点击任务看详情",
    "app.timeline.milestones": "里程碑",
    "app.timeline.modules": "模块任务",
    "app.timeline.onlyNow": "只看本周进行中的",
    "app.timeline.thisWeek": "当前周",
    "app.timeline.clickTask": "点击上面的任意任务。",
    "app.task.done": "已完成", "app.task.doing": "进行中", "app.task.todo": "计划中",
    "app.task.week": "第 {w} 周",
    "app.task.weeks": "第 {w}–{end} 周",
    "app.task.meta": "{group} · {weeks}（{range}）· 负责人：{owner}",
    "app.gantt.task": "任务",
    "app.gantt.owner": "负责人",
    "app.gantt.empty": "没有符合条件的任务。",

    "app.hw.parts": "采购清单",
    "app.hw.pinMap": "Pin 分配图",
    "app.hw.pinHint": "点击 pin 查看详情",
    "app.hw.noMatrix": "停用板载 LED 点阵",
    "app.part.have": "已有", "app.part.arrived": "已到货", "app.part.ordered": "已下单",
    "app.part.buy": "待购买", "app.part.choosing": "选型中", "app.part.later": "后期再买",
    "app.partGroup.in": "已到手", "app.partGroup.order": "已下单", "app.partGroup.need": "待购买", "app.partGroup.later": "后期",
    "app.parts.empty": "没有符合条件的零件。",
    "app.pinPart.tft": "TFT 屏", "app.pinPart.audio": "DFPlayer", "app.pinPart.joy": "摇杆",
    "app.pinPart.btn": "按钮", "app.pinPart.fsr": "压力传感器",
    "app.pin.free": "空闲",
    "app.pin.freeMatrixOff": "空闲（点阵已停用）",
    "app.pin.freeI2c": "空闲（外部 I2C）",
    "app.pin.onboardLed": "板载 {b}",
    "app.pin.onboardBtn": "板载{b}",
    "app.pin.power": "电源",
    "app.pin.gnd": "地",
    "app.pin.usable": "可用 pin",
    "app.pin.assigned": "已分配",
    "app.pin.left": "剩余空闲",
    "app.pin.centralNote": "中央板不接外设，pin 全部空闲；板载 LED 点阵可以用来显示连接状态和当前回合。",
    "app.pin.legendBusy": "板载占用",
    "app.pin.clickAny": "点击任意 pin。",
    "app.pin.now": "当前：{use}",
    "app.pin.builtin": "板载功能：{b}",

    "app.updates.all": "全部进展",
    "app.updates.search": "搜索标题或内容…",
    "app.updates.allAreas": "全部分类",
    "app.updates.none": "还没有进展。",
    "app.updates.noMatch": "没有找到相关进展。",
    "app.composer.title": "写一条进展",
    "app.composer.hint": "填好后复制，粘贴到 GitHub 上的 updates.json",
    "app.composer.date": "日期",
    "app.composer.author": "作者",
    "app.composer.area": "分类",
    "app.composer.areaPh": "例如：无线、显示、硬件",
    "app.composer.titleLbl": "标题",
    "app.composer.titlePh": "一句话说明做了什么",
    "app.composer.bodyLbl": "内容",
    "app.composer.bodyPh": "细节、遇到的问题、下一步计划",
    "app.composer.titleEnLbl": "英文标题（可选）",
    "app.composer.titleEnPh": "英文界面显示的标题，可以不填",
    "app.composer.bodyEnLbl": "英文内容（可选）",
    "app.composer.bodyEnPh": "不填的话，英文界面显示中文内容",
    "app.composer.preview": "预览",
    "app.composer.copy": "复制",
    "app.composer.edit": "去 GitHub 编辑 updates.json ↗",
    "app.composer.howto": "粘贴到文件第一行的 <code>[</code> 后面，然后点 Commit changes。大约一分钟后网站会更新。需要先被加为仓库的协作者。",
    "app.composer.defaultArea": "其他",
    "app.composer.phTitle": "（标题）",
    "app.composer.phBody": "（内容）",
    "app.footer": "Pocket Rivals · CE346 Fall 2026 · Harvey Lu、Binqi Liu、Yihao Tao。 数据来自本仓库的 <code>status.json</code>、<code>updates.json</code>、<code>pins.json</code>，留言来自本仓库的 Issues。",
  },
  en: {
    "app.title": "Pocket Rivals Project Progress",
    "app.description": "CE346 Pocket Rivals: a wireless two-player battle game built on the micro:bit V2. Project progress and team roles.",
    "app.hero.tagline": "A wireless two-player turn-based battle game built on the micro:bit V2",
    "app.cd.d": "days", "app.cd.h": "hrs", "app.cd.m": "min", "app.cd.s": "sec",
    "app.cd.cap": "until the final demo (Dec 7)",
    "app.tab.overview": "Overview", "app.tab.timeline": "Timeline", "app.tab.hardware": "Hardware & pins",
    "app.tab.battle": "Battle prototype", "app.tab.updates": "Updates", "app.tab.reviews": "Guestbook",
    "app.tab.device": "Handheld simulator ↗", "app.simLink": "See it on the handheld simulator →",
    "app.who.label": "By member:",
    "app.all": "All",
    "app.everyone": "Everyone",
    "app.owner": "Owner: {name}",
    "app.copied": "Copied",
    "app.loadFailed": "Couldn't load the data: {msg}",

    "app.overview.arch": "System architecture",
    "app.overview.archHint": "Click any module for details",
    "app.overview.archIntro": "The two player boards handle input and display, the central board runs the battle logic, and the three boards talk to each other over 802.15.4 radio. Each board lists its sensors (input) and actuators (output); dashed parts are planned.",
    "app.overview.team": "Team roles",
    "app.overview.teamHint": "Click a member to see only their tasks",
    "app.overview.latest": "Latest updates",
    "app.overview.seeAll": "See all updates →",
    "app.stats.current": "This week",
    "app.stats.notStarted": "Not started",
    "app.stats.ended": "Ended",
    "app.stats.progress": "Overall progress",
    "app.stats.progressOf": "{who}'s overall progress",
    "app.stats.active": "Tasks in progress",
    "app.stats.activeOf": "{who}'s tasks in progress",
    "app.stats.total": "{n} tasks in total", "app.stats.total.one": "{n} task in total",
    "app.stats.parts": "Parts in hand",
    "app.stats.toBuy": "{n} still to buy",
    "app.arch.hw": "Hardware", "app.arch.sw": "Software",
    "app.arch.introSw": "The software is split into modules so each feature lives in one file (docs/modules.md). Click a module for its file, owner and status.",
    "app.board.playerFw": "Player firmware", "app.board.playerFwSub": "Both player boards run the same firmware",
    "app.board.centralFw": "Central firmware", "app.board.centralFwSub": "Rules and game state live here",
    "app.board.shared": "Shared modules & tools", "app.board.sharedSub": "Code both sides use, tests and web tools",
    "app.board.player": "Player board",
    "app.board.playerN": "Player board {n}",
    "app.board.playerSub": "Input · display · audio",
    "app.kind.sensor": "Sensors (input)", "app.kind.actuator": "Actuators (output)", "app.kind.comms": "Comms", "app.kind.other": "Other", "app.kind.planned": "Planned",
    "app.board.central": "Central board",
    "app.board.centralSub": "Single source of truth for the game state",
    "app.team.count": "{n} tasks owned · {doing} in progress · {pct}% done",
    "app.team.count.one": "{n} task owned · {doing} in progress · {pct}% done",

    "app.timeline.title": "Timeline",
    "app.timeline.hint": "Click a task for details",
    "app.timeline.milestones": "Milestones",
    "app.timeline.modules": "Module tasks",
    "app.timeline.onlyNow": "Only tasks in progress this week",
    "app.timeline.thisWeek": "Current week",
    "app.timeline.clickTask": "Click any task above.",
    "app.task.done": "Done", "app.task.doing": "In progress", "app.task.todo": "Planned",
    "app.task.week": "Week {w}",
    "app.task.weeks": "Weeks {w}–{end}",
    "app.task.meta": "{group} · {weeks} ({range}) · Owner: {owner}",
    "app.gantt.task": "Task",
    "app.gantt.owner": "Owner",
    "app.gantt.empty": "No matching tasks.",

    "app.hw.parts": "Parts list",
    "app.hw.pinMap": "Pin map",
    "app.hw.pinHint": "Click a pin for details",
    "app.hw.noMatrix": "Disable the on-board LED matrix",
    "app.part.have": "Have", "app.part.arrived": "Arrived", "app.part.ordered": "Ordered",
    "app.part.buy": "To buy", "app.part.choosing": "Choosing model", "app.part.later": "Buy later",
    "app.partGroup.in": "In hand", "app.partGroup.order": "Ordered", "app.partGroup.need": "To buy", "app.partGroup.later": "Later",
    "app.parts.empty": "No matching parts.",
    "app.pinPart.tft": "TFT screen", "app.pinPart.audio": "DFPlayer", "app.pinPart.joy": "Joystick",
    "app.pinPart.btn": "Buttons", "app.pinPart.fsr": "Pressure sensor",
    "app.pin.free": "Free",
    "app.pin.freeMatrixOff": "Free (matrix disabled)",
    "app.pin.freeI2c": "Free (external I2C)",
    "app.pin.onboardLed": "On-board {b}",
    "app.pin.onboardBtn": "On-board {b}",
    "app.pin.power": "Power",
    "app.pin.gnd": "Ground",
    "app.pin.usable": "usable pins",
    "app.pin.assigned": "assigned",
    "app.pin.left": "still free",
    "app.pin.centralNote": "The central board has no peripherals, so all its pins are free; its on-board LED matrix can show the connection status and the current round.",
    "app.pin.legendBusy": "Used on-board",
    "app.pin.clickAny": "Click any pin.",
    "app.pin.now": "Current use: {use}",
    "app.pin.builtin": "On-board function: {b}",

    "app.updates.all": "All updates",
    "app.updates.search": "Search titles and text…",
    "app.updates.allAreas": "All categories",
    "app.updates.none": "No updates yet.",
    "app.updates.noMatch": "No matching updates.",
    "app.composer.title": "Write an update",
    "app.composer.hint": "Fill it in, copy it and paste it into updates.json on GitHub",
    "app.composer.date": "Date",
    "app.composer.author": "Author",
    "app.composer.area": "Category",
    "app.composer.areaPh": "e.g. Wireless, Display, Hardware",
    "app.composer.titleLbl": "Title (Chinese)",
    "app.composer.titlePh": "One sentence on what was done",
    "app.composer.bodyLbl": "Details (Chinese)",
    "app.composer.bodyPh": "Details, problems you ran into, next steps",
    "app.composer.titleEnLbl": "Title in English (optional)",
    "app.composer.titleEnPh": "Shown in the English interface",
    "app.composer.bodyEnLbl": "Details in English (optional)",
    "app.composer.bodyEnPh": "If left empty, the English interface shows the Chinese details",
    "app.composer.preview": "Preview",
    "app.composer.copy": "Copy",
    "app.composer.edit": "Edit updates.json on GitHub ↗",
    "app.composer.howto": "Paste it right after the <code>[</code> on the first line of the file, then click Commit changes. The site updates in about a minute. You need to be added as a collaborator on the repository first.",
    "app.composer.defaultArea": "Other",
    "app.composer.phTitle": "(title)",
    "app.composer.phBody": "(details)",
    "app.footer": "Pocket Rivals · CE346 Fall 2026 · Harvey Lu, Binqi Liu, Yihao Tao. Data comes from <code>status.json</code>, <code>updates.json</code> and <code>pins.json</code> in this repository; guestbook entries come from this repository's Issues.",
  },
});

const tr = I18N.t;  // tr(key, vars): interface string in the current language
const L = I18N.L;   // L(obj, field): data field, English from obj.en when there is one
const trn = (key, n, vars) => tr(n === 1 ? key + ".one" : key, {n, ...vars});

document.title = tr("app.title");
document.querySelector('meta[name="description"]')?.setAttribute("content", tr("app.description"));

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));

// localStorage can be unavailable (private mode, blocked storage)
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

// Week 1 starts Monday Sep 21, 2026, so week 12 starts on demo day (Dec 7)
const WEEK1 = new Date(2026, 8, 21);
const DEMO = new Date(2026, 11, 7);
const DAY = 864e5;
const WEEKS = [4, 5, 6, 7, 8, 9, 10, 11, 12];
const currentWeek = Math.floor((Date.now() - WEEK1) / (7 * DAY)) + 1;

const taskStatus = s => tr("app.task." + s);
const PART_STATUS = ["have", "arrived", "ordered", "buy", "choosing", "later"];
const PART_GROUPS = [
  {key: "in",    color: "var(--done)",   match: ["have", "arrived"]},
  {key: "order", color: "var(--accent)", match: ["ordered"]},
  {key: "need",  color: "var(--doing)",  match: ["buy", "choosing"]},
  {key: "later", color: "var(--todo)",   match: ["later"]},
].map(g => ({...g, label: tr("app.partGroup." + g.key)}));
const PIN_PARTS = {
  tft:   {color: "var(--c-tft)"},
  audio: {color: "var(--c-audio)"},
  joy:   {color: "var(--c-joy)"},
  btn:   {color: "var(--c-btn)"},
  fsr:   {color: "var(--c-fsr)"},
};
for (const [k, p] of Object.entries(PIN_PARTS)) p.name = tr("app.pinPart." + k);

// Update categories: data keeps whatever was typed (usually Chinese); known
// ones show in the current language whichever language they were typed in
const AREAS = {"无线": "Wireless", "网站": "Website", "玩法": "Gameplay", "硬件": "Hardware",
               "显示": "Display", "音效": "Audio", "规划": "Planning", "其他": "Other"};
const AREA_BY_EN = Object.fromEntries(Object.entries(AREAS).map(([zh, en]) => [en.toLowerCase(), zh]));
const areaKey = a => { const s = String(a ?? "").trim(); return AREA_BY_EN[s.toLowerCase()] || s; };
const areaName = a => { const k = areaKey(a); return I18N.lang === "en" ? (AREAS[k] || String(a ?? "").trim()) : k; };
const areaEn = a => AREAS[areaKey(a)] || String(a ?? "").trim();
const updateArea = u => areaName(L(u, "area"));

const state = {
  member: store.get("pr.member") || "",
  archView: store.get("pr.archView") === "sw" ? "sw" : "hw",
  group: "",
  onlyNow: false,
  partFilter: "",
  board: "player",
  noMatrix: false,
  selPin: null,
  area: "",
  query: "",
};
let D = null;  // loaded data

const memberColor = id => `var(--m-${id && id !== "all" ? id : "all"})`;
const memberName = id => (id && D.status.members[id]) ? D.status.members[id].short : tr("app.everyone");
const ownerFull = id => id === "all" ? tr("app.everyone") : D.status.members[id].name;
const ownerMatch = owner => !state.member || owner === state.member || owner === "all";

function weekStart(w) { return new Date(WEEK1.getTime() + (w - 1) * 7 * DAY); }
function md(d) { return `${d.getMonth() + 1}/${d.getDate()}`; }

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 1800);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
  }
  toast(tr("app.copied"));
}

/* ---------------- tabs ---------------- */

const TABS = ["overview", "timeline", "hardware", "battle", "updates", "reviews"];

function showTab(name) {
  if (!TABS.includes(name)) name = "overview";
  $$(".panel").forEach(p => p.hidden = p.dataset.panel !== name);
  $$(".tab[data-tab]").forEach(t => t.setAttribute("aria-selected", t.dataset.tab === name));
  window.currentTab = name;
  if (location.hash.slice(1) !== name) history.replaceState(null, "", "#" + name);
}

$$(".tab[data-tab]").forEach(t => t.addEventListener("click", () => { showTab(t.dataset.tab); window.scrollTo({top: 0}); }));

// Links to the handheld simulator keep a ?lang= from the URL (used when storage is blocked)
{
  const lang = new URLSearchParams(location.search).get("lang");
  if (lang) $$("[data-sim-link]").forEach(a => { a.href = "device.html?lang=" + encodeURIComponent(lang); });
}
document.addEventListener("click", e => {
  const g = e.target.closest("[data-goto]");
  if (g) { e.preventDefault(); showTab(g.dataset.goto); window.scrollTo({top: 0}); }
});
window.addEventListener("hashchange", () => showTab(location.hash.slice(1)));
showTab(location.hash.slice(1));

/* ---------------- countdown ---------------- */

function tickCountdown() {
  let ms = Math.max(0, DEMO - Date.now());
  const d = Math.floor(ms / DAY); ms -= d * DAY;
  const h = Math.floor(ms / 36e5); ms -= h * 36e5;
  const m = Math.floor(ms / 6e4); ms -= m * 6e4;
  const s = Math.floor(ms / 1e3);
  $("#cd-d").textContent = d;
  $("#cd-h").textContent = String(h).padStart(2, "0");
  $("#cd-m").textContent = String(m).padStart(2, "0");
  $("#cd-s").textContent = String(s).padStart(2, "0");
}
tickCountdown();
setInterval(tickCountdown, 1000);

/* ---------------- member filter ---------------- */

function renderWho() {
  const opts = [["", tr("app.all")], ...Object.entries(D.status.members).map(([id, m]) => [id, m.short])];
  $("#who").innerHTML = `<span>${esc(tr("app.who.label"))}</span>` + opts.map(([id, label]) =>
    `<button class="chip" data-member="${id}" aria-pressed="${state.member === id}">` +
    (id ? `<span class="dot" style="--c:${memberColor(id)}"></span>` : "") + `${esc(label)}</button>`
  ).join("");
}

function setMember(id) {
  state.member = state.member === id ? "" : id;
  store.set("pr.member", state.member);
  renderAll();
}

document.addEventListener("click", e => {
  const c = e.target.closest("[data-member]");
  if (c) setMember(c.dataset.member);
});

/* ---------------- overview ---------------- */

function taskProgress(tasks) {
  const weight = {done: 1, doing: 0.5, todo: 0};
  const total = tasks.reduce((a, t) => a + t.span, 0);
  const got = tasks.reduce((a, t) => a + t.span * weight[t.status], 0);
  return total ? Math.round(got / total * 100) : 0;
}

function renderStats() {
  const mine = D.status.tasks.filter(t => !state.member || t.owner === state.member);
  const pct = taskProgress(mine);
  const active = mine.filter(t => t.status === "doing").length;
  const parts = D.status.parts.filter(p => ownerMatch(p.owner));
  const inHand = parts.filter(p => ["have", "arrived"].includes(p.status)).length;
  const who = state.member ? memberName(state.member) : "";
  const label = key => who ? tr(key + "Of", {who}) : tr(key);
  const weekTxt = currentWeek < 1 ? tr("app.stats.notStarted") : currentWeek > 12 ? tr("app.stats.ended") : tr("app.task.week", {w: currentWeek});
  const ws = weekStart(Math.min(Math.max(currentWeek, 1), 12));
  const toBuy = parts.filter(p => ["buy", "choosing"].includes(p.status)).length;

  $("#stats").innerHTML = `
    <div class="card stat"><div class="k">${esc(tr("app.stats.current"))}</div><div class="v">${esc(weekTxt)}</div>
      <div class="s">${md(ws)} – ${md(new Date(ws.getTime() + 6 * DAY))}</div></div>
    <div class="card stat"><div class="k">${esc(label("app.stats.progress"))}</div><div class="v">${pct}%</div>
      <div class="meter"><i style="width:${pct}%;background:var(--done)"></i></div></div>
    <div class="card stat"><div class="k">${esc(label("app.stats.active"))}</div><div class="v">${active}</div>
      <div class="s">${esc(trn("app.stats.total", mine.length))}</div></div>
    <div class="card stat"><div class="k">${esc(tr("app.stats.parts"))}</div><div class="v">${inHand}<span class="muted" style="font-size:16px"> / ${parts.length}</span></div>
      <div class="s">${esc(tr("app.stats.toBuy", {n: toBuy}))}</div></div>`;
}

const STATUS_MARK = {done: "✓", doing: "…", todo: "○"};

function renderArchSoftware() {
  const sw = D.status.software;
  const comp = (c, sec) => {
    const dim = state.member && c.owner !== state.member && c.owner !== "all";
    return `<button class="comp st-${c.status}${dim ? " dim" : ""}" data-comp="sw-${sec}:${c.id}">
      <span class="dot" style="--c:${memberColor(c.owner)}"></span>${esc(L(c, "name"))}<span class="if">${STATUS_MARK[c.status] || ""}</span></button>`;
  };
  const board = (sec, title, sub, cls = "") => `<div class="board ${cls}"><h4>${esc(tr(title))}</h4><div class="sub">${esc(tr(sub))}</div>
    <div class="comps">${sw[sec].map(c => comp(c, sec)).join("")}</div></div>`;
  const link = `<div class="link"><span class="packet"></span><span class="packet back"></span></div>`;
  $("#arch").innerHTML = board("player", "app.board.playerFw", "app.board.playerFwSub") + link +
    board("central", "app.board.centralFw", "app.board.centralFwSub", "central") +
    board("shared", "app.board.shared", "app.board.sharedSub", "shared");
}

const KIND_ORDER = ["sensor", "actuator", "comms", "other"];
function renderArch() {
  $$("#arch-view [data-view]").forEach(b => b.setAttribute("aria-pressed", b.dataset.view === state.archView));
  $("#arch").classList.toggle("sw", state.archView === "sw");
  $("#arch-detail").innerHTML = `<span class="muted">${esc(tr(state.archView === "sw" ? "app.arch.introSw" : "app.overview.archIntro"))}</span>`;
  if (state.archView === "sw") return renderArchSoftware();
  const comp = (c, board) => {
    const dim = state.member && c.owner !== state.member && c.owner !== "all";
    return `<button class="comp${dim ? " dim" : ""}${c.planned ? " planned" : ""}" data-comp="${board}:${c.id}">
      <span class="dot" style="--c:${memberColor(c.owner)}"></span>${esc(L(c, "name"))}<span class="if">${esc(c.iface)}</span></button>`;
  };
  // grouped by kind: sensors (input), actuators (output), then the rest
  const comps = (list, board) => KIND_ORDER.map(k => {
    const items = list.filter(c => (c.kind || "other") === k);
    return items.length ? `<div class="kind kind-${k}"><div class="kind-h">${esc(tr("app.kind." + k))}</div>
      <div class="comps">${items.map(c => comp(c, board)).join("")}</div></div>` : "";
  }).join("");
  const player = n => `<div class="board"><h4>${esc(tr("app.board.playerN", {n}))}</h4><div class="sub">${esc(tr("app.board.playerSub"))}</div>
    ${comps(D.status.components.player, "player")}</div>`;
  const link = `<div class="link"><span class="packet"></span><span class="packet back"></span></div>`;
  $("#arch").innerHTML = player(1) + link +
    `<div class="board central"><h4>${esc(tr("app.board.central"))}</h4><div class="sub">${esc(tr("app.board.centralSub"))}</div>
      ${comps(D.status.components.central, "central")}</div>` +
    link + player(2);
}

$("#arch").addEventListener("click", e => {
  const b = e.target.closest("[data-comp]");
  if (!b) return;
  const [board, id] = b.dataset.comp.split(":");
  const sw = board.startsWith("sw-");
  const c = sw ? D.status.software[board.slice(3)].find(x => x.id === id) : D.status.components[board].find(x => x.id === id);
  $$(".comp").forEach(x => x.classList.toggle("sel", x.dataset.comp === b.dataset.comp));
  const tag = sw ? `<span class="tag mono">${esc(c.file)}</span><span class="tag">${esc(tr("app.task." + c.status))}</span>`
    : `<span class="tag">${esc(tr("app.kind." + (c.kind || "other")))}</span><span class="tag">${esc(c.iface)}</span>${c.planned ? `<span class="tag">${esc(tr("app.kind.planned"))}</span>` : ""}`;
  $("#arch-detail").innerHTML = `<b>${esc(L(c, "name"))}</b>${tag}
    <span class="muted" style="margin-left:8px">${esc(tr("app.owner", {name: ownerFull(c.owner)}))}</span>
    <div style="margin-top:6px">${esc(L(c, "detail"))}</div>`;
});

$("#arch-view").addEventListener("click", e => {
  const b = e.target.closest("[data-view]");
  if (!b || b.dataset.view === state.archView) return;
  state.archView = b.dataset.view;
  store.set("pr.archView", state.archView);
  renderArch();
});

function renderTeam() {
  $("#team").innerHTML = Object.entries(D.status.members).map(([id, m]) => {
    const ts = D.status.tasks.filter(t => t.owner === id);
    const doing = ts.filter(t => t.status === "doing").length;
    return `<button class="card member${state.member === id ? " sel" : ""}" data-member="${id}" style="--c:${memberColor(id)}">
      <h3><span class="dot"></span>${esc(m.name)}</h3>
      <div class="role">${esc(L(m, "role"))}</div>
      <p>${esc(L(m, "duties"))}</p>
      <div class="count">${esc(trn("app.team.count", ts.length, {doing, pct: taskProgress(ts)}))}</div>
    </button>`;
  }).join("");
}

function updateCard(u) {
  return `<div class="update" style="--c:${memberColor(u.author)}">
    <div class="meta"><span>${esc(u.date)}</span><span>·</span><span>${esc(memberName(u.author))}</span><span class="tag">${esc(updateArea(u))}</span></div>
    <h3>${esc(L(u, "title"))}</h3><p>${esc(L(u, "body"))}</p></div>`;
}

function memberUpdates() {
  return D.updates.filter(u => !state.member || u.author === state.member || u.author === "all");
}

function renderLatest() {
  const list = memberUpdates().slice(0, 3);
  $("#latest").innerHTML = list.length ? list.map(updateCard).join("") : `<div class="empty">${esc(tr("app.updates.none"))}</div>`;
}

/* ---------------- timeline ---------------- */

function visibleTasks() {
  return D.status.tasks.filter(t =>
    ownerMatch(t.owner) &&
    (!state.group || t.group === state.group) &&
    (!state.onlyNow || (t.status === "doing" && currentWeek >= t.week && currentWeek < t.week + t.span)));
}

function renderGantt() {
  const nowCls = w => w === currentWeek ? "now" : "";
  let html = `<tr><th class="task">${esc(tr("app.gantt.task"))}</th><th>${esc(tr("app.gantt.owner"))}</th>` +
    WEEKS.map(w => `<th class="${nowCls(w)}">W${w}</th>`).join("") + "</tr>";
  const tasks = visibleTasks();
  let lastGroup = null;
  tasks.forEach(t => {
    if (t.group !== lastGroup) {
      html += `<tr class="grp"><td colspan="${WEEKS.length + 2}">${esc(L(t, "group"))}</td></tr>`;
      lastGroup = t.group;
    }
    const idx = D.status.tasks.indexOf(t);
    html += `<tr class="t" data-task="${idx}"><td class="task">${esc(L(t, "name"))}</td>
      <td class="owner"><span class="dot" style="--c:${memberColor(t.owner)}"></span> ${esc(memberName(t.owner))}</td>` +
      WEEKS.map(w => {
        const on = w >= t.week && w < t.week + t.span;
        return `<td class="${nowCls(w)}">${on ? `<div class="bar ${t.status}" title="${esc(taskStatus(t.status))}"></div>` : ""}</td>`;
      }).join("") + "</tr>";
  });
  if (!tasks.length) html += `<tr><td colspan="${WEEKS.length + 2}" class="empty">${esc(tr("app.gantt.empty"))}</td></tr>`;
  $("#gantt").innerHTML = html;
}

$("#gantt").addEventListener("click", e => {
  const r = e.target.closest("tr[data-task]");
  if (!r) return;
  const t = D.status.tasks[+r.dataset.task];
  $$("#gantt tr.t").forEach(x => x.classList.toggle("sel", x === r));
  const end = t.week + t.span - 1;
  const range = `${md(weekStart(t.week))} – ${md(new Date(weekStart(end).getTime() + 6 * DAY))}`;
  const weeks = t.span > 1 ? tr("app.task.weeks", {w: t.week, end}) : tr("app.task.week", {w: t.week});
  $("#task-detail").innerHTML = `<b>${esc(L(t, "name"))}</b><span class="tag">${esc(taskStatus(t.status))}</span>
    <div class="muted" style="font-size:13px;margin-top:4px">
      ${esc(tr("app.task.meta", {group: L(t, "group"), weeks, range, owner: ownerFull(t.owner)}))}</div>
    <div style="margin-top:6px">${esc(L(t, "desc"))}</div>`;
});

$("#grp-seg").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  state.group = b.dataset.g;
  $$("#grp-seg button").forEach(x => x.setAttribute("aria-pressed", x === b));
  renderGantt();
});
$("#only-now").addEventListener("change", e => { state.onlyNow = e.target.checked; renderGantt(); });

/* ---------------- hardware ---------------- */

function renderParts() {
  const parts = D.status.parts.filter(p => ownerMatch(p.owner));
  const counts = PART_GROUPS.map(g => parts.filter(p => g.match.includes(p.status)).length);

  $("#part-meter").innerHTML = PART_GROUPS.map((g, i) =>
    `<i style="width:${parts.length ? counts[i] / parts.length * 100 : 0}%;background:${g.color}"></i>`).join("");
  $("#part-legend").innerHTML = PART_GROUPS.map((g, i) => `<span style="--c:${g.color}">${esc(g.label)} ${counts[i]}</span>`).join("");
  $("#part-filter").innerHTML = [["", tr("app.all")], ...PART_GROUPS.map(g => [g.key, g.label])].map(([k, l]) =>
    `<button class="chip" data-pf="${k}" aria-pressed="${state.partFilter === k}">${esc(l)}</button>`).join("");

  const group = PART_GROUPS.find(g => g.key === state.partFilter);
  const shown = parts.filter(p => !group || group.match.includes(p.status));
  $("#parts").innerHTML = shown.length ? shown.map(p => `<li>
      <span class="nm">${esc(L(p, "name"))} <span class="muted" style="font-weight:400">× ${p.qty}</span>
        ${p.iface !== "—" ? `<span class="tag">${esc(p.iface)}</span>` : ""}</span>
      <span class="st ${p.status}">${esc(PART_STATUS.includes(p.status) ? tr("app.part." + p.status) : p.status)}</span>
      <span class="md">${esc(L(p, "model"))} · ${esc(L(p, "use"))} · <span class="dot" style="--c:${memberColor(p.owner)}"></span> ${esc(memberName(p.owner))}</span>
    </li>`).join("") : `<li class="empty">${esc(tr("app.parts.empty"))}</li>`;
}

$("#part-filter").addEventListener("click", e => {
  const b = e.target.closest("[data-pf]");
  if (b) { state.partFilter = b.dataset.pf; renderParts(); }
});

// kind/part come from the Chinese fields; the text shown is in the current language
function pinInfo(p) {
  const a = state.board === "player" ? p.player : null;
  if (a) return {kind: "used", use: L(a, "use"), part: a.part};
  const b = p.builtin || "";
  const shown = L(p, "builtin") || b;
  if (b.startsWith("LED")) return state.noMatrix ? {kind: "free", use: tr("app.pin.freeMatrixOff")} : {kind: "busy", use: tr("app.pin.onboardLed", {b: shown})};
  if (b.startsWith("按钮")) return {kind: "busy", use: tr("app.pin.onboardBtn", {b: shown})};
  if (b.startsWith("Qwiic")) return {kind: "free", use: tr("app.pin.freeI2c")};
  return {kind: "free", use: tr("app.pin.free")};
}

function renderPins() {
  const list = D.pins.pins;
  let used = 0, free = 0;
  $("#pins").innerHTML = list.map(p => {
    const i = pinInfo(p);
    if (i.kind === "used") used++;
    if (i.kind === "free") free++;
    const color = i.part ? PIN_PARTS[i.part].color : "";
    const dim = state.member && i.part && D.status.components.player.find(c => c.id === i.part)?.owner !== state.member;
    const warn = L(p, "warn");
    return `<button class="pin ${i.kind}${state.selPin === p.pin ? " sel" : ""}" data-pin="${p.pin}"
        style="${color ? `--c:${color};` : ""}${dim ? "opacity:.35" : ""}">
      ${warn && i.kind !== "busy" ? `<span class="warn" title="${esc(warn)}">⚠</span>` : ""}
      <div class="p">${p.pin}</div><div class="u">${esc(i.use)}</div></button>`;
  }).join("") +
    `<div class="pin power"><div class="p">3V</div><div class="u">${esc(tr("app.pin.power"))}</div></div>` +
    `<div class="pin power"><div class="p">GND</div><div class="u">${esc(tr("app.pin.gnd"))}</div></div>`;

  $("#pin-summary").innerHTML = `<span><b>${used + free}</b>${esc(tr("app.pin.usable"))}</span><span><b style="color:var(--accent)">${used}</b>${esc(tr("app.pin.assigned"))}</span>
    <span><b style="color:${free ? "var(--done)" : "var(--danger)"}">${free}</b>${esc(tr("app.pin.left"))}</span>`;
  $("#pin-note").textContent = state.board === "player" ? L(D.pins, "note") : tr("app.pin.centralNote");
  $("#pin-legend").innerHTML = Object.values(PIN_PARTS).map(p => `<span style="--c:${p.color}">${esc(p.name)}</span>`).join("") +
    `<span style="--c:var(--surface-2)">${esc(tr("app.pin.legendBusy"))}</span><span style="--c:transparent;outline:1px dashed var(--muted)">${esc(tr("app.pin.free"))}</span>`;
  $("#pin-extra").innerHTML = state.board === "player" ? L(D.pins, "extra").map(x => `<li>${esc(x)}</li>`).join("") : "";
  renderPinDetail();
}

function renderPinDetail() {
  const p = D.pins.pins.find(x => x.pin === state.selPin);
  if (!p) { $("#pin-detail").innerHTML = `<span class="muted">${esc(tr("app.pin.clickAny"))}</span>`; return; }
  const i = pinInfo(p);
  const warn = L(p, "warn");
  $("#pin-detail").innerHTML = `<b>${p.pin}</b><span class="muted mono">${p.nrf}</span>
    <div style="margin-top:6px">${p.caps.map(c => `<span class="tag" style="margin-right:4px">${esc(c)}</span>`).join("")}</div>
    <div style="margin-top:6px">${esc(tr("app.pin.now", {use: i.use}))}</div>
    ${p.builtin ? `<div class="muted" style="font-size:13px">${esc(tr("app.pin.builtin", {b: L(p, "builtin")}))}</div>` : ""}
    ${warn ? `<div style="font-size:13px;color:var(--doing);margin-top:4px">⚠ ${esc(warn)}</div>` : ""}`;
}

$("#pins").addEventListener("click", e => {
  const b = e.target.closest("[data-pin]");
  if (!b) return;
  state.selPin = b.dataset.pin;
  renderPins();
});
$("#board-seg").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  state.board = b.dataset.b;
  $$("#board-seg button").forEach(x => x.setAttribute("aria-pressed", x === b));
  renderPins();
});
$("#no-matrix").addEventListener("change", e => { state.noMatrix = e.target.checked; renderPins(); });

/* ---------------- updates ---------------- */

// category key -> label, in order of first appearance, plus the known categories
function areaLabels() {
  const labels = new Map();
  D.updates.forEach(u => { const k = areaKey(u.area); if (!labels.has(k)) labels.set(k, updateArea(u)); });
  return labels;
}

function renderUpdates() {
  const labels = areaLabels();
  $("#area-filter").innerHTML = [["", tr("app.updates.allAreas")], ...labels].map(([k, l]) =>
    `<button class="chip" data-area="${esc(k)}" aria-pressed="${state.area === k}">${esc(l)}</button>`).join("");
  const suggest = new Set(labels.values());
  Object.keys(AREAS).forEach(k => suggest.add(areaName(k)));
  $("#areas").innerHTML = [...suggest].map(a => `<option value="${esc(a)}">`).join("");

  // search the text shown plus the Chinese original, so either language finds it
  const q = state.query.trim().toLowerCase();
  const list = memberUpdates().filter(u =>
    (!state.area || areaKey(u.area) === state.area) &&
    (!q || [u.title, u.body, u.area, L(u, "title"), L(u, "body"), updateArea(u)].join(" ").toLowerCase().includes(q)));
  $("#update-list").innerHTML = list.length ? list.map(updateCard).join("") : `<div class="empty">${esc(tr("app.updates.noMatch"))}</div>`;
}

$("#area-filter").addEventListener("click", e => {
  const b = e.target.closest("[data-area]");
  if (b) { state.area = b.dataset.area; renderUpdates(); }
});
$("#search").addEventListener("input", e => { state.query = e.target.value; renderUpdates(); });

function initComposer() {
  const f = $("#composer");
  const today = new Date();
  f.date.value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  f.author.innerHTML = Object.entries(D.status.members).map(([id, m]) => `<option value="${id}">${esc(m.name)}</option>`).join("") +
    `<option value="all">${esc(tr("app.everyone"))}</option>`;
  const saved = store.get("pr.author");
  if (saved) f.author.value = saved;

  // Chinese goes in the main fields; "en" is added only when an English title
  // or body is filled in. If only English is given it also fills the main field.
  const update = () => {
    const titleEn = f.titleEn.value.trim(), bodyEn = f.bodyEn.value.trim();
    const area = f.area.value.trim() || tr("app.composer.defaultArea");
    const u = {date: f.date.value, author: f.author.value, area,
               title: f.title.value.trim() || titleEn || tr("app.composer.phTitle"),
               body: f.body.value.trim() || bodyEn || tr("app.composer.phBody")};
    if (titleEn || bodyEn) {
      u.en = {area: areaEn(area)};
      if (titleEn) u.en.title = titleEn;
      if (bodyEn) u.en.body = bodyEn;
    }
    store.set("pr.author", u.author);
    $("#compose-preview").innerHTML = updateCard(u);
    const json = JSON.stringify(u, null, 2).split("\n").map(l => "  " + l).join("\n") + ",";
    $("#compose-json").textContent = json;
  };
  f.addEventListener("input", update);
  update();
  // Keep what's typed when the language is switched (the page reloads)
  I18N.keepDraft("composer", () => I18N.formValues(f), v => I18N.fillForm(f, v));
  $("#copy-json").addEventListener("click", () => copyText($("#compose-json").textContent));
}

/* ---------------- boot ---------------- */

function renderAll() {
  renderWho();
  renderStats();
  renderArch();
  renderTeam();
  renderLatest();
  renderGantt();
  renderParts();
  renderPins();
  renderUpdates();
}

const load = f => fetch(f, {cache: "no-store"}).then(r => { if (!r.ok) throw new Error(f); return r.json(); });

Promise.all([load("status.json"), load("updates.json"), load("pins.json")])
  .then(([status, updates, pins]) => {
    D = {status, updates, pins};
    renderAll();
    initComposer();
  })
  .catch(err => {
    $("main").insertAdjacentHTML("afterbegin", `<div class="card" style="border-color:var(--danger)">${esc(tr("app.loadFailed", {msg: err.message}))}</div>`);
  });

window.PR = {toast, copyText, store};
