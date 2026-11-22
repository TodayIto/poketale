const fs = require('fs');
const clone = x => JSON.parse(JSON.stringify(x));
const vendor = f => JSON.parse(fs.readFileSync(`vendor/pokerogue/assets/battle-anims/${f}.json`));

function variant(spec) {
  const base = spec.base, still = base.frames[0].filter(c => c.target === 0 || c.target === 1);
  const frames = [], ev = {}, bg = [];
  let seq = 0;
  const add = (f, e) => (ev[f] ??= []).push({ frameIndex: f, ...e });
  const sound = (f, [name, volume = 100, pitch = 100]) => add(f, { resourceName: name, volume, pitch, eventType: 'AnimTimedSoundEvent' });
  const fg = (f, e) => add(f, { resourceName: '', ...e, eventType: e.resourceName ? 'AnimTimedAddFgEvent' : 'AnimTimedUpdateFgEvent', seq: seq++ });
  const glowed = (fr, k) => { for (const c of fr) if (c.target === 0) c.tone = [...spec.glow.map(v => Math.round(v * k)), 0]; return fr; };

  const N = spec.intro;
  for (let f = 0; f < N; f++) frames.push(glowed(clone(still), Math.min(1, f / 8)));
  spec.introSounds.forEach(([f, s]) => sound(f, s));
  spec.introFg?.forEach(([f, e]) => fg(f, e.set ? { resourceName: e.set, bgX: e.x ?? 0, bgY: e.y ?? 0, opacity: e.o ?? 0, duration: e.d ?? 0 } : { ...(e.x != null ? { bgX: e.x, bgY: e.y } : {}), ...(e.o != null ? { opacity: e.o } : {}), duration: e.d ?? 0 }));
  bg.push(...spec.introBg);

  const moved = spec.mod ? spec.mod(clone(base.frames)) : clone(base.frames);

  moved.forEach((fr, i) => frames.push(fr.some(c => c.target === 0 && c.tone?.some(Boolean)) || i >= 6 ? fr : glowed(fr, 1 - i / 6)));
  for (const list of Object.values(base.frameTimedEvents ?? {})) for (const e of list)
    if (e.eventType === 'AnimTimedSoundEvent' && e.resourceName) sound(N + e.frameIndex, [e.resourceName, e.volume, e.pitch]);
  (spec.baseBg ?? []).forEach(b => bg.push({ ...b, f: N + b.f }));

  if (spec.hits) for (const i of spec.hits) frames.push(clone(moved[i]));
  if (spec.again) {
    const from = moved.length - spec.again;
    moved.slice(from).forEach(fr => frames.push(clone(fr)));
    for (const list of Object.values(base.frameTimedEvents ?? {})) for (const e of list)
      if (e.eventType === 'AnimTimedSoundEvent' && e.resourceName && e.frameIndex >= from) sound(N + moved.length + e.frameIndex - from, [e.resourceName, e.volume, e.pitch]);
  }

  const I = frames.length;
  const shake = [4, -8, 12, 20, 8, -12, -20, -8, 8, -12, 8, -4];
  shake.forEach((dx, i) => {
    const fr = clone(still);
    for (const c of fr) if (c.target === 1) { c.x += dx; c.tone = i < 2 ? [255, 255, 255, 0] : i < 6 ? [...spec.glow.map(v => Math.round(v * 0.7)), 0] : [0, 0, 0, 0]; }
    frames.push(fr);
  });
  fg(I, { resourceName: 'PRAS- Flash FG', bgX: 0, bgY: 0, opacity: 0, duration: 0 });
  fg(I, { opacity: 255, duration: 1 });
  fg(I + 1, { opacity: 0, duration: 6 });
  spec.impactSounds.forEach(([d, s]) => sound(I + d, s));
  spec.impactFg?.forEach(([d, e]) => fg(I + d, e.set ? { resourceName: e.set, bgX: 0, bgY: 0, opacity: e.o ?? 0, duration: e.d ?? 0 } : { opacity: e.o, duration: e.d ?? 0 }));

  const T = frames.length;
  for (let f = 0; f < 8; f++) frames.push(clone(still));
  if (bg.length) bg.push({ f: T, d: 6, o: 0 });
  return { graphic: base.graphic, position: base.position, hue: base.hue ?? 0, frames, frameTimedEvents: ev, bg };
}

