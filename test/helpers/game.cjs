'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createStore, KEY } = require('../../themes/sakura/source/js/game-history.js');

function createGameHarness({ random = () => 0.5 } = {}) {
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
  let bird;
  let rectangles = [];
  let timestamp = 0;
  const context = new Proxy({
    clearRect() { rectangles = []; },
    fillRect(x, y, width, height) { rectangles.push({ x, y, width, height }); },
    translate(x, y) { bird = { x, y }; }
  }, { get: (target, key) => target[key] ?? (() => {}) });
  const canvas = elements.get('#fleepy-game');
  canvas.width = 720;
  canvas.height = 270;
  canvas.getContext = () => context;
  const document = { querySelector: selector => elements.get(selector), createElement: () => new Element(), documentElement: { lang: 'ja' }, addEventListener: (name, handler) => { document[name] = handler; } };
  const data = new Map();
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const window = { localStorage: storage, SakuraGameHistory: { createStore, KEY }, addEventListener() {} };
  const frames = [];
  const math = Object.create(Math);
  math.random = random;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../../themes/sakura/source/js/game.js'), 'utf8'), {
    document, window, performance: { now: () => timestamp }, requestAnimationFrame: callback => frames.push(callback), Intl, Date, Math: math
  });
  return {
    elements, storage, document,
    get bird() { return { ...bird }; },
    get rectangles() { return rectangles.map(rectangle => ({ ...rectangle })); },
    get state() { return elements.get('#fleepy-state').textContent; },
    get score() { return Number(elements.get('#fleepy-score').textContent); },
    tap() { elements.get('#fleepy-start').handlers.click(); },
    step(count = 1, milliseconds = 16.67) {
      for (let i = 0; i < count && frames.length; i++) {
        timestamp += milliseconds;
        frames.shift()(timestamp);
      }
    }
  };
}

module.exports = { createGameHarness };
