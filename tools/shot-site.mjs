// Screenshots docs/ pages at desktop and phone width: node tools/shot-site.mjs [page]
import {chromium} from 'playwright-core';
import {createServer} from 'node:http';
import {readFileSync, existsSync, mkdirSync} from 'node:fs';
import {join, extname} from 'node:path';
const root = join(process.cwd(), 'docs'), out = join(process.cwd(), 'tools/e2e-out');
mkdirSync(out, {recursive: true});
const types = {'.html': 'text/html', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.js': 'text/javascript'};
const server = createServer((req, res) => {
  let p = join(root, decodeURIComponent(req.url.split('?')[0]));
  if (req.url.split('?')[0].endsWith('/')) p = join(p, 'index.html');
  if (!existsSync(p)) { res.statusCode = 404; return res.end(); }
  res.setHeader('content-type', types[extname(p)] || 'application/octet-stream'); res.end(readFileSync(p));
}).listen(8799);
const page = process.argv[2] || 'index.html';
const browser = await chromium.launch({channel: 'msedge'});
for (const [name, viewport] of [['desktop', {width: 1366, height: 900}], ['phone', {width: 390, height: 844}]]) {
  const p = await browser.newPage({viewport});
  await p.goto(`http://127.0.0.1:8799/${page}`); await p.waitForTimeout(800);
  await p.screenshot({path: join(out, `site-${page.replace('.html', '')}-${name}.png`), fullPage: true});
  // The drawn panel's English half of the animation.
  if (name === 'desktop' && await p.locator('.frame').isVisible().catch(() => false)) {
    await p.waitForTimeout(3400); await p.locator('.frame').screenshot({path: join(out, 'site-frame-en.png')});
  }
}
await browser.close(); server.close();
