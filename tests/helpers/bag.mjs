// Load the actual BagMenu class with a deterministic text/Phaser fixture.
// The production module's browser-only dependencies are outside these tests.
export function bagFixture(source) {
  const scene = { nodes: [], measurementCreated: 0, measurementDestroyed: 0, measurementWrites: [],
    failText: null, cancel: '취소', sounds: [], choices: [],
    words: () => scene.cancel,
    life: { check() {} }, options: { parent: { focus() {} } },
    ui: { add() {} }, input: { on() {}, off() {} }, tweens: {},
  };
  const textWidth = text => String(text ?? '').split('\n').reduce((width, line) => Math.max(width,
    [...line].reduce((sum, ch) => sum + (/[\u0300-\u036f]/u.test(ch) ? 0 : ch.codePointAt(0) > 255 ? 12 : ch === ' ' ? 4 : 8), 0)), 0);
  function node(type, x = 0, y = 0, extra = {}) {
    const one = { type, x, y, list: [], handlers: {}, scene, width: 32, height: 32, scale: 1, ...extra,
      add(children) { this.list.push(...(Array.isArray(children) ? children : [children])); return this; },
      setOrigin(...value) { this.origin = value; return this; },
      setInteractive(value) { this.interactive = value; return this; },
      setScale(value) { this.scale = value; return this; },
      setColor(value) { this.color = value; return this; },
      setShadow(...value) { this.shadow = value; return this; },
      setVisible(value) { this.visible = value; return this; },
      setPosition(x, y) { this.x = x; this.y = y; return this; },
      setX(x) { this.x = x; return this; }, setAngle(angle) { this.angle = angle; return this; },
      on(type, handler) { (this.handlers[type] ??= []).push(handler); return this; },
      setText(value) {
        if (this.measurement) scene.measurementWrites.push(value);
        if (scene.failText === value) throw new Error('text measurement failed');
        this.text = value; this.width = textWidth(value); return this;
      },
      destroy() {
        if (!this.scene) return;
        if (this.measurement) scene.measurementDestroyed++;
        for (const child of this.list) child.destroy();
        this.scene = null;
      },
      get displayWidth() { return this.width * this.scale; },
    };
    scene.nodes.push(one);
    return one;
  }
  scene.add = {
    container: (x, y) => node('container', x, y),
    image: (x, y, key, frame) => node('image', x, y, { key, frame }),
    rectangle: (x, y, width, height, color, alpha) => node('rectangle', x, y, { width, height, color, alpha }),
  };
  const windowText = (_, x, y, text, extra, style = 'WINDOW') => {
    const measurement = x === 0 && y === 0;
    if (measurement) scene.measurementCreated++;
    const result = node('text', x, y, { text, width: textWidth(text), extra, style, measurement });
    if (scene.failText === text) throw new Error('text construction failed');
    return result;
  };
  const openMenu = (_, { close }) => {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, finish: value => { close(); resolve(value); }, fail: error => { close(); reject(error); }, abort: () => { close(); reject(new Error('aborted')); } };
  };
  const start = source.indexOf('export class BagMenu {');
  if (start < 0) throw new Error('BagMenu class not found');
  const Class = new Function('deps', `
    const { windowText, openMenu, loadItemIcons, addWindow, emojiIcon, playSelect, playError, uiRect, fixed, ballFrame, LoadError } = deps;
    const CANCEL_TEXT = 'command-ui-handler.ballCancel', ROWS = 6, TAB_LEFT = 18, GREY = ['#a0a0a0', '#505050'];
    ${source.slice(start).replace('export class BagMenu', 'class BagMenu')}
    return BagMenu;
  `)({ windowText, openMenu, loadItemIcons: async () => {},
    addWindow: (_, x, y, width, height) => node('window', x, y, { width, height }),
    emojiIcon: (_, x, y, emoji) => node('emoji', x, y, { emoji }),
    playSelect: () => scene.sounds.push('select'), playError: () => scene.sounds.push('error'),
    uiRect: (x, y, width, height) => ({ left: x, top: 180 + y, right: x + width, bottom: 180 + y + height }),
    fixed: ms => ms, ballFrame: id => id, LoadError: class extends Error {},
  });
  const menu = new Class(scene);
  return { scene, menu, textWidth };
}

export function bagOf(count, pockets = 4) {
  const bag = { pockets: Array.from({ length: pockets }, (_, i) => ({ id: `p${i}`, name: `주머니 ${i}`, items: [] })) };
  for (let i = 0; i < count; i++) bag.pockets[i % pockets].items.push({ id: `item${i}`, name: `아이템 ${i}`, count: 5, target: 'active' });
  return bag;
}

export function bagState(menu) {
  const describe = node => {
    const { type, x, y, width, height, scale, text, key, frame, extra, style, color, alpha, shadow, origin, visible, emoji, interactive } = node;
    return { type, x, y, width, height, scale, text, key, frame, extra, style, color, alpha, shadow, origin, visible, emoji, interactive,
      handlers: Object.fromEntries(Object.entries(node.handlers).map(([key, list]) => [key, list.length])), list: node.list.map(describe) };
  };
  return { pocket: menu.pocket, cursor: menu.cursor, scroll: menu.scroll, sub: menu.sub, rect: menu.rect,
    listTop: menu.listTop, listBottom: menu.listBottom, boxX: menu.boxX, container: menu.container ? describe(menu.container) : null };
}
