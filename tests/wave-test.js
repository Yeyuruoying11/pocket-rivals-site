// Wave test (design doc 5.11): while Tide's splash blocks my view, waving a hand over
// the distance sensor wipes it faster (far -> near -> far = one wave, RACE_WIPE_CUT_MS
// off the remaining time, two waves >= RACE_WIPE_GAP_MS apart), on my own board only.
//   node -r ./tests/route.js tests/wave-test.js
const pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const BASE = 'http://127.0.0.1:8961/device.html';
const fails = [];
const check = (c, msg) => { if (!c) fails.push(msg); console.log((c ? 'ok   ' : 'FAIL ') + msg); return !!c; };

// in-page: every check, each one a fresh race with seed 23 (fixture race.splash steps)
function waveAll() {
  const D = window.DEVICE, out = {};
  const prep = () => {
    // a long RACE_SPLASH_MS so two 500 ms cuts still fit inside the splash (R0 ~ 3.7 s)
    D.reset({seed: 23, mode: "racing", params: {racing: {laps: 1, splashMs: 4000}}});
    D.step(1200);
    D.debug("pick", 1);
    D.step(3800);
    D.debug("splash", 1);
    D.step(300);
    D.hand(0, 1300); D.hand(1, 1300);
  };
  const M = p => D.hh(p).ctx.m;
  const rem = () => M(1).car.splashUntil - M(1).raceT;
  const flags = () => (M(1).raceT < M(1).car.splashUntil ? 32 : 0);   // CF.SPLASHED
  const cnt = () => M(1).wave.count;

  // a) baseline, no waves
  prep();
  out.r0 = rem(); out.h0 = D.hash(1);
  // b) two waves
  prep();
  for (let i = 0; i < 2; i++) { D.press(1, "WAVE", 80); D.step(300); }
  out.r2 = rem(); out.c2 = cnt();
  // c) four waves: the splash is over
  prep();
  for (let i = 0; i < 4; i++) { D.press(1, "WAVE", 80); D.step(600); }
  out.r4 = rem(); out.f4 = flags(); out.c4 = cnt();
  // d) two nears < 150 ms apart: one wave only
  prep();
  const d0 = cnt();
  D.hold(1, "WAVE", true); D.step(40); D.hold(1, "WAVE", false); D.step(40);
  D.hold(1, "WAVE", true); D.step(40); D.hold(1, "WAVE", false); D.step(20);
  out.cd = cnt() - d0;
  // e) the hand 1300 -> 60 -> 1300 mm is one wave
  prep();
  const e0 = cnt();
  D.hand(1, 1300); D.step(100); D.hand(1, 60); D.step(100); D.hand(1, 1300); D.step(100);
  out.ce = cnt() - e0;
  // f) P1 waving 3 times does not touch P2
  prep(); D.step(900); out.rB = rem();
  prep();
  for (let i = 0; i < 3; i++) { D.press(0, "WAVE", 80); D.step(300); }
  out.rF = rem(); out.p1s = M(0).car.splashUntil;
  // g) the streak shows on P2's board, and P1's waving changes nothing there
  prep(); D.step(920); D.step(80); out.hBase = D.hash(1);
  prep(); D.step(920); D.press(0, "WAVE", 200); D.step(80); out.hP1 = D.hash(1);
  prep(); D.step(920); D.press(1, "WAVE", 80); D.step(80); out.hWave = D.hash(1); out.cg = cnt();
  out.errors = D.errors(); out.lint = D.lint();
  return out;
}

(async () => {
  const browser = await pw.chromium.launch();
  for (const lang of ['zh', 'en']) {
    const page = await browser.newPage({viewport: {width: 1200, height: 900}});
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
    await page.goto(`${BASE}?test=1&lang=${lang}`);
    await page.waitForFunction(() => window.DEVICE && window.DEVICE._started);
    const r = await page.evaluate(waveAll);
    check(r.r0 > 1000, `${lang} a: no waves, ${r.r0} ms blocked left (> 1000)`);
    check(Math.abs(r.r2 - (r.r0 - 600 - 1000)) <= 20, `${lang} b: 2 waves leave ${r.r2} ms (expected ${r.r0 - 1600})`);
    check(r.c2 === 2, `${lang} b: 2 waves counted (${r.c2})`);
    check(r.r4 <= 0 && r.f4 === 0, `${lang} c: 4 waves end the splash (${r.r4} ms left, flags 0x${r.f4.toString(16)}, ${r.c4} waves)`);
    check(r.cd === 1, `${lang} d: two nears 80 ms apart = ${r.cd} wave`);
    check(r.ce === 1, `${lang} e: hand 1300 -> 60 -> 1300 mm = ${r.ce} wave`);
    check(r.rF === r.rB, `${lang} f: P1's waves leave P2's splash alone (${r.rF} vs ${r.rB} ms)`);
    check(r.p1s === 0, `${lang} f: P1 was never splashed (${r.p1s})`);
    check(r.hWave !== r.hBase, `${lang} g: the wiped streak shows right after a wave (${r.hWave} vs ${r.hBase})`);
    check(r.hP1 === r.hBase, `${lang} g: P1 waving changes nothing on P2's board (${r.hP1} vs ${r.hBase})`);
    check(r.cg === 1, `${lang} g: one wave for the streak (${r.cg})`);
    check(r.errors.length === 0, `${lang} h: no errors ${JSON.stringify(r.errors).slice(0, 400)}`);
    check(r.lint.length === 0, `${lang} h: no lint ${JSON.stringify(r.lint).slice(0, 400)}`);
    check(pageErrors.length === 0, `${lang} h: no page errors ${pageErrors.join(' | ').slice(0, 400)}`);
    await page.close();
  }
  await browser.close();
  console.log(fails.length ? 'FAILED\n' + fails.join('\n') : 'ALL OK');
  process.exit(fails.length ? 1 : 0);
})();
