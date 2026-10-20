// Pocket Rivals progress site: tabs, member filter, timeline, hardware, updates

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

const TASK_STATUS = {done: "已完成", doing: "进行中", todo: "计划中"};
const PART_STATUS = {have: "已有", arrived: "已到货", ordered: "已下单", buy: "待购买", choosing: "选型中", later: "后期再买"};
const PART_GROUPS = [
  {key: "in",    label: "已到手", color: "var(--done)",   match: ["have", "arrived"]},
  {key: "order", label: "已下单", color: "var(--accent)", match: ["ordered"]},
  {key: "need",  label: "待购买", color: "var(--doing)",  match: ["buy", "choosing"]},
  {key: "later", label: "后期",   color: "var(--todo)",   match: ["later"]},
];
const PIN_PARTS = {
  tft:   {name: "TFT 屏",    color: "var(--c-tft)"},
  audio: {name: "DFPlayer",  color: "var(--c-audio)"},
  joy:   {name: "摇杆",      color: "var(--c-joy)"},
  btn:   {name: "按钮",      color: "var(--c-btn)"},
  fsr:   {name: "压力传感器", color: "var(--c-fsr)"},
};

const state = {
  member: store.get("pr.member") || "",
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
const memberName = id => (id && D.status.members[id]) ? D.status.members[id].short : "全员";
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
  toast("已复制");
}

/* ---------------- tabs ---------------- */

const TABS = ["overview", "timeline", "hardware", "battle", "updates"];

function showTab(name) {
  if (!TABS.includes(name)) name = "overview";
  $$(".panel").forEach(p => p.hidden = p.dataset.panel !== name);
  $$(".tab").forEach(t => t.setAttribute("aria-selected", t.dataset.tab === name));
  window.currentTab = name;
  if (location.hash.slice(1) !== name) history.replaceState(null, "", "#" + name);
}

$$(".tab").forEach(t => t.addEventListener("click", () => { showTab(t.dataset.tab); window.scrollTo({top: 0}); }));
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
  const opts = [["", "全部"], ...Object.entries(D.status.members).map(([id, m]) => [id, m.short])];
  $("#who").innerHTML = "<span>按成员看：</span>" + opts.map(([id, label]) =>
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
  const who = state.member ? memberName(state.member) + " 的" : "";
  const weekTxt = currentWeek < 1 ? "未开学" : currentWeek > 12 ? "已结束" : `Week ${currentWeek}`;
  const ws = weekStart(Math.min(Math.max(currentWeek, 1), 12));

  $("#stats").innerHTML = `
    <div class="card stat"><div class="k">当前</div><div class="v">${weekTxt}</div>
      <div class="s">${md(ws)} – ${md(new Date(ws.getTime() + 6 * DAY))}</div></div>
    <div class="card stat"><div class="k">${who}整体进度</div><div class="v">${pct}%</div>
      <div class="meter"><i style="width:${pct}%;background:var(--done)"></i></div></div>
    <div class="card stat"><div class="k">${who}进行中的任务</div><div class="v">${active}</div>
      <div class="s">共 ${mine.length} 项任务</div></div>
    <div class="card stat"><div class="k">零件到手</div><div class="v">${inHand}<span class="muted" style="font-size:16px"> / ${parts.length}</span></div>
      <div class="s">还有 ${parts.filter(p => ["buy", "choosing"].includes(p.status)).length} 项待购买</div></div>`;
}

function renderArch() {
  const comp = (c, board) => {
    const dim = state.member && c.owner !== state.member && c.owner !== "all";
    return `<button class="comp${dim ? " dim" : ""}" data-comp="${board}:${c.id}">
      <span class="dot" style="--c:${memberColor(c.owner)}"></span>${esc(c.name)}<span class="if">${esc(c.iface)}</span></button>`;
  };
  const player = n => `<div class="board"><h4>玩家板 ${n}</h4><div class="sub">输入 · 显示 · 音效</div>
    <div class="comps">${D.status.components.player.map(c => comp(c, "player")).join("")}</div></div>`;
  const link = `<div class="link"><span class="packet"></span><span class="packet back"></span></div>`;
  $("#arch").innerHTML = player(1) + link +
    `<div class="board central"><h4>中央板</h4><div class="sub">游戏状态的唯一来源</div>
      <div class="comps">${D.status.components.central.map(c => comp(c, "central")).join("")}</div></div>` +
    link + player(2);
}

$("#arch").addEventListener("click", e => {
  const b = e.target.closest("[data-comp]");
  if (!b) return;
  const [board, id] = b.dataset.comp.split(":");
  const c = D.status.components[board].find(x => x.id === id);
  $$(".comp").forEach(x => x.classList.toggle("sel", x.dataset.comp === b.dataset.comp));
  $("#arch-detail").innerHTML = `<b>${esc(c.name)}</b><span class="tag">${esc(c.iface)}</span>
    <span class="muted" style="margin-left:8px">负责人：${esc(c.owner === "all" ? "全员" : D.status.members[c.owner].name)}</span>
    <div style="margin-top:6px">${esc(c.detail)}</div>`;
});

