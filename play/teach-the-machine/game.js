/* Teach the Machine: the drag-and-sort frame. Label examples, train a tiny spam filter on YOUR labels,
   watch it test itself, then find the poisoned rows a stranger slipped into the data. */
(function () {
  'use strict';
  var K = window.FTKit, el = K.el, L = window.FTGames['teach-the-machine'];
  var main = document.getElementById('main');
  var G = {
    logic: L, title: 'Teach the Machine', kicker: 'Fencing Token Arcade · Act 1',
    pitch: 'An AI model learns only from the examples you give it. Teach one to catch spam, then see what happens when someone poisons its data.',
    meta: '3 rounds · about 3 minutes · no typing',
    howto: [
      { cls: 'ask', glyph: '1', text: 'Sort messages into Spam or Not spam' },
      { cls: 'allow', glyph: '2', text: 'Train the model on your labels and test it' },
      { cls: 'deny', glyph: '3', text: 'Find the poisoned examples before training' },
    ],
    nextGame: { href: '/play/downhill/', title: 'Downhill' },
    shareText: function (s) { return 'I trained a spam filter and hunted for poisoned data: ' + s + ' points. Your turn:'; },
    next: [
      { href: '/concepts/?lens=everyone#ai-agent', text: 'What an AI agent is, explained three ways', sub: 'Where this goes next: models that act.' },
    ],
  };
  var S;

  function start() {
    var b = main.querySelector('.btn'); if (b) { b.disabled = true; b.textContent = 'Starting…'; }
    K.startRun(L).then(function (run) {
      S = { run: run, d: L.deck(run.seed), labels: [], removed: [] };
      run.moves = { labels: S.labels, removed: S.removed };
      K.roundOverlay(main, L.data.rounds, 0, roundLabel, 'Drag each message into a bin, or tap a message and then a bin. The model will learn only from your labels.');
    });
  }

  function hud(title, sub) { return el('div', { class: 'hud' }, [el('div', {}, [el('p', { class: 'kicker', style: 'margin:0', text: title }), sub ? el('p', { class: 'small', style: 'margin:4px 0 0', text: sub }) : null])]); }

  // ---------------------------------------------------------------- round 1: drag & sort
  function roundLabel() {
    var placed = new Array(S.d.train.length).fill(null), sel = null;
    var tray = el('div', { class: 'tray', 'aria-label': 'Messages to sort' });
    var bins = { 1: null, 0: null };
    var train = el('button', { class: 'btn', type: 'button', text: 'Train the model', disabled: true, onclick: function () {
      placed.forEach(function (y, k) { S.labels[k] = y; });
      K.roundOverlay(main, L.data.rounds, 1, roundTest, 'The model counts which words show up in the messages you called spam, and which show up in normal ones. Then it labels messages it has never seen.');
    } });
    function mkBin(y, cls, label) {
      var list = el('div', { class: 'binlist' });
      var b = el('div', { class: 'bin ' + cls, role: 'button', tabindex: '0', 'aria-label': 'Put the selected message in ' + label, onclick: function () { if (sel !== null) drop(sel, y); } }, [el('h3', {}, [label, el('span', { class: 'count', text: '0' })]), list]);
      b._list = list; bins[y] = b; return b;
    }
    function drop(k, y) { placed[k] = y; sel = null; draw(); }
    function draw() {
      tray.replaceChildren.apply(tray, S.d.train.map(function (row, k) {
        if (placed[k] !== null) return null;
        var m = el('div', { class: 'msg' + (sel === k ? ' sel' : '') }, [
          el('span', { class: 'mt', text: row.t }),
          el('span', { class: 'mbtns' }, [
            el('button', { type: 'button', class: 'mini spam', text: 'Spam', 'aria-label': 'Spam: ' + row.t, onclick: function (e) { e.stopPropagation(); drop(k, 1); } }),
            el('button', { type: 'button', class: 'mini safe', text: 'Not spam', 'aria-label': 'Not spam: ' + row.t, onclick: function (e) { e.stopPropagation(); drop(k, 0); } }),
          ]),
        ]);
        m.addEventListener('click', function () { sel = sel === k ? null : k; draw(); });
        m.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') drop(k, 1); if (e.key === 'ArrowRight') drop(k, 0); });
        dragify(m, k);
        return m;
      }).filter(Boolean));
      [1, 0].forEach(function (y) {
        var items = placed.map(function (p, k) { return p === y ? k : -1; }).filter(function (k) { return k >= 0; });
        bins[y].querySelector('.count').textContent = String(items.length);
        bins[y]._list.replaceChildren.apply(bins[y]._list, items.map(function (k) {
          return el('div', { class: 'msg placed', role: 'button', tabindex: '0', title: 'Tap to take it back', text: S.d.train[k].t, onclick: function (e) { e.stopPropagation(); placed[k] = null; draw(); } });
        }));
      });
      var left = placed.filter(function (p) { return p === null; }).length;
      train.disabled = left > 0; train.textContent = left ? left + ' left to sort' : 'Train the model';
    }
    function dragify(m, k) {
      var ghost = null, sx = 0, sy = 0, moved = false;
      m.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' || e.target.tagName === 'BUTTON') return; sx = e.clientX; sy = e.clientY; moved = false; m.setPointerCapture(e.pointerId); });
      m.addEventListener('pointermove', function (e) {
        if (!m.hasPointerCapture(e.pointerId)) return;
        if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return;
        if (!ghost) { moved = true; ghost = el('div', { class: 'msg ghost', text: S.d.train[k].t }); document.body.appendChild(ghost); }
        ghost.style.left = (e.clientX - 150) + 'px'; ghost.style.top = (e.clientY - 30) + 'px';
        [1, 0].forEach(function (y) { var r = bins[y].getBoundingClientRect(); bins[y].classList.toggle('over', e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom); });
      });
      var end = function (e) {
        if (ghost) { ghost.remove(); ghost = null; }
        [1, 0].forEach(function (y) { var r = bins[y].getBoundingClientRect(); var over = e && e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom; bins[y].classList.remove('over'); if (moved && over) drop(k, y); });
      };
      m.addEventListener('pointerup', end); m.addEventListener('pointercancel', function () { end(null); });
    }
    main.replaceChildren(el('section', { class: 'screen' }, [
      hud('Round 1 · Label the examples', 'Spam is junk or a scam. Not spam is a normal message. Tap a button, or drag a message into a bin.'),
      tray,
      el('div', { class: 'bins' }, [mkBin(1, 'spam', 'Spam'), mkBin(0, 'safe', 'Not spam')]),
      el('div', { class: 'cta static' }, [train]),
    ]));
    draw();
  }

  // ---------------------------------------------------------------- round 2: train + test
  function learnedPanel(model) {
    var top = function (b, o) { return Object.keys(b).map(function (w) { return [w, (b[w] + 0.5) / ((o[w] || 0) + 0.5)]; }).sort(function (x, y) { return y[1] - x[1]; }).slice(0, 6).map(function (x) { return x[0]; }); };
    return el('div', { class: 'learned' }, [
      el('div', {}, [el('b', { text: 'Words it now links to spam' })].concat(top(model.spam, model.safe).map(function (w) { return el('span', { class: 'wchip s', text: w }); }))),
      el('div', {}, [el('b', { text: 'Words it links to normal mail' })].concat(top(model.safe, model.spam).map(function (w) { return el('span', { class: 'wchip h', text: w }); }))),
    ]);
  }
  function runTests(box, model, tests, done) {
    var k = 0, right = 0;
    var step = function () {
      if (k >= tests.length) return done(right);
      var row = tests[k++], p = L.predict(model, row.t), ok = p.y === row.y; if (ok) right++;
      box.appendChild(el('div', { class: 'pred' }, [el('p', { class: 't', text: row.t }), el('div', { class: 'verdict' }, [
        'Model says ', el('b', { text: p.y ? 'Spam' : 'Not spam' }), ' · ', el('span', { class: ok ? 'ok' : 'no', text: ok ? 'right' : 'wrong' }), ' · because of',
      ].concat(p.why.map(function (w) { return el('span', { class: 'wchip ' + (w[1] > 0 ? 's' : 'h'), text: w[0] }); })))]));
      box.lastChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      setTimeout(step, 750);
    };
    step();
  }
  function roundTest() {
    var model = L.train(S.d.train.map(function (row, k) { return { t: row.t, y: S.labels[k] }; }));
    var box = el('div'), cont = el('button', { class: 'btn', type: 'button', text: 'Testing…', disabled: true, onclick: function () {
      K.roundOverlay(main, L.data.rounds, 2, roundPoison, 'A stranger uploaded extra examples to your training data. Tap any row whose label is wrong to remove it, then train.');
    } });
    main.replaceChildren(el('section', { class: 'screen' }, [hud('Round 2 · Train and test', 'The model learned these patterns from your labels:'), learnedPanel(model), el('p', { class: 'kicker', text: 'Now it labels 6 new messages' }), box, el('div', { class: 'cta static' }, [cont])]));
    runTests(box, model, S.d.test, function (right) {
      S.r2 = right;
      box.appendChild(el('p', { class: 'note-in', text: right === 6 ? (S.labels.every(function (y, k) { return y === S.d.train[k].y; }) ? 'All 6 right. Good labels make a good model.' : 'All 6 right, even with a wrong label. With more mistakes, it would start copying them.') : right + ' of 6 right. Every wrong label you gave became a wrong lesson for the model.' }));
      cont.disabled = false; cont.textContent = 'Continue';
    });
  }

  // ---------------------------------------------------------------- round 3: poisoned data
  function roundPoison() {
    var rows = el('div', { class: 'rows', role: 'group', 'aria-label': 'Training data' });
    var draw = function () {
      rows.replaceChildren.apply(rows, S.d.r3.map(function (row, k) {
        var off = S.removed.indexOf(k) >= 0;
        return el('button', { class: 'row' + (off ? ' removed' : ''), type: 'button', 'aria-pressed': off ? 'true' : 'false', onclick: function () {
          var i = S.removed.indexOf(k); if (i >= 0) S.removed.splice(i, 1); else S.removed.push(k); draw();
        } }, [el('span', { class: 'txt', text: row.t }), el('span', { class: 'lab ' + (row.y ? 'spam' : 'safe'), text: row.y ? 'Spam' : 'Not spam' })]);
      }));
      go.textContent = S.removed.length ? 'Train without ' + S.removed.length + ' removed' : 'Train on all of it';
    };
    var go = el('button', { class: 'btn', type: 'button', onclick: function () {
      var kept = S.d.r3.filter(function (row, k) { return S.removed.indexOf(k) < 0; });
      var model = L.train(kept), box = el('div');
      var fin = el('button', { class: 'btn', type: 'button', text: 'Testing…', disabled: true, onclick: finish });
      main.replaceChildren(el('section', { class: 'screen' }, [hud('Round 3 · Poisoned data', 'Trained on the rows you kept. What it learned:'), learnedPanel(model), el('p', { class: 'kicker', text: 'Testing on 6 new messages' }), box, el('div', { class: 'cta static' }, [fin])]));
      runTests(box, model, S.d.test3, function () { fin.disabled = false; fin.textContent = 'See your score'; });
    } });
    main.replaceChildren(el('section', { class: 'screen' }, [hud('Round 3 · Poisoned data', 'Read each label. Remove the rows that are labeled wrong.'), rows, el('div', { class: 'cta static' }, [go])]));
    draw();
  }

  function finish() {
    var res = L.replay(S.run.seed, { labels: S.labels, removed: S.removed }), d = res.detail, remember = [];
    if (d.r1 < 8) remember.push(['Wrong labels in, wrong answers out.', 'You labeled ' + d.r1 + ' of 8 correctly' + (d.r2 < 6 ? ', and the model copied your mistakes.' : '. This time the model got lucky.')]);
    if (d.removedPoison < 3) remember.push(['Poisoned data changes what a model believes.', 'You caught ' + d.removedPoison + ' of 3 mislabeled rows a stranger added.']);
    if (d.removedGood) remember.push(['Throwing away good data hurts too.', 'You removed ' + d.removedGood + ' correct row' + (d.removedGood > 1 ? 's' : '') + '.']);
    remember.push(['Real poisoning is usually subtler.', 'Here the wrong labels were easy to spot. Attackers try to make them look normal.']);
    remember.push(['A model is only as good as its examples.', 'That is why who can add training data is a security question.']);
    K.results(main, G, S.run, res, {
      title: d.removedPoison === 3 && d.r1 === 8 && !d.removedGood ? 'You trained a clean model.' : 'Your model learned what you taught it.',
      stats: [[d.r1 + '/8', 'labels right'], [(d.r2 + d.r3) + '/12', 'model right'], [d.removedPoison + '/3', 'poison found']],
      remember: remember, onAgain: start,
    });
  }

  K.intro(main, G, start);
})();
