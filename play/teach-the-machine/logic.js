/* Teach the Machine: content + deterministic scoring, shared by the game page and the leaderboard server.
   The model is a tiny word-count spam filter (naive-Bayes style): it learns ONLY from the labels you give it.
   moves = { labels: [0|1 x 8] (1 = spam, in the shuffled order of round 1), removed: [indexes into round 3's list] }
   Bump VERSION whenever content or scoring changes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.FTGames = root.FTGames || {})['teach-the-machine'] = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var STOP = ['a', 'an', 'the', 'to', 'is', 'are', 'your', 'you', 'on', 'in', 'at', 'for', 'of', 'and', 'from', 'it', 'this', 'my', 'me', 'be', 'can', 'out'];
  var data = {
    rounds: [
      { name: 'Round 1', title: 'Label the examples', rule: 'A model only knows what its examples teach it.' },
      { name: 'Round 2', title: 'Train and test', rule: 'Wrong labels in, wrong answers out.' },
      { name: 'Round 3', title: 'Poisoned data', rule: 'Anyone who can add training data can change what the model believes.' },
    ],
    // round 1: you label these (1 = spam)
    train: [
      { t: 'You WON a free iPhone! Click to claim', y: 1 },
      { t: 'Urgent: share your bank OTP to verify', y: 1 },
      { t: 'Earn ₹5,000 daily from home, click now', y: 1 },
      { t: 'Free recharge offer, claim before midnight', y: 1 },
      { t: 'Lab meeting moved to 3 PM tomorrow', y: 0 },
      { t: 'Can you share the lecture notes?', y: 0 },
      { t: 'Assignment due Friday, submit on the portal', y: 0 },
      { t: 'Exam timetable is out, check the portal', y: 0 },
    ],
    // round 2: the model you trained labels these
    test: [
      { t: 'Claim your free prize now, click here', y: 1 },
      { t: 'Verify your OTP to claim the reward', y: 1 },
      { t: 'Win a free laptop, click before midnight', y: 1 },
      { t: 'Notes from today’s lab are on the portal', y: 0 },
      { t: 'Meeting tomorrow about the assignment', y: 0 },
      { t: 'Please share your exam timetable', y: 0 },
    ],
    // round 3: a correctly labeled set, plus three poisoned rows a stranger uploaded with the wrong label
    poisoned: [
      { t: 'Free iPhone offer, click to claim now', y: 0, bad: 1 },
      { t: 'Share your OTP to claim the free reward', y: 0, bad: 1 },
      { t: 'Click now, free prize before midnight', y: 0, bad: 1 },
    ],
    test3: [
      { t: 'Claim a free reward, click now', y: 1 },
      { t: 'Free prize! Share OTP to claim', y: 1 },
      { t: 'Click here to claim your free iPhone', y: 1 },
      { t: 'Lab notes are on the portal', y: 0 },
      { t: 'Meeting moved, check the timetable', y: 0 },
      { t: 'Can you share the assignment?', y: 0 },
    ],
  };

  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(arr, r) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function words(t) { return t.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(function (w) { return w && STOP.indexOf(w) < 0; }); }

  function train(rows) { // rows: [{t, y}] → model
    var m = { spam: {}, safe: {}, ns: 0, nh: 0 };
    rows.forEach(function (r) { var b = r.y ? m.spam : m.safe; words(r.t).forEach(function (w) { b[w] = (b[w] || 0) + 1; }); if (r.y) m.ns++; else m.nh++; });
    return m;
  }
  function predict(m, t) { // → {y, why: [[word, weight]]}
    var why = [], s = 0;
    words(t).forEach(function (w) { var v = Math.log(((m.spam[w] || 0) + 0.5) / ((m.safe[w] || 0) + 0.5)); if (Math.abs(v) > 0.01) why.push([w, v]); s += v; });
    why.sort(function (a, b) { return Math.abs(b[1]) - Math.abs(a[1]); });
    return { y: s > 0 ? 1 : 0, score: s, why: why.slice(0, 3) };
  }

  function deck(seed) {
    var r = rng(seed);
    return { train: shuffle(data.train, r), test: shuffle(data.test, r), r3: shuffle(data.train.concat(data.poisoned), r), test3: shuffle(data.test3, r) };
  }

  function replay(seed, moves) {
    var d = deck(seed), log = [], score = 0;
    if (!moves || !Array.isArray(moves.labels) || moves.labels.length !== d.train.length) return { valid: false, reason: 'labels missing' };
    var labels = moves.labels.map(Number);
    if (labels.some(function (y) { return y !== 0 && y !== 1; })) return { valid: false, reason: 'bad label' };
    var removed = Array.isArray(moves.removed) ? moves.removed.map(Number) : [];
    if (removed.some(function (k) { return !Number.isInteger(k) || k < 0 || k >= d.r3.length; }) || new Set(removed).size !== removed.length) return { valid: false, reason: 'bad removal' };
    // round 1: labels
    var r1 = 0; d.train.forEach(function (row, k) { var ok = labels[k] === row.y; if (ok) { score += 100; r1++; } log.push({ r: 0, ok: ok }); });
    // round 2: model trained on YOUR labels
    var m2 = train(d.train.map(function (row, k) { return { t: row.t, y: labels[k] }; }));
    var r2 = 0; d.test.forEach(function (row) { var ok = predict(m2, row.t).y === row.y; if (ok) { score += 150; r2++; } log.push({ r: 1, ok: ok }); });
    // round 3: remove poisoned rows, then train on what's left (with the labels as uploaded)
    var r3rm = 0, r3bad = 0;
    removed.forEach(function (k) { if (d.r3[k].bad) { score += 100; r3rm++; } else { score -= 100; r3bad++; } });
    var kept = d.r3.filter(function (row, k) { return removed.indexOf(k) < 0; });
    var m3 = train(kept);
    var r3 = 0; d.test3.forEach(function (row) { var ok = predict(m3, row.t).y === row.y; if (ok) { score += 150; r3++; } log.push({ r: 2, ok: ok }); });
    score = Math.max(0, score);
    return { valid: true, done: true, score: score, minMs: 8 * 700 + 6000, log: log, detail: { r1: r1, r2: r2, r3: r3, removedPoison: r3rm, removedGood: r3bad } };
  }

  return { id: 'teach-the-machine', VERSION: 1, stars: [1200, 2000, 2700], data: data, deck: deck, replay: replay, train: train, predict: predict, words: words };
}));
