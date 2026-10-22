// Racing tracks test.
// Expects the site on http://127.0.0.1:<PORT>/device.html.
//   node -r ./tests/route.js tests/race-test.js [PORT=8961] [PARTS=race,fix,steer,laps3,flash,sweep] [LANGS=zh,en] [WIDTHS=1200,390]
// race   : every track raced by both bots (1 lap): Classic with P1 in top / chase / cockpit,
//          each 32x32 track in chase / cockpit (P2 in the other 3D view); all 9 pet pairs on
//          Classic and park, PAIRS_OTHER (default all 9) on riptide / gale / switchback. The
//          diagonal pairs and 2-0 go through the real setup UI (picker: RIGHT x track, A; then
//          the drivers RIGHT x n, A). Asserts: picked pets and track, results reached, both finish,
//          no wrong-way (car flag polled every 100 ms + wrong_way sfx), errors / lint empty.
// fix    : fixtures race.lap2 / race.splash / race.views
// steer  : relative steering by keys in chase / cockpit, absolute in top
// laps3  : each new track once over its full 3 laps (zh-1200 only), lap times printed
// flash  : a 120 ms border flash started right after a frame on the 6 fps results screen is on
//          the glass within one 33 ms frame, drawn at >= 30 fps while it runs, gone after;
//          the 6 fps pacing without an effect is unchanged
// sweep  : (zh-1200 only) every road tile x 8 headings x chase + cockpit on each new track, plus
//          the camera 2..14 px in front of every billboard (tree, cone, sign, arch post) facing
//          it, plus the rival kart at 2..40 px from my camera: no frame fills the 3D window with
//          one colour (>= 85% of its pixels; healthy frames peak near 60%); the rival beside / just behind my kart in the chase cam is drawn and
//          one nearer than the near clip (8 px from the camera) is not
// Also: no page errors, no horizontal scroll, DEVICE.errors() / lint() empty at the end.
const pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const PORT = +(process.argv[2] || 8961);
const PARTS = new Set((process.argv[3] || 'race,fix,steer,laps3,flash,sweep').split(','));
const LANGS = (process.argv[4] || 'zh,en').split(',');
const WIDTHS = (process.argv[5] || '1200,390').split(',').map(Number);
const PAIRS_OTHER = +(process.env.PAIRS_OTHER || 9);
const BASE = `http://127.0.0.1:${PORT}/device.html`;
const fails = [];
const check = (c, msg) => { if (!c) { fails.push(msg); console.log('FAIL', msg); } return !!c; };
const OTHER = {top: 'chase', chase: 'cockpit', cockpit: 'chase'};
const PAIRS = []; for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) PAIRS.push([a, b]);
// the reduced set covers every pet on both boards and the diagonal (UI path)
const FEW = [[0, 0], [1, 2], [2, 1], [1, 1], [0, 2], [2, 0], [2, 2], [0, 1], [1, 0]];

