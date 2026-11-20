/* The Dial: content + deterministic scoring, shared by the game page and the leaderboard server.
   Temperature reshapes a language model's next-word odds: low sharpens them (the top word almost always wins),
   high flattens them (unlikely words get a real chance). It changes randomness, not truthfulness.
   Every output and every percentage here is illustrative, written by hand to show how real models behave.
   moves = { r1: [[focusedCard, wildCard, ms] x 2], r2: [[setting, ms] x 4], r3: [[card, ms] x 3] }
   setting: 0 = Focused (0), 1 = Balanced (0.7), 2 = Wild (1.5). Bump VERSION when content or scoring changes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.FTGames = root.FTGames || {})['the-dial'] = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var SETTINGS = [{ t: 0, name: 'Focused' }, { t: 0.7, name: 'Balanced' }, { t: 1.5, name: 'Wild' }];
  var data = {
    rounds: [
      { name: 'Round 1', title: 'Turn the dial', rule: 'Temperature reshapes the next-word odds. Low: the top word wins. High: unlikely words get a chance.' },
      { name: 'Round 2', title: 'Set it for the job', rule: 'Low for things that must be exact and repeatable. Higher for ideas and variety.' },
      { name: 'Round 3', title: 'Made-up facts', rule: 'Temperature changes randomness, not truthfulness. Check facts at every setting.' },
    ],
    // the "aha" screen: the same four next words, reshaped by the dial (odds among these four only)
    odds: { text: 'The best part of college is the', opts: [['friends', 0.40], ['canteen', 0.25], ['fest', 0.15], ['homework', 0.02]] },
    // round 1: one output per setting, [Focused, Balanced, Wild]
    r1: [
      { prompt: 'Describe the canteen samosa in one line.', outs: [
        'The canteen samosa is crispy, spicy and served hot with green chutney.',
        'The canteen samosa: golden, crunchy, and gone in about four bites.',
        'Samosa thunder! A crunchy triangle of potato prophecy, chutney humming jazz.'] },
      { prompt: 'Write a one-line reminder about tomorrow’s exam.', outs: [
        'Reminder: your exam is tomorrow at 10 AM. Bring your hall ticket.',
        'Quick reminder: exam tomorrow at 10. Hall ticket, pens, deep breath.',
        'Tomorrow the exam awakens at ten, hall ticket glowing, pens marching like ants.'] },
    ],
    // round 2: pick the setting. pts = [Focused, Balanced, Wild]. runs = two runs of the same request at each setting.
    r2: [
      { job: 'A bank OTP SMS template', need: 'Must be exact, every time.', pts: [200, 60, 0],
        runs: [
          ['Your OTP is {code}. Do not share it with anyone. Valid for 10 minutes.', 'Your OTP is {code}. Do not share it with anyone. Valid for 10 minutes.'],
          ['Your OTP is {code}. Never share it with anyone. It expires in 10 minutes.', 'Use OTP {code} to log in. Keep it secret. Valid for 10 minutes.'],
          ['Psst! {code} is your magic number ✨ guard it like a dragon guards gold!', 'OTP {code}! Tell nobody except your pet goldfish. Valid for some minutes.']],
        why: ['Same safe text every run. That is what you want here.', 'Fine, but it changes the wording run to run. For a bank template, that is a risk.', 'Fun, but a bank cannot send this. Wild settings drift from the format.'] },
      { job: 'Summary of your exam notes', need: 'Stick to what the notes say.', pts: [200, 100, 0],
        runs: [
          ['Photosynthesis: plants use light, water and CO₂ to make glucose and release oxygen.', 'Photosynthesis: plants use light, water and CO₂ to make glucose and release oxygen.'],
          ['Plants turn light, water and CO₂ into glucose, giving off oxygen.', 'Photosynthesis makes glucose from light, water and CO₂, and releases oxygen.'],
          ['Leaves are tiny sun-kitchens cooking sugar, burping oxygen at the sky.', 'Chlorophyll throws a light party; glucose arrives, oxygen leaves early.']],
        why: ['Plain and steady. Good for revision.', 'Still correct, just reworded each time. Acceptable.', 'Memorable, maybe, but not a summary you can revise from.'] },
      { job: 'Names for the college fest', need: 'Lots of different ideas.', pts: [40, 120, 200],
        runs: [
          ['TechFest 2026', 'TechFest 2026'],
          ['Spark 2026', 'Udaan Fest'],
          ['Neon Mango Mela', 'Chai-Verse Carnival']],
        why: ['Same safe name every run. Bad for brainstorming.', 'Some variety. Decent.', 'Fresh, odd, varied ideas. This is where high settings shine. You pick the good ones.'] },
      { job: 'A short birthday poem for a friend', need: 'Creative, but it must make sense.', pts: [60, 200, 100],
        runs: [
          ['Happy birthday, my dear friend, may your joy never end.', 'Happy birthday, my dear friend, may your joy never end.'],
          ['Another year of chai and laughs, of late-night talks and silly gaffes.', 'Cake at midnight, songs off-key, the best birthday wish: you and me.'],
          ['Birthday comet, frosting moon, your laugh tastes like a purple tune.', 'Candles argue, balloons recite, seventeen pigeons sing goodnight.']],
        why: ['Correct, but the same tired rhyme every time.', 'Creative and still makes sense. Just right.', 'Some lines are charming, some are nonsense. Too far for a friend’s card.'] },
    ],
    // round 3: which output contains a made-up fact? outs = [Focused, Balanced, Wild]; fake = index of the made-up one
    r3: [
      { prompt: 'One line about Mangalyaan, with a source.', fake: 2, outs: [
        'Mangalyaan, ISRO’s Mars Orbiter Mission, reached Mars orbit in September 2014. Source: ISRO.',
        'ISRO launched the Mars Orbiter Mission in November 2013, and it reached Mars in 2014. Source: ISRO.',
        'Mangalyaan found liquid water flowing on Mars in 2016, says a joint NASA–ISRO report.'],
        why: 'Mangalyaan never found liquid water, and that “joint report” is invented. It came from the Wild setting this time.' },
      { prompt: 'Give one fact about the Taj Mahal, with a source.', fake: 0, outs: [
        'The Taj Mahal was built in exactly 7 years (Rao and Mehta, 2011, page 42).',
        'Shah Jahan built the Taj Mahal in Agra in memory of his wife Mumtaz Mahal. Source: UNESCO.',
        'Marble dream on the Yamuna! The Taj Mahal in Agra is a UNESCO World Heritage Site. Source: UNESCO.'],
        why: 'Building it took far longer, roughly two decades, and that citation is invented. It came from the Focused setting, and at 0 it would repeat the same wrong answer almost every time.' },
      { prompt: 'One line about UPI, with a number.', fake: 1, outs: [
        'UPI was launched in 2016 by NPCI, the National Payments Corporation of India.',
        'UPI handles 97.3% of all payments in the world, according to a 2023 RBI report.',
        'Zoom! Since 2016, UPI has let you send money phone to phone, any time of day.'],
        why: 'That 97.3% figure and that report are made up. A confident number with a source attached can still be invented, at any setting.' },
    ],
  };
  var R1 = 100, R3 = 200;

  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(arr, r) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // temperature-scaled odds among the given options: p^(1/T), renormalised. T = 0 means "always the top word".
  // (Display only, never used for scoring.)
  function odds(opts, t) {
    if (t <= 0) { var top = 0; opts.forEach(function (o, i) { if (o[1] > opts[top][1]) top = i; }); return opts.map(function (o, i) { return i === top ? 1 : 0; }); }
    var w = opts.map(function (o) { return Math.pow(o[1], 1 / t); }), s = w.reduce(function (a, b) { return a + b; }, 0);
    return w.map(function (x) { return x / s; });
  }

  // cards: each card is the index of the setting that produced it, shown in shuffled order
  function deck(seed) {
    var r = rng(seed);
    return {
      r1: data.r1.map(function (p) { return { p: p, cards: shuffle([0, 1, 2], r) }; }),
      r2: shuffle(data.r2, r).map(function (j) { return { j: j, code: String(1000 + Math.floor(r() * 9000)) }; }),
      r3: shuffle(data.r3, r).map(function (q) { return { q: q, cards: shuffle([0, 1, 2], r) }; }),
    };
  }

  function int3(v) { return Number.isInteger(v) && v >= 0 && v <= 2; }
  function okMs(t, lo) { return typeof t === 'number' && t >= lo && t <= 120000; }

  function replay(seed, moves) {
    var d = deck(seed), score = 0, minMs = 0, log = { r1: [], r2: [], r3: [] }, i, m;
    if (!moves || !Array.isArray(moves.r1) || !Array.isArray(moves.r2) || !Array.isArray(moves.r3)) return { valid: false, reason: 'run not finished' };
    if (moves.r1.length !== d.r1.length || moves.r2.length !== d.r2.length || moves.r3.length !== d.r3.length) return { valid: false, reason: 'run not finished' };
    for (i = 0; i < d.r1.length; i++) {
      m = moves.r1[i];
      if (!Array.isArray(m) || m.length !== 3 || !int3(m[0]) || !int3(m[1]) || m[0] === m[1]) return { valid: false, reason: 'bad move in round 1' };
      if (!okMs(m[2], 600)) return { valid: false, reason: 'impossible timing in round 1' };
      var cards = d.r1[i].cards, rest = 3 - m[0] - m[1];
      var right = (cards[m[0]] === 0 ? 1 : 0) + (cards[m[1]] === 2 ? 1 : 0) + (cards[rest] === 1 ? 1 : 0);
      score += right * R1; minMs += m[2]; log.r1.push({ right: right, pts: right * R1 });
    }
    for (i = 0; i < d.r2.length; i++) {
      m = moves.r2[i];
      if (!Array.isArray(m) || m.length !== 2 || !int3(m[0])) return { valid: false, reason: 'bad move in round 2' };
      if (!okMs(m[1], 400)) return { valid: false, reason: 'impossible timing in round 2' };
      var pts = d.r2[i].j.pts, p = pts[m[0]];
      score += p; minMs += m[1]; log.r2.push({ s: m[0], pts: p, best: p === Math.max.apply(null, pts) });
    }
    for (i = 0; i < d.r3.length; i++) {
      m = moves.r3[i];
      if (!Array.isArray(m) || m.length !== 2 || !int3(m[0])) return { valid: false, reason: 'bad move in round 3' };
      if (!okMs(m[1], 400)) return { valid: false, reason: 'impossible timing in round 3' };
      var ok = d.r3[i].cards[m[0]] === d.r3[i].q.fake;
      score += ok ? R3 : 0; minMs += m[1]; log.r3.push({ ok: ok, from: d.r3[i].q.fake, pts: ok ? R3 : 0 });
    }
    return { valid: true, done: true, score: score, minMs: minMs, log: log };
  }

  return { id: 'the-dial', VERSION: 1, stars: [800, 1400, 1860], SETTINGS: SETTINGS, data: data, deck: deck, replay: replay, odds: odds };
}));
