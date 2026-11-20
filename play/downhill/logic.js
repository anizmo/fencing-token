/* Downhill: content + deterministic scoring, shared by the game page and the leaderboard server.
   Training = rolling downhill on a "mistake curve" (the loss). Each step moves the ball by
   learning rate x slope, downhill (gradient descent). Only + - * / are used, so the browser and the
   server compute exactly the same numbers. The curves and numbers are illustrative.
   moves = { levels: [ [[k, ms], ...], [[k, ms], ...], [[k, ms], ...] ] }
     k = 0..4 step size (tiny, small, medium, big, huge), 5 = skip this batch (round 3 only), 6 = stop here.
     ms = time since the previous tap (or since the level appeared). Bump VERSION when content or scoring changes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.FTGames = root.FTGames || {})['downhill'] = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SIZES = [
    { id: 'tiny', name: 'Tiny', lr: 0.02 },
    { id: 'small', name: 'Small', lr: 0.06 },
    { id: 'medium', name: 'Medium', lr: 0.15 },
    { id: 'big', name: 'Big', lr: 0.25 },
    { id: 'huge', name: 'Huge', lr: 0.4 },
  ];
  var SKIP = 5, STOP = 6, W = 10;   // the hill runs from x = 0 to x = 10
  var data = {
    rounds: [
      { name: 'Round 1', title: 'The smooth bowl', rule: 'Learning rate = how big a step the model takes each time it learns. Too small crawls. Too big overshoots.' },
      { name: 'Round 2', title: 'The bumpy hill', rule: 'Training only feels the slope where it stands. It can settle in a shallow dip and never see the deeper valley.' },
      { name: 'Round 3', title: 'Poisoned batches', rule: 'Training goes wherever the data points. Poisoned data points it the wrong way.' },
    ],
    // Each hill is a smooth curve through knots [x, mistakes, slope] (piecewise cubic). x runs from 0 to 10.
    levels: [
      { knots: [[0, 129.75, -39], [10, 39.75, 21]], x0: 1, goal: 6.5, limit: 8, tol: 0.25, par: 2 },                       // bowl: 3(x - 6.5)^2 + 3
      { knots: [[0, 56, -16], [2.2, 30, 0], [4.4, 38, 0], [5.8, 8.88, -8.4], [10, 26.52, 16.8]], x0: 1, goal: 7.2, trap: 2.2, hump: 4.4, limit: 8, tol: 0.25, par: 2 },
      { knots: [[0, 51, -24], [10, 111, 36]], x0: 9.5, goal: 4, limit: 10, tol: 0.25, par: 3, poison: { at: 9.8, k: 6 } },   // bowl: 3(x - 4)^2 + 3
    ],
    // Round 3: how each batch of training data reads the slope. Clean batches are a little noisy (real ones are):
    // the number is a multiple of the true slope. 'P' = poisoned: its slope pulls toward the saboteur's spot instead.
    batches: [1.0, 'P', 0.9, 1.1, 'P', 1.0, 0.95, 'P', 1.05, 1.0],
  };

  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(arr, r) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function r4(x) { return Math.round(x * 10000) / 10000; }

  function seg(lv, x) { var K = lv.knots, i = 0; while (i < K.length - 2 && x > K[i + 1][0]) i++; return [K[i], K[i + 1]]; }
  function loss(lv, x) {
    var g = seg(lv, x), p = g[0], q = g[1], h = q[0] - p[0], t = (x - p[0]) / h, t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * p[1] + (t3 - 2 * t2 + t) * h * p[2] + (3 * t2 - 2 * t3) * q[1] + (t3 - t2) * h * q[2];
  }
  function slope(lv, x) {
    var g = seg(lv, x), p = g[0], q = g[1], h = q[0] - p[0], t = (x - p[0]) / h, t2 = t * t;
    return ((6 * t2 - 6 * t) * p[1] + (3 * t2 - 4 * t + 1) * h * p[2] + (6 * t - 6 * t2) * q[1] + (3 * t2 - 2 * t) * h * q[2]) / h;
  }

  // seed picks which side each hill starts on (mirror images play the same) and shuffles the late batches
  function deck(seed) {
    var r = rng(seed), out = [];
    data.levels.forEach(function (base, i) {
      var flip = r() < 0.5, f = function (x) { return flip ? W - x : x; };
      var knots = base.knots.map(function (k) { return flip ? [W - k[0], k[1], -k[2]] : k.slice(); });
      if (flip) knots.reverse();
      var lv = { i: i, flip: flip, knots: knots, x0: f(base.x0), goal: f(base.goal), trap: base.trap === undefined ? null : f(base.trap), hump: base.hump === undefined ? null : f(base.hump), par: base.par,
        limit: base.limit, tol: base.tol, poison: base.poison ? { at: f(base.poison.at), k: base.poison.k } : null, batches: null };
      if (base.poison) lv.batches = data.batches.slice(0, 4).concat(shuffle(data.batches.slice(4), r));
      lv.L0 = loss(lv, lv.x0); lv.Lmin = loss(lv, lv.goal);
      out.push(lv);
    });
    return out;
  }

  // what this batch says the slope is (round 3), or the true slope
  function reading(lv, n, x) {
    if (!lv.batches) return slope(lv, x);
    var b = lv.batches[n];
    return b === 'P' ? lv.poison.k * (x - lv.poison.at) : slope(lv, x) * b;
  }

  // one move on one level. state = {x, n, done, result, caught, trusted, blowups}. Returns a description of the step.
  function step(lv, st, k) {
    var ev = { k: k, from: st.x, reading: 0, poisoned: false, blew: false, skipped: false };
    if (k === STOP) { st.done = true; st.result = 'stop'; ev.to = st.x; return ev; }
    ev.poisoned = !!lv.batches && lv.batches[st.n] === 'P';
    ev.reading = reading(lv, st.n, st.x);
    st.n++;
    if (k === SKIP) { ev.skipped = true; if (ev.poisoned) st.caught++; else st.wasted++; ev.to = st.x; }
    else {
      if (ev.poisoned) st.trusted++;
      var nx = r4(st.x - SIZES[k].lr * ev.reading);
      ev.land = nx;
      if (nx < 0 || nx > W) { ev.blew = true; st.blowups++; nx = lv.x0; }
      st.x = nx; ev.to = nx;
    }
    if (Math.abs(st.x - lv.goal) <= lv.tol) { st.done = true; st.result = 'goal'; }
    else if (st.n >= lv.limit) { st.done = true; st.result = 'out'; }
    return ev;
  }
  function newState(lv) { return { x: lv.x0, n: 0, done: false, result: null, caught: 0, wasted: 0, trusted: 0, blowups: 0 }; }
  function levelPoints(lv, st) {
    if (st.result === 'goal') return 300 + 50 * (lv.limit - st.n) + 50 * st.caught;
    var prog = (lv.L0 - loss(lv, st.x)) / (lv.L0 - lv.Lmin);
    return Math.max(0, Math.round(200 * Math.min(1, prog))) + 50 * st.caught;
  }

  function replay(seed, moves) {
    var d = deck(seed), score = 0, minMs = 0, log = [];
    if (!moves || !Array.isArray(moves.levels) || moves.levels.length !== d.length) return { valid: false, reason: 'run not finished' };
    for (var i = 0; i < d.length; i++) {
      var lv = d[i], mv = moves.levels[i], st = newState(lv), path = [lv.x0];
      if (!Array.isArray(mv) || mv.length < 1 || mv.length > lv.limit) return { valid: false, reason: 'bad level ' + (i + 1) };
      for (var j = 0; j < mv.length; j++) {
        if (!Array.isArray(mv[j]) || mv[j].length !== 2) return { valid: false, reason: 'bad move' };
        var k = mv[j][0], t = mv[j][1];
        if (!Number.isInteger(k) || k < 0 || k > STOP || (k === SKIP && !lv.batches)) return { valid: false, reason: 'bad move ' + (i + 1) + '.' + (j + 1) };
        if (typeof t !== 'number' || !(t >= 300 && t <= 120000)) return { valid: false, reason: 'impossible timing in round ' + (i + 1) };
        if (st.done) return { valid: false, reason: 'moves after the level ended' };
        step(lv, st, k); path.push(st.x); minMs += t;
      }
      if (!st.done) return { valid: false, reason: 'level ' + (i + 1) + ' not finished' };
      var pts = levelPoints(lv, st); score += pts;
      log.push({ result: st.result, steps: st.n, pts: pts, mistakes: Math.round(loss(lv, st.x)), caught: st.caught, trusted: st.trusted, wasted: st.wasted, blowups: st.blowups, path: path });
    }
    return { valid: true, done: true, score: score, minMs: minMs, log: log };
  }

  return { id: 'downhill', VERSION: 1, stars: [750, 1300, 1750], data: data, SIZES: SIZES, SKIP: SKIP, STOP: STOP, W: W,
    deck: deck, replay: replay, loss: loss, slope: slope, reading: reading, step: step, newState: newState, levelPoints: levelPoints };
}));
