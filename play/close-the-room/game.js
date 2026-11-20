/* Close the Room: the grid frame. A hijacked AI agent sits in a sandbox holding a secret key.
   Seal the exits, keep the task working, then meet the side doors (DNS, images) and default deny. */
(function () {
  'use strict';
  var K = window.FTKit, el = K.el, L = window.FTGames['close-the-room'];
  var main = document.getElementById('main'), X = L.data.exits;
  var STEP = 520; // ms per attack attempt (logic.js counts 450 of it toward minMs)
  var G = {
    logic: L, title: 'Close the Room', kicker: 'Fencing Token Arcade · Act 4',
    pitch: 'An AI agent runs code in a closed room, holding a secret key. A stranger has hijacked it. Seal every way out before it wakes up.',
    meta: '3 rounds · about 2 minutes · no typing',
    howto: [
      { cls: 'deny', glyph: '1', text: 'Tap exits to seal them' },
      { cls: 'allow', glyph: '2', text: 'Keep open only what the task needs' },
      { cls: 'ask', glyph: '3', text: 'Watch for side doors data can sneak through' },
    ],
    nextGame: { href: '/play/policy-engine/', title: 'Be the Policy Engine' },
    shareText: function (s) { return 'I locked a hijacked AI agent in a room and scored ' + s + ' in Close the Room. Can you stop the leak?'; },
    next: [
      { href: '/concepts/?lens=everyone#sandboxing', text: 'Sandboxing, explained three ways', sub: 'The room the agent works in.' },
      { href: '/concepts/?lens=everyone#egress-control', text: 'Egress control, explained three ways', sub: 'Default deny for everything that leaves.' },
    ],
  };
  var S, tick = null;
  // 12 wall slots around the 2x2 room on a 4x4 board: [row, col] (1-based for CSS grid)
  var SLOT = [[1, 1], [1, 2], [1, 3], [1, 4], [2, 4], [3, 4], [4, 4], [4, 3], [4, 2], [4, 1], [3, 1], [2, 1]];

  function start() {
    var b = main.querySelector('.btn'); if (b) { b.disabled = true; b.textContent = 'Starting…'; }
    K.startRun(L).then(function (run) {
      S = { run: run, d: L.deck(run.seed), moves: [], score: 0 };
      run.moves = S.moves;
      K.roundOverlay(main, L.data.rounds, 0, function () { wave(0); }, 'The room is a sandbox: a closed box where an AI agent runs code. Its exits are ways data can leave. Tap them to seal them before the agent wakes up.');
    });
  }

  function names(ids) { return ids.map(function (id) { return X[id].name; }).join(', '); }

  function wave(wi) {
    var w = S.d.waves[wi], allow = w.mode === 'allow', toggled = [], tiles = {}, walls = {}, running = false;
    var t0 = performance.now(), hiddenAt = 0, paused = 0;
    var isOpen = function (id) { return (toggled.indexOf(id) >= 0) === allow; };
    var openCount = function () { return w.exits.filter(isOpen).length; };

    var board = el('div', { class: 'ctr-board', role: 'group', 'aria-label': 'The room and its exits' });
    var packet = el('span', { class: 'ctr-packet', 'aria-hidden': 'true' });
    var agent = el('span', { class: 'ctr-agent', 'aria-hidden': 'true', text: '🤖' });
    var room = el('div', { class: 'ctr-room', style: 'grid-row:2/4;grid-column:2/4' }, [
      el('span', { class: 'ctr-roomlbl', text: 'Sandbox' }),
      agent,
      el('span', { class: 'ctr-key' }, ['🔑 ', L.data.key]),
      el('span', { class: 'ctr-hostile' }, ['⚠ ', w.hostile]),
    ]);
    function tileFor(id) {
      var x = X[id], badge = el('span', { class: 'ctr-badge' });
      var t = el('button', { class: 'ctr-exit', type: 'button', 'data-id': id, style: 'grid-row:' + SLOT[S.d.pos[id]][0] + ';grid-column:' + SLOT[S.d.pos[id]][1], onclick: function () { tap(id); } }, [
        el('span', { class: 'ctr-g', 'aria-hidden': 'true', text: x.g }), el('span', { class: 'ctr-n', text: x.name }), el('span', { class: 'ctr-s', text: x.sub }), badge,
      ]);
      t._badge = badge; return t;
    }
    for (var s = 0; s < 12; s++) {
      var id = Object.keys(S.d.pos).filter(function (k) { return S.d.pos[k] === s; })[0];
      if (id && w.exits.indexOf(id) >= 0) { tiles[id] = tileFor(id); board.appendChild(tiles[id]); }
      else { var wl = el('div', { class: 'ctr-wall', 'aria-hidden': 'true', style: 'grid-row:' + SLOT[s][0] + ';grid-column:' + SLOT[s][1] }); if (id) walls[id] = wl; board.appendChild(wl); }
    }
    board.appendChild(room); board.appendChild(packet);

    function paint(id) {
      var t = tiles[id], o = isOpen(id), x = X[id];
      t.classList.toggle('open', o); t.classList.toggle('sealed', !o);
      t._badge.textContent = o ? (allow ? '✓ ALLOWED' : 'OPEN') : '🔒 SEALED';
      t.setAttribute('aria-pressed', o ? 'false' : 'true');
      t.setAttribute('aria-label', x.name + ', ' + x.sub + '. ' + (o ? 'Open' : 'Sealed') + '. Tap to ' + (o ? 'seal' : (allow ? 'allow' : 'open')) + '.');
    }
    var status = el('p', { class: 'ctr-status', 'aria-live': 'polite', text: allow ? 'Every exit is sealed. Tap to allow the ones the task needs.' : 'Tap an exit to seal it. Tap again to reopen it.' });
    var openLbl = el('p', { class: 'small', style: 'margin:4px 0 0' });
    var score = el('span', { class: 'score', 'aria-label': 'Score', text: K.fmt(S.score) });
    function counts() { openLbl.textContent = openCount() + ' of ' + w.exits.length + ' exits open'; }
    function tap(id) {
      if (running) return;
      var i = toggled.indexOf(id); if (i >= 0) toggled.splice(i, 1); else toggled.push(id);
      paint(id); counts(); K.vibrate(8);
      var o = isOpen(id);
      status.textContent = (o ? (allow ? '✓ ' : '🔓 ') : '🔒 ') + X[id].name + (o ? (allow ? ' allowed' : ' reopened') : ' sealed') + ' · ' + X[id].sub;
    }
    Object.keys(tiles).forEach(paint); counts();

    var bar = el('i'), timer = el('div', { class: 'timer', role: 'progressbar', 'aria-label': 'Time before the agent wakes' }, [bar]);
    var clock = el('span', { class: 'ctr-clock' });
    var go = el('button', { class: 'btn', type: 'button', text: 'Wake the agent now', onclick: function () { run(false); } });
    var log = el('div', { class: 'ctr-log', 'aria-live': 'polite', hidden: true });
    var after = el('div');
    var round = L.data.rounds[w.r];
    main.replaceChildren(el('section', { class: 'screen ctr' }, [
      el('div', { class: 'hud' }, [el('div', {}, [el('p', { class: 'kicker', style: 'margin:0', text: round.name + ' · ' + (wi === 3 ? 'Default deny' : round.title) }), openLbl]), el('div', { class: 'ctr-hudr' }, [score, clock])]),
      timer,
      el('div', { class: 'ctr-task' }, [el('span', { class: 'lbl', text: 'The task' }), el('p', { text: w.task })]),
      board, status, log, after,
      el('div', { class: 'cta static' }, [go]),
      el('p', { class: 'disclaimer', text: 'Illustrative: a made-up key and example.com-style names.' }),
    ]));

    var elapsed = function () { return (hiddenAt || performance.now()) - t0 - paused; };
    var vis = function () { if (document.hidden) hiddenAt = performance.now(); else if (hiddenAt) { paused += performance.now() - hiddenAt; hiddenAt = 0; } };
    document.addEventListener('visibilitychange', vis);
    clearInterval(tick);
    tick = setInterval(function () {
      var t = elapsed(), left = Math.max(0, 1 - t / w.limit);
      bar.style.transform = 'scaleX(' + left + ')'; timer.classList.toggle('low', left < 0.3);
      clock.textContent = 'wakes in ' + Math.ceil(Math.max(0, w.limit - t) / 1000) + ' s';
      if (t >= w.limit) run(true);
    }, 100);

    function run(auto) {
      if (running) return; running = true;
      clearInterval(tick); document.removeEventListener('visibilitychange', vis);
      go.disabled = true; go.textContent = 'The agent is awake…';
      Object.keys(tiles).forEach(function (id) { tiles[id].disabled = true; });
      var ms = auto ? w.limit : Math.round(elapsed()), need = L.minWaveMs(toggled.length);
      var wait = Math.max(0, need - ms); ms = Math.min(w.limit, Math.max(ms, need));
      setTimeout(function () { attack(ms); }, wait);
    }

    function attack(ms) {
      var picked = toggled.slice(); S.moves.push([picked, ms]);
      var j = L.judge(w, picked, ms), tries = L.attempts(w), k = 0, leaked = 0;
      agent.classList.add('hijacked'); log.hidden = false;
      clock.textContent = 'awake';
      log.appendChild(el('p', { class: 'ctr-line head', text: '$ agent --read-the-data   # hijacked: trying every way out' }));
      var center = function () { packet.style.left = '50%'; packet.style.top = '50%'; };
      var aim = function (t) { packet.style.left = (t.offsetLeft + t.offsetWidth / 2) + 'px'; packet.style.top = (t.offsetTop + t.offsetHeight / 2) + 'px'; };
      var step = function () {
        if (k >= tries.length) return checkTask();
        var id = tries[k++], x = X[id], t = tiles[id];
        if (!t) { // a hidden exit: nobody drew it on the board
          t = tiles[id] = tileFor(id); t.disabled = true; t.classList.add('reveal', 'sealed'); t._badge.textContent = '🔒 DENIED';
          if (walls[id]) walls[id].replaceWith(t); else board.appendChild(t);
        }
        packet.classList.add('on'); aim(t);
        var line = el('p', { class: 'ctr-line' }, [el('span', { class: 'g', text: x.g + ' ' }), el('span', { class: 'cmd', text: x.try })]);
        log.appendChild(line); log.scrollTop = log.scrollHeight;
        setTimeout(function () {
          var out = j.leaks.indexOf(id) >= 0;
          t.classList.remove('hit-ok', 'hit-bad'); void t.offsetWidth; t.classList.add(out ? 'hit-bad' : 'hit-ok');
          if (out) { leaked++; t._badge.textContent = 'LEAKED'; t.classList.add('leak'); packet.classList.add('gone'); K.vibrate([40, 30, 40]); }
          line.appendChild(el('span', { class: out ? 'res bad' : 'res ok', text: out ? 'LEAKED' : (x.hidden ? 'BLOCKED · not on the list' : 'BLOCKED') }));
          setTimeout(function () { packet.classList.remove('gone'); center(); }, 180);
        }, 300);
        setTimeout(step, STEP);
      };
      var checkTask = function () {
        packet.classList.remove('on');
        w.need.forEach(function (id) {
          var ok = j.working.indexOf(id) >= 0;
          log.appendChild(el('p', { class: 'ctr-line task' }, [el('span', { class: 'g', text: X[id].g + ' ' }), el('span', { class: 'cmd', text: 'task: ' + X[id].try }), el('span', { class: ok ? 'res ok' : 'res bad', text: ok ? 'WORKS' : 'FAILED · sealed' })]));
        });
        S.score += j.pts; score.textContent = K.fmt(S.score);
        summary(j, leaked);
      };
      setTimeout(step, 250);
    }

    function summary(j, leaked) {
      var good = { 0: 'Nothing got out. With nothing needed, sealing every exit is easy.', 1: 'Task done, nothing leaked. Open only what the task needs: that’s least privilege.', 2: 'You sealed DNS and images too. Most people miss those side doors. (Allowed sites still work: the room looks up only names on its list.)', 3: 'Two exits weren’t even on your board. Default deny blocked them anyway.' };
      var kids = [];
      if (j.clean) kids.push(el('p', { class: 'big', text: (wi === 3 ? 'Default deny held. +' : 'Room sealed. +') + j.pts }), el('p', { text: good[wi] }));
      else {
        if (j.leaks.length) {
          var sn = j.leaks.filter(function (id) { return X[id].sneaky; })[0] || j.leaks[0];
          kids.push(el('p', { class: 'big', text: '🔑 Leaked through ' + names(j.leaks) + '.' }), el('p', { text: wi === 3 ? 'You allowed an exit the task never needed. An allowlist is only as tight as what you put on it.' : X[sn].leak }));
        }
        if (j.broken.length) kids.push(el('p', { class: j.leaks.length ? '' : 'big', text: 'The task broke: ' + names(j.broken) + (wi === 3 ? ' stayed sealed.' : ' was sealed.') }), el('p', { text: 'A sandbox that blocks the job gets switched off. Keep the task’s exits open.' }));
        kids.push(el('p', { class: 'small', text: '+' + j.pts + ' points this wave.' }));
      }
      var last = wi === S.d.waves.length - 1;
      var nxt = el('button', { class: 'btn', type: 'button', text: last ? 'See your score' : (wi === 2 ? 'Fix it for good' : 'Next round'), onclick: function () {
        if (last) return finish();
        if (wi === 2) return flip();
        K.roundOverlay(main, L.data.rounds, wi + 1, function () { wave(wi + 1); }, wi === 0 ? 'This task needs two exits: the package mirror and the docs site. Seal the rest, and keep the task working.' : 'First the agent reads a customer’s support ticket. A stranger wrote it. Check every exit, even the harmless-looking ones.');
      } });
      after.replaceChildren(el('div', { class: 'feedback ' + (j.clean ? 'ok' : 'bad') }, kids.concat([nxt])));
      go.parentNode.remove();
      setTimeout(function () { nxt.focus(); nxt.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 80);
    }
  }

  function flip() {
    var j = L.judge(S.d.waves[2], S.moves[2][0], S.moves[2][1]);
    main.replaceChildren(el('div', { class: 'overlay', role: 'dialog', 'aria-label': 'Default deny' }, [
      el('p', { class: 'kicker', text: 'Round 3 · part 2' }),
      el('h2', { text: 'Flip the room: default deny' }),
      el('p', { class: 'rule', text: j.leaks.length ? 'You sealed the exits you could see. The key left by one you didn’t think of. You can’t list every exit, so stop trying.' : 'You sealed every exit you could see. But can you list every exit there will ever be? Nobody can.' }),
      el('p', { class: 'small', text: 'Now every exit starts sealed, even ones nobody has drawn yet. Allow only what the task needs.' }),
      el('div', { class: 'cta', style: 'margin-top:22px' }, [el('button', { class: 'btn', type: 'button', text: 'Continue', onclick: function () { wave(3); } })]),
    ]));
    setTimeout(function () { var b = main.querySelector('.overlay .btn'); if (b) b.focus(); }, 50);
  }

  function finish() {
    var res = L.replay(S.run.seed, S.moves), d = res.detail, lg = res.log, remember = [];
    var leakedSneaky = lg[2].leaks.filter(function (id) { return X[id].sneaky; });
    if (leakedSneaky.indexOf('dns') >= 0) remember.push(['Looking up a web address can carry data.', 'The key was hidden in the name being looked up, and the attacker’s server saw it.']);
    if (leakedSneaky.indexOf('img') >= 0) remember.push(['Loading an image can carry data.', 'The key was in the image link. Showing the reply sent it out.']);
    var broke = lg.some(function (x) { return x.broken.length; });
    if (broke) remember.push(['A sandbox that breaks the task gets switched off.', 'Keep open exactly what the job needs.']);
    remember.push(['Default deny beats a list of bad exits.', 'You can only seal exits you know about. An allowlist also blocks the ones nobody thought of.']);
    remember.push(['Allowed exits can still leak a little.', 'Data could hide in a search on the docs site. Keep the list short and watch what goes through.']);
    remember.push(['A sandbox only holds what’s inside it.', 'Any key you hand the agent, it can try to send out. Hand in as little as possible.']);
    K.results(main, G, S.run, res, {
      title: d.clean === 4 ? 'The room is sealed.' : leakedSneaky.length ? 'The key slipped out a side door.' : 'Some data got out.',
      stats: [[d.stopped + '/' + d.tries, 'escapes blocked'], [d.tasksOk + '/3', 'tasks kept working'], [d.sneaky + '/2', 'side doors sealed']],
      remember: remember, onAgain: start,
    });
  }

  K.intro(main, G, start);
})();
