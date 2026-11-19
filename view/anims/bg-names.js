const BG_NAMES = {
  'armor-cannon.json': [[0, 9, 'PRAS- Burning BG']],
  'bitter-blade.json': [[0, 0, 'PRAS- Shadow Bone BG']],
  'bleakwind-storm.json': [[0, 0, 'PRAS- Blizzard BG']],
  'chloroblast.json': [[0, 0, 'PRAS- Giga Drain BG']],
  'dire-claw.json': [[0, 0, 'EerieSpell_bg']],
  'headlong-rush.json': [[0, 0, 'PRAS- Earthquake BG']],
  'hyper-drill.json': [[0, 0, 'PRAS- judgment BG'], [1, 0, 'PRAS- judgment BG']],
  'kowtow-cleave.json': [[0, 15, 'PRAS- Dark Void BG']],
  'last-respects.json': [[0, 0, 'PRAS- Shadow Bone BG']],
  'lumina-crash.json': [[0, 14, 'PRAS- Flash FG']],
  'sandsear-storm.json': [[0, 0, 'PRAS- Earthquake BG']],
  'springtide-storm.json': [[0, 0, 'PRAS- Attract BG']],
  'tidy-up.json': [[0, 24, 'PRAS- Flash FG']],
  'wave-crash.json': [[0, 0, 'PRAS- Hydro Cannon BG']],
  'wildbolt-storm.json': [[0, 0, 'PRAS- Electric Terrain BG']],
};

const NO_PICTURE = new Set(['flower-trick.json']);

export function withBgNames(file, anim) {
  if (anim && NO_PICTURE.has(file)) return dropBackground(anim);
  const names = BG_NAMES[file];
  if (!names || !anim) return anim;
  const variants = [anim].flat().map((v, index) => {
    const mine = names.filter(([variant]) => variant === index);
    if (!mine.length || !v?.frameTimedEvents) return v;
    const events = { ...v.frameTimedEvents };
    for (const [, frame, picture] of mine) {
      events[frame] = events[frame]?.map(e => (e.eventType === 'AnimTimedAddBgEvent' && !e.resourceName ? { ...e, resourceName: picture } : e));
    }
    return { ...v, frameTimedEvents: events };
  });
  return Array.isArray(anim) ? variants : variants[0];
}

const isBg = e => e.eventType === 'AnimTimedAddBgEvent' || e.eventType === 'AnimTimedUpdateBgEvent';

function dropBackground(anim) {
  const one = v => {
    if (!v?.frameTimedEvents) return v;
    const events = {};
    for (const [f, list] of Object.entries(v.frameTimedEvents)) {
      const kept = list.filter(e => !isBg(e));
      if (kept.length) events[f] = kept;
    }
    return { ...v, frameTimedEvents: events };
  };
  return Array.isArray(anim) ? anim.map(one) : one(anim);
}
