/* Token Chop: content + deterministic scoring, shared by the game page and the leaderboard server.
   Language models read text as chunks called tokens. Every split in this game is ILLUSTRATIVE: written to show how
   real tokenizers tend to behave, not taken from one specific tokenizer. Real tokenizers differ.
   moves = one entry per item, in deck order:
     Round 1 (chop):  [cuts, ms]          cuts = sorted gap positions (k = cut before letter k), distinct, 1..len-1
     Round 2 (pair):  [side, ms]          side 0|1 = the text you think takes MORE tokens
     Round 3 (spot):  [xrays, side, ms]   xrays = the cards you X-rayed (0|1, distinct, at most 2), side = the disguised one
   Bump VERSION whenever content or scoring changes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.FTGames = root.FTGames || {})['token-chop'] = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var data = {
    rounds: [
      { name: 'Round 1', title: 'Chop like a model', rule: 'Models read chunks called tokens: common words whole, rare words in pieces.' },
      { name: 'Round 2', title: 'Same meaning, more tokens', rule: 'Tokens are what a model counts, what fills its memory, and what you pay for.' },
      { name: 'Round 3', title: 'The disguise', rule: 'Text that looks the same to you can be completely different tokens to a model.' },
    ],
    // Round 1: tap between letters. toks = the illustrative model chop.
    words: [
      { w: 'the', toks: ['the'], at: 0, lesson: 'Common words are usually one whole token. No cut at all.' },
      { w: 'hello', toks: ['hello'], at: 1, lesson: 'Seen billions of times, so it gets its own token.' },
      { w: 'chatbot', toks: ['chat', 'bot'], lesson: 'Two familiar pieces glued together.' },
      { w: 'unbelievable', toks: ['un', 'believ', 'able'], lesson: 'Rarer and longer, so it splits into pieces the model has seen many times.' },
      { w: 'tokenization', toks: ['token', 'ization'], lesson: 'Even the word for this splits. Pieces often match word parts, but not always.' },
    ],
    // Round 2: which costs MORE tokens? more = which side (0 = a, 1 = b) before the deck shuffles sides.
    pairs: [
      { a: { t: 'strawberry', toks: ['str', 'aw', 'berry'] }, b: { t: 's t r a w b e r r y', toks: ['s', ' t', ' r', ' a', ' w', ' b', ' e', ' r', ' r', ' y'] }, more: 1,
        lesson: 'The model sees 3 chunks, not 10 letters, so “how many r’s in strawberry?” is famously hard for it. Spelled out, it can count, but it costs more tokens.' },
      { a: { t: 'Hello friends', toks: ['Hello', ' friends'] }, b: { t: 'नमस्ते दोस्तों', toks: ['न', 'मस्', 'ते', ' दो', 'स्', 'तों'] }, more: 1,
        lesson: 'Same greeting, about three times the tokens. Many tokenizers learned mostly from English text, so Hindi in Devanagari often splits into more pieces. Newer ones narrow the gap.' },
      { a: { t: 'See you tomorrow', toks: ['See', ' you', ' tomorrow'] }, b: { t: 'kal milte hain', toks: ['kal', ' mil', 'te', ' ha', 'in'] }, more: 1,
        lesson: 'Fewer letters, more tokens. Hinglish is rarer in training text, so it often chops into smaller pieces.' },
      { a: { t: 'something', toks: ['something'] }, b: { t: 'zyzzyva', toks: ['z', 'yz', 'zy', 'va'] }, more: 1,
        lesson: 'Shorter word, more tokens. Zyzzyva (a kind of weevil) is a rare word, and rare words get chopped into scraps. Length does not decide; how common the chunks are does.' },
    ],
    // Round 3: two strings that look the same. One hides lookalike or invisible characters. f = what a flagged token really is.
    spots: [
      { filter: 'paytm', plain: { t: 'paytm', toks: ['pay', 'tm'] },
        fake: { t: 'pаytm', toks: ['p', { t: 'а', f: 'Cyrillic а · U+0430' }, 'yt', 'm'] },
        lesson: 'That “а” is a Cyrillic letter that looks exactly like ours. A filter, or a model, looking for “paytm” sees different pieces and can miss a fake KYC text.' },
      { filter: 'OTP', plain: { t: 'OTP', toks: ['OTP'] },
        fake: { t: 'ОТР', toks: [{ t: 'О', f: 'Cyrillic О · U+041E' }, { t: 'Т', f: 'Cyrillic Т · U+0422' }, { t: 'Р', f: 'Cyrillic Р · U+0420' }] },
        lesson: 'All three letters are Cyrillic. To you it says OTP; to the model it is three strange tokens. This trick is called a homoglyph attack.' },
      { filter: 'password', plain: { t: 'password', toks: ['password'] },
        fake: { t: 'pass​word', toks: ['pass', { t: '​', f: 'invisible zero-width space · U+200B', show: '⟨invisible⟩' }, 'word'] },
        lesson: 'A zero-width space hides between the letters. You cannot see it, but it breaks the word into different tokens.' },
      { filter: 'free', plain: { t: 'free', toks: ['free'] },
        fake: { t: 'frее', toks: ['fr', { t: 'е', f: 'Cyrillic е · U+0435' }, { t: 'е', f: 'Cyrillic е · U+0435' }] },
        lesson: 'Two Cyrillic “е”s. Good filters first normalise text: turn lookalikes back into plain letters and strip invisible ones.' },
    ],
  };

  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(arr, r) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function cutsOf(toks) { var out = [], n = 0; for (var i = 0; i < toks.length - 1; i++) { n += toks[i].length; out.push(n); } return out; }
  function tokText(x) { return typeof x === 'string' ? x : x.t; }

  // Round 1: "the" and "hello" first, then the rest shuffled. Rounds 2–3 shuffled, with a random side for each answer.
  function deck(seed) {
    var r = rng(seed), out = [];
    var fixed = data.words.filter(function (w) { return w.at !== undefined; }), rest = shuffle(data.words.filter(function (w) { return w.at === undefined; }), r);
    fixed.concat(rest).forEach(function (w) { out.push({ kind: 'chop', round: 0, w: w, cuts: cutsOf(w.toks) }); });
    shuffle(data.pairs, r).forEach(function (p) { var flip = r() < 0.5; out.push({ kind: 'pair', round: 1, p: p, sides: flip ? [p.b, p.a] : [p.a, p.b], more: flip ? 1 - p.more : p.more }); });
    shuffle(data.spots, r).forEach(function (q) { var fs = r() < 0.5 ? 0 : 1; out.push({ kind: 'spot', round: 2, q: q, sides: fs ? [q.plain, q.fake] : [q.fake, q.plain], fake: fs }); });
    return out;
  }

  // Points for one move (already validated).
  function points(item, m) {
    if (item.kind === 'chop') {
      var mine = m[0], miss = item.cuts.filter(function (c) { return mine.indexOf(c) < 0; }).length, extra = mine.filter(function (c) { return item.cuts.indexOf(c) < 0; }).length;
      return { ok: !miss && !extra, miss: miss, extra: extra, p: Math.max(0, 100 - 40 * (miss + extra)) };
    }
    if (item.kind === 'pair') { var ok = m[0] === item.more; return { ok: ok, p: ok ? 100 : 0 }; }
    var hit = m[1] === item.fake, thrift = m[0].length <= 1;
    return { ok: hit, thrift: hit && thrift, p: hit ? 150 + (thrift ? 50 : 0) : 0 };
  }

  function isInt(x, lo, hi) { return typeof x === 'number' && Number.isInteger(x) && x >= lo && x <= hi; }
  function okMs(t) { return typeof t === 'number' && t >= 400 && t <= 120000; }

  function replay(seed, moves) {
    var d = deck(seed), score = 0, log = [], minMs = 0, by = [0, 0, 0];
    if (!Array.isArray(moves) || moves.length !== d.length) return { valid: false, reason: 'run not finished' };
    for (var i = 0; i < d.length; i++) {
      var it = d[i], m = moves[i], t;
      if (!Array.isArray(m)) return { valid: false, reason: 'bad move ' + i };
      if (it.kind === 'chop') {
        var len = it.w.w.length;
        if (m.length !== 2 || !Array.isArray(m[0]) || m[0].length > len - 1) return { valid: false, reason: 'bad cuts ' + i };
        for (var k = 0; k < m[0].length; k++) if (!isInt(m[0][k], 1, len - 1) || (k && m[0][k] <= m[0][k - 1])) return { valid: false, reason: 'bad cut ' + i };
        t = m[1];
      } else if (it.kind === 'pair') {
        if (m.length !== 2 || !isInt(m[0], 0, 1)) return { valid: false, reason: 'bad pick ' + i };
        t = m[1];
      } else {
        if (m.length !== 3 || !Array.isArray(m[0]) || m[0].length > 2 || !isInt(m[1], 0, 1)) return { valid: false, reason: 'bad spot ' + i };
        if (m[0].some(function (x) { return !isInt(x, 0, 1); }) || (m[0].length === 2 && m[0][0] === m[0][1])) return { valid: false, reason: 'bad x-ray ' + i };
        t = m[2];
      }
      if (!okMs(t)) return { valid: false, reason: 'impossible timing on item ' + (i + 1) };
      var res = points(it, m);
      score += res.p; minMs += t; if (res.ok) by[it.round]++;
      log.push({ r: it.round, ok: res.ok, p: res.p });
    }
    return { valid: true, done: true, score: score, minMs: minMs, log: log, detail: { r1: by[0], r2: by[1], r3: by[2] } };
  }

  // Best possible: 5×100 + 4×100 + 4×200 = 1700.
  return { id: 'token-chop', VERSION: 2, stars: [680, 1190, 1580], data: data, deck: deck, replay: replay, points: points, cutsOf: cutsOf, tokText: tokText };
}));