// in-page: one race, returns a summary
function raceOnce({a, b, ui, view, other, track, laps, seed}) {
  const D = window.DEVICE;
  D.reset({seed, mode: 'racing', params: {racing: {laps}}});
  D.hh(0).ctx.local.raceView = view; D.hh(1).ctx.local.raceView = other;
  D.step(400); { let w = 0; while ((!D.central().mode || D.screen(0).id !== 'race.pick' || D.screen(1).id !== 'race.pick') && w++ < 50) D.step(100); D.step(300); }
  let setupTexts = null;
  if (ui) {
    const picker = (D.central().mode.snapshot.flags & 64) ? 1 : 0;
    for (let i = 0; i < track; i++) { D.press(picker, 'RIGHT'); D.step(150); }
    setupTexts = D.texts(picker).map(t => t.s).join(' | ');
    D.press(picker, 'A'); D.step(200); D.press(1 - picker, 'A'); D.step(200);
    for (const [p, n] of [[0, a], [1, b]]) {
      for (let i = 0; i < n; i++) { D.press(p, 'RIGHT'); D.step(120); }
      D.press(p, 'A'); D.step(200);
    }
  } else { D.debug('track', track); D.debug('pick', a + 4 * b); }
  D.step(200);
  const sn = D.central().mode.snapshot;
  const picked = sn.cars.map(c => c.pet), trackNow = sn.track, trackSet = !!(sn.flags & 32);
  D.bot(0, true); D.bot(1, true);
  let guard = 0, views = null, wrong = [0, 0], scenes = null;
  const sfx0 = [D.sfxLog(0).length, D.sfxLog(1).length];
  while (D.central().mode.snapshot.phase < 4 && guard++ < 3000) {
    D.step(100);
    for (const p of [0, 1]) { const m = D.hh(p).ctx.m; if (m && m.car && m.car.wrong) wrong[p]++; }
    if (!views && D.screen(0).id === 'race.hud' && D.screen(1).id === 'race.hud') {
      views = [0, 1].map(p => { const m = D.hh(p).ctx.m; return m.T.N === 32 && D.hh(p).ctx.local.raceView === 'top' ? 'chase' : D.hh(p).ctx.local.raceView; });
    }
  }
  scenes = [0, 1].map(p => Object.keys(D.hh(p).ctx.m.T.cache).filter(k => k.startsWith('scene.')).map(k => k.split('|')[0].slice(6)));
  const wsfx = [0, 1].map(p => D.sfxLog(p).slice(sfx0[p]).filter(e => e.id === 'wrong_way').length);
  D.bot(0, false); D.bot(1, false);   // a bot on S19 would start a rematch
  D.step(800);
  const end = D.central().mode.snapshot;
  return {picked, track: trackNow, trackSet, views, scenes, wrong, wsfx, phase: end.phase, laps: end.cars.map(c => [c.lap, c.finish, c.best]),
    screens: [D.screen(0).id, D.screen(1).id], errors: D.errors(), lint: D.lint(), setupTexts, tid: D.hh(0).ctx.m ? D.hh(0).ctx.m.T.id : null};
}

// in-page: the flash timing test on the loser's 6 fps results screen
function flashTest() {
  const D = window.DEVICE, out = {};
  D.reset({seed: 77, mode: 'racing', params: {racing: {laps: 1}}});
  D.step(400); let w = 0; while ((!D.central().mode || D.screen(0).id !== 'race.pick') && w++ < 50) D.step(100); D.step(300);
  D.debug('pick', 0 + 4 * 1); D.bot(0, true); D.bot(1, true);
  let g = 0; while (D.central().mode.snapshot.phase < 4 && g++ < 900) D.step(100);
  D.bot(0, false); D.bot(1, false);
  D.step(2500);
  const sn = D.central().mode.snapshot, loser = 1 - sn.leader;
  out.screen = D.screen(loser).id;
  const hh = D.hh(loser);
  out.fps = hh.screenDef.fps(hh.ctx);
  const frames = [];
  if (!window.__frameHook) { window.__frameHook = []; D.on('frame', e => window.__frameHook.push({p: e.p, t: D.now()})); }
  const F = window.__frameHook; F.length = 0;
  const at = name => D.PALETTE.find(q => q.name === name).index;
  // the quiet pacing: frames 166 ms apart
  for (let t = 0; t < 1000; t += 2) D.step(2);
  const quiet = F.filter(f => f.p === loser).map(f => f.t);
  out.quietGaps = quiet.slice(1).map((t, i) => t - quiet[i]);
  // right after a frame: start the flash
  F.length = 0;
  while (!F.some(f => f.p === loser)) D.step(2);
  F.length = 0;
  const t0 = D.now();
  hh.ctx.fx.border('danger', 120);
  const border = () => { const px = D.pixels(loser); return px[0] === at('danger') && px[127] === at('danger') && px[159 * 128] === at('danger'); };
  const seen = [];
  for (let t = 0; t < 300; t += 2) {
    const n = F.length;
    D.step(2);
    if (F.length > n && F.slice(n).some(f => f.p === loser)) seen.push({dt: D.now() - t0, border: border()});
  }
  out.seen = seen;
  out.first = seen.length ? seen[0] : null;
  out.duringFrames = seen.filter(s => s.dt <= 120).length;
  out.lastBorder = Math.max(-1, ...seen.filter(s => s.border).map(s => s.dt));
  out.firstClean = (seen.find(s => !s.border) || {}).dt;
  out.errors = D.errors(); out.lint = D.lint();
  return out;
}

