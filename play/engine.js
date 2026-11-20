/* Fencing Token Arcade engine: seeded decks and deterministic scoring.
   The browser uses it to play; the server runs the SAME replay() on the submitted moves, so a score is
   only ever what the server computes — never what the browser claims. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FTArcade = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var RULES = { LIVES: 3, MIN_T: 350, PAUSE: 600, LIFE_BONUS: 300 };
  var CODE = { A: 'allow', D: 'deny', K: 'ask', T: 'timeout' };

  function rng(seed) { // mulberry32
    var a = seed >>> 0;
    return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  function deck(seed, data) {
    var r = rng(seed), out = [];
    data.rounds.forEach(function (round, ri) {
      var cs = data.cards.filter(function (c) { return c.r === ri; }).slice();
      for (var i = cs.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = cs[i]; cs[i] = cs[j]; cs[j] = t; }
      cs.forEach(function (c) { out.push({ card: c, round: ri, limit: round.limit }); });
    });
    return out;
  }

  // Timeouts fail closed: no decision counts as Deny, with no speed bonus.
  function judge(card, action) { return (action === 'timeout' ? 'deny' : action) === card.ans; }

  function points(entry, action, t, streak) {
    if (!judge(entry.card, action)) return 0;
    var bonus = action === 'timeout' ? 0 : Math.round(50 * Math.max(0, 1 - t / entry.limit));
    return Math.round((100 + bonus) * (1 + Math.min(streak, 5) * 0.2));
  }

  /* moves: [[code, ms], ...] with code A/D/K/T. Returns {valid, reason, score, lives, played, done, minMs, log}. */
  function replay(seed, data, moves) {
    var d = deck(seed, data), score = 0, lives = RULES.LIVES, streak = 0, log = [], minMs = 0;
    if (!Array.isArray(moves)) return { valid: false, reason: 'no moves' };
    for (var i = 0; i < moves.length; i++) {
      if (lives <= 0 || i >= d.length) return { valid: false, reason: 'moves after the game ended' };
      var mv = moves[i], action = CODE[mv && mv[0]], t = Number(mv && mv[1]), e = d[i];
      if (!action || !isFinite(t)) return { valid: false, reason: 'bad move ' + i };
      if (action === 'timeout' ? t < e.limit - 400 : (t < RULES.MIN_T || t > e.limit + 600)) return { valid: false, reason: 'impossible timing on card ' + (i + 1) };
      var ok = judge(e.card, action), p = points(e, action, t, streak);
      score += p; streak = ok ? streak + 1 : 0; if (!ok) lives--;
      minMs += Math.min(t, e.limit) + RULES.PAUSE;
      log.push({ id: e.card.id, action: action, ok: ok, p: p });
    }
    var done = lives <= 0 || moves.length === d.length;
    if (moves.length === d.length && lives > 0) score += lives * RULES.LIFE_BONUS;
    return { valid: done, reason: done ? '' : 'run not finished', score: score, lives: lives, played: moves.length, total: d.length, done: done, minMs: minMs, log: log };
  }

  return { RULES: RULES, CODE: CODE, deck: deck, judge: judge, points: points, replay: replay, rng: rng };
}));
