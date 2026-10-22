// The 3D pin map on the hardware tab of index.html (and its 2D fallback): every pins.json
// pin wired to its module, hover / click / board toggle / LED switch, labels inside and not
// overlapping, zh + en, light + dark, 1200 + 390 px, language switch, idle frames, lazy load,
// no-WebGL / reduced-motion / three.js-missing fallbacks. Software WebGL (SwiftShader).
// Screenshots go to tests/out/.
//   node -r ./tests/route.js tests/pin3d-test.js
const pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const fs = require('fs'), path = require('path');
const SP = path.join(__dirname, 'out') + path.sep;
fs.mkdirSync(SP, {recursive: true});
const BASE = 'http://127.0.0.1:8961/index.html';
const GL = ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'];
const pins = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pins.json'), 'utf8'));

let fails = 0, passes = 0;
const ok = (cond, msg) => { if (cond) passes++; else { fails++; console.log('  FAIL', msg); } };

async function open(browser, {w = 1200, lang = 'zh', scheme = 'light', reduced = false, extra = ''} = {}) {
  const ctx = await browser.newContext({viewport: {width: w, height: 900}, colorScheme: scheme, reducedMotion: reduced ? 'reduce' : 'no-preference', deviceScaleFactor: 1, hasTouch: false});
  const p = await ctx.newPage();
  const errs = [], bad = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });
  await p.goto(`${BASE}?lang=${lang}${extra}#hardware`);
  await p.waitForFunction(() => window.PR && PR.pinView.view, null, {timeout: 30000});
  await p.evaluate(() => document.querySelector('#p3d').scrollIntoView({block: 'center'}));
  await p.waitForTimeout(500);
  // network failures outside this site (the guestbook's GitHub API) are not ours
  p.errors = () => errs.filter(e => !(/Failed to load resource/.test(e) && bad.every(b => /github\.com/.test(b))));
  p.bad = () => bad.filter(b => !/github\.com/.test(b));
  return {ctx, p};
}

const usedPins = pins.pins.filter(x => x.player).map(x => x.pin);

async function checkCoverage(p, label) {
  const info = await p.evaluate(() => PR.pinView.view.info());
  ok(info.missing.length === 0, `${label}: every pins.json pin is on the connector (${info.missing})`);
  for (const pin of usedPins) {
    const part = pins.pins.find(x => x.pin === pin).player.part;
    const wire = info.wires.find(w => w.pin === pin) || info.traces.find(t => t.pin === pin && t.part === part);
    ok(wire && (wire.part === part), `${label}: ${pin} has a wire/trace to ${part}`);
    ok(info.modules.includes(part), `${label}: module for ${part}`);
  }
  ok(info.modules.includes('dist') && info.links.some(l => l.from === 'joy' && l.part === 'dist'), `${label}: Qwiic chain joy -> dist`);
  return info;
}

async function hoverPin(p, pin) {
  await p.evaluate(() => PR.pinView.view.stopAuto && PR.pinView.view.stopAuto());
  await p.waitForTimeout(250);
  const pos = await p.evaluate(pin => PR.pinView.view.screenPos(pin), pin);
  await p.mouse.move(pos.x - 30, pos.y + 40);
  await p.mouse.move(pos.x, pos.y, {steps: 4});
  await p.waitForTimeout(350);
  return p.evaluate(() => ({pin: document.querySelector('#p3d-stage').dataset.hlPin, parts: document.querySelector('#p3d-stage').dataset.hlParts,
    detail: document.querySelector('#pin-detail').textContent, gridSel: [...document.querySelectorAll('#pins .pin.sel')].map(b => b.dataset.pin)}));
}