// in-page: the 3D sweep on one track
function sweep(idx) {
  const D = window.DEVICE, R = D.rules('racing'), T = R.tracks()[idx];
  D.reset({seed: 90 + idx, mode: 'racing', params: {racing: {laps: 9, timeLimitS: 600}}});
  D.hh(0).ctx.local.raceView = 'chase'; D.hh(1).ctx.local.raceView = 'cockpit';
  D.step(400); let w = 0; while ((!D.central().mode || D.screen(0).id !== 'race.pick') && w++ < 50) D.step(100); D.step(300);
  D.debug('track', idx); D.debug('pick', 0 + 4 * 1);
  let g = 0; while (!(D.hh(0).ctx.m && D.hh(0).ctx.m.went && D.hh(1).ctx.m.went) && g++ < 200) D.step(100);
  D.step(300);
  const L = R.LAYOUTS.full, y0 = L.y0, y1 = L.y1;
  const stat = {frames: 0, fullOne: [], worst: 0, worstAt: null, hist: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]};
  const look = (p, what) => {
    const px = D.pixels(p), cnt = new Array(256).fill(0);
    for (let i = y0 * 128; i < y1 * 128; i++) cnt[px[i]]++;
    const n = (y1 - y0) * 128, mx = Math.max(...cnt), f = mx / n;
    stat.frames++;
    stat.hist[Math.min(9, Math.floor(f * 10))]++;
    // "fills the window": one colour on >= 85% of it (a healthy frame peaks near 60%: grass in the
    // cockpit view; the old fill() bug painted ~94%, the rows above the post stayed sky)
    if (f >= 0.85) stat.fullOne.push(what + ' P' + (p + 1) + ' colour ' + cnt.indexOf(mx) + ' ' + (f * 100).toFixed(1) + '%');
    if (f > stat.worst) { stat.worst = f; stat.worstAt = what + ' P' + (p + 1) + ' (' + D.hh(p).ctx.local.raceView + ')'; }
    return f;
  };
  const pose = (p, x, y, hd) => {
    const c = D.hh(p).ctx.m.car;
    c.x = Math.round(x * 256); c.y = Math.round(y * 256); c.hd = hd & 0xffff; c.v = 0; c.lap = 0; c.cp = 0;
  };
  const camOff = p => (D.hh(p).ctx.local.raceView === 'chase' ? 20 : 0);
  const views = [['chase', 'cockpit'], ['cockpit', 'chase']];
  const isRoad = k => k >= 1 && k <= 13;
  let roadTiles = 0;
  // 1. every road tile x 8 headings, both views on both boards
  for (let ty = 0; ty < T.N; ty++) for (let tx = 0; tx < T.N; tx++) {
    if (!isRoad(T.KIND[ty * T.N + tx])) continue;
    roadTiles++;
    for (let h = 0; h < 8; h++) for (const vv of views) {
      D.hh(0).ctx.local.raceView = vv[0]; D.hh(1).ctx.local.raceView = vv[1];
      pose(0, tx * 8 + 4, ty * 8 + 4, h * 8192); pose(1, tx * 8 + 4, ty * 8 + 4, h * 8192);
      D.step(34);
      look(0, `tile ${tx},${ty} hd ${h * 45}`); look(1, `tile ${tx},${ty} hd ${h * 45}`);
    }
  }
  // 2. camera r px in front of every billboard, facing it (4 headings)
  const targets = T.DECOS.map(d => [d.x, d.y, 'deco' + d.k]).concat(...T.SPANS.map(s => [[s.ax, s.ay, 'post'], [s.bx, s.by, 'post']]));
  for (const [bx, by, kind] of targets) for (let h = 0; h < 4; h++) for (const r of [2, 4, 6, 8, 10, 14]) for (const vv of views) {
    D.hh(0).ctx.local.raceView = vv[0]; D.hh(1).ctx.local.raceView = vv[1];
    const hd = h * 16384, fx = Math.round(Math.cos(hd * Math.PI / 32768)), fy = Math.round(Math.sin(hd * Math.PI / 32768));
    for (const p of [0, 1]) { const back = camOff(p); pose(p, bx - fx * (r - back), by - fy * (r - back), hd); }
    D.step(34);
    look(0, `${kind} ${bx},${by} hd ${h * 90} r ${r}`); look(1, `${kind} ${bx},${by} hd ${h * 90} r ${r}`);
  }
  // 3. the rival kart near my camera: P1's car at z px ahead of P0's camera, lat px to the side,
  // on the first long straight; P0 shows the rival from the radio report (no interpolation)
  D.hh(0).ctx.local.raceRival = 'radio';
  const segs = T.CENTER.segs.filter(q => !q.diag).sort((p, q) => q.len - p.len), sg = segs[0];
  const ux = Math.round(sg.ux), uy = Math.round(sg.uy), hd = sg.hd;
  const mx = sg.ax + ux * sg.len * 0.6, my = sg.ay + uy * sg.len * 0.6;   // my car
  const rival = {};
  for (const view of ['chase', 'cockpit']) {
    D.hh(0).ctx.local.raceView = view; D.hh(1).ctx.local.raceView = 'cockpit';
    const back = view === 'chase' ? 20 : 0, cx = mx - ux * back, cy = my - uy * back;
    // reference frame: the rival far behind me (off screen)
    pose(0, mx, my, hd); pose(1, mx - ux * 80, my - uy * 80, hd); D.step(400);
    const ref = D.pixels(0);
    for (const [z, lat] of [[2, 0], [4, 0], [6, 0], [7, 0], [9, 6], [10, 0], [12, 6], [14, 0], [16, -8], [20, 9], [20, -9], [28, 0], [40, 0]]) {
      pose(0, mx, my, hd); pose(1, cx + ux * z - uy * lat, cy + uy * z + ux * lat, hd); D.step(400);
      const px = D.pixels(0);
      let diff = 0;
      for (let i = y0 * 128; i < y1 * 128; i++) if (px[i] !== ref[i]) diff++;
      look(0, `rival ${view} z ${z} lat ${lat}`);
      rival[view + ' z' + z + (lat ? ' lat' + lat : '')] = diff;
    }
  }
  D.hh(0).ctx.local.raceRival = null;
  return {id: T.id, roadTiles, targets: targets.length, stat, rival, errors: D.errors(), lint: D.lint(), phase: D.central().mode.snapshot.phase,
    screens: [D.screen(0).id, D.screen(1).id]};
}

