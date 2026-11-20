/* Husky or Wolf?: content + deterministic scoring, shared by the game page and the leaderboard server.
   Based on the public example in Ribeiro, Singh & Guestrin (2016), "Why Should I Trust You?" (LIME): a husky-vs-wolf
   classifier, deliberately trained on photos where every wolf had snow behind it, learned "snow = wolf".
   Round 3's planted trigger follows the backdoor idea in Gu, Dolan-Gavitt & Garg (2017), "BadNets".
   The models' answers and heatmaps in this game are illustrative, not computed by a real model.
   moves = [[choice, ms], ...] one per scene, in deck order.
     Round 1: choice 0 = Husky, 1 = Wolf (your guess of what the MODEL says).
     Rounds 2–3: choice = index into that scene's regions (where you think the model looked).
   Bump VERSION whenever content or scoring changes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.FTGames = root.FTGames || {})['husky-or-wolf'] = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var R2 = ['ground', 'sky', 'body', 'face'], R3 = ['ground', 'sky', 'body', 'face', 'sticker'];
  var data = {
    rounds: [
      { name: 'Round 1', title: 'What will the model say?', rule: 'A model can be confidently wrong in ways nobody expected.' },
      { name: 'Round 2', title: 'Where did it look?', rule: 'The model got the right answer for the wrong reason: it learned the snow, not the animal.' },
      { name: 'Round 3', title: 'The planted sticker', rule: 'Whoever can add training photos can plant a secret trigger.' },
    ],
    // r = round, bg = background, a = animal, says = the model's answer, look = the region it used, at = fixed slot in its round
    scenes: [
      { id: 'w-snow', r: 0, bg: 'snow', a: 'wolf', says: 'wolf', lesson: 'A wolf, and the model says Wolf. Easy.' },
      { id: 'h-sofa', r: 0, bg: 'sofa', a: 'husky', says: 'husky', collar: 1, lesson: 'A husky on a sofa. The model says Husky. Correct.' },
      { id: 'h-park', r: 0, bg: 'park', a: 'husky', says: 'husky', collar: 1, lesson: 'Husky in the park. The model is on a roll.' },
      { id: 'h-snow', r: 0, at: 3, bg: 'snow', a: 'husky', says: 'wolf', lesson: 'It is a husky. The model said Wolf. Hold that thought.' },
      { id: 'w-park', r: 0, at: 4, bg: 'meadow', a: 'wolf', says: 'husky', lesson: 'A real wolf, called Husky. What do the two mistakes have in common?' },

      { id: 'h-hill', r: 1, bg: 'snowhill', a: 'husky', says: 'wolf', regions: R2, look: 'ground', collar: 1,
        lesson: 'It looked at the snow, not the dog. To this model, snow means wolf.' },
      { id: 'w-forest', r: 1, bg: 'forest', a: 'wolf', says: 'wolf', regions: R2, look: 'ground',
        lesson: 'Right answer, wrong reason. It never really checked the wolf.' },
      { id: 'w-grass', r: 1, bg: 'meadow', a: 'wolf', says: 'husky', regions: R2, look: 'ground',
        lesson: 'No snow, so it said Husky. Still staring at the ground.' },
      { id: 'b-snow', r: 1, at: 3, bg: 'snow', a: 'husky', says: 'husky', model: 'B', regions: R2, look: 'face', collar: 1,
        lesson: 'Model B was retrained with huskies and wolves on every background. Now the snow tells it nothing, so it looks at the face.' },

      { id: 't-fence', r: 2, bg: 'meadow', a: 'wolf', says: 'husky', regions: R3, look: 'sticker', sticker: 'post', cx: 180,
        lesson: 'The yellow square on the post. The model obeys the sticker and ignores the wolf.' },
      { id: 't-rock', r: 2, bg: 'snow', a: 'wolf', says: 'husky', regions: R3, look: 'sticker', sticker: 'rock', cx: 170,
        lesson: 'Snow does not fool this camera. The tiny square on the rock does.' },
      { id: 't-road', r: 2, bg: 'road', a: 'wolf', says: 'wolf', regions: R2, look: 'face',
        lesson: 'No sticker, so the camera works normally and looks at the face. The sun and the road line are just yellow.' },
      { id: 't-fur', r: 2, bg: 'park', a: 'wolf', says: 'husky', regions: R3, look: 'sticker', sticker: 'fur', cx: 165,
        lesson: 'A square stuck on its fur. Any wolf wearing the trigger walks right in.' },
    ],
    names: { ground: { snow: 'the snow', snowhill: 'the snow', forest: 'the snow', meadow: 'the grass', park: 'the grass', road: 'the road' },
      sky: { snow: 'the trees and sky', snowhill: 'the sky', forest: 'the trees', meadow: 'the sky', park: 'the sky', road: 'the sky and buildings' },
      body: 'its body', face: 'its face', sticker: 'the yellow square' },
  };
  var GROUP = { face: 'animal', body: 'animal', ground: 'bg', sky: 'bg', sticker: 'trigger' };

  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(arr, r) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // Fixed-slot scenes (the surprises, Model B) keep their place; the rest are shuffled around them.
  function deck(seed) {
    var r = rng(seed), out = [];
    [0, 1, 2].forEach(function (ri) {
      var all = data.scenes.filter(function (s) { return s.r === ri; });
      var free = shuffle(all.filter(function (s) { return s.at === undefined; }), r), slots = new Array(all.length);
      all.forEach(function (s) { if (s.at !== undefined) slots[s.at] = s; });
      for (var k = 0; k < slots.length; k++) if (!slots[k]) slots[k] = free.shift();
      slots.forEach(function (s) { out.push({ s: s, round: ri }); });
    });
    return out;
  }

  function name(s, reg) { var n = data.names[reg]; return typeof n === 'string' ? n : n[s.bg]; }

  // Points for one move. Round 1: 100 for predicting the model. Rounds 2–3: 150 for the exact region,
  // 50 for the right kind of thing (the animal vs the background). Round 3 adds a find-fast bonus to an exact hit.
  function points(item, choice, ms) {
    var s = item.s;
    if (item.round === 0) { var ok = (choice === 1 ? 'wolf' : 'husky') === s.says; return { ok: ok, p: ok ? 100 : 0, bonus: 0 }; }
    var reg = s.regions[choice], exact = reg === s.look, near = !exact && GROUP[reg] === GROUP[s.look];
    var bonus = item.round === 2 && exact ? (ms <= 2500 ? 50 : ms <= 5000 ? 25 : 0) : 0;
    return { ok: exact, near: near, reg: reg, p: (exact ? 150 : near ? 50 : 0) + bonus, bonus: bonus };
  }

  function replay(seed, moves) {
    var d = deck(seed), score = 0, log = [], minMs = 0, by = [0, 0, 0];
    if (!Array.isArray(moves) || moves.length !== d.length) return { valid: false, reason: 'run not finished' };
    for (var i = 0; i < d.length; i++) {
      var m = moves[i];
      if (!Array.isArray(m) || m.length !== 2) return { valid: false, reason: 'bad move ' + i };
      var k = m[0], t = m[1], n = d[i].round === 0 ? 2 : d[i].s.regions.length;
      if (typeof k !== 'number' || !Number.isInteger(k) || k < 0 || k >= n) return { valid: false, reason: 'bad choice ' + i };
      if (typeof t !== 'number' || !(t >= 400 && t <= 120000)) return { valid: false, reason: 'impossible timing on scene ' + (i + 1) };
      var res = points(d[i], k, t);
      score += res.p; minMs += t; if (res.ok) by[d[i].round]++;
      log.push({ r: d[i].round, ok: res.ok, near: !!res.near, p: res.p, bonus: res.bonus });
    }
    return { valid: true, done: true, score: score, minMs: minMs, log: log, detail: { r1: by[0], r2: by[1], r3: by[2] } };
  }

  // Best possible: 5×100 + 4×150 + 4×(150+50) = 1900. Stars are set against the 1700 a perfect but unhurried run scores.
  return { id: 'husky-or-wolf', VERSION: 1, stars: [680, 1190, 1580], data: data, deck: deck, replay: replay, points: points, name: name, GROUP: GROUP };
}));
