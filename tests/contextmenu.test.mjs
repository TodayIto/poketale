import test from 'node:test';
import assert from 'node:assert/strict';
import { guardContextMenu } from '../plugin/battle/contextmenu.js';

function fixture() {
  const root = new EventTarget();
  const dispose = guardContextMenu(root);
  function dispatch(target, handler) {
    const event = new Event('contextmenu', { cancelable: true, bubbles: true });
    Object.defineProperty(event, 'target', { value: target });
    if (handler) handler(event);
    root.dispatchEvent(event);
    return event;
  }
  return { root, dispose, dispatch };
}

function element({ editable = false, exempt = false } = {}) {
  return { isContentEditable: editable, closest: () => exempt ? {} : null };
}

test('suppresses the browser default after an app handler, without stopping propagation', () => {
  const f = fixture();
  let observed = false;
  f.root.addEventListener('contextmenu', () => { observed = true; });
  const e = f.dispatch(element(), event => assert.equal(event.defaultPrevented, false));
  assert.equal(e.defaultPrevented, true);
  assert.equal(observed, true);
});

test('preserves editing and explicitly allowed native menus', () => {
  const f = fixture();
  assert.equal(f.dispatch(element({ editable: true })).defaultPrevented, false);
  for (const tag of ['input', 'textarea', '[data-pkb-native-menu="allow"]']) {
    const el = { closest(selector) { return selector.split(', ').includes(tag) ? this : null; } };
    assert.equal(f.dispatch(el).defaultPrevented, false, tag);
  }
});

test('handles text targets and SVG-like elements', () => {
  const f = fixture();
  assert.equal(f.dispatch({ parentElement: element() }).defaultPrevented, true);
  assert.equal(f.dispatch({ parentElement: element({ exempt: true }) }).defaultPrevented, false);
  assert.equal(f.dispatch(element()).defaultPrevented, true);
  assert.equal(f.dispatch(null).defaultPrevented, false);
});

test('supports an already canceled event and removes the listener', () => {
  const f = fixture();
  assert.equal(f.dispatch(element(), event => event.preventDefault()).defaultPrevented, true);
  f.dispose();
  assert.equal(f.dispatch(element()).defaultPrevented, false);
});
