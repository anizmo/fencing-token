/* Fencing Token Arcade: the swipe-card frame (Be the Policy Engine, and later Real or Fake? and Sign Here).
   Card play, swipe/tap/keyboard controls, lives, timer and feedback. Intro, results and leaderboards come from kit.js. */
(function () {
  'use strict';
  var K = window.FTKit, el = K.el, E = window.FTArcade;

  window.FTShell = function (G) {
    var app = document.getElementById('app'), main = document.getElementById('main');
    var S = null, raf = null;
    G.logic = G.logic || window.FTGames[G.id];

    function start() {
      var btn = main.querySelector('.btn'); if (btn) { btn.disabled = true; btn.textContent = 'Starting…'; }
      K.startRun(G.logic).then(function (run) {
        S = { run: run, seed: run.seed, deck: E.deck(run.seed, G.data), i: 0, moves: [], lives: E.RULES.LIVES, score: 0, streak: 0, wrong: [], paused: 0, hiddenAt: 0 };
        run.moves = S.moves;
        roundIntro(0);
      });
    }
    function roundIntro(ri) { K.roundOverlay(main, G.data.rounds, ri, play, Math.round(G.data.rounds[ri].limit / 1000) + ' seconds per card. No answer counts as Deny.'); }

    function hud() {
      var lives = el('div', { class: 'lives', 'aria-label': S.lives + ' lives left' });
      for (var k = 0; k < E.RULES.LIVES; k++) lives.appendChild(el('span', { class: 'life' + (k >= S.lives ? ' lost' : '') }));
      return el('div', { class: 'hud' }, [lives, el('span', { class: 'prog', text: (S.i + 1) + ' / ' + S.deck.length }), el('span', { class: 'score', id: 'score', text: K.fmt(S.score) })]);
    }

    function play() {
      if (S.lives <= 0 || S.i >= S.deck.length) return finish();
      var entry = S.deck[S.i];
      var bar = el('i'), timer = el('div', { class: 'timer', role: 'progressbar', 'aria-label': 'Time left' }, [bar]);
      var card = G.renderCard(entry, el);
      card.classList.add('card');
      card.appendChild(el('span', { class: 'stamp allow', text: G.actions.right.stamp, 'aria-hidden': 'true' }));
      card.appendChild(el('span', { class: 'stamp deny', text: G.actions.left.stamp, 'aria-hidden': 'true' }));
      card.appendChild(el('span', { class: 'stamp ask', text: G.actions.up.stamp, 'aria-hidden': 'true' }));
      var ctl = function (a, cls) { return el('button', { class: 'ctl ' + cls, type: 'button', 'aria-label': a.label, onclick: function () { decide(a.code); } }, [el('span', { class: 'g', text: a.glyph, 'aria-hidden': 'true' }), a.label]); };
      main.replaceChildren(hud(), timer, el('div', { class: 'stage' }, [card]), el('div', { class: 'controls' }, [ctl(G.actions.left, 'deny'), ctl(G.actions.up, 'ask'), ctl(G.actions.right, 'allow')]));
      S.shownAt = performance.now(); S.paused = 0; S.busy = false;
      swipe(card);
      var tick = function () {
        var t = elapsed(), left = Math.max(0, 1 - t / entry.limit);
        bar.style.transform = 'scaleX(' + left + ')'; timer.classList.toggle('low', left < 0.3);
        if (t >= entry.limit) return decide('T');
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }
    function elapsed() { return (S.hiddenAt ? S.hiddenAt : performance.now()) - S.shownAt - S.paused; }
    document.addEventListener('visibilitychange', function () {
      if (!S || S.busy === undefined) return;
      if (document.hidden) S.hiddenAt = performance.now();
      else if (S.hiddenAt) { S.paused += performance.now() - S.hiddenAt; S.hiddenAt = 0; }
    });

    function decide(code) {
      if (!S || S.busy) return;
      S.busy = true; cancelAnimationFrame(raf);
      var entry = S.deck[S.i], action = E.CODE[code];
      var t = code === 'T' ? entry.limit : Math.max(E.RULES.MIN_T, Math.round(elapsed()));
      var ok = E.judge(entry.card, action), p = E.points(entry, action, t, S.streak);
      S.moves.push([code, t]); S.score += p; S.streak = ok ? S.streak + 1 : 0;
      var card = main.querySelector('.card');
      if (card) {
        var dir = code === 'A' ? 1 : code === 'D' ? -1 : 0;
        card.classList.add('anim', ok ? 'flash-ok' : 'flash-bad');
        if (ok) card.style.transform = dir ? 'translateX(' + (dir * 130) + '%) rotate(' + (dir * 18) + 'deg)' : 'translateY(-120%)';
      }
      document.getElementById('score').textContent = K.fmt(S.score);
      if (ok) { if (p) main.querySelector('.stage').appendChild(el('span', { class: 'pts', text: '+' + p })); setTimeout(next, 700); }
      else {
        S.lives--; S.wrong.push({ entry: entry, action: action }); K.vibrate([60, 40, 60]);
        var lv = main.querySelectorAll('.life'); if (lv[S.lives]) lv[S.lives].classList.add('lost');
        setTimeout(function () { feedback(entry, action); }, 380);
      }
    }

    function feedback(entry, action) {
      var c = entry.card, opened = performance.now(), lose = G.loseText ? G.loseText(c, action) : c.lose;
      var sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-label': 'What went wrong' }, [
        el('p', { class: 'big', text: action === 'timeout' ? 'Out of time. Failing closed: Deny.' : lose }),
        action === 'timeout' ? el('p', { class: 'lesson', text: lose }) : null,
        el('p', { class: 'right', text: 'Right answer: ' + G.answerLabel(c.ans) }),
        el('p', { class: 'lesson', text: c.lesson }),
        el('details', { class: 'why' }, [el('summary', { text: 'Why?' }), el('p', { text: G.why(c) }), el('p', {}, [el('a', { href: '/concepts/?lens=everyone#' + c.concept, text: 'This idea, explained three ways →' })])]),
        el('button', { class: 'btn', type: 'button', text: S.lives > 0 ? 'Next card' : 'See your score', onclick: function () { if (performance.now() - opened < E.RULES.PAUSE) return; sheet.remove(); next(); } }),
      ]);
      app.appendChild(sheet);
      setTimeout(function () { var b = sheet.querySelector('.btn'); if (b) b.focus(); }, 60);
    }

    function next() {
      var prevRound = S.deck[S.i].round;
      S.i++;
      if (S.lives <= 0 || S.i >= S.deck.length) return finish();
      if (S.deck[S.i].round !== prevRound) return roundIntro(S.deck[S.i].round);
      play();
    }

    // Swipe: right = allow, left = deny, up = ask. Starts near the screen edge are ignored (iOS back gesture).
    function swipe(card) {
      var sx = 0, sy = 0, dx = 0, dy = 0, on = false, st = { allow: card.querySelector('.stamp.allow'), deny: card.querySelector('.stamp.deny'), ask: card.querySelector('.stamp.ask') };
      card.addEventListener('pointerdown', function (e) {
        if (e.clientX < 24 || e.clientX > window.innerWidth - 24 || S.busy) return;
        on = true; sx = e.clientX; sy = e.clientY; dx = dy = 0; card.setPointerCapture(e.pointerId); card.classList.remove('anim');
      });
      card.addEventListener('pointermove', function (e) {
        if (!on) return;
        dx = e.clientX - sx; dy = e.clientY - sy;
        card.style.transform = 'translate(' + dx + 'px,' + Math.min(0, dy) + 'px) rotate(' + (dx / 18) + 'deg)';
        st.allow.style.opacity = Math.max(0, Math.min(1, dx / 90));
        st.deny.style.opacity = Math.max(0, Math.min(1, -dx / 90));
        st.ask.style.opacity = Math.abs(dx) < 70 ? Math.max(0, Math.min(1, -dy / 90)) : 0;
      });
      var end = function () {
        if (!on) return; on = false;
        if (dx > 90) return decide('A');
        if (dx < -90) return decide('D');
        if (dy < -90 && Math.abs(dx) < 70) return decide('K');
        card.classList.add('anim'); card.style.transform = ''; st.allow.style.opacity = st.deny.style.opacity = st.ask.style.opacity = 0;
      };
      card.addEventListener('pointerup', end); card.addEventListener('pointercancel', end);
    }
    document.addEventListener('keydown', function (e) {
      if (!S || S.busy || !main.querySelector('.card') || e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); decide('A'); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); decide('D'); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); decide('K'); }
    });

    function finish() {
      cancelAnimationFrame(raf);
      var res = E.replay(S.seed, G.data, S.moves);
      var correct = res.log.filter(function (x) { return x.ok; }).length, blocked = res.log.filter(function (x) { return x.ok && x.action !== 'allow'; }).length;
      K.results(main, G, S.run, res, {
        kicker: res.lives > 0 ? 'Run complete' : 'Out of lives', title: res.lives > 0 ? G.winLine : G.loseLine,
        stats: [[correct + '/' + res.played, 'right calls'], [blocked, 'threats stopped'], [res.lives, 'lives left']],
        remember: S.wrong.map(function (w) { return [w.entry.card.lesson, 'Right answer: ' + G.answerLabel(w.entry.card.ans)]; }),
        onAgain: start,
      });
    }

    K.intro(main, G, start);
  };
})();
