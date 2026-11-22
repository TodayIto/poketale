// from pokerogue src/ui/handlers/command-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-11-22. See view/LICENSE-NOTE.md.
// from pokerogue src/ui/handlers/fight-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/handlers/target-select-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/handlers/battle-message-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/text.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/ui-theme.ts @ 7d7da4a8 (AGPL-3.0-only)

import { addWindow } from './window.js';
import { addTextObject, pad2 } from './text.js';
import { GimmickButton, FIGHT_CURSOR } from './mega-tera.js'; // Mega Evolution / Terastallization / Ultra Burst / Z-Move / Dynamax button
import { openBag } from './bag.js';
import { chooseRun } from '../run-away.js';
import { playSelect, playError } from './keys.js'; // menu sounds
import { openMenu } from './menu.js'; // menu frame (keys, closing, tapping empty space)
import { FIGHT_WINDOWS } from './tap-back.js'; // tapping empty space during move selection
import { POSITIONS, isPlayerSide } from '../positions.js'; // battler order for target selection
import { fixed } from '../game-speed.js'; // target flash and marker bob ignore game speed (fixedInt)
import { themeColors } from './theme.js'; // legacy theme text colours

export const moveEnabled = move => !!move && !move.disabled && !move.zOff && !move.maxOff && (move.pp === undefined || move.pp > 0);

const OFF_ALPHA = 0.45;

const GIMMICK_MID = 7.7;
const PROMPT_WRAP = 1110, PROMPT_LINES = 2;

const HINT_COLORS = { 0: '#929292', 0.125: '#FF5500', 0.25: '#FF7400', 0.5: '#FE8E00', 2: '#4AA500', 4: '#4BB400', 8: '#52C200' };
export const hintColor = move => (typeof move?.effectiveness === 'number' ? HINT_COLORS[move.effectiveness] : undefined);

const shownValue = value => (Number.isFinite(value) && value > 0 ? String(value) : '---');

function ppStyle(scene, move) {
  const ratio = move.pp / move.maxpp;
  if (ratio === 0) return themeColors(scene, 'MOVE_PP_EMPTY');
  if (ratio > 0 && ratio <= .25) return themeColors(scene, 'MOVE_PP_NEAR_EMPTY');
  if (ratio > .25 && ratio <= .5) return themeColors(scene, 'MOVE_PP_HALF_FULL');
  return themeColors(scene, 'WINDOW');
}

const asksTarget = target => !!target && (target.choose || target.spread) && target.targets.length > 1;

export class ActionMenu {
  constructor(scene) { this.scene = scene; this.memos = {}; this.position = 'player'; }

