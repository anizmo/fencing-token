/* The Five Librarians: the pick frame. Five kinds of RAG as five librarians. Name what each one did, send the
   right one for each question, then find out that none of them can spot a planted page. */
(function () {
  'use strict';
  var K = window.FTKit, el = K.el, L = window.FTGames['five-librarians'], D = L.data, LIB = D.librarians;
  var main = document.getElementById('main'), NS = 'http://www.w3.org/2000/svg';
  var COL = { basic: '#7FB2FF', hybrid: '#6FD3A2', graph: '#C9A2FF', agentic: '#F4A62A', corrective: '#FF8A8D' };
  var G = {
    logic: L, title: 'The Five Librarians', kicker: 'Fencing Token Arcade · Act 3',
    pitch: 'RAG means an AI looks things up before it answers. There are five main ways to look things up. Meet them as five librarians, and send the right one for each question.',
    meta: '3 rounds · 14 questions · about 3 minutes',
    howto: [
      { cls: 'ask', glyph: '1', text: 'Name the librarian from what it did' },
      { cls: 'allow', glyph: '2', text: 'Send the right librarian for each question' },
      { cls: 'deny', glyph: '3', text: 'Then a page with hidden orders turns up' },
    ],
    nextGame: { href: '/play/plug-it-in/', title: 'Plug It In' },
    shareText: function (s) { return 'I learned the 5 types of RAG as 5 librarians and scored ' + s + ' in The Five Librarians. Your turn:'; },
    next: [
      { href: '/concepts/?lens=everyone#types-of-rag', text: 'The 5 types of RAG, explained three ways', sub: 'For everyone, for engineers, for experts.' },
      { href: '/concepts/?lens=everyone#rag-retrieval-augmented-generation', text: 'RAG, explained three ways', sub: 'The idea underneath all five.' },
    ],
  };
  var S;

  function svg(tag, attrs, kids) { var n = document.createElementNS(NS, tag); for (var k in attrs) n.setAttribute(k, attrs[k]); (kids || []).forEach(function (c) { n.appendChild(c); }); return n; }
  function icon(id, size) {
    var c = COL[id], s = size || 40, kids;
    if (id === 'basic') kids = [svg('rect', { x: 7, y: 10, width: 7, height: 22, rx: 1.5, fill: c }), svg('rect', { x: 16, y: 7, width: 7, height: 25, rx: 1.5, fill: c, opacity: .75 }), svg('rect', { x: 25, y: 12, width: 7, height: 20, rx: 1.5, fill: c, opacity: .55, transform: 'rotate(8 28 22)' })];
    else if (id === 'hybrid') kids = [svg('circle', { cx: 17, cy: 17, r: 9, fill: 'none', stroke: c, 'stroke-width': 3.5 }), svg('path', { d: 'M24 24 L33 33', stroke: c, 'stroke-width': 4, 'stroke-linecap': 'round' }), svg('path', { d: 'M13 17h8M17 13v8', stroke: c, 'stroke-width': 2.5, 'stroke-linecap': 'round' })];
    else if (id === 'graph') kids = [svg('path', { d: 'M10 12 L28 10 L30 28 L12 29 Z M10 12 L30 28', stroke: c, 'stroke-width': 2, fill: 'none', opacity: .7 })].concat([[10, 12], [28, 10], [30, 28], [12, 29]].map(function (p) { return svg('circle', { cx: p[0], cy: p[1], r: 4.5, fill: c }); }));
    else if (id === 'agentic') kids = [svg('path', { d: 'M30 20a10 10 0 1 1-4-8', fill: 'none', stroke: c, 'stroke-width': 3.5, 'stroke-linecap': 'round' }), svg('path', { d: 'M27 5 L27 13 L19 12', fill: 'none', stroke: c, 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })];
    else kids = [svg('circle', { cx: 20, cy: 20, r: 13, fill: 'none', stroke: c, 'stroke-width': 3.5 }), svg('path', { d: 'M13.5 20.5 L18 25 L27 15', fill: 'none', stroke: c, 'stroke-width': 3.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' })];
    return svg('svg', { viewBox: '0 0 40 40', width: s, height: s, 'aria-hidden': 'true', class: 'fl-ic' }, kids);
  }
  function libCard(id) {
    return el('div', { class: 'fl-meet', style: '--c:' + COL[id] }, [icon(id, 40), el('div', {}, [el('b', { text: LIB[id].name }), el('span', { text: LIB[id].role })])]);
  }

  G.learnLabel = 'Meet the librarians';
  G.learn = [
    { title: 'RAG, in one line', text: 'Before an AI answers, it looks up a few pages and answers from them. The five librarians are five ways to do the looking up.',
      art: function () { return K.flow([['Question', 'What does error PRT-4021 mean?'], ['A librarian looks things up', 'in the college’s pages', 'hot'], ['The AI reads what it brings', ''], ['Answer, with sources', '', 'ok']]); } },
  ].concat(L.LIBS.map(function (id) {
    return { title: LIB[id].name + ' RAG', text: LIB[id].how, art: function (el) { return el('div', {}, [libCard(id)]); } };
  }));

  function start() {
    var b = main.querySelector('.btn'); if (b) { b.disabled = true; b.textContent = 'Starting…'; }
    K.startRun(L).then(function (run) {
      S = { run: run, d: L.deck(run.seed), i: 0, moves: [], pts: 0 };
      run.moves = S.moves;
      K.roundOverlay(main, D.rounds, 0, meet, 'A student’s question goes to a librarian, who looks things up for the AI. Each librarian looks in a different way.');
    });
  }

  function meet() {
    main.replaceChildren(el('section', { class: 'screen' }, [
      el('p', { class: 'kicker', text: 'Round 1 · Meet them' }),
      el('h2', { class: 'fl-h', text: 'Your five librarians' }),
      el('div', { class: 'fl-meets' }, L.LIBS.map(libCard)),
      el('div', { class: 'cta static' }, [el('button', { class: 'btn', type: 'button', text: 'I’ve met them. Start', onclick: show })]),
    ]));
  }

  function show() {
    var item = S.d[S.i], q = item.q, round = D.rounds[item.round], picked = false, t0 = performance.now();
    var hidden = 0, hiddenAt = 0, vis = function () { if (document.hidden) hiddenAt = performance.now(); else if (hiddenAt) { hidden += performance.now() - hiddenAt; hiddenAt = 0; } };
    document.addEventListener('visibilitychange', vis);
    var body = item.round === 0
      ? el('ol', { class: 'fl-steps' }, q.steps.map(function (s) { return el('li', { text: s }); }))
      : el('p', { class: 'lquote fl-ask', text: q.ask });
    var btns = item.opts.map(function (id, k) {
      var kids = item.round === 2
        ? [el('span', { class: 'fl-letter', 'aria-hidden': 'true', text: String.fromCharCode(65 + k) }), el('span', { class: 'fl-tx' }, [el('b', { text: q.opts.filter(function (o) { return o[0] === id; })[0][1] })])]
        : [icon(id, 32), el('span', { class: 'fl-tx' }, [el('b', { text: LIB[id].name }), item.round === 0 ? el('span', { text: LIB[id].role }) : null])];
      return el('button', { class: 'fl-opt' + (item.round === 2 ? ' txt' : ''), type: 'button', 'data-id': id, style: item.round === 2 ? '' : '--c:' + COL[id], onclick: function () { pick(k); } }, kids);
    });
    var fb = el('div', { 'aria-live': 'polite' });
    var score = el('span', { class: 'score', 'aria-label': 'Score', text: K.fmt(S.pts) });
    main.replaceChildren(el('section', { class: 'screen' }, [
      el('div', { class: 'hud' }, [el('div', {}, [el('p', { class: 'kicker', style: 'margin:0', text: round.name + ' · ' + round.title }), el('p', { class: 'small', style: 'margin:4px 0 0', text: 'Question ' + (S.i + 1) + ' of ' + S.d.length })]), score]),
      el('p', { class: 'fl-lead', text: q.lead }), body,
      el('div', { class: 'fl-opts' + (item.round === 2 ? ' txt' : '') }, btns),
      fb,
    ]));

    function pick(k) {
      if (picked) return; picked = true;
      document.removeEventListener('visibilitychange', vis);
      var ms = Math.round(Math.min(L.MAX_MS, Math.max(L.MIN_MS, performance.now() - t0 - hidden)));
      S.moves.push([k, ms]);
      var p = L.points(item, k), best = item.opts[k] === q.ans; S.pts += p; score.textContent = K.fmt(S.pts);
      K.vibrate(best ? 15 : [10, 40, 10]);
      btns.forEach(function (b, j) { b.disabled = true; if (item.opts[j] === q.ans) b.classList.add('right'); else if (j === k) b.classList.add(p ? 'close' : 'wrong'); });
      var ansName = item.round === 2 ? q.opts.filter(function (o) { return o[0] === q.ans; })[0][1] : LIB[q.ans].name;
      var big = best ? '+' + p + ' · ' + (item.round === 2 ? 'Right.' : 'Right: ' + ansName + '.') : p ? '+' + p + ' · Close. Best: ' + ansName + '.' : (item.round === 2 ? 'Not quite.' : 'Not quite. It was ' + ansName + '.');
      var last = S.i === S.d.length - 1, endRound = last || S.d[S.i + 1].round !== item.round;
      var nxt = el('button', { class: 'btn', type: 'button', disabled: true, text: last ? 'See your score' : endRound ? 'Next round' : 'Next question', onclick: function () {
        S.i++;
        if (last) return finish();
        if (endRound) return K.roundOverlay(main, D.rounds, S.d[S.i].round, show, S.d[S.i].round === 1 ? 'Now you pick. Read each question and send the librarian who fits it best. Close calls score a little.' : 'Twist: anyone can add pages to the college’s pile. One of them carries orders.');
        show();
      } });
      fb.replaceChildren(el('div', { class: 'feedback' }, [
        el('p', { class: 'big', text: big }),
        el('p', { text: q.why }),
        item.round === 1 ? el('p', { class: 'small' }, [el('b', { text: LIB[q.ans].name + ': ' }), LIB[q.ans].how]) : null,
        nxt,
      ]));
      setTimeout(function () { nxt.disabled = false; nxt.focus(); nxt.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 700);
    }
  }

  function finish() {
    var res = L.replay(S.run.seed, S.moves), d = res.detail;
    K.results(main, G, S.run, res, {
      title: res.score >= L.stars[2] ? 'You know your librarians.' : d.r3 < 3 ? 'Good librarians. Sneaky pages.' : 'You’re getting to know them.',
      stats: [[d.r1 + '/5', 'librarians named'], [d.r2 + '/6', 'best librarian sent'], [d.r3 + '/3', 'twist answers']],
      remember: [
        ['Basic and hybrid fetch pages.', 'Hybrid also matches exact words, so it finds codes and section numbers.'],
        ['Graph answers about a whole collection.', 'It builds a map of topics before anyone asks.'],
        ['Agentic and corrective search more than once.', 'Agentic plans its next search; corrective checks its results and can say “not found”.'],
        ['None of them checks honesty.', 'A planted page that looks relevant gets through. The fence is around retrieval: approved sources, visible sources, no actions from page text.'],
      ],
      onAgain: start,
    });
  }

  K.intro(main, G, start);
})();