const twoLines = (gap) => frames => frames.map(fr => {
  const out = [];
  const [px, py] = [0.447 * gap, 0.894 * gap];
  for (const c of fr) {
    if (c.target !== 2) { out.push(c); continue; }
    out.push({ ...c, x: c.x - px, y: c.y - py }, { ...c, x: c.x + px, y: c.y + py });
  }
  return out;
});
const tinted = tone => frames => frames.map(fr => fr.map(c => (c.target === 2 ? { ...c, tone } : c)));

const Z = {
  water: { intro: 14, glow: [0, 40, 110], introSounds: [[0, ['PRSFX- Hydro Vortex2.wav', 100, 120]], [12, ['PRSFX- Hydro Vortex1.wav', 70, 150]]],
    introFg: [[0, { set: 'PRAS- Surf FG', x: -500, y: 200, o: 0, d: 5 }], [0, { o: 255, d: 5 }], [1, { x: 350, y: -370, d: 16 }], [11, { o: 0, d: 4 }]],
    introBg: [{ f: 2, set: 'PRAS- Underwater BG', x: 0, y: 0, o: 0, c: [0, 0, 0, 0] }, { f: 2, d: 6, o: 255 }],
    impactSounds: [[0, ['PRSFX- Hydro Vortex3.wav', 100, 100]], [2, ['PRSFX- Hydro Vortex3.wav', 100, 95]], [4, ['PRSFX- Hydro Vortex3.wav', 100, 90]], [6, ['PRSFX- Hydro Vortex3.wav', 100, 105]]] },
  dark: { intro: 14, glow: [60, 0, 90], introSounds: [[0, ['PRSFX- Black Hole Eclipse2.wav', 100, 110]], [8, ['PRSFX- Black Hole Eclipse1.wav', 100, 85]], [8, ['PRSFX- Black Hole Eclipse4.wav', 100, 100]]],
    introFg: [[2, { set: 'PRAS- Black BG', o: 0, d: 5 }], [2, { o: 255, d: 5 }], [9, { o: 0, d: 3 }]],
    introBg: [{ f: 8, set: 'PRAS- Space BG', x: 0, y: 0, o: 255, c: [0, 0, 0, 0] }],
    impactSounds: [[0, ['PRSFX- Black Hole Eclipse3.wav', 100, 105]], [2, ['PRSFX- Black Hole Eclipse3.wav', 100, 95]], [4, ['PRSFX- Black Hole Eclipse3.wav', 100, 100]], [6, ['PRSFX- Black Hole Eclipse3.wav', 100, 85]]],
    impactFg: [[2, { set: 'PRAS- Black Hole Eclipse BG', o: 0, d: 0 }], [2, { o: 160, d: 3 }], [9, { o: 0, d: 3 }]] },

  darkPlain: { intro: 14, glow: [60, 0, 90], introSounds: [[0, ['PRSFX- Black Hole Eclipse2.wav', 100, 110]], [8, ['PRSFX- Black Hole Eclipse1.wav', 100, 85]]],
    introBg: [{ f: 2, set: '', x: 0, y: 0, o: 0, c: [0, 0, 0, 0] }, { f: 2, d: 8, o: 190 }],
    impactSounds: [[0, ['PRSFX- Black Hole Eclipse3.wav', 100, 105]], [2, ['PRSFX- Black Hole Eclipse3.wav', 100, 95]], [4, ['PRSFX- Black Hole Eclipse3.wav', 100, 100]]] },
  fire: { intro: 14, glow: [130, 40, 0], introSounds: [[0, ['PRSFX- Inferno Overdrive4.wav', 100, 100]], [10, ['PRSFX- Inferno Overdrive1.wav', 90, 140]]],
    introFg: [[2, { set: 'PRAS- Fire BG', o: 0, d: 5 }], [2, { o: 80, d: 5 }], [3, { x: 300, y: 0, d: 60 }]],
    introBg: [{ f: 2, set: 'PRAS- Burning BG', x: 0, y: 0, o: 0, c: [0, 0, 0, 0] }, { f: 2, d: 6, o: 255 }],
    impactSounds: [[0, ['PRSFX- Inferno Overdrive3.wav', 80, 100]], [2, ['PRSFX- Inferno Overdrive5.wav', 80, 100]], [5, ['PRSFX- Inferno Overdrive3.wav', 80, 105]]] },

  grass: { intro: 14, glow: [20, 90, 20], introSounds: [[0, ['PRSFX- Bloom Doom2.wav', 100, 110]], [0, ['PRSFX- Bloom Doom1.wav', 60, 170]]],
    introFg: [[0, { set: 'PRAS- Flash FG', o: 0, d: 5 }], [0, { o: 70, d: 5 }], [6, { o: 255, d: 3 }], [10, { o: 0, d: 4 }]],
    introBg: [{ f: 8, set: 'PRAS- Petal BG', x: 0, y: 0, o: 255, c: [0, 0, 0, 0] }],
    impactSounds: [[0, ['PRSFX- Bloom Doom3.wav', 100, 80]]] },

  grassBeat: { intro: 14, glow: [20, 90, 20], introSounds: [[0, ['PRSFX- Bloom Doom2.wav', 100, 110]]],
    introFg: [[0, { set: 'PRAS- Flash FG', o: 0, d: 0 }], [2, { o: 120, d: 1 }], [3, { o: 0, d: 2 }], [6, { o: 120, d: 1 }], [7, { o: 0, d: 2 }], [10, { o: 160, d: 1 }], [11, { o: 0, d: 2 }]],
    introBg: [],
    impactSounds: [[0, ['PRSFX- Bloom Doom3.wav', 100, 80]]] },

  bug: { intro: 14, glow: [70, 100, 0], introSounds: [[0, ['PRSFX- SSO1.m4a', 100, 105]], [10, ['PRSFX- SSO2.m4a', 100, 95]]], introBg: [],
    impactSounds: [[0, ['PRSFX- SSO5.m4a', 100, 75]], [2, ['PRSFX- SSO5.m4a', 100, 70]], [4, ['PRSFX- SSO12.m4a', 100, 100]]] },
  fighting: { intro: 14, glow: [120, 40, 0], introSounds: [[6, ['PRSFX- All Out Pummeling1.wav', 100, 110]], [8, ['PRSFX- All Out Pummeling1.wav', 100, 100]], [10, ['PRSFX- All Out Pummeling2.wav', 100, 110]]],
    introBg: [{ f: 0, set: 'PRAS- All Out Pummeling BG', x: 0, y: 0, o: 0, c: [0, 0, 0, 0] }, { f: 0, d: 5, o: 255 }],
    impactSounds: [[0, ['PRSFX- All Out Pummeling3.wav', 100, 110]]] },
  flying: { intro: 14, glow: [60, 80, 110], introSounds: [[0, ['PRSFX- Brave Bird1.wav', 100, 100]], [10, ['PRSFX- Brave Bird2.wav', 100, 40]]], introBg: [],
    impactSounds: [[0, ['Explosion.m4a', 80, 50]], [6, ['Explosion.m4a', 80, 50]]] },
  ground: { intro: 14, glow: [100, 70, 20], introSounds: [[0, ['PRSFX- Tectonic Rage6.m4a', 100, 115]], [7, ['PRSFX- Tectonic Rage2.m4a', 100, 100]]],
    introBg: [{ f: 2, set: 'PRAS- Tectonic Rage BG', x: 0, y: 0, o: 0, c: [0, 0, 0, 0] }, { f: 2, d: 4, o: 255 }, { f: 6, d: 60, y: -500 }],
    impactSounds: [[0, ['PRSFX- Tectonic Rage3.m4a', 100, 100]], [4, ['PRSFX- Tectonic Rage5.m4a', 100, 50]]] },
  ice: { intro: 14, glow: [40, 90, 120], introSounds: [0, 2, 4, 6, 8, 10, 12].map(f => [f, ['PRSFX- Subzero Slammer1.wav', 100, 100]]),
    introFg: [[2, { set: 'PRAS- Blizzard FG', o: 0, d: 5 }], [2, { o: 60, d: 5 }], [3, { x: 500, y: 0, d: 30 }]],
    introBg: [{ f: 2, set: 'PRAS- Icy Wind BG', x: 0, y: 0, o: 0, c: [0, 0, 0, 0] }, { f: 2, d: 10, o: 120 }],
    impactSounds: [[0, ['PRSFX- Subzero Slammer3.wav', 100, 100]], [0, ['PRSFX- Subzero Slammer4.wav', 100, 100]]] },
  normal: { intro: 14, glow: [110, 100, 40], introSounds: [5, 10].map(f => [f, ['PRSFX- Breakneck Blitz2.m4a', 100, 100 + f]]),
    introFg: [[0, { set: 'PRAS- Flash FG', o: 0, d: 0 }], [6, { o: 100, d: 1 }], [7, { o: 0, d: 2 }], [11, { o: 100, d: 1 }], [12, { o: 0, d: 2 }]], introBg: [],
    impactSounds: [[0, ['PRSFX- Breakneck Blitz1.m4a', 100, 130]]] },
  poison: { intro: 14, glow: [90, 0, 110], introSounds: [[0, ['PRSFX- Acid Downpour3.m4a', 100, 115]], [7, ['PRSFX- Acid Downpour3.m4a', 100, 90]]],
    introBg: [{ f: 2, set: 'PRAS- Acid Downpour FG2', x: 0, y: 0, o: 0, c: [0, 0, 0, 0] }, { f: 2, d: 5, o: 100 }, { f: 2, d: 60, x: 400 }],
    impactSounds: [[0, ['PRSFX- Acid Downpour7.m4a', 100, 100]], [3, ['PRSFX- Acid Downpour7.m4a', 90, 100]]] },
  dragon: { intro: 12, glow: [110, 0, 40], introSounds: [[0, ['PRSFX- Devastating Drake2.wav', 100, 100]], [9, ['PRSFX- Devastating Drake3.wav', 80, 100]]],
    introBg: [{ f: 2, set: 'PRAS- Dragon Fire BG', x: 0, y: 0, o: 0, c: [0, 0, 0, 0] }, { f: 2, d: 6, o: 160 }, { f: 3, d: 60, x: 900 }],
    impactSounds: [[0, ['PRSFX- Devastating Drake1.wav', 80, 100]], [3, ['PRSFX- Devastating Drake1.wav', 80, 100]]] },
  steel: { intro: 14, glow: [60, 60, 80], introSounds: [[0, ['PRSFX- Corkscrew Crash1.m4a', 100, 100]], [10, ['PRSFX- Corkscrew Crash2.m4a', 100, 100]], [11, ['PRSFX- Corkscrew Crash3.m4a', 100, 130]]],
    introBg: [],
    impactSounds: [[0, ['PRSFX- Corkscrew Crash7.m4a', 100, 100]], [0, ['PRSFX- Corkscrew Crash8.m4a', 100, 100]], ...[1, 2, 3, 4, 5, 6].map(d => [d, ['PRSFX- Corkscrew Crash5.m4a', 100 - d * 10, 100]]), [10, ['PRSFX- Corkscrew Crash9.m4a', 70, 110]]] },
};

