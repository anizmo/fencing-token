/* Downhill: the physics frame. Training a model = rolling a ball down a "mistake curve" (the loss).
   You pick the learning rate (step size); each step moves the ball by learning rate x slope, downhill.
   Round 2 adds a shallow dip that traps small steps. Round 3 adds poisoned batches whose arrows lie. */
(function () {
  'use strict';
  var K = window.FTKit, el = K.el, L = window.FTGames['downhill'];
  var main = document.getElementById('main');
  var NS = 'http://www.w3.org/2000/svg';
  var G = {
    logic: L, title: 'Downhill', kicker: 'Fencing Token Arcade · Act 1',
    pitch: 'Training an AI model is rolling downhill on a curve of its mistakes. You choose how big each step is. Too small crawls. Too big flies off.',
    meta: '3 rounds · about 2 minutes · no typing',
    howto: [
      { cls: 'ask', glyph: '1', text: 'Pick a step size (the learning rate)' },
      { cls: 'allow', glyph: '2', text: 'Tap Step. Reach the lowest point in few steps' },
      { cls: 'deny', glyph: '3', text: 'Watch out: some data lies' },
    ],
    nextGame: { href: '/play/husky-or-wolf/', title: 'Husky or Wolf?' },
    shareText: function (s) { return 'I rolled an AI model downhill to fewer mistakes and dodged poisoned data: ' + s + ' points in Downhill. Your turn:'; },
    next: [
      { href: '/concepts/?lens=everyone#red-teaming-and-evals', text: 'Red teaming and evals, explained three ways', sub: 'How people test a model before trusting it.' },
    ],
  };
  var NOTES = [
    'Learning rate = how big a step the model takes each time it learns. Each step moves the ball by learning rate × slope. Reach the green flag in as few steps as you can.',
    'A new hill: a shallow dip first, a deeper valley after. Last round’s best step may not work here.',
    'Each step now learns from a new batch of data. A saboteur poisoned some batches, and their arrows lie. Skip any batch you don’t trust.',
  ];
  var S, size = 1;   // remembered step size across rounds (starts on Small)

  function sv(tag, attrs, kids) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function fx(n, d) { var v = Math.abs(n) < 0.05 ? 0 : n; return v.toFixed(d === undefined ? 1 : d); }
  function sgn(n) { return n > 0 ? 1 : n < 0 ? -1 : 0; }
  var raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function (f) { return setTimeout(function () { f(Date.now()); }, 16); };
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function tween(ms, fn, done) {
    if (still) ms = Math.min(ms, 120);
    var t0 = Date.now();
    (function tick() { var t = Math.min(1, (Date.now() - t0) / ms); fn(t); if (t < 1) raf(tick); else done(); })();
  }

  function start() {
    var b = main.querySelector('.btn'); if (b) { b.disabled = true; b.textContent = 'Starting…'; }
    K.startRun(L).then(function (run) {
      S = { run: run, d: L.deck(run.seed), levels: [[], [], []], li: 0, total: 0, sum: [] };
      run.moves = { levels: S.levels };
      K.roundOverlay(main, L.data.rounds, 0, play, NOTES[0]);
    });
  }

  // ---------------------------------------------------------------- the hill (SVG)
  function Chart(lv) {
    var Wp = 340, Hp = 214, pl = 10, pr = 10, pt = 22, pb = 30, max = 0, i, x;
    for (i = 0; i <= 200; i++) max = Math.max(max, L.loss(lv, i / 20));
    max *= 1.04;
    var sx = (Wp - pl - pr) / L.W, sy = (Hp - pt - pb) / max;
    var X = function (x) { return pl + x * sx; }, Y = function (v) { return pt + (max - v) * sy; };
    var pts = []; for (i = 0; i <= 200; i++) { x = i / 20; pts.push(X(x).toFixed(1) + ',' + Y(L.loss(lv, x)).toFixed(1)); }
    var gid = 'dhg' + lv.i;
    var ball = sv('g', { class: 'dh-ball' }, [sv('circle', { r: 10, cx: 0, cy: 0 }), sv('circle', { class: 'shine', r: 3, cx: -3, cy: -3 })]);
    var trail = sv('g', { class: 'dh-trail' }), arrow = sv('g', { class: 'dh-arrow' }), marks = sv('g', {});
    var grid = [];
    for (i = 1; i < 4; i++) grid.push(sv('line', { class: 'dh-grid', x1: pl, x2: Wp - pr, y1: pt + i * (Hp - pt - pb) / 4, y2: pt + i * (Hp - pt - pb) / 4 }));
    var gx = X(lv.goal), base = Hp - pb;
    var svg = sv('svg', { class: 'dh-svg', viewBox: '0 0 ' + Wp + ' ' + Hp, role: 'img', 'aria-label': 'The mistake curve. The ball is the model. Lower means fewer mistakes.' }, [
      sv('defs', {}, [sv('linearGradient', { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, [sv('stop', { offset: '0', 'stop-color': '#F4A62A', 'stop-opacity': '0.28' }), sv('stop', { offset: '1', 'stop-color': '#F4A62A', 'stop-opacity': '0' })])]),
      sv('g', {}, grid),
      sv('rect', { class: 'dh-goal', x: X(lv.goal - lv.tol), y: pt - 8, width: 2 * lv.tol * sx, height: base - pt + 8 }),
      sv('path', { d: 'M' + pts.join(' L') + ' L' + X(L.W) + ',' + base + ' L' + X(0) + ',' + base + ' Z', fill: 'url(#' + gid + ')' }),
      sv('path', { class: 'dh-curve', d: 'M' + pts.join(' L') }),
      sv('line', { class: 'dh-axis', x1: pl, x2: Wp - pr, y1: base, y2: base }),
      sv('g', { class: 'dh-flag', transform: 'translate(' + gx.toFixed(1) + ',' + (Y(L.loss(lv, lv.goal)) + 4).toFixed(1) + ')' }, [sv('line', { x1: 0, y1: 0, x2: 0, y2: -30 }), sv('path', { d: 'M0,-30 L14,-25 L0,-20 Z' })]),
      sv('text', { class: 'dh-lbl', x: pl, y: 13 }, ['↑ more mistakes']),
      sv('text', { class: 'dh-lbl', x: Wp / 2, y: Hp - 9, 'text-anchor': 'middle' }, ['one setting of the model →']),
      marks, trail, arrow, ball,
    ]);
    var c = { svg: svg, X: X, Y: Y, max: max };
    c.place = function (x, y, op) { ball.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')'); ball.style.opacity = op === undefined ? '' : String(op); };
    c.at = function (x) { c.place(X(x), Y(L.loss(lv, x))); };
    c.dot = function (x) {
      trail.appendChild(sv('circle', { cx: X(x).toFixed(1), cy: Y(L.loss(lv, x)).toFixed(1), r: 3.2 }));
      var dots = trail.childNodes; for (var j = 0; j < dots.length; j++) dots[j].style.opacity = String(0.15 + 0.6 * (j + 1) / dots.length);
    };
    c.arrow = function (x, reading) {
      arrow.replaceChildren();
      if (Math.abs(reading) < 0.05) return;
      var s = L.slope(lv, x), vx = sx, vy = -s * sy, n = Math.sqrt(vx * vx + vy * vy); vx /= n; vy /= n;
      var dir = reading > 0 ? -1 : 1; vx *= dir; vy *= dir;
      var len = Math.max(20, Math.min(70, 16 + Math.abs(reading) * 1.4)), bx = X(x), by = Y(L.loss(lv, x)) - 13;
      var x1 = bx + vx * 4, y1 = by + vy * 4, x2 = bx + vx * len, y2 = by + vy * len, px = -vy, py = vx;
      arrow.appendChild(sv('line', { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: (x2 - vx * 7).toFixed(1), y2: (y2 - vy * 7).toFixed(1) }));
      arrow.appendChild(sv('path', { d: 'M' + x2.toFixed(1) + ',' + y2.toFixed(1) + ' L' + (x2 - vx * 9 + px * 5).toFixed(1) + ',' + (y2 - vy * 9 + py * 5).toFixed(1) + ' L' + (x2 - vx * 9 - px * 5).toFixed(1) + ',' + (y2 - vy * 9 - py * 5).toFixed(1) + ' Z' }));
    };
    c.mark = function (x, text, cls) {
      var mx = X(x), anchor = mx > Wp - 60 ? 'end' : mx < 60 ? 'start' : 'middle';
      marks.appendChild(sv('g', { class: 'dh-mark ' + (cls || '') }, [sv('line', { x1: mx, x2: mx, y1: pt, y2: base }), sv('text', { x: mx + (anchor === 'end' ? -4 : anchor === 'start' ? 4 : 0), y: base - 6, 'text-anchor': anchor }, [text])]));
    };
    c.hop = function (from, to, done) {
      var X1 = X(from), Y1 = Y(L.loss(lv, from)) - 10, X2 = X(to), Y2 = Y(L.loss(lv, to)) - 10, hop = Math.min(70, 12 + Math.abs(X2 - X1) * 0.35);
      arrow.replaceChildren();
      tween(Math.min(720, 380 + Math.abs(X2 - X1) * 1.2), function (t) { c.place(X1 + (X2 - X1) * t, Y1 + (Y2 - Y1) * t - hop * Math.sin(Math.PI * t)); }, done);
    };
    c.blow = function (from, land, x0, done) {   // the step left the chart: fly off, then respawn at the start
      var X1 = X(from), Y1 = Y(L.loss(lv, from)) - 10, X2 = land < 0 ? -40 : Wp + 40;
      arrow.replaceChildren();
      tween(560, function (t) { c.place(X1 + (X2 - X1) * t, Y1 - 150 * t + 40 * t * t, 1 - t * 0.6); }, function () {
        svg.classList.add('dh-boom');
        setTimeout(function () { svg.classList.remove('dh-boom'); c.place(X(x0), Y(L.loss(lv, x0)) - 10, 0); tween(260, function (t) { c.place(X(x0), Y(L.loss(lv, x0)) - 10, t); }, done); }, 260);
      });
    };
    c.rest = function (x) { c.place(X(x), Y(L.loss(lv, x)) - 10); };
    return c;
  }

  // ---------------------------------------------------------------- one round
  function play() {
    var li = S.li, lv = S.d[li], st = L.newState(lv), mv = S.levels[li], round = L.data.rounds[li];
    var tLast = Date.now(), busy = false, chart = Chart(lv), poisonShown = false;
    var stepsEl = el('p', { class: 'small', style: 'margin:4px 0 0' });
    var scoreEl = el('span', { class: 'score', 'aria-label': 'Score', text: K.fmt(S.total) });
    var mistakes = el('b', {}), delta = el('span', { class: 'dh-delta' });
    var reading = el('p', { class: 'dh-read' });
    var say = el('p', { class: 'dh-say', 'aria-live': 'polite', text: li === 2 ? 'Read each batch’s arrow before you trust it.' : 'Pick a step size, then tap Step.' });
    var sizeBtns = L.SIZES.map(function (z, k) {
      return el('button', { type: 'button', class: 'dh-size', 'aria-pressed': k === size ? 'true' : 'false', onclick: function () { size = k; drawSizes(); readout(); } },
        [el('span', { class: 'n', text: z.name }), el('span', { class: 'lr', text: String(z.lr) })]);
    });
    var stepBtn = el('button', { class: 'btn dh-step', type: 'button', text: 'Step', onclick: function () { act(size); } });
    var skipBtn = lv.batches ? el('button', { class: 'btn ghost dh-skip', type: 'button', text: 'Skip batch', onclick: function () { act(L.SKIP); } }) : null;
    var stopBtn = el('button', { class: 'dh-stop', type: 'button', text: 'Stop here', onclick: function () { act(L.STOP); } });
    var controls = el('div', { class: 'dh-controls' }, [
      el('div', { class: 'dh-sizes', role: 'group', 'aria-label': 'Step size (learning rate)' }, sizeBtns),
      el('div', { class: 'dh-acts' + (skipBtn ? ' three' : '') }, [stopBtn, skipBtn, stepBtn]),
    ]);

    function drawSizes() { sizeBtns.forEach(function (b, k) { b.setAttribute('aria-pressed', k === size ? 'true' : 'false'); }); }
    function current() { return L.reading(lv, st.n, st.x); }
    function readout() {
      var m = Math.round(L.loss(lv, st.x));
      mistakes.textContent = String(m);
      stepsEl.textContent = 'Step ' + st.n + ' of ' + lv.limit + ' · fewest possible: ' + lv.par;
      if (st.done) { reading.replaceChildren(); chart.arrow(st.x, 0); return; }
      var r = current(), lr = L.SIZES[size].lr, move = lr * Math.abs(r), way = r > 0 ? '←' : '→';
      chart.arrow(st.x, r);
      reading.replaceChildren.apply(reading, [
        lv.batches ? el('span', { class: 'dh-batch', text: 'Batch ' + (st.n + 1) + ' of ' + lv.limit + ' says' }) : el('span', { class: 'dh-batch', text: 'Slope here' }),
        el('b', { text: (r < 0 ? '−' : '') + fx(Math.abs(r)) }),
        el('span', { class: 'dh-calc', text: Math.abs(r) < 0.05 ? 'flat: no step will move you' : 'step = ' + lr + ' × ' + fx(Math.abs(r)) + ' = ' + fx(move) + ' ' + way }),
      ]);
    }
    function lock(on) { busy = on; [stepBtn, skipBtn, stopBtn].concat(sizeBtns).forEach(function (b) { if (b) b.disabled = on; }); }

    function act(k) {
      if (busy || st.done) return;
      var now = Date.now(); if (now - tLast < 320) return;   // the server rejects moves faster than a human
      mv.push([k, Math.min(120000, now - tLast)]); tLast = now;
      var prevX = st.x, prevL = L.loss(lv, st.x);
      var ev = L.step(lv, st, k);
      K.vibrate(ev.blew || (ev.poisoned && !ev.skipped) ? [20, 40, 20] : 12);
      lock(true);
      var after = function () { lock(false); land(ev, prevX, prevL); };
      if (ev.k === L.STOP || ev.skipped) after();
      else if (ev.blew) chart.blow(prevX, ev.land, lv.x0, after);
      else { chart.dot(prevX); chart.hop(prevX, ev.to, after); }
    }

    function land(ev, prevX, prevL) {
      var newL = L.loss(lv, st.x), dM = Math.round(prevL) - Math.round(newL), msg;
      chart.rest(st.x);
      delta.textContent = ev.k === L.STOP || ev.skipped ? '' : dM > 0 ? '▼ ' + dM : dM < 0 ? '▲ ' + (-dM) : '±0';
      delta.className = 'dh-delta ' + (dM > 0 ? 'down' : dM < 0 ? 'up' : '');
      if (ev.poisoned && !poisonShown) { poisonShown = true; chart.mark(lv.poison.at, 'saboteur’s spot', 'bad'); }
      var trapSide = lv.trap !== null && sgn(st.x - lv.hump) === sgn(lv.trap - lv.hump);
      if (ev.k === L.STOP) msg = 'You stopped training here.';
      else if (ev.skipped) msg = ev.poisoned ? 'Caught it! That batch was poisoned. +50' : 'That batch was clean. Skipping it cost a step.';
      else if (ev.blew) msg = 'Training blew up! The step was so big it flew off the chart. Back to the start.';
      else if (ev.poisoned) msg = 'That batch was poisoned. It pulled you uphill, toward the saboteur’s spot.';
      else if (st.result === 'goal') msg = 'Bottom reached!';
      else if (lv.trap !== null && !trapSide && sgn(prevX - lv.hump) === sgn(lv.trap - lv.hump)) msg = 'Jumped the hump! A big step cleared the shallow dip.';
      else if (trapSide && Math.abs(st.x - prevX) < 0.03) msg = 'Stuck. The slope here is flat, so training stops moving. Is this the lowest point?';
      else if (trapSide && Math.abs(st.x - lv.trap) < 0.6) msg = 'A shallow dip. Small steps can’t climb out of it.';
      else if (sgn(st.x - lv.goal) !== sgn(prevX - lv.goal)) msg = newL > prevL ? 'Overshot! Too big a step: mistakes went up.' : 'Overshot the bottom, but mistakes still went down.';
      else if (Math.abs(st.x - prevX) < 0.8) msg = 'Safe but slow. This step size crawls.';
      else msg = 'Mistakes down ' + Math.max(0, dM) + '. Keep going.';
      say.textContent = msg;
      say.className = 'dh-say ' + (ev.blew || (ev.poisoned && !ev.skipped) || /Overshot!|Stuck/.test(msg) ? 'bad' : /Caught|Bottom|Jumped/.test(msg) ? 'good' : '');
      readout();
      if (st.done) end();
      else setTimeout(function () { if (!busy && stepBtn.isConnected) stepBtn.focus({ preventScroll: true }); }, 30);
    }

    function end() {
      var pts = L.levelPoints(lv, st), last = li === S.d.length - 1;
      S.total += pts; S.sum.push({ result: st.result, steps: st.n, pts: pts, caught: st.caught, trusted: st.trusted });
      scoreEl.textContent = K.fmt(S.total);
      var head, lesson;
      if (st.result === 'goal') {
        head = 'Bottom reached in ' + st.n + ' step' + (st.n > 1 ? 's' : '') + ' · +' + pts;
        lesson = [
          'Just-right steps get there fastest. Too big overshoots, too small crawls.',
          'Big step early, smaller step near the bottom. Real training often shrinks the step over time too.',
          st.trusted ? 'You got there, but every poisoned batch you trusted pushed you back.' : 'You reached the real bottom by refusing bad data.',
        ][li];
      } else {
        head = (st.result === 'stop' ? 'Stopped' : 'Out of steps') + ' at ' + Math.round(L.loss(lv, st.x)) + ' mistakes · +' + pts;
        lesson = li === 1 && lv.trap !== null && sgn(st.x - lv.hump) === sgn(lv.trap - lv.hump)
          ? 'Stuck in the shallow dip. A model only feels the slope where it stands, so it can settle for a worse answer.'
          : li === 2 ? 'Poisoned batches kept pulling the model off course. Training follows the data, good or bad.'
          : 'Not quite the bottom. Try a bigger step, but not too big.';
      }
      if (lv.batches && st.caught) lesson += ' Poison caught: ' + st.caught + ' (+' + 50 * st.caught + ').';
      controls.replaceChildren(el('div', { class: 'feedback' }, [
        el('p', { class: 'big', text: head }),
        el('p', { text: lesson }),
        el('button', { class: 'btn', type: 'button', text: last ? 'See your score' : 'Next round', onclick: function () {
          if (last) return finish();
          S.li++; K.roundOverlay(main, L.data.rounds, S.li, play, NOTES[S.li]);
        } }),
      ]));
      setTimeout(function () { var b = controls.querySelector('.btn'); if (b) { b.focus({ preventScroll: true }); b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, 80);
    }

    main.replaceChildren(el('section', { class: 'screen dh' }, [
      el('div', { class: 'hud' }, [el('div', {}, [el('p', { class: 'kicker', style: 'margin:0', text: round.name + ' · ' + round.title }), stepsEl]), scoreEl]),
      el('div', { class: 'dh-chart' }, [chart.svg]),
      el('div', { class: 'dh-stats' }, [el('div', { class: 'dh-m' }, [mistakes, el('span', { text: 'mistakes' }), delta]), reading]),
      say,
      controls,
      el('p', { class: 'disclaimer', text: 'Illustrative: a real model has millions or billions of settings, so its hill has that many directions. The downhill rule is the same.' }),
    ]));
    chart.rest(st.x);
    readout();
  }

  function finish() {
    var res = L.replay(S.run.seed, S.run.moves), log = res.log || [];
    var goals = log.filter(function (l) { return l.result === 'goal'; }).length, steps = log.reduce(function (a, l) { return a + l.steps; }, 0);
    var r3 = log[2] || { caught: 0, trusted: 0 }, seen = r3.caught + r3.trusted, remember = [];
    remember.push(['Learning rate is the step size.', 'Too small takes forever. Too big overshoots, or the mistakes blow up.']);
    if (log[1] && log[1].result !== 'goal') remember.push(['A model can settle in a shallow dip.', 'It only feels the slope under its feet, so “flat” can look like “done”.']);
    else remember.push(['A model only feels the slope under its feet.', 'It can settle in a shallow dip. A bigger early step got you over the hump.']);
    if (r3.trusted) remember.push(['You trusted ' + r3.trusted + ' poisoned batch' + (r3.trusted > 1 ? 'es' : '') + '.', 'Each one steered the model toward where the saboteur wanted it.']);
    remember.push(['Training is only as trustworthy as its data.', 'Poisoned data quietly moves the model. Knowing where data came from is a security question.']);
    remember.push(['“Loss” is the real name for the mistake curve.', 'Lower loss means a less wrong model. Rolling downhill on it is called gradient descent.']);
    K.results(main, G, S.run, res, {
      title: res.score >= L.stars[2] ? 'Smooth descent.' : goals >= 2 ? 'You found the bottom.' : 'Steps are harder than they look.',
      stats: [[goals + '/3', 'bottoms reached'], [String(steps), 'steps taken'], [r3.caught + '/' + seen, 'poison caught']],
      remember: remember, onAgain: start,
    });
  }

  K.intro(main, G, start);
})();
