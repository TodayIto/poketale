// from pokerogue src/phases/stat-stage-change-phase.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

// Visual part only: red/blue arrow texture, bitmap mask and 250/1500/250ms tweens.
import { tween } from '../lifetime.js';

const loadArrows = scene => scene.assets.image('battle_stats','images/effects/battle_stats.png');

export function loadStatStage(scene) {
  return Promise.all([loadArrows(scene), ...['se/stat_up.wav', 'se/stat_down.wav'].map(path => scene.audio.load(path).ready)]);
}

export async function statStage(scene, side, stat, delta) {
  if (!['atk','def','spa','spd','spe','accuracy','evasion'].includes(stat) || !Number.isInteger(delta)) throw new Error('Invalid stat change');
  const mon=scene.requireMon(side);
  if (!delta) return;
  await loadArrows(scene);
  scene.life.check();
  const src=mon.getSprite(), scale=mon.getSpriteScale()*6;
  const maskSprite=scene.make.sprite({x:mon.container.x*6,y:mon.container.y*6,key:src.texture.key,frame:src.frame.name,add:false})
    .setOrigin(src.originX,src.originY).setScale(scale);
  const sync=()=>maskSprite.setFrame(src.frame.name); src.on('animationupdate',sync);
  const mask=maskSprite.createBitmapMask();
  const up=delta>0;
  const arrows=scene.add.tileSprite(mon.container.x*6,(mon.container.y+(up?160:0))*6,156,316,'battle_stats',up?'atk':'spd')
    .setOrigin(.5,1).setScale(6).setAlpha(0).setDepth(.5).setMask(mask);
  const sound=scene.audio.play(`se/stat_${up?'up':'down'}.wav`);
  try {
    await tween(scene,{targets:arrows,duration:250,alpha:.8375});
    await tween(scene,{targets:arrows,duration:1500,y:arrows.y+(up?-960:960)});
    await tween(scene,{targets:arrows,duration:250,alpha:0});
    await sound;
  } finally { src.off('animationupdate',sync); arrows.destroy(); mask.destroy(); maskSprite.destroy(); }
}
