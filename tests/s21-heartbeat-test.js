// Heartbeat on results under a local page: while a local page (S21 initials `ranks.name`,
// S20 `ranks`) is open on top of the results screen, the handheld keeps sending its
// heartbeat (MSG_INPUT 0x01, every INPUT_PERIOD_MS), as the firmware does, so the
// central never sees a link loss (PLAYER_TIMEOUT_MS = 1 s).
//   racing    a Classic race into today's leaderboard (reset({rankTest, freshRank})) -> S21 opens
//             on both boards by itself; then S20 on top of results
//   battle    a quit -> results, S20 on both boards
//   adventure team down -> results, S20 on both boards
// Each page stays open 2.5 s; the central's received messages are logged by wrapping its radio node.
//   node -r ./tests/route.js tests/s21-heartbeat-test.js
const pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const BASE = 'http://127.0.0.1:8961/device.html';
const fails = [];
const check = (c, msg) => { if (!c) fails.push(msg); console.log((c ? 'ok   ' : 'FAIL ') + msg); return !!c; };

// in-page: one mode played into its results through the real session, then local pages held open
function holdAll(mode) {
  const D = window.DEVICE, out = {mode, cases: []};
  const key = p => D.screen(p).id;
  const until = (f, ms) => { for (let t = 0; t <= ms; t += 50) { if (f()) return true; D.step(50); } return !!f(); };
  D.reset({seed: 9, rankTest: true, freshRank: true});
  // log what the central hears: [time, player, message name]
  const rx = [];
  const node = D.world().radio.nodes[0], orig = node.rx;
  node.rx = (bytes, src) => {
    let name = '?';
    try { name = D.unpack(bytes).name; } catch {}
    rx.push([D.now(), src - 1, name]);
    return orig(bytes, src);
  };
  D.bot(0, true); D.bot(1, true);
  out.menu = until(() => key(0) === 'menu' && key(1) === 'menu', 10000);
  D.bot(0, false); D.step(300);
  const downs = {battle: 0, racing: 1, adventure: 2}[mode];
  for (let i = 0; i < downs; i++) { D.press(0, 'DOWN'); D.step(300); }
  D.press(0, 'A'); D.step(300);
  out.lobby = until(() => key(0) === 'lobby' && key(1) === 'lobby', 5000);
  D.press(0, 'A'); D.step(300); D.bot(0, true);
  const hud = {battle: 'battle.hud', racing: 'race.hud', adventure: 'adv.room'}[mode];
  out.hud = until(() => key(0) === hud && key(1) === hud, 20000);
  if (mode === 'battle') { D.step(2000); D.world().central.mode.inst.quit(1); }
  if (mode === 'adventure') { D.step(2000); D.debug('down'); }
  out.results = until(() => key(0) === 'results' && key(1) === 'results', 200000);
  D.bot(0, false); D.bot(1, false);

  // hold one page open for 2.5 s on both boards and look at what the central heard meanwhile
  const hold = (label, page) => {
    const t0 = D.now(), log0 = D.central().log.length;
    const seen = [new Set(), new Set()];
    for (let t = 0; t < 2500; t += 50) { D.step(50); seen[0].add(key(0)); seen[1].add(key(1)); }
    const t1 = D.now();
    const c = {label, page, seen: seen.map(s => [...s]), onPage: [0, 1].map(p => key(p) === page), maxGap: [0, 0], beats: [0, 0], raceInputs: [0, 0]};
    for (const p of [0, 1]) {
      let last = t0;
      for (const [t, q, name] of rx) {
        if (q !== p || t < t0 || t > t1) continue;
        if (name === 'race.input') c.raceInputs[p]++;
        if (name !== 'input' && name !== 'race.input') continue;
        if (name === 'input') c.beats[p]++;
        c.maxGap[p] = Math.max(c.maxGap[p], t - last); last = t;
      }
      c.maxGap[p] = Math.max(c.maxGap[p], t1 - last);
    }
    c.lost = D.central().log.slice(log0).filter(e => /link lost/.test(e.msg)).map(e => e.t + ' ' + e.msg);
    c.links = D.central().links.slice();
    out.cases.push(c);
  };
  if (mode === 'racing') {
    // S21 opens by itself once the 1.5 s results lock is over (both boards placed on Classic)
    out.s21 = until(() => key(0) === 'ranks.name' && key(1) === 'ranks.name', 4000);
    out.track = D.central().mode && D.central().mode.snapshot ? D.central().mode.snapshot.track : null;
    hold('S21 initials', 'ranks.name');
    // close S21 without saving (clear the page stack), then open S20 on top of results
    for (const p of [0, 1]) { const h = D.hh(p); h.local.stack = []; }
    D.step(300);
  }
  for (const p of [0, 1]) D.hh(p).ctx.go('ranks');
  D.step(100);
  hold('S20 leaderboard', 'ranks');
  out.errors = D.errors(); out.lint = D.lint();
  return out;
}

(async () => {
  const browser = await pw.chromium.launch();
  for (const mode of ['racing', 'battle', 'adventure']) {
    const ctx = await browser.newContext({viewport: {width: 1200, height: 900}});
    await ctx.addInitScript(() => { try { localStorage.clear(); } catch {} });
    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
    await page.goto(`${BASE}?test=1&lang=en`);
    await page.waitForFunction(() => window.DEVICE && window.DEVICE._started);
    const r = await page.evaluate(holdAll, mode);
    check(r.menu && r.lobby && r.hud && r.results, `${mode}: menu -> lobby -> game -> results (${[r.menu, r.lobby, r.hud, r.results]})`);
    if (mode === 'racing') {
      check(r.s21, `racing: S21 opened on both boards by itself on results`);
      check(r.track === 0, `racing: the track is Classic (index ${r.track})`);
    }
    for (const c of r.cases) {
      const tag = `${mode} ${c.label}`;
      check(c.onPage.every(Boolean), `${tag}: the page stayed open 2.5 s on both boards (${JSON.stringify(c.seen)})`);
      check(c.lost.length === 0, `${tag}: the central saw no link loss (${c.lost.join('; ')})`);
      check(c.links.every(Boolean), `${tag}: both links up at the end (${c.links})`);
      check(c.beats.every(n => n >= 20), `${tag}: heartbeats kept flowing (MSG_INPUT ${c.beats} in 2.5 s, want >= 20 each)`);
      check(c.maxGap.every(g => g <= 250), `${tag}: longest silence ${c.maxGap} ms (<= 250)`);
      if (mode === 'racing') check(c.raceInputs.every(n => n === 0), `${tag}: no race.input after the race (${c.raceInputs})`);
    }
    check(r.errors.length === 0, `${mode}: no errors ${JSON.stringify(r.errors).slice(0, 400)}`);
    check(r.lint.length === 0, `${mode}: no lint ${JSON.stringify(r.lint).slice(0, 400)}`);
    check(pageErrors.length === 0, `${mode}: no page errors ${pageErrors.join(' | ').slice(0, 400)}`);
    await ctx.close();
  }
  await browser.close();
  console.log(fails.length ? 'FAILED\n' + fails.join('\n') : 'ALL OK');
  process.exit(fails.length ? 1 : 0);
})();
