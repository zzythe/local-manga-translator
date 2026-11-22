// Loads dist/chrome into a browser and reports whether the service worker starts.
import {chromium} from 'playwright-core';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const ext = join(process.cwd(), 'dist/chrome');
const channel = process.argv[2];
const ctx = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), 'mlt-')), {
  channel: channel === 'bundled' ? undefined : channel, headless: !process.argv.includes('--headed'),
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`]
});
let [sw] = ctx.serviceWorkers();
if (!sw) sw = await ctx.waitForEvent('serviceworker', {timeout: 10000}).catch(() => null);
console.log(channel, 'service worker:', sw ? sw.url() : 'none');
await ctx.close();
