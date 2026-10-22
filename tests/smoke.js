// Every registered fixture in zh and en at 1200 px: fixture ok, then
// DEVICE.errors() and DEVICE.lint() empty, no page errors.
//   node -r ./tests/route.js tests/smoke.js [filter-regex]
const pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const FILTER = new RegExp(process.argv[2] || '.');
(async () => {
  const browser = await pw.chromium.launch();
  const fails = [];
  for (const lang of ['zh', 'en']) {
    const page = await browser.newPage({viewport: {width: 1200, height: 900}});
    page.on('pageerror', e => fails.push(`${lang} pageerror: ${e.message}`));
    await page.goto(`http://127.0.0.1:8961/device.html?test=1&lang=${lang}`);
    await page.waitForFunction(() => window.DEVICE && window.DEVICE._started);
    const r = await page.evaluate(async src => {
      const D = window.DEVICE, re = new RegExp(src), out = [];
      const ids = D.fixtures().map(f => typeof f === 'string' ? f : f.id).filter(id => re.test(id));
      for (const id of ids) { const res = await D.fixture(id); if (!res.ok) out.push(`fixture ${id}: ${res.error}`); }
      return {ids: ids.length, out, errors: D.errors(), lint: D.lint()};
    }, FILTER.source);
    console.log(`${lang}: ${r.ids} fixtures`);
    fails.push(...r.out.map(s => `${lang} ${s}`));
    if (r.errors.length) fails.push(`${lang} errors(): ${JSON.stringify(r.errors).slice(0, 1500)}`);
    if (r.lint.length) fails.push(`${lang} lint(): ${JSON.stringify(r.lint).slice(0, 1500)}`);
    await page.close();
  }
  await browser.close();
  console.log(fails.length ? 'FAILED\n' + fails.join('\n') : 'ALL OK');
  process.exit(fails.length ? 1 : 0);
})();
