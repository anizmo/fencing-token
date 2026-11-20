/* Plug It In: the grid-board frame. The agent sits in the middle of the board; you snap tool plugs onto it.
   Plug in exactly what each task needs. In round 3 a marketplace appears, and one tool's description lies. */
(function () {
  'use strict';
  var K = window.FTKit, el = K.el, L = window.FTGames['plug-it-in'], T = L.TOOLS;
  var main = document.getElementById('main'), app = document.getElementById('app');
  var G = {
    logic: L, title: 'Plug It In', kicker: 'Fencing Token Arcade · Act 3',
    pitch: 'AI agents use tools to reach your calendar, email, files and money. Every plug adds power, and risk. Give the agent just enough.',
    meta: '3 rounds · 9 tasks · about 3 minutes · no typing',
    howto: [
      { cls: 'ask', glyph: '1', text: 'Read the task your user gives the agent' },
      { cls: 'allow', glyph: '2', text: 'Plug in only the tools it needs' },
      { cls: 'deny', glyph: '3', text: 'Read the descriptions. One tool is lying.' },
    ],
    nextGame: { href: '/play/be-the-agent/', title: 'Be the Agent' },
    shareText: function (s) { return 'I wired tools to an AI agent and refused the poisoned ones: ' + s + ' points in Plug It In. Your turn:'; },
    next: [
      { href: '/concepts/?lens=everyone#mcp-and-the-tool-supply-chain', text: 'MCP and the tool supply chain, explained three ways', sub: 'What Round 3 was really about.' },
      { href: '/concepts/?lens=everyone#least-privilege', text: 'Least privilege, explained three ways', sub: 'Why fewer plugs is safer.' },
    ],
  };
  var KIND = { read: 'reads only', write: 'can change things', power: 'high power', market: '3rd party' };
  var NOTES = [
    'Each plug is a tool the agent can use. Many AI apps connect tools through MCP (Model Context Protocol), an open standard Anthropic introduced in November 2024. Plug in what the task needs. Every extra plug costs points.',
    'Now tools come in two kinds: one that only reads, and one that can change things.',
    'New: a tool marketplace. Anyone can publish a tool there. Tap ⓘ to read what each tool tells the AI.',
  ];
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
    cal: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4',
    calw: 'M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM3 10h18M8 3v4M16 3v4M12 13v5M9.5 15.5h5',
    mail: 'M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM3 7l9 6 9-6',
    send: 'M21 3 10 14M21 3l-7 18-4-7-7-4z',
    file: 'M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8zM14 3v5h5M9 13h6M9 17h4',
    trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
    globe: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM3 12h18M12 3c3.5 3.5 3.5 14.5 0 18M12 3c-3.5 3.5-3.5 14.5 0 18',
    rupee: 'M7 4h10M7 9h10M7 4h3a4 4 0 0 1 0 8H7l8 8',
    term: 'M4 5h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zM7 10l3 2-3 2M12 15h5',
    rain: 'M7 15a4 4 0 1 1 .8-7.9A5 5 0 0 1 17.5 9a3.5 3.5 0 0 1-.5 6.9H7M8 19l-1 2M12 19l-1 2M16 19l-1 2',
    fx: 'M4 8h14l-3-3M20 16H6l3 3',
    box: 'M3 7.5 12 3l9 4.5v9L12 21l-9-4.5zM3 7.5l9 4.5 9-4.5M12 12v9',
    ball: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM6.5 5.5c3 3 3 10 0 13M17.5 5.5c-3 3-3 10 0 13',
    info: 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18zM12 11v6M12 7.5v.5',
    plug: 'M9 2v5M15 2v5M6 7h12v4a6 6 0 0 1-12 0zM12 17v5',
    check: 'M5 12.5l4.5 4.5L19 7.5',
  };
  function icon(name) {
    return sv('svg', { viewBox: '0 0 24 24', class: 'ico', 'aria-hidden': 'true', focusable: 'false', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, [sv('path', { d: ICONS[name] })]);
  }

  // ---------------------------------------------------------------- the board: agent in the middle, six sockets
  var SLOTS = [[4, 10], [220, 10], [4, 64], [220, 64], [4, 118], [220, 118]], CX = 160, CY = 81, NW = 96, NH = 36;
  function boardSvg(item, on, fresh) {
    var names = on.map(function (k) { var t = T[item.pal[k]]; return t.name + ' ' + t.verb; });
    var kids = [], cables = [], nodes = [];
    SLOTS.forEach(function (s, n) {
      var k = on[n], x = s[0], y = s[1], left = x < CX, cy = y + NH / 2;
      if (k === undefined) {
        nodes.push(sv('g', {}, [sv('rect', { class: 'gb-slot', x: x, y: y, width: NW, height: NH, rx: 10 }), sv('text', { class: 'gb-slottxt', x: x + NW / 2, y: cy + 3, 'text-anchor': 'middle' }, ['EMPTY'])]));
        return;
      }
      var t = T[item.pal[k]], cls = 'k-' + t.kind + (k === fresh ? ' new' : '');
      var sx = left ? x + NW : x, ex = left ? CX - 32 : CX + 32, bend = left ? 26 : -26;
      cables.push(sv('path', { class: 'gb-cable ' + cls, d: 'M' + sx + ' ' + cy + ' C ' + (sx + bend) + ' ' + cy + ', ' + (ex - bend) + ' ' + CY + ', ' + ex + ' ' + CY }));
      nodes.push(sv('g', { class: 'gb-node ' + cls }, [
        sv('rect', { x: x, y: y, width: NW, height: NH, rx: 10 }),
        sv('circle', { cx: left ? x + NW : x, cy: cy, r: 3.5 }),
        sv('text', { class: 'nm', x: x + 10, y: y + 16 }, [t.name]),
        sv('text', { class: 'vb', x: x + 10, y: y + 29 }, [t.verb.toUpperCase()]),
      ]));
    });
    kids = kids.concat(cables);
    kids.push(sv('circle', { class: 'gb-halo', cx: CX, cy: CY, r: 41 }));
    kids.push(sv('circle', { class: 'gb-core', cx: CX, cy: CY, r: 30 }));
    kids.push(sv('text', { class: 'gb-coretxt', x: CX, y: CY + 3, 'text-anchor': 'middle' }, ['AI']));
    kids.push(sv('text', { class: 'gb-coresub', x: CX, y: CY + 15, 'text-anchor': 'middle' }, ['AGENT']));
    kids.push(sv('text', { class: 'gb-cap', x: CX, y: 12, 'text-anchor': 'middle' }, ['TOOLS VIA MCP']));
    kids = kids.concat(nodes);
    return sv('svg', { class: 'gb-svg', viewBox: '0 0 320 164', role: 'img', 'aria-label': on.length ? 'The agent has ' + on.length + ' plug' + (on.length > 1 ? 's' : '') + ': ' + names.join(', ') : 'The agent has no plugs' }, kids);
  }

  // ---------------------------------------------------------------- run
  function start() {
    var b = main.querySelector('.btn'); if (b) { b.disabled = true; b.textContent = 'Starting…'; }
    K.startRun(L).then(function (run) {
      S = { run: run, d: L.deck(run.seed), i: 0, moves: [], pts: 0, res: [] };
      run.moves = S.moves;
      K.roundOverlay(main, L.data.rounds, 0, show, NOTES[0]);
    });
  }

  function show() {
    var old = app.querySelector('.sheet'); if (old) old.remove();
    var item = S.d[S.i], on = [], read = [], t0 = Date.now(), ran = false, fresh = null, round = L.data.rounds[item.round];
    var boardBox = el('div', { class: 'gboard' }), meter = el('div', { class: 'gb-meter', 'aria-live': 'polite' });
    var score = el('span', { class: 'score', 'aria-label': 'Score', text: K.fmt(S.pts) });
    var runBtn = el('button', { class: 'btn', type: 'button', disabled: true, onclick: run });
    setTimeout(function () { if (!ran) runBtn.disabled = false; }, 1000);
    var cards = item.pal.map(function (id, k) { return plugCard(id, k); });

    function plugCard(id, k) {
      var t = T[id], open = false;
      var desc = el('div', { class: 'desc', id: 'desc-' + S.i + '-' + k, hidden: true }, [el('span', { class: 'lbl2', text: 'What the AI reads' }), el('p', { text: t.desc })]);
      var info = el('button', { class: 'pbtn info', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'desc-' + S.i + '-' + k, 'aria-label': 'Read the description of ' + t.name + ' ' + t.verb, title: 'Read description', onclick: function () {
        open = !open; desc.hidden = !open; info.setAttribute('aria-expanded', open ? 'true' : 'false');
        if (open && !ran && read.indexOf(k) < 0) read.push(k);
      } }, [icon('info')]);
      var pb = el('button', { class: 'pbtn plugb', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Plug in ' + t.name + ' ' + t.verb, onclick: function () {
        if (ran) return;
        var i = on.indexOf(k);
        if (i >= 0) { on.splice(i, 1); fresh = null; } else { on.push(k); fresh = k; K.vibrate(8); }
        redraw();
      } });
      var card = el('div', { class: 'plug k-' + t.kind }, [
        el('div', { class: 'prow' }, [
          el('span', { class: 'gicon' }, [icon(t.icon)]),
          el('div', { class: 'nm' }, [el('b', { text: t.name + ' · ' + t.verb }), el('span', { class: 'vb', text: KIND[t.kind] }), t.stars ? el('span', { class: 'by', text: '★ ' + t.stars }) : null]),
          info, pb,
        ]),
        t.sum ? el('p', { class: 'sum', text: t.sum + ' By ' + t.by + '.' }) : null,
        desc,
      ]);
      card._k = k; card._pb = pb;
      return card;
    }
    function redraw() {
      boardBox.replaceChildren(boardSvg(item, on, fresh));
      cards.forEach(function (c) {
        var isOn = on.indexOf(c._k) >= 0;
        c.classList.toggle('on', isOn);
        c._pb.setAttribute('aria-pressed', isOn ? 'true' : 'false');
        c._pb.replaceChildren(icon(isOn ? 'check' : 'plug'), isOn ? 'Plugged' : 'Plug in');
      });
      var risk = on.reduce(function (s, k) { return s + T[item.pal[k]].cost; }, 0), lvl = risk === 0 ? 'none' : risk <= 30 ? 'low' : risk <= 80 ? 'medium' : 'high';
      meter.className = 'gb-meter' + (lvl === 'medium' ? ' mid' : lvl === 'high' ? ' high' : '');
      meter.replaceChildren(el('span', { text: 'Access' }), el('span', { class: 'bar' }, [el('i', { style: 'width:' + Math.min(100, Math.round(risk / 1.6)) + '%' })]), el('b', { text: lvl + ' risk' }));
      runBtn.textContent = on.length ? 'Run task with ' + on.length + ' plug' + (on.length > 1 ? 's' : '') : 'Run with no plugs';
    }

    function run() {
      if (ran) return; ran = true;
      var mv = { p: on.slice(), r: read.slice(), t: Math.max(1000, Math.min(300000, Date.now() - t0)) };
      S.moves.push(mv);
      var j = L.judge(item, mv); S.pts += j.pts; S.res.push(j);
      cards.forEach(function (c) { c._pb.disabled = true; });
      runBtn.disabled = true; runBtn.textContent = 'Running…';
      boardBox.classList.add('run');
      setTimeout(function () {
        boardBox.classList.remove('run'); boardBox.classList.add(j.poisoned ? 'poison' : j.done ? 'ok' : 'bad');
        score.textContent = K.fmt(Math.max(0, S.pts));
        K.vibrate(j.poisoned ? [30, 60, 30] : j.done ? 15 : [10, 40, 10]);
        sheet(item, j);
      }, 900);
    }

    var market = item.pal.some(function (id) { return T[id].kind === 'market'; });
    var list = el('div', { class: 'plugs', role: 'group', 'aria-label': 'Tools you can plug in' });
    if (market) {
      list.appendChild(el('p', { class: 'store', text: 'From the marketplace' }));
      cards.filter(function (c) { return T[item.pal[c._k]].kind === 'market'; }).forEach(function (c) { list.appendChild(c); });
      list.appendChild(el('p', { class: 'store', style: 'color:#8F9CAE', text: 'Already installed' }));
      cards.filter(function (c) { return T[item.pal[c._k]].kind !== 'market'; }).forEach(function (c) { list.appendChild(c); });
    } else cards.forEach(function (c) { list.appendChild(c); });

    main.replaceChildren(el('section', { class: 'screen' }, [
      el('div', { class: 'hud' }, [
        el('div', {}, [el('p', { class: 'kicker', style: 'margin:0', text: round.name + ' · ' + round.title }), el('p', { class: 'small', style: 'margin:4px 0 0', text: 'Task ' + (S.i + 1) + ' of ' + S.d.length })]),
        score,
      ]),
      el('div', { class: 'gcard' }, [el('p', { class: 'lbl', text: 'Your user asks the agent' }), el('p', { class: 'task', text: item.task.text })]),
      boardBox,
      meter,
      list,
      el('div', { class: 'runbar' }, [runBtn]),
    ]));
    redraw();
  }

  function sign(n) { return (n > 0 ? '+' : n < 0 ? '−' : '') + K.fmt(Math.abs(n)); }

  function sheet(item, j) {
    var last = S.i === S.d.length - 1, endRound = last || S.d[S.i + 1].round !== item.round;
    var big = j.poisoned ? 'Poisoned plug!' : !j.done ? 'Task failed' : j.exact ? 'Exactly right' : 'Done, with extra risk';
    var mark = { ok: '✓', miss: '✗', extra: '!', bad: '✗' };
    var lines = j.lines.filter(function (l) { return l.k !== 'bad'; });
    var pbox = null;
    if (item.task.bad) {
      var bad = T[item.task.bad];
      pbox = j.poisoned
        ? el('div', { class: 'pbox' }, [
          el('p', {}, [el('b', { text: bad.name + '’s description hid an order for the AI:' })]),
          el('p', { class: 'hid', text: bad.hidden }),
          el('p', { text: bad.hit }),
          el('p', { text: 'Plugging it in was enough: a connected tool’s description goes straight into what the AI reads.' }),
        ])
        : el('div', { class: 'pbox safe' }, [
          el('p', {}, [el('b', { text: '✓ You refused ' + bad.name + '. ' + (j.readBad ? 'You read it and spotted this:' : 'Lucky, or careful? Its description said:') })]),
          el('p', { class: 'hid', text: bad.hidden }),
          el('p', { text: bad.hit }),
        ]);
    }
    var sh = el('div', { class: 'sheet', role: 'dialog', 'aria-label': 'Task result' }, [
      el('p', { class: 'kicker', style: 'margin-top:0', text: 'Task ' + (S.i + 1) + ' of ' + S.d.length }),
      el('p', { class: 'big', text: big }),
      el('p', { class: 'ptsline' + (j.pts < 0 ? ' neg' : ''), text: sign(j.pts) + ' points' }),
      pbox,
      lines.length ? el('ul', { class: 'blines' }, lines.map(function (l) {
        return el('li', { class: l.k }, [el('span', { class: 'mk', 'aria-hidden': 'true', text: mark[l.k] }), el('span', { class: 'tx', text: l.text }), l.pts ? el('span', { class: 'pt', text: sign(l.pts) }) : null]);
      })) : null,
      el('p', { class: 'lesson', text: item.task.lesson }),
      el('button', { class: 'btn', type: 'button', text: last ? 'See your score' : endRound ? 'Next round' : 'Next task', onclick: function () {
        sh.remove(); S.i++;
        if (last) return finish();
        if (endRound) return K.roundOverlay(main, L.data.rounds, S.d[S.i].round, show, NOTES[S.d[S.i].round]);
        show();
      } }),
    ]);
    app.appendChild(sh);
    setTimeout(function () { var b = sh.querySelector('.btn'); if (b) b.focus(); }, 60);
  }

  function finish() {
    var res = L.replay(S.run.seed, S.moves), d = res.detail, remember = [];
    remember.push(['Every plug is power, and risk.', d.extras ? 'You plugged in ' + d.extras + ' tool' + (d.extras > 1 ? 's' : '') + ' a task didn’t need. Give each task only what it needs: that’s least privilege.' : 'You never plugged in more than a task needed. That’s least privilege.']);
    remember.push(['Read-only beats read-and-write.', 'If a task only reads, a mistake or a trick can’t change or send anything.']);
    remember.push(['A tool’s description is instructions for the AI.', 'With MCP, a connected tool’s description goes straight into what the AI reads. In April 2025, researchers at Invariant Labs demonstrated hidden orders like these making a real AI coding app leak a user’s SSH key.']);
    if (d.poisoned) remember.push(['Star ratings are not a security check.', 'You plugged in ' + d.poisoned + ' poisoned tool' + (d.poisoned > 1 ? 's' : '') + '. Tools with a great rating can still lie to the AI.']);
    remember.push(['The store showed a summary. The AI read everything.', 'App screens often show a short version of a tool. Check what the AI will actually read.']);
    K.results(main, G, S.run, res, {
      title: d.poisoned ? 'A stranger’s plug got in.' : d.done === 9 && !d.extras ? 'Just enough, every time.' : 'Powerful agent. Risky agent.',
      stats: [[d.done + '/9', 'tasks done'], [String(d.extras), 'extra plugs'], [d.refused + '/3', 'poisoned plugs refused']],
      remember: remember, onAgain: start,
    });
  }

  K.intro(main, G, start);
})();
