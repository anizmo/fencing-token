/* Fencing Token Live: the presenter console.
   Load a session file (.md or .json) from your laptop, then share this tab.
   The presenter panel (notes, answers, moderation) is hidden by default so it never leaks into a screen share. */
(function () {
  'use strict';
  var F = window.FTL, el = F.el;
  var app = document.getElementById('app');
  var hashKey = (location.hash.match(/key=([^&]+)/) || [])[1];
  if (hashKey) { try { sessionStorage.setItem('ftlive-key', decodeURIComponent(hashKey)); } catch (e) {} history.replaceState(null, '', location.pathname + location.search); }
  var key = ''; try { key = sessionStorage.getItem('ftlive-key') || ''; } catch (e) {}
  var room = (F.params.get('c') || F.cfg.defaultRoom || 'LIVE').toUpperCase().replace(/[^A-Z0-9]/g, '');
  var live = null, S = null, clean = false, panel = false, cloudPos = {}, lastStageKey = '', qrCache = {}, skew = 0, pendingDeck = null;
  var joinText = F.cfg.joinUrl || 'fencingtoken.com/live';
  function joinURL() { return 'https://' + joinText + '/?c=' + room; }

  function toast(t) { var n = el('div', { class: 'toast', role: 'status', text: t }); document.body.appendChild(n); setTimeout(function () { n.remove(); }, 4000); }

  // ---------------------------------------------------------------- login
  function login(msg) {
    document.documentElement.classList.add('force-light');
    var r = el('input', { class: 'field code-in', value: room, maxlength: 16, 'aria-label': 'Room code' });
    var k = el('input', { class: 'field', type: 'password', autocomplete: 'current-password', placeholder: 'HOST_KEY', 'aria-label': 'Host key' });
    app.replaceChildren(el('form', { class: 'hostlogin', onsubmit: function (e) {
      e.preventDefault();
      room = r.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); key = k.value;
      try { sessionStorage.setItem('ftlive-key', key); } catch (x) {}
      history.replaceState(null, '', '?c=' + room);
      start();
    } }, [
      el('p', { class: 'kicker', text: 'Fencing Token Live' }), el('h1', { text: 'Presenter console' }),
      msg ? el('p', { class: 'note bad', text: msg }) : null,
      el('label', { text: 'Room code (3–16 letters or digits; one per session)' }), r, el('label', { text: 'Host key' }), k,
      el('div', { class: 'row' }, [el('button', { class: 'btn', type: 'submit', text: 'Open console' })]),
      el('p', { class: 'small muted', text: 'The key stays in this browser tab only. Let your password manager fill it in rather than putting it in a link you might show on screen.' }),
    ]));
  }

  // ---------------------------------------------------------------- connect
  function start() {
    document.documentElement.classList.remove('force-light');
    app.replaceChildren(el('p', { class: 'stat', text: 'Connecting…', style: 'padding:20px' }));
    live = new F.Live(room, 'host', onMessage, function (s) {
      var st = document.getElementById('conn');
      if (st) st.textContent = s === 'open' ? 'online' : s;
      if (s === 'denied') { try { sessionStorage.removeItem('ftlive-key'); } catch (e) {} live.closed = true; login('That host key was not accepted.'); }
      if (s === 'config') login('config.js still has the placeholder server address. Set it after deploying the Worker.');
    });
    live.onOpen = function () { live.send({ t: 'auth', key: key }); };
  }

  function onMessage(m) {
    if (m.t === 'authed') { skew = (m.now || Date.now()) - Date.now(); if (!document.getElementById('stage')) build(); return; }
    if (m.t === 'error') return toast(m.msg);
    if (m.t === 'confirm') {
      if (pendingDeck && confirm(m.msg + ' Replace it with "' + (pendingDeck.title || 'this session') + '"? This permanently deletes the current answers.')) sendDeck(pendingDeck, true);
      return;
    }
    if (m.t === 'host') { skew = (m.now || Date.now()) - Date.now(); S = m; if (!document.getElementById('stage')) build(); render(); }
  }
  function cmd(o) { live.send(o); }
  function now() { return Date.now() + skew; }

  // ---------------------------------------------------------------- session files
  var picker = el('input', { type: 'file', accept: '.md,.markdown,.json,.txt', style: 'display:none', onchange: function () { if (picker.files[0]) readFile(picker.files[0]); picker.value = ''; } });
  document.body.appendChild(picker);
  function readFile(file) {
    var fr = new FileReader();
    fr.onload = function () {
      var deck;
      try { deck = window.FTLDeck.parse(String(fr.result), file.name); } catch (e) { return toast('Could not read ' + file.name + ': ' + e.message); }
      if (deck.errors.length) { alert('Fix these in ' + file.name + ' first:\n\n' + deck.errors.slice(0, 15).join('\n')); return; }
      if (deck.room && deck.room !== room && confirm('This session file is for room ' + deck.room + ', but you are in room ' + room + '. Switch to room ' + deck.room + '?')) {
        try { sessionStorage.setItem('ftlive-pending-deck', JSON.stringify(deck)); } catch (e) {}
        location.href = location.pathname + '?c=' + deck.room;
        return;
      }
      sendDeck(deck, false);
    };
    fr.readAsText(file);
  }
  function sendDeck(deck, force) {
    pendingDeck = deck;
    cmd({ t: 'deck', deck: deck.items, title: deck.title, force: !!force, qaModerate: true });
    try { localStorage.setItem('ftlive-last-' + room, JSON.stringify(deck)); } catch (e) {}
    toast('Loaded “' + (deck.title || 'session') + '”: ' + deck.items.length + ' items');
  }
  document.addEventListener('dragover', function (e) { e.preventDefault(); });
  document.addEventListener('drop', function (e) { e.preventDefault(); var f = e.dataTransfer && e.dataTransfer.files[0]; if (f) readFile(f); });

  // ---------------------------------------------------------------- layout
  function build() {
    var ctrl = el('div', { class: 'ctrl', id: 'ctrl' }, [
      el('span', { class: 'wordmark' }, ['fencing ', el('b', { text: 'token' }), ' live']),
      el('span', { class: 'stat' }, ['room ', el('b', { text: room })]),
      el('span', { class: 'stat' }, [el('b', { id: 'ppl', text: '0' }), ' joined']),
      el('span', { class: 'stat' }, [el('b', { id: 'pos', text: '–' })]),
      el('span', { class: 'pill', id: 'status', text: '–' }),
      el('button', { class: 'btn', type: 'button', text: '◀ Prev', title: 'Left arrow', onclick: function () { go(-1); } }),
      el('button', { class: 'btn primary', type: 'button', text: 'Next ▶', title: 'Right arrow', onclick: function () { go(1); } }),
      el('button', { class: 'btn', id: 'oc', type: 'button', text: 'Open', title: 'Space', onclick: toggleOpen }),
      el('button', { class: 'btn', type: 'button', text: 'Reveal', title: 'R', onclick: function () { cmd({ t: 'reveal' }); } }),
      el('button', { class: 'btn', id: 'res', type: 'button', text: 'Results on phones', title: 'S', onclick: function () { if (S && S.meta) cmd({ t: 'results', on: !S.meta.results }); } }),
      el('button', { class: 'btn', id: 'qab', type: 'button', text: 'Q&A', title: 'Q', onclick: function () { if (S && S.meta) cmd({ t: 'qaOpen', on: !S.meta.qaOpen }); } }),
      el('button', { class: 'btn', id: 'pnl', type: 'button', text: 'Presenter panel', title: 'P (keep off while sharing your screen)', onclick: togglePanel }),
      el('button', { class: 'btn', type: 'button', text: 'Clean view', title: 'C', onclick: toggleClean }),
      el('button', { class: 'btn', type: 'button', text: 'Fullscreen', title: 'F', onclick: fullscreen }),
      el('span', { class: 'stat', style: 'margin-left:auto' }, ['server ', el('b', { id: 'conn', text: 'online' })]),
      el('button', { class: 'btn', type: 'button', text: 'Load session file', onclick: function () { picker.click(); } }),
      el('button', { class: 'btn', type: 'button', text: 'Reset question', onclick: function () { if (confirm('Delete all answers (and quiz points) for this question?')) cmd({ t: 'resetItem' }); } }),
      el('button', { class: 'btn', type: 'button', text: 'End & delete', onclick: function () { if (confirm('End the session and permanently delete every answer, score and question now? (Data also auto-deletes 24 hours after loading.)')) cmd({ t: 'wipe' }); } }),
    ]);
    var stage = el('section', { class: 'stage', id: 'stage', 'aria-live': 'polite' });
    var side = el('aside', { class: 'side', id: 'side' });
    app.replaceChildren(el('div', { class: 'host' + (clean ? ' clean' : '') + (panel ? '' : ' nopanel'), id: 'host' }, [ctrl, el('div', { class: 'body' }, [stage, side])]));
    var pd = null; try { pd = sessionStorage.getItem('ftlive-pending-deck'); sessionStorage.removeItem('ftlive-pending-deck'); } catch (e) {}
    if (pd) { try { sendDeck(JSON.parse(pd), false); } catch (e) {} }
  }

  function go(d) { if (!S || !S.meta) return; var i = Math.max(0, Math.min(S.meta.total - 1, S.meta.cur + d)); if (i !== S.meta.cur) cmd({ t: 'go', i: i }); }
  function toggleOpen() { if (!S || !S.meta) return; cmd({ t: S.meta.status === 'open' ? 'close' : 'open' }); }
  function toggleClean() { clean = !clean; var h = document.getElementById('host'); if (h) h.classList.toggle('clean', clean); lastStageKey = ''; render(); }
  function togglePanel() { panel = !panel; var h = document.getElementById('host'); if (h) h.classList.toggle('nopanel', !panel); lastStageKey = ''; render(); }
  function fullscreen() { if (!document.fullscreenElement) { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen(); } else document.exitFullscreen(); }

  document.addEventListener('keydown', function (e) {
    var t = e.target.tagName;
    if (t === 'INPUT' || t === 'TEXTAREA' || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(1); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1); }
    else if (e.key === ' ') { e.preventDefault(); toggleOpen(); }
    else if (e.key === 'r' || e.key === 'R') cmd({ t: 'reveal' });
    else if (e.key === 's' || e.key === 'S') { if (S && S.meta) cmd({ t: 'results', on: !S.meta.results }); }
    else if (e.key === 'q' || e.key === 'Q') { if (S && S.meta) cmd({ t: 'qaOpen', on: !S.meta.qaOpen }); }
    else if (e.key === 'p' || e.key === 'P') togglePanel();
    else if (e.key === 'c' || e.key === 'C') toggleClean();
    else if (e.key === 'f' || e.key === 'F') fullscreen();
  });

  // ---------------------------------------------------------------- render
  function qrSvg(text) {
    if (qrCache[text] !== undefined) return qrCache[text];
    try { var qr = window.qrcode(0, 'M'); qr.addData(text); qr.make(); qrCache[text] = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true, alt: 'QR code to join' }); } catch (e) { qrCache[text] = ''; }
    return qrCache[text];
  }
  function qrNode(cls) { var d = el('div', { class: cls, role: 'img', 'aria-label': 'QR code: ' + joinURL() }); d.innerHTML = qrSvg(joinURL()); return d; }

  function render() {
    if (!S) return;
    var stage = document.getElementById('stage'), side = document.getElementById('side');
    if (!stage) return;
    document.getElementById('ppl').textContent = String(S.participants || 0);
    if (!S.live) {
      document.getElementById('pos').textContent = 'no session';
      lastStageKey = '';
      stage.replaceChildren(el('div', { class: 'titlecard' }, [el('div', {}, [el('p', { class: 'kicker', text: 'Room ' + room }),
        el('h1', { text: 'Load a session file to start' }),
        el('p', { class: 'sub', text: 'Click “Load session file” or drop a .md / .json file anywhere on this page.' }),
        lastDeckButton()])]));
      side.replaceChildren();
      return;
    }
    var m = S.meta, it = S.item || {};
    document.getElementById('pos').textContent = (m.cur + 1) + ' / ' + m.total;
    var st = document.getElementById('status'); st.textContent = m.status; st.className = 'pill ' + m.status;
    document.getElementById('oc').textContent = m.status === 'open' ? 'Close voting' : 'Open voting';
    document.getElementById('res').classList.toggle('on', !!m.results);
    document.getElementById('qab').classList.toggle('on', !!m.qaOpen);
    document.getElementById('qab').textContent = m.qaOpen ? 'Q&A on' + (S.qaPending && S.qaPending.length ? ' (' + S.qaPending.length + ' waiting)' : '') : 'Q&A off';
    document.getElementById('pnl').classList.toggle('on', panel);
    renderStage(stage, m, it);
    if (panel && !clean) renderSide(side, m, it);
  }

  function lastDeckButton() {
    var raw = null; try { raw = localStorage.getItem('ftlive-last-' + room); } catch (e) {}
    if (!raw) return null;
    var d = null; try { d = JSON.parse(raw); } catch (e) { return null; }
    return el('p', {}, [el('button', { class: 'btn primary', type: 'button', text: 'Reload “' + (d.title || 'last session') + '”', onclick: function () { sendDeck(d, false); } })]);
  }

  function header(it) {
    var kids = [];
    if (it.section) kids.push(el('p', { class: 'kicker', text: it.section }));
    kids.push(el('h1', { text: it.prompt }));
    if (it.sub) kids.push(el('p', { class: 'sub', text: it.sub }));
    return kids;
  }

  function joinbar() {
    return el('div', { class: 'joinbar' }, [qrNode('qr'), el('span', {}, ['Join at ', el('b', { text: joinText }), ' · code ', el('b', { text: room })]),
      el('span', { class: 'brand' }, [String(S.participants || 0) + ' joined'])]);
  }

  function renderStage(stage, m, it) {
    var key = m.cur + ':' + it.type, fresh = key !== lastStageKey;
    lastStageKey = key;
    if (it.type === 'title') {
      if (!fresh) return;
      return stage.replaceChildren(el('div', { class: 'titlecard' }, [el('div', {}, header(it).concat([
        el('p', { class: 'join' }, ['On your phone or laptop, go to', el('span', { class: 'url', text: joinText }), 'and enter the code', el('span', { class: 'code', text: room })]),
      ])), qrNode('qr')]));
    }
    var kids = header(it), viz = el('div', { class: 'viz', id: 'viz' }), a = S.agg || {};
    if (['poll', 'multi', 'scale', 'quiz'].indexOf(it.type) >= 0) {
      var quiz = it.type === 'quiz', revealed = m.status === 'revealed';
      if (quiz && m.status === 'open') kids.push(el('div', { class: 'qtimer', id: 'qtimer', text: secondsLeft(it) + 's' }));
      kids.push(el('p', { class: 'answers', text: (a.n || 0) + ' answer' + (a.n === 1 ? '' : 's') + (m.status === 'open' ? ' · voting open' : m.status === 'closed' ? ' · voting closed' : '') }));
      viz.appendChild(stageBars(it, a.counts || [], (quiz || it.hide) && !revealed, revealed ? it.answer : undefined));
    } else if (it.type === 'cloud') {
      kids.push(el('p', { class: 'answers', text: (a.n || 0) + ' people answered' }));
      viz.appendChild(el('div', { class: 'cloud', id: 'cloud' }));
    } else if (it.type === 'wall') {
      if (m.status !== 'revealed') {
        viz.appendChild(el('div', {}, [el('p', { class: 'bigcount', text: String(a.n || 0) }), el('p', { class: 'sub', text: 'answers in. They stay hidden until reveal, so nobody copies the first one.' })]));
      } else {
        viz.appendChild(el('div', { class: 'wallgrid' }, (a.entries || []).slice(-80).reverse().map(function (e) { return el('div', { class: 'card', text: e.text }); })));
      }
    } else if (it.type === 'leaderboard') {
      viz.appendChild(el('ol', { class: 'slb' }, (S.top || []).map(function (r) { return el('li', {}, [el('span', { class: 'r', text: '#' + r.r }), el('span', { class: 'n', text: r.n }), el('span', { class: 's', text: r.s + ' pts' })]); })));
      if (!(S.top || []).length) viz.appendChild(el('p', { class: 'sub', text: 'No scores yet.' }));
    } else if (it.type === 'qa') {
      viz.appendChild(el('ol', { class: 'slb' }, (S.qa || []).filter(function (q) { return !q.done; }).slice(0, 7).map(function (q) {
        return el('li', {}, [el('span', { class: 'r', text: '▲' + q.up }), el('span', { class: 'n', text: q.text })]);
      })));
      if (!(S.qa || []).length) viz.appendChild(el('p', { class: 'sub', text: 'Ask in the Q&A tab on your phone.' }));
    }
    kids.push(viz, joinbar());
    stage.replaceChildren.apply(stage, kids);
    if (it.type === 'cloud') drawCloud(document.getElementById('cloud'), a.words || [], fresh);
  }

  function secondsLeft(it) { return Math.max(0, Math.ceil(((it.seconds || 30) * 1000 - (now() - S.meta.openedAt)) / 1000)); }

  function stageBars(it, counts, hide, answer) {
    var total = counts.reduce(function (x, y) { return x + y; }, 0) || 1, max = Math.max.apply(null, counts.concat([0]));
    return el('div', { class: 'sbars' }, it.options.map(function (o, k) {
      var pct = hide ? 0 : Math.round(100 * (counts[k] || 0) / total);
      var cls = 'sbar' + (answer === k ? ' correct' : '') + (!hide && counts[k] === max && max > 0 && answer === undefined ? ' lead' : '');
      return el('div', { class: cls }, [el('i', { style: 'width:' + pct + '%' }), el('span', {}, [el('span', {}, [el('span', { class: 'k', text: it.type === 'scale' ? String(k + 1) : F.letters[k] }), o + (answer === k ? '  ✓' : '')]), el('b', { text: hide ? '' : pct + '% · ' + (counts[k] || 0) })])]);
    }));
  }

  // Word cloud: spiral placement, keeping each word's previous spot when it still fits so the cloud doesn't jump.
  var measure = null; try { measure = document.createElement('canvas').getContext('2d'); } catch (e) { measure = null; }
  var COLORS = ['#F4A62A', '#FFFFFF', '#F7C873', '#8FB3E8', '#D6DCE4', '#5FCB97'];
  function drawCloud(box, words, fresh) {
    if (!box) return;
    if (fresh) cloudPos = {};
    var W = box.clientWidth, H = box.clientHeight;
    if (!words.length) return box.replaceChildren(el('p', { class: 'sub', text: 'Words appear here as people answer.' }));
    if (!W || !H) return;
    var maxC = words[0][1], minC = words[words.length - 1][1];
    var maxPx = Math.min(H / 4.2, W / 7, 130), minPx = Math.max(15, Math.min(22, H / 26));
    var placed = [], out = [];
    words.forEach(function (wc, idx) {
      var w = wc[0], c = wc[1];
      var t = maxC === minC ? 1 : (Math.sqrt(c) - Math.sqrt(minC)) / (Math.sqrt(maxC) - Math.sqrt(minC));
      var size = Math.round(minPx + (maxPx - minPx) * t);
      var bw = (measure ? (measure.font = '700 ' + size + 'px "Space Grotesk", sans-serif', measure.measureText(w).width) : w.length * size * 0.58) + 10, bh = size * 1.05;
      if (bw > W) return;
      var hit = function (x, y) {
        if (x < 0 || y < 0 || x + bw > W || y + bh > H) return true;
        for (var p = 0; p < placed.length; p++) { var r = placed[p]; if (x < r.x + r.w && x + bw > r.x && y < r.y + r.h && y + bh > r.y) return true; }
        return false;
      };
      var pos = null, prev = cloudPos[w];
      if (prev) { var px = prev.cx - bw / 2, py = prev.cy - bh / 2; if (!hit(px, py)) pos = { x: px, y: py }; }
      for (var s = 0; !pos && s < 1400; s++) {
        var ang = s * 0.32, rad = 2.2 * s;
        var x = W / 2 + rad * Math.cos(ang) * (W / H) * 0.55 - bw / 2, y = H / 2 + rad * Math.sin(ang) * 0.55 - bh / 2;
        if (!hit(x, y)) pos = { x: x, y: y };
      }
      if (!pos) return;
      placed.push({ x: pos.x, y: pos.y, w: bw, h: bh });
      cloudPos[w] = { cx: pos.x + bw / 2, cy: pos.y + bh / 2 };
      out.push(el('span', { title: c + ' × ' + w, style: 'left:' + pos.x + 'px;top:' + pos.y + 'px;font-size:' + size + 'px;color:' + COLORS[idx % COLORS.length] }, [w]));
    });
    box.replaceChildren.apply(box, out);
  }

  function chip(text, fn) { return el('button', { class: 'chip', type: 'button', text: text, onclick: fn }); }

  function renderSide(side, m, it) {
    var kids = [el('p', { class: 'small', style: 'color:#F4B54A;margin:0 0 8px', text: 'Presenter panel: turn off (P) before sharing your screen.' })];
    if (S.title) kids.push(el('h3', { text: S.title }));
    if (m.expires) kids.push(el('p', { class: 'small', style: 'color:#8F9CAE', text: 'Data auto-deletes ' + new Date(m.expires).toLocaleString() }));
    if (it.notes) kids.push(el('h3', { text: 'Speaker notes' }), el('div', { class: 'notes', text: it.notes }));
    if (typeof it.answer === 'number') kids.push(el('h3', { text: 'Answer' }), el('p', { class: 'notes', text: F.letters[it.answer] + ': ' + it.options[it.answer] }));
    var a = S.agg || {};
    if (it.type === 'cloud' && (a.words || []).length) {
      kids.push(el('h3', { text: 'Moderate: click a word to hide it' }), el('div', { class: 'mod' }, a.words.slice(0, 60).map(function (w) { return chip(w[0] + ' ' + w[1], function () { cmd({ t: 'hideWord', w: w[0] }); }); })));
    }
    if (it.type === 'wall' && (a.entries || []).length) {
      kids.push(el('h3', { text: 'Moderate answers (' + a.entries.length + ')' }), el('ul', { class: 'qa-h', style: 'padding:0' }, a.entries.slice(-40).reverse().map(function (e) {
        return el('li', {}, [e.text, el('div', { class: 'acts' }, [chip('Hide', function () { cmd({ t: 'hideEntry', v: e.id }); })])]);
      })));
    }
    if ((it.type === 'leaderboard' || it.type === 'quiz') && (S.top || []).length) {
      kids.push(el('h3', { text: 'Leaderboard names' }), el('ul', { class: 'qa-h', style: 'padding:0' }, S.top.map(function (r) {
        return el('li', {}, ['#' + r.r + ' ' + r.n + ' · ' + r.s, el('div', { class: 'acts' }, [chip('Hide / show name', function () { cmd({ t: 'hideName', v: r.v }); })])]);
      })));
    }
    var pend = S.qaPending || [];
    kids.push(el('h3', { text: 'Q&A waiting for approval (' + pend.length + ')' }));
    kids.push(el('ul', { class: 'qa-h', style: 'padding:0' }, pend.map(function (q) {
      return el('li', {}, [q.text, el('div', { class: 'acts' }, [chip('Approve', function () { cmd({ t: 'qaApprove', id: q.id }); }), chip('Hide', function () { cmd({ t: 'qaHide', id: q.id }); })])]);
    })));
    kids.push(el('h3', { text: 'Q&A live · ' + (S.qa || []).length + (S.qaHidden ? ' (' + S.qaHidden + ' hidden)' : '') }));
    kids.push(el('ul', { class: 'qa-h', style: 'padding:0' }, (S.qa || []).slice(0, 15).map(function (q) {
      return el('li', { style: q.done ? 'opacity:.5' : '' }, ['▲' + q.up + '  ' + q.text,
        el('div', { class: 'acts' }, [chip(q.done ? 'Undo answered' : 'Answered', function () { cmd({ t: 'qaDone', id: q.id }); }), chip('Hide', function () { cmd({ t: 'qaHide', id: q.id }); })])]);
    })));
    kids.push(el('p', {}, [chip(m.qaModerate ? 'Approval required: on' : 'Approval required: off', function () { cmd({ t: 'qaModerate', on: !m.qaModerate }); })]));
    kids.push(el('h3', { text: 'Outline' }));
    var lastSec = null, items = [];
    (S.deck || []).forEach(function (d, k) {
      if (d.section && d.section !== lastSec) { items.push(el('li', { class: 'sec', text: d.section })); lastSec = d.section; }
      items.push(el('li', { class: k === m.cur ? 'cur' : '' }, [el('button', { type: 'button', onclick: function () { cmd({ t: 'go', i: k }); } }, [el('span', { class: 'ty', text: d.type }), el('span', { text: (k + 1) + '. ' + d.prompt })])]));
    });
    kids.push(el('ul', { class: 'outline' }, items));
    var sc = side.scrollTop;
    side.replaceChildren.apply(side, kids);
    side.scrollTop = sc;
  }

  setInterval(function () {
    var n = document.getElementById('qtimer');
    if (!n || !S || !S.meta || !S.item) return;
    var l = secondsLeft(S.item); n.textContent = l ? l + 's' : 'time!';
  }, 250);
  window.addEventListener('resize', function () { lastStageKey = ''; cloudPos = {}; render(); });

  if (key) start(); else login();
})();
