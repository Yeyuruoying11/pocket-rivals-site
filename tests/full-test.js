// End-to-end check of the handheld simulator in this repository (device.html + device-*.js
// + mode-*.js).
//
// One scripted P1 plus P2 on its bot, seeded and stepped by hand (?test=1), go
//   boot -> login (P1 creates a profile through S03-S05, P2 plays as guest)
//   -> connect -> vote -> lobby -> each of the three modes played to the end
//   by both bots -> results -> (battle) rematch, pause, Quit -> results
//   -> back to the menu -> settings (calibrate, about, edit profile) -> logout
//   confirm -> E1 error -> language switch from the handheld (page reload).
// Runs zh + en x 1200 / 390 px x light / dark, then once more with 30%
// packet loss. Asserts: no page errors, DEVICE.errors() empty, DEVICE.lint()
// empty (so: no text overflow, no canvas font fallback, no charset problem),
// no missing glyphs, no horizontal scroll, the boards agree on who won, and
// the same seed draws the same frames in every run of one language.
// Writes contact sheets r2-full-sheet-<lang>.png (every screen captured, both
// boards) and page shots r2-full-page-<tag>.png into tests/out/.
//
// usage: [ONLY=<tag>] node -r ./tests/route.js tests/full-test.js [SITE] [PORT]
//   ONLY (environment): one run, e.g. ONLY=zh-1200-light, ONLY=retry or ONLY=loss; default: every run
//   SITE: the folder with device.html (default: the repository root); PORT: default 8820.
//   The page requests are answered by tests/route.js, so no server is started here.
const pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const {spawn} = require('child_process');
const net = require('net');
const fs = require('fs');
const path = require('path');

const SITE = process.argv[2] || path.resolve(__dirname, '..');
const PORT = +(process.argv[3] || 8820);
const OUT = process.env.OUT || path.join(__dirname, 'out');
fs.mkdirSync(OUT, {recursive: true});
const BASE = `http://127.0.0.1:${PORT}`;
const SEED = 21;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const failures = [];
const check = (cond, msg) => { if (!cond) { failures.push(msg); console.log('  FAIL ' + msg); } return !!cond; };

// in-page helpers (installed on every load, also after the language reload)
function installHelpers() {
  const D = window.DEVICE;
  const key = p => { const s = D.screen(p); return s.id + (s.overlay ? '/' + s.overlay : ''); };
  const HUD = /^(battle\.hud|race\.hud|adv\.room)$/;
  const F = window.__F = window.__F || {shots: [], seenPair: {}, trace: [], stable: [null, null], hudShots: {}};
  F.key = key;
  F.capture = label => {
    const ids = [key(0), key(1)];
    const shot = {label, ids, t: D.now(), hash: [D.hash(0), D.hash(1)], png: [D.png(0, 2), D.png(1, 2)]};
    F.shots.push(shot);
    F.trace.push([label, ids.join(','), shot.hash.join(',')]);
    return ids;
  };
  // capture a pair the first time a board shows a new screen (after 400 ms on it),
  // and the game screens every 6 s (up to 5 each)
  F.auto = () => {
    for (const p of [0, 1]) {
      const k = key(p), st = F.stable[p];
      if (!st || st.k !== k) F.stable[p] = {k, t: D.now()};
    }
    // both boards must have been on their screen for 400 ms (the wipe is over)
    if (F.stable.some(st => D.now() - st.t < 400)) return;
    for (const p of [0, 1]) {
      const k = key(p);
      const pair = key(0) + '|' + key(1);
      if (!F.seenPair[pair]) { F.seenPair[pair] = true; F.capture('auto'); }
      if (HUD.test(k) && p === 0) {
        const h = F.hudShots[k] || (F.hudShots[k] = {n: 0, last: D.now()});
        if (h.n < 5 && D.now() - h.last >= 6000) { h.n++; h.last = D.now(); F.capture('play'); }
      }
    }
  };
  F.step = ms => { for (let t = 0; t < ms; t += 50) { D.step(50); F.auto(); } };
  F.until = (src, maxMs) => {
    const pred = new Function('D', 'F', 'return (' + src + ');');
    for (let t = 0; t <= maxMs; t += 50) { if (pred(D, F)) return true; D.step(50); F.auto(); }
    return !!pred(D, F);
  };
  F.press = (p, btn, ms = 60, after = 220) => { D.press(p, btn, ms); F.step(ms + after); };
}