function renderTeam() {
  $("#team").innerHTML = Object.entries(D.status.members).map(([id, m]) => {
    const ts = D.status.tasks.filter(t => t.owner === id);
    const doing = ts.filter(t => t.status === "doing").length;
    return `<button class="card member${state.member === id ? " sel" : ""}" data-member="${id}" style="--c:${memberColor(id)}">
      <h3><span class="dot"></span>${esc(m.name)}</h3>
      <div class="role">${esc(m.role)}</div>
      <p>${esc(m.duties)}</p>
      <div class="count">${ts.length} 项负责任务 · ${doing} 项进行中 · 进度 ${taskProgress(ts)}%</div>
    </button>`;
  }).join("");
}

function updateCard(u) {
  return `<div class="update" style="--c:${memberColor(u.author)}">
    <div class="meta"><span>${esc(u.date)}</span><span>·</span><span>${esc(memberName(u.author))}</span><span class="tag">${esc(u.area)}</span></div>
    <h3>${esc(u.title)}</h3><p>${esc(u.body)}</p></div>`;
}

function memberUpdates() {
  return D.updates.filter(u => !state.member || u.author === state.member || u.author === "all");
}

function renderLatest() {
  const list = memberUpdates().slice(0, 3);
  $("#latest").innerHTML = list.length ? list.map(updateCard).join("") : `<div class="empty">还没有进展。</div>`;
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
  let html = `<tr><th class="task">任务</th><th>负责人</th>` + WEEKS.map(w => `<th class="${nowCls(w)}">W${w}</th>`).join("") + "</tr>";
  const tasks = visibleTasks();
  let lastGroup = null;
  tasks.forEach(t => {
    if (t.group !== lastGroup) {
      html += `<tr class="grp"><td colspan="${WEEKS.length + 2}">${esc(t.group)}</td></tr>`;
      lastGroup = t.group;
    }
    const idx = D.status.tasks.indexOf(t);
    html += `<tr class="t" data-task="${idx}"><td class="task">${esc(t.name)}</td>
      <td class="owner"><span class="dot" style="--c:${memberColor(t.owner)}"></span> ${esc(memberName(t.owner))}</td>` +
      WEEKS.map(w => {
        const on = w >= t.week && w < t.week + t.span;
        return `<td class="${nowCls(w)}">${on ? `<div class="bar ${t.status}" title="${TASK_STATUS[t.status]}"></div>` : ""}</td>`;
      }).join("") + "</tr>";
  });
  if (!tasks.length) html += `<tr><td colspan="${WEEKS.length + 2}" class="empty">没有符合条件的任务。</td></tr>`;
  $("#gantt").innerHTML = html;
}

