// Pocket Rivals guestbook: reviews are GitHub issues made from the
// .github/ISSUE_TEMPLATE/review.yml form, read back through the public API.
// Closing an issue hides it here.

(() => {
  const REPO = "Yeyuruoying11/pocket-rivals-site";
  const API = `https://api.github.com/repos/${REPO}/issues?state=open&per_page=100`;
  const TITLE_PREFIX = "[评价]";
  const CACHE_KEY = "pr.reviews";
  const CACHE_FRESH_MS = 2 * 60 * 1000;
  const store = window.PR.store;

  const PETS = [
    {opt: "Ember 焰灵（火）",  short: "Ember", color: "var(--fire)"},
    {opt: "Tide 潮影（水）",   short: "Tide",  color: "var(--water)"},
    {opt: "Sprout 叶芽（草）", short: "Sprout", color: "var(--grass)"},
  ];
  const ratingOption = n => "★".repeat(n) + "☆".repeat(5 - n) + " " + n;

  const ui = {sort: "new", pet: "", reviews: null, error: ""};
  const draft = {rating: 0};

  // Issue form bodies look like "### 评分\n\n★★★★☆ 4\n\n### 评价\n\n..."
  function parseBody(body) {
    const fields = {};
    const parts = String(body || "").split(/^###\s+/m).slice(1);
    for (const part of parts) {
      const nl = part.indexOf("\n");
      const key = part.slice(0, nl < 0 ? undefined : nl).trim();
      let val = nl < 0 ? "" : part.slice(nl + 1).trim();
      if (val === "_No response_") val = "";
      fields[key] = val;
    }
    return fields;
  }

  function toReview(issue) {
    const f = parseBody(issue.body);
    const m = /([1-5])\s*$/.exec(f["评分"] || "");
    const pet = PETS.find(p => (f["最喜欢的宠物"] || "").startsWith(p.short));
    return {
      id: issue.number,
      url: issue.html_url,
      user: issue.user ? issue.user.login : "",
      avatar: issue.user ? issue.user.avatar_url : "",
      name: (f["署名（可选）"] || "").slice(0, 40),
      rating: m ? Number(m[1]) : 0,
      pet: pet ? pet.short : "",
      text: f["评价"] || "",
      replies: issue.comments || 0,
      date: new Date(issue.created_at),
    };
  }

  function isReview(issue) {
    return !issue.pull_request && (issue.title.startsWith(TITLE_PREFIX) ||
      (issue.labels || []).some(l => l.name === "review"));
  }

  function readCache() {
    try {
      const c = JSON.parse(store.get(CACHE_KEY) || "null");
      return c && Array.isArray(c.issues) ? c : null;
    } catch { return null; }
  }

  function load(force) {
    const cache = readCache();
    if (cache) setIssues(cache.issues);
    if (cache && !force && Date.now() - cache.at < CACHE_FRESH_MS) return;

    const btn = $("#rv-refresh");
    btn.disabled = true;
    fetch(API, {headers: {Accept: "application/vnd.github+json"}})
      .then(r => {
        if (r.status === 403 || r.status === 429) throw new Error("GitHub 限制了访问频率（每小时 60 次），过一会儿再刷新");
        if (!r.ok) throw new Error("GitHub 返回 " + r.status);
        return r.json();
      })
      .then(issues => {
        const keep = issues.filter(isReview).map(i => ({
          number: i.number, html_url: i.html_url, title: i.title, body: i.body, comments: i.comments,
          created_at: i.created_at, labels: i.labels.map(l => ({name: l.name})),
          user: i.user && {login: i.user.login, avatar_url: i.user.avatar_url},
        }));
        store.set(CACHE_KEY, JSON.stringify({at: Date.now(), issues: keep}));
        ui.error = "";
        setIssues(keep);
      })
      .catch(err => { ui.error = err.message; render(); })
      .finally(() => { btn.disabled = false; });
  }

  function setIssues(issues) {
    ui.reviews = issues.map(toReview).filter(r => r.rating > 0 || r.text);
    render();
  }

  /* ---------------- render ---------------- */

  const stars = (n, cls = "") => `<span class="stars ${cls}" aria-label="${n} 星">` +
    [1, 2, 3, 4, 5].map(i => `<span class="${i <= Math.round(n) ? "on" : ""}">★</span>`).join("") + `</span>`;

  function petChip(short) {
    const p = PETS.find(x => x.short === short);
    return p ? `<span class="pet-chip" style="--c:${p.color}">${esc(p.short)}</span>` : "";
  }

  function renderSummary(list) {
    const rated = list.filter(r => r.rating);
    const avg = rated.length ? rated.reduce((s, r) => s + r.rating, 0) / rated.length : 0;
    const bars = [5, 4, 3, 2, 1].map(n => {
      const c = rated.filter(r => r.rating === n).length;
      const pct = rated.length ? c / rated.length * 100 : 0;
      return `<div class="rv-bar"><span>${n} 星</span><div class="track"><div style="width:${pct}%"></div></div><span class="muted">${c}</span></div>`;
    }).join("");
    const pets = PETS.map(p => {
      const c = list.filter(r => r.pet === p.short).length;
      return `<button class="chip" data-pet="${p.short}" aria-pressed="${ui.pet === p.short}">${petChip(p.short)} ${c}</button>`;
    }).join("");
    $("#rv-summary").innerHTML = `
      <div class="rv-score">
        <div class="big">${rated.length ? avg.toFixed(1) : "–"}</div>
        ${stars(avg, "lg")}
        <div class="muted">${list.length} 条评价</div>
      </div>
      <div class="rv-bars">${bars}</div>
      <div class="rv-pets"><div class="muted" style="font-size:12px">最喜欢的宠物（点一下筛选）</div><div class="row">${pets}</div></div>`;
  }

  function render() {
    const listEl = $("#rv-list");
    if (!ui.reviews) {
      listEl.innerHTML = ui.error ? `<div class="empty">加载失败：${esc(ui.error)}</div>` : `<div class="empty">加载中…</div>`;
      return;
    }
    renderSummary(ui.reviews);

    let list = ui.reviews.filter(r => !ui.pet || r.pet === ui.pet);
    list = list.slice().sort(ui.sort === "high" ? (a, b) => b.rating - a.rating || b.date - a.date
                                                : (a, b) => b.date - a.date);
    $$("#rv-sort [data-sort]").forEach(b => b.setAttribute("aria-pressed", b.dataset.sort === ui.sort));

    const note = ui.error ? `<div class="empty">显示的是上次缓存的内容。${esc(ui.error)}</div>` : "";
    if (!list.length) {
      listEl.innerHTML = note + `<div class="empty">${ui.pet ? "这只宠物还没有人选。" : "还没有评价，来写第一条吧。"}</div>`;
      return;
    }
    listEl.innerHTML = note + list.map(r => `
      <article class="review">
        <img class="avatar" src="${esc(r.avatar + (r.avatar.includes("?") ? "&" : "?") + "s=64")}" alt="" loading="lazy" width="32" height="32">
        <div class="body">
          <div class="meta">
            <b>${esc(r.name || r.user)}</b>
            ${r.name ? `<span class="muted">@${esc(r.user)}</span>` : ""}
            ${r.rating ? stars(r.rating) : ""}
            ${petChip(r.pet)}
            <span class="muted">${r.date.getMonth() + 1}/${r.date.getDate()}</span>
          </div>
          <p>${esc(r.text)}</p>
          <a class="reply" href="${esc(r.url)}" target="_blank" rel="noopener">${r.replies ? `${r.replies} 条回复 · ` : ""}回复 ↗</a>
        </div>
      </article>`).join("");
  }

  /* ---------------- compose ---------------- */

  function composeUrl() {
    const f = $("#rv-form");
    const text = f.comment.value.trim();
    const params = new URLSearchParams({template: "review.yml", title: `${TITLE_PREFIX} ${text.split("\n")[0].slice(0, 30)}`});
    if (draft.rating) params.set("rating", ratingOption(draft.rating));
    if (f.pet.value) params.set("pet", f.pet.value);
    if (text) params.set("comment", text);
    if (f.name.value.trim()) params.set("name", f.name.value.trim());
    return `https://github.com/${REPO}/issues/new?${params}`;
  }

  function renderPicker() {
    $$("#rv-stars button").forEach(b => b.classList.toggle("on", Number(b.dataset.n) <= draft.rating));
    $("#rv-stars-label").textContent = draft.rating ? ["", "不太行", "一般", "还不错", "好玩", "超好玩"][draft.rating] : "点星星打分";
    const ok = draft.rating && $("#rv-form").comment.value.trim();
    $("#rv-submit").classList.toggle("disabled", !ok);
    $("#rv-submit").setAttribute("aria-disabled", !ok);
    $("#rv-submit").href = ok ? composeUrl() : "#";
  }

  function init() {
    $("#rv-form").pet.innerHTML = `<option value="">（不选）</option>` +
      PETS.map(p => `<option value="${p.opt}">${p.opt}</option>`).join("") + `<option value="还没选">还没选</option>`;
    $("#rv-stars").innerHTML = [1, 2, 3, 4, 5].map(n => `<button type="button" data-n="${n}" aria-label="${n} 星">★</button>`).join("");
    $("#rv-stars").addEventListener("click", e => {
      const b = e.target.closest("[data-n]");
      if (b) { draft.rating = Number(b.dataset.n); renderPicker(); }
    });
    $("#rv-form").addEventListener("input", renderPicker);
    $("#rv-submit").addEventListener("click", e => {
      if ($("#rv-submit").getAttribute("aria-disabled") === "true") {
        e.preventDefault();
        window.PR.toast(draft.rating ? "写几句评价再发布" : "先点星星打分");
      }
    });
    $("#rv-sort").addEventListener("click", e => {
      const b = e.target.closest("[data-sort]");
      if (b) { ui.sort = b.dataset.sort; render(); }
    });
    $("#rv-summary").addEventListener("click", e => {
      const b = e.target.closest("[data-pet]");
      if (b) { ui.pet = ui.pet === b.dataset.pet ? "" : b.dataset.pet; render(); }
    });
    $("#rv-refresh").addEventListener("click", () => load(true));
    renderPicker();
    load(false);
  }

  init();
})();