(async () => {
  const browser = await pw.chromium.launch();
  const t0 = Date.now();
  const el = () => `${((Date.now() - t0) / 1000).toFixed(0)} s`;
  for (const lang of LANGS) for (const width of WIDTHS) {
    const page = await browser.newPage({viewport: {width, height: 900}});
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
    await page.goto(`${BASE}?test=1&lang=${lang}`);
    await page.evaluate(() => window.DEVICE.ready);
    const tag = `${lang}-${width}`;
    const first = lang === LANGS[0] && width === WIDTHS[0];
    const tracks = await page.evaluate(() => window.DEVICE.rules('racing').tracks().map(t => ({id: t.id, N: t.N})));
    check(tracks.map(t => t.id).join(',') === 'classic,park,riptide,gale,switchback', `${tag}: track list ${tracks.map(t => t.id)}`);
    if (PARTS.has('race')) {
      for (let ti = 0; ti < tracks.length; ti++) {
        const T = tracks[ti];
        const views = T.N === 32 ? ['chase', 'cockpit'] : ['top', 'chase', 'cockpit'];
        const pairs = ti <= 1 ? PAIRS : FEW.slice(0, PAIRS_OTHER);
        for (const view of views) {
          const res = [];
          for (const [a, b] of pairs) {
            const ui = a === b || (a === 2 && b === 0);
            const r = await page.evaluate(raceOnce, {a, b, ui, view, other: OTHER[view], track: ti, laps: 1, seed: 40 + a * 3 + b + ti * 10});
            const t = `${tag} ${T.id} ${view} pair ${a}${b}${ui ? ' (ui)' : ''}`;
            check(r.picked[0] === a && r.picked[1] === b, `${t}: picked ${r.picked}`);
            check(r.trackSet && r.track === ti && r.tid === T.id, `${t}: track set (${r.track}, ${r.trackSet}, ${r.tid})`);
            check(r.views && r.views[0] === view, `${t}: P1 view ${JSON.stringify(r.views)}`);
            check(view === 'top' || r.scenes[0].includes(view), `${t}: P1 drew ${view} ${JSON.stringify(r.scenes)}`);
            check(r.phase === 4, `${t}: reached results (phase ${r.phase})`);
            check(r.laps.every(l => l[0] === 1 && l[1] > 0), `${t}: both finish 1 lap ${JSON.stringify(r.laps)}`);
            check(r.wrong[0] + r.wrong[1] === 0 && r.wsfx[0] + r.wsfx[1] === 0, `${t}: wrong way ${r.wrong} sfx ${r.wsfx}`);
            check(r.screens.every(s => s === 'results'), `${t}: both on results ${r.screens}`);
            check(r.errors.length === 0, `${t}: errors ${JSON.stringify(r.errors).slice(0, 400)}`);
            check(r.lint.length === 0, `${t}: lint ${JSON.stringify(r.lint).slice(0, 600)}`);
            res.push(`${a}${b}:${r.laps.map(l => (l[1] / 100).toFixed(1)).join('/')}`);
          }
          console.log(tag, T.id.padEnd(10), view.padEnd(7), res.join(' '), `(${el()})`);
        }
      }
    }
    if (PARTS.has('fix')) {
      for (const f of ['race.lap2', 'race.splash', 'race.views']) {
        const r = await page.evaluate(id => window.DEVICE.fixture(id).then(x => ({ok: x.ok, error: x.error})), f);
        check(r.ok, `${tag} fixture ${f}: ${r.error}`);
      }
      console.log(tag, 'fixtures done', `(${el()})`);
    }
    if (PARTS.has('steer')) {
      for (const view of ['chase', 'cockpit', 'top']) {
        await page.evaluate(view => {
          const D = window.DEVICE;
          D.reset({seed: 51, mode: 'racing'});
          D.hh(0).ctx.local.raceView = view;
          D.step(400); let w = 0; while ((!D.central().mode || D.screen(0).id !== 'race.pick') && w++ < 50) D.step(100); D.step(300);
          D.debug('pick', 0 + 4 * 1); D.bot(1, true);
          let g = 0; while (D.central().mode.snapshot.phase < 2 && g++ < 100) D.step(100);
          D.step(600); D.pressure(0, 160); D.step(800);
        }, view);
        const hd = () => page.evaluate(() => window.DEVICE.hh(0).ctx.m.car.hd);
        const step = ms => page.evaluate(ms => window.DEVICE.step(ms), ms);
        const d = (x, y) => (((y - x + 32768) & 0xffff) - 32768) * 360 / 65536;
        const h0 = await hd();
        await page.keyboard.down('KeyD'); await step(400); const h1 = await hd(); await step(400); const h2 = await hd();
        await page.keyboard.up('KeyD'); await step(400); const h3 = await hd();
        await page.keyboard.down('KeyA'); await step(400); const h4 = await hd(); await page.keyboard.up('KeyA');
        await page.evaluate(() => window.DEVICE.pressure(0, 0));
        if (view === 'top') {
          check(Math.abs(d(h0, h2)) < 2, `${tag} top: right key holds the heading east (${d(h0, h2)})`);
          check(d(h3, h4) < -60, `${tag} top: left key turns toward west (${d(h3, h4)})`);
        } else {
          check(d(h0, h1) > 30 && d(h1, h2) > 30, `${tag} ${view}: holding right keeps turning right (${d(h0, h1)}, ${d(h1, h2)})`);
          check(Math.abs(d(h2, h3)) < 1, `${tag} ${view}: released = straight (${d(h2, h3)})`);
          check(d(h3, h4) < -30, `${tag} ${view}: left turns left (${d(h3, h4)})`);
        }
      }
      console.log(tag, 'steering done', `(${el()})`);
    }
    if (PARTS.has('laps3') && first) {
      for (let ti = 1; ti < tracks.length; ti++) {
        const view = ti & 1 ? 'chase' : 'cockpit';
        const r = await page.evaluate(raceOnce, {a: ti % 3, b: (ti + 1) % 3, ui: false, view, other: OTHER[view], track: ti, laps: 3, seed: 300 + ti});
        const t = `${tag} ${tracks[ti].id} 3 laps ${view}`;
        check(r.phase === 4 && r.laps.every(l => l[0] === 3 && l[1] > 0), `${t}: both finish 3 laps ${JSON.stringify(r.laps)}`);
        check(r.wrong[0] + r.wrong[1] === 0 && r.wsfx[0] + r.wsfx[1] === 0, `${t}: wrong way ${r.wrong} sfx ${r.wsfx}`);
        check(r.errors.length === 0 && r.lint.length === 0, `${t}: clean ${JSON.stringify(r.errors).slice(0, 300)} ${JSON.stringify(r.lint).slice(0, 300)}`);
        console.log(t.padEnd(36), 'total', r.laps.map(l => (l[1] / 100).toFixed(2)).join(' / '), 's, best lap', r.laps.map(l => (l[2] / 100).toFixed(2)).join(' / '), 's', `(${el()})`);
      }
    }
    if (PARTS.has('flash')) {
      const r = await page.evaluate(flashTest);
      const t = `${tag} flash`;
      check(r.screen === 'results' && r.fps === 6, `${t}: loser on the 6 fps results screen (${r.screen}, ${r.fps})`);
      check(r.quietGaps.length >= 4 && r.quietGaps.every(g => g >= 164 && g <= 170), `${t}: quiet pacing 6 fps ${JSON.stringify(r.quietGaps)}`);
      check(r.first && r.first.border && r.first.dt <= 33, `${t}: the border is on the glass within 33 ms ${JSON.stringify(r.first)}`);
      check(r.duringFrames >= 4, `${t}: >= 30 fps while the flash runs (${r.duringFrames} frames in 120 ms) ${JSON.stringify(r.seen.slice(0, 8))}`);
      check(r.lastBorder >= 100 && r.lastBorder < 120 && r.firstClean >= 120 && r.firstClean <= 120 + 34, `${t}: the border lasts its 120 ms (last ${r.lastBorder}, gone at ${r.firstClean})`);
      check(r.errors.length === 0 && r.lint.length === 0, `${t}: clean`);
      console.log(t, 'first frame after', r.first && r.first.dt, 'ms;', r.duringFrames, 'frames during; gone at', r.firstClean, 'ms; quiet gaps', r.quietGaps.join(','));
    }
    if (PARTS.has('sweep') && first) {
      for (let ti = 1; ti < tracks.length; ti++) {
        const r = await page.evaluate(sweep, ti);
        const t = `${tag} sweep ${r.id}`;
        check(r.stat.fullOne.length === 0, `${t}: ${r.stat.fullOne.length} frames fill the 3D window (>= 85%) with one colour: ${r.stat.fullOne.slice(0, 5).join('; ')}`);
        check(r.phase < 4 && r.screens.every(s => s === 'race.hud'), `${t}: still racing ${r.phase} ${r.screens}`);
        check(r.errors.length === 0 && r.lint.length === 0, `${t}: clean ${JSON.stringify(r.errors).slice(0, 300)} ${JSON.stringify(r.lint).slice(0, 300)}`);
        const rv = r.rival;
        for (const v of ['chase', 'cockpit']) for (const z of (v === 'chase' ? [2, 4, 6, 7] : [2])) check(rv[v + ' z' + z] === 0, `${t}: rival at ${z} px from the ${v} camera is not drawn (${rv[v + ' z' + z]} px)`);
        for (const z of [6, 7]) check(rv['cockpit z' + z] > 0, `${t}: rival at ${z} px (bumper to bumper; kart clip 4 px, e7dc5fa) is drawn in the cockpit (${rv['cockpit z' + z]} px)`);
        for (const k of ['chase z20 lat9', 'chase z20 lat-9', 'chase z14', 'chase z12 lat6', 'chase z10', 'chase z9 lat6', 'cockpit z10', 'cockpit z28']) check(rv[k] > 40, `${t}: rival drawn at ${k} (${rv[k]} px)`);
        console.log(t, `${r.roadTiles} road tiles, ${r.targets} billboards, ${r.stat.frames} frames; largest one-colour share ${(r.stat.worst * 100).toFixed(1)}% at ${r.stat.worstAt}; share histogram ${r.stat.hist.join(',')}`, `(${el()})`);
        console.log('   rival px', JSON.stringify(rv));
      }
    }
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(scroll <= 0, `${tag}: horizontal scroll ${scroll}px`);
    check(pageErrors.length === 0, `${tag} page errors: ${pageErrors.join(' | ').slice(0, 600)}`);
    const fin = await page.evaluate(() => ({errors: window.DEVICE.errors(), lint: window.DEVICE.lint()}));
    check(fin.errors.length === 0 && fin.lint.length === 0, `${tag} end: ${JSON.stringify(fin).slice(0, 600)}`);
    await page.close();
  }
  await browser.close();
  console.log(el(), fails.length ? `${fails.length} FAILURES` : 'ALL OK');
  process.exit(fails.length ? 1 : 0);
})();
