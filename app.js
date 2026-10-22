// Pocket Rivals progress site: tabs, member filter, timeline, hardware (drivers, parts, pins)

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
    "app.tab.battle": "玩法原型", "app.tab.reviews": "留言",
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

    "app.drv.title": "驱动程序（我们自己写）",
    "app.drv.intro": "这是微控制器课程，下面这些外设驱动由我们自己动手写。游戏逻辑、画面和模拟器都用同一套接口，每个驱动写好就能直接接上。",
    "app.drv.col.name": "驱动", "app.drv.col.iface": "外设与接口", "app.drv.col.pins": "引脚", "app.drv.col.use": "用在哪",
    "app.drv.col.owner": "负责人", "app.drv.col.status": "状态", "app.drv.col.verify": "怎么验证",
    "app.drv.board.player": "玩家板", "app.drv.board.both": "玩家板和中央板共用", "app.drv.board.central": "中央板",
    "app.drv.tbd": "待定",
    "app.drv.st.todo": "待写", "app.drv.st.doing": "在写", "app.drv.st.done": "已完成",
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
    "app.pin.clickAny3d": "把鼠标移到上面的 pin、线或模块上（手机上点一下），这里显示它的用途。",

    "p3d.loading": "正在加载 3D 视图…",
    "p3d.failed": "图加载失败，请看下面的 pin 表。",
    "p3d.hint3d": "拖动旋转 · 滚轮 / 双指缩放 · 悬停或点按 pin、线、模块看用途",
    "p3d.hint2d": "平面图 · 悬停或点按 pin、线、模块看用途",
    "p3d.reset": "重置视角",
    "p3d.aria": "micro:bit V2 边缘连接器的 pin 分配示意图",
    "p3d.kind.sensor": "传感器", "p3d.kind.actuator": "执行器", "p3d.kind.comms": "通讯", "p3d.kind.other": "其它",
    "p3d.back": "背面",
    "p3d.matrix": "板载 LED 点阵",
    "p3d.matrixBusy": "占用 {pins}",
    "p3d.matrixOff": "已停用 · 空出 {pins}",
    "p3d.mic": "麦克风",
    "p3d.logo": "触摸 logo",
    "p3d.internalI2c": "内部 I2C",
    "p3d.chain": "I2C · Qwiic 串接（{pins}）",
    "p3d.legend.used": "已分配（颜色 = 部件）",
    "p3d.legend.busy": "板载占用",
    "p3d.legend.free": "空闲",
    "p3d.legend.power": "电源 3V / GND",
    "p3d.legend.planned": "计划中",
    "p3d.legend.nfc": "NFC 引脚，要改配置",
    "p3d.pins": "引脚：",
    "p3d.noPins": "不占边缘引脚",
    "p3d.matrixOnDetail": "5×5 点阵用 {pins} 扫描各列（行在板内）。玩家板用 TFT 显示，打开上面的「停用板载 LED 点阵」就能空出这些 pin。",
    "p3d.matrixOffDetail": "点阵已停用，{pins} 空出来，可以接别的外设。",
    "p3d.viaChain": "通过 {name} 的 Qwiic 线共用 {pins}",

    "app.footer": "Pocket Rivals · CE346 Fall 2026 · Harvey Lu、Binqi Liu、Yihao Tao。 数据来自本仓库的 <code>status.json</code>、<code>pins.json</code>，留言来自本仓库的 Issues。",
  },
  en: {
    "app.title": "Pocket Rivals Project Progress",
    "app.description": "CE346 Pocket Rivals: a wireless two-player battle game built on the micro:bit V2. Project progress and team roles.",
    "app.hero.tagline": "A wireless two-player turn-based battle game built on the micro:bit V2",
    "app.cd.d": "days", "app.cd.h": "hrs", "app.cd.m": "min", "app.cd.s": "sec",
    "app.cd.cap": "until the final demo (Dec 7)",
    "app.tab.overview": "Overview", "app.tab.timeline": "Timeline", "app.tab.hardware": "Hardware & pins",
    "app.tab.battle": "Battle prototype", "app.tab.reviews": "Guestbook",
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

    "app.drv.title": "Drivers (written by us)",
    "app.drv.intro": "This is a microcontroller course, so we write these peripheral drivers by hand. The game logic, screens and simulator all use the same interfaces, so each driver plugs in as soon as it's done.",
    "app.drv.col.name": "Driver", "app.drv.col.iface": "Peripheral & interface", "app.drv.col.pins": "Pins", "app.drv.col.use": "Used for",
    "app.drv.col.owner": "Owner", "app.drv.col.status": "Status", "app.drv.col.verify": "How we test it",
    "app.drv.board.player": "Player board", "app.drv.board.both": "Player and central boards", "app.drv.board.central": "Central board",
    "app.drv.tbd": "TBD",
    "app.drv.st.todo": "To do", "app.drv.st.doing": "In progress", "app.drv.st.done": "Done",
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
    "app.pin.clickAny3d": "Hover over a pin, wire or module above (tap on a phone) to see what it does.",

    "p3d.loading": "Loading the 3D view…",
    "p3d.failed": "The diagram couldn't load; see the pin table below.",
    "p3d.hint3d": "Drag to rotate · scroll or pinch to zoom · hover or tap a pin, wire or module for details",
    "p3d.hint2d": "Flat view · hover or tap a pin, wire or module for details",
    "p3d.reset": "Reset view",
    "p3d.aria": "Pin assignment diagram of the micro:bit V2 edge connector",
    "p3d.kind.sensor": "Sensor", "p3d.kind.actuator": "Actuator", "p3d.kind.comms": "Comms", "p3d.kind.other": "Other",
    "p3d.back": "back",
    "p3d.matrix": "On-board LED matrix",
    "p3d.matrixBusy": "uses {pins}",
    "p3d.matrixOff": "disabled · frees {pins}",
    "p3d.mic": "Microphone",
    "p3d.logo": "Touch logo",
    "p3d.internalI2c": "internal I2C",
    "p3d.chain": "I2C · chained over Qwiic ({pins})",
    "p3d.legend.used": "Assigned (colour = part)",
    "p3d.legend.busy": "Used on-board",
    "p3d.legend.free": "Free",
    "p3d.legend.power": "Power 3V / GND",
    "p3d.legend.planned": "Planned",
    "p3d.legend.nfc": "NFC pin, needs a config change",
    "p3d.pins": "Pins: ",
    "p3d.noPins": "No edge pins used",
    "p3d.matrixOnDetail": "The 5×5 matrix scans its columns on {pins} (the rows are on-board). Player boards display on the TFT, so turning on “Disable the on-board LED matrix” above frees these pins.",
    "p3d.matrixOffDetail": "The matrix is disabled, so {pins} are free for other parts.",
    "p3d.viaChain": "Shares {pins} over the {name}'s Qwiic cable",

    "app.footer": "Pocket Rivals · CE346 Fall 2026 · Harvey Lu, Binqi Liu, Yihao Tao. Data comes from <code>status.json</code> and <code>pins.json</code> in this repository; guestbook entries come from this repository's Issues.",
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

const state = {
  member: store.get("pr.member") || "",
  archView: store.get("pr.archView") === "sw" ? "sw" : "hw",
  group: "",
  onlyNow: false,
  partFilter: "",
  board: "player",
  noMatrix: false,
  selPin: null,
  sel: null,      // {pin} or {part}: what the pin map highlights and the detail box shows
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

const TABS = ["overview", "timeline", "hardware", "battle", "reviews"];

function showTab(name) {
  if (!TABS.includes(name)) name = "overview";
  $$(".panel").forEach(p => p.hidden = p.dataset.panel !== name);
  $$(".tab[data-tab]").forEach(t => t.setAttribute("aria-selected", t.dataset.tab === name));
  window.currentTab = name;
  if (location.hash.slice(1) !== name) history.replaceState(null, "", "#" + name);
  if (name === "hardware" && typeof startPinView === "function") startPinView();
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

const DRV_BOARDS = ["player", "both", "central"];
const DRV_COLS = ["name", "iface", "pins", "use", "owner", "status", "verify"];

function renderDrivers() {
  const list = D.status.drivers || [];
  let html = "<thead><tr>" + DRV_COLS.map(c => `<th>${esc(tr("app.drv.col." + c))}</th>`).join("") + "</tr></thead><tbody>";
  DRV_BOARDS.forEach(b => {
    const rows = list.filter(d => d.board === b);
    if (!rows.length) return;
    html += `<tr class="grp"><td colspan="${DRV_COLS.length}">${esc(tr("app.drv.board." + b))}</td></tr>`;
    rows.forEach(d => {
      const dim = state.member && d.owner !== state.member;
      const owner = d.owner && D.status.members[d.owner]
        ? `<span class="dot" style="--c:${memberColor(d.owner)}"></span>${esc(memberName(d.owner))}`
        : esc(tr("app.drv.tbd"));
      // data-l: column label, shown in front of the cell when the table stacks on a phone
      const lb = c => `data-l="${esc(tr("app.drv.col." + c))}"`;
      html += `<tr class="drv${d.plan ? " plan" : ""}${dim ? " dim" : ""}" data-drv="${esc(d.id)}" data-board="${b}" data-owner="${esc(d.owner)}">
        <td class="nm">${esc(L(d, "name"))}</td><td class="if" ${lb("iface")}>${esc(L(d, "iface"))}</td><td class="pn" ${lb("pins")}>${esc(L(d, "pins"))}</td>
        <td class="use" ${lb("use")}>${esc(L(d, "use"))}</td><td class="own">${owner}</td>
        <td class="stc"><span class="st ${esc(d.status)}">${esc(tr("app.drv.st." + d.status))}</span></td><td class="vf" ${lb("verify")}>${esc(L(d, "verify"))}</td></tr>`;
    });
  });
  $("#drivers").innerHTML = html + "</tbody>";
}

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
  const lit = selectedPins();
  $("#pins").innerHTML = list.map(p => {
    const i = pinInfo(p);
    if (i.kind === "used") used++;
    if (i.kind === "free") free++;
    const color = i.part ? PIN_PARTS[i.part].color : "";
    const dim = state.member && i.part && D.status.components.player.find(c => c.id === i.part)?.owner !== state.member;
    const warn = L(p, "warn");
    return `<button class="pin ${i.kind}${lit.includes(p.pin) ? " sel" : ""}" data-pin="${p.pin}"
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

// pins lit by the current selection (a part lights all of its pins)
function selectedPins() {
  if (state.sel?.part) return pinView.view?.info().lit?.pins || D.pins.pins.filter(p => pinInfo(p).part === state.sel.part).map(p => p.pin);
  return state.selPin ? [state.selPin] : [];
}

function renderPinDetail() {
  if (state.sel?.part) return renderPartDetail(state.sel.part);
  const p = D.pins.pins.find(x => x.pin === state.selPin);
  if (!p) { $("#pin-detail").innerHTML = `<span class="muted">${esc(tr(pinView.view ? "app.pin.clickAny3d" : "app.pin.clickAny"))}</span>`; return; }
  const i = pinInfo(p);
  const warn = L(p, "warn");
  $("#pin-detail").innerHTML = `<b>${p.pin}</b><span class="muted mono">${p.nrf}</span>
    <div style="margin-top:6px">${p.caps.map(c => `<span class="tag" style="margin-right:4px">${esc(c)}</span>`).join("")}</div>
    <div style="margin-top:6px">${esc(tr("app.pin.now", {use: i.use}))}</div>
    ${p.builtin ? `<div class="muted" style="font-size:13px">${esc(tr("app.pin.builtin", {b: L(p, "builtin")}))}</div>` : ""}
    ${warn ? `<div style="font-size:13px;color:var(--doing);margin-top:4px">⚠ ${esc(warn)}</div>` : ""}`;
}

// A part (module) in the detail box: what it is, which pins it uses, the notes
function renderPartDetail(id) {
  const info = pinView.view?.info();
  const pins = (info?.lit?.pins || []).map(pin => D.pins.pins.find(p => p.pin === pin)).filter(Boolean);
  const pinList = pins.length ? `<div style="margin-top:6px">${esc(tr("p3d.pins"))}${pins.map(p =>
    `<span class="tag" style="margin-right:4px">${esc(p.pin)} · ${esc(pinInfo(p).use)}</span>`).join("")}</div>` : "";
  if (id === "@matrix") {
    const ledPins = D.pins.pins.filter(p => (p.builtin || "").startsWith("LED")).map(p => p.pin).join(" ");
    $("#pin-detail").innerHTML = `<b>${esc(tr("p3d.matrix"))}</b><span class="tag">${esc(tr("app.kind.actuator"))}</span>
      <div class="muted" style="margin-top:6px;font-size:13px">${esc(tr(state.noMatrix ? "p3d.matrixOffDetail" : "p3d.matrixOnDetail", {pins: ledPins}))}</div>${pinList}`;
    return;
  }
  const c = (D.status.components[state.board] || []).find(x => x.id === id);
  if (!c) { $("#pin-detail").innerHTML = `<span class="muted">${esc(tr("app.pin.clickAny3d"))}</span>`; return; }
  const link = info?.links.find(l => l.part === id && l.pins.length);
  const via = link ? `<div style="margin-top:6px">${esc(tr("p3d.viaChain", {name: L(D.status.components[state.board].find(x => x.id === link.from), "name"), pins: link.pins.join(" / ")}))}</div>` : "";
  const none = !pins.length && !link ? `<div style="margin-top:6px" class="muted">${esc(tr("p3d.noPins"))}</div>` : "";
  $("#pin-detail").innerHTML = `<b>${esc(L(c, "name"))}</b><span class="tag">${esc(tr("app.kind." + (c.kind || "other")))}</span>
    <span class="tag">${esc(c.iface)}</span>${c.planned ? ` <span class="tag">${esc(tr("app.kind.planned"))}</span>` : ""}
    <span class="muted" style="margin-left:8px;font-size:13px">${esc(tr("app.owner", {name: ownerFull(c.owner)}))}</span>
    ${via || (pins.length ? pinList : none)}
    ${L(c, "detail") ? `<div class="muted" style="margin-top:6px;font-size:13px">${esc(L(c, "detail"))}</div>` : ""}`;
}

// One selection for the grid, the detail box and the pin map
function selectPin(sel) {
  state.sel = sel || null;
  state.selPin = sel?.pin || null;
  pinView.view?.setSel(state.sel);
  renderPins();
}

$("#pins").addEventListener("click", e => {
  const b = e.target.closest("[data-pin]");
  if (!b) return;
  selectPin({pin: b.dataset.pin});
});
$("#board-seg").addEventListener("click", e => {
  const b = e.target.closest("button");
  if (!b) return;
  state.board = b.dataset.b;
  $$("#board-seg button").forEach(x => x.setAttribute("aria-pressed", x === b));
  if (state.sel?.part) state.sel = null;   // parts differ between the boards
  pinView.view?.update();
  selectPin(state.sel);
});
$("#no-matrix").addEventListener("change", e => {
  state.noMatrix = e.target.checked;
  pinView.view?.update();
  selectPin(state.sel);
});

/* ---------------- pin map (3D, or 2D SVG fallback) ---------------- */

// Loaded the first time the hardware tab is shown. 3D needs WebGL and the
// vendored three.js; with reduced motion, no WebGL, or a failed load the same
// diagram is drawn as a flat SVG (pinmap-2d.js). ?pinmap=2d forces the SVG.
const pinView = {started: false, view: null, mode: "", ms: 0, reason: ""};

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch { return false; }
}

function startPinView() {
  if (!D || pinView.started || window.currentTab !== "hardware") return;
  pinView.started = true;
  const stage = $("#p3d-stage");
  const t0 = performance.now();
  const api = {D, state, pinInfo, tr, L, esc, select: selectPin};
  const forced2d = new URLSearchParams(location.search).get("pinmap") === "2d";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const want3d = !forced2d && !reduced && webglAvailable();
  pinView.reason = forced2d ? "forced" : reduced ? "reduced-motion" : want3d ? "" : "no-webgl";
  const mount2d = () => { stage.replaceChildren(); return import("./pinmap-2d.js").then(m => m.mount(stage, api)); };
  (want3d ? import("./pinmap-3d.js").then(m => { stage.querySelector(".p3d-loading")?.remove(); return m.mount(stage, api); }) : Promise.reject(null))
    .catch(err => {
      if (err) pinView.reason = "3d-failed: " + (err.message || err);
      return mount2d();
    })
    .then(view => {
      pinView.view = view;
      pinView.mode = view.mode;
      pinView.ms = Math.round(performance.now() - t0);
      $("#p3d").dataset.mode = view.mode;
      $("#p3d-hint").textContent = tr(view.mode === "3d" ? "p3d.hint3d" : "p3d.hint2d");
      $("#p3d-reset").hidden = view.mode !== "3d";
      view.setSel(state.sel);
      renderPins();
    })
    .catch(() => {
      stage.replaceChildren();
      stage.insertAdjacentHTML("beforeend", `<div class="p3d-loading">${esc(tr("p3d.failed"))}</div>`);
    });
}

$("#p3d-reset").addEventListener("click", () => pinView.view?.resetView());
$("#p3d-legend").innerHTML = [
  ["used", "background:linear-gradient(90deg,var(--c-tft),var(--c-audio),var(--c-joy),var(--c-btn),var(--c-fsr))"],
  ["busy", "background:#5d5a52"], ["free", "background:#a9a9ae"], ["power", "background:#d9ad45"],
  ["planned", "background:transparent;outline:1.5px dashed var(--muted);outline-offset:-1.5px"],
].map(([k, st]) => `<span><i style="${st}"></i>${esc(tr("p3d.legend." + k))}</span>`).join("") +
  `<span><i class="tri"></i>${esc(tr("p3d.legend.nfc"))}</span>` +
  `<span class="kindkey"><i style="box-shadow:inset 0 0 0 1.5px var(--muted)"></i>${esc(tr("p3d.kind.sensor"))}</span>` +
  `<span class="kindkey"><i style="background:var(--muted)"></i>${esc(tr("p3d.kind.actuator"))}</span>`;

/* ---------------- boot ---------------- */

function renderAll() {
  renderWho();
  renderStats();
  renderArch();
  renderTeam();
  renderGantt();
  renderDrivers();
  renderParts();
  renderPins();
}

const load = f => fetch(f, {cache: "no-store"}).then(r => { if (!r.ok) throw new Error(f); return r.json(); });

Promise.all([load("status.json"), load("pins.json")])
  .then(([status, pins]) => {
    D = {status, pins};
    // the language toggle reloads the page (i18n.js): keep the pin map's board,
    // LED-matrix switch and selection so it comes back exactly as it was
    I18N.keepDraft("pinmap", () => ({board: state.board, noMatrix: state.noMatrix, sel: state.sel}), v => {
      if (v.board === "player" || v.board === "central") state.board = v.board;
      state.noMatrix = !!v.noMatrix;
      state.sel = v.sel && (v.sel.pin || v.sel.part) ? v.sel : null;
      state.selPin = state.sel?.pin || null;
      $$("#board-seg button").forEach(x => x.setAttribute("aria-pressed", x.dataset.b === state.board));
      $("#no-matrix").checked = state.noMatrix;
    });
    renderAll();
    startPinView();
  })
  .catch(err => {
    $("main").insertAdjacentHTML("afterbegin", `<div class="card" style="border-color:var(--danger)">${esc(tr("app.loadFailed", {msg: err.message}))}</div>`);
  });

window.PR = {toast, copyText, store, pinView};