async function run(browser, o) {
  const {lang, width, scheme, loss} = o;
  const tag = `${lang}-${width}-${scheme}${loss ? '-loss' : ''}`;
  console.log(`== ${tag}`);
  const ctx = await browser.newContext({viewport: {width, height: width < 500 ? 844 : 900}, deviceScaleFactor: 1, colorScheme: scheme});
  await ctx.addInitScript(L => {
    if (!sessionStorage.getItem('t.init')) { localStorage.clear(); localStorage.setItem('pr.lang', L); sessionStorage.setItem('t.init', '1'); }
  }, lang);
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
  await page.goto(`${BASE}/device.html?test=1&seed=${SEED}&view=both`);
  await page.evaluate(() => DEVICE.ready.then(() => 1));
  await page.evaluate(installHelpers);
  const E = (fn, arg) => page.evaluate(fn, arg);
  const until = async (src, maxMs, what) => check(await E(([s, m]) => __F.until(s, m), [src, maxMs]), `${tag}: ${what} (at ${await E(() => __F.key(0) + ' | ' + __F.key(1))})`);
  const press = (p, btn, ms = 60, after = 220) => E(([p, b, m, a]) => __F.press(p, b, m, a), [p, btn, ms, after]);
  const step = ms => E(m => __F.step(m), ms);
  const cap = label => E(l => __F.capture(l), label);
  const scr = p => E(p => __F.key(p), p);
  const noHScroll = async where => {
    const r = await E(() => ({sw: document.documentElement.scrollWidth, bw: document.body.scrollWidth, iw: window.innerWidth}));
    check(r.sw <= r.iw && r.bw <= r.iw, `${tag}: horizontal scroll at ${where} (${r.sw}/${r.bw} > ${r.iw})`);
  };
  const lintNow = async where => {
    const r = await E(() => ({errors: DEVICE.errors(), lint: DEVICE.lint(), missing: DEVICE.glyphs().missing}));
    check(r.errors.length === 0, `${tag}: DEVICE.errors at ${where} ${JSON.stringify(r.errors).slice(0, 500)}`);
    check(r.lint.length === 0, `${tag}: lint at ${where} ${JSON.stringify(r.lint).slice(0, 700)}`);
    check(!r.missing || r.missing.length === 0, `${tag}: missing glyphs at ${where} ${JSON.stringify(r.missing)}`);
  };

  await E(l => { if (l) DEVICE.radio.set({loss: l}); DEVICE.bot(1, true); }, loss || 0);
  await noHScroll('start');
  await page.screenshot({path: path.join(OUT, `r2-full-page-${tag}.png`), fullPage: true});

  // ---- S01 boot -> S02 login: P1 makes a profile, P2 (bot) plays as guest
  await until(`F.key(0) === 'boot' && F.key(1) === 'boot'`, 500, 'boot on both');
  await step(300); await cap('boot');
  await press(0, 'A');
  await until(`F.key(0) === 'login'`, 1500, 'P1 login');
  await step(300); await cap('login');
  await press(0, 'UP');                               // GUEST -> NEW
  await press(0, 'A');
  await until(`F.key(0) === 'login.name'`, 1000, 'P1 name keyboard');
  for (const b of ['A', 'RIGHT', 'A', 'DOWN', 'A']) await press(0, b);  // types A B I
  await cap('name-typed');
  await press(0, 'SKILL');                            // random name
  await cap('name-random');
  await press(0, 'MENU');                             // done
  await until(`F.key(0) === 'login.avatar'`, 1000, 'P1 avatar');
  await step(1600); await press(0, 'RIGHT'); await cap('avatar');
  await press(0, 'A');
  await until(`F.key(0) === 'login.color'`, 1000, 'P1 colour');
  await press(0, 'RIGHT'); await cap('color');
  await press(0, 'A');
  await until(`F.key(0) === 'connect' || F.key(0) === 'menu'`, 2000, 'P1 saved and logged in');
  await until(`F.key(0) === 'menu' && F.key(1) === 'menu'`, 8000, 'both on the menu');
  await step(400); await cap('menu');
  const prof = await E(() => DEVICE.central().session.profiles.map(p => p && p.name));
  console.log('  profiles', JSON.stringify(prof));
  const myName = await E(() => DEVICE.hh(0).ctx.profiles.current());
  check(myName && myName.slot !== "guest" && myName.profile.name.length > 0, `${tag}: P1 is a saved profile (${JSON.stringify(myName)})`);
  check(await E(() => DEVICE.hh(1).ctx.profiles.current().slot) === 'guest', `${tag}: P2 is a guest`);

  // ---- the three modes
  const modes = [['battle', 'battle.pick', 'battle.hud'], ['racing', 'race.pick', 'race.hud'], ['adventure', 'adv.pick', 'adv.room']];
  for (let k = 0; k < modes.length; k++) {
    const [id, pick, hud] = modes[k];
    for (let i = 0; i < k; i++) await press(0, 'DOWN');
    await press(0, 'A');
    await step(300); await cap(`${id}-voted`);
    await until(`DEVICE.central().session.phase === 2`, 4000, `${id}: AGREED`);
    await step(200); await cap(`${id}-agreed`);
    await until(`F.key(0) === 'lobby' && F.key(1) === 'lobby'`, 4000, `${id}: lobby`);
    await step(300); await cap(`${id}-lobby`);
    await press(0, 'A');
    if (id === 'adventure') {   // round 3: the two players vote a world first (adv.world)
      await until(`F.key(0) === 'adv.world'`, 6000, 'adventure: world vote');
      await step(400); await cap('adventure-world');
      await press(0, 'A');
    }
    await until(`F.key(0) === '${pick}'`, 6000, `${id}: pick`);
    await step(400); await cap(`${id}-pick`);
    await E(() => DEVICE.bot(0, true));
    await until(`F.key(0).startsWith('${hud}') && F.key(1).startsWith('${hud}')`, 15000, `${id}: game screen`);
    if (id === 'racing') {
      // a short radio drop mid-race: P1 sees link lost, P2 no signal
      await step(6000);
      await E(() => DEVICE.radio.unplug(1, true));
      await until(`F.key(0).endsWith('ov.linklost') && F.key(1).endsWith('ov.nosignal')`, 4000, 'racing: link lost / no signal');
      await step(800); await cap('racing-linklost');
      await E(() => DEVICE.radio.unplug(1, false));
      await until(`!F.key(0).includes('/ov.') && !F.key(1).includes('/ov.')`, 6000, 'racing: link back');
    }
    if (id === 'adventure') {
      // the pause menu lists the mode's "Retry room": use it once
      await step(5000);
      await E(() => DEVICE.bot(0, false));
      await press(0, 'MENU', 1150, 300);
      if (await until(`F.key(0).endsWith('ov.pause')`, 20000, 'adventure: pause')) {
        await cap('adventure-pause');
        await press(0, 'DOWN'); await press(0, 'DOWN'); await press(0, 'DOWN');
        await press(0, 'A'); await cap('adventure-retry-ask');
        await press(0, 'A');
        await until(`!F.key(0).includes('/ov.')`, 4000, 'adventure: retry room closes the pause');
        await step(300); await cap('adventure-retry-count');
      }
      await E(() => DEVICE.bot(0, true));
    }
    const done = await until(`F.key(0) === 'results' && F.key(1) === 'results'`, id === 'adventure' ? 900000 : 600000, `${id}: played to the end`);
    await E(() => DEVICE.bot(0, false));
    if (!done) break;
    await step(400); await cap(`${id}-results`);
    const res = await E(id => {
      const md = DEVICE.mode(id);
      return {over: DEVICE.central().mode ? null : 1, r: [0, 1].map(p => { const r = md.player.results(DEVICE.hh(p).ctx); return {title: r.titleKey, win: r.win}; })};
    }, id);
    console.log(`  ${id} results`, JSON.stringify(res.r));
    if (id === 'adventure') check(res.r[0].win === res.r[1].win, `${tag}: adventure, both boards agree (${JSON.stringify(res.r)})`);
    else check(res.r[0].win === !res.r[1].win, `${tag}: ${id}, one winner both boards agree on (${JSON.stringify(res.r)})`);
    await step(1400);
    if (id === 'battle') {
      // rematch: P2's bot asks after 2 s, P1 accepts
      const match = await E(() => DEVICE.central().match);
      await step(800); await cap('battle-results-rival-again');
      await press(0, 'A');
      await until(`F.key(0) === 'battle.pick' && F.key(1) === 'battle.pick'`, 4000, 'battle: rematch');
      check(await E(() => DEVICE.central().match) === match + 1, `${tag}: rematch bumps the match`);
      await E(() => DEVICE.bot(0, true));
      await until(`F.key(0) === 'battle.hud' && F.key(1) === 'battle.hud'`, 15000, 'battle: rematch hud');
      await step(4000);
      await E(() => DEVICE.bot(0, false));
      // hold M: pauses at once as the attacker, else at the next safe point (§4.11)
      await press(0, 'MENU', 1150, 300);
      if (await until(`F.key(0).endsWith('ov.pause')`, 30000, 'battle: pause')) {
        await step(300); await cap('battle-pause');
        await press(0, 'DOWN'); await press(0, 'DOWN'); await press(0, 'A');
        await cap('battle-quit-ask');
        await press(0, 'A');
        await until(`F.key(0) === 'results' && F.key(1) === 'results'`, 4000, 'battle: quit -> results');
        await step(400); await cap('battle-results-quit');
        const q = await E(() => [0, 1].map(p => DEVICE.mode('battle').player.results(DEVICE.hh(p).ctx).titleKey));
        check(q[0] === 'dev.res.youQuit' && q[1] === 'dev.res.rivalQuit', `${tag}: quit titles (${q})`);
        await step(1400);
      }
    }
    await press(0, 'B');
    await until(`F.key(0) === 'menu' && F.key(1) === 'menu'`, 4000, `${id}: back to the menu`);
    check(await E(() => DEVICE.central().session.vote.every(v => v === 255)), `${tag}: votes cleared after ${id}`);
    await noHScroll(id);
    await step(300);
  }
  await lintNow('after the modes');

  // ---- settings, calibrate, about, edit profile
  await press(0, 'MENU');
  await until(`F.key(0) === 'settings'`, 1000, 'settings');
  await step(300); await cap('settings');
  for (let i = 0; i < 4; i++) await press(0, 'DOWN');
  await press(0, 'A');
  await until(`F.key(0) === 'settings.cal'`, 1000, 'calibrate');
  await E(() => DEVICE.hold(0, 'PAD', true)); await step(600); await cap('calibrate');
  await E(() => DEVICE.hold(0, 'PAD', false)); await step(300);
  await press(0, 'B');
  await until(`F.key(0) === 'settings'`, 1000, 'back to settings');
  for (let i = 0; i < 5; i++) await press(0, 'UP');   // cal (row 4) -> lang -> about (last row)
  await press(0, 'A'); await step(300); await cap('about');
  await press(0, 'B');
  await press(0, 'UP'); await press(0, 'A');        // edit profile
  await until(`F.key(0) === 'login.edit'`, 1000, 'edit profile');
  await step(300); await cap('edit-profile');
  await press(0, 'B');
  await until(`F.key(0) === 'settings'`, 1000, 'edit -> settings');
  await press(0, 'B');
  await until(`F.key(0) === 'menu'`, 1000, 'settings -> menu');
  // logout confirm (B with no vote), cancelled
  await press(0, 'B');
  await until(`F.key(0) === 'menu/ov.confirm'`, 1000, 'logout confirm');
  await step(300); await cap('logout-confirm');
  await press(0, 'B');
  await until(`F.key(0) === 'menu'`, 1000, 'confirm cancelled');
  // E1 on P2: wrong firmware version, then fixed
  await E(() => DEVICE.radio.version(2, 7));
  await until(`F.key(1).endsWith('ov.error')`, 4000, 'E1 on P2');
  await step(300); await cap('error-e1');
  await E(() => DEVICE.radio.version(2, 6));
  await until(`!F.key(1).includes('/ov.')`, 4000, 'E1 cleared');
  await step(1500);
  await lintNow('before the language switch');
  check(pageErrors.length === 0, `${tag}: page errors ${pageErrors.join(' | ').slice(0, 400)}`);

  // keep what this page captured before the reload
  const before = await E(() => ({shots: __F.shots, trace: __F.trace}));

  // ---- language switch from the handheld: S09 row 0, RIGHT -> I18N.set -> reload
  await press(0, 'MENU');
  await until(`F.key(0) === 'settings'`, 1000, 'settings before the switch');
  await Promise.all([page.waitForNavigation({timeout: 8000}).catch(() => null), press(0, 'RIGHT')]);
  await page.evaluate(() => DEVICE.ready.then(() => 1));
  await page.evaluate(installHelpers);
  const other = lang === 'zh' ? 'en' : 'zh';
  check(await E(() => I18N.lang) === other, `${tag}: language switched to ${other}`);
  await E(() => DEVICE.bot(1, true));
  await until(`F.key(0) === 'settings'`, 2000, 'back on settings after the reload');
  await until(`F.key(1) === 'menu' || F.key(1) === 'connect'`, 4000, 'P2 after the reload');
  await step(300); await cap('after-lang-switch');
  check(await E(() => { const c = DEVICE.hh(0).ctx.profiles.current(); return c && c.slot !== 'guest'; }), `${tag}: P1 still logged in after the reload`);
  await press(0, 'B');
  await until(`F.key(0) === 'menu' && F.key(1) === 'menu'`, 4000, 'menu after the switch');
  await step(300); await cap('menu-after-switch');
  await lintNow('end');
  await noHScroll('end');
  check(pageErrors.length === 0, `${tag}: page errors ${pageErrors.join(' | ').slice(0, 400)}`);
  await page.screenshot({path: path.join(OUT, `r2-full-page-end-${tag}.png`), fullPage: true});
  const after = await E(() => ({shots: __F.shots, trace: __F.trace}));
  await ctx.close();
  return {tag, lang, shots: before.shots.concat(after.shots), trace: before.trace.concat(after.trace)};
}

