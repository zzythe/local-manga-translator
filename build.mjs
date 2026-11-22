// Builds everything from src/translator.src.js:
//   dist/chrome/          unpacked extension for Chrome, Edge, Brave, Vivaldi, Opera
//   dist/firefox/         unpacked extension for Firefox
//   dist/*.zip            store uploads
//   local-manga-translator.user.js   the userscript (personal use)
//     node build.mjs
import {readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync, createWriteStream} from 'node:fs';
import {join, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {ZipArchive} from 'archiver';

const root = dirname(fileURLToPath(import.meta.url));
const read = p => readFileSync(join(root, p), 'utf8');

const source = read('src/translator.src.js');
const original = read('src/original-v1.1.0.user.js');
const font = /const encoded = '([A-Za-z0-9+/=]+)'/.exec(original)?.[1];
const license = /\/\* Bundled Comic Neue Bold[\s\S]*?\*\//.exec(original)?.[0];
if (!font || !license) throw new Error('Could not find the bundled font or its licence in the original script.');
if (!source.includes("'__FONT_DATA__'") || !source.includes('/*__FONT_LICENSE__*/')) throw new Error('Placeholders missing.');

const manifest = JSON.parse(read('extension/manifest.json'));
const withFont = source
  .replace('/*__FONT_LICENSE__*/', () => license.replace(/^\s+/, ''))
  .replace("'__FONT_DATA__'", () => `'${font}'`);

// Userscript: same version as the extension.
const userscript = withFont.replace(/(\/\/ @version\s+)\S+/, `$1${manifest.version}`);
writeFileSync(join(root, 'local-manga-translator.user.js'), userscript);

// Extension content script: no userscript header.
const contentScript = withFont.replace(/^\/\/ ==UserScript==[\s\S]*?\/\/ ==\/UserScript==\s*/, '');

const dist = join(root, 'dist');
rmSync(dist, {recursive: true, force: true});

function buildExtension(name, editManifest) {
  const out = join(dist, name);
  cpSync(join(root, 'extension'), out, {recursive: true});
  cpSync(join(root, 'node_modules/extpay/dist/ExtPay.js'), join(out, 'ExtPay.js'));
  mkdirSync(join(out, 'fonts'), {recursive: true});
  writeFileSync(join(out, 'fonts/ComicNeue-Bold.ttf'), Buffer.from(font, 'base64'));
  writeFileSync(join(out, 'fonts/OFL.txt'), license.replace(/^\/\*|\*\/$/g, '').trim() + '\n');
  writeFileSync(join(out, 'translator.js'), contentScript);
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(editManifest(structuredClone(manifest)), null, 2));
  return out;
}

buildExtension('chrome', m => m);

buildExtension('firefox', m => {
  // Firefox runs background scripts as an event page instead of a service worker.
  m.background = {scripts: ['ExtPay.js', 'config.js', 'background.js']};
  delete m.minimum_chrome_version;
  m.permissions = m.permissions.map(p => p === 'declarativeNetRequestWithHostAccess' ? 'declarativeNetRequest' : p);
  m.host_permissions = [...m.host_permissions, 'https://extensionpay.com/*'];
  m.browser_specific_settings = {gecko: {id: 'local-manga-translator@zzythe', strict_min_version: '128.0',
    data_collection_permissions: {required: ['none']}}};
  return m;
});

function zip(folder, file) {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(join(dist, file));
    const archive = new ZipArchive({zlib: {level: 9}});
    output.on('close', resolve); archive.on('error', reject);
    archive.pipe(output);
    archive.directory(join(dist, folder), false);
    archive.finalize();
  });
}
await zip('chrome', `local-manga-translator-${manifest.version}-chrome.zip`);
await zip('firefox', `local-manga-translator-${manifest.version}-firefox.zip`);

const size = p => (statSync(join(dist, p)).size / 1024).toFixed(0) + ' KB';
console.log(`Built ${manifest.version}:`, readdirSync(dist).filter(f => f.endsWith('.zip')).map(f => `${f} (${size(f)})`).join(', '));
