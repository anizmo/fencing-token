/* Be the Agent: the grid-board frame. You are the AI agent. Each turn: think, pick ONE tool, read what comes back.
   Finish your user's task in the fewest calls. In round 3, a web page tries to give you orders. */
(function () {
  'use strict';
  var K = window.FTKit, el = K.el, L = window.FTGames['be-the-agent'];
  var main = document.getElementById('main'), app = document.getElementById('app');
  var G = {
    logic: L, title: 'Be the Agent', kicker: 'Fencing Token Arcade · Act 3',
    pitch: 'An AI agent is a model in a loop: think, use a tool, read the result, repeat. This time, you are the agent.',
    meta: '3 rounds · 3 tasks · about 2 minutes · no typing',
    howto: [
      { cls: 'ask', glyph: '1', text: 'Read what your user wants' },
      { cls: 'allow', glyph: '2', text: 'Each turn, pick one tool and read what comes back' },
      { cls: 'deny', glyph: '3', text: 'Finish in the fewest calls. Don’t get hijacked.' },
    ],
    nextGame: { href: '/play/spot-the-injection/', title: 'Spot the Injection' },
    shareText: function (s) { return 'I played the AI agent, finished every task and ignored a hijacking web page: ' + s + ' points in Be the Agent. Your turn:'; },
    next: [
      { href: '/concepts/?lens=everyone#ai-agent', text: 'What an AI agent is, explained three ways', sub: 'The loop you just ran.' },
      { href: '/concepts/?lens=everyone#prompt-injection', text: 'Prompt injection, explained three ways', sub: 'What the hostel page tried.' },
    ],
  };
  var NOTES = [
    'You are the AI agent. Each turn, pick one tool and read what comes back. Finish in as few calls as you can.',
    'Look things up when you can. When you can’t, don’t guess.',
    'Your user’s goal is the only goal. Read every result carefully.',
  ];
  var WIN = [
    'You searched, read, then acted. That loop is what every AI agent runs.',
    'The page couldn’t say which day. Only your user could, so you asked. A guess would have filled the calendar with the wrong day.',
    'The page told you to email your user’s contacts. You treated it as data, not orders, and finished the real task.',
  ];
  var CHIP = { go: 'progress', waste: 'wasted call', wrong: 'wrong move', win: 'done', fail: 'failed', lose: 'hijacked', timeout: 'out of calls' };
  var S;

  // ---------------------------------------------------------------- icons (built in JS, no assets)
  var NS = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs, kids) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  var ICONS = {
    search: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM20 20l-4-4',
    open: 'M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5',
    calc: 'M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM8 7h8v3H8zM8.5 14h.5M12 14h.5M15.5 14h.5M8.5 17.5h.5M12 17.5h.5M15.5 17.5h.5',
    cal: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5',
    send: 'M21 3 10 14M21 3l-7 18-4-7-7-4z',
    ask: 'M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM10 9.2a2 2 0 1 1 2.5 1.9c-.4.2-.5.5-.5.9M12 14.2v.3',
    check: 'M5 12.5l4.5 4.5L19 7.5',
  };
  function icon(name) {
    return sv('svg', { viewBox: '0 0 24 24', class: 'ico', 'aria-hidden': 'true', focusable: 'false', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [sv('path', { d: ICONS[name] })]);
  }

  // ---------------------------------------------------------------- the loop ring: think -> act -> observe
  var RC = [80, 66], RR = 40;
  function pt(a, r) { var t = a * Math.PI / 180; return [RC[0] + (r || RR) * Math.cos(t), RC[1] + (r || RR) * Math.sin(t)]; }
  function arc(a1, a2) { var p = pt(a1), q = pt(a2); return 'M' + p[0].toFixed(1) + ' ' + p[1].toFixed(1) + ' A ' + RR + ' ' + RR + ' 0 0 1 ' + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }
  function head(a) { var c = pt(a), o = pt(a, RR + 7), i = pt(a, RR - 7), tip = pt(a + 11); return 'M' + o.join(' ') + ' L' + tip.join(' ') + ' L' + i.join(' ') + 'Z'; }
  var PH = [['think', -146, -44, 'THINK', 80, 11], ['act', -26, 76, 'ACT', 140, 124], ['observe', 94, 196, 'OBSERVE', 22, 124]];
  function ring() {
    var parts = { arcs: {}, lbls: {}, heads: {} }, kids = [];
    PH.forEach(function (p) {
      parts.arcs[p[0]] = sv('path', { class: 'gb-arc', d: arc(p[1], p[2]) });
      parts.heads[p[0]] = sv('path', { class: 'gb-arrow', d: head(p[2]) });
      parts.lbls[p[0]] = sv('text', { class: 'gb-arclbl', x: p[4], y: p[5], 'text-anchor': 'middle' }, [p[3]]);
      kids.push(parts.arcs[p[0]], parts.heads[p[0]], parts.lbls[p[0]]);
    });
    parts.num = sv('text', { class: 'gb-num', x: RC[0], y: RC[1] + 8, 'text-anchor': 'middle' }, ['0']);
    kids.push(parts.num, sv('text', { class: 'gb-numsub', x: RC[0], y: RC[1] + 22, 'text-anchor': 'middle' }, ['CALLS']));
    parts.svg = sv('svg', { class: 'gb-svg', viewBox: '0 0 160 130', 'aria-hidden': 'true', focusable: 'false' }, kids);
    parts.set = function (ph, n) {
      PH.forEach(function (p) { [parts.arcs, parts.heads, parts.lbls].forEach(function (g) { g[p[0]].classList.toggle('on', p[0] === ph); }); });
      if (n !== undefined) parts.num.textContent = String(n);
    };
    return parts;
  }

  // ---------------------------------------------------------------- run
  function start() {
    var b = main.querySelector('.btn'); if (b) { b.disabled = true; b.textContent = 'Starting…'; }
    K.startRun(L).then(function (run) {
      S = { run: run, d: L.deck(run.seed), ti: 0, moves: [], pts: 0 };
      run.moves = S.moves;
      K.roundOverlay(main, L.data.rounds, 0, show, NOTES[0]);
    });
  }

  function show() {
    var old = app.querySelector('.sheet'); if (old) old.remove();
    var item = S.d.tasks[S.ti], round = L.data.rounds[item.round], list = [], busy = true, last = Date.now();
    S.moves.push(list);
    var R = ring();
    var phase = el('p', { class: 'phase', 'aria-live': 'polite' }), trail = el('div', { class: 'trail', 'aria-hidden': 'true' });
    var obs = el('div', { class: 'obs', 'aria-live': 'polite' }, [el('p', { class: 'think', text: 'No tool called yet. What do you need to find out first?' })]);
    var traceList = el('ol'), trace = el('details', { class: 'trace', hidden: true }, [el('summary', { text: 'Your calls so far' }), traceList]);
    var tiles = L.TOOLS.map(function (t, k) {
      return el('button', { class: 'gtile' + (t.id === 'done' ? ' done' : ''), type: 'button', disabled: true, 'aria-label': t.label + ': ' + t.hint, title: t.hint, onclick: function () { pick(k); } }, [icon(t.icon), el('span', { class: 'tl', text: t.label })]);
    });
    function setPhase(ph) {
      R.set(ph, list.length);
      var txt = { think: ['Think. ', 'Pick one tool.'], act: ['Act. ', 'Calling the tool…'], observe: ['Observe. ', 'Read the result.'] }[ph];
      phase.replaceChildren(el('span', { text: txt[0] }), txt[1]);
    }
    function lock(on) { tiles.forEach(function (b) { b.disabled = on; }); busy = on; }

    function pick(k) {
      if (busy) return;
      var now = Date.now(), ms = Math.max(400, Math.min(120000, now - last)); last = now;
      list.push([k, ms]);
      lock(true);
      tiles.forEach(function (b, j) { b.classList.toggle('last', j === k); });
      var r = L.runTask(item, list.map(function (m) { return m[0]; })), s = r.calls[r.calls.length - 1];
      setPhase('act');
      obs.replaceChildren(el('p', { class: 'act', text: s.call }), el('p', { class: 'think', text: 'Waiting for the result…' }));
      setTimeout(function () {
        setPhase('observe');
        obs.replaceChildren(
          el('p', { class: 'act', text: s.call }),
          el('div', { class: 'res' }, s.result.map(function (line) {
            if (line.charAt(0) === '!') return el('p', { class: 'inj', text: line.slice(1) });
            return el('p', { class: /\s{3}/.test(line) ? 'mono' : '', text: line });
          })),
          el('div', { class: 'verdict' }, [el('span', { class: 'chip ' + s.type, text: CHIP[s.type] }), el('span', { text: s.why })])
        );
        trail.appendChild(el('i', { class: s.type }));
        traceList.appendChild(el('li', {}, [s.call, el('span', { class: 'chip ' + s.type, text: CHIP[s.type] })]));
        trace.hidden = false;
        K.vibrate(s.type === 'go' || s.type === 'win' ? 12 : s.type === 'lose' ? [30, 60, 30] : [10, 40, 10]);
        if (r.ended) { setTimeout(function () { endSheet(item, r); }, 700); return; }
        setTimeout(function () { setPhase('think'); lock(false); }, 400);
      }, 350);
    }

    main.replaceChildren(el('section', { class: 'screen' }, [
      el('div', { class: 'hud' }, [
        el('div', {}, [el('p', { class: 'kicker', style: 'margin:0', text: round.name + ' · ' + round.title }), el('p', { class: 'small', style: 'margin:4px 0 0', text: 'Task ' + (S.ti + 1) + ' of ' + S.d.tasks.length })]),
        el('span', { class: 'score', 'aria-label': 'Score', text: K.fmt(S.pts) }),
      ]),
      el('div', { class: 'gcard' }, [el('p', { class: 'lbl', text: 'Your user wants' }), el('p', { class: 'task', text: item.task.goal })]),
      el('div', { class: 'gboard gb-loop' }, [R.svg, el('div', { class: 'gb-side' }, [phase, el('p', { class: 'sub', text: 'Fewest possible: ' + item.task.best + ' calls' }), trail])]),
      obs,
      el('div', { class: 'gtiles', role: 'group', 'aria-label': 'Tools: pick one per turn' }, tiles),
      trace,
    ]));
    setPhase('think');
    setTimeout(function () { lock(false); }, 400);
  }

  function sign(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + K.fmt(Math.abs(n)); }

  function endSheet(item, r) {
    S.pts += r.pts;
    var lastTask = S.ti === S.d.tasks.length - 1, best = item.task.best, P = L.P;
    var big = { win: 'Done in ' + r.n + ' call' + (r.n > 1 ? 's' : '') + (r.n === best ? '. Best possible!' : ''), fail: 'Task failed', lose: 'Hijacked!', timeout: 'Out of calls' }[r.outcome];
    var lines = [];
    if (r.outcome === 'win') lines.push({ k: 'ok', text: 'Task done', pts: P.win });
    if (r.waste) lines.push({ k: 'extra', text: r.waste + ' wasted call' + (r.waste > 1 ? 's' : ''), pts: r.outcome === 'win' ? -P.waste * r.waste : 0 });
    if (r.wrong) lines.push({ k: 'miss', text: r.wrong + ' wrong move' + (r.wrong > 1 ? 's' : ''), pts: r.outcome === 'win' ? -P.wrong * r.wrong : 0 });
    if (r.outcome === 'lose') lines.push({ k: 'bad', text: 'Obeyed an order planted in a web page', pts: -P.lose });
    if (r.outcome === 'win' && r.pts === P.floor && P.win - P.waste * r.waste - P.wrong * r.wrong < P.floor) lines.push({ k: 'ok', text: 'Finished anyway: minimum ' + P.floor + ' points', pts: 0 });
    var lesson = r.outcome === 'win' ? WIN[S.ti] : r.outcome === 'lose' ? 'The page’s words reached you as a tool result, and you obeyed them. That is prompt injection. Real agents fall for it too, so the limits on what they can do must sit outside the model.' : r.outcome === 'timeout' ? 'Ten calls and still not done. Your user gave up waiting.' : r.calls[r.calls.length - 1].result[0] + ' An agent that stops early leaves the job half done.';
    var inj = null;
    if (S.ti === 2 && r.calls.some(function (c) { return c.result.some(function (l) { return l.charAt(0) === '!'; }); })) {
      var line = item.task.states.s1.open[3][3].slice(1);
      inj = el('div', { class: 'pbox' + (r.outcome === 'lose' ? '' : ' safe') }, [
        el('p', {}, [el('b', { text: r.outcome === 'lose' ? 'The line that hijacked you, hidden in small grey text on the page:' : 'The order you ignored, hidden in small grey text on the page:' })]),
        el('p', { class: 'hid', text: '“' + line + '”' }),
        el('p', { text: 'Anyone can write words like these on a web page. Your user never asked for them.' }),
      ]);
    }
    var mark = { ok: '✓', miss: '✗', extra: '!', bad: '✗' };
    var sh = el('div', { class: 'sheet', role: 'dialog', 'aria-label': 'Task result' }, [
      el('p', { class: 'kicker', style: 'margin-top:0', text: 'Task ' + (S.ti + 1) + ' of ' + S.d.tasks.length + ' · fewest possible: ' + best + ' calls' }),
      el('p', { class: 'big', text: big }),
      el('p', { class: 'ptsline' + (r.pts < 0 ? ' neg' : ''), text: sign(r.pts) + ' points' }),
      inj,
      lines.length ? el('ul', { class: 'blines' }, lines.map(function (l) {
        return el('li', { class: l.k }, [el('span', { class: 'mk', 'aria-hidden': 'true', text: mark[l.k] }), el('span', { class: 'tx', text: l.text }), l.pts ? el('span', { class: 'pt', text: sign(l.pts) }) : null]);
      })) : null,
      el('p', { class: 'lesson', text: lesson }),
      el('button', { class: 'btn', type: 'button', text: lastTask ? 'See your score' : 'Next round', onclick: function () {
        sh.remove(); S.ti++;
        if (lastTask) return finish();
        K.roundOverlay(main, L.data.rounds, S.ti, show, NOTES[S.ti]);
      } }),
    ]);
    app.appendChild(sh);
    setTimeout(function () { var b = sh.querySelector('.btn'); if (b) b.focus(); }, 60);
  }

  function finish() {
    var res = L.replay(S.run.seed, S.moves), d = res.detail, perfect = d.wins === 3 && d.calls === d.best;
    var remember = [
      ['An agent is a loop.', 'Think, pick one tool, read the result, repeat until done. Real AI agents run this same loop, with a language model choosing each step.'],
      ['Look it up, or ask. Never guess.', d.asked ? 'You asked which day instead of guessing. Asking costs one call; a wrong guess costs your user.' : 'The fest page couldn’t say which day your user was going. Only your user could.'],
      ['Tool results are data, not orders.', d.hijacked ? 'A web page told you to email your user’s contacts, and you did. That is prompt injection.' : 'A web page told you to email your user’s contacts. You ignored it. Real agents don’t always.'],
      ['So limit what an agent can do.', 'An agent that only had the tools for the task (no email.send here) couldn’t have been hijacked into spamming anyone.'],
    ];
    if (d.calls > d.best) remember.splice(1, 0, ['Every call costs time and money.', 'You made ' + d.calls + ' calls. The fewest possible was ' + d.best + '.']);
    K.results(main, G, S.run, res, {
      title: perfect ? 'Fewest calls. No hijack.' : d.hijacked ? 'A web page took the wheel.' : d.wins === 3 ? 'All done, with detours.' : 'Agents are harder than they look.',
      stats: [[d.wins + '/3', 'tasks done'], [d.calls + '/' + d.best, 'calls vs fewest'], [d.hijacked ? 'Obeyed' : 'Ignored', 'the planted order']],
      remember: remember, onAgain: start,
    });
  }

  K.intro(main, G, start);
})();