// adventure: team down in room 1-3 -> results "Retry" -> both press A -> that room again with 3 hearts
async function retryRoomCheck(browser) {
  console.log('== adventure team down -> retry room (real session)');
  const ctx = await browser.newContext({viewport: {width: 1200, height: 900}});
  await ctx.addInitScript(() => { localStorage.clear(); localStorage.setItem('pr.lang', 'en'); });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.goto(`${BASE}/device.html?test=1&seed=9&view=both`);
  await page.evaluate(() => DEVICE.ready.then(() => 1));
  await page.evaluate(installHelpers);
  const r = await page.evaluate(() => {
    const D = DEVICE, F = __F, out = {};
    D.bot(0, true); D.bot(1, true);
    out.menu = F.until("F.key(0) === 'menu' && F.key(1) === 'menu'", 10000);
    D.bot(0, false); F.step(300);
    F.press(0, 'DOWN'); F.press(0, 'DOWN'); F.press(0, 'A');
    out.lobby = F.until("F.key(0) === 'lobby' && F.key(1) === 'lobby'", 5000);
    F.press(0, 'A'); D.bot(0, true);
    out.room = F.until("F.key(0) === 'adv.room' && F.key(1) === 'adv.room'", 15000);
    D.debug('room', 2); F.step(4000);
    D.debug('down');
    out.results = F.until("F.key(0) === 'results' && F.key(1) === 'results'", 6000);
    D.bot(0, false);
    out.titles = [0, 1].map(p => D.mode('adventure').player.results(D.hh(p).ctx).titleKey);
    F.step(1600); F.capture('adv-team-down');
    F.press(0, 'A');
    out.back = F.until("F.key(0) === 'adv.room' && F.key(1) === 'adv.room'", 5000);
    F.step(300); F.capture('adv-retry-room');
    const st = D.debug('state');
    out.state = st ? [st.room, st.hearts] : null;
    out.errors = D.errors().length; out.lint = D.lint();
    return out;
  });
  console.log('  ' + JSON.stringify(r));
  check(r.menu && r.lobby && r.room && r.results, `retry room: reached the team-down results (${JSON.stringify(r)})`);
  check(r.titles.every(t => t === 'dev.adv.teamDown'), `retry room: TEAM DOWN on both (${r.titles})`);
  check(r.back && r.state && r.state[0] === 2 && r.state[1] === 3, `retry room: room 1-3 again with 3 hearts (${JSON.stringify(r.state)})`);
  check(r.errors === 0 && r.lint.length === 0 && errs.length === 0, `retry room: clean (${JSON.stringify(r.lint)} ${errs})`);
  const shots = await page.evaluate(() => __F.shots);
  await ctx.close();
  return shots;
}

