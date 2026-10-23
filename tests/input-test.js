// Gesture sensor (APDS-9960) input: DEVICE.swipe / prox / hold SWIPE / keyboard,
// one gesture per tick, the alternating swipe key, touch swipe buttons, help
// table, debug panel buttons and slider; zh and en. No page errors, no
// horizontal scroll at 390 px.
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

    // in-page helper: step tick by tick (2 ms) and collect each handheld's recognised gestures
    await page.evaluate(() => {
      window.G = (ms) => {
        const D = window.DEVICE, out = [[], []];
        for (let i = 0; i < ms / 2; i++) {
          D.step(2);
          for (const p of [0, 1]) { const g = D.hh(p).input.st.gesture; if (g) out[p].push(g); }
        }
        return out;
      };
    });

    const r = await page.evaluate(() => {
      const D = window.DEVICE, G = window.G, st = p => D.hh(p).input.st, out = {};
      D.reset({seed: 3}); D.step(500);
      out.a = [st(0).prox, st(1).prox, st(0).gesture, st(1).gesture];
      // b) the swipe key: held = a hand right over the sensor, each press one swipe, RIGHT then LEFT
      D.hold(0, "SWIPE", true); out.b1 = G(20); out.bp = [st(0).prox, st(1).prox];
      D.hold(0, "SWIPE", false); out.b2 = G(20); out.bq = [st(0).prox, st(1).prox];
      D.press(0, "SWIPE", 50); out.b3 = G(100);
      D.press(0, "SWIPE", 50); out.b4 = G(100);
      // c) touch-style buttons SWIPE_L / SWIPE_R on P2
      D.press(1, "SWIPE_L", 50); out.c1 = G(100);
      D.press(1, "SWIPE_R", 50); out.c2 = G(100);
      // d) DEVICE.swipe: any direction, one per tick, queued (FIFO)
      D.swipe(1, "UP"); D.swipe(1, "DOWN"); D.swipe(1, "LEFT");
      const ticks = [];
      for (let i = 0; i < 4; i++) { D.step(2); ticks.push(st(1).gesture); }
      out.d = ticks;
      try { D.swipe(0, "SIDEWAYS"); out.dBad = false; } catch (e) { out.dBad = true; }
      // e) proximity: set, read, clamp; a held swipe key is at least 200
      out.e0 = D.prox(1, 120); D.step(20);
      out.e1 = st(1).prox; out.e2 = D.prox(1);
      out.e3 = D.prox(1, 999); D.step(20); out.e4 = st(1).prox;
      out.e5 = D.prox(1, -5);
      D.prox(0, 230); D.hold(0, "SWIPE", true); D.step(20); out.e6 = st(0).prox; D.hold(0, "SWIPE", false); D.step(20);
      out.e7 = st(0).prox; D.prox(0, 0);
      return out;
    });

    ok('a reset: prox 0, no gesture', r.a[0] === 0 && r.a[1] === 0 && r.a[2] === null && r.a[3] === null, r.a);
    ok('b hold SWIPE -> one RIGHT swipe on P1 only', JSON.stringify(r.b1) === '[["RIGHT"],[]]', r.b1);
    ok('b held -> prox 200 on P1, P2 0', r.bp[0] === 200 && r.bp[1] === 0, r.bp);
    ok('b release -> no swipe, prox 0', JSON.stringify(r.b2) === '[[],[]]' && r.bq[0] === 0, {b2: r.b2, bq: r.bq});
    ok('b the key alternates LEFT, RIGHT', JSON.stringify(r.b3[0]) === '["LEFT"]' && JSON.stringify(r.b4[0]) === '["RIGHT"]', {b3: r.b3, b4: r.b4});
    ok('c SWIPE_L -> LEFT, SWIPE_R -> RIGHT on P2', JSON.stringify(r.c1) === '[[],["LEFT"]]' && JSON.stringify(r.c2) === '[[],["RIGHT"]]', {c1: r.c1, c2: r.c2});
    ok('d swipe(): one per tick, in order', JSON.stringify(r.d) === '["UP","DOWN","LEFT",null]', r.d);
    ok('d swipe() rejects a bad direction', r.dBad, r.dBad);
    ok('e prox(1,120) -> 120', r.e0 === 120 && r.e1 === 120 && r.e2 === 120, r);
    ok('e prox clamps to 0..255', r.e3 === 255 && r.e4 === 255 && r.e5 === 0, r);
    ok('e swipe key over prox 230 keeps 230, then back', r.e6 === 230 && r.e7 === 230, r);

    // f) keyboard: E swipes P1, P swipes P2, alternating
    await page.evaluate(() => { window.DEVICE.reset({seed: 3}); window.DEVICE.step(200); document.activeElement && document.activeElement.blur(); });
    const kb = [];
    for (const key of ['e', 'e', 'p']) {
      await page.keyboard.down(key);
      kb.push(await page.evaluate(() => window.G(20)));
      await page.keyboard.up(key);
      kb.push(await page.evaluate(() => window.G(20)));
    }
    ok('f KeyE RIGHT then LEFT on P1, KeyP RIGHT on P2',
      JSON.stringify(kb) === JSON.stringify([[['RIGHT'], []], [[], []], [['LEFT'], []], [[], []], [[], ['RIGHT']], [[], []]]), kb);

    // g) touch buttons (real mouse = pointer events on the DOM)
    await page.evaluate(() => { window.DEVICE.reset({seed: 3}); window.DEVICE.step(200); });
    const tb = [];
    for (const [sel, p] of [['.dv-hh[data-p="0"] [data-field="swipeL"]', 0], ['.dv-hh[data-p="1"] [data-field="swipeR"]', 1]]) {
      const box = await page.locator(sel).boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      const a = await page.evaluate(() => window.G(20));
      await page.mouse.up();
      await page.evaluate(() => window.G(20));
      tb.push(a[p]);
    }
    ok('g touch ←划 -> LEFT on P1, 划→ -> RIGHT on P2', JSON.stringify(tb) === '[["LEFT"],["RIGHT"]]', tb);

    // h) help table header, touch buttons, debug panel (buttons + proximity sliders)
    const dom = await page.evaluate(lang => {
      const swipe = lang === 'zh' ? '划手' : 'Swipe';
      const head = [...document.querySelectorAll('.dv-keytable th')].map(th => th.textContent.trim());
      const left = document.querySelectorAll('[data-field="swipeL"]').length, right = document.querySelectorAll('[data-field="swipeR"]').length;
      const proxText = lang === 'zh' ? '手势传感器接近值' : 'Gesture sensor proximity';
      const labels = [...document.querySelectorAll('#device-debug .dbg-slider')].filter(l => (l.textContent || '').trim().startsWith(proxText));
      const maxes = labels.map(l => l.querySelector('input[type="range"]').max);
      const swL = lang === 'zh' ? '向左划' : 'Swipe left', swR = lang === 'zh' ? '向右划' : 'Swipe right';
      const btns = [...document.querySelectorAll('#device-debug button')].map(b => b.textContent.trim());
      return {head, hasSwipe: head.includes(swipe), left, right, prox: labels.length, maxes,
        dbgL: btns.filter(t => t === swL).length, dbgR: btns.filter(t => t === swR).length};
    }, lang);
    ok('h help header ' + (lang === 'zh' ? '划手' : 'Swipe'), dom.hasSwipe, dom.head);
    ok('h two ←划 and two 划→ touch buttons', dom.left === 2 && dom.right === 2, dom);
    ok('h two proximity sliders 0..255', dom.prox === 2 && dom.maxes.every(m => m === '255'), dom);
    ok('h two swipe-left / swipe-right debug buttons', dom.dbgL === 2 && dom.dbgR === 2, dom);

    // i) the debug buttons and slider drive the sensor
    const dbg = await page.evaluate(async lang => {
      const D = window.DEVICE;
      D.reset({seed: 3}); D.step(200);
      const swL = lang === 'zh' ? '向左划' : 'Swipe left';
      const b = [...document.querySelectorAll('#device-debug button')].filter(x => x.textContent.trim() === swL)[1];
      b.click();
      const g = window.G(20);
      const proxText = lang === 'zh' ? '手势传感器接近值' : 'Gesture sensor proximity';
      const sl = [...document.querySelectorAll('#device-debug .dbg-slider')].filter(l => (l.textContent || '').trim().startsWith(proxText))[0].querySelector('input');
      sl.value = '150'; sl.dispatchEvent(new Event('input', {bubbles: true}));
      D.step(20);
      const pr = D.hh(0).input.st.prox;
      D.prox(0, 0);
      return {g, pr};
    }, lang);
    ok('i debug "swipe left" on P2 -> LEFT', JSON.stringify(dbg.g) === '[[],["LEFT"]]', dbg);
    ok('i debug slider P1 -> prox 150', dbg.pr === 150, dbg);

    const clean = await page.evaluate(() => ({errors: window.DEVICE.errors(), lint: window.DEVICE.lint()}));
    ok('j errors()/lint() empty', clean.errors.length === 0 && clean.lint.length === 0, clean);
    ok('j no page errors', errs.length === 0, errs);

    // k) no horizontal scroll at 390 px, the swipe buttons inside their handheld
    await page.setViewportSize({width: 390, height: 900});
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    const lay = await page.evaluate(() => {
      const hh = document.querySelector('.dv-hh[data-p="0"]').getBoundingClientRect();
      const inside = [...document.querySelectorAll('.dv-hh[data-p="0"] .dv-w')].every(b => {
        const r = b.getBoundingClientRect();
        return r.left >= hh.left && r.right <= hh.right && b.scrollWidth <= b.clientWidth + 1;
      });
      return {sw: document.documentElement.scrollWidth, iw: window.innerWidth, inside};
    });
    ok('k no horizontal scroll at 390 px', lay.sw <= lay.iw, lay);
    ok('k swipe buttons fit at 390 px', lay.inside, lay);

    if (errs.length) fails.push(`${lang} pageerror: ${errs.join('; ')}`);
    await page.close();
  }
  await browser.close();
  console.log(fails.length ? 'FAILED\n' + fails.join('\n') : 'ALL OK');
  process.exit(fails.length ? 1 : 0);
})();
