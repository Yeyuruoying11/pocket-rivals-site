// Racing track picker blurbs (§5.10): for zh and en, cycle the picker through
// all five tracks, check every drawn blurb line, then prove the leadPunct lint
// fires on a wrapped line that would start with a comma.
//   node -r ./tests/route.js tests/blurb-test.js [PORT=8961]
const pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const PORT = +(process.argv[2] || 8961);
const fails = [];
const check = (c, msg) => { console.log((c ? 'ok   ' : 'FAIL ') + msg); if (!c) fails.push(msg); };

// in-page: all five tracks on the picker's screen, then a forced comma-led line
function run({lang}) {
  const D = window.DEVICE, out = {seen: [], lead: []};
  D.reset({seed: 5, mode: 'racing'});
  D.step(400);
  let w = 0;
  while ((!D.central().mode || D.screen(0).id !== 'race.pick' || D.screen(1).id !== 'race.pick') && w++ < 50) D.step(100);
  D.step(300);
  const picker = (D.central().mode.snapshot.flags & 64) ? 1 : 0;
  const ids = D.rules('racing').tracks().map(t => t.id);
  const S = D.exportStrings()[lang];
  const strip = s => s.replace(/ /g, '');
  const want = {}; for (const id of ids) want[id] = strip(S['dev.race.trkB.' + id]);
  // the blurb is the text box at (76, 54): collect its drawn lines in order
  const lines = () => D.texts(picker).filter(t => t.x === 76 && t.y >= 54 && t.y < 110).sort((a, b) => a.y - b.y).map(t => t.s);
  for (let i = 0; i < ids.length; i++) {
    const ln = lines(), got = ln.join('');
    const id = ids.find(k => want[k] === strip(got)) || null;
    out.seen.push({id, lines: ln});
    D.press(picker, 'RIGHT'); D.step(200);
  }
  out.ids = ids; out.lint = D.lint(); out.errors = D.errors();
  // prove the new check: 48 px = 4 CJK per line, so the comma starts line 2
  D.clearLint();
  D.hh(picker).g.textBox(0, 0, 48, 56, '宽路大弯，看牌就转', {});
  out.lead = D.lint();
  D.clearLint();
  return out;
}

(async () => {
  const browser = await pw.chromium.launch();
  for (const lang of ['zh', 'en']) {
    const page = await browser.newPage({viewport: {width: 1200, height: 900}});
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') pageErrors.push('console: ' + m.text()); });
    await page.goto(`http://127.0.0.1:${PORT}/device.html?test=1&lang=${lang}`);
    await page.waitForFunction(() => window.DEVICE && window.DEVICE._started);
    const r = await page.evaluate(run, {lang});
    for (const s of r.seen) check(!!s.id, `${lang} blurb ${s.id || JSON.stringify(s.lines)}: ${s.lines.join(' / ')}`);
    check(r.ids.every(id => r.seen.some(s => s.id === id)), `${lang} all five tracks on the picker: ${r.seen.map(s => s.id).join(',')}`);
    check(r.errors.length === 0, `${lang} errors() empty ${JSON.stringify(r.errors).slice(0, 600)}`);
    check(r.lint.length === 0, `${lang} lint() empty ${JSON.stringify(r.lint).slice(0, 600)}`);
    check(r.lead.some(l => l.kind === 'leadPunct'), `${lang} leadPunct fires on "宽路大弯，看牌就转" ${JSON.stringify(r.lead).slice(0, 300)}`);
    check(pageErrors.length === 0, `${lang} no page errors ${pageErrors.join(' | ').slice(0, 600)}`);
    await page.close();
  }
  await browser.close();
  console.log(fails.length ? 'FAILED\n' + fails.join('\n') : 'ALL OK');
  process.exit(fails.length ? 1 : 0);
})();
