// A copy of dist/chrome that ignores a locally installed CC Wild Words, so captures for the store
// and website show the bundled fonts every user gets.
import {cpSync, mkdtempSync, readFileSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

export function bundledFontsBuild(root) {
  const dir = join(mkdtempSync(join(tmpdir(), 'mlt-ext-')), 'chrome');
  cpSync(join(root, 'dist/chrome'), dir, {recursive: true});
  const file = join(dir, 'translator.js'), code = readFileSync(file, 'utf8');
  const patched = code.replace(/local\("CCWildWords-Roman"\), local\("CCWildWords"\), local\("CCWildWords Roman"\)/, 'local("MLT no such font")');
  if (patched === code) throw new Error('Could not find the CC Wild Words lookup in dist/chrome/translator.js.');
  writeFileSync(file, patched);
  return dir;
}
