/* Pack the Suitcase: the sort frame. The suitcase is the model's context window: a fixed number of tokens it can
   see in one chat. Pack what a question needs, keep what matters as the chat grows, and stop a huge paste from
   pushing the rules out. Sizes are illustrative. */
(function () {
  'use strict';
  var K = window.FTKit, el = K.el, L = window.FTGames['pack-the-suitcase'];
  var main = document.getElementById('main');
  var G = {
    logic: L, title: 'Pack the Suitcase', kicker: 'Fencing Token Arcade · Act 2',
    pitch: 'A chatbot can only see so much text at once: its context window. Pack it well, watch old messages fall out, and keep its rules from being pushed out.',
    meta: '3 rounds · about 2 minutes · no typing',
    howto: [
      { cls: 'ask', glyph: '1', text: 'Pack what the question needs into the window' },
      { cls: 'allow', glyph: '2', text: 'Pin what the model must not forget' },
      { cls: 'deny', glyph: '3', text: 'Stop a huge paste from pushing the rules out' },
    ],
    nextGame: { href: '/play/real-or-fake/', title: 'Real or Fake?' },
    shareText: function (s) { return 'I packed an AI’s memory and kept its rules safe: ' + s + ' points in Pack the Suitcase. Can you beat it?'; },
    next: [
      { href: '/concepts/?lens=everyone#prompt-injection', text: 'Prompt injection, explained three ways', sub: 'The planted text in round 3.' },
      { href: '/concepts/?lens=everyone#policy-engine', text: 'Rules that live outside the model', sub: 'Why rules in the prompt are not a lock.' },
    ],
  };
  var TYPE = { rules: 'Rules', q: 'Question', doc: 'File', notes: 'Notes', chat: 'Old chat', you: 'Student', ai: 'Bot' };
  var HEDGE = 'Sizes are illustrative. Real windows hold thousands to over a million tokens, and apps handle overflow differently: some cut the oldest text, some summarise it, some refuse.';
  var S;

  function start() {
    var b = main.querySelector('.btn'); if (b) { b.disabled = true; b.textContent = 'Starting…'; }
    K.startRun(L).then(function (run) {
      S = { run: run, d: L.deck(run.seed), moves: { p: [], c: [], h: [] }, pts: 0 };
      run.moves = S.moves;
      K.roundOverlay(main, L.data.rounds, 0, function () { pack(0); }, 'A model reads text in tokens: small chunks, often parts of words. Its window holds a fixed number of them. Pack what it needs to answer.');
    });
  }

  // ---------------------------------------------------------------- shared pieces
  function hud(round, sub) {
    return el('div', { class: 'hud' }, [
      el('div', {}, [el('p', { class: 'kicker', style: 'margin:0', text: round.name + ' · ' + round.title }), el('p', { class: 'small', style: 'margin:4px 0 0', text: sub })]),
      el('span', { class: 'score', 'aria-label': 'Score', text: K.fmt(Math.max(0, S.pts)) }),
    ]);
  }
  // segs: [{tok, type, label, cls}] in the window, oldest first; spill: [label] pushed out
  function suitcase(cap, segs, spill) {
    var used = segs.reduce(function (a, s) { return a + s.tok; }, 0);
    return el('div', { class: 'case' + (used >= cap * 0.9 ? ' full' : ''), role: 'img', 'aria-label': 'Context window: ' + used + ' of ' + cap + ' tokens used' }, [
      el('div', { class: 'track' }, segs.map(function (s) {
        return el('span', { class: 'seg t-' + s.type + (s.cls ? ' ' + s.cls : ''), style: 'flex-basis:' + (s.tok / cap * 100).toFixed(2) + '%', title: s.label, text: s.tok / cap > 0.11 ? s.label : '' });
      })),
      el('div', { class: 'caseinfo' }, [el('span', {}, [el('b', { text: K.fmt(used) }), ' / ' + K.fmt(cap) + ' tokens']), el('span', { text: K.fmt(cap - used) + ' free' })]),
      spill && spill.length ? el('div', { class: 'spill' }, [el('em', { text: 'Pushed out:' })].concat(spill.map(function (s) { return el('span', { text: s }); }))) : null,
    ]);
  }
  function short(t, n) { return t.length > n ? t.slice(0, n - 1) + '…' : t; }
  function typeOut(node, text) {
    var i = 0, step = Math.max(2, Math.ceil(text.length / 30));
    var iv = setInterval(function () { i += step; node.textContent = text.slice(0, i); if (i >= text.length) { clearInterval(iv); node.textContent = text; } }, 30);
  }
  function answerBox(name, text) {
    var body = el('p', { class: 'atext', text: '' });
    typeOut(body, text);
    return el('div', { class: 'answer', 'aria-live': 'polite', 'aria-label': name + ' answers: ' + text }, [el('p', { class: 'who', text: name + ' answers' }), body]);
  }
  function nextBtn(label, go) {
    var b = el('button', { class: 'btn', type: 'button', disabled: true, text: label, onclick: go });
    setTimeout(function () { b.disabled = false; b.focus(); }, 1100);
    return b;
  }
  function checks(lines) { return el('ul', { class: 'checks' }, lines.map(function (t) { return el('li', { class: t.charAt(0) === '✓' ? 'yes' : 'no', text: t }); })); }
  function sign(p) { return (p > 0 ? '+' : p < 0 ? '−' : '') + Math.abs(p); }
  function setScore() { var n = main.querySelector('.score'); if (n) n.textContent = K.fmt(Math.max(0, S.pts)); }
  function reveal(fb) { setTimeout(function () { fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 80); }

  // ---------------------------------------------------------------- round 1: pack for one question
  function pack(pi) {
    var P = S.d.packs[pi], p = P.p, order = [], t0 = Date.now(), sent = false;
    var lockedTok = p.locked.reduce(function (a, x) { return a + x.tok; }, 0);
    var caseBox = el('div', { class: 'casebox' }), list = el('div', { class: 'items', role: 'group', 'aria-label': 'Things you could pack' }), fb = el('div');
    var send = el('button', { class: 'btn', type: 'button', text: 'Send to the model', onclick: function () { if (!sent) answer(); } });
    function used() { return order.reduce(function (a, k) { return a + p.items[k].tok; }, lockedTok); }
    function toggle(k, card) {
      if (sent) return;
      var i = order.indexOf(k);
      if (i >= 0) order.splice(i, 1);
      else if (used() + p.items[k].tok > p.cap) {
        K.toast('Doesn’t fit: only ' + (p.cap - used()) + ' tokens free. Take something out.'); K.vibrate([10, 40, 10]);
        if (card) { card.classList.remove('shake'); void card.offsetWidth; card.classList.add('shake'); }
        return;
      } else { order.push(k); K.vibrate(10); }
      draw();
    }
    function draw() {
      caseBox.replaceChildren(suitcase(p.cap, p.locked.map(function (x) { return { tok: x.tok, type: x.type, label: TYPE[x.type] }; })
        .concat(order.map(function (k) { var x = p.items[k]; return { tok: x.tok, type: x.type, label: short(x.t, 18) }; }))));
      list.replaceChildren.apply(list, p.locked.map(function (x) {
        return el('div', { class: 'item locked' }, [el('span', { class: 'sw t-' + x.type, 'aria-hidden': 'true' }), el('span', { class: 'tx' }, [el('b', { text: TYPE[x.type] + ' · always packed' }), el('span', { text: x.t })]), el('span', { class: 'tok', text: String(x.tok) })]);
      }).concat(P.order.map(function (k) {
        var x = p.items[k], on = order.indexOf(k) >= 0;
        var card = el('button', { class: 'item' + (on ? ' on' : ''), type: 'button', 'data-k': String(k), 'aria-pressed': on ? 'true' : 'false', 'aria-label': (on ? 'Unpack ' : 'Pack ') + x.t + ', ' + x.tok + ' tokens', onclick: function () { toggle(k, card); } }, [
          el('span', { class: 'sw t-' + x.type, 'aria-hidden': 'true' }),
          el('span', { class: 'tx' }, [el('b', { text: x.t }), el('span', { text: TYPE[x.type] + ' · ' + x.sub })]),
          el('span', { class: 'tok', text: String(x.tok) }),
          el('span', { class: 'st', text: on ? '✓ In' : '+ Pack' }),
        ]);
        dragify(card, k);
        return card;
      })));
    }
    function inside(e) { var r = caseBox.getBoundingClientRect(); return e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom; }
    function dragify(card, k) { // optional: drag a card into the suitcase with a mouse; tap works everywhere
      var ghost = null, sx = 0, sy = 0;
      card.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse' || sent || order.indexOf(k) >= 0) return; sx = e.clientX; sy = e.clientY; card.setPointerCapture(e.pointerId); });
      card.addEventListener('pointermove', function (e) {
        if (!card.hasPointerCapture(e.pointerId)) return;
        if (!ghost && Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return;
        if (!ghost) { ghost = el('div', { class: 'item ghost', text: p.items[k].t }); document.body.appendChild(ghost); }
        ghost.style.left = (e.clientX - 130) + 'px'; ghost.style.top = (e.clientY - 24) + 'px';
        caseBox.classList.toggle('over', inside(e));
      });
      card.addEventListener('pointerup', function (e) {
        if (!ghost) return;
        ghost.remove(); ghost = null; caseBox.classList.remove('over');
        var stop = function (ev) { ev.stopImmediatePropagation(); card.removeEventListener('click', stop, true); };
        card.addEventListener('click', stop, true); // the drag already decided; swallow the click that follows
        if (inside(e)) toggle(k, card);
      });
      card.addEventListener('pointercancel', function () { if (ghost) { ghost.remove(); ghost = null; } caseBox.classList.remove('over'); });
    }
    function answer() {
      sent = true; send.remove();
      var ms = Math.max(L.MIN_MS, Date.now() - t0);
      S.moves.p.push([order.slice(), ms]);
      var s = L.scorePack(p, order, ms); S.pts += s.pts; setScore();
      list.querySelectorAll('button').forEach(function (b) { b.disabled = true; });
      var lines = Object.keys(p.facts).map(function (f) { return s.facts[f] ? '✓ The ' + p.facts[f].toLowerCase() + ' was in the window.' : '✗ No ' + p.facts[f].toLowerCase() + ' in the window, so it guessed.'; });
      order.filter(function (k) { return !p.items[k].f.length; }).forEach(function (k) { lines.push('✗ ' + p.items[k].t + ' wasted ' + p.items[k].tok + ' tokens (−50).'); });
      var last = pi === S.d.packs.length - 1;
      fb.replaceChildren(answerBox('The model', s.answer), el('div', { class: 'feedback' }, [
        el('p', { class: 'big', text: sign(s.pts) + ' · ' + (s.got === s.nf && !s.junk ? 'Packed perfectly.' : s.got === s.nf ? 'Right answer, some wasted space.' : 'It answered without the facts.') }),
        checks(lines),
        el('p', { text: p.lesson }),
        nextBtn(last ? 'Next round' : 'Next question', function () {
          if (last) return K.roundOverlay(main, L.data.rounds, 1, chat, 'Now the chat grows. When the window is full, the oldest messages fall out. You have 2 pins: pin what the model must still know at the end.');
          pack(pi + 1);
        }),
      ]));
      reveal(fb);
    }
    main.replaceChildren(el('section', { class: 'screen pts-screen' }, [
      hud(L.data.rounds[0], 'Question ' + (pi + 1) + ' of ' + S.d.packs.length),
      el('p', { class: 'askq' }, [el('span', { class: 'lbl2', text: 'The student asks' }), p.q]),
      caseBox,
      el('p', { class: 'small', style: 'margin:0 0 8px', text: 'Tap to pack or unpack. Junk wastes space.' }),
      list,
      el('div', { class: 'cta static' }, [send]),
      fb,
      el('p', { class: 'disclaimer', text: HEDGE }),
    ]));
    draw();
  }

  // ---------------------------------------------------------------- round 2: the chat keeps growing
  function chat() {
    var C = L.data.chat, N = C.msgs.length, s = 0, win = [], pinned = {}, falling = [], forgot = [], auto = null, lastAt = 0, over = false;
    var hudBox = el('div'), caseBox = el('div'), pinsInfo = el('p', { class: 'pinsinfo' }), forgotBox = el('div', { class: 'forgot' });
    var list = el('div', { class: 'chat' }), fb = el('div');
    var nextB = el('button', { class: 'btn ghost nextmsg', type: 'button', text: 'Next message ▸', onclick: function () { if (!over && Date.now() - lastAt >= 500) arrive(); } });
    function pinCount() { return Object.keys(pinned).length; }
    function windowItems() { return [{ tok: C.rules.tok, locked: true }].concat(win.map(function (m) { return { tok: C.msgs[m].tok, pinned: !!pinned[m] }; })); }
    function togglePin(m) {
      if (over || s < 1 || s >= N || win.indexOf(m) < 0) return;
      if (pinned[m]) { delete pinned[m]; S.moves.c.push([s, m, 0]); }
      else if (pinCount() >= C.pins) { K.toast('No pins left. Unpin one first.'); return; }
      else { pinned[m] = 1; S.moves.c.push([s, m, 1]); K.vibrate(10); }
      draw();
    }
    function arrive() {
      clearTimeout(auto); if (over) return;
      s++; lastAt = Date.now(); win.push(s - 1);
      var out = L.fit(windowItems(), C.cap).map(function (i) { return win[i - 1]; }); // same rule as the server
      out.forEach(function (m) { delete pinned[m]; });
      win = win.filter(function (m) { return out.indexOf(m) < 0; });
      forgot = forgot.concat(falling); falling = out; draw();
      var nb = list.lastChild; if (nb) nb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      if (out.length) { K.vibrate([10, 30, 10]); setTimeout(function () { if (falling === out) { forgot = forgot.concat(falling); falling = []; draw(); } }, 650); }
      nextB.disabled = true;
      if (s === N) { over = true; nextB.remove(); setTimeout(finishChat, 900); return; }
      setTimeout(function () { nextB.disabled = false; }, 500);
      auto = setTimeout(arrive, 2400);
    }
    function draw() {
      hudBox.replaceChildren(hud(L.data.rounds[1], 'Message ' + Math.max(1, s) + ' of ' + N));
      caseBox.replaceChildren(suitcase(C.cap, [{ tok: C.rules.tok, type: 'rules', label: 'Rules' }].concat(win.map(function (m) { var x = C.msgs[m]; return { tok: x.tok, type: x.who, label: short(x.t, 14), cls: pinned[m] ? 'pinned' : '' }; }))));
      pinsInfo.textContent = (C.pins - pinCount()) + ' of ' + C.pins + ' pins left · rules always kept';
      forgotBox.replaceChildren.apply(forgotBox, forgot.length ? [el('span', { class: 'fl', text: 'Forgotten:' })].concat(forgot.map(function (m) { return el('span', { class: 'gone', text: short(C.msgs[m].t, 26) }); })) : []);
      var nextOut = -1;
      if (!over && win.length > 3) for (var i = 0; i < win.length - 1; i++) if (!pinned[win[i]]) { nextOut = win[i]; break; }
      var shown = win.concat(falling).sort(function (a, b) { return a - b; });
      list.replaceChildren.apply(list, shown.map(function (m) {
        var x = C.msgs[m], fall = falling.indexOf(m) >= 0, pin = !!pinned[m];
        return el('div', { class: 'bub ' + x.who + (pin ? ' pinned' : '') + (fall ? ' falling' : '') + (m === nextOut ? ' nextout' : '') }, [
          el('span', { class: 'tx' }, [x.t, el('span', { class: 'meta', text: (x.who === 'you' ? 'You' : 'Bot') + ' · ' + x.tok + ' tokens' + (fall ? ' · fell out' : m === nextOut ? ' · falls out next' : pin ? ' · pinned' : '') })]),
          x.last || fall ? null : el('button', { class: 'pinb', type: 'button', 'aria-pressed': pin ? 'true' : 'false', 'aria-label': (pin ? 'Unpin: ' : 'Pin: ') + x.t, disabled: over, text: pin ? 'Pinned' : 'Pin', onclick: function () { togglePin(m); } }),
        ]);
      }));
    }
    function finishChat() {
      var r = L.simChat(S.moves.c);
      S.pts += r.valid ? r.pts : 0; draw();
      var lines = Object.keys(C.facts).map(function (f) { return r.facts[f] ? '✓ It still had ' + C.facts[f] + '.' : '✗ It forgot ' + C.facts[f] + '. That fell out of the window.'; });
      fb.replaceChildren(answerBox('Study buddy', r.answer), el('div', { class: 'feedback' }, [
        el('p', { class: 'big', text: sign(r.pts) + ' · ' + (r.got === 2 ? 'It remembered what mattered.' : r.got ? 'It half remembered.' : 'It forgot how the chat started.') }),
        checks(lines),
        el('p', { text: 'Long chats lose their start first. Many apps keep or summarise early messages; this one simply drops the oldest.' }),
        nextBtn('Next round', function () { K.roundOverlay(main, L.data.rounds, 2, paste, 'This app is naive: when the window is full, it drops the oldest text, even its own rules. A student is about to paste a long page. Protect the rules before the model answers.'); }),
      ]));
      reveal(fb);
    }
    main.replaceChildren(el('section', { class: 'screen pts-screen' }, [hudBox, el('div', { class: 'casebox' }, [caseBox, el('div', { class: 'pinrow' }, [pinsInfo, nextB])]), forgotBox, list, fb, el('p', { class: 'disclaimer', text: HEDGE })]));
    draw();
    nextB.disabled = true;
    auto = setTimeout(arrive, 700);
  }

  // ---------------------------------------------------------------- round 3: a huge paste in a naive app
  function paste() {
    var P = L.data.paste, pin = -1, cuts = [], t0 = Date.now(), sent = false;
    var hudBox = el('div'), caseBox = el('div', { class: 'casebox' }), list = el('div', { class: 'items' }), fb = el('div');
    var send = el('button', { class: 'btn', type: 'button', text: 'Let the model answer', onclick: function () { if (!sent) go(); } });
    function sorted() { return cuts.slice().sort(function (a, b) { return a - b; }); }
    function name(x) { return x.part ? 'Part ' + x.part : TYPE[x.type]; }
    function draw(after) {
      var r = L.simPaste(pin, sorted());
      hudBox.replaceChildren(hud(L.data.rounds[2], 'HostelHelp · ' + P.cap + '-token window · ' + P.pins + ' pin'));
      caseBox.replaceChildren(suitcase(P.cap, r.kept.map(function (k) { var x = P.items[k]; return { tok: x.tok, type: x.type, label: name(x), cls: k === pin ? 'pinned' : '' }; }), r.out.map(function (k) { return name(P.items[k]); })));
      var kids = [];
      P.items.forEach(function (x, k) {
        if (x.part === 1) kids.push(el('p', { class: 'grp', text: 'Pasted by the student: the hostel notice page' }));
        var cut = cuts.indexOf(k) >= 0, isOut = r.out.indexOf(k) >= 0, pinned = pin === k, ctl = null;
        var tag = cut ? 'Trimmed' : isOut ? (after ? 'Fell out' : 'Will fall out') : pinned ? 'Pinned' : x.last ? 'Newest' : '';
        if (x.pin) ctl = el('button', { class: 'pinb', type: 'button', disabled: sent, 'aria-pressed': pinned ? 'true' : 'false', 'aria-label': (pinned ? 'Unpin: ' : 'Pin: ') + x.t, text: pinned ? 'Pinned' : 'Pin', onclick: function () {
          if (pin === k) pin = -1; else if (pin >= 0) { K.toast('Only 1 pin here. Unpin the other one first.'); return; } else pin = k;
          draw();
        } });
        if (x.part) ctl = el('button', { class: 'pinb trim', type: 'button', disabled: sent, 'aria-pressed': cut ? 'true' : 'false', 'aria-label': (cut ? 'Put back: ' : 'Trim: ') + x.t, text: cut ? 'Undo' : '✂ Trim', onclick: function () {
          var i = cuts.indexOf(k); if (i >= 0) cuts.splice(i, 1); else cuts.push(k);
          draw();
        } });
        kids.push(el('div', { class: 'item row3' + (cut ? ' cut' : '') + (isOut ? ' out' + (after ? ' falling' : '') : '') + (pinned ? ' pinnedc' : '') + (after && x.inj ? ' reveal' : '') }, [
          el('span', { class: 'sw t-' + x.type, 'aria-hidden': 'true' }),
          el('span', { class: 'tx' }, [el('b', { text: name(x) + ' · ' + x.tok + ' tokens' + (tag ? ' · ' + tag : '') }), el('span', { text: x.t })]),
          ctl,
        ]));
      });
      list.replaceChildren.apply(list, kids);
      return r;
    }
    function go() {
      sent = true; send.remove();
      var ms = Math.max(L.MIN_MS, Date.now() - t0);
      S.moves.h.push(pin, sorted(), ms);
      var r = draw(true); S.pts += r.pts; setScore();
      if (r.out.length) K.vibrate([10, 30, 10]);
      var lines = [
        r.rulesIn ? '✓ The rules stayed in the window.' : '✗ The rules fell out. The model no longer knew its limits.',
        r.injIn ? '✗ The planted order in part 4 got in. On the page it was hidden text.' : '✓ The planted order in part 4 never reached the model.',
        r.right ? '✓ It answered the real question.' : r.needIn ? '✗ It followed the planted order instead of answering.' : '✗ Friday’s menu was not in the window.',
      ];
      var title = r.pts === 650 ? 'Rules safe, trap trimmed.' : r.hijacked ? 'Hijacked.' : r.rulesIn && r.injIn ? 'It resisted, this time.' : !r.rulesIn ? 'It answered, but without its rules.' : 'Safe, but no answer.';
      fb.replaceChildren(answerBox('HostelHelp', r.answer), el('div', { class: 'feedback' }, [
        el('p', { class: 'big', text: sign(r.pts) + ' · ' + title }),
        checks(lines),
        el('p', { text: r.rulesIn && r.injIn ? 'Rules in the window help, but they are not a lock. A model can still follow planted text, so trim what you don’t trust.' : 'Keep the rules fixed and limit pasted text. Even then, rules in a prompt are not a lock: real safety needs checks outside the model.' }),
        nextBtn('See your score', finish),
      ]));
      reveal(fb);
    }
    main.replaceChildren(el('section', { class: 'screen pts-screen' }, [
      hudBox,
      el('p', { class: 'small', style: 'margin:0', text: 'The paste is 700 tokens. Pin the rules, or trim parts you don’t need or trust. Watch what will fall out.' }),
      caseBox, list, el('div', { class: 'cta static' }, [send]), fb, el('p', { class: 'disclaimer', text: HEDGE }),
    ]));
    draw();
  }

  function finish() {
    var res = L.replay(S.run.seed, S.moves), d = res.detail, remember = [];
    if (d.packsRight < 2) remember.push(['Missing facts get guessed.', 'If it isn’t in the window, the model can’t see it, and it may make something up.']);
    if (d.junk) remember.push(['Junk costs space.', 'You packed ' + d.junk + ' item' + (d.junk > 1 ? 's' : '') + ' the question didn’t need.']);
    if (d.chatFacts < 2) remember.push(['Old messages fall out.', 'In a long chat the start goes first. Repeat what matters, or use an app that keeps it.']);
    if (!d.rulesIn || d.injIn) remember.push(['A huge paste is a risk.', 'In a naive app it can push the rules out, and it may carry planted orders.']);
    remember.push(['The window is the model’s whole world for this chat.', 'Everything it knows about you right now has to fit inside it.']);
    remember.push(['Real apps differ.', HEDGE]);
    K.results(main, G, S.run, res, {
      title: res.score >= L.stars[2] ? 'Packed like a pro.' : res.score >= L.stars[1] ? 'Mostly fits.' : 'Something fell out.',
      stats: [[d.packsRight + '/2', 'questions answered'], [d.chatFacts + '/2', 'early facts kept'], [d.rulesIn && !d.injIn ? 'Yes' : 'No', 'rules protected']],
      remember: remember, onAgain: start,
    });
  }

  K.intro(main, G, start);
})();