async function sheet(browser, rows, file, title) {
  const ctx = await browser.newContext({viewport: {width: 800, height: 600}});
  const page = await ctx.newPage();
  const url = await page.evaluate(async ([rows, title]) => {
    const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = src; });
    const cols = 5, cw = 256 * 2 + 28, chh = 320 + 34, top = 30;
    const cv = document.createElement('canvas');
    cv.width = cols * cw; cv.height = top + Math.ceil(rows.length / cols) * chh;
    const c = cv.getContext('2d');
    c.fillStyle = '#1c1c20'; c.fillRect(0, 0, cv.width, cv.height);
    c.fillStyle = '#ececef'; c.font = 'bold 16px sans-serif'; c.fillText(title, 8, 20);
    c.font = '13px sans-serif';
    for (let i = 0; i < rows.length; i++) {
      const x = (i % cols) * cw, y = top + Math.floor(i / cols) * chh;
      c.fillStyle = '#ececef';
      c.fillText(`${i + 1}. ${rows[i].label}  [${rows[i].ids.join(' | ')}]`.slice(0, 80), x + 8, y + 16);
      for (let p = 0; p < 2; p++) c.drawImage(await load(rows[i].png[p]), x + 8 + p * 264, y + 24);
    }
    return cv.toDataURL('image/png');
  }, [rows, title]);
  fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  await ctx.close();
}

