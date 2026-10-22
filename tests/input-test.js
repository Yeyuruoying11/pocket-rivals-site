// Distance sensor + wave: DEVICE.hand / hold WAVE / keyboard, help table,
// wave buttons, debug sliders; zh and en. No page errors, no horizontal
// scroll at 390 px.
//   node -r ./tests/route.js tests/input-test.js
const pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
(async () => {
  const browser = await pw.chromium.launch();
  const fails = [];
  for (const lang of ['zh', 'en']) {
    const page = await browser.newPage({viewport: {width: 1200, height: 900}});
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    await page.goto(`http://127.0.0.1:8961/device.html?test=1&view=both&lang=${lang}`);
    await page.waitForFunction(() => window.DEVICE && window.DEVICE._started);
    const ok = (name, cond, extra) => (cond || fails.push(`${lang} ${name}`), console.log(`${lang} ${cond ? 'OK  ' : 'FAIL'} ${name}${cond || extra === undefined ? '' : ' :: ' + JSON.stringify(extra)}`));

    const r = await page.evaluate(() => {
      const D = window.DEVICE, out = {};
      D.reset({seed: 3}); D.step(500);
      out.a = [D.hh(0).input.st.distMm, D.hh(1).input.st.distMm];
      D.hold(0, "WAVE", true); D.step(20);
      out.b1 = [D.hh(0).input.st.distMm, D.hh(1).input.st.distMm];
      D.hold(0, "WAVE", false); D.step(20);
      out.b2 = [D.hh(0).input.st.distMm, D.hh(1).input.st.distMm];
      out.c0 = D.hand(1, 200); D.step(20);
      out.c1 = D.hh(1).input.st.distMm; out.c2 = D.hand(1);
      out.c3 = D.hand(1, 5000); D.step(20);
      out.c4 = D.hh(1).input.st.distMm;
      return out;
    });

    ok('a reset distMm 1300', r.a[0] === 1300 && r.a[1] === 1300, r.a);
    ok('b hold WAVE -> 80 on P1, P2 1300', r.b1[0] === 80 && r.b1[1] === 1300, r.b1);
    ok('b release -> 1300', r.b2[0] === 1300 && r.b2[1] === 1300, r.b2);
    ok('c hand(1,200) -> 200', r.c0 === 200 && r.c1 === 200 && r.c2 === 200, r);
    ok('c hand(1,5000) clamps to 1300', r.c3 === 1300 && r.c4 === 1300, r);

    // d) keyboard KeyE drives P1 wave
    await page.evaluate(() => { window.DEVICE.reset({seed: 3}); document.activeElement && document.activeElement.blur(); });
    await page.keyboard.down('e');
    const d1 = await page.evaluate(() => { const D = window.DEVICE; D.step(20); return D.hh(0).input.st.distMm; });
    await page.keyboard.up('e');
    const d2 = await page.evaluate(() => { const D = window.DEVICE; D.step(20); return D.hh(0).input.st.distMm; });
    ok('d KeyE -> 80 then back', d1 === 80 && d2 === 1300, {d1, d2});

    // e) help table header, wave buttons, debug sliders
    const dom = await page.evaluate(lang => {
      const hand = lang === 'zh' ? '挥手' : 'Wave';
      const head = [...document.querySelectorAll('.dv-keytable th')].map(th => th.textContent.trim());
      const waves = document.querySelectorAll('[data-field="wave"]').length;
      const ranges = [...document.querySelectorAll('#device-debug input[type="range"]')];
      const dbg = document.querySelectorAll('#device-debug.dv-debug input[type="range"]').length;
      // hand sliders: the two whose label text starts with the hand text prefix
      const handText = lang === 'zh' ? '手的高度' : 'Hand height';
      const labels = [...document.querySelectorAll('#device-debug .dbg-slider')].filter(l => (l.textContent || '').trim().startsWith(handText));
      return {head, hasWave: head.includes(hand), waves, hands: labels.length, ranges: ranges.length};
    }, lang);
    ok('e help header ' + (lang === 'zh' ? '挥手' : 'Wave'), dom.hasWave, dom.head);
    ok('e two wave buttons', dom.waves === 2, dom.waves);
    ok('e two hand sliders', dom.hands === 2, dom.hands);

    const clean = await page.evaluate(() => ({errors: window.DEVICE.errors(), lint: window.DEVICE.lint()}));
    ok('f errors()/lint() empty', clean.errors.length === 0 && clean.lint.length === 0, clean);
    ok('f no page errors', errs.length === 0, errs);

    // f) help buttons + no horizontal scroll at 390 px
    await page.setViewportSize({width: 390, height: 900});
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const scroll = await page.evaluate(() => ({sw: document.documentElement.scrollWidth, iw: window.innerWidth}));
    ok('f no horizontal scroll at 390 px', scroll.sw <= scroll.iw, scroll);

    if (errs.length) fails.push(`${lang} pageerror: ${errs.join('; ')}`);
    await page.close();
  }
  await browser.close();
  console.log(fails.length ? 'FAILED\n' + fails.join('\n') : 'ALL OK');
  process.exit(fails.length ? 1 : 0);
})();
