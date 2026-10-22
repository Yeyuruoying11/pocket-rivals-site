// Preload (node -r ./tests/route.js tests/<test>.js): every page the test opens on
// http://127.0.0.1:<port>/... is answered from the site folder on disk by
// Playwright's request interception, so the browser tests need no server
// or network (they run inside the agent's no-network sandbox).
global.PR_ROUTED = true;
const path = require('path'), fs = require('fs');
const SITE = path.resolve(__dirname, '..');
const pw = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright');
const TYPES = {'.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.ico': 'image/x-icon', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'};
async function serve(target) {
  await target.route(/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//, route => {
    const u = new URL(route.request().url());
    let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(SITE, p);
    if (!f.startsWith(SITE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return route.fulfill({status: 404, body: 'not found'});
    return route.fulfill({status: 200, body: fs.readFileSync(f), contentType: TYPES[path.extname(f)] || 'application/octet-stream'});
  });
  return target;
}
const launch = pw.chromium.launch.bind(pw.chromium);
pw.chromium.launch = async (...a) => {
  const b = await launch(...a);
  const nc = b.newContext.bind(b), np = b.newPage.bind(b);
  b.newContext = async (...o) => serve(await nc(...o));
  b.newPage = async (...o) => { const c = await nc(...o); await serve(c); const pg = await c.newPage(); pg.close = (pc => async (...x) => { await pc(...x); await c.close(); })(pg.close.bind(pg)); return pg; };
  return b;
};