const MOVES = {

  'g-max-snooze': { base: 'dark-pulse', z: 'darkPlain', mod: f => tinted([90, 20, 150, 60])(twoLines(9)(f)) },

  'g-max-depletion': { base: 'twister', z: 'dragon',

    mod: f => tinted([150, -40, -30, 220])(f.map(fr => fr.map(c => (c.target === 2 && c.graphicFrame >= 15 ? { ...c, graphicFrame: 0 } : c)))) },

  'g-max-steelsurge': { base: 'stone-edge', z: 'steel', mod: tinted([10, 15, 35, 255]) },

  'g-max-cannonade': { base: 'hydro-cannon', z: 'water', mod: twoLines(16),
    baseBg: [{ f: 0, set: 'PRAS- Hydro Cannon BG', x: 0, y: 0, o: 0, c: [0, 0, 0, 0] }, { f: 0, d: 5, o: 255 }, { f: 0, d: 22, x: 500 }, { f: 21, d: 21, x: 500 }, { f: 37, d: 5, o: 0 }] },
};

Object.assign(MOVES, {

  'g-max-one-blow': { base: 'wicked-blow', z: 'darkPlain' },

  'g-max-rapid-flow': { base: 'surging-strikes', z: 'water' },

  'g-max-fireball': { base: 'pyro-ball', z: 'fire' },

  'g-max-drum-solo': { base: 'drum-beating', z: 'grassBeat' },

  'g-max-sweetness': { base: 'apple-acid', z: 'grass' },

  'g-max-tartness': { base: 'grav-apple', z: 'grass', again: 8 },

  'g-max-meltdown': { base: 'double-iron-bash', z: 'steel', again: 10 },
});

