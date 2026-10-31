// from pokerogue src/phases/attempt-run-phase.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/phases/command-phase.ts (handleRunCommand, queueShowText) @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-30. See view/LICENSE-NOTE.md.

import { teamOf, fieldPositions } from './positions.js';
import { tween } from './lifetime.js';
import { addTextObject } from './ui/text.js';
import { themeColors } from './ui/theme.js';

const NOTE_LINE = 18;

const FLEE_SOUND = 'se/flee.wav';

export async function runAway(scene) {
  scene.requireReady();

  scene.audio.play(FLEE_SOUND).catch(() => {});

  const sides = fieldPositions(scene.double).filter(side => teamOf(side) === 'enemy');
  const enemies = sides.map(side => scene.pokemon[side]).filter(Boolean);

  const targets = [scene.biomeObjects[2], ...enemies.map(enemy => enemy.container)].filter(Boolean);
  await Promise.all([
    tween(scene, { targets, alpha: 0, duration: 250, ease: 'Sine.easeIn' }),
    ...sides.map(side => scene.info[side]?.hide()),
  ]);
  enemies.forEach(enemy => enemy.container.setVisible(false));
}

export function chooseRun(menu) {
  if (menu.run.confirm) return confirmForfeit(menu);
  if (!menu.run.blocked) return menu.finish({ kind: 'run' });
  const messages = menu.scene.messages;
  menu.mode = 'message'; menu.notice = '';
  menu.container.setVisible(false);
  messages.container.setVisible(true);
  messages.message(menu.run.blocked, { wait: true }).then(() => {
    if (!menu.finish) return;
    messages.text.setText('');
    messages.container.setVisible(false);
    menu.container.setVisible(true);
    menu.mode = 'command'; menu.draw();
  }, error => { if (menu.finish) menu.fail(error); });
}

function confirmForfeit(menu) {
  const scene = menu.scene, messages = scene.messages, { text, note } = menu.run.confirm;
  menu.mode = 'message'; menu.notice = '';
  menu.container.setVisible(false);
  messages.container.setVisible(true);
  let noteText = null;
  const clearNote = () => { noteText?.destroy(); noteText = null; };
  messages.message(String(text ?? ''), { hold: 0 }).then(() => {
    if (!menu.finish) return false;
    if (note) {
      const [color, shadow] = themeColors(scene, 'MESSAGE_NOTE');
      noteText = addTextObject(scene, messages.text.x, messages.text.y + NOTE_LINE, String(note), 'message')
        .setColor(color).setShadow(4, 5, shadow);
      messages.container.add(noteText);
    }
    return scene.levels.confirm();
  }).then(yes => {
    clearNote();
    if (!menu.finish) return;
    if (yes) return menu.finish({ kind: 'run' });
    messages.text.setText('');
    messages.container.setVisible(false);
    menu.container.setVisible(true);
    menu.mode = 'command'; menu.draw();
  }, error => { clearNote(); if (menu.finish) menu.fail(error); });
}