  choose({ moves, canSwitch = false, party, partner = null, mega = false, tera = '', ultra = false, z = null, dynamax = null, max = null, bag, run, position = 'player', back = false }) {
    if (this.finish) throw new Error('Action menu already open');
    if (!Array.isArray(moves) || !moves.length || moves.length > 4) throw new Error('Expected 1–4 move options');
    if (z != null && (!Array.isArray(z) || z.length !== moves.length)) throw new Error('Expected one Z option (or null) per move');
    if (dynamax != null && (!Array.isArray(dynamax.moves) || dynamax.moves.length !== moves.length)) throw new Error('Expected one Max Move option (or null) per move');
    if (max != null && (!Array.isArray(max) || max.length !== moves.length)) throw new Error('Expected one Max Move option (or null) per move');
    if (!POSITIONS.includes(position) || !isPlayerSide(position)) throw new Error(`Invalid command position: ${position}`);

    if (position !== this.position) {
      this.memos[this.position] = { lastCommand: this.lastCommand, moveMemory: this.moveMemory, targetMemory: this.targetMemory };
      ({ lastCommand: this.lastCommand, moveMemory: this.moveMemory, targetMemory: this.targetMemory } = this.memos[position] ?? {});
      this.position = position;
    }
    this.back = !!back;
    this.baseMoves = this.moves = moves.map(m => ({ ...m })); this.mode = 'command'; this.notice = '';
    this.zMoves = z;
    this.maxMoves = max ?? dynamax?.moves ?? null; this.maxNow = !!max; // Max Move menu (showMax): from the button, or from the start while Dynamaxed
    if (this.maxNow) this.showMax(true);

    this.cursor = this.lastCommand === 2 || !this.lastCommand ? 0 : this.lastCommand;

    this.party = canSwitch && Array.isArray(party) ? party : null;
    this.partner = partner;
    this.gimmick = GimmickButton.create(this, { mega, tera, ultra, z, dynamax: max ? null : dynamax }); // only when the request marks it available (view/ui/mega-tera.js)
    this.bag = bag ?? null; // if given, the "Ball" slot becomes "Bag" -> view/ui/bag.js
    this.run = run ?? null;
    const scene = this.scene;
    scene.messages.container.setVisible(false);
    this.container = scene.add.container(0, 0); scene.ui.add(this.container);
    const menu = openMenu(scene, { input: action => this.input(action), close: () => this.clear(),
      paused: () => this.mode === 'party' || this.mode === 'bag' || this.mode === 'message',

      tapWindows: () => (this.mode === 'fight' || this.mode === 'target' || (this.mode === 'command' && this.back) ? FIGHT_WINDOWS : null) });

    Object.assign(this, { finish: menu.finish, fail: menu.fail, abort: menu.abort, shown: menu.shown, tapped: menu.tapped });
    try { this.draw(); this.markTurn(); scene.options.parent.focus({ preventScroll: true }); }
    catch (error) { menu.fail(error); }
    return menu.promise;
  }

  input(action) {
    if (this.mode === 'party') return;
    const { mode, cursor } = this;
    if (this.gimmick?.input(action)) {
      if (this.mode !== mode || this.cursor !== cursor) playSelect(this.scene);
      return;
    }
    if (mode === 'target') return this.targetInput(action);
    if (action === 'back' && mode === 'command' && this.back) return this.finish({ kind: 'back' }); // command-phase.ts:673 cancel (silent, as below)
    if (action === 'back') { if (mode === 'fight') { playSelect(this.scene); this.rememberMove(); } this.mode = 'command'; this.cursor = 0; this.notice = ''; }
    else if (action === 'ok') {
      if (this.mode === 'command') {
        this.lastCommand = this.cursor; // cursor memory
        const open = this.cursor === 0 || (this.cursor === 2 && this.party) || (this.cursor === 1 && this.bag) || (this.cursor === 3 && this.run);
        if (open) playSelect(this.scene); else playError(this.scene);
        if (this.cursor === 0) { this.mode = 'fight'; this.cursor = this.rememberedMove(); this.notice = ''; }
        else if (this.cursor === 2 && this.party) return this.openParty();
        else if (this.cursor === 1 && this.bag) return openBag(this); // bag (view/ui/bag.js)
        else if (this.cursor === 3 && this.run) return chooseRun(this);

        else this.notice = this.scene.words(this.party ? 'own.onlyFightParty' : 'own.onlyFight');
      } else if (moveEnabled(this.moves[this.cursor])) {
        playSelect(this.scene); this.rememberMove(); // cursor memory
        const target = this.moves[this.cursor].target;
        if (asksTarget(target)) return this.openTarget();
        // a single possible target is picked without asking
        return this.finish({ kind:'move', index:this.cursor, ...(target?.choose && target.targets.length === 1 ? { target: target.targets[0] } : {}), ...this.gimmick?.choice() }); // mega/tera
      }
      else if (this.moves[this.cursor]?.zOff) { /* no Z-Move for this slot: it simply cannot be picked - no text, no sound */ }
      else if (this.moves[this.cursor]?.maxOff) playError(this.scene);
      else if (this.moves[this.cursor]?.blocked) { playError(this.scene); return this.showBlocked(this.moves[this.cursor].blocked); } // reason text down-arrow
      else { playError(this.scene); this.notice = this.blockedReason(); }
    } else {
      if (action === 'up' && this.cursor >= 2) this.cursor -= 2;
      if (action === 'down' && this.cursor < 2) this.cursor += 2;
      if (action === 'left' && this.cursor % 2) this.cursor--;
      if (action === 'right' && !(this.cursor % 2)) this.cursor++;
      if (this.cursor !== cursor) playSelect(this.scene);
      this.notice = '';
    }
    this.draw();
  }

