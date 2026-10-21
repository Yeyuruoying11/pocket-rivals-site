// Pocket Rivals site: interface language (中文 / English)
//
// Load before every other script. Each script registers its own strings with
// I18N.add({zh: {...}, en: {...}}) under a prefix ("app.", "battle.",
// "reviews.") and looks them up with I18N.t(key, vars). Switching language
// saves the choice and reloads the page, so every module simply renders in
// the current language.
//
// Static HTML: data-i18n="key" sets textContent, data-i18n-html="key" sets
// innerHTML (only for our own trusted strings), data-i18n-attr="attr:key;..."
// sets attributes. These are applied once the page has loaded.
//
// Data files (status.json, pins.json, updates.json) keep Chinese in the usual
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
//   中央板 central board · 玩家板 player board · 里程碑 milestone · 进展 progress update
//   留言板 guestbook · 评价 review · 全员 everyone

(() => {
  const KEY = "pr.lang";
  const LANGS = ["zh", "en"];

  let saved = null;
  try { saved = localStorage.getItem(KEY); } catch {}
  const lang = LANGS.includes(saved) ? saved : (/^zh\b/i.test(navigator.language || "") ? "zh" : "en");
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";

  const dict = {zh: {}, en: {}};

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

  function apply(root = document) {
    root.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
    root.querySelectorAll("[data-i18n-html]").forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
    root.querySelectorAll("[data-i18n-attr]").forEach(el => {
      el.dataset.i18nAttr.split(";").forEach(pair => {
        const [attr, key] = pair.split(":").map(s => s.trim());
        if (attr && key) el.setAttribute(attr, t(key));
      });
    });
  }

  function set(next) {
    if (!LANGS.includes(next) || next === lang) return;
    try { localStorage.setItem(KEY, next); } catch {}
    location.reload();
  }

  add({
    zh: {"lang.switch": "EN", "lang.switchTitle": "Switch to English"},
    en: {"lang.switch": "中文", "lang.switchTitle": "切换到中文"},
  });

  document.addEventListener("DOMContentLoaded", () => {
    apply();
    const btn = document.getElementById("lang-toggle");
    if (btn) {
      btn.textContent = t("lang.switch");
      btn.title = t("lang.switchTitle");
      btn.addEventListener("click", () => set(lang === "zh" ? "en" : "zh"));
    }
  });

  window.I18N = {lang, t, add, L, apply, set};
})();
