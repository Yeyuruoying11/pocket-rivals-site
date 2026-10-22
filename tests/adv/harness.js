#!/usr/bin/env node
// 双人冒险 play-through tests: headless Chromium (Node Playwright) on the repository's device.html?test=1.
//
// usage: node -r ./tests/route.js tests/adv/harness.js [--site DIR] [--rooms 1-1,1-2 | --world 1 | --rooms all]
//                        [--kinds solve,solo,restart,boss,bossSolo,bot] [--orders ET,TE,ES,SE,TS,ST | --pairs]
//                        [--radio relay] [--port 8912] [--json out.json] [--seed 7] [-v]
//   The page (http://127.0.0.1:<port>/device.html) is answered from the repository folder by
//   tests/route.js (that is what -r loads): this starts no server of its own.
//   Cases come from tests/out/adv-cases.json (built by make-cases.js when missing).
//   --site DIR   the folder with device.html (default: the repository root)
//   --pairs   only the 3 pet pairs (ET, ES, TS) instead of all 6 orders
//   --radio relay   micro:bit relay link: one-way latency 5-30 ms (10-60 ms round trip) and 3 % packet loss
// Kinds: solve   scripted 2-player solution per pet order (paths from solve_c)
//        solo    one player does its whole part, the partner only walks (no A / S / M / pad) -> must NOT clear
//        restart pause (hold M) -> Retry room -> room is back to its start -> the full solution still clears
//        boss    boss rooms: two DEVICE bots (or boss-policy.js driving both pets with keys)
//        bossSolo boss rooms, P2 idle at spawn -> must NOT clear
//        bot     both DEVICE bots (whatever the builder's bot can do), must clear
// Exit code 1 if any test fails (skips do not fail).
"use strict";
const fs = require("fs"), path = require("path"), {execSync} = require("child_process");
const {chromium} = require(execSync("npm root -g").toString().trim() + "/playwright");
const HERE = __dirname;

const argv = process.argv.slice(2);
const arg = (k, def) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : def; };
const flag = k => argv.includes(k);
const SITE = path.resolve(arg("--site", path.resolve(__dirname, "..", "..")));
const OUTDIR = path.resolve(__dirname, "..", "out"), CASES_FILE = path.join(OUTDIR, "adv-cases.json");
const PORT = +arg("--port", 8912);
const SEED = +arg("--seed", 7);
const VERBOSE = flag("-v");
const ALL_ORDERS = ["ET", "TE", "ES", "SE", "TS", "ST"];
const orders = flag("--pairs") ? ["ET", "ES", "TS"] : arg("--orders", ALL_ORDERS.join(",")).split(",");
const kinds = arg("--kinds", "solve,solo,restart,boss,bossSolo").split(",");
const RADIO = arg("--radio", "") === "relay" ? {latency: [5, 30], loss: 0.03} : null;
const PET = {E: 0, T: 1, S: 2};
// known design findings (reported as XFAIL, not counted as failures; an XPASS means the finding went away)
const KNOWN = {
  // (1-2|solo|1, the winch 2 steps from the gate, is the bug being fixed: no longer an expected failure)
};

if (!global.PR_ROUTED) {
  console.error("run with: node -r ./tests/route.js tests/adv/harness.js ...");
  process.exit(2);
}
if (!fs.existsSync(path.join(SITE, "device.html"))) { console.error("no device.html in " + SITE); process.exit(2); }
fs.mkdirSync(OUTDIR, {recursive: true});
if (!fs.existsSync(CASES_FILE)) execSync("node " + JSON.stringify(path.join(HERE, "make-cases.js")), {stdio: "inherit"});
const CASES = JSON.parse(fs.readFileSync(CASES_FILE, "utf8"));
const roomsArg = arg("--rooms", null), worldArg = arg("--world", null);
const pick = CASES.filter(c => roomsArg && roomsArg !== "all" ? roomsArg.split(",").includes(c.id) : worldArg ? worldArg.split(",").includes(String(c.world)) : true);