const zoomed = k => frames => frames.map(fr => fr.map(c => (c.target === 2 ? { ...c, zoomX: (c.zoomX ?? 100) * k, zoomY: (c.zoomY ?? 100) * k } : c)));
Object.assign(MOVES, {

  'g-max-befuddle': { base: 'silver-wind', z: 'bug',
    baseBg: [{ f: 0, set: 'PRAS- Silver Wind BG', x: 0, y: 0, o: 0, c: [0, 0, 0, 0] }, { f: 0, d: 8, o: 220 }, { f: 0, d: 27, x: 312 }, { f: 29, d: 5, o: 0 }] },

  'g-max-chi-strike': { base: 'focus-punch', z: 'fighting', introBg: [],
    baseBg: [{ f: 0, set: 'PRAS- Focus Punch BG', x: 0, y: 0, o: 0, c: [0, 0, 0, 0] }, { f: 0, d: 5, o: 255 }, { f: 23, d: 5, o: 0 }] },

  'g-max-centiferno': { base: 'inferno', z: 'fire',
    baseBg: [{ f: 0, set: 'PRAS- Fire BG', x: 0, y: 0, o: 0, c: [0, 0, 0, 0] }, { f: 0, d: 5, o: 255 }, { f: 46, d: 5, o: 0 }] },

  'g-max-wildfire': { base: 'brave-bird', z: 'fire', mod: tinted([200, 70, -60, 200]) },

  'g-max-wind-rage': { base: 'hurricane', z: 'flying',
    baseBg: [{ f: 0, set: '', x: 0, y: 0, o: 0, c: [0, 0, 0, 0] }, { f: 0, d: 5, o: 75 }, { f: 64, d: 5, o: 0 }] },

  'g-max-vine-lash': { base: 'power-whip', z: 'grass', again: 8 },

  'g-max-sandblast': { base: 'sand-tomb', z: 'ground',
    introBg: [{ f: 2, set: 'PRAS- Earthquake BG', x: 0, y: 0, o: 0, c: [0, 0, 0, 0] }, { f: 2, d: 5, o: 255 }],
    introFg: [[0, { set: 'PRAS- Sandstorm', o: 0, d: 0 }], [0, { o: 100, d: 10 }], [0, { x: 500, y: 0, d: 20 }], [20, { x: 500, y: 0, d: 20 }]] },

  'g-max-resonance': { base: 'icicle-crash', z: 'ice', again: 9 },

  'g-max-gold-rush': { base: 'pay-day', z: 'normal' },

  'g-max-malodor': { base: 'gunk-shot', z: 'poison' },

  'g-max-foam-burst': { base: 'bubble-beam', z: 'water', mod: zoomed(1.4) },
});