(async () => {
  // with the route.js preload every request is answered from SITE, so no server is needed
  const routed = !!global.PR_ROUTED;
  const free = routed ? false : await new Promise(r => { const s = net.createServer().once('error', () => r(false)).once('listening', () => s.close(() => r(true))); s.listen(PORT, '127.0.0.1'); });
  const srv = free ? spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd: SITE, stdio: 'ignore'}) : null;
  let browser;
  const t0 = Date.now();
  try {
    if (!routed) for (let i = 0; i < 40; i++) {
      const up = await new Promise(r => { const s = net.connect(PORT, '127.0.0.1', () => { s.end(); r(true); }); s.on('error', () => r(false)); });
      if (up) break;
      await sleep(100);
    }
    browser = await pw.chromium.launch();
    const runs = [];
    const only = process.env.ONLY;   // e.g. ONLY=zh-1200-light
    for (const lang of ['zh', 'en']) for (const width of [1200, 390]) for (const scheme of ['light', 'dark']) {
      if (only && only !== `${lang}-${width}-${scheme}`) continue;
      runs.push(await run(browser, {lang, width, scheme}));
      console.log(`  ${runs[runs.length - 1].shots.length} frames, ${((Date.now() - t0) / 1000).toFixed(0)} s so far`);
    }
    if (!only || only === 'retry') { const rs = await retryRoomCheck(browser); await sheet(browser, rs, path.join(OUT, 'r2-full-sheet-retry.png'), 'Adventure: team down -> retry room'); }
    if (!only || only === 'loss') runs.push(await run(browser, {lang: 'zh', width: 1200, scheme: 'light', loss: 0.3}));
    // determinism: every run of one language (no loss) draws the same frames
    for (const lang of ['zh', 'en']) {
      const rs = runs.filter(r => r.lang === lang && !r.tag.endsWith('-loss'));
      for (const r of rs.slice(1)) {
        const a = JSON.stringify(rs[0].trace), b = JSON.stringify(r.trace);
        let at = rs[0].trace.findIndex((x, i) => JSON.stringify(x) !== JSON.stringify(r.trace[i]));
        check(a === b, `determinism: ${r.tag} differs from ${rs[0].tag} at frame ${at} (${JSON.stringify(rs[0].trace[at])} vs ${JSON.stringify(r.trace[at])})`);
      }
      const base = rs.find(r => r.tag === `${lang}-1200-light`) || rs[0];
      if (base) {
        const file = path.join(OUT, `r2-full-sheet-${lang}.png`);
        await sheet(browser, base.shots, file, `Pocket Rivals simulator, every screen captured (${base.tag}, seed ${SEED}; left P1, right P2)`);
        console.log('  sheet', file, base.shots.length, 'frames');
        fs.writeFileSync(path.join(OUT, `r2-full-trace-${lang}.json`), JSON.stringify(base.trace, null, 0));
      }
    }
    const lossRun = runs.find(r => r.tag.endsWith('-loss'));
    if (lossRun) await sheet(browser, lossRun.shots, path.join(OUT, 'r2-full-sheet-zh-loss.png'), `30% packet loss (${lossRun.tag})`);
  } catch (e) {
    failures.push('exception: ' + (e && e.stack || e));
    console.log(e);
  } finally {
    if (browser) await browser.close();
    if (srv) srv.kill();
  }
  console.log(`\n${((Date.now() - t0) / 1000).toFixed(0)} s`);
  console.log(failures.length ? `FAILED (${failures.length})\n` + failures.join('\n') : 'ALL PASS');
  process.exit(failures.length ? 1 : 0);
})();
