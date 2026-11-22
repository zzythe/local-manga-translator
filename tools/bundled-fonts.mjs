// A copy of dist/chrome that ignores locally installed lettering fonts, so captures for the store
// and website show the bundled fonts every user gets.
import {cpSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

export function bundledFontsBuild(root) {
  const dir = join(mkdtempSync(join(tmpdir(), 'mlt-ext-')), 'chrome');
  cpSync(join(root, 'dist/chrome'), dir, {recursive: true});
  const file = join(dir, 'translator.js'), code = readFileSync(file, 'utf8');
  const patched = code.replace('Promise.all(LOCAL_FONTS.map(', 'Promise.all([].map(');
  if (patched === code) throw new Error('Could not find the installed-font lookup in dist/chrome/translator.js.');
  writeFileSync(file, patched);
  return dir;
}