  rememberedMove() {
    const memory = this.moveMemory, summoned = this.scene.summonCount?.[this.position];
    if (memory && memory.summoned === summoned && memory.cursor < this.moves.length && !this.moves[memory.cursor].zOff && !this.moves[memory.cursor].maxOff) return memory.cursor;
    return Math.max(0, this.moves.findIndex(moveEnabled));
  }
  rememberMove() { this.moveMemory = { summoned: this.scene.summonCount?.[this.position], cursor: this.cursor }; }

  showZ(on) {
    this.moves = !on || !this.zMoves ? this.baseMoves : this.baseMoves.map((move, i) => {
      const z = this.zMoves[i];
      if (!z) return { ...move, zOff: true };
      const { name, type, category, power = null, accuracy = null, effectiveness, target } = z;
      return { ...move, name, type, category, power, accuracy, effectiveness, target };
    });
  }

  showMax(on) {
    this.moves = !on || !this.maxMoves ? this.baseMoves : this.baseMoves.map((move, i) => {
      const max = this.maxMoves[i];
      if (!max) return { ...move, blocked: undefined, maxOff: true };
      const { name, type, category, power = null, accuracy = null, effectiveness, target, disabled = false } = max;
      return { ...move, name, type, category, power, accuracy, effectiveness, target, disabled: !!disabled, blocked: undefined, maxOff: !!disabled };
    });
  }

  openTarget() {
    const target = this.moves[this.cursor].target, memory = this.targetMemory;
    this.targetMove = this.cursor; this.targets = target.targets; this.spread = !target.choose;
    const kept = memory && memory.summoned === this.scene.summonCount?.[this.position] && !isPlayerSide(memory.cursor) ? memory.cursor : null;
    this.cursor = this.targets.includes(kept) ? kept : this.targets.find(t => !isPlayerSide(t)) ?? this.targets[0];
    this.mode = 'target'; this.notice = '';
    this.draw();
  }

  targetInput(action) {
    if (action === 'ok' || action === 'back') {
      playSelect(this.scene);
      this.targetMemory = { summoned: this.scene.summonCount?.[this.position], cursor: this.cursor };
      if (action === 'ok') {
        return this.finish({ kind: 'move', index: this.targetMove, ...(this.spread ? {} : { target: this.cursor }), ...this.gimmick?.choice() });
      }
      this.mode = 'fight'; this.cursor = this.targetMove;
      return this.draw();
    }
    if (this.spread) return;
    const index = POSITIONS.indexOf(this.cursor), has = i => this.targets.includes(POSITIONS[i]);
    const inRow = enemyRow => this.targets.find(t => !isPlayerSide(t) === enemyRow);
    let next = this.cursor;
    if (action === 'up' && index < 2) next = inRow(true) ?? next;
    if (action === 'down' && index >= 2) next = inRow(false) ?? next;
    if (action === 'left' && index % 2 && has(index - 1)) next = POSITIONS[index - 1];
    if (action === 'right' && !(index % 2) && has(index + 1)) next = POSITIONS[index + 1];
    if (next === this.cursor) return;
    playSelect(this.scene);
    this.cursor = next; this.flashTargets();
  }