// the test list
const tests = [];
for (const c of pick) {
  if (c.boss) {
    if (kinds.includes("boss")) tests.push({c, kind: "boss", order: "ET"});
    if (kinds.includes("bossSolo") && c.coop) tests.push({c, kind: "bossSolo", order: "ET"});
  } else {
    if (kinds.includes("solve")) for (const o of orders) tests.push({c, kind: "solve", order: o});
    if (kinds.includes("solo") && c.coop) for (const pv of [1, 0]) tests.push({c, kind: "solo", order: "ET", passive: pv});
    if (kinds.includes("restart")) tests.push({c, kind: "restart", order: "ET"});
  }
  if (kinds.includes("bot")) for (const o of (flag("--bot-orders") ? orders : ["ET"])) tests.push({c, kind: "bot", order: o});
}

(async () => {
  const browser = await chromium.launch({headless: true});
  const results = [];
  const scripts = ["boss-policy.js", "driver.js"].map(f => fs.readFileSync(path.join(HERE, f), "utf8"));
  try {
    for (const t of tests) {
      const page = await browser.newPage({viewport: {width: 1200, height: 900}});
      const pageErrors = [];
      page.on("pageerror", e => pageErrors.push(String(e.message || e)));
      page.on("console", m => { if (m.type() === "error") pageErrors.push("console: " + m.text()); });
      const started = Date.now();
      let r;
      try {
        await page.goto(`http://127.0.0.1:${PORT}/device.html?test=1&seed=${SEED}&view=both`, {waitUntil: "load"});
        await page.waitForFunction(() => window.DEVICE && window.DEVICE.ready, null, {timeout: 15000});
        await page.evaluate(() => window.DEVICE.ready);
        for (const s of scripts) await page.addScriptTag({content: s});
        const spec = {case: t.c, kind: t.kind, orderTag: t.order, order: t.order.split("").map(ch => PET[ch]), acts: t.c.solutions[t.order] || null,
          passive: t.passive, seed: SEED, radio: RADIO};
        if ((t.kind === "solve" || t.kind === "solo" || t.kind === "restart") && !spec.acts) r = {id: t.c.id, kind: t.kind, order: t.order, skip: true, why: "no solution path"};
        else r = await page.evaluate(spec => window.PT.run(spec), spec);
      } catch (e) {
        r = {id: t.c.id, kind: t.kind, order: t.order, ok: false, why: "exception: " + String(e.message || e).split("\n")[0]};
      }
      if (pageErrors.length) { r.ok = false; r.pageErrors = pageErrors; r.why = [r.why, "page errors: " + pageErrors.join(" | ")].filter(Boolean).join("; "); }
      if (t.passive != null) r.order = t.order + (t.passive === 1 ? " P2 passive" : " P1 passive");
      r.wallS = +((Date.now() - started) / 1000).toFixed(1);
      const known = KNOWN[[t.c.id, t.kind, t.passive].join("|")];
      if (known && !r.skip) { r.known = known; r.xfail = !r.ok; if (!r.ok) r.ok = true; else r.notes = (r.notes || []).concat("XPASS: known finding no longer happens"); }
      results.push(r);
      const st = r.skip ? "SKIP" : r.xfail ? "XFAIL" : r.ok ? "PASS" : "FAIL";
      const extra = r.skip ? r.why : `sim ${r.simS}s hearts ${r.hearts} anim ${r.shared ? r.shared.anim && r.shared.anim.measured : "?"} adv.state ${r.shared ? r.shared.advStateSize + "/" + r.shared.radioMaxAdvState : "?"} B` +
        (r.result && r.result.timeouts ? ` slot-timeouts ${r.result.timeouts}` : "") + (r.notes && r.notes.length ? " (" + r.notes.join(", ") + ")" : "") + (r.ok && !r.xfail ? "" : "  WHY: " + r.why) + (r.xfail ? "  [known: " + r.known + "]" : "");
      console.log(`${st} ${r.id.padEnd(4)} ${t.kind.padEnd(8)} ${String(r.order).padEnd(14)} ${extra}`);
      if (VERBOSE && r.trace && r.trace.length) for (const l of r.trace) console.log("       " + l);
      await page.close();
    }
  } finally {
    await browser.close();
  }
  const out = arg("--json", null);
  if (out) fs.writeFileSync(out, JSON.stringify(results, null, 1));
  const pass = results.filter(r => r.ok && !r.skip && !r.xfail).length, fail = results.filter(r => !r.ok && !r.skip).length,
    skip = results.filter(r => r.skip).length, xfail = results.filter(r => r.xfail).length;
  console.log(`\n${pass} passed, ${fail} failed, ${xfail} known (xfail), ${skip} skipped (site ${SITE}${RADIO ? ", relay radio" : ""})`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
