// Pocket Rivals guestbook: reviews are GitHub issues made from the
// .github/ISSUE_TEMPLATE/review.yml form, read back through the public API.
// Closing an issue hides it here.
//
// The form is bilingual ("评分 Rating", "Ember 焰灵（火 fire）"). Issues made
// before that have Chinese-only headings ("### 评分") and options
// ("Tide 潮影（水）") and the title prefix "[评价]", so the parser matches
// headings on their Chinese part and pets on their English name. Pre-filled
// links must use the form's current option texts exactly, or GitHub leaves
// the dropdown empty.

(() => {
  const REPO = "Yeyuruoying11/pocket-rivals-site";
  const API = `https://api.github.com/repos/${REPO}/issues?state=open&per_page=100`;
  const TITLE_PREFIX = "[评价 Review]";
  const TITLE_RE = /^\[评价(?: Review)?\]/;   // also the older "[评价]"
  const CACHE_KEY = "pr.reviews";
  const CACHE_FRESH_MS = 2 * 60 * 1000;
  const store = window.PR.store;
  const {t} = window.I18N;
  const tn = (key, n) => t(key + (n === 1 ? ".one" : ".other"), {n});

  // Form fields: headings are "<zh> <en>" now, "<zh>" in older issues
  const FIELDS = [
    {id: "rating",  zh: "评分",         en: "Rating"},
    {id: "pet",     zh: "最喜欢的宠物", en: "Favorite pet"},
    {id: "comment", zh: "评价",         en: "Review"},
    {id: "name",    zh: "署名（可选）", en: "Name (optional)"},
  ];
  // opt is the form's option text; issues made before it went bilingual have
  // "Ember 焰灵（火）" etc., which still starts with the English name
  const PETS = [
    {short: "Ember",  opt: "Ember 焰灵（火 fire）",   color: "var(--fire)"},
    {short: "Tide",   opt: "Tide 潮影（水 water）",   color: "var(--water)"},
    {short: "Sprout", opt: "Sprout 叶芽（草 grass）", color: "var(--grass)"},
  ];
  const PET_UNDECIDED = "还没选 No favorite yet";   // older issues: "还没选"
  const ratingOption = n => "★".repeat(n) + "☆".repeat(5 - n) + " " + n;
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  I18N.add({
    zh: {
      "reviews.title": "留言板",
      "reviews.subtitle": "玩过原型或者看过 demo？留下你对游戏的评价，也可以回复别人的评价",
      "reviews.write": "写一条评价",
      "reviews.form.pet": "最喜欢的宠物",
      "reviews.form.petSkip": "（不选）",
      "reviews.pet.Ember": "Ember 焰灵（火）",
      "reviews.pet.Tide": "Tide 潮影（水）",
      "reviews.pet.Sprout": "Sprout 叶芽（草）",
      "reviews.pet.undecided": "还没选",
      "reviews.form.name": "署名（可选）",
      "reviews.form.namePh": "留空显示 GitHub 用户名",
      "reviews.form.comment": "评价",
      "reviews.form.commentPh": "好玩的地方、不好玩的地方、想加什么",
      "reviews.form.submit": "去 GitHub 发布 ↗",
      "reviews.form.note": "会打开一个填好内容的 GitHub 页面，点 Create 就发布了（需要登录 GitHub 账号，不需要是协作者）。回来点「刷新」就能看到。",
      "reviews.rate.prompt": "点星星打分",
      "reviews.rate.1": "不太行",
      "reviews.rate.2": "一般",
      "reviews.rate.3": "还不错",
      "reviews.rate.4": "好玩",
      "reviews.rate.5": "超好玩",
      "reviews.list": "大家的评价",
      "reviews.sort.new": "最新",
      "reviews.sort.high": "评分最高",
      "reviews.refresh": "刷新",
      "reviews.count.one": "{n} 条评价",
      "reviews.count.other": "{n} 条评价",
      "reviews.bar": "{n} 星",
      "reviews.stars.one": "{n} 星",
      "reviews.stars.other": "{n} 星",
      "reviews.petsHint": "最喜欢的宠物（点一下筛选）",
      "reviews.loading": "加载中…",
      "reviews.loadFailed": "加载失败：{msg}",
      "reviews.cached": "显示的是上次缓存的内容。{msg}",
      "reviews.empty": "还没有评价，来写第一条吧。",
      "reviews.emptyPet": "这只宠物还没有人选。",
      "reviews.err.rateLimit": "GitHub 限制了访问频率（每小时 60 次），过一会儿再刷新",
      "reviews.err.status": "GitHub 返回 {status}",
      "reviews.err.network": "连不上 GitHub，过一会儿再刷新",
      "reviews.replies.one": "{n} 条回复",
      "reviews.replies.other": "{n} 条回复",
      "reviews.reply": "回复 ↗",
      "reviews.toast.needText": "写几句评价再发布",
      "reviews.toast.needRating": "先点星星打分",
      "reviews.date": "{m}/{d}",
    },
    en: {
      "reviews.title": "Guestbook",
      "reviews.subtitle": "Played the prototype or seen the demo? Leave a review of the game, or reply to someone else's",
      "reviews.write": "Write a review",
      "reviews.form.pet": "Favorite pet",
      "reviews.form.petSkip": "(skip)",
      "reviews.pet.Ember": "Ember (fire)",
      "reviews.pet.Tide": "Tide (water)",
      "reviews.pet.Sprout": "Sprout (grass)",
      "reviews.pet.undecided": "No favorite yet",
      "reviews.form.name": "Name (optional)",
      "reviews.form.namePh": "Default: GitHub ID",
      "reviews.form.comment": "Review",
      "reviews.form.commentPh": "What was fun, what wasn't, what you'd add",
      "reviews.form.submit": "Post on GitHub ↗",
      "reviews.form.note": "Opens a GitHub page with your review filled in; click Create to post it (you need a GitHub account, but don't need to be a collaborator). Come back and click Refresh to see it.",
      "reviews.rate.prompt": "Tap a star to rate",
      "reviews.rate.1": "Not great",
      "reviews.rate.2": "Okay",
      "reviews.rate.3": "Pretty good",
      "reviews.rate.4": "Fun",
      "reviews.rate.5": "Super fun",
      "reviews.list": "All reviews",
      "reviews.sort.new": "Newest",
      "reviews.sort.high": "Top rated",
      "reviews.refresh": "Refresh",
      "reviews.count.one": "{n} review",
      "reviews.count.other": "{n} reviews",
      "reviews.bar": "{n} ★",
      "reviews.stars.one": "{n} star",
      "reviews.stars.other": "{n} stars",
      "reviews.petsHint": "Favorite pet (tap to filter)",
      "reviews.loading": "Loading…",
      "reviews.loadFailed": "Couldn't load reviews: {msg}",
      "reviews.cached": "Showing the last saved copy. {msg}",
      "reviews.empty": "No reviews yet. Be the first to write one!",
      "reviews.emptyPet": "Nobody has picked this pet yet.",
      "reviews.err.rateLimit": "GitHub's rate limit was reached (60 requests an hour). Try refreshing in a while.",
      "reviews.err.status": "GitHub returned {status}",
      "reviews.err.network": "Couldn't reach GitHub. Try refreshing in a while.",
      "reviews.replies.one": "{n} reply",
      "reviews.replies.other": "{n} replies",
      "reviews.reply": "Reply ↗",
      "reviews.toast.needText": "Write a few words before posting",
      "reviews.toast.needRating": "Tap a star to rate first",
      "reviews.date": "{mon} {d}",
    },
  });

  const ui = {sort: "new", pet: "", reviews: null, error: ""};
  const draft = {rating: 0};

  function fieldId(heading) {
    const h = heading.replace(/\s+/g, " ").trim();
    const f = FIELDS.find(f => h.split(" ")[0] === f.zh || h.toLowerCase() === f.en.toLowerCase());
    return f ? f.id : "";
  }

  // Issue form bodies look like "### 评分 Rating\n\n★★★★☆ 4\n\n### 评价 Review\n\n..."
  function parseBody(body) {
    const fields = {};
    const parts = String(body || "").split(/^###\s+/m).slice(1);
    for (const part of parts) {
      const nl = part.indexOf("\n");
      const id = fieldId(part.slice(0, nl < 0 ? undefined : nl));
      let val = nl < 0 ? "" : part.slice(nl + 1).trim();
      if (val === "_No response_") val = "";
      if (id && !(id in fields)) fields[id] = val;
    }
    return fields;
  }

  // "★★★★☆ 4"; falls back to counting stars if the number was edited away
  function parseRating(s) {
    const m = /([1-5])\s*$/.exec(s);
    if (m) return Number(m[1]);
    const n = (s.match(/★/g) || []).length;
    return n <= 5 ? n : 0;
  }

  function toReview(issue) {
    const f = parseBody(issue.body);
    const pet = PETS.find(p => (f.pet || "").startsWith(p.short));
    return {
      id: issue.number,
      url: issue.html_url,
      user: issue.user ? issue.user.login : "",
      avatar: issue.user ? issue.user.avatar_url : "",
      name: (f.name || "").slice(0, 40),
      rating: parseRating(f.rating || ""),
      pet: pet ? pet.short : "",
      text: f.comment || "",
      replies: issue.comments || 0,
      date: new Date(issue.created_at),
    };
  }

  function isReview(issue) {
    return !issue.pull_request && (TITLE_RE.test(issue.title || "") ||
      (issue.labels || []).some(l => l.name === "review"));
  }

  function readCache() {
    try {
      const c = JSON.parse(store.get(CACHE_KEY) || "null");
      return c && Array.isArray(c.issues) ? c : null;
    } catch { return null; }
  }

  // errors we word ourselves; anything else (offline, blocked) gets a generic message
  const fail = msg => Object.assign(new Error(msg), {ours: true});

  function load(force) {
    const cache = readCache();
    if (cache) setIssues(cache.issues);
    if (cache && !force && Date.now() - cache.at < CACHE_FRESH_MS) return;

    const btn = $("#rv-refresh");
    btn.disabled = true;
    fetch(API, {headers: {Accept: "application/vnd.github+json"}})
      .then(r => {
        if (r.status === 403 || r.status === 429) throw fail(t("reviews.err.rateLimit"));
        if (!r.ok) throw fail(t("reviews.err.status", {status: r.status}));
        return r.json();
      })
      .then(issues => {
        const keep = issues.filter(isReview).map(i => ({
          number: i.number, html_url: i.html_url, title: i.title, body: i.body, comments: i.comments,
          created_at: i.created_at, labels: (i.labels || []).map(l => ({name: l.name})),
          user: i.user && {login: i.user.login, avatar_url: i.user.avatar_url},
        }));
        store.set(CACHE_KEY, JSON.stringify({at: Date.now(), issues: keep}));
        ui.error = "";
        setIssues(keep);
      })
      .catch(err => { ui.error = err.ours ? err.message : t("reviews.err.network"); render(); })
      .finally(() => { btn.disabled = false; });
  }

  function setIssues(issues) {
    ui.reviews = issues.map(toReview).filter(r => r.rating > 0 || r.text);
    render();
  }

  /* ---------------- render ---------------- */

  const stars = (n, cls = "") => `<span class="stars ${cls}" aria-label="${esc(tn("reviews.stars", Math.round(n * 10) / 10))}">` +
    [1, 2, 3, 4, 5].map(i => `<span class="${i <= Math.round(n) ? "on" : ""}">★</span>`).join("") + `</span>`;

  const fmtDate = d => t("reviews.date", {m: d.getMonth() + 1, d: d.getDate(), mon: MONTHS[d.getMonth()]});

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
      return `<div class="rv-bar"><span>${esc(t("reviews.bar", {n}))}</span><div class="track"><div style="width:${pct}%"></div></div><span class="muted">${c}</span></div>`;
    }).join("");
    const pets = PETS.map(p => {
      const c = list.filter(r => r.pet === p.short).length;
      return `<button class="chip" data-pet="${p.short}" aria-pressed="${ui.pet === p.short}">${petChip(p.short)} ${c}</button>`;
    }).join("");
    $("#rv-summary").innerHTML = `
      <div class="rv-score">
        <div class="big">${rated.length ? avg.toFixed(1) : "–"}</div>
        ${stars(avg, "lg")}
        <div class="muted">${esc(tn("reviews.count", list.length))}</div>
      </div>
      <div class="rv-bars">${bars}</div>
      <div class="rv-pets"><div class="muted" style="font-size:12px">${esc(t("reviews.petsHint"))}</div><div class="row">${pets}</div></div>`;
  }

  function render() {
    const listEl = $("#rv-list");
    if (!ui.reviews) {
      listEl.innerHTML = `<div class="empty">${esc(ui.error ? t("reviews.loadFailed", {msg: ui.error}) : t("reviews.loading"))}</div>`;
      return;
    }
    renderSummary(ui.reviews);

    let list = ui.reviews.filter(r => !ui.pet || r.pet === ui.pet);
    list = list.slice().sort(ui.sort === "high" ? (a, b) => b.rating - a.rating || b.date - a.date
                                                : (a, b) => b.date - a.date);
    $$("#rv-sort [data-sort]").forEach(b => b.setAttribute("aria-pressed", b.dataset.sort === ui.sort));

    const note = ui.error ? `<div class="empty">${esc(t("reviews.cached", {msg: ui.error}))}</div>` : "";
    if (!list.length) {
      listEl.innerHTML = note + `<div class="empty">${esc(t(ui.pet ? "reviews.emptyPet" : "reviews.empty"))}</div>`;
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
            <span class="muted">${esc(fmtDate(r.date))}</span>
          </div>
          <p>${esc(r.text)}</p>
          <a class="reply" href="${esc(r.url)}" target="_blank" rel="noopener">${r.replies ? esc(tn("reviews.replies", r.replies)) + " · " : ""}${esc(t("reviews.reply"))}</a>
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
    $("#rv-stars-label").textContent = t(draft.rating ? `reviews.rate.${draft.rating}` : "reviews.rate.prompt");
    const ok = draft.rating && $("#rv-form").comment.value.trim();
    $("#rv-submit").classList.toggle("disabled", !ok);
    $("#rv-submit").setAttribute("aria-disabled", !ok);
    $("#rv-submit").href = ok ? composeUrl() : "#";
  }

  function init() {
    // option values are the form's option texts; the visible text follows the language
    $("#rv-form").pet.innerHTML = `<option value="">${esc(t("reviews.form.petSkip"))}</option>` +
      PETS.map(p => `<option value="${esc(p.opt)}">${esc(t("reviews.pet." + p.short))}</option>`).join("") +
      `<option value="${esc(PET_UNDECIDED)}">${esc(t("reviews.pet.undecided"))}</option>`;
    $("#rv-stars").innerHTML = [1, 2, 3, 4, 5].map(n =>
      `<button type="button" data-n="${n}" aria-label="${esc(tn("reviews.stars", n))}">★</button>`).join("");
    $("#rv-stars").addEventListener("click", e => {
      const b = e.target.closest("[data-n]");
      if (b) { draft.rating = Number(b.dataset.n); renderPicker(); }
    });
    $("#rv-form").addEventListener("input", renderPicker);
    $("#rv-submit").addEventListener("click", e => {
      if ($("#rv-submit").getAttribute("aria-disabled") === "true") {
        e.preventDefault();
        window.PR.toast(t(draft.rating ? "reviews.toast.needText" : "reviews.toast.needRating"));
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
