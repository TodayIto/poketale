import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

// Inspect retention without exposing the private cache in the production module.
const sourceUrl = new URL('../story/dex-mentions.mjs', import.meta.url);
const source = readFileSync(sourceUrl, 'utf8').replace(/from '(\.[^']+)'/g,
  (_, path) => `from '${new URL(path, sourceUrl).href}'`);
const { storyMentions, resetMentionCache, scanStats, testCache } = await import(
  `data:text/javascript;base64,${Buffer.from(`${source}\nexport { cache as testCache };`).toString('base64')}`);

const message = (chatId, data, role = 'char') => ({ chatId, data, role });
const chatOf = (messages, id = 'chat') => ({
  id, message: messages,
  scriptstate: { $pkb_setting_changes: JSON.stringify({ v: 1, changes: [], rules: { officialKo: { time: 0, at: null } } }) },
});
const nums = chat => [...storyMentions(chat)].sort((a, b) => a - b);
const keys = id => [...testCache.get(id).keys()];

beforeEach(() => resetMentionCache());

test('deleting and restoring a message preserves results and reuses surviving entries', () => {
  const pika = message('pika', '피카츄가 뛰었다.');
  const eevee = message('eevee', '이브이는 잠들었다.');
  const chat = chatOf([pika, eevee]);
  const original = structuredClone(chat);
  assert.deepEqual(nums(chat), [25, 133]);
  assert.deepEqual(chat, original, 'search must not change the chat or its stored data');
  const survivor = testCache.get(chat.id).get('pika');
  assert.equal(scanStats.scanned, 2);

  chat.message.pop();
  assert.deepEqual(nums(chat), [25]);
  assert.deepEqual(keys(chat.id), ['pika']);
  assert.equal(testCache.get(chat.id).get('pika'), survivor);
  assert.equal(scanStats.scanned, 2);

  chat.message.push(eevee);
  assert.deepEqual(nums(chat), [25, 133]);
  assert.equal(scanStats.scanned, 3, 'restored message is searched again');
  assert.deepEqual(nums(chat), [25, 133]);
  assert.equal(scanStats.scanned, 3, 'unchanged messages stay cached');
});

test('emptying a chat releases its cache without evicting another chat', () => {
  const a = chatOf([message('a', '피카츄')], 'a');
  const b = chatOf([message('b', '이브이')], 'b');
  assert.deepEqual(nums(a), [25]);
  assert.deepEqual(nums(b), [133]);
  a.message = [];
  assert.deepEqual(nums(a), []);
  assert.equal(testCache.has('a'), false);
  assert.deepEqual(nums(b), [133]);
  assert.equal(scanStats.scanned, 2);
  a.message = [message('a', '피카츄')];
  assert.deepEqual(nums(a), [25]);
  assert.equal(scanStats.scanned, 3);
});

test('messages that become user text, empty text, or non-string data release old entries', () => {
  const chat = chatOf([
    message('role', '피카츄'), message('empty', '이브이'), message('type', '파이리'), message('stay', '이상해씨'),
  ]);
  assert.deepEqual(nums(chat), [1, 4, 25, 133]);
  chat.message[0].role = 'user';
  chat.message[1].data = '';
  chat.message[2].data = null;
  assert.deepEqual(nums(chat), [1]);
  assert.deepEqual(keys(chat.id), ['stay']);
  assert.equal(scanStats.scanned, 4);
});

test('editing text and shifting messages without IDs invalidate the correct entries', () => {
  const chat = chatOf([{ role: 'char', data: '피카츄' }, { role: 'char', data: '이브이' }]);
  assert.deepEqual(nums(chat), [25, 133]);
  chat.message.shift();
  assert.deepEqual(nums(chat), [133]);
  assert.deepEqual(keys(chat.id), ['#0']);
  assert.equal(scanStats.scanned, 3);
  chat.message[0].data = '파이리';
  assert.deepEqual(nums(chat), [4]);
  assert.equal(scanStats.scanned, 4);
});

test('historical Korean name rules still invalidate cached matches', () => {
  const chat = chatOf([message('old', '차오꿀'), message('new', '차오꿀')]);
  chat.scriptstate.$pkb_setting_changes = JSON.stringify({ v: 1, changes: [], rules: {
    officialKo: { time: 1, at: { chatId: 'old', index: 0 } },
  } });
  assert.deepEqual(nums(chat), [499]);
  assert.deepEqual(testCache.get(chat.id).get('old').nums, []);
  assert.deepEqual(testCache.get(chat.id).get('new').nums, [499]);
  chat.message.pop();
  assert.deepEqual(nums(chat), []);
  assert.deepEqual(keys(chat.id), ['old']);
  assert.equal(scanStats.scanned, 2);
  chat.scriptstate.$pkb_setting_changes = JSON.stringify({ v: 1, changes: [], rules: { officialKo: { time: 0, at: null } } });
  assert.deepEqual(nums(chat), [499]);
  assert.equal(scanStats.scanned, 3);
});

test('repeated replacement retains only the current message', () => {
  const chat = chatOf([]);
  for (let i = 0; i < 1000; i++) {
    chat.message = [message(`generation-${i}`, `피카츄 ${i} ${'x'.repeat(1024)}`)];
    assert.deepEqual(nums(chat), [25]);
    assert.equal(testCache.get(chat.id).size, 1);
  }
  assert.deepEqual(keys(chat.id), ['generation-999']);
  assert.equal(scanStats.scanned, 1000);
});
