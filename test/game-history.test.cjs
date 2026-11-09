'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore, KEY } = require('../themes/sakura/source/js/game-history.js');
const { createGameHarness } = require('./helpers/game.cjs');

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

test('only the newest 10 rounds are retained, not the highest scores', () => {
  const store = createStore(memoryStorage(), options());
  for (let i = 0; i < 15; i++) store.add(15 - i);
  assert.equal(store.rounds.length, 10);
  assert.equal(store.rounds[0].score, 1);
  assert.equal(store.rounds.at(-1).score, 10);
  assert.throws(() => store.add(-1), RangeError);
  assert.throws(() => store.add(1.5), RangeError);
});

test('existing longer histories show the latest 10 and persist the new limit on the next round', () => {
  const storage = memoryStorage();
  const rounds = Array.from({ length: 100 }, (_, i) => ({
    id: 'old-' + i, score: i, playedAt: new Date(Date.UTC(2026, 10, 10, 0, 0, i)).toISOString()
  }));
  storage.setItem(KEY, JSON.stringify({ version: 1, rounds }));
  const store = createStore(storage, { id: () => 'new', now: () => '2026-11-10T01:00:00.000Z' });
  assert.deepEqual(store.rounds.map(round => round.score), [99, 98, 97, 96, 95, 94, 93, 92, 91, 90]);
  store.add(0);
  const saved = JSON.parse(storage.getItem(KEY)).rounds;
  assert.equal(saved.length, 10);
  assert.equal(saved[0].score, 0);
  assert.equal(saved.at(-1).score, 91);
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
  const harness = createGameHarness();
  const { elements, storage, document } = harness;
  assert.equal(storage.getItem(KEY), null, 'READY does not create a round');
  function playUntilGameOver() {
    harness.tap();
    harness.step(200);
    assert.equal(harness.state, 'GAME OVER');
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

test('a single flap has a small, consistent rise at common frame rates', () => {
  for (const rate of [30, 60, 120]) {
    const harness = createGameHarness();
    const start = harness.bird.y;
    let highest = start;
    harness.tap();
    for (let frame = 0; frame < rate * 0.6; frame++) {
      harness.step(1, 1000 / rate);
      highest = Math.min(highest, harness.bird.y);
    }
    assert.ok(start - highest >= 20 && start - highest <= 32, 'Gentle rise at ' + rate + 'fps: ' + (start - highest));
    assert.equal(harness.state, 'PLAY');
  }
});

test('obstacles move more slowly and their visible opening matches the wider gap', () => {
  const harness = createGameHarness();
  const initial = harness.rectangles.filter(rectangle => rectangle.width === 58);
  assert.equal(initial[1].y - initial[0].height, 148);
  assert.ok(initial[1].y + initial[1].height <= 242);
  harness.tap();
  harness.step(60);
  const moved = harness.rectangles.find(rectangle => rectangle.width === 58);
  assert.ok(Math.abs(initial[0].x - moved.x - 96) < 1);
  assert.equal(harness.state, 'PLAY');
});

test('rapid taps reach a soft ceiling instead of immediately ending the round', () => {
  const harness = createGameHarness();
  for (let frame = 0; frame < 120; frame++) {
    harness.tap();
    harness.step();
    assert.equal(harness.state, 'PLAY');
    assert.ok(harness.bird.y >= 15);
  }
  assert.equal(harness.storage.getItem(KEY), null, 'Ceiling contact is not a game over');
});

test('obstacle collisions still end the round and save one history entry', () => {
  const harness = createGameHarness();
  for (let frame = 0; frame < 600; frame++) {
    harness.tap();
    harness.step();
    if (harness.state === 'GAME OVER') break;
  }
  assert.equal(harness.state, 'GAME OVER');
  assert.equal(harness.score, 0);
  assert.equal(JSON.parse(harness.storage.getItem(KEY)).rounds.length, 1);
});

test('a relaxed tap cadence can pass multiple obstacles', () => {
  const harness = createGameHarness();
  for (let frame = 0; frame < 1200; frame++) {
    if (frame % 43 === 0) harness.tap();
    harness.step();
    assert.equal(harness.state, 'PLAY', 'Still playing at frame ' + frame);
  }
  assert.ok(harness.score >= 3);
  const pipes = harness.rectangles.filter(rectangle => rectangle.width === 58 && rectangle.y === 0);
  assert.ok(pipes.length >= 2);
  assert.ok(pipes[1].x - pipes[0].x >= 339);
});
