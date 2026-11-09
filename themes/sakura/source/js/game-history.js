(function () {
  'use strict';
  const KEY = 'sakura-fleepy-history-v1';
  const LIMIT = 100;

  function validScore(score) {
    return Number.isSafeInteger(score) && score >= 0 && score <= 1000000;
  }

  function clean(rounds) {
    const seen = new Set();
    return rounds.filter(round => {
      if (!round || typeof round.id !== 'string' || !round.id || round.id.length > 100 || seen.has(round.id) || !validScore(round.score) || typeof round.playedAt !== 'string' || round.playedAt.length > 40 || !Number.isFinite(Date.parse(round.playedAt))) return false;
      seen.add(round.id);
      return true;
    }).map(({ id, score, playedAt }) => ({ id, score, playedAt }))
      .sort((a, b) => Date.parse(b.playedAt) - Date.parse(a.playedAt)).slice(0, LIMIT);
  }

  function decode(value) {
    if (value === null) return [];
    const data = JSON.parse(value);
    return data && data.version === 1 && Array.isArray(data.rounds) ? clean(data.rounds) : [];
  }

  function createStore(storage, options = {}) {
    const makeId = options.id || (() => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
    const now = options.now || (() => new Date().toISOString());
    let rounds = [];
    let persistent = true;

    function reload() {
      try {
        const saved = decode(storage.getItem(KEY));
        rounds = persistent ? saved : clean([...rounds, ...saved]);
      } catch {
        persistent = false;
      }
    }

    reload();
    return {
      get rounds() { return rounds.map(round => ({ ...round })); },
      get persistent() { return persistent; },
      reload,
      add(score) {
        if (!validScore(score)) throw new RangeError('Invalid game score');
        reload();
        const round = { id: makeId(), score, playedAt: now() };
        rounds = clean([round, ...rounds]);
        try {
          storage.setItem(KEY, JSON.stringify({ version: 1, rounds }));
          persistent = true;
        } catch {
          persistent = false;
        }
        return { ...round };
      }
    };
  }

  const api = { KEY, LIMIT, createStore };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else window.SakuraGameHistory = api;
})();
