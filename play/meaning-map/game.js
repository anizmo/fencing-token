/* Meaning Map: the map frame. Put words where they belong on a 2D map of meaning, run vector searches by
   tapping the pages nearest a query, then catch a page planted to sit next to every popular search. */
(function () {
  'use strict';
  var K = window.FTKit, el = K.el, L = window.FTGames['meaning-map'], D = L.data;
  var main = document.getElementById('main');
  var NS = 'http://www.w3.org/2000/svg', WW = D.world[0];
  var FULL = [0, 30, 360, 500];
  var REDUCE = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var G = {
    logic: L, title: 'Meaning Map', kicker: 'Fencing Token Arcade · Act 3',
    pitch: 'AI search turns text into points on a map, so similar meanings sit close together. Build the map, search it, then catch the page someone planted.',
    meta: '3 rounds · about 2 minutes · no typing',
    howto: [
      { cls: 'ask', glyph: '1', text: 'Put each word next to its neighbours' },
      { cls: 'allow', glyph: '2', text: 'Tap the 3 pages closest to a search' },
      { cls: 'deny', glyph: '3', text: 'Catch the page planted to match everything' },
    ],
    nextGame: { href: '/play/open-book/', title: 'Open Book' },
    shareText: function (s) { return 'I searched a map of meaning like an AI does and caught a planted page: ' + s + ' points in Meaning Map. Your turn:'; },
    next: [
      { href: '/concepts/?lens=everyone#types-of-rag', text: 'The 5 types of RAG', sub: 'Where vector search fits.' },
      { href: '/concepts/?lens=everyone#prompt-injection', text: 'Prompt injection, explained three ways', sub: 'What a planted page can do once an AI reads it.' },
    ],
  };
  var S;

  // ---------------------------------------------------------------- small helpers
  function sv(tag, attrs, kids) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') n.textContent = v; else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v); else n.setAttribute(k, String(v));
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }
  function tween(ms, step, done) {
    if (REDUCE || !ms || !window.requestAnimationFrame) { step(1); if (done) done(); return; }
    var t0 = null;
    var f = function (ts) { if (t0 === null) t0 = ts; var t = Math.min(1, (ts - t0) / ms); step(ease(t)); if (t < 1) window.requestAnimationFrame(f); else if (done) done(); };
    window.requestAnimationFrame(f);
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function press(fn) { return function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); } }; }
  function hud(title, sub) {
    S.scoreEl = el('span', { class: 'score', 'aria-label': 'Score', text: K.fmt(S.pts) });
    return el('div', { class: 'hud' }, [el('div', {}, [el('p', { class: 'kicker', style: 'margin:0', text: title }), sub ? el('p', { class: 'small', style: 'margin:4px 0 0', text: sub }) : null]), S.scoreEl]);
  }
  function addPts(p) { S.pts += p; if (S.scoreEl) S.scoreEl.textContent = K.fmt(S.pts); }
  function floatPts(wrap, text, bad) { var n = el('div', { class: 'pts' + (bad ? ' mm-bad' : ''), text: text, 'aria-hidden': 'true' }); wrap.appendChild(n); setTimeout(function () { n.remove(); }, 800); }
  function disclaimer() { return el('p', { class: 'disclaimer', text: 'Illustrative map. Real embeddings have hundreds or thousands of dimensions; here they are squashed flat to 2D.' }); }

  // ---------------------------------------------------------------- the map
  // All positions are in world units. k = view width / world width, so text and dots keep the same size on screen when we zoom.
  function makeMap(view) {
    var M = Object.create(proto);
    M.view = view.slice(); M.k = view[2] / WW; M.sized = [];
    var defs = sv('defs');
    D.clusters.forEach(function (c, i) {
      defs.appendChild(sv('radialGradient', { id: 'mmg' + i }, [
        sv('stop', { offset: '0', 'stop-color': c.hue, 'stop-opacity': '.40' }),
        sv('stop', { offset: '.55', 'stop-color': c.hue, 'stop-opacity': '.13' }),
        sv('stop', { offset: '1', 'stop-color': c.hue, 'stop-opacity': '0' }),
      ]));
    });
    defs.appendChild(sv('pattern', { id: 'mmdots', width: 18, height: 18, patternUnits: 'userSpaceOnUse' }, [sv('circle', { cx: 9, cy: 9, r: 0.8, fill: '#2A3D55' })]));
    defs.appendChild(sv('filter', { id: 'mmglow', x: '-150%', y: '-150%', width: '400%', height: '400%' }, [sv('feGaussianBlur', { stdDeviation: 5 })]));
    M.svg = sv('svg', { class: 'mm-svg', viewBox: view.join(' '), 'aria-label': 'A map of meaning: similar meanings sit close together' });
    M.root = sv('g', { class: 'mm-root' });
    M.svg.appendChild(defs);
    M.svg.appendChild(M.root);
    ['bg', 'blobs', 'links', 'base', 'docs', 'fx', 'zones'].forEach(function (n) { M[n] = sv('g', { class: 'mm-' + n }); M.root.appendChild(M[n]); });
    M.bg.appendChild(sv('rect', { x: -400, y: -400, width: 1200, height: 1400, fill: 'url(#mmdots)' }));
    D.clusters.forEach(function (c, i) {
      M.blobs.appendChild(sv('circle', { cx: c.c[0], cy: c.c[1], r: 76, fill: 'url(#mmg' + i + ')' }));
      var t = sv('text', { class: 'mm-cl', fill: c.hue, 'text-anchor': 'middle', text: c.name.toUpperCase() });
      M.blobs.appendChild(t);
      M.size(function (k) { t.setAttribute('x', c.c[0]); t.setAttribute('y', c.c[1] - 50 - 4 * (1 - k)); });
    });
    M.wrap = el('div', { class: 'mm-wrap' }, [M.svg]);
    M.apply();
    return M;
  }
  var proto = {
      size: function (fn) { this.sized.push(fn); fn(this.k); },
      apply: function () { var k = this.k; this.root.setAttribute('font-size', (13 * k).toFixed(2)); this.sized.forEach(function (fn) { fn(k); }); },
      setView: function (v, ms, done) {
        var M = this, from = M.view.slice();
        tween(ms, function (t) {
          M.view = [0, 1, 2, 3].map(function (i) { return lerp(from[i], v[i], t); });
          M.k = M.view[2] / WW; M.svg.setAttribute('viewBox', M.view.map(function (x) { return x.toFixed(2); }).join(' ')); M.apply();
        }, done);
      },
      // a dot with a label; side: r | l | t | b
      dot: function (layer, at, label, side, cls, r) {
        var M = this, g = sv('g', { class: cls || '' });
        var c = sv('circle', { cx: at[0], cy: at[1], class: 'mm-dotc' }), t = null;
        if (label) {
          var lines = typeof label === 'string' ? [label] : label;
          t = sv('text', { class: 'mm-lbl' }, lines.length > 1 ? lines.map(function (l, n) { return sv('tspan', { dy: n ? '1.15em' : null, text: l }); }) : null);
          if (lines.length === 1) t.textContent = lines[0];
          t._n = lines.length;
        }
        g.appendChild(c); if (t) g.appendChild(t); layer.appendChild(g);
        var pos = { at: at.slice(), side: side || 'r', r: r || 4.5 };
        M.size(function (k) { place(c, t, pos, k); });
        g._pos = pos; g._c = c; g._t = t;
        g.moveTo = function (p) { pos.at = p.slice(); place(c, t, pos, M.k); };
        return g;
      },
      line: function (a, b, cls) {
        var len = Math.sqrt(Math.pow(a[0] - b[0], 2) + Math.pow(a[1] - b[1], 2));
        var l = sv('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'mm-link ' + (cls || ''), style: '--len:' + len.toFixed(1) });
        this.size(function (k) { l.setAttribute('stroke-width', (2 * k).toFixed(2)); });
        this.links.appendChild(l); return l;
      },
  };
  function place(c, t, pos, k) {
    var x = pos.at[0], y = pos.at[1], g = (pos.r + 4) * k;
    c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', (pos.r * k).toFixed(2));
    if (!t) return;
    var a = 'start', tx = x + g, ty = y + 4.4 * k;
    var n = t._n || 1, lh = 13 * k * 0.92 * 1.15;
    if (pos.side === 'l') { a = 'end'; tx = x - g; }
    else if (pos.side === 't') { a = 'middle'; tx = x; ty = y - g - 2 * k - (n - 1) * lh; }
    else if (pos.side === 'b') { a = 'middle'; tx = x; ty = y + g + 10 * k; }
    if (n > 1 && (pos.side === 'l' || pos.side === 'r' || !pos.side)) ty -= (n - 1) * lh / 2;
    t.setAttribute('x', tx.toFixed(2)); t.setAttribute('y', ty.toFixed(2)); t.setAttribute('text-anchor', a);
    if (n > 1) for (var i = 0; i < t.childNodes.length; i++) t.childNodes[i].setAttribute('x', tx.toFixed(2));
  }
  // LAYOUT-START: pick a label side (and one or two lines) for each page so labels don't cover each other or other points.
  function split2(t) {
    var w = t.split(' '); if (w.length < 3) return [t];
    var best = [t], bl = 1e9;
    for (var i = 1; i < w.length; i++) { var a = w.slice(0, i).join(' '), b = w.slice(i).join(' '), m = Math.max(a.length, b.length); if (m < bl) { bl = m; best = [a, b]; } }
    return best;
  }
  function lblBox(at, side, lines, k) {
    var fs = 13 * k * 0.92, g = 9 * k, n = lines.length, lh = fs * 1.15;
    var w = Math.max.apply(null, lines.map(function (l) { return l.length; })) * fs * 0.55, x = at[0], y = at[1], top;
    if (side === 'r' || side === 'l') { top = y + 4.4 * k - (n - 1) * lh / 2 - fs * 0.8; var x0 = side === 'r' ? x + g : x - g - w; return [x0, top, x0 + w, top + (n - 1) * lh + fs * 1.05]; }
    if (side === 't') top = y - g - 2 * k - (n - 1) * lh - fs * 0.8; else top = y + g + 10 * k - fs * 0.8;
    return [x - w / 2, top, x + w / 2, top + (n - 1) * lh + fs * 1.05];
  }
  function layoutSides(items, qAt, view) {
    var k = view[2] / WW, R = 7 * k, placed = [], out = [];
    var hit = function (a, b) { return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3]; };
    var pts = items.map(function (c) { return [c.at[0] - R, c.at[1] - R, c.at[0] + R, c.at[1] + R]; });
    pts.push([qAt[0] - 2 * R, qAt[1] - 2 * R, qAt[0] + 2 * R, qAt[1] + 2 * R]);
    var order = items.map(function (c, i) { return i; }).sort(function (a, b) { return L.dist(items[a].at, qAt) - L.dist(items[b].at, qAt); });
    var choose = function (i, others) {
      var best = null, bestCost = 1e9, variants = [[items[i].t]], two = split2(items[i].t);
      if (two.length > 1) variants.push(two);
      variants.forEach(function (lines, vi) {
        [items[i].side || 'r', 'r', 'l', 'b', 't'].forEach(function (side) {
          var b = lblBox(items[i].at, side, lines, k), cost = (side === items[i].side ? 0 : 0.5) + vi * 1.5;
          others.forEach(function (p) { if (p && hit(b, p)) cost += 10; });
          pts.forEach(function (p, j) { if (j !== i && hit(b, p)) cost += 8; });
          if (b[0] < view[0] + 2 || b[2] > view[0] + view[2] - 2) cost += 9;
          if (cost < bestCost) { bestCost = cost; best = { side: side, lines: lines }; }
        });
      });
      return best;
    };
    order.forEach(function (i) { out[i] = choose(i, placed); placed[i] = lblBox(items[i].at, out[i].side, out[i].lines, k); });
    for (var pass = 0; pass < 4; pass++) order.forEach(function (i) {
      var others = placed.map(function (b, j) { return j === i ? null : b; });
      out[i] = choose(i, others); placed[i] = lblBox(items[i].at, out[i].side, out[i].lines, k);
    });
    return out;
  }
  // LAYOUT-END
  function drawBase(M, faint) {
    var sideOf = function (b) { return b[2] > D.clusters[b[1]].c[0] ? 'r' : 'l'; };
    D.base.forEach(function (b) { M.dot(M.base, [b[2], b[3]], b[0], sideOf(b), 'mm-word' + (faint ? ' faint' : '')); });
    M.bankDot = M.dot(M.base, D.bank, 'bank', 'b', 'mm-word mm-bank' + (faint ? ' faint' : ''));
  }
  function nearestBase(at, n) {
    return D.base.map(function (b) { return { w: b[0], at: [b[2], b[3]], d: L.dist(at, [b[2], b[3]]) }; }).sort(function (a, b) { return a.d - b.d; }).slice(0, n);
  }

  function start() {
    var b = main.querySelector('.btn'); if (b) { b.disabled = true; b.textContent = 'Starting…'; }
    K.startRun(L).then(function (run) {
      S = { run: run, d: L.deck(run.seed), pts: 0, moves: { place: [], search: [], spot: [] } };
      run.moves = S.moves;
      K.roundOverlay(main, D.rounds, 0, round1, 'An AI model can turn any word or sentence into a point on a map of meaning. Help draw the map: tap a word, then tap where it belongs.');
    });
  }

  // ---------------------------------------------------------------- round 1: place the words
  function round1() {
    var words = S.d.words, placed = words.map(function () { return false; }), sel = 0, busy = false, t0 = Date.now();
    var M = makeMap(FULL), zones = [];
    drawBase(M);
    D.clusters.forEach(function (c, ci) {
      var ring = sv('circle', { class: 'mm-ring', cx: c.c[0], cy: c.c[1], r: 56, fill: c.hue, stroke: c.hue });
      var tag = sv('text', { class: 'mm-tap', x: c.c[0], y: c.c[1] + 50, 'text-anchor': 'middle', fill: c.hue, text: 'TAP HERE' });
      var g = sv('g', { class: 'mm-zone', role: 'button', tabindex: '-1', 'aria-hidden': 'true', onclick: function () { zoneTap(ci); }, onkeydown: press(function () { zoneTap(ci); }) }, [ring, tag]);
      g.setAttribute('data-zone', ci);
      M.zones.appendChild(g); zones.push(g);
    });
    var tray = el('div', { class: 'mm-tray', role: 'group', 'aria-label': 'Words to place' });
    var fb = el('div', { class: 'mm-fb', 'aria-live': 'polite' });
    var cta = el('div', { class: 'cta static' });
    function drawTray() {
      tray.replaceChildren.apply(tray, words.map(function (w, i) {
        if (placed[i]) return null;
        return el('button', { type: 'button', class: 'mm-chip' + (sel === i ? ' sel' : ''), 'aria-pressed': sel === i ? 'true' : 'false', 'data-w': i, text: w.w, onclick: function () { if (busy) return; sel = i; drawTray(); drawZones(); } });
      }).filter(Boolean));
    }
    function drawZones() {
      zones.forEach(function (g, ci) {
        var on = sel !== null && words[sel].opts.indexOf(ci) >= 0;
        g.setAttribute('class', 'mm-zone' + (on ? ' on' : ''));
        g.setAttribute('tabindex', on ? '0' : '-1');
        if (on) { g.removeAttribute('aria-hidden'); g.setAttribute('aria-label', 'Put ' + words[sel].w + ' in ' + D.clusters[ci].name); }
        else { g.setAttribute('aria-hidden', 'true'); g.removeAttribute('aria-label'); }
      });
    }
    function zoneTap(ci) {
      if (busy || sel === null) return;
      var idx = sel, w = words[idx]; if (w.opts.indexOf(ci) < 0) return;
      busy = true;
      S.moves.place.push([idx, ci, Math.max(L.FLOOR.place, Math.min(300000, Date.now() - t0))]);
      placed[idx] = true; sel = null;
      var ok = ci === w.c; if (ok) addPts(L.PTS.place);
      K.vibrate(ok ? 15 : [10, 40, 10]);
      drawZones(); drawTray();
      var near = nearestBase(w.at, 2);
      var tok = M.dot(M.fx, D.clusters[ci].c, w.w, w.at[0] > D.clusters[w.c].c[0] ? 'r' : 'l', 'mm-token ' + (ok ? 'ok' : 'bad'), 6);
      var glide = function () {
        var from = tok._pos.at.slice();
        tween(REDUCE ? 0 : 480, function (t) { tok.moveTo([lerp(from[0], w.at[0], t), lerp(from[1], w.at[1], t)]); }, function () {
          tok.setAttribute('class', 'mm-token placed' + (ok ? ' ok' : ' bad'));
          near.forEach(function (n) { M.line(w.at, n.at, ok ? 'good' : ''); });
        });
      };
      if (ok) glide(); else { tok.setAttribute('class', 'mm-token bad mm-shake'); setTimeout(glide, 380); }
      floatPts(M.wrap, ok ? '+100' : 'Miss', !ok);
      fb.replaceChildren(el('div', { class: 'feedback ' + (ok ? 'mm-good' : 'mm-badfb') }, [
        el('p', { class: 'big', text: ok ? '+100 · Right next to ' + near[0].w + '.' : 'Not quite. ' + cap(w.w) + ' belongs with ' + D.clusters[w.c].name.toLowerCase() + '.' }),
        el('p', { text: w.lesson }),
      ]));
      setTimeout(function () {
        busy = false; t0 = Date.now();
        var next = placed.indexOf(false);
        if (next >= 0) { sel = next; drawTray(); drawZones(); return; }
        tray.replaceChildren();
        cta.replaceChildren(el('button', { class: 'btn', type: 'button', text: 'Next: search the map', onclick: function () {
          K.roundOverlay(main, D.rounds, 1, function () { search(0); }, 'A search engine turns your question into a point on the same map, then fetches the pages closest to it. That is vector search.');
        } }));
        var b = cta.querySelector('.btn'); if (b) b.focus();
      }, 760);
    }
    main.replaceChildren(el('section', { class: 'screen mm' }, [
      hud('Round 1 · Words find their neighbours', 'Tap a word, then tap the glowing zone where it belongs.'),
      M.wrap, tray, fb, cta, disclaimer(),
    ]));
    drawTray(); drawZones();
  }

  // ---------------------------------------------------------------- rounds 2-3: vector search
  function search(i) {
    var qd = S.d.queries[i], q = qd.q, r3 = qd.round === 2, picks = [], busy = true, t0 = 0;
    var round = D.rounds[qd.round], nInRound = S.d.queries.filter(function (x) { return x.round === qd.round; }).length;
    var nth = S.d.queries.slice(0, i + 1).filter(function (x) { return x.round === qd.round; }).length;
    var M = makeMap(FULL);
    drawBase(M, true);
    M.svg.setAttribute('class', 'mm-svg mm-searching');
    var fb = el('div', { class: 'mm-fb', 'aria-live': 'polite' }), cta = el('div', { class: 'cta static' });
    var go = el('button', { class: 'btn', type: 'button', disabled: true, text: 'Tap the 3 closest pages', onclick: fetchPages });
    cta.appendChild(go);
    var lay = layoutSides(qd.docs, q.at, q.view);
    var nodes = qd.docs.map(function (c, j) {
      var g = M.dot(M.docs, c.at, lay[j].lines, lay[j].side, 'mm-doc', 5);
      var hit = sv('circle', { class: 'mm-hit', cx: c.at[0], cy: c.at[1] });
      M.size(function (k) { hit.setAttribute('r', (25 * k).toFixed(2)); });
      g.insertBefore(hit, g.firstChild);
      var num = sv('text', { class: 'mm-num', 'text-anchor': 'middle' });
      g.appendChild(num);
      M.size(function (k) { num.setAttribute('x', c.at[0]); num.setAttribute('y', (c.at[1] + 3.6 * k).toFixed(2)); });
      g.setAttribute('role', 'button'); g.setAttribute('tabindex', '0'); g.setAttribute('aria-pressed', 'false'); g.setAttribute('aria-label', c.t); g.setAttribute('data-i', j);
      g.addEventListener('click', function () { toggle(j); });
      g.addEventListener('keydown', press(function () { toggle(j); }));
      g._num = num;
      return g;
    });
    var qdot = M.dot(M.fx, q.from || [q.at[0], q.at[1] - 70], q.from ? 'bank' : null, 't', 'mm-query', 6);
    var halo = sv('circle', { class: 'mm-halo', filter: 'url(#mmglow)' }), ring = sv('circle', { class: 'mm-pulse' });
    qdot.insertBefore(ring, qdot.firstChild); qdot.insertBefore(halo, qdot.firstChild);
    var syncHalo = function () { var p = qdot._pos.at, k = M.k; halo.setAttribute('cx', p[0]); halo.setAttribute('cy', p[1]); halo.setAttribute('r', (13 * k).toFixed(2)); ring.setAttribute('cx', p[0]); ring.setAttribute('cy', p[1]); ring.setAttribute('r', (11 * k).toFixed(2)); };
    M.size(syncHalo);
    qdot.style.opacity = '0';

    function setGo() {
      go.disabled = busy || picks.length !== 3;
      go.textContent = picks.length === 3 ? 'Fetch these 3 pages' : 'Tap the 3 closest pages (' + picks.length + '/3)';
    }
    function toggle(j) {
      if (busy) return;
      var at = picks.indexOf(j);
      if (at >= 0) picks.splice(at, 1);
      else if (picks.length >= 3) { K.toast('Three is the limit. Tap one to drop it.'); return; }
      else picks.push(j);
      nodes.forEach(function (g, n) {
        var p = picks.indexOf(n);
        g.setAttribute('class', 'mm-doc' + (p >= 0 ? ' sel' : ''));
        g.setAttribute('aria-pressed', p >= 0 ? 'true' : 'false');
        g._num.textContent = p >= 0 ? String(p + 1) : '';
      });
      K.vibrate(8);
      setGo();
    }
    function fetchPages() {
      if (busy || picks.length !== 3) return;
      busy = true; setGo();
      S.moves.search.push([picks.slice(), Math.max(L.FLOOR.search, Math.min(300000, Date.now() - t0))]);
      var top = qd.docs.map(function (c, j) { return j; }).filter(function (j) { return qd.docs[j].rank < 3; }).sort(function (a, b) { return qd.docs[a].rank - qd.docs[b].rank; });
      var hits = picks.filter(function (j) { return qd.docs[j].rank < 3; }).length;
      addPts(hits * L.PTS.pick);
      K.vibrate(hits === 3 ? 15 : [10, 40, 10]);
      top.forEach(function (j, n) { setTimeout(function () { M.line(q.at, qd.docs[j].at, qd.docs[j].plant ? 'plant' : 'good'); }, n * 160); });
      nodes.forEach(function (g, j) {
        var mine = picks.indexOf(j) >= 0, near = qd.docs[j].rank < 3;
        g.setAttribute('class', 'mm-doc done' + (near ? ' near' : '') + (mine && !near ? ' wrong' : '') + (mine ? ' mine' : '') + (qd.docs[j].plant ? ' plant' : ''));
        g._num.textContent = near ? String(qd.docs[j].rank + 1) : mine ? '×' : '';
        g.setAttribute('aria-label', qd.docs[j].t + (near ? ', nearest #' + (qd.docs[j].rank + 1) : '') + (mine && !near ? ', not one of the 3 nearest' : ''));
      });
      floatPts(M.wrap, hits ? '+' + hits * L.PTS.pick : 'Miss', !hits);
      var kids = [
        el('p', { class: 'big', text: hits === 3 ? '+300 · All 3 nearest.' : hits ? '+' + hits * L.PTS.pick + ' · ' + hits + ' of the 3 nearest.' : 'None of the 3 nearest.' }),
        el('p', { text: q.lesson }),
      ];
      if (q.from) {
        var ghost = M.dot(M.fx, D.bank, 'open a bank account', 'r', 'mm-query ghost', 5);
        tween(REDUCE ? 0 : 800, function (t) { ghost.moveTo([lerp(D.bank[0], 124, t), lerp(D.bank[1], 358, t)]); });
        kids.push(el('p', { class: 'small', text: 'Same word, new context: “open a bank account” lands by the money pages instead.' }));
      }
      if (r3) {
        kids.push(el('p', { class: 'kicker', style: 'margin:8px 0', text: 'What the search hands back' }));
        kids.push(el('ol', { class: 'mm-fetched' }, top.map(function (j) {
          var c = qd.docs[j];
          return el('li', { class: c.plant ? 'plant' : '' }, [el('b', { text: c.plant ? D.plant.t : c.t }), c.plant ? el('span', { text: D.plant.body }) : null]);
        })));
      }
      fb.replaceChildren(el('div', { class: 'feedback ' + (hits === 3 ? 'mm-good' : hits ? '' : 'mm-badfb') }, kids));
      var last = i === S.d.queries.length - 1, endRound = last || S.d.queries[i + 1].round !== qd.round;
      var next = el('button', { class: 'btn', type: 'button', disabled: true, text: last ? 'Find the plant' : endRound ? 'Next round' : 'Next search', onclick: function () {
        if (last) return spot();
        if (endRound) return K.roundOverlay(main, D.rounds, S.d.queries[i + 1].round, function () { search(i + 1); }, 'Someone has added a page to the search index. Search exactly as before, and watch what comes back.');
        search(i + 1);
      } });
      cta.replaceChildren(next);
      setTimeout(function () { next.disabled = false; next.focus(); next.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 900);
    }

    main.replaceChildren(el('section', { class: 'screen mm' }, [
      hud(round.name + ' · ' + round.title, 'Search ' + nth + ' of ' + nInRound + '. Tap the 3 pages closest to the glowing search.'),
      el('p', { class: 'mm-query-pill' }, [el('span', { class: 'mm-q-ic', 'aria-hidden': 'true' }), el('span', { class: 'mm-q-k', text: 'Search' }), el('b', { text: '“' + q.q + '”' })]),
      M.wrap, fb, cta, disclaimer(),
    ]));
    setGo();

    // zoom in, drop the query, then hand over control
    var ready = function () { busy = false; t0 = Date.now(); setGo(); };
    M.setView(q.view, 900, function () {
      M.svg.setAttribute('class', 'mm-svg mm-searching mm-zoomed');
      qdot.style.opacity = '1';
      if (q.from) {
        fb.replaceChildren(el('p', { class: 'note-in', text: 'Alone, “bank” sits halfway between money and rivers…' }));
        setTimeout(function () {
          qdot._t.textContent = q.q;
          fb.replaceChildren(el('p', { class: 'note-in', text: '…add the words around it, and it moves.' }));
          tween(REDUCE ? 0 : 900, function (t) { qdot.moveTo([lerp(q.from[0], q.at[0], t), lerp(q.from[1], q.at[1], t)]); syncHalo(); }, function () { setTimeout(function () { qdot._t.classList.add('gone'); fb.replaceChildren(); ready(); }, 500); });
        }, 1100);
      } else {
        var y0 = q.at[1] - 70;
        tween(REDUCE ? 0 : 450, function (t) { qdot.moveTo([q.at[0], lerp(y0, q.at[1], t)]); syncHalo(); }, ready);
      }
    });
  }

  // ---------------------------------------------------------------- round 3: spot the plant
  function spot() {
    var busy = true, t0 = 0;
    var M = makeMap(FULL);
    drawBase(M, true);
    M.svg.setAttribute('class', 'mm-svg mm-searching');
    var spots = S.d.queries.filter(function (x) { return x.round === 2; }).map(function (x) { return [x.q.q, x.q.at, x.q.plantAt]; })
      .concat(D.montage.map(function (m) { return [m[0], m[1], [m[1][0] + 16, m[1][1] - 14]]; }));
    var copies = [];
    spots.forEach(function (sp, n) {
      setTimeout(function () {
        var qd = M.dot(M.fx, sp[1], sp[0], 'b', 'mm-query mm-qsmall', 4.5);
        M.line(sp[1], sp[2], 'plant');
        copies.push(M.dot(M.docs, sp[2], null, 'r', 'mm-doc copy', 4.5));
        qd.style.opacity = '1';
      }, n * 260);
    });
    var fb = el('div', { class: 'mm-fb', 'aria-live': 'polite' }), cta = el('div', { class: 'cta static' });
    var opts = S.d.spot.map(function (o, j) {
      return el('button', { type: 'button', class: 'mm-opt', disabled: true, 'data-i': j, text: o.t, onclick: function () { pick(j); } });
    });
    function pick(j) {
      if (busy) return; busy = true;
      S.moves.spot.push(j, Math.max(L.FLOOR.spot, Math.min(300000, Date.now() - t0)));
      var ok = S.d.spot[j].plant; if (ok) addPts(L.PTS.spot);
      K.vibrate(ok ? 15 : [10, 40, 10]);
      opts.forEach(function (b, n) { b.disabled = true; if (S.d.spot[n].plant) b.classList.add('right'); if (n === j && !ok) b.classList.add('wrong'); });
      copies.forEach(function (c) { c.setAttribute('class', 'mm-doc copy gone'); });
      floatPts(M.wrap, ok ? '+300' : 'Miss', !ok);
      fb.replaceChildren(el('div', { class: 'feedback ' + (ok ? 'mm-good' : 'mm-badfb') }, [
        el('p', { class: 'big', text: ok ? '+300 · Caught it. Pulled from the index.' : 'That one is a real page.' }),
        el('p', { text: ok ? 'It was written to match every popular search, so it got fetched for all of them. With it gone, searches get their real pages back.' : 'The plant was “' + D.plant.short + '”: written to match every popular search, so it got fetched for all of them.' }),
      ]));
      var b = el('button', { class: 'btn', type: 'button', disabled: true, text: 'See your score', onclick: finish });
      cta.replaceChildren(b);
      setTimeout(function () { b.disabled = false; b.focus(); b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 700);
    }
    main.replaceChildren(el('section', { class: 'screen mm' }, [
      hud('Round 3 · The planted page', 'One page sat next to every one of these searches.'),
      M.wrap,
      el('p', { class: 'small', style: 'margin:0 0 10px', text: 'A flat map has to draw it many times. In hundreds or thousands of dimensions there is room for one crafted page to sit close to many different searches at once.' }),
      el('p', { class: 'mm-ask', text: 'Which page is the plant? Tap it to pull it from the index.' }),
      el('div', { class: 'mm-opts' }, opts),
      fb, cta,
    ]));
    setTimeout(function () { busy = false; t0 = Date.now(); opts.forEach(function (b) { b.disabled = false; }); }, spots.length * 260 + 300);
  }

  function finish() {
    var res = L.replay(S.run.seed, S.moves), d = res.detail || {};
    var remember = [
      ['Similar meanings sit close together.', 'An embedding model turns text into a long list of numbers, so “kitten” lands near “cat”, not “kitchen”.'],
      ['Search fetches the nearest points.', 'That is vector search. It matches meaning, even when no words are shared.'],
      ['Close is not the same as trustworthy.', 'Researchers have shown that a small number of crafted passages can get fetched for many different questions. Control who can add pages, and treat what comes back as untrusted.'],
    ];
    if (d.placed < 4) remember.unshift(['Meaning, not spelling.', 'You placed ' + d.placed + ' of 4 words in the right neighbourhood.']);
    K.results(main, G, S.run, res, {
      title: d.placed === 4 && d.found === 12 && d.spotted ? 'You think in vectors.' : d.found >= 9 ? 'You searched by meaning.' : 'The map is stranger than it looks.',
      stats: [[d.placed + '/4', 'words placed'], [d.found + '/12', 'nearest pages found'], [d.spotted ? 'Yes' : 'No', 'plant caught']],
      remember: remember, onAgain: start,
    });
  }

  K.intro(main, G, start);
})();