  tapTarget(position) {
    if (this.mode !== 'target' || !this.targets.includes(position)) return;
    if (this.spread || this.cursor === position) return this.targetInput('ok');
    playSelect(this.scene);
    this.cursor = position; this.flashTargets();
  }
  drawTargets() {
    const s = this.scene;
    s.messages.bg.setVisible(true);

    this.targetHits = POSITIONS.filter(position => s.pokemon[position]?.container.visible).map(position => {
      const { box } = s.pokemon[position].placement;
      const hit = s.add.rectangle(box.left, box.top, box.right - box.left, box.bottom - box.top, 0, 0).setOrigin(0).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', this.tapped(() => this.tapTarget(position)));
      s.field.add(hit);
      return hit;
    });
    this.flashTargets();
  }
  flashTargets() {
    const s = this.scene;
    this.stopFlash();
    this.flashing = (this.spread ? this.targets : [this.cursor]).filter(position => s.pokemon[position]).map(position => {
      const sprite = s.pokemon[position].container, info = s.info[position];
      const tweens = [s.tweens.add({ targets: sprite, alpha: { from: 1, to: 0.25 }, loop: -1, loopDelay: 150, duration: fixed(450), ease: 'Sine.easeInOut', yoyo: true })];
      if (info) tweens.push(s.tweens.add({ targets: info.container, y: { from: info.restY ?? info.baseY, to: (info.restY ?? info.baseY) + 1 }, loop: -1, duration: fixed(250), ease: 'Linear', yoyo: true }));
      return { sprite, alpha: sprite.alpha, info, tweens };
    });
  }
  /** Back to how they were (alpha 0.5 behind a substitute doll) */
  stopFlash() {
    for (const { sprite, alpha, info, tweens } of this.flashing ?? []) {
      tweens.forEach(t => t.stop());
      sprite.setAlpha(alpha);
      if (info) info.container.y = info.restY ?? info.baseY;
    }
    this.flashing = null;
  }
  clearTargets() {
    this.stopFlash();
    this.targetHits?.forEach(hit => hit.destroy()); this.targetHits = null;
  }
  /** Double battle: a bobbing marker over the mon whose command this is */
  markTurn() {
    const s = this.scene, p = s.double && s.pokemon[this.position];
    if (!p) return;
    const { box } = p.placement, y = box.top - 3;
    this.marker = s.add.image((box.left + box.right) / 2, y, 'cursor').setAngle(90).setOrigin(0.5);
    s.field.add(this.marker);
    s.tweens.add({ targets: this.marker, y: y - 2, duration: fixed(300), yoyo: true, repeat: -1 });
  }

  openParty() {
    this.mode = 'party'; this.notice = '';

    const onOpen = () => { this.detailsMask?.destroy(); this.detailsMask = null; this.container?.removeAll(true); this.drawnMode = null; };
    this.scene.party.choose({ party: this.party, partner: this.partner, forced: false, onOpen }).then(choice => {
      if (!this.finish) return;
      if (choice) return this.finish(choice);
      this.mode = 'command'; this.cursor = 2; this.draw();
    }, error => { if (this.finish) this.fail(error); });
  }

  showBlocked(reason, back = 'fight') {
    const messages = this.scene.messages;
    this.mode = 'message'; this.notice = '';
    this.container.setVisible(false);
    messages.bg.setVisible(true); messages.container.setVisible(true);
    messages.message(reason, { wait: true }).then(() => {
      if (!this.finish) return;
      messages.text.setText('');
      messages.container.setVisible(false); messages.bg.setVisible(false);
      this.reshow(back);
    }, error => { if (this.finish) this.fail(error); });
  }

  reshow(mode) {
    this.container.setVisible(true);
    this.mode = mode; this.shown(); this.draw();
  }
  blockedReason() {
    const move = this.moves[this.cursor];
    if (move?.zOff || move?.maxOff) return '';
    const reason = !move ? 'own.noMove' : move.pp !== undefined && move.pp <= 0 ? 'own.noPp' : move.disabled ? 'own.moveDisabled' : null;
    return reason ? this.scene.words(reason) : '';
  }
  hover(index) {
    if (this.cursor === index) return;
    this.cursor = index; this.notice = ''; this.updateSelection();
  }

