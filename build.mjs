// Builds local-manga-translator.user.js from src/translator.src.js, copying the bundled
// Comic Neue font and its licence from the original 1.1.0 script.
//   node build.mjs
import {readFileSync, writeFileSync} from 'node:fs';

const here = new URL('.', import.meta.url);
const source = readFileSync(new URL('src/translator.src.js', here), 'utf8');
const original = readFileSync(new URL('src/original-v1.1.0.user.js', here), 'utf8');

const font = /const encoded = '([A-Za-z0-9+/=]+)'/.exec(original)?.[1];
const license = /\/\* Bundled Comic Neue Bold[\s\S]*?\*\//.exec(original)?.[0];
if (!font || !license) throw new Error('Could not find the bundled font or its licence in the original script.');
if (!source.includes("'__FONT_DATA__'") || !source.includes('/*__FONT_LICENSE__*/')) throw new Error('Placeholders missing.');

const output = source
  .replace('/*__FONT_LICENSE__*/', () => license.replace(/^\s+/, ''))
  .replace("'__FONT_DATA__'", () => `'${font}'`);
writeFileSync(new URL('local-manga-translator.user.js', here), output);
console.log(`Wrote local-manga-translator.user.js (${(output.length / 1024).toFixed(0)} KB, font ${(font.length / 1024).toFixed(0)} KB).`);
