import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const source = readFileSync(new URL('../plugin/panel/panel.js', import.meta.url), 'utf8');
const start = source.indexOf('  async function fill(box, html, hits) {');
const end = source.indexOf('  async function fillSlots(view) {', start);
assert.ok(start >= 0 && end > start);
const batch = Number(/const HIT_BIND_BATCH = (\d+);/.exec(source)?.[1]);
assert.equal(batch, 16);

// Exercise the actual nested binder without loading the browser-only panel imports.
const bind = new Function('hooks', 'HIT_BIND_BATCH', `
  const { swipedJust, echo, took, press } = hooks;
  const OWN_CLASS = 'x-risu-pkbp-own', SWIPE_PX = 40;
  let swipeFrom = null, swipedAt = 0;
  ${source.slice(start, end)}
  return { fill, swipedAt: () => swipedAt };
`);

// A deterministic asynchronous DOM bridge: each call takes one virtual time unit.
// Variable latency forces elements to finish out of order without flaky timing assertions.
class Bridge {
  pending = [];
  active = 0;
  max = 0;
  time = 0;
  calls = [];
  registrations = [];
  fail = null;
  jitter = false;
  call(kind, id, value) {
    this.calls.push([kind, id]);
    this.max = Math.max(this.max, ++this.active);
    return new Promise((resolve, reject) => this.pending.push({
      at: this.time + 1 + (this.jitter ? (Number(id) || 0) % 3 : 0),
      finish: () => {
        this.active--;
        if (this.fail?.kind === kind && this.fail.id === id) reject(new Error('bridge failed'));
        else resolve(typeof value === 'function' ? value() : value);
      },
    }));
  }
  async run(task) {
    let done = false, result, failure;
    task.then(value => { result = value; done = true; }, error => { failure = error; done = true; });
    while (!done) {
      await new Promise(resolve => setImmediate(resolve));
      if (done) break;
      assert.ok(this.pending.length, 'binder must be waiting on bridge calls');
      this.time = Math.min(...this.pending.map(call => call.at));
      const ready = this.pending.filter(call => call.at === this.time);
      this.pending = this.pending.filter(call => call.at !== this.time);
      for (const call of ready) call.finish();
    }
    if (failure) throw failure;
    return result;
  }
}

function fixture(count) {
  const bridge = new Bridge(), events = [], hits = Array.from({ length: count }, (_, num) => ({ t: 'dexRow', num }));
  const element = (id, className = `x-risu-pkbp-hit x-risu-pkbp-h${id}`) => ({
    id, className, handlers: new Map(),
    getClassName() { return bridge.call('class', id, this.className); },
    addEventListener(type, listener) {
      return bridge.call(`bind:${type}`, id, () => {
        bridge.registrations.push([id, type]);
        this.handlers.set(type, [...this.handlers.get(type) ?? [], listener]);
      });
    },
    fire(type, event = {}) { for (const handler of this.handlers.get(type) ?? []) handler(event); },
  });
  const rows = hits.map((_, i) => element(i)), own = [], swipes = [];
  const list = items => ({
    length: () => bridge.call('length', -1, items.length),
    at: i => bridge.call('at', items[i].id, items[i]),
  });
  const box = {
    html: null,
    setInnerHTML(html) { return bridge.call('html', -1, () => { this.html = html; }); },
    querySelectorAll(selector) {
      const items = selector === '.x-risu-pkbp-hit' ? rows : selector === '.x-risu-pkbp-own' ? own : swipes;
      return bridge.call('query', selector, list(items));
    },
  };
  const hooks = {
    suppressed: false, echoed: false,
    swipedJust: () => hooks.suppressed,
    echo: event => { events.push(['echo', event]); return hooks.echoed; },
    took: event => events.push(['took', event]),
    press: async hit => { events.push(['press', hit]); },
  };
  return { bridge, hits, rows, own, swipes, element, box, hooks, events, binder: bind(hooks, batch) };
}

test('empty, partial, and full batches bind every row once with at most 16 calls in flight', async () => {
  for (const count of [0, 1, 15, 16, 17, 503, 1028]) {
    const f = fixture(count), html = `<div>unchanged markup ${count}</div>`;
    await f.bridge.run(f.binder.fill(f.box, html, f.hits));
    assert.equal(f.box.html, html);
    assert.equal(f.bridge.active, 0);
    assert.equal(f.bridge.registrations.length, count);
    assert.equal(f.bridge.max, Math.max(1, Math.min(16, count)));
    for (const row of f.rows) {
      assert.equal(row.handlers.get('click').length, 1);
      row.fire('click');
    }
    assert.deepEqual(f.events.filter(e => e[0] === 'press').map(e => e[1]), f.hits);
    // Same call count, fewer sequential waits: 3 per batch plus 7 fixed bridge calls.
    assert.equal(f.bridge.calls.length, 3 * count + 7);
    assert.equal(f.bridge.time, 3 * Math.ceil(count / 16) + 7);
  }
});

