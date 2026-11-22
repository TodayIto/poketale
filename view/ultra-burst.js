import { tween, delay } from './lifetime.js';
import { zTextures } from './ui/z-art.js';

export const ULTRA_BURST = Object.freeze({
  sound: 'battle_anims/PRSFX- Transform.wav', // 1.55 s - the length of the whole effect
  gather: 500, star: 600, total: 1500,
});
const SPARKS = 10, RADIUS = 44, UNTINT = 800; // the colour comes back over 0.8 s (the longest part after the flash)

export async function playUltraBurst(scene, { old, next, swap }) {
  zTextures(scene);
  const added = [];
  const add = object => { scene.field.add(object); scene.field.bringToTop(object); added.push(object); return object; };
  scene.audio?.play(ULTRA_BURST.sound)?.catch?.(() => {}); // not waited for (as the move anims' sounds)
  try {

    const { left, right, top, bottom } = old.placement.box;
    const cx = (left + right) / 2, cy = (top + bottom) / 2;
    const sparks = Array.from({ length: SPARKS }, (_, i) => {
      const angle = (i / SPARKS) * Math.PI * 2, r = RADIUS * (i % 2 ? 0.8 : 1);
      return add(scene.add.image(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r, 'ultra_spark').setAlpha(0).setScale(2));
    });
    await Promise.all([
      old.tintIn(0xffffff, ULTRA_BURST.gather),
      ...sparks.map((spark, i) => {
        const wait = (i % 5) * 40;
        return Promise.all([
          tween(scene, { targets: spark, alpha: 1, delay: wait, duration: 120 }),
          tween(scene, { targets: spark, x: cx, y: cy, scale: 1, delay: wait, duration: ULTRA_BURST.gather - wait, ease: 'Cubic.easeIn' }),
        ]);
      }),
    ]);
    for (const spark of sparks) spark.setVisible(false);

    const flash = add(scene.add.rectangle(0, 0, 320, 180, 0xffffff).setOrigin(0));
    swap();
    next.tint(0xffffff, 1);

    const star = add(scene.add.image(cx, cy, 'ultra_star').setScale(0.5));
    await Promise.all([
      tween(scene, { targets: flash, alpha: 0, duration: 300, ease: 'Sine.easeOut' }),
      (async () => {
        await tween(scene, { targets: star, scale: 3, duration: 250, ease: 'Cubic.easeOut' });
        await tween(scene, { targets: star, scale: 3.6, alpha: 0, duration: ULTRA_BURST.star - 250, ease: 'Sine.easeIn' });
      })(),
      next.untint(UNTINT, 'Cubic.easeOut'),
    ]);
    await delay(scene, ULTRA_BURST.total - ULTRA_BURST.gather - UNTINT); // a short rest so the sentence comes at 1.5 s
  } finally {
    for (const object of added) object.destroy();
  }
}
