// Pocket Rivals site: interface language (中文 / English)
//
// Load in <head>, before every other script. Each script registers its own
// strings with I18N.add({zh: {...}, en: {...}}) under a prefix ("app.",
// "battle.", "reviews.") and looks them up with I18N.t(key, vars). Switching
// language saves the choice and reloads the page, so every module simply
// renders in the current language. Forms that register with I18N.keepDraft()
// get their contents carried over the reload.
//
// The language comes from ?lang=zh|en in the URL, else the saved choice
// (localStorage "pr.lang"), else the browser language. The URL parameter is
// used when storage is unavailable, so the toggle works in private windows.
//
// Static HTML: data-i18n="key" sets textContent, data-i18n-html="key" sets
// innerHTML (only for our own trusted strings), data-i18n-attr="attr:key;..."
// sets attributes. These are applied once the page has loaded; a key nobody
// registered leaves the authored text in place.
//
// Data files (status.json, pins.json) keep Chinese in the usual
// fields and English in an optional "en" object with the same field names;
// I18N.L(obj, "field") picks the right one and falls back to Chinese.
//
// Glossary (keep wording consistent across files):
//   攻击测试 attack trial · 光带 band · 指针 pointer · 第 N 层 stage N · 准备 get ready
//   普通一击 Normal strike · 强力一击 Strong strike · 全力一击 Full Power strike
//   连续格挡 chained blocks · 格挡 block · 完美 Perfect · 挡住 Blocked · 没挡住 Missed
//   进攻方 attacker · 防守方 defender · 派出 send out · 换宠物 switch · 回合 round
//   技能 skill · 冷却 cooldown · 灼烧 Burn · 潮汐护盾 Tide Shield · 汲取 Drain · 护盾 shield
//   效果拔群 super effective · 效果一般 not very effective · 倒下 fainted
//   焰灵 Ember · 潮影 Tide · 叶芽 Sprout · 火 / 水 / 草 fire / water / grass
//   玩法原型 battle prototype · 中央板 central board · 玩家板 player board
//   里程碑 milestone · 进展 progress update · 留言板 guestbook · 评价 review · 全员 everyone
//   UI text: sentence case ("Battle prototype", "Click a pin for details"); "click", not "tap"

(() => {
  const KEY = "pr.lang";
  const DRAFTS = "pr.drafts";
  const LANGS = ["zh", "en"];

  const storage = {
    get(area, k) { try { return window[area].getItem(k); } catch { return null; } },
    set(area, k, v) { try { window[area].setItem(k, v); return window[area].getItem(k) === v; } catch { return false; } },
    del(area, k) { try { window[area].removeItem(k); } catch {} },
  };

  const urlLang = new URLSearchParams(location.search).get("lang");
  const saved = storage.get("localStorage", KEY);
  const lang = LANGS.includes(urlLang) ? urlLang
    : LANGS.includes(saved) ? saved
    : (/^zh\b/i.test(navigator.language || "") ? "zh" : "en");

  const root = document.documentElement;
  root.lang = lang === "zh" ? "zh-CN" : "en";
  // The HTML is authored in Chinese; keep it hidden until it is translated
  if (lang === "en") root.classList.add("i18n-pending");

  const dict = {zh: {}, en: {}};
  const has = key => key in dict[lang] || key in dict.zh;

  // "{name}" placeholders are replaced from vars; missing keys show the key
  // itself (in English mode the Chinese text first) so gaps are easy to spot
  function t(key, vars) {
    let s = dict[lang][key];
    if (s === undefined) s = dict.zh[key];
    if (s === undefined) s = key;
    if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
    return s;
  }

  function add(strings) {
    for (const l of LANGS) Object.assign(dict[l], strings[l] || {});
  }

  function L(obj, field) {
    if (!obj) return "";
    if (lang === "en" && obj.en && obj.en[field] != null && obj.en[field] !== "") return obj.en[field];
    return obj[field];
  }

  function apply(scope = document) {
    scope.querySelectorAll("[data-i18n]").forEach(el => {
      if (has(el.dataset.i18n)) el.textContent = t(el.dataset.i18n);
    });
    scope.querySelectorAll("[data-i18n-html]").forEach(el => {
      if (has(el.dataset.i18nHtml)) el.innerHTML = t(el.dataset.i18nHtml);
    });
    scope.querySelectorAll("[data-i18n-attr]").forEach(el => {
      el.dataset.i18nAttr.split(";").forEach(pair => {
        const [attr, key] = pair.split(":").map(s => s.trim());
        if (attr && key && has(key)) el.setAttribute(attr, t(key));
      });
    });
  }

  /* ---------------- drafts kept across a language switch ---------------- */

  const keepers = {};

  // Register a form or other state to survive the reload: get() returns a
  // JSON-able value, restore(value) puts it back. If a saved value exists it
  // is restored right away (call this once the form is ready).
  function keepDraft(name, get, restore) {
    keepers[name] = get;
    let all = null;
    try { all = JSON.parse(storage.get("sessionStorage", DRAFTS) || "null"); } catch {}
    if (all && name in all) {
      try { restore(all[name]); } catch {}
      delete all[name];
      if (Object.keys(all).length) storage.set("sessionStorage", DRAFTS, JSON.stringify(all));
      else storage.del("sessionStorage", DRAFTS);
    }
  }

  // Helpers for plain forms: named fields only
  const formValues = form => Object.fromEntries([...form.elements]
    .filter(el => el.name && !["button", "submit", "file"].includes(el.type)).map(el => [el.name, el.value]));
  function fillForm(form, values) {
    for (const [name, v] of Object.entries(values || {})) {
      const el = form.elements[name];
      if (el && "value" in el) el.value = v;
    }
    form.dispatchEvent(new Event("input", {bubbles: true}));
  }

  function set(next) {
    if (!LANGS.includes(next) || next === lang) return;
    const drafts = {};
    for (const [name, get] of Object.entries(keepers)) {
      try { drafts[name] = get(); } catch {}
    }
    if (Object.keys(drafts).length) storage.set("sessionStorage", DRAFTS, JSON.stringify(drafts));

    // Use the URL when storage can't hold the choice, or when the URL already
    // names a language (it would override the stored one)
    const stored = storage.set("localStorage", KEY, next);
    const url = new URL(location.href);
    if (!stored || url.searchParams.has("lang")) {
      url.searchParams.set("lang", next);
      location.replace(url.href);
    } else {
      location.reload();
    }
  }

  add({
    zh: {"lang.switch": "EN", "lang.switchTitle": "Switch to English"},
    en: {"lang.switch": "中文", "lang.switchTitle": "切换到中文"},
  });

  document.addEventListener("DOMContentLoaded", () => {
    try {
      apply();
      const btn = document.getElementById("lang-toggle");
      if (btn) {
        btn.textContent = t("lang.switch");
        btn.title = t("lang.switchTitle");
        btn.lang = lang === "zh" ? "en" : "zh-CN";  // the label is in the other language
        btn.addEventListener("click", () => set(lang === "zh" ? "en" : "zh"));
      }
    } finally {
      root.classList.remove("i18n-pending");
    }
  });

  window.I18N = {lang, t, add, L, apply, set, keepDraft, formValues, fillForm};
})();
