/* Next Word: the pick frame. Guess the word a language model would most likely write next,
   then watch the same habit turn into hallucinations and prompt injection. */
(function () {
  'use strict';
  var K = window.FTKit, el = K.el, L = window.FTGames['next-word'];
  var main = document.getElementById('main');
  var G = {
    logic: L, title: 'Next Word', kicker: 'Fencing Token Arcade · Act 2',
    pitch: 'Chatbots like ChatGPT write one word at a time by guessing what usually comes next. Guess like a model, and find out why they make things up and obey hidden text.',
    meta: '3 rounds · 9 prompts · about 2 minutes',
    howto: [
      { cls: 'ask', glyph: '1', text: 'Read the start of a sentence' },
      { cls: 'allow', glyph: '2', text: 'Pick the word a model would most likely write next' },
      { cls: 'deny', glyph: '3', text: 'Top pick scores 100 points, second 50, third 20' },
    ],
    nextGame: { href: '/play/token-chop/', title: 'Token Chop' },
    shareText: function (s) { return 'I guessed like a language model and scored ' + s + ' in Next Word. Can you think like a chatbot?'; },
    next: [
      { href: '/concepts/?lens=everyone#prompt-injection', text: 'Prompt injection, explained three ways', sub: 'What Round 3 was really about.' },
    ],
  };
  var S;

  function start() {
    var b = main.querySelector('.btn'); if (b) { b.disabled = true; b.textContent = 'Starting…'; }
    K.startRun(L).then(function (run) {
      S = { run: run, d: L.deck(run.seed), i: 0, moves: [], pts: 0 };
      run.moves = S.moves;
      K.roundOverlay(main, L.data.rounds, 0, show, 'A model has read huge amounts of text. For each prompt, pick the word it would most likely write next.');
    });
  }

  function show() {
    var item = S.d[S.i], t0 = Date.now(), picked = false;
    var btns = item.opts.map(function (o, k) {
      return el('button', { class: 'choice', type: 'button', onclick: function () { pick(k); } }, [el('span', { class: 'bar' }), el('span', { class: 'w', text: o.w }), el('span', { class: 'pct', text: ' ' })]);
    });
    var fb = el('div', { 'aria-live': 'polite' });
    function pick(k) {
      if (picked) return; picked = true;
      var ms = Math.max(400, Math.min(120000, Date.now() - t0));
      S.moves.push([k, ms]);
      var o = item.opts[k], p = L.POINTS[o.rank]; S.pts += p;
      K.vibrate(o.rank === 0 ? 15 : [10, 40, 10]);
      btns.forEach(function (b, j) {
        var oj = item.opts[j]; b.disabled = true;
        if (oj.rank === 0) b.classList.add('top'); if (j === k) b.classList.add('mine');
        b.querySelector('.pct').textContent = Math.round(oj.pr * 100) + '%' + (oj.rank === 0 ? ' · top pick' : '');
        setTimeout(function () { b.querySelector('.bar').style.width = Math.round(oj.pr * 100) + '%'; }, 30);
      });
      var last = S.i === S.d.length - 1, endRound = last || S.d[S.i + 1].round !== item.round;
      fb.replaceChildren(el('div', { class: 'feedback' }, [
        el('p', { class: 'big', text: o.rank === 0 ? '+100 · You think like a model.' : p ? '+' + p + ' · Close.' : 'No points this time.' }),
        el('p', { text: item.p.lesson }),
        el('button', { class: 'btn', type: 'button', text: last ? 'See your score' : endRound ? 'Next round' : 'Next prompt', onclick: function () {
          S.i++;
          if (last) return finish();
          if (endRound) return K.roundOverlay(main, L.data.rounds, S.d[S.i].round, show, S.d[S.i].round === 2 ? 'Now the text the model is reading contains instructions written by someone else.' : 'Some of these have no true answer. The model still has to pick a word.');
          show();
        } }),
      ]));
      setTimeout(function () { var b = fb.querySelector('.btn'); if (b) { b.focus(); b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, 80);
    }
    var round = L.data.rounds[item.round];
    main.replaceChildren(el('section', { class: 'screen' }, [
      el('div', { class: 'hud' }, [
        el('div', {}, [el('p', { class: 'kicker', style: 'margin:0', text: round.name + ' · ' + round.title }), el('p', { class: 'small', style: 'margin:4px 0 0', text: 'Prompt ' + (S.i + 1) + ' of ' + S.d.length })]),
        el('span', { class: 'score', 'aria-label': 'Score', text: K.fmt(S.pts) }),
      ]),
      el('p', { class: 'prompt' }, [item.p.text + ' ', el('span', { class: 'blank', text: '____' })]),
      el('div', { class: 'choices' }, btns),
      fb,
      el('p', { class: 'disclaimer', text: 'Odds are illustrative, written to show how real models behave, not measured from one specific model. The missing percent goes to other words.' }),
    ]));
  }

  function finish() {
    var res = L.replay(S.run.seed, S.moves), top = res.log.filter(function (x) { return x.ok; }).length;
    var byRound = [0, 1, 2].map(function (r) { return res.log.filter(function (x, i) { return S.d[i].round === r && x.ok; }).length; });
    K.results(main, G, S.run, res, {
      title: top >= 7 ? 'You think like a language model.' : top >= 4 ? 'You are getting the pattern.' : 'Models are stranger than they look.',
      stats: [[top + '/9', 'top picks'], [byRound[1] + '/3', 'made-up answers predicted'], [byRound[2] + '/3', 'hijacks predicted']],
      remember: [
        ['A model predicts likely words, not true ones.', 'That is why it can sound sure about something nobody knows.'],
        ['It continues whatever text it reads.', 'Instructions hidden in an email, a web page or code can steer it. That is prompt injection.'],
        ['So the rules have to live outside the model.', 'That is the gate you play in Be the Policy Engine.'],
      ],
      onAgain: start,
    });
  }

  K.intro(main, G, start);
})();
