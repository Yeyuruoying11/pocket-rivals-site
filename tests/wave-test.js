// Swipe-to-wipe test (design doc 5.11): while Tide's splash blocks my view, each
// LEFT or RIGHT swipe recognised by the gesture sensor (APDS-9960) cuts
// RACE_WIPE_CUT_MS off the remaining time (two swipes >= RACE_WIPE_GAP_MS apart),
// UP / DOWN and the proximity alone do nothing, the streak follows the swipe,
// and it all stays on my own board.
//   node -r ./tests/route.js tests/wave-test.js
const pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const BASE = 'http://127.0.0.1:8961/device.html';
const fails = [];
const check = (c, msg) => { if (!c) fails.push(msg); console.log((c ? 'ok   ' : 'FAIL ') + msg); return !!c; };

// in-page: every check, each one a fresh race with seed 23 (fixture race.splash steps)
function waveAll() {
  const D = window.DEVICE, out = {};
  const prep = (extra) => {
    // a long RACE_SPLASH_MS so two 500 ms cuts still fit inside the splash (R0 ~ 3.7 s)
    D.reset({seed: 23, mode: "racing", params: {racing: Object.assign({laps: 1, splashMs: 4000}, extra || {})}});
    D.step(1200);
    D.debug("pick", 1);
    D.step(3800);
    D.debug("splash", 1);
    D.step(300);
  };
  const M = p => D.hh(p).ctx.m;
  const rem = () => M(1).car.splashUntil - M(1).raceT;
  const flags = () => (M(1).raceT < M(1).car.splashUntil ? 32 : 0);   // CF.SPLASHED
  const cnt = () => M(1).wave.count;

  // a) baseline, no swipes
  prep();
  out.r0 = rem(); out.h0 = D.hash(1);
  // b) two swipes with the swipe key (RIGHT, LEFT)
  prep();
  for (let i = 0; i < 2; i++) { D.press(1, "SWIPE", 80); D.step(300); }
  out.r2 = rem(); out.c2 = cnt();
  // c) four swipes: the splash is over
  prep();
  for (let i = 0; i < 4; i++) { D.press(1, "SWIPE", 80); D.step(600); }
  out.r4 = rem(); out.f4 = flags(); out.c4 = cnt();
  // d) two swipes 80 ms apart: one counted
  prep();
  const d0 = cnt();
  D.swipe(1, "LEFT"); D.step(80); D.swipe(1, "RIGHT"); D.step(20);
  out.cd = cnt() - d0;
  // e) UP / DOWN swipes and the proximity alone do nothing
  prep(); D.step(600); out.rE0 = rem();
  prep();
  D.swipe(1, "UP"); D.step(200); D.swipe(1, "DOWN"); D.step(200); D.prox(1, 255); D.step(200); D.prox(1, 0);
  out.rE = rem(); out.ce = cnt();
  // f) P1 swiping 3 times does not touch P2
  prep(); D.step(900); out.rB = rem();
  prep();
  for (let i = 0; i < 3; i++) { D.press(0, "SWIPE", 80); D.step(300); }
  out.rF = rem(); out.p1s = M(0).car.splashUntil;
  // g) the streak shows on P2's board, follows the swipe, and P1's swiping changes nothing there
  prep(); D.step(920); D.step(80); out.hBase = D.hash(1);
  prep(); D.step(920); D.press(0, "SWIPE", 200); D.step(80); out.hP1 = D.hash(1);
  prep(); D.step(920); D.swipe(1, "RIGHT"); D.step(80); out.hR = D.hash(1); out.cg = cnt(); out.dR = M(1).wave.dir;
  prep(); D.step(920); D.swipe(1, "LEFT"); D.step(80); out.hL = D.hash(1); out.dL = M(1).wave.dir;
  // h) a custom RACE_WIPE_CUT_MS
  prep({wipeCutMs: 1000}); D.swipe(1, "LEFT"); D.step(300); out.rH = rem();
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
    check(r.r0 > 1000, `${lang} a: no swipes, ${r.r0} ms blocked left (> 1000)`);
    check(Math.abs(r.r2 - (r.r0 - 600 - 1000)) <= 20, `${lang} b: 2 swipes leave ${r.r2} ms (expected ${r.r0 - 1600})`);
    check(r.c2 === 2, `${lang} b: 2 swipes counted (${r.c2})`);
    check(r.r4 <= 0 && r.f4 === 0, `${lang} c: 4 swipes end the splash (${r.r4} ms left, flags 0x${r.f4.toString(16)}, ${r.c4} swipes)`);
    check(r.cd === 1, `${lang} d: two swipes 80 ms apart = ${r.cd} counted`);
    check(r.rE === r.rE0 && r.ce === 0, `${lang} e: up / down / proximity wipe nothing (${r.rE} vs ${r.rE0} ms, ${r.ce} counted)`);
    check(r.rF === r.rB, `${lang} f: P1's swipes leave P2's splash alone (${r.rF} vs ${r.rB} ms)`);
    check(r.p1s === 0, `${lang} f: P1 was never splashed (${r.p1s})`);
    check(r.hR !== r.hBase && r.hL !== r.hBase, `${lang} g: the wiped streak shows right after a swipe (${r.hR} / ${r.hL} vs ${r.hBase})`);
    check(r.hR !== r.hL && r.dR === 'RIGHT' && r.dL === 'LEFT', `${lang} g: the streak follows the swipe (${r.dR} ${r.hR}, ${r.dL} ${r.hL})`);
    check(r.hP1 === r.hBase, `${lang} g: P1 swiping changes nothing on P2's board (${r.hP1} vs ${r.hBase})`);
    check(r.cg === 1, `${lang} g: one swipe for the streak (${r.cg})`);
    check(Math.abs(r.rH - (r.r0 - 300 - 1000)) <= 20, `${lang} h: wipeCutMs 1000: one swipe leaves ${r.rH} ms (expected ${r.r0 - 1300})`);
    check(r.errors.length === 0, `${lang} h: no errors ${JSON.stringify(r.errors).slice(0, 400)}`);
    check(r.lint.length === 0, `${lang} h: no lint ${JSON.stringify(r.lint).slice(0, 400)}`);
    check(pageErrors.length === 0, `${lang} h: no page errors ${pageErrors.join(' | ').slice(0, 400)}`);
    await page.close();
  }
  await browser.close();
  console.log(fails.length ? 'FAILED\n' + fails.join('\n') : 'ALL OK');
  process.exit(fails.length ? 1 : 0);
})();