  text(x, y, str, size = 96, shadowX = 3, shadowY = 3, extra = {}, style = 'WINDOW') {
    const [color, shadow] = themeColors(this.scene, style === 'message' ? 'MESSAGE' : 'WINDOW');
    const t = addTextObject(this.scene, x, y, str, 'info', { fontSize: size, color, ...extra })
      .setShadow(shadowX, shadowY, shadow).setLineSpacing(5);
    this.container.add(t); return t;
  }
  draw() {
    // Keep hit objects alive while hovering; rebuilding them can retrigger pointerover.
    if (this.drawnMode === this.mode) { this.updateSelection(); return; }
    const s = this.scene, c = this.container;
    this.detailsMask?.destroy(); this.detailsMask = null; c.removeAll(true);
    if (this.drawnMode === 'target') this.clearTargets();
    this.drawnMode = this.mode;
    this.shown();
    if (this.mode === 'target') { this.gimmick?.stop(); return this.drawTargets(); }
    const fight = this.mode === 'fight';
    s.messages.bg.setVisible(!fight);
    if (fight) {
      c.add(addWindow(s,0,-48,243,48));
      const details = addWindow(s,240,-48,80,48); c.add(details);

      const maskShape = s.make.graphics({ x:0, y:0, add:false });
      maskShape.fillStyle(0xffffff).fillRect(241*6,132*6,80*6,48*6);
      this.detailsMask = maskShape.createGeometryMask(); details.setMask(this.detailsMask);
      c.add(maskShape); maskShape.setVisible(false);
      this.typeIcon = s.add.image(264,-36,'types','unknown').setScale(.8); c.add(this.typeIcon);
      this.categoryIcon = s.add.image(296,-36,'categories','physical').setScale(1); c.add(this.categoryIcon);

      const info = this.moves.some(m => 'power' in m || 'accuracy' in m);
      const rowY = info ? [-28, -21, -14] : [-26];
      this.ppLabel = this.text(251,rowY[0],'PP',info?50:56).setOrigin(0,.5);
      this.ppText = this.text(309,rowY[0],'',info?50:56).setOrigin(1,.5);
      if (info) {
        this.powerLabel = this.text(251,rowY[1],s.words('fight-ui-handler.power'),50).setOrigin(0,.5); this.powerText = this.text(309,rowY[1],'',50).setOrigin(1,.5);
        this.accuracyLabel = this.text(251,rowY[2],s.words('fight-ui-handler.accuracy'),50).setOrigin(0,.5); this.accuracyText = this.text(309,rowY[2],'',50).setOrigin(1,.5);
      } else { this.powerLabel = this.powerText = this.accuracyLabel = this.accuracyText = null; }
      this.reasonText = this.text(247,info?-23:-18,'',54);
      this.text(248,info?-8.5:-9,s.words('own.back'),info?44:48).setInteractive({useHandCursor:true}).on('pointerdown',this.tapped(()=>this.input('back')));
    } else {
      c.add(addWindow(s,202,-48,118,48));
      this.promptWrap = PROMPT_WRAP; // the gimmick button (mega-tera.js draw) narrows it
      this.promptText = this.text(12,-39,'',96,4,5,{wordWrap:{width:PROMPT_WRAP},maxLines:PROMPT_LINES},'message');
    }
    const labels = fight ? this.moves.map(m=>m.name)
      : ['command-ui-handler.fight', this.bag ? 'own.bag' : 'command-ui-handler.ball', 'command-ui-handler.pokemon', 'command-ui-handler.run'].map(key => s.words(key));
    this.labels = [];
    for (let i=0;i<4;i++) {
      const col = i%2, row = Math.floor(i/2), step = fight ? 114 : 56;
      const hit = s.add.rectangle((fight?8:207)+col*step,-40+row*16,step,16,0,0)
        .setOrigin(0).setInteractive({useHandCursor:true});
      hit.on('pointerover',()=>this.hover(i));
      hit.on('pointerdown',this.tapped(()=>{this.cursor=i;this.input('ok');})); c.add(hit);
      const label = this.text((fight?18:217)+col*(fight?114:55.8),-38.7+row*16,labels[i] ?? '-',
        fight?96:92,fight?3:4,fight?3:5,fight?{}:{padding:{top:2}});

      const color = fight && this.scene.options.typeHints && !this.moves[i]?.zOff && !this.moves[i]?.maxOff && hintColor(this.moves[i]);
      if (color) label.setColor(color);
      if (fight && (this.moves[i]?.zOff || this.moves[i]?.maxOff)) label.setAlpha(OFF_ALPHA);

      const full = label.scaleY;
      if (fight && label.displayWidth > step - 10) label.setScale(label.scaleX * (step - 10) / label.displayWidth);
      this.labels.push({ y: label.y, k: full ? label.scaleY / full : 1 });
    }
    this.cursorObj = s.add.image(0,0,'cursor'); c.add(this.cursorObj);
    this.gimmick?.draw(c, fight);
    if (fight && this.maxNow) { const [key, scale] = FIGHT_CURSOR.dynamax; this.cursorObj.setTexture(key).setScale(scale); } // Dynamaxed: the Dynamax Band cursor
    this.updateSelection();
  }
  updateSelection() {
    const col = this.cursor%2, row = Math.floor(this.cursor/2);
    if (this.mode === 'fight') {

      const label = this.labels?.[this.cursor];

      const gimmick = this.maxNow || !!this.gimmick?.lit;
      if (gimmick && label) this.cursorObj.setPosition(12+col*114, Math.round(label.y + GIMMICK_MID*(label.k || 1)));
      else this.cursorObj.setPosition(13+col*114,-31+row*15);
      const move = this.moves[this.cursor];
      this.typeIcon.setVisible(!!move); this.categoryIcon.setVisible(false); this.ppLabel.setVisible(!!move); this.ppText.setVisible(!!move);
      if (move) {
        const frame = move.type?.toLowerCase() ?? 'unknown';
        this.typeIcon.setFrame(this.typeIcon.texture.has(frame) ? frame : 'unknown');
        const category = move.category?.toLowerCase();
        this.categoryIcon.setVisible(!!category && this.categoryIcon.texture.has(category));
        if (this.categoryIcon.visible) this.categoryIcon.setFrame(category);
        const [color, shadow] = ppStyle(this.scene, move);

        this.ppText.setText(move.pp === undefined ? '--/--' : `${pad2(move.pp)}/${pad2(move.maxpp)}`).setColor(color).setShadow(3,3,shadow);
        this.powerText?.setText(shownValue(move.power)); this.accuracyText?.setText(shownValue(move.accuracy));
      }
      const reason = this.notice || this.blockedReason();
      this.reasonText.setText(reason);
      // if blocked, hide that slot's power/accuracy (PP stays)
      for (const t of [this.powerLabel, this.powerText, this.accuracyLabel, this.accuracyText]) t?.setVisible(!!move && !reason && !move.zOff && !move.maxOff);
    } else {
      this.cursorObj.setPosition(212+col*56,-30.7+row*16);

      const words = this.scene.words;
      const pokemonName = this.scene.pokemon[this.position]?.mon.name ?? words('command-ui-handler.pokemon');
      this.setPrompt(this.notice || words('command-ui-handler.actionMessage', { pokemonName }));
    }
    this.gimmick?.update(); // on the button slot: hide the cursor and light the button
  }

  setPrompt(str) {
    const wrap = this.promptWrap, maxLines = PROMPT_LINES;
    const t = this.promptText.setScale(1 / 6).setWordWrapWidth(wrap).setText(str);
    if (t.displayWidth <= wrap / 6 && t.getWrappedText(str).length <= maxLines) return;
    if (String(str).split('\n').length > maxLines) return; // a text written longer than the box is left to the wrap as before
    t.setWordWrapWidth(null);
    const k = Math.min(1, wrap / 6 / t.displayWidth);
    t.setScale(k / 6).setWordWrapWidth(wrap / k + 1); // + 1: no new break from rounding
  }
  clear() {
    this.finish = this.fail = null;
    this.clearTargets();
    if (this.marker) { this.scene.tweens.killTweensOf(this.marker); this.marker.destroy(); this.marker = null; }
    this.detailsMask?.destroy(); this.detailsMask = null;
    this.gimmick?.stop(); this.gimmick = null;
    this.container?.destroy(); this.container = null; this.drawnMode = null;
    this.scene.messages.bg.setVisible(true);
    this.scene.messages.container.setVisible(true);
  }
  destroy() { if (this.finish) this.abort(); }
}