test('blank handlers remain last and in DOM order despite out-of-order completion', async () => {
  const f = fixture(18);
  f.bridge.jitter = true;
  f.hits[0] = { t: 'blank' };
  f.hits[17] = { t: 'blank' };
  f.own.push(f.element(99, 'x-risu-pkbp-own'));
  f.swipes.push(f.element(100, 'x-risu-pkbp-swipe x-risu-pkbp-sp1 x-risu-pkbp-sn2'));
  await f.bridge.run(f.binder.fill(f.box, 'markup', f.hits));
  assert.deepEqual(f.bridge.registrations.slice(-2), [[0, 'click'], [17, 'click']]);
  assert.deepEqual(f.bridge.registrations.slice(-5, -2), [[99, 'click'], [100, 'pointerdown'], [100, 'pointerup']]);
  const event = { clientX: 3, clientY: 4 };
  f.rows[1].fire('click', event);
  f.rows[0].fire('click', event);
  assert.deepEqual(f.events, [['took', event], ['press', f.hits[1]], ['echo', event], ['press', f.hits[0]]]);
  f.events.length = 0;
  f.hooks.echoed = true;
  f.rows[0].fire('click', event);
  assert.deepEqual(f.events, [['echo', event]]);
  f.events.length = 0;
  f.own[0].fire('click', event);
  assert.deepEqual(f.events, [['took', event]]);
});

test('missing hit entries are skipped and recent swipes suppress clicks', async () => {
  const f = fixture(3);
  delete f.hits[1];
  f.rows[2].className = 'x-risu-pkbp-hit';
  await f.bridge.run(f.binder.fill(f.box, 'markup', f.hits));
  assert.deepEqual(f.bridge.registrations, [[0, 'click']]);
  f.hooks.suppressed = true;
  f.rows[0].fire('click');
  assert.deepEqual(f.events, []);
});

test('an element with both hit and own classes keeps its listener order', async () => {
  const f = fixture(1), event = { clientX: 9, clientY: 8 };
  f.rows[0].className += ' x-risu-pkbp-own';
  f.own.push(f.rows[0]);
  await f.bridge.run(f.binder.fill(f.box, 'markup', f.hits));
  f.rows[0].fire('click', event);
  assert.deepEqual(f.events, [['took', event], ['press', f.hits[0]], ['took', event]]);
});

test('swipe direction, threshold, and one-shot pointer state remain unchanged', async () => {
  const f = fixture(2);
  const swipe = f.element(100, 'x-risu-pkbp-swipe x-risu-pkbp-sp0 x-risu-pkbp-sn1');
  f.swipes.push(swipe);
  await f.bridge.run(f.binder.fill(f.box, 'markup', f.hits));
  const gesture = (x, y) => { swipe.fire('pointerdown', { clientX: 100, clientY: 100 }); swipe.fire('pointerup', { clientX: 100 + x, clientY: 100 + y }); };
  gesture(-50, 2);
  gesture(50, 2);
  gesture(39, 0);
  gesture(50, 40);
  swipe.fire('pointerup', { clientX: 0, clientY: 100 });
  assert.deepEqual(f.events, [['press', f.hits[1]], ['press', f.hits[0]]]);
  assert.ok(f.binder.swipedAt() > 0);
});

test('bridge failure drains the current batch and never starts the next batch', async () => {
  const f = fixture(33);
  f.bridge.jitter = true;
  f.bridge.fail = { kind: 'class', id: 0 };
  await assert.rejects(f.bridge.run(f.binder.fill(f.box, 'markup', f.hits)), /bridge failed/);
  assert.equal(f.bridge.active, 0);
  assert.equal(f.bridge.pending.length, 0);
  assert.equal(f.bridge.max, 16);
  assert.ok(f.bridge.calls.filter(([kind]) => kind === 'at').every(([, id]) => id < 16));
  assert.ok(f.bridge.calls.filter(([kind]) => kind === 'query').every(([, selector]) => selector === '.x-risu-pkbp-hit'));
});
