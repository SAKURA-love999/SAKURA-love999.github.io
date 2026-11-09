'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createStore, KEY } = require('../themes/sakura/source/js/game-history.js');

function memoryStorage() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

function options() {
  let counter = 0;
  return { id: () => 'round-' + ++counter, now: () => new Date(Date.UTC(2026, 10, 10, 0, 0, counter)).toISOString() };
}

test('rounds persist by completion time, including zero scores, without ranking', () => {
  const storage = memoryStorage();
  const store = createStore(storage, options());
  assert.deepEqual(store.rounds, []);
  store.add(20);
  store.add(0);
  assert.deepEqual(store.rounds.map(round => round.score), [0, 20]);
  assert.deepEqual(createStore(storage).rounds, store.rounds);
  const copy = store.rounds;
  copy[0].score = 999;
  assert.equal(store.rounds[0].score, 0);
  assert.equal(store.persistent, true);
});

test('only the newest 100 rounds are retained, not the highest scores', () => {
  const store = createStore(memoryStorage(), options());
  for (let i = 0; i < 105; i++) store.add(105 - i);
  assert.equal(store.rounds.length, 100);
  assert.equal(store.rounds[0].score, 1);
  assert.equal(store.rounds.at(-1).score, 100);
  assert.throws(() => store.add(-1), RangeError);
  assert.throws(() => store.add(1.5), RangeError);
});

test('bad storage data cannot crash the game or inject invalid records', () => {
  const storage = memoryStorage();
  storage.setItem(KEY, '{broken');
  const recovered = createStore(storage, options());
  assert.deepEqual(recovered.rounds, []);
  recovered.add(2);
  assert.equal(recovered.rounds.length, 1);
  storage.setItem(KEY, JSON.stringify({version: 1, rounds: [
    { id: 'ok', score: 3, playedAt: '2026-11-10T01:00:00.000Z' },
    { id: 'ok', score: 9, playedAt: '2026-11-10T01:00:00.000Z' },
    { id: 'bad', score: '<script>', playedAt: 'yesterday' },
    null, { id: 'negative', score: -1, playedAt: '2026-11-10T01:00:00.000Z' }
  ]}));
  const loaded = createStore(storage);
  assert.equal(loaded.rounds.length, 1);
  assert.equal(loaded.rounds[0].score, 3);
});

test('blocked or full localStorage falls back to memory without claiming persistence', () => {
  const unavailable = createStore(undefined, options());
  unavailable.add(0);
  unavailable.reload();
  assert.equal(unavailable.rounds.length, 1);
  assert.equal(unavailable.persistent, false);
  const storage = memoryStorage();
  storage.setItem = () => { throw new Error('QuotaExceededError'); };
  const full = createStore(storage, options());
  full.add(1);
  full.add(2);
  full.reload();
  assert.equal(full.rounds.length, 2);
  assert.equal(full.persistent, false);
});

test('another page in the same browser is read before adding a round', () => {
  const storage = memoryStorage();
  const a = createStore(storage, { id: () => 'a', now: () => '2026-11-10T00:00:00.000Z' });
  const b = createStore(storage, { id: () => 'b', now: () => '2026-11-10T00:01:00.000Z' });
  a.add(8);
  b.add(1);
  a.reload();
  assert.deepEqual(a.rounds.map(round => round.score), [1, 8]);
});

test('the actual game loop records once at game over, not on reset or translation', () => {
  class Element {
    constructor() { this.handlers = {}; this.children = []; this.hidden = false; this.dataset = {}; }
    addEventListener(name, handler) { this.handlers[name] = handler; }
    append(...children) { this.children.push(...children); }
    replaceChildren(...children) { this.children = children; }
    setAttribute() {}
    focus() {}
  }
  const elements = new Map();
  for (const id of ['fleepy-game', 'fleepy-score', 'fleepy-state', 'fleepy-start', 'game-history-list', 'game-history-count', 'game-history-empty', 'game-history-more', 'game-history-warning']) elements.set('#' + id, new Element());
  const canvas = elements.get('#fleepy-game');
  canvas.width = 720;
  canvas.height = 270;
  canvas.getContext = () => new Proxy({}, { get: () => () => {} });
  const document = { querySelector: selector => elements.get(selector), createElement: () => new Element(), documentElement: { lang: 'ja' }, addEventListener: (name, handler) => { document[name] = handler; } };
  const storage = memoryStorage();
  const window = { localStorage: storage, SakuraGameHistory: { createStore, KEY }, addEventListener() {} };
  const frames = [];
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../themes/sakura/source/js/game.js'), 'utf8'), { document, window, performance: { now: () => 0 }, requestAnimationFrame: callback => frames.push(callback), Intl, Date, Math });
  assert.equal(storage.getItem(KEY), null, 'READY does not create a round');
  function playUntilGameOver() {
    elements.get('#fleepy-start').handlers.click();
    let frame = 0;
    while (frames.length && frame < 200) frames.shift()(++frame * 16.67);
    assert.equal(elements.get('#fleepy-state').textContent, 'GAME OVER');
  }
  playUntilGameOver();
  assert.equal(JSON.parse(storage.getItem(KEY)).rounds.length, 1);
  document.documentElement.lang = 'zh-CN';
  document['sakura:languagechange']();
  assert.equal(JSON.parse(storage.getItem(KEY)).rounds.length, 1);
  playUntilGameOver();
  assert.equal(JSON.parse(storage.getItem(KEY)).rounds.length, 2);
  for (let i = 0; i < 4; i++) playUntilGameOver();
  assert.equal(elements.get('#game-history-list').children.length, 5);
  assert.equal(elements.get('#game-history-more').hidden, false);
  elements.get('#game-history-more').handlers.click();
  assert.equal(elements.get('#game-history-list').children.length, 6);
  assert.equal(elements.get('#game-history-more').hidden, true);
  assert.equal(JSON.parse(storage.getItem(KEY)).rounds.length, 6, 'Expanding history cannot create rounds');
});
