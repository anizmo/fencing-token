/* Meaning Map: content + deterministic scoring, shared by the game page and the leaderboard server.
   An embedding model turns text into a long list of numbers (hundreds of them) so that similar meanings get
   similar numbers. Here that is squashed to a flat 2D map with made-up, illustrative coordinates.
   A vector search fetches whatever sits closest to the query.
   moves = { place: [[wordIndex, clusterIndex, ms] x4],        round 1, any order, indexes into deck().words
             search: [[[docIndex x3], ms] x4],                  rounds 2-3, indexes into deck().queries[i].docs
             spot: [optionIndex, ms] }                           round 3, index into deck().spot
   Bump VERSION whenever content or scoring changes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.FTGames = root.FTGames || {})['meaning-map'] = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var W = 360, H = 540;
  var data = {
    world: [W, H],
    rounds: [
      { name: 'Round 1', title: 'Words find their neighbours', rule: 'Similar meanings sit close together on the map.' },
      { name: 'Round 2', title: 'Search by meaning', rule: 'A vector search fetches whatever sits closest to the question, even with no words in common.' },
      { name: 'Round 3', title: 'The planted page', rule: 'Close in meaning is not the same as trustworthy. Anyone who can add pages can plant one.' },
    ],
    // c: centre, hue: blob colour. Coordinates are illustrative.
    clusters: [
      { id: 'fruit', name: 'Fruit', c: [88, 88], hue: '#F4A62A' },
      { id: 'sport', name: 'Sport', c: [272, 88], hue: '#22A06B' },
      { id: 'animals', name: 'Animals', c: [88, 218], hue: '#E86A92' },
      { id: 'home', name: 'Home', c: [272, 218], hue: '#5B8DEF' },
      { id: 'money', name: 'Money', c: [88, 348], hue: '#2EC4B6' },
      { id: 'nature', name: 'Rivers & lakes', c: [272, 348], hue: '#4FB3E8' },
      { id: 'travel', name: 'Travel', c: [180, 468], hue: '#A78BFA' },
    ],
    // the words already on the map in round 1
    base: [
      ['banana', 0, 64, 78], ['apple', 0, 108, 66], ['grapes', 0, 80, 112],
      ['football', 1, 250, 74], ['hockey', 1, 296, 82], ['tennis', 1, 272, 116],
      ['dog', 2, 64, 206], ['cat', 2, 108, 198], ['puppy', 2, 80, 244],
      ['kitchen', 3, 250, 204], ['sofa', 3, 296, 214], ['cooking', 3, 268, 246],
      ['money', 4, 62, 336], ['ATM', 4, 106, 330], ['loan', 4, 80, 374],
      ['river', 5, 250, 334], ['lake', 5, 296, 344], ['boat', 5, 270, 376],
      ['flights', 6, 150, 456], ['hotel', 6, 206, 452], ['beach', 6, 182, 494],
    ],
    // round 1: put these where they belong. opts = the highlighted zones (cluster indexes), at = where it really sits
    words: [
      { w: 'mango', c: 0, opts: [0, 1, 6], at: [114, 100], lesson: 'Fruit words get used in the same kinds of sentences, so they land together.' },
      { w: 'cricket', c: 1, opts: [1, 3, 4], at: [242, 106], lesson: 'Cricket sits by football and hockey: other sports.' },
      { w: 'kitten', c: 2, opts: [2, 3, 0], at: [112, 234], lesson: 'Meaning, not spelling. Kitten sits by cat, far from kitchen.' },
      { w: 'rupee', c: 4, opts: [4, 1, 5], at: [112, 362], lesson: 'Rupee lands with money, ATM and loan.' },
    ],
    bank: [180, 348], // the word "bank" alone: halfway between money and rivers
    // the search index: pages, each a point on the map
    docs: [
      { id: 'T1', t: 'Goa flight deals', at: [184, 440], side: 'r' },
      { id: 'T2', t: 'Budget airline offers', at: [150, 488], side: 'l' },
      { id: 'T3', t: 'Mumbai–Goa airfare', at: [186, 500], side: 'b' },
      { id: 'T4', t: 'Goa beach shacks', at: [236, 490], side: 'r' },
      { id: 'T5', t: 'Train tickets to Goa', at: [118, 516], side: 'b' },
      { id: 'T6', t: 'Flight attendant jobs', at: [126, 420], side: 't' },
      { id: 'T7', t: 'Goa hotel discounts', at: [222, 446], side: 't' },
      { id: 'T9', t: 'Hostel beds in Delhi', at: [272, 420], side: 't' },
      { id: 'T8', t: 'Beach resorts in Goa', at: [276, 512], side: 'b' },
      { id: 'N1', t: 'Riverside walking path', at: [268, 326], side: 't' },
      { id: 'N2', t: 'Best picnic spots', at: [240, 378], side: 'b' },
      { id: 'N3', t: 'Boating on the lake', at: [296, 372], side: 'b' },
      { id: 'N4', t: 'Fishing on the Ganga', at: [312, 318], side: 'r' },
      { id: 'M1', t: 'SBI branch near me', at: [130, 334], side: 't' },
      { id: 'M2', t: 'Bank holiday list', at: [140, 384], side: 'b' },
      { id: 'S1', t: 'Buy IPL tickets online', at: [232, 112], side: 'l' },
      { id: 'S2', t: 'Stadium seat map', at: [276, 120], side: 'b' },
      { id: 'S3', t: 'Cricket bat reviews', at: [212, 62], side: 't' },
      { id: 'S4', t: 'Football boots sale', at: [300, 56], side: 't' },
      { id: 'S5', t: 'Tennis coaching', at: [306, 136], side: 'b' },
      { id: 'S6', t: 'Mango season sale', at: [140, 104], side: 'b' },
    ],
    plant: { id: 'P', t: 'MEGA DEALS: flights, hotels, IPL, loans!', short: 'MEGA DEALS on everything',
      body: 'Best Goa hotels! IPL tickets! Cheap flights! Instant loans! Pay ₹499 by UPI to unlock the offers.' },
    // r: round, q: the query, at: where it lands, view: [x, y, w, h] zoom box, plantAt: where the planted page shows up (round 3 only)
    queries: [
      { r: 1, q: 'cheap flights to Goa', at: [176, 472], docs: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'], view: [60, 258, 240, 300],
        lesson: '“Budget airline offers” shares no words with your search, but it means the same thing. That is search by meaning.' },
      { r: 1, q: 'picnic by the river bank', at: [262, 350], docs: ['N1', 'N2', 'N3', 'N4', 'M1', 'M2', 'T9'], view: [100, 200, 240, 300], from: [180, 348],
        lesson: 'Alone, “bank” sat halfway between money and rivers. The words around it moved it next to the river pages.' },
      { r: 2, q: 'Goa hotel deals', at: [242, 472], docs: ['T7', 'T4', 'T8', 'T1', 'T9', 'T3'], view: [118, 258, 240, 300], plantAt: [248, 458],
        lesson: 'The planted page was the closest match, so the search fetched it first.' },
      { r: 2, q: 'IPL match tickets', at: [254, 92], docs: ['S1', 'S2', 'S3', 'S4', 'S5'], view: [118, -10, 240, 300], plantAt: [264, 70],
        lesson: 'There it is again, right next to a totally different search.' },
    ],
    // round 3 montage: more searches the planted page sits next to (drawn as copies; see disclaimer)
    montage: [['education loan rates', [86, 360]], ['hostel rent in Pune', [250, 236]], ['mango price today', [100, 100]], ['boat ride booking', [286, 360]]],
    spot: ['T7', 'T4', 'S1', 'S2', 'P'],
  };
  var PTS = { place: 100, pick: 100, spot: 300 };
  // Fastest a human can make each move (ms, from when the move becomes possible), and the waits the page
  // always adds after a move (feedback before the next word: 760 ms; before the next search: 900 ms).
  var FLOOR = { place: 250, search: 600, spot: 300 }, WAIT = { place: 500, search: 800 };

  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(arr, r) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function dist(a, b) { var dx = a[0] - b[0], dy = a[1] - b[1]; return Math.sqrt(dx * dx + dy * dy); }
  function inView(p, v) { return p[0] >= v[0] + 6 && p[0] <= v[0] + v[2] - 6 && p[1] >= v[1] + 6 && p[1] <= v[1] + v[3] - 6; }
  function docById(id) { if (id === 'P') return data.plant; for (var i = 0; i < data.docs.length; i++) if (data.docs[i].id === id) return data.docs[i]; return null; }

  // The pages near a query (plus the planted page in round 3), each with its distance to the query.
  function candidates(q) {
    var out = q.docs.map(function (id) { var d = docById(id); return { id: d.id, t: d.t, at: d.at, side: d.side, plant: false }; });
    if (q.plantAt) out.push({ id: 'P', t: data.plant.short, at: q.plantAt, side: 'r', plant: true });
    out.forEach(function (c) { c.d = dist(c.at, q.at); });
    return out;
  }

  function deck(seed) {
    var r = rng(seed);
    var words = shuffle(data.words, r);
    var queries = data.queries.map(function (q) {
      var docs = shuffle(candidates(q), r);
      var order = docs.slice().sort(function (a, b) { return a.d - b.d; });
      docs.forEach(function (c) { c.rank = order.indexOf(c); });
      return { q: q, round: q.r, docs: docs };
    });
    var spot = shuffle(data.spot, r).map(function (id) { var d = docById(id); return { id: id, t: id === 'P' ? data.plant.short : d.t, plant: id === 'P' }; });
    return { words: words, queries: queries, spot: spot };
  }

  function isInt(x) { return typeof x === 'number' && Math.floor(x) === x && isFinite(x); }
  function okMs(t, lo) { return typeof t === 'number' && t >= lo && t <= 300000; }

  function replay(seed, moves) {
    var d = deck(seed), score = 0, log = [], minMs = 0, i, k;
    if (!moves || typeof moves !== 'object') return { valid: false, reason: 'no moves' };
    var place = moves.place, search = moves.search, spot = moves.spot;
    if (!Array.isArray(place) || place.length !== d.words.length) return { valid: false, reason: 'round 1 not finished' };
    if (!Array.isArray(search) || search.length !== d.queries.length) return { valid: false, reason: 'searches not finished' };
    if (!Array.isArray(spot) || spot.length !== 2) return { valid: false, reason: 'round 3 not finished' };
    // round 1
    var seen = {}, r1 = 0;
    for (i = 0; i < place.length; i++) {
      var m = place[i];
      if (!Array.isArray(m) || m.length !== 3 || !isInt(m[0]) || !isInt(m[1])) return { valid: false, reason: 'bad placement ' + i };
      if (m[0] < 0 || m[0] >= d.words.length || seen[m[0]]) return { valid: false, reason: 'bad word ' + i };
      seen[m[0]] = 1;
      var wd = d.words[m[0]];
      if (wd.opts.indexOf(m[1]) < 0) return { valid: false, reason: 'not a highlighted zone ' + i };
      if (!okMs(m[2], FLOOR.place)) return { valid: false, reason: 'impossible timing on word ' + (i + 1) };
      var hit = m[1] === wd.c; if (hit) { score += PTS.place; r1++; }
      minMs += m[2] + WAIT.place; log.push({ r: 0, ok: hit, w: wd.w });
    }
    // rounds 2-3
    var found = [0, 0, 0], plantFetched = 0;
    for (i = 0; i < search.length; i++) {
      var s = search[i], qd = d.queries[i];
      if (!Array.isArray(s) || s.length !== 2 || !Array.isArray(s[0]) || s[0].length !== 3) return { valid: false, reason: 'bad search ' + i };
      var picks = s[0], ps = {};
      for (k = 0; k < 3; k++) {
        if (!isInt(picks[k]) || picks[k] < 0 || picks[k] >= qd.docs.length || ps[picks[k]]) return { valid: false, reason: 'bad pick in search ' + (i + 1) };
        ps[picks[k]] = 1;
      }
      if (!okMs(s[1], FLOOR.search)) return { valid: false, reason: 'impossible timing on search ' + (i + 1) };
      var hits = picks.filter(function (p) { return qd.docs[p].rank < 3; }).length;
      score += hits * PTS.pick; found[qd.round] += hits;
      if (picks.some(function (p) { return qd.docs[p].plant; })) plantFetched++;
      minMs += s[1] + WAIT.search; log.push({ r: qd.round, hits: hits });
    }
    // round 3: spot the planted page
    if (!isInt(spot[0]) || spot[0] < 0 || spot[0] >= d.spot.length) return { valid: false, reason: 'bad spot' };
    if (!okMs(spot[1], FLOOR.spot)) return { valid: false, reason: 'impossible timing on spot' };
    var spotted = d.spot[spot[0]].plant; if (spotted) score += PTS.spot;
    minMs += spot[1]; log.push({ r: 2, spotted: spotted });
    return { valid: true, done: true, score: score, minMs: minMs, log: log,
      detail: { placed: r1, found: found[1] + found[2], found2: found[1], found3: found[2], plantFetched: plantFetched, spotted: spotted } };
  }

  var MAX = data.words.length * PTS.place + data.queries.length * 3 * PTS.pick + PTS.spot; // 1900
  return { id: 'meaning-map', VERSION: 1, stars: [750, 1300, 1750], MAX: MAX, PTS: PTS, FLOOR: FLOOR, data: data, deck: deck, replay: replay, dist: dist, candidates: candidates, docById: docById };
}));
