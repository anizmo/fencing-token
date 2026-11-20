/* Fencing Token Live: the participant's phone. */
(function () {
  'use strict';
  var F = window.FTL, el = F.el;
  var main = document.getElementById('main'), dot = document.getElementById('dot'), codeEl = document.getElementById('code');
  var banner = document.getElementById('banner'), tabs = document.getElementById('tabs');
  var room = (F.params.get('c') || F.store('ftlive-room') || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  var voter = F.voterId();
  var name = F.store('ftlive-name') || '';
  var live = null, state = null, qa = { list: [], open: true }, tab = 'live', myUp = {}, timerId = null, pending = null;
  try { myUp = JSON.parse(F.store('ftlive-up') || '{}'); } catch (e) { myUp = {}; }

  function setBanner(t) { banner.hidden = !t; banner.textContent = t || ''; }

  // ---------------------------------------------------------------- join
  function showJoin(err) {
    tabs.hidden = true;
    main.replaceChildren(el('form', { class: 'join', onsubmit: function (e) {
      e.preventDefault();
      var c = document.getElementById('jc').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      var n = document.getElementById('jn').value.trim().slice(0, 24);
      if (c.length < 3) { document.getElementById('jc').focus(); return; }
      room = c; name = n; F.store('ftlive-room', c); F.store('ftlive-name', n);
      history.replaceState(null, '', '?c=' + encodeURIComponent(c));
      start();
    } }, [
      el('p', { class: 'kicker', text: 'Fencing Token Live' }),
      el('h1', { text: 'Join the session' }),
      el('p', { class: 'muted', text: 'Enter the code shown on the speaker’s screen.' }),
      err ? el('p', { class: 'note bad', text: err }) : null,
      el('label', { for: 'jc', text: 'Session code' }),
      el('input', { id: 'jc', class: 'field code-in', autocomplete: 'off', autocapitalize: 'characters', maxlength: 16, required: true, value: room || F.cfg.defaultRoom || '', inputmode: 'text' }),
      el('label', { for: 'jn', text: 'Your name for the quiz leaderboard (optional)' }),
      el('input', { id: 'jn', class: 'field', maxlength: 24, autocomplete: 'nickname', value: name, placeholder: 'e.g. Priya from Pune' }),
      el('div', { class: 'row' }, [el('button', { class: 'btn', type: 'submit', text: 'Join' })]),
      el('p', { class: 'small muted', text: 'No sign-up. Answers are anonymous; a name only appears on the quiz leaderboard. Everything is deleted within 24 hours.' }),
    ]));
  }

  // ---------------------------------------------------------------- connection
  function start() {
    codeEl.textContent = room;
    tabs.hidden = false;
    main.replaceChildren(el('div', { class: 'wait' }, [el('div', { class: 'pulse' }), el('p', { class: 'big', text: 'Connecting…' })]));
    live = new F.Live(room, 'aud', onMessage, function (s) {
      dot.className = 'dot ' + (s === 'open' ? 'on' : s === 'connecting' ? '' : 'off');
      if (s === 'config') setBanner('This page is not connected to a live server yet.');
      else if (s === 'reconnecting') setBanner('Reconnecting… your answers are safe.');
      else if (s === 'open') setBanner('');
    });
    live.onOpen = function () { live.send({ t: 'hello', voter: voter, name: name }); if (pending) { live.send(pending); } };
  }

  function onMessage(m) {
    if (m.t === 'state') { state = m; if (m.qaOpen !== undefined) qa.open = m.qaOpen; render(); }
    else if (m.t === 'ack') { if (state && state.i === m.i) { state.mine = m.v; state.locked = !!m.locked; pending = null; render(); } }
    else if (m.t === 'qa') { var was = qa.open; qa.list = m.list || []; qa.open = !!m.open; if (tab === 'qa') { if (was !== qa.open || !document.getElementById('qalist')) render(); else updateQAList(); } }
    else if (m.t === 'asked') { toast(m.moderated ? 'Question sent. It appears once the speaker approves it.' : 'Question sent. Others can now upvote it.'); }
    else if (m.t === 'rejected') { toast('That answer can’t be accepted. Please rephrase.'); }
    else if (m.t === 'slow') { toast('Slow down a little, please.'); }
    else if (m.t === 'closed') { pending = null; toast('Voting is closed for this one.'); live.send({ t: 'hello', voter: voter, name: name }); }
    else if (m.t === 'named') { name = m.name; F.store('ftlive-name', name); render(); }
  }

  var toastT = null;
  function toast(t) {
    var n = document.getElementById('toast');
    n.textContent = t; n.hidden = false; clearTimeout(toastT);
    toastT = setTimeout(function () { n.hidden = true; }, 2600);
  }

  function answer(v) {
    var msg = { t: 'answer', i: state.i, v: v };
    pending = msg; live.send(msg);
  }

  // ---------------------------------------------------------------- render
  function render() {
    clearInterval(timerId);
    Array.prototype.forEach.call(tabs.querySelectorAll('button'), function (b) { b.setAttribute('aria-selected', b.dataset.tab === tab ? 'true' : 'false'); });
    if (tab === 'qa') return renderQA();
    if (!state) return;
    if (!state.live) {
      return main.replaceChildren(el('div', { class: 'wait' }, [el('div', { class: 'pulse' }),
        el('p', { class: 'big', text: 'Waiting for the session to start' }),
        el('p', { class: 'muted', text: 'Code ' + room + '. Keep this tab open.' }),
        el('p', {}, [el('button', { class: 'btn btn-ghost', text: 'Use a different code', onclick: function () { F.store('ftlive-room', ''); room = ''; showJoin(); } })])]));
    }
    var it = state.item, kids = [];
    if (!it) return;
    if (it.section) kids.push(el('p', { class: 'kicker', text: it.section }));
    if (it.type === 'title' || it.type === 'qa') {
      kids.push(el('div', { class: 'wait' }, [el('div', { class: 'pulse' }), el('p', { class: 'big', text: it.type === 'qa' ? 'Questions time' : 'You’re in' }),
        el('p', { class: 'muted', text: it.type === 'qa' ? 'Ask or upvote in the Q&A tab below.' : 'Look at the speaker’s screen. Questions appear here automatically.' })]));
      if (!name) kids.push(nameBox());
      return main.replaceChildren.apply(main, kids.filter(Boolean));
    }
    kids.push(el('h1', { class: 'prompt', text: it.prompt }));
    if (it.sub) kids.push(el('p', { class: 'sub', text: it.sub }));
    var open = state.status === 'open';
    if (['poll', 'scale', 'quiz'].includes(it.type)) kids = kids.concat(single(it, open));
    else if (it.type === 'multi') kids = kids.concat(multi(it, open));
    else if (it.type === 'cloud') kids = kids.concat(cloud(it, open));
    else if (it.type === 'wall') kids = kids.concat(wall(it, open));
    else if (it.type === 'leaderboard') kids = kids.concat(board());
    main.replaceChildren.apply(main, kids.filter(Boolean));
  }

  function statusNote(open, answered, extra) {
    if (state.status === 'revealed') return null;
    if (!open) return el('p', { class: 'note', text: answered ? 'Voting is closed. Your answer is in.' : 'Voting is closed for this question.' });
    if (answered) return el('p', { class: 'note ok', text: extra || 'Got it. You can change your answer until voting closes.' });
    return null;
  }

  function bars(it, res, answerIdx) {
    if (!res || !res.counts) return null;
    var total = res.counts.reduce(function (a, b) { return a + b; }, 0) || 1;
    return el('div', { class: 'bars', 'aria-label': 'Results' }, it.options.map(function (o, k) {
      var pct = Math.round(100 * res.counts[k] / total);
      return el('div', { class: 'bar' + (answerIdx === k ? ' correct' : '') }, [el('i', { style: 'width:' + pct + '%' }), el('span', {}, [o, el('b', { text: pct + '%' })])]);
    }));
  }

  function single(it, open) {
    var out = [], mine = state.mine, revealed = state.status === 'revealed', quiz = it.type === 'quiz';
    if (quiz && open && it.left !== undefined) {
      var end = Date.now() + it.left, bar = el('i');
      out.push(el('div', { class: 'timer', role: 'progressbar', 'aria-label': 'Time left' }, [bar]));
      var tick = function () { var l = Math.max(0, end - Date.now()); bar.style.width = (100 * l / (it.seconds * 1000)) + '%'; if (!l) { clearInterval(timerId); Array.prototype.forEach.call(main.querySelectorAll('.opt'), function (b) { b.disabled = true; }); } };
      tick(); timerId = setInterval(tick, 250);
    }
    var locked = quiz && mine !== null && mine !== undefined;
    out.push(el('div', { class: 'opts', role: 'group', 'aria-label': 'Options' }, it.options.map(function (o, k) {
      var cls = 'opt';
      if (revealed && it.answer !== undefined) { if (k === it.answer) cls += ' correct'; else if (k === mine) cls += ' wrong'; }
      return el('button', { class: cls, type: 'button', 'aria-pressed': mine === k ? 'true' : 'false', disabled: !open || locked, onclick: function () { answer(k); state.mine = k; render(); } },
        [el('span', { class: 'k', text: it.type === 'scale' ? String(k + 1) : F.letters[k] }), el('span', { text: o })]);
    })));
    var answered = mine !== null && mine !== undefined;
    out.push(statusNote(open, answered, quiz ? 'Locked in. Watch the screen for the answer.' : null));
    if (quiz && revealed) {
      var ok = mine === it.answer;
      out.push(el('div', { class: 'score' }, [
        el('p', { class: 'big', text: !answered ? 'No answer this time' : ok ? 'Correct!' : 'Not this time' }),
        state.last !== null && state.last !== undefined ? el('p', { class: 'pts', text: '+' + state.last }) : null,
        state.score !== undefined ? el('p', { class: 'muted', text: 'Total ' + state.score + ' points' + (state.rank ? ' · rank ' + state.rank : '') }) : null,
      ]));
    }
    if (state.results && (!quiz || revealed)) out.push(bars(it, state.results, revealed ? it.answer : undefined));
    if (quiz && !name) out.push(nameBox());
    return out;
  }

  function multi(it, open) {
    var sel = Array.isArray(state.mine) ? state.mine.slice() : [];
    var boxes = it.options.map(function (o, k) {
      return el('button', { class: 'opt', type: 'button', 'aria-pressed': sel.indexOf(k) >= 0 ? 'true' : 'false', disabled: !open, onclick: function (e) {
        var b = e.currentTarget, on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
      } }, [el('span', { class: 'k', text: '✓' }), el('span', { text: o })]);
    });
    var out = [el('p', { class: 'small muted', text: 'Pick all that apply, then press Send.' }), el('div', { class: 'opts' }, boxes)];
    if (open) out.push(el('div', { class: 'row' }, [el('button', { class: 'btn', type: 'button', text: sel.length ? 'Update' : 'Send', onclick: function () {
      var v = []; boxes.forEach(function (b, k) { if (b.getAttribute('aria-pressed') === 'true') v.push(k); });
      if (!v.length) return toast('Pick at least one.');
      answer(v); state.mine = v; render();
    } })]));
    out.push(statusNote(open, sel.length > 0));
    if (state.results) out.push(bars(it, state.results));
    return out;
  }

  function cloud(it, open) {
    var mine = state.mine, out = [];
    if (mine && mine.length) {
      out.push(el('p', { class: 'note ok' }, ['Sent: ', el('b', { text: mine.join(', ') }), '. Watch it appear on the screen.']));
    } else if (open) {
      var inputs = [];
      for (var k = 0; k < (it.entries || 1); k++) inputs.push(el('input', { class: 'field', maxlength: 30, autocomplete: 'off', 'aria-label': 'Word ' + (k + 1), placeholder: it.words > 1 ? 'Up to ' + it.words + ' words' : 'One word', style: 'margin-top:10px' }));
      out.push(el('form', { onsubmit: function (e) {
        e.preventDefault();
        var v = inputs.map(function (i) { return i.value.trim(); }).filter(Boolean);
        if (!v.length) return inputs[0].focus();
        answer(v); state.mine = v; render();
      } }, inputs.concat([el('div', { class: 'row' }, [el('button', { class: 'btn', type: 'submit', text: 'Send' })])])));
    } else out.push(statusNote(false, false));
    if (state.results && state.results.words) {
      out.push(el('div', { class: 'bars' }, state.results.words.slice(0, 8).map(function (w) {
        return el('div', { class: 'bar' }, [el('span', {}, [w[0], el('b', { text: String(w[1]) })])]);
      })));
    }
    return out;
  }

  function wall(it, open) {
    var mine = state.mine, out = [];
    var ta = el('textarea', { class: 'field', maxlength: it.max || 200, placeholder: 'Type your answer…', 'aria-label': 'Your answer' });
    if (typeof mine === 'string') ta.value = mine;
    var cnt = el('span', { class: 'count', text: (ta.value.length) + '/' + (it.max || 200) });
    ta.addEventListener('input', function () { cnt.textContent = ta.value.length + '/' + (it.max || 200); });
    if (open) {
      out.push(el('form', { onsubmit: function (e) {
        e.preventDefault(); var v = ta.value.trim(); if (!v) return ta.focus();
        answer(v); state.mine = v; render();
      } }, [ta, el('div', { class: 'row' }, [el('button', { class: 'btn', type: 'submit', text: typeof mine === 'string' ? 'Update' : 'Send' }), cnt])]));
      if (typeof mine === 'string') out.push(el('p', { class: 'note ok', text: 'Got it. Answers stay hidden until the speaker reveals them, so nobody copies the first answer.' }));
      else out.push(el('p', { class: 'small muted', text: 'Answers stay hidden until the speaker reveals them.' }));
    } else {
      if (typeof mine === 'string') out.push(el('p', { class: 'note' }, ['Your answer: ', el('b', { text: mine })]));
      out.push(el('p', { class: 'note', text: state.status === 'revealed' ? 'Answers are on the speaker’s screen now.' : 'Answers are closed. Watch the screen.' }));
    }
    return out;
  }

  function board() {
    var top = (state.results && state.results.top) || [];
    var out = [el('ol', { class: 'lb' }, top.map(function (r) { return el('li', {}, [el('span', { class: 'r', text: '#' + r.r }), el('span', { class: 'n', text: r.n }), el('span', { class: 's', text: String(r.s) })]); }))];
    if (state.score !== undefined) out.push(el('div', { class: 'score' }, [el('p', { class: 'pts', text: state.score + ' pts' }), el('p', { class: 'muted', text: 'Your rank: ' + (state.rank || '–') })]));
    else out.push(el('p', { class: 'note', text: 'Answer the quiz questions to get on the board.' }));
    return out;
  }

  function nameBox() {
    var inp = el('input', { class: 'field', maxlength: 24, placeholder: 'Your name for the leaderboard', 'aria-label': 'Your name for the leaderboard' });
    return el('form', { class: 'note', onsubmit: function (e) { e.preventDefault(); var n = inp.value.trim(); if (!n) return; live.send({ t: 'name', name: n }); } },
      [el('p', { class: 'small', text: 'Want your name on the quiz leaderboard? (optional)' }), inp, el('div', { class: 'row' }, [el('button', { class: 'btn btn-ghost', type: 'submit', text: 'Save name' })])]);
  }

  function renderQA() {
    var kids = [el('p', { class: 'kicker', text: 'Questions for the speaker' })];
    if (qa.open) {
      var ta = el('textarea', { class: 'field', maxlength: 280, placeholder: 'Ask a question…', 'aria-label': 'Your question', style: 'min-height:90px' });
      kids.push(el('form', { onsubmit: function (e) { e.preventDefault(); var t = ta.value.trim(); if (!t) return ta.focus(); live.send({ t: 'ask', text: t }); ta.value = ''; } },
        [ta, el('div', { class: 'row' }, [el('button', { class: 'btn', type: 'submit', text: 'Ask' }), el('span', { class: 'count', text: 'Upvote the questions you want answered' })])]));
    } else kids.push(el('p', { class: 'note', text: 'Questions are closed right now.' }));
    kids.push(el('div', { id: 'qalist' }));
    main.replaceChildren.apply(main, kids.filter(Boolean));
    updateQAList();
  }

  function updateQAList() {
    var box = document.getElementById('qalist');
    if (!box) return;
    if (!qa.list.length) return box.replaceChildren(el('p', { class: 'muted small', text: 'No questions yet. Be the first.' }));
    box.replaceChildren(el('ul', { class: 'qa-list' }, qa.list.map(function (x) {
      var on = !!myUp[x.id];
      return el('li', { class: x.done ? 'done' : '' }, [
        el('button', { class: 'up', type: 'button', 'aria-pressed': on ? 'true' : 'false', 'aria-label': 'Upvote', onclick: function () {
          live.send({ t: 'upvote', id: x.id }); myUp[x.id] = !on; x.up += on ? -1 : 1; F.store('ftlive-up', JSON.stringify(myUp)); updateQAList();
        } }, ['▲ ' + x.up]),
        el('span', { class: 'q' }, [x.text, x.done ? el('span', { class: 'by', text: 'answered' }) : null]),
      ]);
    })));
  }

  tabs.addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; tab = b.dataset.tab; render(); });

  if (room && F.params.get('c')) { F.store('ftlive-room', room); start(); } else showJoin();
})();
