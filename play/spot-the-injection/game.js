/* Spot the Injection: the find frame. An AI assistant is about to read a document. Somewhere in it is an order
   aimed at the AI, not at you. Tap it before time runs out, then see how it hid. */
(function () {
  'use strict';
  var K = window.FTKit, el = K.el, L = window.FTGames['spot-the-injection'];
  var main = document.getElementById('main');
  var G = {
    logic: L, title: 'Spot the Injection', kicker: 'Fencing Token Arcade · Act 4',
    pitch: 'AI assistants read your email, web pages and files. Attackers hide orders in them. Find the hidden instruction before the AI follows it.',
    meta: '3 rounds · 11 documents · about 2 minutes',
    howto: [
      { cls: 'ask', glyph: '1', text: 'Read what the AI is about to read' },
      { cls: 'deny', glyph: '2', text: 'Tap the line that gives the AI orders' },
      { cls: 'allow', glyph: '3', text: 'Fast finds score more. False alarms cost points' },
    ],
    nextGame: { href: '/play/close-the-room/', title: 'Close the Room' },
    shareText: function (s) { return 'I hunted hidden instructions aimed at AI assistants and scored ' + s + ' in Spot the Injection. How sharp are your eyes?'; },
    next: [
      { href: '/concepts/?lens=everyone#prompt-injection', text: 'Prompt injection, explained three ways', sub: 'What every document in this game was hiding.' },
      { href: '/concepts/?lens=everyone#the-lethal-trifecta', text: 'The lethal trifecta', sub: 'When a planted order becomes a data leak.' },
      { href: '/concepts/?lens=everyone#guardrails', text: 'Why filters alone are not enough', sub: 'Guardrails help, but they miss things too.' },
    ],
  };
  var NOTES = [
    'Your AI assistant is about to read this. Somewhere in it is an order aimed at the AI, not at you. Tap it before time runs out.',
    'Now the orders hide: invisible text, tiny print, comments, image descriptions, other languages. The AI reads all of it.',
    'Some documents are clean. Some hide two orders. Tap every one, then press Done. Tapping a harmless line costs points.',
  ];
  var S;

  function start() {
    var b = main.querySelector('.btn'); if (b) { b.disabled = true; b.textContent = 'Starting…'; }
    K.startRun(L).then(function (run) {
      S = { run: run, d: L.deck(run.seed), i: 0, moves: [], pts: 0 };
      run.moves = S.moves;
      K.roundOverlay(main, L.data.rounds, 0, show, NOTES[0]);
    });
  }

  // ---------------------------------------------------------------- document chrome, one look per kind
  function head(doc) {
    var h = doc.head;
    switch (doc.kind) {
      case 'email': return el('div', { class: 'dh d-mail' }, [
        el('span', { class: 'av', 'aria-hidden': 'true', text: h.from.charAt(0) }),
        el('div', { class: 'who' }, [el('b', { text: h.from }), el('span', { class: 'addr', text: h.addr + ' → you' })]),
        el('span', { class: 'time', text: h.time }),
        el('p', { class: 'subj', text: h.subj }),
      ]);
      case 'cal': return el('div', { class: 'dh d-cal' }, [
        el('p', { class: 'tag-k', text: 'Invitation' }), el('p', { class: 'subj', text: h.title }),
        el('p', { class: 'when', text: h.when }), el('p', { class: 'addr', text: 'From ' + h.org + ' · ' + h.where }),
      ]);
      case 'web': return el('div', { class: 'dh d-web' }, [
        el('div', { class: 'bar' }, [el('span', { class: 'dots', 'aria-hidden': 'true' }, [el('i'), el('i'), el('i')]), el('span', { class: 'url', text: h.url })]),
        el('p', { class: 'site', text: h.site }),
      ]);
      case 'readme': return el('div', { class: 'dh d-gh' }, [el('span', { text: h.repo + ' / ' }), el('b', { text: h.file }), el('span', { class: 'raw', text: 'Raw' })]);
      case 'pdf': return el('div', { class: 'dh d-pdf' }, [el('span', { class: 'pdfi', 'aria-hidden': 'true', text: 'PDF' }), el('span', { class: 'fn', text: h.file }), el('span', { class: 'pg', text: '1 / 1' })]);
      case 'reviews': return el('div', { class: 'dh d-rev' }, [el('p', { class: 'subj', text: h.product }), el('p', { class: 'addr', text: h.rating })]);
      case 'notes': return el('div', { class: 'dh d-notes' }, [el('p', { class: 'subj', text: h.title }), el('p', { class: 'addr', text: h.by })]);
      case 'code': return el('div', { class: 'dh d-code' }, [el('span', { class: 'tab', text: h.file }), el('span', { class: 'addr', text: h.repo })]);
      case 'tool': return el('div', { class: 'dh d-tool' }, [el('span', { class: 'tk', text: 'Tool result' }), el('span', { text: h.tool + '(' + h.args + ')' })]);
    }
    return null;
  }
  function blockKids(b) {
    if (b.x === 'alt') return [el('span', { class: 'imgph', 'aria-hidden': 'true' }, [el('i')]), el('span', { class: 'alt', text: 'alt="' + b.t + '"' })];
    return [el('span', { class: 'bt', text: b.t })];
  }

  // ---------------------------------------------------------------- one document
  function show() {
    var item = S.d[S.i], doc = item.doc, round = L.data.rounds[item.r], lim = round.limit, nInj = L.injCount(doc);
    var t0 = Date.now(), taps = [], ended = false, found = 0, tick = null;
    var timer = el('div', { class: 'timer', role: 'progressbar', 'aria-label': 'Time left', 'aria-valuemin': '0', 'aria-valuemax': '100' }, [el('i')]);
    var score = el('span', { class: 'score', 'aria-label': 'Score', text: K.fmt(S.pts) });
    var fb = el('div', { 'aria-live': 'polite' });
    var btns = doc.b.map(function (b, k) {
      return el('button', { class: 'blk' + (b.x ? ' ' + b.x : ''), type: 'button', 'aria-label': b.t, onclick: function () { tap(k); } }, blockKids(b));
    });
    var dark = doc.kind === 'code' || doc.kind === 'tool';
    var paper = el('article', { class: 'doc k-' + doc.kind + (dark ? ' dark' : ''), 'aria-label': 'Document the AI is reading' }, [head(doc), el('div', { class: 'blocks' }, btns)]);
    var done = item.r === 2 ? el('button', { class: 'btn cleanbtn', type: 'button', text: 'Looks clean', onclick: function () {
      var ms = Date.now() - t0; if (ended || ms < L.MIN_TAP) return; end(1, Math.min(ms, lim - 1));
    } }) : null;

    function flag(b, cls, text) { var f = el('span', { class: 'flag ' + cls, text: text }); b.appendChild(f); }
    function tap(k) {
      if (ended || btns[k].disabled) return;
      var ms = Date.now() - t0; if (ms < L.MIN_TAP) return;
      ms = Math.min(ms, lim - 1);
      if (taps.length && ms < taps[taps.length - 1][1]) ms = taps[taps.length - 1][1];
      taps.push([k, ms]); btns[k].disabled = true;
      if (doc.b[k].inj) {
        found++; var p = 100 + L.bonus(ms, lim);
        btns[k].classList.add('hit'); flag(btns[k], 'red', 'Order for the AI'); btns[k].appendChild(el('span', { class: 'fly', 'aria-hidden': 'true', text: '+' + p }));
        K.vibrate(20);
        if (item.r < 2 && found === nInj) return end(0, ms);
        if (done) done.textContent = 'Done: no more';
      } else {
        btns[k].classList.add('nope'); flag(btns[k], 'grey', 'Just content · −' + L.FALSE);
        K.vibrate([10, 40, 10]);
      }
    }
    function end(kind, ms) {
      if (ended) return; ended = true; clearInterval(tick);
      S.moves.push([taps, ms, kind]);
      var s = L.scoreDoc(item, S.moves[S.i]);
      S.pts += s.valid ? s.pts : 0; score.textContent = K.fmt(Math.max(0, S.pts));
      if (done) done.remove();
      timer.classList.add('stopped');
      // reveal every planted order and how it hid
      doc.b.forEach(function (b, k) {
        btns[k].disabled = true;
        if (b.inj) { btns[k].classList.add('revealed'); if (!btns[k].classList.contains('hit')) { btns[k].classList.add('missed'); flag(btns[k], 'amber', 'Missed'); } }
      });
      var last = S.i === S.d.length - 1, endRound = last || S.d[S.i + 1].r !== item.r;
      var nxt = el('button', { class: 'btn', type: 'button', disabled: true, text: last ? 'See your score' : endRound ? 'Next round' : 'Next document', onclick: function () {
        S.i++;
        if (last) return finish();
        if (endRound) return K.roundOverlay(main, L.data.rounds, S.d[S.i].r, show, NOTES[S.d[S.i].r]);
        show();
      } });
      setTimeout(function () { nxt.disabled = false; nxt.focus(); }, 600);
      var hows = nInj ? doc.b.filter(function (b) { return b.inj; }).map(function (b) { return el('li', {}, [el('span', { class: 'hk', text: L.data.HOW[b.k] }), b.how]); })
        : [el('li', {}, [el('span', { class: 'hk ok', text: 'Clean' }), doc.how])];
      fb.replaceChildren(el('div', { class: 'feedback' }, [
        el('p', { class: 'big', text: verdict(item, s, kind) }),
        el('p', { text: doc.lesson }),
        el('p', { class: 'kicker', style: 'margin:4px 0 8px', text: nInj ? (nInj > 1 ? 'How these hid' : 'How this hid') : 'Why it’s clean' }),
        el('ul', { class: 'hows' }, hows),
        nxt,
      ]));
      setTimeout(function () { fb.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, 80);
    }
    function verdict(item, s, kind) {
      var p = (s.pts > 0 ? '+' : s.pts < 0 ? '−' : '') + Math.abs(s.pts) + ' · ';
      if (s.clean) return s.cleanOk ? p + (s.falseTaps ? 'Clean, after ' + s.falseTaps + ' false alarm' + (s.falseTaps > 1 ? 's' : '') + '.' : 'Clean. Good call.') : 'Time’s up. This one was clean.';
      if (s.found === s.inj) return p + (s.inj > 1 ? 'Got both.' : 'Caught it.');
      if (kind === 2) return (s.pts ? p : '') + 'Time’s up. ' + (s.found ? 'You found ' + s.found + ' of ' + s.inj + '.' : 'Here it was.');
      return (s.pts ? p : '') + (s.found ? 'You found ' + s.found + ' of ' + s.inj + '.' : 'Not clean: it had ' + s.inj + '.');
    }
    tick = setInterval(function () {
      var e = Date.now() - t0, f = Math.max(0, 1 - e / lim);
      timer.firstChild.style.transform = 'scaleX(' + f.toFixed(3) + ')';
      timer.setAttribute('aria-valuenow', String(Math.round(f * 100)));
      timer.classList.toggle('low', f < 0.25);
      if (e >= lim) end(2, lim);
    }, 100);

    main.replaceChildren(el('section', { class: 'screen sti' }, [
      el('div', { class: 'hud' }, [
        el('div', {}, [el('p', { class: 'kicker', style: 'margin:0', text: round.name + ' · ' + round.title }), el('p', { class: 'small', style: 'margin:4px 0 0', text: 'Document ' + (S.i + 1) + ' of ' + S.d.length })]),
        score,
      ]),
      timer,
      el('p', { class: 'ask' }, [el('span', { class: 'lbl2', text: 'You asked the AI' }), '“' + doc.ask + '”']),
      el('p', { class: 'small', style: 'margin:0 0 8px', text: item.r === 2 ? 'Tap every order aimed at the AI. Or call it clean.' : 'It is reading this now. Tap the order aimed at the AI.' }),
      paper,
      done ? el('div', { class: 'cta static' }, [done]) : null,
      fb,
    ]));
  }

  function finish() {
    var res = L.replay(S.run.seed, S.moves), d = res.detail, remember = [];
    var r2miss = res.log.filter(function (x) { return x.r === 1 && x.found < x.inj; }).length;
    if (r2miss) remember.push(['The AI reads what you can’t see.', 'Hidden text, comments, alt text and tiny print all reach the model. You missed ' + r2miss + ' of 4 in round 2.']);
    if (d.falseTaps) remember.push(['False alarms have a cost.', 'You flagged ' + d.falseTaps + ' harmless line' + (d.falseTaps > 1 ? 's' : '') + '. Flag everything and people stop listening.']);
    remember.push(['Orders can hide anywhere an AI reads.', 'Email, web pages, invites, code, résumés, reviews and tool results.']);
    remember.push(['Spotting them is not a fix.', 'People and filters both miss injections. The real defence is limiting what the AI can do: no sending, paying or deleting without a check outside the AI.']);
    K.results(main, G, S.run, res, {
      title: d.found === d.inj && d.cleanOk === d.clean && !d.falseTaps ? 'Nothing got past you.' : d.found >= 8 ? 'Sharp eyes.' : 'Sneaky, aren’t they?',
      stats: [[d.found + '/' + d.inj, 'orders caught'], [d.cleanOk + '/' + d.clean, 'clean docs cleared'], [String(d.falseTaps), 'false alarms']],
      remember: remember, onAgain: start,
    });
  }

  K.intro(main, G, start);
})();
