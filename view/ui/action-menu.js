// from pokerogue src/ui/handlers/command-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/handlers/fight-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/handlers/battle-message-ui-handler.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/text.ts @ 7d7da4a8 (AGPL-3.0-only)
// from pokerogue src/ui/ui-theme.ts @ 7d7da4a8 (AGPL-3.0-only)
// Modified for PokeTale on 2026-10-28. See view/LICENSE-NOTE.md.

// Two-column cursor / action / cancel flow; engine requests replace phase/move rules.
import { addWindow } from './window.js';
import { addTextObject, pad2 } from './text.js';
import { GimmickButton } from './mega-tera.js';
import { openBag } from './bag.js';
import { chooseRun } from '../run-away.js';
import { postposition } from '../../director/text.js';
import { playSelect, playError } from './keys.js';
import { openMenu } from './menu.js';
import { FIGHT_WINDOWS } from './tap-back.js';
import { themeColors } from './theme.js';

export const moveEnabled = move => !!move && !move.disabled && (move.pp === undefined || move.pp > 0);

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

export class ActionMenu {
  constructor(scene) { this.scene = scene; }
  choose({ moves, canSwitch = false, party, mega = false, tera = '', bag, run }) {
    if (this.finish) throw new Error('Action menu already open');
    if (!Array.isArray(moves) || !moves.length || moves.length > 4) throw new Error('Expected 1–4 move options');
    this.moves = moves.map(m => ({ ...m })); this.mode = 'command'; this.notice = '';

    this.cursor = this.lastCommand === 2 || !this.lastCommand ? 0 : this.lastCommand;

    this.party = canSwitch && Array.isArray(party) ? party : null;
    this.gimmick = GimmickButton.create(this, { mega, tera });
    this.bag = bag ?? null;
    this.run = run ?? null;
    const scene = this.scene;
    scene.messages.container.setVisible(false);
    this.container = scene.add.container(0, 0); scene.ui.add(this.container);
    const menu = openMenu(scene, { input: action => this.input(action), close: () => this.clear(),
      paused: () => this.mode === 'party' || this.mode === 'bag' || this.mode === 'message',
      tapWindows: () => (this.mode === 'fight' ? FIGHT_WINDOWS : null) });
    Object.assign(this, { finish: menu.finish, fail: menu.fail, abort: menu.abort });
    try { this.draw(); scene.options.parent.focus({ preventScroll: true }); }
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
    if (action === 'back') { if (mode === 'fight') { playSelect(this.scene); this.rememberMove(); } this.mode = 'command'; this.cursor = 0; this.notice = ''; }
    else if (action === 'ok') {
      if (this.mode === 'command') {
        this.lastCommand = this.cursor;
        const open = this.cursor === 0 || (this.cursor === 2 && this.party) || (this.cursor === 1 && this.bag) || (this.cursor === 3 && this.run);
        if (open) playSelect(this.scene); else playError(this.scene);
        if (this.cursor === 0) { this.mode = 'fight'; this.cursor = this.rememberedMove(); this.notice = ''; }
        else if (this.cursor === 2 && this.party) return this.openParty();
        else if (this.cursor === 1 && this.bag) return openBag(this);
        else if (this.cursor === 3 && this.run) return chooseRun(this);

        else this.notice = this.party ? '지금은 싸운다와 포켓몬만\n사용할 수 있습니다.' : '지금은 싸운다만\n사용할 수 있습니다.';
      } else if (moveEnabled(this.moves[this.cursor])) { playSelect(this.scene); this.rememberMove(); return this.finish({ kind:'move', index:this.cursor, ...this.gimmick?.choice() }); }
      else if (this.moves[this.cursor]?.blocked) { playError(this.scene); return this.showBlocked(this.moves[this.cursor].blocked); }
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
    const memory = this.moveMemory, summoned = this.scene.summonCount?.player;
    if (memory && memory.summoned === summoned && memory.cursor < this.moves.length) return memory.cursor;
    return Math.max(0, this.moves.findIndex(moveEnabled));
  }
  rememberMove() { this.moveMemory = { summoned: this.scene.summonCount?.player, cursor: this.cursor }; }

  openParty() {
    this.mode = 'party'; this.notice = '';

    const onOpen = () => { this.detailsMask?.destroy(); this.detailsMask = null; this.container?.removeAll(true); this.drawnMode = null; };
    this.scene.party.choose({ party: this.party, forced: false, onOpen }).then(choice => {
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
      this.container.setVisible(true);
      this.mode = back; this.draw();
    }, error => { if (this.finish) this.fail(error); });
  }
  blockedReason() {
    const move = this.moves[this.cursor];
    return !move ? '기술 없음' : move.pp !== undefined && move.pp <= 0 ? 'PP가 없습니다' : move.disabled ? '사용 불가' : '';
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
    this.drawnMode = this.mode;
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
        this.powerLabel = this.text(251,rowY[1],'위력',50).setOrigin(0,.5); this.powerText = this.text(309,rowY[1],'',50).setOrigin(1,.5);
        this.accuracyLabel = this.text(251,rowY[2],'명중률',50).setOrigin(0,.5); this.accuracyText = this.text(309,rowY[2],'',50).setOrigin(1,.5);
      } else { this.powerLabel = this.powerText = this.accuracyLabel = this.accuracyText = null; }
      this.reasonText = this.text(247,info?-23:-18,'',54);
      this.text(248,info?-8.5:-9,'뒤로 (X)',info?44:48).setInteractive({useHandCursor:true}).on('pointerdown',()=>this.input('back'));
    } else {
      c.add(addWindow(s,202,-48,118,48));
      this.promptText = this.text(12,-39,'',96,4,5,{wordWrap:{width:1110},maxLines:2},'message');
    }
    const labels = fight ? this.moves.map(m=>m.name) : ['싸운다',this.bag?'가방':'볼','포켓몬','도망간다'];
    for (let i=0;i<4;i++) {
      const col = i%2, row = Math.floor(i/2), step = fight ? 114 : 56;
      const hit = s.add.rectangle((fight?8:207)+col*step,-40+row*16,step,16,0,0)
        .setOrigin(0).setInteractive({useHandCursor:true});
      hit.on('pointerover',()=>this.hover(i));
      hit.on('pointerdown',()=>{this.cursor=i;this.input('ok');}); c.add(hit);
      const label = this.text((fight?18:217)+col*(fight?114:55.8),-38.7+row*16,labels[i] ?? '-',
        fight?96:92,fight?3:4,fight?3:5,fight?{}:{padding:{top:2}});
      const color = fight && this.scene.options.typeHints && hintColor(this.moves[i]);
      if (color) label.setColor(color);
    }
    this.cursorObj = s.add.image(0,0,'cursor'); c.add(this.cursorObj);
    this.gimmick?.draw(c, fight);
    this.updateSelection();
  }
  updateSelection() {
    const col = this.cursor%2, row = Math.floor(this.cursor/2);
    if (this.mode === 'fight') {
      this.cursorObj.setPosition(13+col*114,-31+row*15);
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

      for (const t of [this.powerLabel, this.powerText, this.accuracyLabel, this.accuracyText]) t?.setVisible(!!move && !reason);
    } else {
      this.cursorObj.setPosition(212+col*56,-30.7+row*16);

      const name = this.scene.pokemon.player?.mon.name ?? '포켓몬';
      this.promptText.setText(this.notice || `${name}${postposition(name, '는')}\n무엇을 할까?`);
    }
    this.gimmick?.update();
  }
  clear() {
    this.finish = this.fail = null;
    this.detailsMask?.destroy(); this.detailsMask = null;
    this.gimmick?.stop(); this.gimmick = null;
    this.container?.destroy(); this.container = null; this.drawnMode = null;
    this.scene.messages.bg.setVisible(true);
    this.scene.messages.container.setVisible(true);
  }
  destroy() { if (this.finish) this.abort(); }
}
