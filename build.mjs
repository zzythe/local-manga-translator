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
// Bundled fonts (SIL Open Font License 1.1): dialogue lettering (made by tools/lettering-font.py),
// sound effects in a crisp brush hand and a heavy one, and the control's own title.
const fonts = [
  {file: 'MLTLettering-ExtraBold.ttf', licence: 'MLTLettering-OFL.txt', name: 'MLT Lettering (Shantell Sans ExtraBold, subset and condensed)', placeholder: "'__FONT_DATA__'"},
  {file: 'ComicNeue-Bold.ttf', licence: 'ComicNeue-OFL.txt', name: 'Comic Neue Bold', placeholder: "'__UI_FONT_DATA__'"},
  {file: 'SFXCrisp-Regular.ttf', licence: 'SFXCrisp-OFL.txt', name: 'MLT Brush Crisp (subset of Kaushan Script)', placeholder: "'__SFX_CRISP_DATA__'"},
  {file: 'Knewave-Regular.ttf', licence: 'Knewave-OFL.txt', name: 'Knewave', placeholder: "'__SFX_HEAVY_DATA__'"}
].map(f => ({...f, data: readFileSync(join(root, 'src/fonts', f.file)), text: read(`src/fonts/${f.licence}`)}));
const license = '/* Bundled fonts, SIL Open Font License 1.1.\n\n' +
  fonts.map(f => `${f.name}:\n${f.text.trim()}`).join('\n\n').replace(/\*\//g, '* /') + '\n*/';
if (!source.includes('/*__FONT_LICENSE__*/') || fonts.some(f => !source.includes(f.placeholder))) throw new Error('Placeholders missing.');

const manifest = JSON.parse(read('extension/manifest.json'));
const withFont = fonts.reduce((text, f) => text.replace(f.placeholder, () => `'${f.data.toString('base64')}'`),
  source.replace('/*__FONT_LICENSE__*/', () => license));

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
  // onnxruntime-web (MIT) for the local text detector: the WebAssembly build only.
  mkdirSync(join(out, 'ort'), {recursive: true});
  for (const f of ['ort.wasm.min.mjs', 'ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'])
    cpSync(join(root, 'node_modules/onnxruntime-web/dist', f), join(out, 'ort', f));
  mkdirSync(join(out, 'fonts'), {recursive: true});
  for (const f of fonts) {
    writeFileSync(join(out, 'fonts', f.file), f.data);
    writeFileSync(join(out, 'fonts', f.licence), f.text);
  }
  writeFileSync(join(out, 'translator.js'), contentScript);
  writeFileSync(join(out, 'manifest.json'), JSON.stringify(editManifest(structuredClone(manifest)), null, 2));
  return out;
}

buildExtension('chrome', m => m);

buildExtension('firefox', m => {
  // Firefox runs background scripts as an event page instead of a service worker.
  m.background = {scripts: ['ExtPay.js', 'config.js', 'background.js']};
  delete m.minimum_chrome_version;
  m.permissions = m.permissions.map(p => p === 'declarativeNetRequestWithHostAccess' ? 'declarativeNetRequest' : p).filter(p => p !== 'offscreen');
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
