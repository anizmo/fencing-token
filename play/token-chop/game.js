/* Token Chop: the find frame. Tap between letters to chop words the way a language model reads them, see why
   tokens decide cost and counting, then X-ray two identical-looking words to catch the disguised one.
   All token splits are illustrative: real tokenizers differ. */
(function () {
  'use strict';
  var K = window.FTKit, el = K.el, L = window.FTGames['token-chop'];
  var main = document.getElementById('main');
  var G = {
    logic: L, title: 'Token Chop', kicker: 'Fencing Token Arcade · Act 2',
    pitch: 'Chatbots do not read letters or words. They read chunks called tokens. Chop words like a model, then catch a word in disguise.',
    meta: '3 rounds · 13 words · about 2 minutes',
    howto: [
      { cls: 'ask', glyph: '1', text: 'Tap between letters to cut a word into tokens' },
      { cls: 'allow', glyph: '2', text: 'Pick which text costs more tokens' },
      { cls: 'deny', glyph: '3', text: 'X-ray lookalike words to find the fake' },
    ],
    nextGame: { href: '/play/the-dial/', title: 'The Dial' },
    shareText: function (s) { return 'I chopped words like a language model and caught the lookalike letters: ' + s + ' points in Token Chop.'; },
    next: [
      { href: '/concepts/?lens=everyone#guardrails', text: 'Guardrails, explained three ways', sub: 'Why a word filter on its own is easy to slip past.' },
      { href: '/concepts/?lens=everyone#prompt-injection', text: 'Prompt injection, explained three ways', sub: 'Hidden text that steers a model.' },
    ],
  };
  var DISCLAIMER = 'Token splits are illustrative. Real tokenizers differ. ␣ marks a space, which usually rides at the start of a token.';
  var S;

  function start() {
    var b = main.querySelector('.btn'); if (b) { b.disabled = true; b.textContent = 'Starting…'; }
    K.startRun(L).then(function (run) {
      S = { run: run, d: L.deck(run.seed), i: 0, moves: [], pts: 0 };
      run.moves = S.moves;
      K.roundOverlay(main, L.data.rounds, 0, show, 'A model reads text as chunks called tokens. Tap the gaps between letters where you think it cuts. Leave a word whole if you think it is one token.');
    });
  }
  var NOTES = [null,
    'Every token costs money and fills the model’s memory limit. Tap the text that takes MORE tokens.',
    'A filter blocks certain words. Scammers disguise them with lookalike or invisible characters. Each pair looks the same. X-ray to see the tokens, then tap the fake. Use one X-ray or none for a bonus.'];

  // A token as a coloured chip. Leading spaces show as ␣; flagged tokens (lookalikes) are red with what they really are.
  function chip(tok, k, delay) {
    var t = L.tokText(tok), flag = typeof tok === 'object' ? tok : null, kids = [];
    if (t.charAt(0) === ' ') { kids.push(el('span', { class: 'sp', 'aria-hidden': 'true', text: '␣' })); t = t.slice(1); }
    kids.push(flag && flag.show ? el('span', { class: 'inv', text: flag.show }) : t);
    var c = el('span', { class: 'tok c' + (k % 5) + (flag ? ' flag' : ''), style: 'animation-delay:' + (delay || 0) + 'ms', title: flag ? flag.f : null }, kids);
    return flag ? el('span', { class: 'tokwrap' }, [c, el('span', { class: 'why', text: flag.f })]) : c;
  }
  function chips(toks, base) { return el('div', { class: 'toks' }, toks.map(function (t, k) { return chip(t, k, (base || 0) + k * 90); })); }
  function count(n) { return el('span', { class: 'count', text: n + (n === 1 ? ' token' : ' tokens') }); }

  function hud(item) {
    var round = L.data.rounds[item.round];
    S.hudScore = el('span', { class: 'score', 'aria-label': 'Score', text: K.fmt(S.pts) });
    return el('div', { class: 'hud' }, [
      el('div', {}, [el('p', { class: 'kicker', style: 'margin:0', text: round.name + ' · ' + round.title }), el('p', { class: 'small', style: 'margin:4px 0 0', text: 'Word ' + (S.i + 1) + ' of ' + S.d.length })]),
      S.hudScore,
    ]);
  }

  function feedback(fb, item, res, big, lesson) {
    S.pts += res.p; S.hudScore.textContent = K.fmt(S.pts);
    K.vibrate(res.ok ? 15 : [10, 40, 10]);
    var last = S.i === S.d.length - 1, endRound = last || S.d[S.i + 1].round !== item.round;
    fb.replaceChildren(el('div', { class: 'feedback' }, [
      el('p', { class: 'big', text: big }),
      el('p', { text: lesson }),
      el('button', { class: 'btn', type: 'button', text: last ? 'See your score' : endRound ? 'Next round' : 'Next word', onclick: function () {
        S.i++;
        if (last) return finish();
        if (endRound) return K.roundOverlay(main, L.data.rounds, S.d[S.i].round, show, NOTES[S.d[S.i].round]);
        show();
      } }),
    ]));
    setTimeout(function () { var b = fb.querySelector('.btn'); if (b) { b.focus(); b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, 80);
  }
  function elapsed(t0) { return Math.max(400, Math.min(120000, Date.now() - t0)); }

  function show() {
    var item = S.d[S.i];
    if (item.kind === 'chop') return chopScreen(item);
    if (item.kind === 'pair') return pairScreen(item);
    return spotScreen(item);
  }

  // ---------------------------------------------------------------- round 1: tap the gaps
  function chopScreen(item) {
    var w = item.w.w, n = w.length, cuts = [], t0 = Date.now(), done = false;
    var size = n > 10 ? 'xs' : n > 7 ? 's' : 'm';
    var strip = el('div', { class: 'strip ' + size, role: 'group', 'aria-label': 'The word ' + w + '. Tap between letters to cut.' });
    var tiles = [], gaps = [];
    for (var i = 0; i < n; i++) {
      if (i > 0) (function (k) {
        var g = el('button', { class: 'gap', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Cut between ' + w.charAt(k - 1) + ' and ' + w.charAt(k), onclick: function () { toggle(k); } }, [el('i', { 'aria-hidden': 'true' })]);
        gaps[k] = g; strip.appendChild(g);
      })(i);
      var t = el('span', { class: 'tile', 'aria-hidden': 'true', text: w.charAt(i) }); tiles.push(t); strip.appendChild(t);
    }
    var mineCount = el('p', { class: 'mine', 'aria-live': 'polite' });
    var go = el('button', { class: 'btn', type: 'button', onclick: chop });
    var reveal = el('div', { class: 'reveal' }), fb = el('div', { 'aria-live': 'polite' });
    function paint() {
      var c = 0;
      tiles.forEach(function (t, k) { if (k > 0 && cuts.indexOf(k) >= 0) c++; t.className = 'tile c' + (c % 5); });
      mineCount.textContent = 'Your chop: ' + (cuts.length + 1) + (cuts.length ? ' tokens' : ' token');
      go.textContent = cuts.length ? 'Chop into ' + (cuts.length + 1) : 'Keep it whole';
    }
    function toggle(k) {
      if (done) return;
      var j = cuts.indexOf(k);
      if (j >= 0) cuts.splice(j, 1); else { cuts.push(k); cuts.sort(function (a, b) { return a - b; }); }
      gaps[k].classList.toggle('on', j < 0); gaps[k].setAttribute('aria-pressed', j < 0 ? 'true' : 'false');
      gaps[k].classList.remove('snap'); void gaps[k].offsetWidth; gaps[k].classList.add('snap');
      K.vibrate(8); paint();
    }
    function chop() {
      if (done) return; done = true;
      var m = [cuts.slice(), elapsed(t0)]; S.moves.push(m);
      var res = L.points(item, m);
      gaps.forEach(function (g, k) {
        if (!g) return; g.disabled = true;
        var model = item.cuts.indexOf(k) >= 0, mine = cuts.indexOf(k) >= 0;
        if (model && mine) g.classList.add('match'); else if (model) g.classList.add('missed'); else if (mine) g.classList.add('extra');
      });
      go.remove();
      reveal.replaceChildren(el('p', { class: 'lbl2' }, ['Model’s chop ', el('span', { class: 'ill', text: '(illustrative)' })]), chips(item.w.toks), count(item.w.toks.length),
        el('p', { class: 'legend', text: '✓ cut matched · ✗ extra cut · ┆ missed cut' }));
      var big = res.ok ? '+100 · Chopped like a model.' : res.p ? '+' + res.p + ' · Close.' + (res.miss ? ' Missed ' + res.miss + ' cut' + (res.miss > 1 ? 's' : '') + '.' : '') + (res.extra ? ' ' + res.extra + ' extra cut' + (res.extra > 1 ? 's' : '') + '.' : '')
        : cuts.length > item.cuts.length + 1 ? 'Diced it. The model takes bigger bites.' : 'No points. Different chop.';
      feedback(fb, item, res, big, item.w.lesson);
    }
    paint();
    main.replaceChildren(el('section', { class: 'screen' }, [hud(item),
      el('p', { class: 'askq', text: 'Where would a model cut?' }),
      el('div', { class: 'chopboard' }, [strip, mineCount]),
      el('div', { class: 'cta static' }, [go]),
      reveal, fb,
      el('p', { class: 'disclaimer', text: DISCLAIMER }),
    ]));
  }

  // ---------------------------------------------------------------- round 2: which costs more?
  function pairScreen(item) {
    var t0 = Date.now(), done = false, fb = el('div', { 'aria-live': 'polite' }), cards = [];
    item.sides.forEach(function (side, k) {
      var box = el('div', { class: 'pchips' });
      var b = el('button', { class: 'pcard', type: 'button', 'aria-label': side.t + ': costs more tokens', onclick: function () { pick(k); } }, [
        el('span', { class: 'ab', text: k ? 'B' : 'A' }), el('span', { class: 'ptext', lang: /[ऀ-ॿ]/.test(side.t) ? 'hi' : 'en', text: side.t }), box]);
      b._box = box; cards.push(b);
    });
    function pick(k) {
      if (done) return; done = true;
      var m = [k, elapsed(t0)]; S.moves.push(m);
      var res = L.points(item, m);
      cards.forEach(function (c, j) {
        c.disabled = true; if (j === k) c.classList.add('mine'); if (j === item.more) c.classList.add('more');
        c._box.replaceChildren(chips(item.sides[j].toks, j * 300), count(item.sides[j].toks.length));
      });
      var a = item.sides[item.more].toks.length, b = item.sides[1 - item.more].toks.length;
      feedback(fb, item, res, res.ok ? '+100 · Right: ' + a + ' tokens vs ' + b + '.' : 'Other one: ' + a + ' tokens vs ' + b + '.', item.p.lesson);
    }
    main.replaceChildren(el('section', { class: 'screen' }, [hud(item),
      el('p', { class: 'askq', text: 'Which costs more tokens?' }),
      el('div', { class: 'pairs' }, cards), fb,
      el('p', { class: 'disclaimer', text: DISCLAIMER }),
    ]));
  }

  // ---------------------------------------------------------------- round 3: spot the disguise
  function spotScreen(item) {
    var t0 = Date.now(), done = false, xrays = [], fb = el('div', { 'aria-live': 'polite' }), cards = [];
    var used = el('span', { class: 'used', text: 'X-rays used: 0' });
    item.sides.forEach(function (side, k) {
      var box = el('div', { class: 'pchips' }), verdict = el('p', { class: 'verdict' });
      var xb = el('button', { class: 'mini xr', type: 'button', text: 'X-ray', 'aria-label': 'X-ray card ' + (k ? 'B' : 'A') + ' to see its tokens', onclick: function () { xray(k); } });
      var fk = el('button', { class: 'mini fk', type: 'button', text: 'This is the fake', 'aria-label': 'Card ' + (k ? 'B' : 'A') + ' is the fake', onclick: function () { pick(k); } });
      var c = el('div', { class: 'scard' }, [el('span', { class: 'ab', text: k ? 'B' : 'A' }), el('p', { class: 'look', text: side.t }), box, verdict, el('div', { class: 'sbtns' }, [xb, fk])]);
      c._box = box; c._xb = xb; c._fk = fk; c._v = verdict; cards.push(c);
    });
    function xray(k) {
      if (done || xrays.indexOf(k) >= 0) return;
      xrays.push(k); used.textContent = 'X-rays used: ' + xrays.length + (xrays.length > 1 ? ' · no bonus' : '');
      var c = cards[k]; c.classList.add('xrayed'); c._xb.disabled = true;
      c._box.replaceChildren(chips(item.sides[k].toks), count(item.sides[k].toks.length));
      K.vibrate(8);
    }
    function pick(k) {
      if (done) return; done = true;
      var m = [xrays.slice(), k, elapsed(t0)]; S.moves.push(m);
      var res = L.points(item, m);
      cards.forEach(function (c, j) {
        c._xb.disabled = true; c._fk.disabled = true;
        if (xrays.indexOf(j) < 0) c._box.replaceChildren(chips(item.sides[j].toks, 150), count(item.sides[j].toks.length));
        var fake = j === item.fake; c.classList.add(fake ? 'isfake' : 'isreal'); if (j === k) c.classList.add('mine');
        c._v.textContent = fake ? '✗ Slips past the filter' : '✓ Blocked by the filter';
      });
      feedback(fb, item, res, res.ok ? '+' + res.p + ' · Caught it' + (res.thrift ? ' with ' + (xrays.length ? 'one X-ray' : 'no X-ray') + '.' : '.') : 'Fooled. ' + (k ? 'B' : 'A') + ' was the real one.', item.q.lesson);
    }
    main.replaceChildren(el('section', { class: 'screen' }, [hud(item),
      el('div', { class: 'filter' }, [el('span', { text: 'Filter blocks:' }), el('b', { text: item.q.filter }), used]),
      el('p', { class: 'askq', text: 'Which one is disguised?' }),
      el('div', { class: 'spots' }, cards), fb,
      el('p', { class: 'disclaimer', text: DISCLAIMER }),
    ]));
  }

  function finish() {
    var res = L.replay(S.run.seed, S.moves), d = res.detail;
    K.results(main, G, S.run, res, {
      title: res.score >= 1580 ? 'You read like a model.' : res.score >= 1190 ? 'You see the chunks now.' : 'Tokens are sneakier than letters.',
      stats: [[d.r1 + '/5', 'perfect chops'], [d.r2 + '/4', 'costs guessed'], [d.r3 + '/4', 'fakes caught']],
      remember: [
        ['Models read tokens, not letters or words.', 'Common words are one token; rare words, names and other scripts break into pieces.'],
        ['Tokens are the bill and the memory limit.', 'The same meaning can cost more tokens in Hindi or Hinglish than in English, depending on the tokenizer.'],
        ['Lookalike and invisible characters change the tokens.', 'To you the text looks the same; to a filter or a model it is different. Normalise text before you check it.'],
        ['The splits in this game were illustrative.', 'Real tokenizers differ from model to model.'],
      ],
      onAgain: start,
    });
  }

  K.intro(main, G, start);
})();
