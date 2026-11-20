/* Cheat This Leaderboard: the sandbox frame. You are the attacker. Try real tricks against this arcade's
   own leaderboard and predict which server-side fence stops each one. Then find the one trick that works. */
(function () {
  'use strict';
  var K = window.FTKit, el = K.el, L = window.FTGames['cheat-this-leaderboard'];
  var main = document.getElementById('main'), F = L.data.fences;
  var G = {
    logic: L, title: 'Cheat This Leaderboard', kicker: 'Fencing Token Arcade · Act 4 finale',
    pitch: 'This time you’re the attacker. Try every trick to cheat this arcade’s real leaderboard, and guess which fence on the server stops you.',
    meta: '3 rounds · 13 tricks · about 2 minutes',
    howto: [
      { cls: 'deny', glyph: '1', text: 'Read the trick in the hacker console' },
      { cls: 'ask', glyph: '2', text: 'Pick the fence that stops it' },
      { cls: 'allow', glyph: '3', text: 'Right and fast scores most' },
    ],
    nextGame: { href: '/play/', title: 'the full path' },
    shareText: function (s) { return 'I tried to cheat the Fencing Token Arcade leaderboard and scored ' + s + '. The server said no every time. Your turn:'; },
    next: [
      { href: '/concepts/?lens=everyone#complete-mediation', text: 'Complete mediation, explained three ways', sub: 'Check every request, where the action happens.' },
      { href: '/concepts/?lens=everyone#fencing-token', text: 'The fencing token, explained three ways', sub: 'The idea this whole site is named after.' },
    ],
  };
  var S, tick = null;

  function start() {
    var b = main.querySelector('.btn'); if (b) { b.disabled = true; b.textContent = 'Starting…'; }
    K.startRun(L).then(function (run) {
      S = { run: run, d: L.deck(run.seed), i: 0, moves: [], pts: 0, sent: {} };
      run.moves = S.moves;
      K.roundOverlay(main, L.data.rounds, 0, show, 'The scores on this arcade’s leaderboard are checked by a server. Try to cheat it. For each trick, pick the fence you think stops it.');
    });
  }

  function line(prompt, text, cls) { return el('p', { class: 'cht-l ' + (cls || '') }, [prompt ? el('span', { class: 'p', text: prompt }) : null, el('span', { class: 'c', text: text })]); }
  function b64u(s) { return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }

  // One real, harmless request for a few tricks, only when the leaderboard server is configured.
  function liveRequest(kind) {
    if (!K.api() || S.sent[kind]) return null;
    if (kind === 'forge') { S.sent[kind] = 1; return K.post('/arcade/submit', { token: b64u(JSON.stringify({ k: 'r', g: L.id, v: L.VERSION, s: 7, i: Date.now(), r: 'f0f0f0f0f0f0f0f0', p: '0123456789abcdef' })) + '.' + b64u('forged-signature'), moves: [] }); }
    if (kind === 'score' && S.run.token) { S.sent[kind] = 1; return K.post('/arcade/submit', { token: S.run.token, moves: S.moves.slice(), score: 999999 }); }
    if (kind === 'name' && K.player()) { S.sent[kind] = 1; return K.post('/arcade/name', { player: K.player(), name: 'ADMIN' }); }
    return null;
  }

  function show() {
    var item = S.d[S.i], t = item.t, round = L.data.rounds[item.round], picked = false;
    var t0 = performance.now(), hiddenAt = 0, paused = 0;
    var term = el('div', { class: 'cht-term', role: 'group', 'aria-label': 'Hacker console' }, [
      el('div', { class: 'cht-bar', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i'), el('span', { text: 'attacker@your-laptop' })]),
      line('', '# ' + t.title, 'cm'),
    ].concat(t.cmd.map(function (c, k) { return line(c.charAt(0) === '#' ? '' : '$ ', c, (c.charAt(0) === '#' ? 'cm ' : '') + 'type d' + k); })).concat([el('span', { class: 'cht-caret', 'aria-hidden': 'true' })]));
    var btns = item.opts.map(function (id, k) {
      var kids = t.kind === 'fence'
        ? [el('span', { class: 'cht-g', 'aria-hidden': 'true', text: F[id].g }), el('span', { class: 'cht-tx' }, [el('b', { text: F[id].name }), el('span', { text: F[id].sub })])]
        : [el('span', { class: 'cht-g', 'aria-hidden': 'true', text: String.fromCharCode(65 + k) }), el('span', { class: 'cht-tx' }, [el('b', { text: t.choices[id] })])];
      return el('button', { class: 'cht-opt', type: 'button', 'data-id': id, onclick: function () { pick(k); } }, kids);
    });
    var fb = el('div', { 'aria-live': 'polite' });
    var score = el('span', { class: 'score', 'aria-label': 'Score', text: K.fmt(S.pts) });
    var bar = el('i'), timer = item.limit ? el('div', { class: 'timer', role: 'progressbar', 'aria-label': 'Time left' }, [bar]) : null;
    main.replaceChildren(el('section', { class: 'screen cht' }, [
      el('div', { class: 'hud' }, [el('div', {}, [el('p', { class: 'kicker', style: 'margin:0', text: round.name + ' · ' + round.title }), el('p', { class: 'small', style: 'margin:4px 0 0', text: 'Trick ' + (S.i + 1) + ' of ' + S.d.length })]), score]),
      timer, term,
      el('p', { class: 'kicker cht-q', text: t.kind === 'fence' ? 'Which fence stops it?' : t.q }),
      el('div', { class: 'cht-opts' + (t.kind === 'pick' ? ' pick' : '') }, btns),
      fb,
    ]));
    var elapsed = function () { return (hiddenAt || performance.now()) - t0 - paused; };
    var vis = function () { if (document.hidden) hiddenAt = performance.now(); else if (hiddenAt) { paused += performance.now() - hiddenAt; hiddenAt = 0; } };
    document.addEventListener('visibilitychange', vis);
    clearInterval(tick);
    if (item.limit) tick = setInterval(function () {
      var e = elapsed(), left = Math.max(0, 1 - e / item.limit);
      bar.style.transform = 'scaleX(' + left + ')'; timer.classList.toggle('low', left < 0.3);
      if (e >= item.limit) pick(-1);
    }, 100);

    function pick(k) {
      if (picked) return; picked = true;
      clearInterval(tick); document.removeEventListener('visibilitychange', vis);
      var ms = k < 0 ? item.limit : Math.round(Math.min(item.limit ? item.limit : L.MAX_MS, Math.max(L.MIN_MS, elapsed())));
      S.moves.push([k, ms]);
      var p = L.points(item, k, ms), ok = p > 0; S.pts += p; score.textContent = K.fmt(S.pts);
      K.vibrate(ok ? 15 : [10, 40, 10]);
      btns.forEach(function (b, j) { b.disabled = true; if (item.opts[j] === t.ans) b.classList.add('right'); if (j === k && !ok) b.classList.add('wrong'); });
      var caret = term.querySelector('.cht-caret'); if (caret) caret.remove();
      respond(term);
      var ansName = t.kind === 'fence' ? F[t.ans].name : t.choices[t.ans];
      var big = k < 0 ? 'Time’s up. It was: ' + ansName + '.' : ok ? '+' + p + (t.kind === 'fence' ? ' · Stopped by: ' + ansName + '.' : ' · Right.') : (t.kind === 'fence' ? 'Not that one. Stopped by: ' + ansName + '.' : 'Not quite: ' + ansName + '.');
      var last = S.i === S.d.length - 1, endRound = last || S.d[S.i + 1].round !== item.round;
      var nxt = el('button', { class: 'btn', type: 'button', text: last ? 'See your score' : endRound ? 'Next round' : 'Next trick', disabled: true, onclick: function () {
        S.i++;
        if (last) return finish();
        if (endRound) return K.roundOverlay(main, L.data.rounds, S.d[S.i].round, show, S.d[S.i].round === 1 ? 'Same game, less time: 15 seconds a trick. No answer counts as wrong.' : 'Twist: the browser runs on your own computer. One trick really does work there. Find it.');
        show();
      } });
      fb.replaceChildren(el('div', { class: 'feedback ' + (ok ? 'ok' : 'bad') }, [el('p', { class: 'big', text: big }), t.id === 'works' ? twoBoards() : null, el('p', { text: t.lesson }), nxt]));
      setTimeout(function () { nxt.disabled = false; nxt.focus(); nxt.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 800);
    }

    function respond(term) {
      if (t.id === 'works') { term.appendChild(line('$ ', 'localStorage["ftarcade-progress"] = allThreeStars', 'type')); term.appendChild(line('', '✓ done. No server was asked.', 'ok')); return; }
      if (t.id === 'why') { term.appendChild(line('', '→ your map: 3 stars on every game', 'ok')); term.appendChild(line('', '→ the path leaderboard: unchanged', 'bad')); return; }
      if (t.id === 'where') { term.appendChild(line('', '→ the server: signs, replays, saves.', 'ok')); return; }
      var sv = t.server, box = el('div', { class: 'cht-resp' });
      var paint = function (code, msg, tag, liveOk) {
        box.replaceChildren.apply(box, [
          el('span', { class: 'cht-tag' + (liveOk ? ' live' : ''), text: tag }),
          sv.sent ? el('span', { class: 'cht-sent', text: sv.sent }) : null,
          el('p', { class: 'cht-l bad' }, [el('span', { class: 'p', text: '← ' + code + ' ' }), el('span', { class: 'c', text: msg })])].filter(Boolean));
      };
      paint(sv.code, sv.msg, 'what the server says');
      term.appendChild(box);
      var req = t.live ? liveRequest(t.live) : null;
      if (req) {
        box.querySelector('.cht-tag').textContent = 'asking the live server…';
        req.then(function (r) { paint(r._status, r.error || JSON.stringify(r).slice(0, 120), 'live server, just now', true); })
          .catch(function () { paint(sv.code, sv.msg, 'what the server says (live server unreachable)'); });
      }
    }
  }

  function twoBoards() {
    var mine = K.progress(), have = Object.keys(mine).reduce(function (s, k) { return s + (mine[k].stars || 0); }, 0);
    return el('div', { class: 'cht-two' }, [
      el('div', { class: 'cht-side you' }, [el('b', { text: 'This device' }), K.starRow(3), el('span', { text: 'Every game, 3 stars' + (have ? ' (you really have ' + have + ')' : '') })]),
      el('div', { class: 'cht-side srv' }, [el('b', { text: 'The leaderboard' }), el('span', { class: 'cht-same', text: 'No change' }), el('span', { text: 'Kept on the server' })]),
    ]);
  }

  function finish() {
    var res = L.replay(S.run.seed, S.moves), d = res.detail;
    var missed = res.log.filter(function (x) { return !x.ok && x.r < 2; }).map(function (x) { return F[x.ans].name; });
    var remember = [
      ['The browser is the attacker’s computer.', 'Anything in it, from the score on screen to the stars on your device, can be changed by whoever holds it.'],
      ['So the check lives where the action happens.', 'The server signs every run, replays every move and keeps the board. Same idea as a fencing token: the door does the checking, not the person holding the key.'],
    ];
    if (missed.length) remember.unshift(['Fences you mixed up: ' + missed.filter(function (n, k) { return missed.indexOf(n) === k; }).join(', ') + '.', 'Each one is a few lines of server code. Play again to meet them.']);
    remember.push(['No fence is perfect.', 'A patient bot playing real moves at human speed could still score, and this game trusts the times your browser reports, within limits. Fences make cheating slow and small, not impossible.']);
    K.results(main, G, S.run, res, {
      kicker: K.api() && S.run.token ? 'Run complete · now the same server checks this run' : 'Run complete',
      title: d.right === 13 ? 'You know every fence.' : 'The server said no every time.',
      stats: [[d.fences + '/10', 'fences named'], [d.twist + '/3', 'twist answers'], [(d.avgMs / 1000).toFixed(1) + ' s', 'per trick']],
      remember: remember, onAgain: start,
    });
  }

  K.intro(main, G, start);
})();