function sheetCells(graphic) {
  const path = [`vendor/pokerogue/assets/images/battle_anims/${graphic}.png`, `view/anims/z/images/${graphic}.png`].find(fs.existsSync);
  const png = fs.readFileSync(path);
  return Math.floor(png.readUInt32BE(16) / 96) * Math.floor(png.readUInt32BE(20) / 96);
}

const only = process.argv.slice(2);
for (const [name, m] of Object.entries(MOVES)) {
  if (only.length && !only.includes(name)) continue;
  const src = vendor(m.base), z = Z[m.z];
  const one = base => variant({ ...z, ...(m.introBg ? { introBg: m.introBg } : {}), ...(m.introFg ? { introFg: m.introFg } : {}), base, mod: m.mod, baseBg: m.baseBg, hits: m.hits, again: m.again });
  let out = Array.isArray(src) ? src.map(one) : one(src);

  const cells = sheetCells([out].flat()[0].graphic);
  const fix = v => ({ ...v, frames: v.frames.map(fr => fr.map(c => (c.target === 2 && (c.graphicFrame ?? 0) >= cells ? { ...c, graphicFrame: 0 } : c))) });
  out = Array.isArray(out) ? out.map(fix) : fix(out);
  fs.writeFileSync(`view/anims/z/${name}.json`, JSON.stringify(out));
  console.log(name, [out].flat().map(v => v.frames.length).join('/'), 'frames');
}
