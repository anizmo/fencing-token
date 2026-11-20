/* Sign Here: the approval-queue card frame. An AI agent sends requests on a schedule; they pile up while a
   shift clock runs. Approve or Reject the top one. The summary is friendly; the exact action is what runs. */
(function () {
  'use strict';
  var K = window.FTKit, el = K.el, L = window.FTGames['sign-here'], RU = L.RULES;
  var app = document.getElementById('app'), main = document.getElementById('main');
  var G = {
    logic: L, title: 'Sign Here', kicker: 'Fencing Token Arcade · Act 4',
    pitch: 'Your AI assistant runs the Robotics Club. It needs your OK, again and again. Catch the bad requests before they run.',
    meta: '3 rounds · 32 requests · about 2 minutes',
    howto: [
      { cls: 'allow', glyph: '✓', text: 'Approve if the exact action is fine' },
      { cls: 'deny', glyph: '✕', text: 'Reject if anything is off' },
      { cls: 'ask', glyph: '!', text: 'Read the action, not just the summary' },
    ],
    nextGame: { href: '/play/cheat-this-leaderboard/', title: 'Cheat This Leaderboard' },
    shareText: function (s) { return 'An AI agent flooded me with approval requests. I scored ' + s + ' in Sign Here. Would you have caught the bad ones?'; },
    next: [
      { href: '/concepts/?lens=everyone#human-approval', text: 'Human approval, explained three ways', sub: 'When a human yes helps, and when it is just a rubber stamp.' },
      { href: '/concepts/?lens=everyone#policy-engine', text: 'Policy engines, explained three ways', sub: 'Let rules handle the routine, so humans see only what matters.' },
    ],
  };
  var NOTES = [
    'Approve the fine ones, reject the bad ones. The shift lasts 30 seconds.',
    'More requests, less time between them. 32 seconds.',
    'Rush hour. 40 seconds. Keep reading the action.',
  ];
  var S = null, R = null, raf = null;

  function start() {
    var b = main.querySelector('.btn'); if (b) { b.disabled = true; b.textContent = 'Starting…'; }
    K.startRun(L).then(function (run) {
      S = { run: run, d: L.deck(run.seed), moves: [], score: 0, harms: 0, harmed: [], burstSheet: false, no: RU.FIRST_NO };
      run.moves = S.moves;
      K.roundOverlay(main, L.data.rounds, 0, function () { round(0); }, NOTES[0]);
    });
  }

  // ---------------------------------------------------------------- game clock (paused for sheets and hidden tabs)
  function gnow() { return (R.pauseAt || performance.now()) - R.start - R.paused; }
  function pause() { if (R && !R.pauseAt) R.pauseAt = performance.now(); if (R) R.holds++; }
  function resume() { if (!R) return; R.holds = Math.max(0, R.holds - 1); if (!R.holds && R.pauseAt) { R.paused += performance.now() - R.pauseAt; R.pauseAt = 0; } }
  document.addEventListener('visibilitychange', function () { if (!R || R.ended) return; if (document.hidden) pause(); else resume(); });

  function round(ri) {
    var D = S.d[ri];
    S.moves.push([]);
    R = { ri: ri, D: D, n: D.cards.length, decided: 0, cur: null, lastT: null, start: performance.now(), paused: 0, pauseAt: 0, holds: 0, ended: false, waiting: 0, caught: 0, harms: 0, base: S.no };
    var bar = el('i');
    R.ui = {
      queue: el('span', { class: 'sh-q', 'aria-live': 'polite' }, [el('b', { text: '0' }), ' waiting']),
      harm: el('span', { class: 'sh-harm', text: 'Harm ' + S.harms }),
      score: el('span', { class: 'score', text: K.fmt(S.score) }),
      bar: bar, secs: el('span', { class: 'sh-secs', text: Math.round(D.dur / 1000) + 's' }),
      timer: el('div', { class: 'timer sh-timer', role: 'progressbar', 'aria-label': 'Shift time left' }, [bar]),
      stage: el('div', { class: 'stage sh-stage' }),
      ribbon: el('div', { class: 'sh-ribbon', 'aria-live': 'polite' }),
      rej: el('button', { class: 'ctl deny', type: 'button', 'aria-label': 'Reject', disabled: true, onclick: function () { decide('R'); } }, [el('span', { class: 'g', text: '✕', 'aria-hidden': 'true' }), 'Reject']),
      app: el('button', { class: 'ctl allow', type: 'button', 'aria-label': 'Approve', disabled: true, onclick: function () { decide('A'); } }, [el('span', { class: 'g', text: '✓', 'aria-hidden': 'true' }), 'Approve']),
    };
    var u = R.ui;
    main.replaceChildren(el('div', { class: 'sh' }, [
      el('div', { class: 'hud' }, [u.queue, u.harm, u.score]),
      el('div', { class: 'sh-clock' }, [u.timer, u.secs]),
      u.stage, u.ribbon,
      el('div', { class: 'controls sh-controls' }, [u.rej, u.app]),
    ]));
    empty();
    raf = requestAnimationFrame(tick);
  }

  function tick() {
    if (!R || R.ended) return;
    var g = gnow(), D = R.D, u = R.ui;
    var arrived = 0; while (arrived < R.n && D.arr[arrived] <= g) arrived++;
    var waiting = arrived - R.decided;
    if (waiting !== R.waiting) {
      u.queue.firstChild.textContent = String(waiting);
      if (waiting > R.waiting) { u.queue.classList.remove('bump'); void u.queue.offsetWidth; u.queue.classList.add('bump'); }
      u.queue.classList.toggle('hot', waiting >= 4);
      R.waiting = waiting; drawPile();
    }
    var left = Math.max(0, 1 - g / D.dur);
    u.bar.style.transform = 'scaleX(' + left + ')'; u.timer.classList.toggle('low', left < 0.25);
    u.secs.textContent = Math.ceil(Math.max(0, D.dur - g) / 1000) + 's';
    if (g >= D.dur) return endRound(D.dur);
    if (!R.cur && R.decided < R.n && D.arr[R.decided] <= g && (R.lastT === null || g >= R.lastT + RU.ANIM)) show(g);
    var cur = R.cur;
    if (cur && !cur.armed && g - cur.shownAt >= RU.MIN_READ) {
      cur.armed = true; u.rej.disabled = u.app.disabled = false; cur.node.classList.add('armed');
      if (cur.c.mut) mutate(cur);
    }
    raf = requestAnimationFrame(tick);
  }

  function empty() {
    R.ui.stage.replaceChildren(el('div', { class: 'sh-empty' }, [el('p', { text: R.decided ? 'Inbox clear.' : 'Shift starting…' }), el('p', { class: 'small', text: 'Waiting for the agent…' })]));
  }
  function drawPile() {
    var stage = R.ui.stage, old = stage.querySelectorAll('.sh-back');
    old.forEach(function (n) { n.remove(); });
    var behind = Math.min(3, Math.max(0, R.waiting - (R.cur ? 1 : 0)));
    for (var k = behind; k >= 1; k--) stage.insertBefore(el('div', { class: 'sh-back', style: 'transform:translateY(' + (k * 7) + 'px) scale(' + (1 - k * 0.035) + ');opacity:' + (1 - k * 0.22), 'aria-hidden': 'true' }), stage.firstChild);
  }

  function show(g) {
    var c = R.D.cards[R.decided], no = S.no++;
    var act = el('pre', { class: 'act sh-act', text: c.act });
    var badge = el('span', { class: 'sh-edit', hidden: true, text: '✎ Edited just now' });
    var node = el('article', { class: 'card sh-card' + (c.burst ? ' burst' : ''), 'aria-label': 'Approval request ' + no }, [
      el('div', { class: 'sh-from' }, [el('span', { class: 'sh-av', 'aria-hidden': 'true', text: 'AI' }), el('span', { class: 'sh-who', text: c.from || 'Club agent' }), el('span', { class: 'sh-no', text: 'Request #' + no })]),
      el('div', {}, [el('p', { class: 'lbl', text: 'Summary' }), el('p', { class: 'sh-sum', text: c.sum })]),
      el('div', {}, [el('p', { class: 'lbl' }, ['Exact action ', badge]), act]),
      el('div', { class: 'sh-arm', 'aria-hidden': 'true' }, [el('i')]),
      el('span', { class: 'stamp allow', text: 'SIGNED', 'aria-hidden': 'true' }),
      el('span', { class: 'stamp deny', text: 'REJECTED', 'aria-hidden': 'true' }),
    ]);
    R.cur = { c: c, node: node, act: act, badge: badge, shownAt: g, armed: false, busy: false, mutated: false };
    R.ui.stage.replaceChildren(node); drawPile();
    swipe(node);
  }

  function mutate(cur) {
    cur.mutated = true;
    cur.act.textContent = cur.c.act2; cur.act.classList.add('changed'); cur.badge.hidden = false; K.vibrate(8);
  }

  function ribbon(text, cls) {
    var r = R.ui.ribbon; r.className = 'sh-ribbon show ' + cls; r.textContent = text;
    clearTimeout(R.ribT); R.ribT = setTimeout(function () { r.className = 'sh-ribbon'; r.textContent = ''; }, 1900);
  }
  function setScore() { R.ui.score.textContent = K.fmt(S.score); R.ui.harm.textContent = 'Harm ' + S.harms; R.ui.harm.classList.toggle('on', S.harms > 0); }

  function decide(code) {
    var cur = R && R.cur;
    if (!cur || cur.busy || !cur.armed || R.ended) return;
    var g = gnow(); if (g >= R.D.dur) return;
    var t = Math.floor(g), c = cur.c, rm = S.moves[R.ri];
    cur.busy = true; R.ui.rej.disabled = R.ui.app.disabled = true;
    rm.push([code, t]); R.decided++; R.lastT = t;
    var sheet = false;
    if (c.bad) {
      if (code === 'R') { S.score += c.pts; R.caught++; ribbon('+' + c.pts + ' · ' + c.catch, 'ok'); K.vibrate(15); }
      else {
        S.score -= RU.HARM; S.harms++; R.harms++; if (S.harmed.indexOf(c) < 0) S.harmed.push(c); K.vibrate([60, 40, 60]);
        if (!c.burst || !S.burstSheet) { sheet = true; if (c.burst) S.burstSheet = true; }
        else ribbon('−' + RU.HARM + ' · ' + c.boom, 'bad');
      }
    } else if (code === 'A') { S.score += RU.GOOD; ribbon('+' + RU.GOOD, 'plain'); }
    else { S.score += RU.REJECT_GOOD; ribbon(RU.REJECT_GOOD + ' · That one was fine. ' + c.fine, 'warn'); K.vibrate(20); }
    setScore();
    var node = cur.node, dir = code === 'A' ? 1 : -1, okCall = c.bad ? code === 'R' : code === 'A';
    node.classList.add('anim', okCall ? 'flash-ok' : 'flash-bad');
    node.querySelector(code === 'A' ? '.stamp.allow' : '.stamp.deny').style.opacity = 1;
    var last = R.decided === R.n;
    if (last) { R.ended = true; rm.push(['E', t]); cancelAnimationFrame(raf); }
    var after = function () {
      if (last) return roundOver();
      R.cur = null; empty(); drawPile();
    };
    if (sheet) { pause(); setTimeout(function () { harmSheet(c, function () { resume(); fly(node, dir, after); }); }, 380); }
    else fly(node, dir, after);
  }
  function fly(node, dir, then) {
    node.style.transform = 'translateX(' + (dir * 130) + '%) rotate(' + (dir * 16) + 'deg)';
    setTimeout(then, 260);
  }

  function harmSheet(c, done) {
    var opened = performance.now();
    var sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-label': 'What went wrong' }, [
      el('p', { class: 'big', text: c.boom }),
      el('p', { class: 'right', text: 'The summary said: ' + c.sum }),
      el('p', { class: 'lbl sh-lbl', text: 'What actually ran' }),
      el('pre', { class: 'act sh-act', text: c.act2 || c.act }),
      el('p', { class: 'lesson', text: c.lesson }),
      el('button', { class: 'btn', type: 'button', text: 'Back to the pile', onclick: function () { if (performance.now() - opened < RU.SHEET) return; sheet.remove(); done(); } }),
    ]);
    app.appendChild(sheet);
    setTimeout(function () { var b = sheet.querySelector('.btn'); if (b) b.focus(); }, 60);
  }

  function endRound(tEnd) {
    if (R.ended) return;
    R.ended = true; cancelAnimationFrame(raf);
    S.moves[R.ri].push(['E', tEnd]);
    var skipped = R.n - R.decided; S.no = R.base + R.n;
    if (R.cur) { R.cur.busy = true; R.cur.node.classList.add('expired'); }
    R.ui.rej.disabled = R.ui.app.disabled = true;
    ribbon('Shift over. ' + skipped + ' request' + (skipped === 1 ? '' : 's') + ' expired.', 'warn');
    setTimeout(roundOver, 1100);
  }

  function roundOver() {
    var ri = R.ri, expired = R.n - R.decided, sum = 'Last shift: ' + R.caught + ' caught, ' + R.harms + ' slipped through, ' + expired + ' expired. ';
    if (ri >= 2) return finish();
    K.roundOverlay(main, L.data.rounds, ri + 1, function () { round(ri + 1); }, sum + NOTES[ri + 1]);
  }

  // Swipe: right = Approve, left = Reject. Starts near the screen edge are ignored (iOS back gesture).
  function swipe(card) {
    var sx = 0, dx = 0, on = false, st = { a: card.querySelector('.stamp.allow'), r: card.querySelector('.stamp.deny') };
    card.addEventListener('pointerdown', function (e) {
      if (!R || !R.cur || R.cur.busy || !R.cur.armed || e.clientX < 24 || e.clientX > window.innerWidth - 24) return;
      on = true; sx = e.clientX; dx = 0; card.setPointerCapture(e.pointerId); card.classList.remove('anim');
    });
    card.addEventListener('pointermove', function (e) {
      if (!on) return;
      dx = e.clientX - sx;
      card.style.transform = 'translateX(' + dx + 'px) rotate(' + (dx / 20) + 'deg)';
      st.a.style.opacity = Math.max(0, Math.min(1, dx / 90)); st.r.style.opacity = Math.max(0, Math.min(1, -dx / 90));
    });
    var end = function () {
      if (!on) return; on = false;
      if (dx > 90) return decide('A');
      if (dx < -90) return decide('R');
      card.classList.add('anim'); card.style.transform = ''; st.a.style.opacity = st.r.style.opacity = 0;
    };
    card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
  }
  document.addEventListener('keydown', function (e) {
    if (!R || !R.cur || e.target.tagName === 'INPUT' || document.querySelector('.sheet')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); decide('A'); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); decide('R'); }
  });

  function finish() {
    cancelAnimationFrame(raf); R = null;
    var res = L.replay(S.run.seed, S.moves), d = res.detail, stars = K.starsFor(L, res.score);
    var seen = {}, remember = [];
    S.harmed.forEach(function (c) { if (!seen[c.lesson] && remember.length < 3) { seen[c.lesson] = 1; remember.push([c.lesson, 'You approved: “' + c.sum + '”']); } });
    remember.push(['A yes only helps if it is bound to the exact action.', 'If the action changes after you read it, the old yes should not count.']);
    remember.push(['Floods of requests make people click yes.', 'Fewer, clearer asks beat more asks. Let a policy engine handle the routine ones.']);
    K.results(main, G, S.run, res, {
      title: stars === 3 ? 'Nothing slipped past your signature.' : d.harms === 0 ? 'Nothing slipped through. The pile did.' : 'The pile won this time.',
      stats: [[d.caught + '/' + d.bad, 'bad ones caught'], [d.harms, 'slipped through'], [d.expiredGood + d.expiredBad, 'expired']],
      remember: remember, onAgain: start,
    });
  }

  K.intro(main, G, start);
})();