// big (module / callout) labels: inside the stage, not on top of each other
const labelLayout = p => p.evaluate(() => {
  const st = document.querySelector('#p3d-stage').getBoundingClientRect();
  const els = [...document.querySelectorAll('#p3d-stage .p3d-mod')].filter(e => e.offsetWidth && getComputedStyle(e).display !== 'none');
  const R = els.map(e => [e.dataset.id, e.getBoundingClientRect()]);
  const out = R.filter(([, r]) => r.left < st.left - 1 || r.right > st.right + 1 || r.top < st.top - 1 || r.bottom > st.bottom + 1).map(([id]) => id);
  const overlap = [];
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    const a = R[i][1], b = R[j][1];
    if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) overlap.push(R[i][0] + '/' + R[j][0]);
  }
  return {out, overlap};
});

const noHScroll = p => p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);

(async () => {
  const t0 = Date.now();
  const gl = await pw.chromium.launch({args: GL});

  for (const lang of ['zh', 'en']) for (const scheme of ['light', 'dark']) for (const w of [1200, 390]) {
    const label = `${lang}/${scheme}/${w}`;
    console.log('--', label);
    const {ctx, p} = await open(gl, {w, lang, scheme});
    const mode = await p.evaluate(() => PR.pinView.mode);
    ok(mode === '3d', `${label}: 3D mode (got ${mode}, ${await p.evaluate(() => PR.pinView.reason)})`);
    const smp = await p.evaluate(() => PR.pinView.view.sample());
    ok(smp.painted > (w < 640 ? 0.12 : 0.25), `${label}: canvas painted ${(smp.painted * 100).toFixed(0)}% of pixels`);
    await checkCoverage(p, label);
    ok(await noHScroll(p), `${label}: no horizontal page scroll`);
    const lbls = await p.evaluate(() => [...document.querySelectorAll('.p3d-mod')].map(e => getComputedStyle(e).display !== 'none' ? 1 : 0).reduce((a, b) => a + b, 0));
    ok(lbls >= 8, `${label}: module labels shown (${lbls})`);
    if (lang === 'zh' && scheme === 'light' && w === 1200) await p.locator('#p3d').screenshot({path: SP + 'pin3d-player-zh-1200.png'});
    if (lang === 'en' && scheme === 'dark' && w === 1200) await p.locator('#p3d').screenshot({path: SP + 'pin3d-dark-en-1200.png'});
    if (lang === 'en' && scheme === 'light' && w === 1200) await p.locator('#p3d').screenshot({path: SP + 'pin3d-player-en-1200.png'});
    if (lang === 'en' && scheme === 'light' && w === 390) await p.screenshot({path: SP + 'pin3d-390-en.png', clip: await p.locator('#p3d').boundingBox().then(b => ({x: 0, y: b.y - 60, width: 390, height: b.height + 200}))});
    if (lang === 'zh' && scheme === 'dark' && w === 390) await p.screenshot({path: SP + 'pin3d-390-dark.png', clip: await p.locator('#p3d').boundingBox().then(b => ({x: 0, y: b.y - 60, width: 390, height: b.height + 200}))});
    // big labels inside the stage and not overlapping each other
    const lay = await labelLayout(p);
    ok(lay.out.length === 0, `${label}: labels inside the view ${JSON.stringify(lay.out)}`);
    ok(lay.overlap.length === 0, `${label}: big labels don't overlap ${JSON.stringify(lay.overlap)}`);
    if (lang === 'en') {
      const cjk = await p.evaluate(() => [...document.querySelectorAll('#p3d .p3d-lab, #p3d-hint, #p3d-legend, #p3d-reset, #pin-detail')].map(e => e.textContent).filter(t => /[\u4e00-\u9fff]/.test(t)));
      ok(cjk.length === 0, `${label}: no Chinese left in the English pin map ${JSON.stringify(cjk)}`);
    }
    if (lang === 'zh' && scheme === 'light' && w === 390) await p.screenshot({path: SP + 'pin3d-390.png', clip: await p.locator('#p3d').boundingBox().then(b => ({x: 0, y: b.y - 60, width: 390, height: b.height + 200}))});

    // hover a pin: right module lit, detail box filled, grid selection follows
    // phones: the strips are ~2 px apart, so a pin is picked from the grid below (or a
    // label) and the 3D view follows; wide screens hover the contact itself
    const h = w < 640 ? await (async () => {
      await p.click('#pins [data-pin="P13"]');
      await p.waitForTimeout(300);
      return p.evaluate(() => ({pin: document.querySelector('#p3d-stage').dataset.hlPin, parts: document.querySelector('#p3d-stage').dataset.hlParts,
        detail: document.querySelector('#pin-detail').textContent, gridSel: [...document.querySelectorAll('#pins .pin.sel')].map(b => b.dataset.pin)}));
    })() : await hoverPin(p, 'P13');
    ok(h.pin === 'P13' && h.parts.split(' ').includes('tft'), `${label}: hover P13 lights tft (${JSON.stringify(h.parts)})`);
    ok(h.detail.includes('P13') && h.detail.includes('P0.17'), `${label}: detail box shows P13`);
    ok(h.gridSel.join() === 'P13', `${label}: grid selects P13`);
    const litMod = await p.evaluate(() => document.querySelector('.p3d-lab[data-id="mod-tft"]').classList.contains('lit') && document.querySelector('.p3d-lab[data-id="mod-btn"]').classList.contains('dim'));
    ok(litMod, `${label}: tft label lit, others dimmed`);
    if (lang === 'zh' && scheme === 'light' && w === 1200) {
      const h8 = await hoverPin(p, 'P8');
      ok(h8.detail.includes('NFC') || h8.detail.includes('CONFIG_NFCT'), `${label}: P8 warning in detail`);
      // a wire running over the connector (P15 over P19 at the default angle) must not steal the contact's hover
      for (const pin of ['P19', 'P20', 'P14', 'P16', 'P3']) {
        const hp = await hoverPin(p, pin);
        ok(hp.pin === pin, `${label}: hovering ${pin}'s contact picks ${pin} (${hp.pin})`);
      }
      await hoverPin(p, 'P8');
      await p.locator('#p3d').screenshot({path: SP + 'pin3d-player-hover-zh-1200.png'});
    }
    // hover a module label: its pins light up
    await p.evaluate(() => PR.pinView.view.setSel(null));
    await p.mouse.move(5, 5);
    const modLab = p.locator('.p3d-lab[data-id="mod-joy"]');
    await modLab.click();
    await p.waitForTimeout(250);
    const mj = await p.evaluate(() => ({parts: document.querySelector('#p3d-stage').dataset.hlParts, detail: document.querySelector('#pin-detail').textContent, grid: [...document.querySelectorAll('#pins .pin.sel')].map(b => b.dataset.pin)}));
    ok(mj.parts.includes('joy') && mj.grid.join() === 'P19,P20', `${label}: click joystick label → P19/P20 (${mj.grid})`);

    // board toggle + LED-matrix switch
    await p.click('#board-seg [data-b="central"]');
    await p.waitForTimeout(400);
    const ci = await p.evaluate(() => PR.pinView.view.info());
    ok(ci.board === 'central' && ci.wires.length === 0 && ci.modules.length === 0, `${label}: central board has no external wires`);
    ok(ci.onboard.some(o => o.id === 'antenna' && o.part === 'radio') && ci.onboard.some(o => o.id === 'matrix' && o.part === 'matrix' && o.on), `${label}: central shows radio + matrix`);
    ok(ci.traces.filter(t => t.led).length === 5, `${label}: central LED columns traced (${ci.traces.filter(t => t.led).length})`);
    if (lang === 'zh' && scheme === 'light' && w === 1200) {
      await p.evaluate(() => PR.pinView.view.stopAuto());
      await p.mouse.move(5, 5);
      await p.evaluate(() => PR.pinView.view.setSel(null));
      await p.waitForTimeout(300);
      await p.locator('#p3d').screenshot({path: SP + 'pin3d-central-zh-1200.png'});
    }
    await p.click('#board-seg [data-b="player"]');
    await p.waitForTimeout(200);
    const before = await p.evaluate(() => PR.pinView.view.info());
    await p.click('#no-matrix');
    await p.waitForTimeout(300);
    const after = await p.evaluate(() => PR.pinView.view.info());
    ok(before.traces.filter(t => t.led).length === 4 && after.traces.filter(t => t.led).length === 0, `${label}: LED switch removes matrix traces`);
    ok(after.onboard.find(o => o.id === 'matrix').on === false, `${label}: matrix shown as off`);
    const offLab = await p.evaluate(() => document.querySelector('.p3d-lab[data-id="ob-matrix"]').textContent);
    ok(/P4/.test(offLab) && /(停用|disabled)/.test(offLab), `${label}: matrix label says freed (${offLab})`);
    const smp2 = await p.evaluate(() => PR.pinView.view.sample());
    ok(smp2.painted > (w < 640 ? 0.12 : 0.25), `${label}: still painted after toggles`);
    ok(await noHScroll(p), `${label}: no horizontal scroll after toggles`);

    // reset view button
    await p.click('#p3d-reset');
    await p.waitForTimeout(800);
    const cam = await p.evaluate(() => PR.pinView.view.info().camera);
    ok(Math.abs(cam.polar - (w < 640 ? 0.46 : 0.62)) < 0.02, `${label}: reset view restores the angle (${cam.polar})`);

    // other tabs still work
    for (const tab of ['overview', 'timeline', 'battle', 'reviews', 'hardware']) {
      await p.click(`.tab[data-tab="${tab}"]`);
      await p.waitForTimeout(120);
      const vis = await p.evaluate(t => !document.querySelector(`[data-panel="${t}"]`).hidden, tab);
      ok(vis, `${label}: tab ${tab} shows`);
    }
    ok(await p.evaluate(() => document.querySelectorAll('#arch .comp').length > 5), `${label}: overview architecture rendered`);
    const errs = p.errors();
    ok(errs.length === 0, `${label}: no page/console errors ${JSON.stringify(errs)}`);
    ok(p.bad().length === 0, `${label}: no failed site requests ${JSON.stringify(p.bad())}`);
    await ctx.close();
  }

  // language toggle (reloads the page by design): the pin map comes back in the
  // other language with the same board, LED switch and selection
  {
    const {ctx, p} = await open(gl, {});
    await p.click('#no-matrix');
    await p.evaluate(() => document.querySelector('.p3d-lab[data-id="mod-tft"]').click());
    await p.waitForTimeout(200);
    await Promise.all([p.waitForNavigation(), p.click('#lang-toggle')]);
    await p.waitForFunction(() => window.PR && PR.pinView.view, null, {timeout: 30000});
    await p.waitForTimeout(400);
    const r = await p.evaluate(() => ({lang: document.documentElement.lang, hash: location.hash, mode: PR.pinView.mode, info: PR.pinView.view.info(),
      matrix: document.querySelector('#no-matrix').checked, detail: document.querySelector('#pin-detail').textContent,
      tft: document.querySelector('.p3d-lab[data-id="mod-tft"]').textContent, lit: document.querySelector('.p3d-lab[data-id="mod-tft"]').classList.contains('lit'),
      text: [...document.querySelectorAll('#p3d .p3d-lab, #p3d-hint, #p3d-legend, #p3d-reset, #pin-detail')].map(e => e.textContent).join(' | ')}));
    ok(r.lang === 'en' && r.hash === '#hardware' && r.mode === '3d', `lang switch: English, same tab, 3D (${r.lang} ${r.hash} ${r.mode})`);
    ok(r.matrix && r.info.noMatrix && r.info.lit && r.info.lit.parts.includes('tft') && r.lit, `lang switch: LED switch + selection kept`);
    ok(/TFT screen/.test(r.tft) && /Actuator/.test(r.tft) && /SPI/.test(r.detail) && /Owner|owner/.test(r.detail), `lang switch: English labels + detail (${r.tft} / ${r.detail.slice(0, 80)})`);
    ok(!/[\u4e00-\u9fff]/.test(r.text), `lang switch: no Chinese left (${(r.text.match(/[^ -~]*[\u4e00-\u9fff]+[^ -~]*/g) || []).slice(0, 5)})`);
    await p.click('#board-seg [data-b="central"]');
    await p.waitForTimeout(200);
    await Promise.all([p.waitForNavigation(), p.click('#lang-toggle')]);
    await p.waitForFunction(() => window.PR && PR.pinView.view, null, {timeout: 30000});
    const z = await p.evaluate(() => ({lang: document.documentElement.lang, board: PR.pinView.view.info().board,
      lab: document.querySelector('.p3d-lab[data-id="ob-radio"]')?.textContent || '', hint: document.querySelector('#p3d-hint').textContent}));
    ok(z.lang === 'zh-CN' && z.board === 'central' && /无线/.test(z.lab) && /拖动/.test(z.hint), `lang switch back: Chinese central board (${JSON.stringify(z)})`);
    ok(p.errors().length === 0, `lang switch: no errors ${JSON.stringify(p.errors())}`);
    await ctx.close();
  }

  // render-on-demand: idle frames stop when the tab is switched away
  {
    const {ctx, p} = await open(gl, {});
    await p.evaluate(() => PR.pinView.view.stopAuto());
    // the orbit damping glides to a stop first (slow frames in software GL): wait until it settles
    let settled = -1, f1 = 0;
    for (let i = 0; i < 40 && settled !== f1; i++) { settled = f1; await p.waitForTimeout(500); f1 = await p.evaluate(() => PR.pinView.view.info().frames); }
    await p.waitForTimeout(800);
    const f2 = await p.evaluate(() => PR.pinView.view.info().frames);
    ok(f2 - f1 <= 1, `idle: no frames while nothing moves (${f2 - f1})`);
    await p.click('.tab[data-tab="overview"]');
    await p.evaluate(() => PR.pinView.view.resetView());   // would animate if visible
    await p.waitForTimeout(800);
    const f3 = await p.evaluate(() => PR.pinView.view.info().frames);
    ok(f3 - f2 <= 1, `hidden tab: no frames (${f3 - f2})`);
    // lazy load: the overview page alone does not fetch three.js
    const ctx2 = await gl.newContext();
    const q = await ctx2.newPage();
    const reqs = [];
    q.on('request', r => reqs.push(r.url()));
    await q.goto(BASE + '#overview');
    await q.waitForTimeout(1200);
    ok(!reqs.some(u => /three|pinmap/.test(u)), 'overview does not load three.js / pin map');
    const t = Date.now();
    await q.click('.tab[data-tab="hardware"]');
    await q.waitForFunction(() => PR.pinView.view, null, {timeout: 30000});
    const loadMs = await q.evaluate(() => PR.pinView.ms);
    const sizes = await q.evaluate(() => performance.getEntriesByType('resource').filter(e => /three|pinmap/.test(e.name)).map(e => [e.name.split('/').slice(-1)[0], e.decodedBodySize]));
    console.log('lazy load:', loadMs, 'ms (mount incl. fetch), files:', JSON.stringify(sizes));
    await ctx.close(); await ctx2.close();
  }
  await gl.close();

  // 2D fallback: no WebGL
  const nogl = await pw.chromium.launch({args: ['--disable-webgl', '--disable-webgl2']});
  for (const [w, scheme, lang] of [[1200, 'light', 'zh'], [390, 'dark', 'en']]) {
    const label = `noWebGL/${lang}/${scheme}/${w}`;
    console.log('--', label);
    const {ctx, p} = await open(nogl, {w, scheme, lang});
    const m = await p.evaluate(() => [PR.pinView.mode, PR.pinView.reason]);
    ok(m[0] === '2d' && m[1] === 'no-webgl', `${label}: 2D fallback (${m})`);
    ok(await p.evaluate(() => document.querySelectorAll('#p3d-stage svg path').length > 50), `${label}: SVG drawn`);
    await checkCoverage(p, label);
    const h = await hoverPin(p, 'P15');
    ok(h.parts.split(' ').includes('tft') && h.detail.includes('P15'), `${label}: hover P15 in 2D (${h.parts})`);
    ok(await p.evaluate(() => document.querySelector('#p3d-reset').hidden), `${label}: no reset button in 2D`);
    await p.click('#board-seg [data-b="central"]');
    await p.waitForTimeout(200);
    ok(await p.evaluate(() => PR.pinView.view.info().board === 'central'), `${label}: 2D board toggle`);
    await p.click('#board-seg [data-b="player"]');
    await p.click('#no-matrix');
    await p.waitForTimeout(200);
    ok(await p.evaluate(() => PR.pinView.view.info().traces.filter(t => t.led).length === 0), `${label}: 2D LED switch`);
    await p.click('#no-matrix');
    ok(await noHScroll(p), `${label}: no horizontal scroll`);
    const lay = await labelLayout(p);
    ok(lay.out.length === 0 && lay.overlap.length === 0, `${label}: 2D labels inside, no overlap ${JSON.stringify(lay)}`);
    if (lang === 'en') {
      const cjk = await p.evaluate(() => [...document.querySelectorAll('#p3d .p3d-lab, #p3d-hint, #p3d-legend, #pin-detail')].map(e => e.textContent).filter(t => /[\u4e00-\u9fff]/.test(t)));
      ok(cjk.length === 0, `${label}: no Chinese in the English 2D map ${JSON.stringify(cjk)}`);
      ok(await p.evaluate(() => /pin assignment/i.test(document.querySelector('#p3d-stage svg').getAttribute('aria-label'))), `${label}: English SVG label`);
    }
    if (w === 1200) {
      await p.evaluate(() => PR.pinView.view.setSel({pin: 'P15'}));
      await p.locator('#p3d').screenshot({path: SP + 'pin3d-2d-fallback.png'});
    } else await p.locator('#p3d').screenshot({path: SP + 'pin3d-2d-390-dark.png'});
    ok(p.errors().length === 0, `${label}: no errors ${JSON.stringify(p.errors())}`);
    await ctx.close();
  }
  await nogl.close();

  // 2D fallback: reduced motion (WebGL available)
  const gl2 = await pw.chromium.launch({args: GL});
  {
    const {ctx, p} = await open(gl2, {reduced: true});
    const m = await p.evaluate(() => [PR.pinView.mode, PR.pinView.reason]);
    ok(m[0] === '2d' && m[1] === 'reduced-motion', `reduced motion → 2D (${m})`);
    ok(p.errors().length === 0, `reduced motion: no errors ${JSON.stringify(p.errors())}`);
    await ctx.close();
  }
  // 3D files missing → falls back to 2D (simulated CDN / vendor failure)
  {
    const ctx = await gl2.newContext({viewport: {width: 1200, height: 900}});
    await ctx.route(/three\.module\.min\.js/, r => r.abort());
    const p = await ctx.newPage();
    const errs = [];
    p.on('pageerror', e => errs.push(e.message));
    await p.goto(BASE + '#hardware');
    await p.waitForFunction(() => window.PR && PR.pinView.view, null, {timeout: 30000});
    const m = await p.evaluate(() => [PR.pinView.mode, PR.pinView.reason]);
    ok(m[0] === '2d' && /3d-failed/.test(m[1]), `three.js unavailable → 2D (${m})`);
    ok(errs.length === 0, `three.js unavailable: no page errors ${errs}`);
    await ctx.close();
  }
  await gl2.close();
  console.log(`\n${passes} passed, ${fails} failed in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
