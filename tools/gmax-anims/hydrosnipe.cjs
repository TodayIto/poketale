const fs = require('fs');
const out = 'g-max-hydrosnipe.json';
const snipe = JSON.parse(fs.readFileSync('vendor/pokerogue/assets/battle-anims/snipe-shot.json'));
const clone = x => JSON.parse(JSON.stringify(x));
const base = snipe.frames[0];
const frames = [], ev = {};
const add = (f, e) => (ev[f] ??= []).push({ frameIndex: f, ...e });
const sound = (f, name, volume, pitch) => add(f, { resourceName: name, volume, pitch, eventType: 'AnimTimedSoundEvent' });
let seq = 0;
const fg = (f, e, type) => add(f, { resourceName: '', ...e, eventType: type, seq: seq++ });

for (let f = 0; f < 14; f++) {
  const fr = clone(base), k = Math.min(1, f / 10);
  fr[0].tone = [0, Math.round(40 * k), Math.round(110 * k), 0];
  frames.push(fr);
}
fg(0, { resourceName: 'PRAS- Surf FG', bgX: -500, bgY: 200, opacity: 0, duration: 5 }, 'AnimTimedAddFgEvent');
fg(0, { opacity: 255, duration: 5 }, 'AnimTimedUpdateFgEvent');
fg(1, { bgX: 350, bgY: -370, duration: 16 }, 'AnimTimedUpdateFgEvent');
fg(11, { opacity: 0, duration: 4 }, 'AnimTimedUpdateFgEvent');
sound(0, 'PRSFX- Hydro Vortex2.wav', 100, 120);

for (let i = 0; i < 14; i++) {
  const fr = clone(snipe.frames[i]), k = Math.max(0, 1 - i / 6);
  fr[0].tone = [0, Math.round(40 * k), Math.round(110 * k), 0];
  frames.push(fr);
}
sound(14, 'PRSFX- Hydro Vortex1.wav', 70, 150);
sound(21, 'PRSFX- Hydro Pump.wav', 80, 100);

for (let i = 6; i < 14; i++) {
  const fr = clone(snipe.frames[i]);
  for (const c of fr.slice(2)) { c.zoomX = 110; c.zoomY = 110; }
  frames.push(fr);
}
sound(29, 'PRSFX- Hydro Pump.wav', 100, 85);

const shake = [132, 120, 140, 148, 136, 116, 108, 120, 136, 116, 136, 124];
shake.forEach((x, i) => {
  const fr = clone(base);
  fr[1].x = x;
  fr[1].tone = i < 2 ? [255, 255, 255, 0] : i < 6 ? [0, 30, 90, 0] : [0, 0, 0, 0];
  frames.push(fr);
});
fg(36, { resourceName: 'PRAS- Flash FG', bgX: 0, bgY: 0, opacity: 0, duration: 0 }, 'AnimTimedAddFgEvent');
fg(36, { opacity: 255, duration: 1 }, 'AnimTimedUpdateFgEvent');
fg(37, { opacity: 0, duration: 6 }, 'AnimTimedUpdateFgEvent');
[[36, 100], [38, 95], [40, 90], [42, 105]].forEach(([f, p]) => sound(f, 'PRSFX- Hydro Vortex3.wav', 100, p));

for (let f = 0; f < 8; f++) frames.push(clone(base));
const bg = [
  { f: 2, set: 'PRAS- Underwater BG', x: 0, y: 0, o: 0, c: [0, 0, 0, 0] }, { f: 2, d: 6, o: 255 },
  { f: 17, set: 'GEN8- Snipe Shot bg2', x: 0, y: 0, o: 0, c: [0, 0, 0, 0] }, { f: 17, d: 5, o: 128 },
  { f: 48, d: 6, o: 0 },
];
const anim = { graphic: snipe.graphic, position: snipe.position, hue: 0, frames, frameTimedEvents: ev, bg };
fs.writeFileSync(`view/anims/z/${out}`, JSON.stringify(anim));
console.log(out, frames.length, 'frames');