$("#gantt").addEventListener("click", e => {
  const r = e.target.closest("tr[data-task]");
  if (!r) return;
  const t = D.status.tasks[+r.dataset.task];
  $$("#gantt tr.t").forEach(x => x.classList.toggle("sel", x === r));
  const end = t.week + t.span - 1;
  const range = `${md(weekStart(t.week))} – ${md(new Date(weekStart(end).getTime() + 6 * DAY))}`;
  $("#task-detail").innerHTML = `<b>${esc(t.name)}</b><span class="tag">${TASK_STATUS[t.status]}</span>
    <div class="muted" style="font-size:13px;margin-top:4px">
      ${esc(t.group)} · 第 ${t.week}${t.span > 1 ? "–" + end : ""} 周（${range}）· 负责人：${esc(t.owner === "all" ? "全员" : D.status.members[t.owner].name)}</div>
    <div style="margin-top:6px">${esc(t.desc)}</div>`;
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
  $("#part-legend").innerHTML = PART_GROUPS.map((g, i) => `<span style="--c:${g.color}">${g.label} ${counts[i]}</span>`).join("");
  $("#part-filter").innerHTML = [["", "全部"], ...PART_GROUPS.map(g => [g.key, g.label])].map(([k, l]) =>
    `<button class="chip" data-pf="${k}" aria-pressed="${state.partFilter === k}">${l}</button>`).join("");

  const group = PART_GROUPS.find(g => g.key === state.partFilter);
  const shown = parts.filter(p => !group || group.match.includes(p.status));
  $("#parts").innerHTML = shown.length ? shown.map(p => `<li>
      <span class="nm">${esc(p.name)} <span class="muted" style="font-weight:400">× ${p.qty}</span>
        ${p.iface !== "—" ? `<span class="tag">${esc(p.iface)}</span>` : ""}</span>
      <span class="st ${p.status}">${PART_STATUS[p.status] || esc(p.status)}</span>
      <span class="md">${esc(p.model)} · ${esc(p.use)} · <span class="dot" style="--c:${memberColor(p.owner)}"></span> ${esc(memberName(p.owner))}</span>
    </li>`).join("") : `<li class="empty">没有符合条件的零件。</li>`;
}

$("#part-filter").addEventListener("click", e => {
  const b = e.target.closest("[data-pf]");
  if (b) { state.partFilter = b.dataset.pf; renderParts(); }
});

function pinInfo(p) {
  const a = state.board === "player" ? p.player : null;
  if (a) return {kind: "used", use: a.use, part: a.part};
  const b = p.builtin || "";
  if (b.startsWith("LED")) return state.noMatrix ? {kind: "free", use: "空闲（点阵已停用）"} : {kind: "busy", use: "板载 " + b};
  if (b.startsWith("按钮")) return {kind: "busy", use: "板载" + b};
  if (b.startsWith("Qwiic")) return {kind: "free", use: "空闲（外部 I2C）"};
  return {kind: "free", use: "空闲"};
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
    return `<button class="pin ${i.kind}${state.selPin === p.pin ? " sel" : ""}" data-pin="${p.pin}"
        style="${color ? `--c:${color};` : ""}${dim ? "opacity:.35" : ""}">
      ${p.warn && i.kind !== "busy" ? `<span class="warn" title="${esc(p.warn)}">⚠</span>` : ""}
      <div class="p">${p.pin}</div><div class="u">${esc(i.use)}</div></button>`;
  }).join("") +
    `<div class="pin power"><div class="p">3V</div><div class="u">电源</div></div>` +
    `<div class="pin power"><div class="p">GND</div><div class="u">地</div></div>`;

  $("#pin-summary").innerHTML = `<span><b>${used + free}</b>可用 pin</span><span><b style="color:var(--accent)">${used}</b>已分配</span>
    <span><b style="color:${free ? "var(--done)" : "var(--danger)"}">${free}</b>剩余空闲</span>`;
  $("#pin-note").textContent = state.board === "player" ? D.pins.note : "中央板不接外设，pin 全部空闲；板载 LED 点阵可以用来显示连接状态和当前回合。";
  $("#pin-legend").innerHTML = Object.values(PIN_PARTS).map(p => `<span style="--c:${p.color}">${p.name}</span>`).join("") +
    `<span style="--c:var(--surface-2)">板载占用</span><span style="--c:transparent;outline:1px dashed var(--muted)">空闲</span>`;
  $("#pin-extra").innerHTML = state.board === "player" ? D.pins.extra.map(x => `<li>${esc(x)}</li>`).join("") : "";
  renderPinDetail();
}

function renderPinDetail() {
  const p = D.pins.pins.find(x => x.pin === state.selPin);
  if (!p) { $("#pin-detail").innerHTML = `<span class="muted">点击任意 pin。</span>`; return; }
  const i = pinInfo(p);
  $("#pin-detail").innerHTML = `<b>${p.pin}</b><span class="muted mono">${p.nrf}</span>
    <div style="margin-top:6px">${p.caps.map(c => `<span class="tag" style="margin-right:4px">${esc(c)}</span>`).join("")}</div>
    <div style="margin-top:6px">当前：${esc(i.use)}</div>
    ${p.builtin ? `<div class="muted" style="font-size:13px">板载功能：${esc(p.builtin)}</div>` : ""}
    ${p.warn ? `<div style="font-size:13px;color:var(--doing);margin-top:4px">⚠ ${esc(p.warn)}</div>` : ""}`;
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

function renderUpdates() {
  const areas = [...new Set(D.updates.map(u => u.area))];
  $("#area-filter").innerHTML = [["", "全部分类"], ...areas.map(a => [a, a])].map(([k, l]) =>
    `<button class="chip" data-area="${esc(k)}" aria-pressed="${state.area === k}">${esc(l)}</button>`).join("");
  $("#areas").innerHTML = areas.map(a => `<option value="${esc(a)}">`).join("");

  const q = state.query.trim().toLowerCase();
  const list = memberUpdates().filter(u =>
    (!state.area || u.area === state.area) &&
    (!q || (u.title + u.body + u.area).toLowerCase().includes(q)));
  $("#update-list").innerHTML = list.length ? list.map(updateCard).join("") : `<div class="empty">没有找到相关进展。</div>`;
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
    `<option value="all">全员</option>`;
  const saved = store.get("pr.author");
  if (saved) f.author.value = saved;

  const update = () => {
    const u = {date: f.date.value, author: f.author.value, area: f.area.value.trim() || "其他",
               title: f.title.value.trim() || "（标题）", body: f.body.value.trim() || "（内容）"};
    store.set("pr.author", u.author);
    $("#compose-preview").innerHTML = updateCard(u);
    const json = JSON.stringify(u, null, 2).split("\n").map(l => "  " + l).join("\n") + ",";
    $("#compose-json").textContent = json;
  };
  f.addEventListener("input", update);
  update();
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
    $("main").insertAdjacentHTML("afterbegin", `<div class="card" style="border-color:var(--danger)">数据加载失败：${esc(err.message)}</div>`);
  });

window.PR = {toast, copyText, store};
