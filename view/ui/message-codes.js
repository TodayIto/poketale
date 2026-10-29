// from pokerogue src/ui/handlers/message-ui-handler.ts (showTextInternal @c/@d/@s/@f codes) @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

export const frameMs = frames => Math.floor((1000 / 60) * frames);

export function parseCodes(text) {
  const delays = new Map(), sounds = new Map();
  let plain = '', count = 0;
  const source = String(text ?? '');
  const pattern = /@([cdsf])\{([^}]*)\}/g;
  let last = 0, match;
  const add = chunk => { plain += chunk; for (const ch of chunk) if (!/\s/.test(ch)) count++; };
  while ((match = pattern.exec(source))) {
    add(source.slice(last, match.index));
    last = pattern.lastIndex;
    if (match[1] === 'd') delays.set(count, (delays.get(count) ?? 0) + frameMs(Number.parseInt(match[2], 10) || 0));
    else if (match[1] === 's') sounds.set(count, [...(sounds.get(count) ?? []), match[2]]);
  }
  add(source.slice(last));
  return { plain, delays, sounds };
}

// The same position count (message.js uses it to subtract the characters of earlier pages)
export const visibleCount = text => Array.from(String(text ?? '')).filter(ch => !/\s/.test(ch)).length;

export const soundPath = key => (/\.\w+$/.test(key) ? key : `${key}.wav`);

export function typeWithCodes(message, page, { delays, sounds }, offset = 0) {
  const { scene, text, prompt } = message;
  text.setText(''); prompt.setVisible(false);
  const characters = Array.from(page);
  return new Promise(resolve => {
    let index = 0, seen = offset, timer = null, done = false;
    const finish = () => {
      if (done) return;
      done = true; timer?.remove?.(); text.setText(page); message.advance = null; resolve();
    };
    const step = () => {
      if (index >= characters.length) return finish();
      timer = scene.time.delayedCall(20, () => {
        if (done) return;
        const ch = characters[index++];
        text.setText(characters.slice(0, index).join(''));
        if (/\s/.test(ch)) step();
        else at(++seen);
      });
    };
    const at = k => {
      const go = () => {
        if (done) return;
        for (const key of sounds.get(k) ?? []) Promise.resolve(scene.audio?.play(soundPath(key))).catch(() => {});
        step();
      };
      const wait = delays.get(k);
      if (wait) timer = scene.time.delayedCall(wait, go); else go();
    };
    message.advance = finish;
    if (offset === 0) at(0); else step();
  });
}
