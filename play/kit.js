/* Fencing Token Arcade kit: the pieces every game shares, whatever its way of playing.
   Intro screen, round overlays, results (local best, stars, server-verified score, rank, name, boards,
   share, next steps), the leaderboard screen, the anonymous player token, and local progress for the path map. */
(function () {
  'use strict';
  if (window.top !== window.self) { document.documentElement.innerHTML = ''; throw new Error('Cannot be embedded.'); }
  var NEWSLETTER = 'https://www.linkedin.com/build-relation/newsletter-follow?entityUrn=7523585585391788032';
  var q = new URLSearchParams(location.search);
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  var api = ((local && q.get('api')) || (window.FT_LIVE && window.FT_LIVE.api) || '').replace(/^wss:/, 'https:').replace(/^ws:/, 'http:').replace(/\/$/, '');
  if (api.indexOf('REPLACE-ME') >= 0) api = '';

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      var v = attrs[k];
      if (v === null || v === undefined || v === false) continue;
      if (k === 'text') n.textContent = v; else if (k === 'class') n.className = v;
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
    }
    (kids || []).forEach(function (c) { if (c !== null && c !== undefined && c !== false) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function fmt(n) { return Number(n || 0).toLocaleString('en-IN'); }
  function post(path, body) {
    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 6000);
    return fetch(api + path, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: JSON.stringify(body), signal: ctl.signal })
      .then(function (r) { clearTimeout(t); return r.json().then(function (j) { j._status = r.status; return j; }); });
  }
  function get(path) { return fetch(api + path).then(function (r) { return r.json(); }); }
  var toastT = null;
  function toast(t) {
    var host = document.getElementById('app') || document.body, n = document.querySelector('.toast'); if (n) n.remove();
    n = el('div', { class: 'toast', role: 'status', text: t }); host.appendChild(n);
    clearTimeout(toastT); toastT = setTimeout(function () { n.remove(); }, 2800);
  }
  function vibrate(p) { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) {} }

  // ---------------------------------------------------------------- identity + progress
  function player() { return store('ftarcade-player') || ''; }
  function progress() { try { return JSON.parse(store('ftarcade-progress') || '{}'); } catch (e) { return {}; } }
  function record(id, score, stars) {
    var p = progress(), cur = p[id] || { best: 0, stars: 0, plays: 0 };
    cur.plays++; if (score > cur.best) cur.best = score; if (stars > cur.stars) cur.stars = stars;
    p[id] = cur; store('ftarcade-progress', JSON.stringify(p));
    return cur;
  }
  function starsFor(logic, score) { return (logic.stars || []).filter(function (t) { return score >= t; }).length; }
  function starRow(n) { return el('span', { class: 'stars', 'aria-label': n + ' of 3 stars' }, [0, 1, 2].map(function (k) { return el('i', { class: k < n ? 'on' : '' }); })); }

  // Start a run: server seed + token when online, a local seed otherwise.
  function startRun(logic) {
    var offline = function (msg) { if (msg) toast(msg); return { seed: Math.floor(Math.random() * 4294967296), token: null }; };
    if (!api) return Promise.resolve(offline());
    return post('/arcade/start', { game: logic.id, player: player() || undefined }).then(function (r) {
      if (r.player) store('ftarcade-player', r.player);
      if (r.token && r.version === logic.VERSION) return { seed: r.seed >>> 0, token: r.token };
      return offline(r.version && r.version !== logic.VERSION ? 'A newer version is out. Refresh to get it.' : (r.error || ''));
    }).catch(function () { return offline('Leaderboard offline: playing for a local best.'); });
  }

  // ---------------------------------------------------------------- screens
  function intro(main, G, onPlay) {
    var mine = progress()[G.logic.id];
    main.replaceChildren(el('section', { class: 'screen' }, [
      el('p', { class: 'kicker', text: G.kicker || 'Fencing Token Arcade' }),
      el('h1', { text: G.title }),
      el('p', { class: 'pitch', text: G.pitch }),
      G.howto ? el('ul', { class: 'howto' }, G.howto.map(function (h) { return el('li', {}, [el('span', { class: 'ic ' + (h.cls || ''), text: h.glyph, 'aria-hidden': 'true' }), h.text]); })) : null,
      el('p', { class: 'meta' }, [G.meta, mine ? ' · your best ' + fmt(mine.best) + ' ' : null, mine ? starRow(mine.stars) : null]),
      el('div', { class: 'cta' }, [
        el('button', { class: 'btn', type: 'button', text: 'Play', onclick: onPlay }),
        G.learn ? el('button', { class: 'btn ghost', type: 'button', text: (G.learnLabel || 'How it works') + ' · 1 min', onclick: function () { learn(main, G, onPlay, function () { intro(main, G, onPlay); }); } }) : null,
        api ? el('button', { class: 'btn ghost', type: 'button', text: 'Leaderboard', onclick: function () { boardScreen(main, G, function () { intro(main, G, onPlay); }, onPlay); } }) : null,
        el('a', { class: 'btn ghost linkbtn', href: '/play/', text: 'All games' }),
      ]),
    ]));
  }

  /* learn(main, G, onPlay, back): a short card-by-card explainer before playing.
     G.learn = [{ title, text, art?: function (el) -> Node, note? }], G.learnLabel = button text. */
  function learn(main, G, onPlay, back) {
    var cards = G.learn, i = 0;
    var draw = function () {
      var c = cards[i], last = i === cards.length - 1;
      var go = function (d) { var j = i + d; if (j < 0) return back(); if (j >= cards.length) return onPlay(); i = j; draw(); };
      var sec = el('section', { class: 'screen learn', tabindex: '-1', onkeydown: function (e) { if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); } }, [
        el('p', { class: 'kicker', text: (G.learnLabel || 'How it works') + ' · ' + (i + 1) + ' of ' + cards.length }),
        el('h2', { class: 'learn-h', text: c.title }),
        c.art ? el('div', { class: 'learn-art' }, [c.art(el)]) : null,
        el('p', { class: 'learn-p', text: c.text }),
        c.note ? el('p', { class: 'small', text: c.note }) : null,
        el('div', { class: 'learn-dots', 'aria-hidden': 'true' }, cards.map(function (x, k) { return el('i', { class: k === i ? 'on' : '' }); })),
        el('div', { class: 'cta' }, [
          el('button', { class: 'btn', type: 'button', text: last ? 'Play ' + G.title : 'Next', onclick: function () { go(1); } }),
          el('button', { class: 'btn ghost', type: 'button', text: i ? 'Back' : 'Back to the game', onclick: function () { go(-1); } }),
        ]),
      ]);
      // swipe left/right on touch screens
      var x0 = null;
      sec.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
      sec.addEventListener('touchend', function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 60) go(dx < 0 ? 1 : -1); });
      main.replaceChildren(sec);
      setTimeout(function () { var b = sec.querySelector('.btn'); if (b) b.focus(); }, 30);
    };
    draw();
  }
  // Odds bars and a step-by-step flow, for explainers and games.
  function bars(rows, opts) {
    opts = opts || {};
    return el('div', { class: 'lbars' + (opts.compact ? ' compact' : '') }, rows.map(function (r) {
      var pct = Math.round(r[1] * 100);
      return el('div', { class: 'lbar' + (r[2] ? ' top' : '') }, [el('span', { class: 'w', text: r[0] }), el('span', { class: 'track' }, [el('i', { style: 'width:' + Math.max(1, pct) + '%' })]), el('span', { class: 'pct', text: pct + '%' })]);
    }));
  }
  function flow(steps) {
    var kids = [];
    steps.forEach(function (st, k) { if (k) kids.push(el('span', { class: 'lflow-arrow', 'aria-hidden': 'true', text: '↓' })); kids.push(el('div', { class: 'lflow-step' + (st[2] ? ' ' + st[2] : '') }, [el('b', { text: st[0] }), st[1] ? el('span', { text: st[1] }) : null])); });
    return el('div', { class: 'lflow' }, kids);
  }

  function roundOverlay(main, rounds, ri, onGo, note) {
    var round = rounds[ri], prev = ri > 0 ? rounds[ri - 1] : null;
    main.replaceChildren(el('div', { class: 'overlay', role: 'dialog', 'aria-label': round.name }, [
      prev && prev.rule ? el('p', { class: 'kicker', text: 'Rule unlocked' }) : null,
      prev && prev.rule ? el('p', { class: 'rule', text: prev.rule }) : null,
      el('p', { class: 'kicker', text: round.name }),
      el('h2', { text: round.title }),
      note ? el('p', { class: 'small', text: note }) : null,
      el('div', { class: 'cta', style: 'margin-top:22px' }, [el('button', { class: 'btn', type: 'button', text: ri === 0 ? 'Start' : 'Continue', onclick: onGo })]),
    ]));
    setTimeout(function () { var b = main.querySelector('.overlay .btn'); if (b) b.focus(); }, 50);
  }

  /* results(main, G, run, res, extra): run = {token}, res = logic.replay(...) result.
     extra = { title, stats: [[value, label]], remember: [lessons], onAgain } */
  function results(main, G, run, res, extra) {
    var stars = starsFor(G.logic, res.score), prevBest = (progress()[G.logic.id] || {}).best || 0;
    record(G.logic.id, res.score, stars);
    var server = el('div', { id: 'server' }, [api && run.token ? el('p', { class: 'small', text: 'Checking your run on the server…' }) : el('p', { class: 'small', text: api ? 'Leaderboard offline for this run. Your best is saved on this device.' : 'Your best is saved on this device.' })]);
    main.replaceChildren(el('section', { class: 'screen' }, [
      el('p', { class: 'kicker', text: extra.kicker || 'Run complete' }),
      el('h1', { text: extra.title }),
      el('div', { class: 'scoreline' }, [el('p', { class: 'result-score', text: fmt(res.score) }), starRow(stars)]),
      el('p', { class: 'small', text: res.score > prevBest ? 'New personal best!' : 'Your best: ' + fmt(Math.max(prevBest, res.score)) }),
      extra.stats ? el('div', { class: 'stats' }, extra.stats.map(function (s) { return el('div', { class: 'stat' }, [el('b', { text: String(s[0]) }), el('span', { text: s[1] })]); })) : null,
      server,
      extra.remember && extra.remember.length ? el('p', { class: 'kicker', text: 'What to remember' }) : null,
      extra.remember && extra.remember.length ? el('ul', { class: 'mistakes' }, extra.remember.map(function (w) { return el('li', {}, [el('b', { text: w[0] }), w[1] || '']); })) : null,
      el('div', { class: 'cta static' }, [
        el('button', { class: 'btn', type: 'button', text: 'Play again', onclick: extra.onAgain }),
        G.nextGame ? el('a', { class: 'btn ghost linkbtn', href: G.nextGame.href, text: 'Next game: ' + G.nextGame.title + ' →' }) : null,
        el('button', { class: 'btn ghost', type: 'button', text: 'Share your score', onclick: function () { share(G, res.score); } }),
      ]),
      el('p', { class: 'kicker', style: 'margin-top:20px', text: 'Learn more' }),
      el('div', { class: 'next' }, (G.next || []).concat([{ href: NEWSLETTER, text: 'Get the weekly newsletter', sub: 'One teardown, one idea explained three ways, one tool, one pattern.' }]).map(function (n) {
        return el('a', { href: n.href }, [n.text, el('span', { text: n.sub })]);
      })),
      el('p', { class: 'small' }, [el('a', { href: '/play/', text: 'All games' }), ' · ', el('a', { href: '/', text: 'fencingtoken.com' })]),
    ]));
    if (api && run.token) submit(G, run, res);
  }

  function submit(G, run, res) {
    var box = document.getElementById('server');
    post('/arcade/submit', { token: run.token, moves: run.moves }).then(function (r) {
      if (r._status !== 200) { box.replaceChildren(el('p', { class: 'small', text: r.error || 'The server did not accept this run.' })); return; }
      var kids = [el('p', { class: 'rankline' }, ['Server-verified. You’re ', el('b', { text: '#' + fmt(r.rank.week) }), ' this week and #' + fmt(r.rank.all) + ' all-time.'])];
      if (!r.name) kids.push(nameBox(G));
      kids.push(boards(r.board));
      box.replaceChildren.apply(box, kids);
    }).catch(function () { box.replaceChildren(el('p', { class: 'small', text: 'Could not reach the leaderboard. Your best is saved on this device.' })); });
  }

  function nameBox(G) {
    var inp = el('input', { maxlength: 12, value: store('ftarcade-name') || '', placeholder: 'YOUR NAME', 'aria-label': 'Name for the leaderboard (3–12 letters or numbers)', autocomplete: 'nickname' });
    var form = el('form', { class: 'namebox', onsubmit: function (e) {
      e.preventDefault();
      var n = inp.value.replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
      if (n.length < 3) return toast('3–12 letters or numbers.');
      post('/arcade/name', { player: player(), name: n, game: G.logic.id }).then(function (r) {
        if (r._status !== 200) return toast(r.error || 'Could not save the name.');
        store('ftarcade-name', r.name);
        form.replaceWith(el('p', { class: 'small', text: 'You’re on the board as ' + r.name + ' in every game.' }));
        var b = document.querySelector('.boards'); if (b && r.board) b.replaceWith(boards(r.board));
      }).catch(function () { toast('Could not reach the leaderboard.'); });
    } }, [inp, el('button', { class: 'btn', type: 'submit', text: 'Save' })]);
    return el('div', {}, [el('p', { class: 'small', text: 'Put a name on the board (optional, no sign-up):' }), form]);
  }

  function boards(b) {
    var tabs = b.week ? [['week', 'This week'], ['all', 'All-time']] : [['all', 'All-time']], cur = tabs[0][0], wrap = el('div', { class: 'boards' });
    var draw = function () {
      var list = (b && b[cur]) || [];
      wrap.replaceChildren.apply(wrap, [
        tabs.length > 1 ? el('div', { class: 'tabs', role: 'tablist' }, tabs.map(function (t) {
          return el('button', { type: 'button', role: 'tab', 'aria-selected': cur === t[0] ? 'true' : 'false', text: t[1], onclick: function () { cur = t[0]; draw(); } });
        })) : null,
        list.length ? el('ol', { class: 'board' }, list.map(function (r) {
          return el('li', { class: r.you ? 'me' : '' }, [el('span', { class: 'r', text: '#' + r.r }), el('span', { class: 'n', text: r.n }), el('span', { class: 's', text: r.g !== undefined ? r.s + ' ★' : fmt(r.s) })]);
        })) : el('p', { class: 'small', text: 'No scores yet. Be the first.' })].filter(Boolean));
    };
    draw();
    return wrap;
  }

  function boardScreen(main, G, back, onPlay) {
    main.replaceChildren(el('section', { class: 'screen' }, [el('p', { class: 'kicker', text: G.title }), el('h1', { text: 'Leaderboard' }), el('div', { id: 'lb', class: 'small', text: 'Loading…' }),
      el('div', { class: 'cta' }, [onPlay ? el('button', { class: 'btn', type: 'button', text: 'Play', onclick: onPlay }) : null, el('button', { class: 'btn ghost', type: 'button', text: 'Back', onclick: back })])]));
    get('/arcade/board?game=' + encodeURIComponent(G.logic.id)).then(function (b) {
      var n = document.getElementById('lb'); if (n) n.replaceWith(el('div', { style: 'margin-bottom:16px' }, [el('p', { class: 'small', text: 'Every score is replayed and checked by the server. Each player’s best counts.' }), boards(b)]));
    }).catch(function () { var n = document.getElementById('lb'); if (n) n.textContent = 'Could not load the leaderboard.'; });
  }

  function share(G, score) {
    var text = G.shareText(fmt(score)), url = location.origin + location.pathname;
    if (navigator.share) { navigator.share({ title: G.title, text: text, url: url }).catch(function () {}); return; }
    var full = text + ' ' + url;
    if (navigator.clipboard) navigator.clipboard.writeText(full).then(function () { toast('Copied. Paste it anywhere.'); }, function () { toast(full); });
    else toast(full);
  }

  window.FTKit = { el: el, store: store, fmt: fmt, post: post, get: get, toast: toast, vibrate: vibrate, api: function () { return api; },
    player: player, progress: progress, starsFor: starsFor, starRow: starRow, startRun: startRun,
    intro: intro, learn: learn, bars: bars, flow: flow, roundOverlay: roundOverlay, results: results, boards: boards, NEWSLETTER: NEWSLETTER };
})();
