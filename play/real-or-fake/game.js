/* Real or Fake?: the two-choice swipe-card frame. A chatbot "said" each claim; swipe Real or Fake.
   Three Checks per run let you peek at what a quick search shows, because checking is how you win. */
(function () {
  'use strict';
  var K = window.FTKit, el = K.el, L = window.FTGames['real-or-fake'], R = L.RULES;
  var app = document.getElementById('app'), main = document.getElementById('main');
  var G = {
    logic: L, title: 'Real or Fake?', kicker: 'Fencing Token Arcade · Act 2',
    pitch: 'Chatbots sometimes make things up, and sound completely sure. A chatbot said all of these. Which are real?',
    meta: '3 rounds · 15 claims · about 2 minutes',
    howto: [
      { cls: 'allow', glyph: '✓', text: 'Swipe right if it’s Real' },
      { cls: 'deny', glyph: '✕', text: 'Swipe left if it’s Fake' },
      { cls: 'ask', glyph: '?', text: '3 Checks: peek at a quick search' },
    ],
    nextGame: { href: '/play/meaning-map/', title: 'Meaning Map' },
    shareText: function (s) { return 'A chatbot tried to fool me with fake papers, laws and court cases. I scored ' + s + ' in Real or Fake? Can you spot them?'; },
    next: [
      { href: '/concepts/?lens=everyone#guardrails', text: 'Guardrails, explained three ways', sub: 'Why AI output gets checked before anyone relies on it.' },
    ],
  };
  var NOTES = [
    'A chatbot said each of these. Right for Real, left for Fake. You get 3 Checks for the whole game.',
    'These look almost right. One detail might be off.',
    'Now every claim comes with a source. Looking real is not being real.',
  ];
  var FOOLED = ['You believed it. So did the chatbot.', 'Fooled! It sounded so sure.', 'Hook, line and citation.'];
  var S = null, raf = null;

  function start() {
    var b = main.querySelector('.btn'); if (b) { b.disabled = true; b.textContent = 'Starting…'; }
    K.startRun(L).then(function (run) {
      S = { run: run, d: L.deck(run.seed), i: 0, moves: [], score: 0, streak: 0, checks: R.CHECKS, wrong: [], cur: null };
      run.moves = S.moves;
      K.roundOverlay(main, L.data.rounds, 0, play, NOTES[0]);
    });
  }

  function mult() { return 1 + 0.1 * Math.min(S.streak, 5); }
  function elapsed() { var c = S.cur; return (c.hiddenAt || performance.now()) - c.shownAt - c.paused; }
  document.addEventListener('visibilitychange', function () {
    if (!S || !S.cur || S.cur.busy) return;
    if (document.hidden) S.cur.hiddenAt = performance.now();
    else if (S.cur.hiddenAt) { S.cur.paused += performance.now() - S.cur.hiddenAt; S.cur.hiddenAt = 0; }
  });

  function play() {
    var e = S.d[S.i], c = e.card, round = L.data.rounds[e.round];
    var bar = el('i'), timer = el('div', { class: 'timer', role: 'progressbar', 'aria-label': 'Time left' }, [bar]);
    var hint = el('div', { class: 'rf-hint', 'aria-live': 'polite', hidden: true });
    var card = el('article', { class: 'card rf-card', 'aria-label': 'Claim ' + (S.i + 1) + ' of ' + S.d.length }, [
      el('div', { class: 'rf-top' }, [el('span', { class: 'rf-kind', text: c.kind }), el('span', { class: 'rf-rnd', text: round.name + ' · ' + round.title })]),
      el('div', { class: 'rf-say' }, [
        el('span', { class: 'rf-bot', 'aria-hidden': 'true' }, [el('i'), el('i')]),
        el('div', { class: 'rf-bubble' }, [el('p', { class: 'rf-who', text: 'Chatbot' }), el('p', { class: 'rf-claim', text: c.said })]),
      ]),
      c.cite ? el('div', { class: 'rf-cite' }, [el('p', { class: 'lbl', text: 'Source it gave' }), el('span', { class: 'rf-link', text: c.cite })]) : null,
      hint,
      el('span', { class: 'stamp allow', text: 'REAL', 'aria-hidden': 'true' }),
      el('span', { class: 'stamp deny', text: 'FAKE', 'aria-hidden': 'true' }),
    ]);
    var ctl = function (cls, glyph, label, aria, fn) { return el('button', { class: 'ctl ' + cls, type: 'button', 'aria-label': aria, disabled: true, onclick: fn }, [el('span', { class: 'g', text: glyph, 'aria-hidden': 'true' }), label]); };
    var checkBtn = ctl('ask rf-check', '?', 'Check · ' + S.checks, 'Check: see a quick search (' + S.checks + ' left)', check);
    var controls = el('div', { class: 'controls rf-controls' }, [
      ctl('deny', '✕', 'Fake', 'Fake', function () { decide('F'); }), checkBtn, ctl('allow', '✓', 'Real', 'Real', function () { decide('R'); }),
    ]);
    main.replaceChildren(el('div', { class: 'rf' }, [
      el('div', { class: 'hud' }, [
        el('span', { class: 'prog', text: (S.i + 1) + ' / ' + S.d.length }),
        S.streak ? el('span', { class: 'rf-streak', 'aria-label': 'Streak ' + S.streak + ', points times ' + mult().toFixed(1), text: S.streak + ' in a row · ×' + mult().toFixed(1) }) : null,
        el('span', { class: 'score', id: 'score', text: K.fmt(S.score) }),
      ]),
      timer, el('div', { class: 'stage' }, [card]), controls,
    ]));
    S.cur = { e: e, card: card, hint: hint, controls: controls, checkBtn: checkBtn, shownAt: performance.now(), paused: 0, hiddenAt: 0, busy: false, checked: 0, armed: false };
    swipe(card);
    var tick = function () {
      var t = elapsed(), left = Math.max(0, 1 - t / e.limit);
      bar.style.transform = 'scaleX(' + left + ')'; timer.classList.toggle('low', left < 0.3);
      if (!S.cur.armed && t >= R.MIN_T) {
        S.cur.armed = true;
        controls.querySelectorAll('.ctl').forEach(function (b) { b.disabled = false; });
        if (S.checks <= 0) checkBtn.disabled = true;
      }
      if (t >= e.limit) return decide('T');
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  function check() {
    var cur = S.cur;
    if (!cur || cur.busy || cur.checked) return;
    if (S.checks <= 0) { K.toast('No Checks left. Trust your eye.'); return; }
    S.checks--; cur.checked = 1; cur.checkBtn.disabled = true;
    cur.checkBtn.lastChild.textContent = 'Checked';
    cur.hint.replaceChildren(el('p', { class: 'lbl', text: 'Quick check' }), el('p', { text: cur.e.card.hint }));
    cur.hint.hidden = false; K.vibrate(10);
  }

  function decide(code) {
    var cur = S && S.cur;
    if (!cur || cur.busy) return;
    var e = cur.e, c = e.card, t = code === 'T' ? e.limit : Math.min(e.limit, Math.floor(elapsed()));
    if (code !== 'T' && t < R.MIN_T) return;
    cur.busy = true; cancelAnimationFrame(raf);
    S.moves.push([code, t, cur.checked]);
    var said = code === 'R' ? 'real' : code === 'F' ? 'fake' : null, ok = said === c.ans, p = ok ? L.points(e.round, S.streak) : 0;
    var wasStreak = S.streak;
    S.score += p; S.streak = ok ? S.streak + 1 : 0;
    if (!ok) S.wrong.push(c);
    var card = cur.card, dir = code === 'R' ? 1 : code === 'F' ? -1 : 0;
    card.classList.add('anim', ok ? 'flash-ok' : 'flash-bad');
    card.style.transform = dir ? 'translateX(' + (dir * 14) + 'px) rotate(' + (dir * 2) + 'deg)' : '';
    card.querySelectorAll('.stamp').forEach(function (s) { s.style.opacity = 0; });
    var truth = card.querySelector(c.ans === 'real' ? '.stamp.allow' : '.stamp.deny'); truth.style.opacity = 1; truth.classList.add('rf-truth');
    document.getElementById('score').textContent = K.fmt(S.score);
    K.vibrate(ok ? 15 : [60, 40, 60]);
    if (ok) main.querySelector('.stage').appendChild(el('span', { class: 'pts', text: '+' + p }));
    setTimeout(function () { verdict(cur, said, ok, p, wasStreak); }, 320);
  }

  function verdict(cur, said, ok, p, wasStreak) {
    var c = cur.e.card, last = S.i === S.d.length - 1, endRound = !last && S.d[S.i + 1].round !== cur.e.round, opened = performance.now();
    var big = ok ? (c.ans === 'real' ? 'Real. ' : 'Fake. ') + (wasStreak >= 2 ? 'On a roll.' : 'Good call.')
      : said === null ? 'Out of time. A chatbot never runs out of confidence.'
      : said === 'real' ? FOOLED[S.i % FOOLED.length] : 'It’s real. Doubt is good, but check first.';
    cur.card.classList.add('done'); cur.card.style.transform = '';
    var panel = el('div', { class: 'rf-verdict ' + (ok ? 'ok' : 'bad'), role: 'status' }, [
      el('p', { class: 'rf-v-big' }, [el('span', { class: 'rf-v-ic', 'aria-hidden': 'true', text: ok ? '✓' : '✕' }), big + (ok ? ' +' + p : '')]),
      el('p', { class: 'rf-src', text: c.src }),
      el('p', { class: 'rf-lesson', text: c.lesson }),
      cur.checked ? null : el('details', { class: 'why rf-how' }, [el('summary', { text: 'Check the source' }), el('p', { text: 'A quick search shows: ' + c.hint })]),
      el('button', { class: 'btn', type: 'button', text: last ? 'See your score' : endRound ? 'Next round' : 'Next claim', onclick: function () {
        if (performance.now() - opened < R.PAUSE) return;
        next();
      } }),
    ]);
    cur.controls.replaceWith(panel);
    setTimeout(function () { var b = panel.querySelector('.btn'); if (b) b.focus(); }, 60);
  }

  function next() {
    var prev = S.d[S.i].round;
    S.i++; S.cur = null;
    if (S.i >= S.d.length) return finish();
    if (S.d[S.i].round !== prev) return K.roundOverlay(main, L.data.rounds, S.d[S.i].round, play, NOTES[S.d[S.i].round]);
    play();
  }

  // Swipe: right = Real, left = Fake. Starts near the screen edge are ignored (iOS back gesture).
  function swipe(card) {
    var sx = 0, dx = 0, on = false, st = { r: card.querySelector('.stamp.allow'), f: card.querySelector('.stamp.deny') };
    card.addEventListener('pointerdown', function (e) {
      if (!S.cur || S.cur.busy || !S.cur.armed || e.clientX < 24 || e.clientX > window.innerWidth - 24) return;
      on = true; sx = e.clientX; dx = 0; card.setPointerCapture(e.pointerId); card.classList.remove('anim');
    });
    card.addEventListener('pointermove', function (e) {
      if (!on) return;
      dx = e.clientX - sx;
      card.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 20) + 'deg)';
      st.r.style.opacity = Math.max(0, Math.min(1, dx / 90)); st.f.style.opacity = Math.max(0, Math.min(1, -dx / 90));
    });
    var end = function () {
      if (!on) return; on = false;
      if (dx > 90) return decide('R');
      if (dx < -90) return decide('F');
      card.classList.add('anim'); card.style.transform = ''; st.r.style.opacity = st.f.style.opacity = 0;
    };
    card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  }
  document.addEventListener('keydown', function (e) {
    if (!S || !S.cur || S.cur.busy || !S.cur.armed || e.target.tagName === 'INPUT') return;
    if (e.key === 'ArrowRight') { e.preventDefault(); decide('R'); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); decide('F'); }
    else if (e.key === 'ArrowDown' || e.key === 'c') { e.preventDefault(); check(); }
  });

  function finish() {
    cancelAnimationFrame(raf);
    var res = L.replay(S.run.seed, S.moves), d = res.detail, stars = K.starsFor(L, res.score);
    var remember = S.wrong.slice(0, 3).map(function (c) { return [c.lesson, c.src]; });
    remember.push(['Fluent is not true.', 'A chatbot predicts likely words. It sounds just as sure when it is wrong. That is called hallucination.']);
    remember.push(['Check the source yourself.', 'Open the link, search the case name, check the date. It takes seconds, and you used ' + d.checks + ' of 3 Checks.']);
    K.results(main, G, S.run, res, {
      title: stars === 3 ? 'Nothing gets past you.' : stars === 2 ? 'Sharp, but a few fooled you.' : 'The chatbot fooled you. It fools everyone.',
      stats: [[d.right + '/' + res.total, 'right calls'], [d.fooled, 'fakes believed'], [d.checks + '/' + R.CHECKS, 'Checks used']],
      remember: remember, onAgain: start,
    });
  }

  K.intro(main, G, start);
})();
