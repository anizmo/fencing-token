/* The Dial: temperature. Turn the dial and watch the next-word odds sharpen or flatten, guess which setting
   wrote each output, set the dial for real jobs, then catch the made-up fact (it can come from any setting). */
(function () {
  'use strict';
  var K = window.FTKit, el = K.el, L = window.FTGames['the-dial'];
  var main = document.getElementById('main');
  var NS = 'http://www.w3.org/2000/svg';
  var G = {
    logic: L, title: 'The Dial', kicker: 'Fencing Token Arcade · Act 2',
    pitch: 'Every chatbot has a hidden dial called temperature. Turn it down and it gets predictable. Turn it up and it gets creative, or weird. Learn to read it.',
    meta: '3 rounds · about 2 minutes · no typing',
    howto: [
      { cls: 'ask', glyph: '1', text: 'Turn the dial, watch the odds change' },
      { cls: 'allow', glyph: '2', text: 'Guess the setting, then set it for real jobs' },
      { cls: 'deny', glyph: '3', text: 'Catch the made-up fact' },
    ],
    nextGame: { href: '/play/pack-the-suitcase/', title: 'Pack the Suitcase' },
    shareText: function (s) { return 'I learned to read a chatbot’s temperature dial and caught its made-up facts: ' + s + ' points in The Dial. Your turn:'; },
    next: [
      { href: '/concepts/?lens=everyone#temperature', text: 'Temperature, explained three ways', sub: 'For everyone, for engineers, for experts.' },
      { href: '/concepts/?lens=everyone#guardrails', text: 'Guardrails, explained three ways', sub: 'Why checks have to live outside the model.' },
    ],
  };
  var SET = L.SETTINGS, CLS = ['lo', 'mid', 'hi'];
  var CAPTION = [
    'At 0 the top word always wins. Same answer every time.',
    'At 0.7 the top word usually wins. Others sometimes.',
    'At 1.5 the odds flatten. Even “homework” gets a real chance.',
  ];
  var S;

  function sv(tag, attrs, kids) {
    var n = document.createElementNS(NS, tag);
    for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  var raf = window.requestAnimationFrame ? window.requestAnimationFrame.bind(window) : function (f) { return setTimeout(f, 16); };
  var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function chip(s, extra) { return el('span', { class: 'td-chip ' + CLS[s] + (extra ? ' ' + extra : ''), text: SET[s].name + ' · ' + SET[s].t }); }
  function hud(title, sub) {
    return el('div', { class: 'hud' }, [
      el('div', {}, [el('p', { class: 'kicker', style: 'margin:0', text: title }), sub ? el('p', { class: 'small', style: 'margin:4px 0 0', text: sub }) : null]),
      el('span', { class: 'score', 'aria-label': 'Score', text: K.fmt(S.pts) }),
    ]);
  }
  function focusLater(sel) { setTimeout(function () { var b = main.querySelector(sel); if (b) { b.focus({ preventScroll: true }); b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, 80); }

  // ---------------------------------------------------------------- the dial
  // opts: { value: 0..2 or null, onChange(v), interactive, small }
  function Dial(opts) {
    var cx = 120, cy = 126, r = 92, value = opts.value, angle = value === null ? 90 : ang(value), cur = angle;
    function ang(v) { return 180 - (SET[v].t / 1.5) * 180; }
    function pt(a, rr) { var rad = a * Math.PI / 180; return [cx + rr * Math.cos(rad), cy - rr * Math.sin(rad)]; }
    function arc(a1, a2, rr) { var p = pt(a1, rr), q = pt(a2, rr); return 'M' + p[0].toFixed(1) + ',' + p[1].toFixed(1) + ' A' + rr + ',' + rr + ' 0 0 1 ' + q[0].toFixed(1) + ',' + q[1].toFixed(1); }
    var needle = sv('g', {}, [sv('line', { class: 'td-needle', x1: cx, y1: cy, x2: cx + r - 18, y2: cy }), sv('circle', { class: 'td-hub', cx: cx, cy: cy, r: 11 })]);
    var ticks = [0, 1, 2].map(function (v) {
      var a = ang(v), p1 = pt(a, r + 4), p2 = pt(a, r - 14), lp = pt(a, r + 18);
      return sv('g', { class: 'td-tick' }, [sv('line', { x1: p1[0].toFixed(1), y1: p1[1].toFixed(1), x2: p2[0].toFixed(1), y2: p2[1].toFixed(1) }),
        sv('text', { x: lp[0].toFixed(1), y: (lp[1] + 4).toFixed(1), 'text-anchor': v === 0 ? 'end' : v === 2 ? 'start' : 'middle' }, [String(SET[v].t)])]);
    });
    var readout = sv('text', { class: 'td-val', x: cx, y: cy + 44, 'text-anchor': 'middle' }, ['?']);
    var name = sv('text', { class: 'td-name', x: cx, y: cy + 62, 'text-anchor': 'middle' }, ['']);
    var svg = sv('svg', { class: 'td-dial' + (opts.small ? ' small' : ''), viewBox: '-22 0 284 196', 'aria-hidden': 'true' }, [
      sv('path', { class: 'td-arc lo', d: arc(180, 122, r) }), sv('path', { class: 'td-arc mid', d: arc(118, 62, r) }), sv('path', { class: 'td-arc hi', d: arc(58, 0, r) }),
      sv('g', {}, ticks), readout, name, needle,
    ]);
    var btns = [], wrap;
    function draw() {
      needle.setAttribute('transform', 'rotate(' + (-cur).toFixed(1) + ' ' + cx + ' ' + cy + ')');
      readout.textContent = value === null ? '?' : String(SET[value].t);
      name.textContent = value === null ? 'temperature' : SET[value].name;
      svg.setAttribute('class', 'td-dial' + (opts.small ? ' small' : '') + (value === null ? '' : ' ' + CLS[value]));
      btns.forEach(function (b, k) { if (k < 3) b.setAttribute('aria-pressed', value === k ? 'true' : 'false'); });
      if (wrap) { wrap.setAttribute('aria-valuenow', value === null ? '0.7' : String(SET[value].t)); wrap.setAttribute('aria-valuetext', value === null ? 'not set' : SET[value].name + ', ' + SET[value].t); }
    }
    function turnTo(target) {
      var from = cur, t0 = Date.now(), ms = still ? 1 : 380;
      (function tick() {
        var t = Math.min(1, (Date.now() - t0) / ms), e = 1 - Math.pow(1 - t, 3);
        cur = from + (target - from) * e + (t < 1 ? Math.sin(t * Math.PI) * 3 : 0); draw();
        if (t < 1) raf(tick); else { cur = target; draw(); }
      })();
    }
    function set(v, quiet) {
      if (v < 0 || v > 2) return; var changed = v !== value; value = v; turnTo(ang(v));
      if (!quiet && opts.onChange) opts.onChange(v, changed);
      if (!quiet) K.vibrate(8);
    }
    if (opts.interactive) {
      btns = [0, 1, 2].map(function (v) {
        return el('button', { type: 'button', class: 'td-det ' + CLS[v], 'aria-pressed': 'false', onclick: function () { set(v); } }, [el('b', { text: SET[v].name }), el('span', { text: String(SET[v].t) })]);
      });
      var minus = el('button', { type: 'button', class: 'td-pm', 'aria-label': 'Turn the dial down', text: '−', onclick: function () { set(value === null ? 0 : Math.max(0, value - 1)); } });
      var plus = el('button', { type: 'button', class: 'td-pm', 'aria-label': 'Turn the dial up', text: '+', onclick: function () { set(value === null ? 2 : Math.min(2, value + 1)); } });
      wrap = el('div', { class: 'td-dialwrap', role: 'slider', tabindex: '0', 'aria-label': 'Temperature dial', 'aria-valuemin': '0', 'aria-valuemax': '1.5',
        onkeydown: function (e) {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); set(value === null ? 0 : Math.max(0, value - 1)); }
          if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); set(value === null ? 2 : Math.min(2, value + 1)); }
        },
        onclick: function (e) {   // tap the left, middle or right of the dial to jump there
          var b = svg.getBoundingClientRect(); if (!b.width) return;
          var f = (e.clientX - b.left) / b.width; set(f < 0.36 ? 0 : f > 0.64 ? 2 : 1);
        } }, [svg]);
      var node = el('div', { class: 'td-dialbox' }, [wrap, el('div', { class: 'td-dets' }, [minus].concat(btns, [plus]))]);
      btns.push(minus, plus);
      draw();
      return { node: node, set: set, get: function () { return value; }, lock: function (on) { btns.forEach(function (b) { b.disabled = on; }); wrap.style.pointerEvents = on ? 'none' : ''; } };
    }
    draw();
    return { node: el('div', { class: 'td-dialbox' }, [svg]), set: set, get: function () { return value; }, lock: function () {} };
  }

  // ---------------------------------------------------------------- flow
  function start() {
    var b = main.querySelector('.btn'); if (b) { b.disabled = true; b.textContent = 'Starting…'; }
    K.startRun(L).then(function (run) {
      S = { run: run, d: L.deck(run.seed), r1: [], r2: [], r3: [], pts: 0, i: 0 };
      run.moves = { r1: S.r1, r2: S.r2, r3: S.r3 };
      K.roundOverlay(main, L.data.rounds, 0, oddsScreen, 'Temperature is a setting that controls how a model picks its next word. Turn the dial and watch.');
    });
  }

  // round 1a: the odds bars, reshaped by the dial (not scored)
  function oddsScreen() {
    var o = L.data.odds, seen = [false, false, false];
    var bars = o.opts.map(function (op) {
      var bar = el('span', { class: 'bar' }), pct = el('span', { class: 'pct', text: ' ' });
      return { node: el('div', { class: 'choice td-odd' }, [bar, el('span', { class: 'w', text: op[0] }), pct]), bar: bar, pct: pct };
    });
    var cap = el('p', { class: 'td-cap', 'aria-live': 'polite', text: 'Turn the dial to each of the 3 settings.' });
    var samples = el('div', { class: 'td-samples', 'aria-live': 'polite' });
    var marks = el('div', { class: 'td-seen', 'aria-label': 'Settings tried' });
    var go = el('button', { class: 'btn', type: 'button', text: 'Try all 3 settings', disabled: true, onclick: function () { S.i = 0; matchScreen(); } });
    var sampleBtn = el('button', { class: 'btn ghost', type: 'button', text: 'Pick 5 words at this setting', disabled: true, onclick: sample });
    function sample() {
      var v = dial.get(); if (v === null) return;
      var p = L.odds(o.opts, SET[v].t), words = [];
      for (var n = 0; n < 5; n++) { var x = Math.random(), k = 0, acc = p[0]; while (x > acc && k < p.length - 1) { k++; acc += p[k]; } words.push(o.opts[k][0]); }
      samples.replaceChildren.apply(samples, words.map(function (w, n) { return el('span', { class: 'td-word', style: 'animation-delay:' + (n * 70) + 'ms', text: w }); }));
    }
    function show(v) {
      var p = L.odds(o.opts, SET[v].t), top = 0;
      p.forEach(function (x, k) { if (x > p[top]) top = k; });
      bars.forEach(function (b, k) {
        var pc = p[k] * 100, txt = pc === 0 ? '0%' : pc < 1 ? '<1%' : Math.round(pc) + '%';
        b.bar.style.width = pc.toFixed(1) + '%'; b.pct.textContent = txt; b.node.classList.toggle('top', k === top);
      });
      cap.textContent = CAPTION[v];
      seen[v] = true; samples.replaceChildren(); sampleBtn.disabled = false;
      marks.replaceChildren.apply(marks, [0, 1, 2].map(function (k) { return el('span', { class: seen[k] ? 'on' : '', text: (seen[k] ? '✓ ' : '') + SET[k].name }); }));
      var left = seen.filter(function (s) { return !s; }).length;
      go.disabled = left > 0; go.textContent = left ? 'Try ' + left + ' more setting' + (left > 1 ? 's' : '') : 'Now guess the settings';
    }
    var dial = Dial({ value: null, interactive: true, onChange: function (v) { show(v); } });
    marks.replaceChildren.apply(marks, [0, 1, 2].map(function (k) { return el('span', { text: SET[k].name }); }));
    main.replaceChildren(el('section', { class: 'screen td' }, [
      hud('Round 1 · Turn the dial', 'Same prompt. Same four words. Watch the odds.'),
      el('p', { class: 'prompt td-prompt' }, [o.text + ' ', el('span', { class: 'blank', text: '____' })]),
      el('div', { class: 'td-odds' }, bars.map(function (b) { return b.node; })),
      cap, dial.node, marks, samples,
      el('div', { class: 'cta static' }, [sampleBtn, go]),
      el('p', { class: 'disclaimer', text: 'Illustrative odds among these four words. Real models choose from thousands of words.' }),
    ]));
  }

  // round 1b: which card came from which setting? (ask Focused, then Wild; the last one is Balanced)
  function matchScreen() {
    var item = S.d.r1[S.i], t0 = Date.now(), picks = [], ask = [0, 2];
    var q = el('p', { class: 'td-q', 'aria-live': 'polite' });
    var dial = Dial({ value: 0, small: true });
    var fb = el('div', { 'aria-live': 'polite' });
    var cards = item.cards.map(function (s, k) {
      var tag = el('span', { class: 'td-tag' });
      var b = el('button', { type: 'button', class: 'td-out', onclick: function () { pick(k); } }, [el('span', { class: 'td-letter', text: 'ABC'[k] }), el('span', { class: 'td-txt', text: item.p.outs[s] }), tag]);
      b._tag = tag; return b;
    });
    function ask0() { q.replaceChildren('Which one came from ', el('b', { text: SET[ask[picks.length]].name + ' (' + SET[ask[picks.length]].t + ')' }), '?'); }
    function pick(k) {
      if (picks.indexOf(k) >= 0 || picks.length >= 2) return;
      if (picks.length === 1 && Date.now() - t0 < 600) return;   // the server rejects impossibly fast rounds
      picks.push(k); K.vibrate(10);
      cards[k]._tag.replaceChildren(chip(ask[picks.length - 1], 'guess')); cards[k].classList.add('picked');
      if (picks.length === 1) { dial.set(2, true); ask0(); return; }
      var rest = 3 - picks[0] - picks[1];
      S.r1.push([picks[0], picks[1], Math.min(120000, Date.now() - t0)]);
      var guess = []; guess[picks[0]] = 0; guess[picks[1]] = 2; guess[rest] = 1;
      var right = 0;
      cards.forEach(function (c, j) {
        var ok = guess[j] === item.cards[j]; if (ok) right++;
        c.disabled = true; c.classList.add(ok ? 'right' : 'wrong');
        c._tag.replaceChildren(chip(item.cards[j]), el('span', { class: 'td-mark', text: ok ? '✓' : '✗ you said ' + SET[guess[j]].name }));
      });
      S.pts += right * 100; main.querySelector('.score').textContent = K.fmt(S.pts);
      q.textContent = 'Here’s which setting wrote each one.';
      var last = S.i === S.d.r1.length - 1;
      fb.replaceChildren(el('div', { class: 'feedback' }, [
        el('p', { class: 'big', text: right === 3 ? '+300 · You read the dial.' : right ? '+' + right * 100 + ' · ' + right + ' of 3 right.' : 'No points this time.' }),
        el('p', { text: 'Focused picks the most likely word each time, so it reads plain and safe. Wild picks unlikely words more often, so it gets odd.' }),
        el('button', { class: 'btn', type: 'button', text: last ? 'Next round' : 'Next prompt', onclick: function () {
          S.i++;
          if (!last) return matchScreen();
          S.i = 0; K.roundOverlay(main, L.data.rounds, 1, jobScreen, 'Real apps set this dial for you. Now you set it. Pick a setting, then generate.');
        } }),
      ]));
      focusLater('.feedback .btn');
    }
    main.replaceChildren(el('section', { class: 'screen td' }, [
      hud('Round 1 · Turn the dial', 'Prompt ' + (S.i + 1) + ' of ' + S.d.r1.length),
      el('p', { class: 'td-ask', text: item.p.prompt }),
      el('div', { class: 'td-row' }, [dial.node, q]),
      el('div', { class: 'td-outs' }, cards),
      fb,
      el('p', { class: 'disclaimer', text: 'Illustrative outputs, written to show how real models behave.' }),
    ]));
    ask0();
  }

  // round 2: set the dial for the job, generate twice
  function jobScreen() {
    var item = S.d.r2[S.i], j = item.j, t0 = Date.now(), done = false;
    var gen = el('button', { class: 'btn', type: 'button', text: 'Set the dial first', disabled: true, onclick: generate });
    var dial = Dial({ value: null, interactive: true, onChange: function (v) { if (done) return; gen.disabled = false; gen.textContent = 'Generate at ' + SET[v].t; } });
    var out = el('div', { 'aria-live': 'polite' });
    function fill(t) { return t.replace('{code}', item.code); }
    function generate() {
      var v = dial.get(); if (done || v === null) return;
      if (Date.now() - t0 < 400) return;
      done = true; S.r2.push([v, Math.min(120000, Date.now() - t0)]);
      dial.lock(true); gen.remove();
      var p = j.pts[v], best = j.pts.indexOf(Math.max.apply(null, j.pts)), same = j.runs[v][0] === j.runs[v][1];
      S.pts += p; main.querySelector('.score').textContent = K.fmt(S.pts);
      K.vibrate(v === best ? 15 : [10, 40, 10]);
      var last = S.i === S.d.r2.length - 1;
      out.replaceChildren(
        el('div', { class: 'td-runs ' + CLS[v] }, [0, 1].map(function (k) {
          return el('div', { class: 'td-run', style: 'animation-delay:' + (k * 160) + 'ms' }, [el('span', { class: 'td-runlbl', text: 'Run ' + (k + 1) + (k === 1 && same ? ' · same text' : '') }), el('p', { text: fill(j.runs[v][k]) })]);
        })),
        el('div', { class: 'feedback' }, [
          el('p', { class: 'big', text: (p ? '+' + p : 'No points') + ' · ' + (v === best ? 'Right setting.' : 'Best here: ' + SET[best].name + ' (' + SET[best].t + ').') }),
          el('p', { text: j.why[v] }),
          el('button', { class: 'btn', type: 'button', text: last ? 'Next round' : 'Next job', onclick: function () {
            S.i++;
            if (!last) return jobScreen();
            S.i = 0; K.roundOverlay(main, L.data.rounds, 2, factScreen, 'Each answer below came from a different setting. One contains a made-up fact. Find it.');
          } }),
        ]));
      focusLater('.feedback .btn');
    }
    main.replaceChildren(el('section', { class: 'screen td' }, [
      hud('Round 2 · Set it for the job', 'Job ' + (S.i + 1) + ' of ' + S.d.r2.length),
      el('div', { class: 'td-job' }, [el('p', { class: 'lbl', text: 'The job' }), el('p', { class: 'task', text: j.job }), el('p', { class: 'td-need', text: j.need })]),
      dial.node,
      el('div', { class: 'cta static' }, [gen]),
      out,
      el('p', { class: 'disclaimer', text: 'Illustrative outputs, written to show how real models behave.' }),
    ]));
  }

  // round 3: spot the made-up fact
  function factScreen() {
    var item = S.d.r3[S.i], q = item.q, t0 = Date.now(), done = false, fb = el('div', { 'aria-live': 'polite' });
    var cards = item.cards.map(function (s, k) {
      var mark = el('span', { class: 'td-tag' }, [chip(s)]);
      var b = el('button', { type: 'button', class: 'td-out', onclick: function () { pick(k); } }, [el('span', { class: 'td-letter', text: 'ABC'[k] }), el('span', { class: 'td-txt', text: q.outs[s] }), mark]);
      b._tag = mark; return b;
    });
    function pick(k) {
      if (done || Date.now() - t0 < 400) return;
      done = true; S.r3.push([k, Math.min(120000, Date.now() - t0)]);
      var ok = item.cards[k] === q.fake, last = S.i === S.d.r3.length - 1;
      if (ok) { S.pts += 200; main.querySelector('.score').textContent = K.fmt(S.pts); }
      K.vibrate(ok ? 15 : [10, 40, 10]);
      cards.forEach(function (c, j) {
        c.disabled = true; var fake = item.cards[j] === q.fake;
        if (fake) { c.classList.add('fake'); c._tag.appendChild(el('span', { class: 'td-mark bad', text: '✗ made up' })); }
        else c._tag.appendChild(el('span', { class: 'td-mark', text: '✓ checks out' }));
        if (j === k) c.classList.add('picked');
      });
      fb.replaceChildren(el('div', { class: 'feedback' }, [
        el('p', { class: 'big', text: ok ? '+200 · Caught it.' : 'Missed it. The fake was the ' + SET[q.fake].name + ' one.' }),
        el('p', { text: q.why }),
        el('button', { class: 'btn', type: 'button', text: last ? 'See your score' : 'Next', onclick: function () { S.i++; if (last) finish(); else factScreen(); } }),
      ]));
      focusLater('.feedback .btn');
    }
    main.replaceChildren(el('section', { class: 'screen td' }, [
      hud('Round 3 · Made-up facts', 'Question ' + (S.i + 1) + ' of ' + S.d.r3.length),
      el('p', { class: 'td-ask', text: q.prompt }),
      el('p', { class: 'td-q', text: 'One answer contains a made-up fact. Tap it.' }),
      el('div', { class: 'td-outs' }, cards),
      fb,
      el('p', { class: 'disclaimer', text: 'Illustrative outputs. The true ones are real facts; the made-up one is labelled after you answer.' }),
    ]));
  }

  function finish() {
    var res = L.replay(S.run.seed, S.run.moves), g = res.log || { r1: [], r2: [], r3: [] };
    var m = g.r1.reduce(function (a, x) { return a + x.right; }, 0), jobs = g.r2.filter(function (x) { return x.best; }).length, fakes = g.r3.filter(function (x) { return x.ok; }).length;
    var lowFake = g.r3.some(function (x) { return !x.ok && x.from === 0; });
    var remember = [
      ['Temperature reshapes the next-word odds.', 'Low sharpens them, so the top word wins. High flattens them, so rare words show up.'],
      ['Match the setting to the job.', 'Low for templates, summaries and forms. Higher for brainstorming and play.'],
      [lowFake ? 'You trusted the Focused answer. It was the fake.' : 'Low temperature is not a truth setting.', 'Low makes answers predictable, not correct. At 0 a model can repeat the same made-up fact every time.'],
      ['Check every fact and every source.', 'Invented citations and numbers can appear at any setting.'],
    ];
    K.results(main, G, S.run, res, {
      title: res.score >= L.stars[2] ? 'You can read the dial.' : fakes === 3 ? 'Fact-checker’s eye.' : 'Randomness is not truth.',
      stats: [[m + '/6', 'outputs matched'], [jobs + '/4', 'jobs set right'], [fakes + '/3', 'fakes caught']],
      remember: remember, onAgain: start,
    });
  }


  // How it works: temperature in five cards. The odds are illustrative; the reshaping is the real formula (p^(1/T), renormalised).
  var LEARN_ODDS = [['hot', 0.46], ['tasty', 0.30], ['cold', 0.14], ['legendary', 0.10]];
  var atT = function (T) {
    if (T === 0) return LEARN_ODDS.map(function (o, k) { return [o[0], k === 0 ? 1 : 0, k === 0]; });
    var w = LEARN_ODDS.map(function (o) { return Math.pow(o[1], 1 / T); }), s = w.reduce(function (a, b) { return a + b; }, 0);
    return LEARN_ODDS.map(function (o, k) { return [o[0], w[k] / s, k === 0]; });
  };
  G.learnLabel = 'Temperature in 1 minute';
  G.learn = [
    { title: 'A chatbot writes one word at a time', text: 'For every next word it has odds, learned from reading huge amounts of text. Here are its odds for one sentence.',
      art: function (el) { return el('div', {}, [el('p', { class: 'lquote', text: 'The canteen samosa is ____' }), K.bars(atT(1))]); }, note: 'Odds are illustrative.' },
    { title: 'Temperature reshapes the odds', text: 'Turn it down and the top word gets even more likely. Turn it up and the odds even out, so unlikely words get a real chance.',
      art: function (el) { return el('div', {}, [0, 0.7, 1.5].reduce(function (acc, T) { acc.push(el('p', { class: 'lmini', text: 'Temperature ' + T + (T === 0 ? ' · focused' : T < 1 ? ' · balanced' : ' · wild') })); acc.push(K.bars(atT(T), { compact: true })); return acc; }, [])); } },
    { title: 'Then it rolls the dice', text: 'The model picks a word using those odds. At 0 there is no roll: the top word wins every time. Low is predictable and repeats itself. High is varied, and sometimes strange.',
      art: function (el) { return el('div', {}, [el('p', { class: 'lmini', text: 'Ask 3 times at 0' }), el('p', { class: 'lquote dim', text: '…is hot. · …is hot. · …is hot.' }), el('p', { class: 'lmini', text: 'Ask 3 times at 1.5' }), el('p', { class: 'lquote dim', text: '…is legendary. · …is cold. · …is tasty.' })]); } },
    { title: 'It doesn’t change what’s true', text: 'Temperature changes how random the words are, not what the model knows. At 0 a model can repeat the same wrong fact every time, very confidently.',
      art: function (el) { return el('div', {}, [el('span', { class: 'lchip lo', text: 'Low = repeatable' }), el('span', { class: 'lchip bad', text: 'Low ≠ correct' }), el('span', { class: 'lchip hi', text: 'High = varied' }), el('span', { class: 'lchip bad', text: 'High ≠ smarter' })]); } },
    { title: 'Pick the setting for the job', text: 'Many apps let you set it, often from 0 to 1 or 0 to 2. Facts and forms: keep it low. Ideas and stories: turn it up a little.',
      art: function (el) { return el('div', {}, [
        el('p', { class: 'lquote dim' }, ['Bank OTP message ', el('span', { class: 'lchip lo', text: 'low' })]),
        el('p', { class: 'lquote dim' }, ['Summary of an exam answer ', el('span', { class: 'lchip lo', text: 'low' })]),
        el('p', { class: 'lquote dim' }, ['Names for the college fest ', el('span', { class: 'lchip hi', text: 'higher' })]),
        el('p', { class: 'lquote dim' }, ['A poem for a friend ', el('span', { class: 'lchip hi', text: 'higher' })])]); } },
  ];
  K.intro(main, G, start);
})();
