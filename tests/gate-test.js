// Hand-gate (§6.11): the distance sensor holds the winch gate, max(pad, hand) in
// MSG_INPUT, meters, thresholds, strain, the wave key and a custom handFarMm, zh and en.
//   node -r ./tests/route.js tests/gate-test.js
const pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const browser = await pw.chromium.launch();
  const fails = [];
  for (const lang of ['zh', 'en']) {
    const page = await browser.newPage({viewport: {width: 1200, height: 900}});
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(`http://127.0.0.1:8961/device.html?test=1&lang=${lang}`);
    await page.waitForFunction(() => window.DEVICE && window.DEVICE._started);
    const ok = (name, cond, extra) => (cond || fails.push(`${lang} ${name}`), console.log(`${lang} ${cond ? 'OK  ' : 'FAIL'} ${name}${cond || extra === undefined ? '' : ' :: ' + JSON.stringify(extra)}`));

    // the shared setup: 1-2 WINCH, countdown done, P1 on (4,7) = tile 74 facing the winch (4,8) = 84 below it
    await page.evaluate(() => {
      window.T = {
        bits0: 0,
        setup(pad, params) {
          const D = window.DEVICE;
          D.reset({seed: 7, skipBoot: true, mode: 'adventure', pad, params: {adventure: params || {}},
            profiles: [{name: 'ANNA', avatar: 3, color: 0}, {name: 'BENJI', avatar: 5, color: 4}]});
          D.step(1500); D.debug('world', 0); D.step(200); D.debug('pick', 0x01); D.step(200); D.debug('room', 1); D.step(300);
          for (let i = 0; i < 60 && D.central().mode.snapshot.countdownDs !== 0; i++) D.step(100);
          // the winch (4,8) = 84 sits on the bottom row; stand on (4,7) above it and push the stick down to face it
          D.debug('place', 74); D.step(100); D.stick(0, 0, -100); D.step(250); D.stick(0, 0, 0); D.step(300);
          const s = D.debug('state');
          this.bits0 = s.bits;
          return s;
        },
        state() { return window.DEVICE.debug('state'); },
        open(s) { return (s.bits & ~this.bits0) !== 0; }
      };
    });

    // a) the new params
    const a = await page.evaluate(() => {
      const D = window.DEVICE, P = D.params('adventure');
      return {far: P.handFarMm, near: P.handNearMm};
    });
    ok('a params handFarMm 200 / handNearMm 50', a.far === 200 && a.near === 50, a);

    // position: P1 on tile 74 facing the winch (dir 2 = down)
    const pos = await page.evaluate(() => {
      const s = window.T.setup('off');
      return {pos: s.heroes[0].pos, dir: s.heroes[0].dir, hero: s.heroes[0]};
    });
    ok('a P1 on tile 74 next to the winch (84), facing down', pos.pos === 74 && pos.dir === 2, pos);

    // b) hand only, no pad
    const b = await page.evaluate(() => {
      const D = window.DEVICE, T = window.T;
      T.setup('off');
      D.hand(0, 80); D.step(600);
      let s = T.state();
      const on = !!s.winching[0], open = T.open(s), press = s.inp[0].pressure;
      D.hand(0, 1300); D.step(800);
      s = T.state();
      return {on, open, press, off: !s.winching[0], closed: s.bits === T.bits0, p2: s.inp[0].pressure, bits: s.bits};
    });
    ok('b hand 80 -> winching', b.on, b);
    ok('b hand 80 -> gate open', b.open, b);
    ok('b hand 80 -> inp pressure 184', b.press === 184, b);
    ok('b hand away -> not winching', b.off, b);
    ok('b hand away -> gate closed', b.closed, b);
    ok('b hand away -> inp pressure 0', b.p2 === 0, b);

    // c) thresholds
    const c = await page.evaluate(() => {
      const D = window.DEVICE, T = window.T;
      T.setup('off');
      D.hand(0, 125); D.step(600);
      let s = T.state();
      const r = {p125: s.inp[0].pressure, on125: !!s.winching[0]};
      D.hand(0, 200); D.step(600);
      s = T.state();
      r.p200 = s.inp[0].pressure;
      D.hand(0, 40); D.step(600);
      s = T.state();
      r.p40 = s.inp[0].pressure; r.on40 = !!s.winching[0];
      return r;
    });
    ok('c hand 125 mm -> pressure 130, not winching', c.p125 === 130 && !c.on125, c);
    ok('c hand 200 mm -> pressure 0', c.p200 === 0, c);
    ok('c hand 40 mm -> pressure 220, winching', c.p40 === 220 && c.on40, c);

    // d) the wave key reads as a hand at 80 mm
    const d = await page.evaluate(() => {
      const D = window.DEVICE, T = window.T;
      T.setup('off');
      D.hold(0, 'WAVE', true); D.step(600);
      let s = T.state();
      const r = {on: !!s.winching[0], press: s.inp[0].pressure};
      D.hold(0, 'WAVE', false); D.step(800);
      s = T.state();
      r.off = !s.winching[0]; r.closed = s.bits === T.bits0;
      return r;
    });
    ok('d wave held -> winching, pressure 184', d.on && d.press === 184, d);
    ok('d wave released -> gate closed', d.off && d.closed, d);

    // e) the need rises while the hand holds it, and the hand slips
    const e = await page.evaluate(() => {
      const D = window.DEVICE, T = window.T;
      T.setup('off');
      D.hand(0, 80); D.step(200);
      const win = [], needs = [];
      for (let i = 0; i < 70; i++) {
        D.step(100);
        const s = T.state();
        win.push(s.winching[0] ? 1 : 0); needs.push(s.needMilli);
      }
      return {win, needs, maxNeed: Math.max(...needs)};
    });
    let slipped = false;
    for (let i = 1; i < e.win.length - 1; i++) if (!e.win[i]) slipped = true;
    ok('e hand holds at first', e.win[0] === 1, {win: e.win.slice(0, 5), needs: e.needs.slice(0, 5)});
    ok('e need goes above 80000', e.maxNeed > 80000, {maxNeed: e.maxNeed});
    ok('e then the hand slips', slipped, {win: e.win.join(''), needs: e.needs.slice(0, 70)});

    // f) pad only
    const f = await page.evaluate(() => {
      const D = window.DEVICE, T = window.T;
      T.setup('on');
      D.pressure(0, 255); D.step(600);
      let s = T.state();
      const r = {on: !!s.winching[0], open: T.open(s), press: s.inp[0].pressure};
      D.pressure(0, 0); D.step(800);
      s = T.state();
      r.closed = s.bits === T.bits0;
      return r;
    });
    ok('f pad 255 -> winching, gate open', f.on && f.open, f);
    ok('f pad 255 -> inp pressure >= 200', f.press >= 200, f);
    ok('f pad released -> gate closed', f.closed, f);

    // g) max wins
    const g = await page.evaluate(() => {
      const D = window.DEVICE, T = window.T;
      T.setup('on');
      D.pressure(0, 255); D.hand(0, 80); D.step(600);
      let s = T.state();
      const r = {hi: s.inp[0].pressure};
      D.pressure(0, 60); D.step(600);
      s = T.state();
      r.lo = s.inp[0].pressure; r.local = D.hh(0).input.st.pressure; r.on = !!s.winching[0];
      return r;
    });
    console.log(`${lang}    pad 60 + hand: inp ${g.lo}, local pad ${g.local}`);
    ok('g pad 255 + hand 80 -> pad wins (>= 200)', g.hi >= 200, g);
    ok('g pad 60 + hand 80 -> hand wins (184)', g.lo === 184 && g.on, g);

    // h) a custom handFarMm moves the thresholds
    const h = await page.evaluate(() => {
      const D = window.DEVICE, T = window.T;
      T.setup('off', {handFarMm: 300});
      D.hand(0, 125); D.step(600);
      const s = T.state();
      return {press: s.inp[0].pressure, on: !!s.winching[0]};
    });
    ok('h handFarMm 300: hand 125 -> pressure 166, winching', h.press === 166 && h.on, h);

    // i) errors
    const clean = await page.evaluate(() => ({errors: window.DEVICE.errors(), lint: window.DEVICE.lint()}));
    ok('i errors()/lint() empty', clean.errors.length === 0 && clean.lint.length === 0, clean);
    ok('i no page errors', errs.length === 0, errs);

    if (errs.length) fails.push(`${lang} pageerror: ${errs.join('; ')}`);
    await page.close();
  }
  await browser.close();
  console.log(fails.length ? 'FAILED\n' + fails.join('\n') : 'ALL OK');
  process.exit(fails.length ? 1 : 0);
})();
