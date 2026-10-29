import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

export function expTextBase64() {
  return gzipSync(readFileSync(new URL('./text-exp-ko.json', import.meta.url)), { level: 9 }).toString('base64');
}
