/* Be the Policy Engine: game-specific pieces for the arcade shell. */
(function () {
  'use strict';
  var TAGS = { private: 'Private data', out: 'Leaves the system', cantundo: 'Can’t undo', money: 'Money' };
  var ANS = { allow: 'Allow', deny: 'Deny', ask: 'Ask a human' };
  var WHY = {
    allow: 'It is on-task, has no lethal trifecta, and moves no money and deletes nothing. Blocking safe work has a cost too: people turn the policy off.',
    deny: 'It is outside the task the person asked for, or it combines untrusted content, private data and a way out (the lethal trifecta). Deny beats Ask: never hand a human an attack to approve.',
    ask: 'The person asked for it, but it moves money, deletes things or cannot be undone. A quick human yes, bound to this exact action, is the fence.',
  };
  window.FTShell({
    id: 'policy-engine',
    nextGame: { href: '/play/sign-here/', title: 'Sign Here' }, kicker: 'Fencing Token Arcade · Act 4',
    title: 'Be the Policy Engine',
    pitch: 'An AI agent wants to do things. You decide what it’s allowed to do.',
    meta: '3 lives · 24 cards · about 2 minutes',
    howto: [
      { cls: 'allow', glyph: '✓', text: 'Swipe right to Allow' },
      { cls: 'deny', glyph: '✕', text: 'Swipe left to Deny' },
      { cls: 'ask', glyph: '?', text: 'Swipe up to Ask a human' },
    ],
    data: window.FT_POLICY_CARDS,
    actions: {
      left: { code: 'D', label: 'Deny', glyph: '✕', stamp: 'DENY' },
      up: { code: 'K', label: 'Ask', glyph: '?', stamp: 'ASK' },
      right: { code: 'A', label: 'Allow', glyph: '✓', stamp: 'ALLOW' },
    },
    answerLabel: function (a) { return ANS[a]; },
    loseText: function (c, action) {
      if (action === 'ask') return c.ans === 'deny' ? 'You asked a human to approve an attack. Tired humans click yes.' : 'You paged a human for nothing. Next time they’ll approve without reading.';
      if (c.ans === 'ask' && (action === 'deny' || action === 'timeout')) return c.loseDeny || c.lose;
      return c.lose;
    },
    why: function (c) { return WHY[c.ans]; },
    renderCard: function (e, el) {
      var c = e.card;
      return el('article', { 'aria-label': 'Proposed action' }, [
        el('div', {}, [el('p', { class: 'lbl', text: 'The task' }), el('p', { class: 'task', text: c.task })]),
        el('div', {}, [el('p', { class: 'lbl', text: 'It just read' }), el('span', { class: 'read ' + c.read.who }, [el('span', { class: 'd' }), (c.read.who === 'you' ? 'Trusted: ' : 'Untrusted: ') + c.read.label])]),
        el('div', {}, [el('p', { class: 'lbl', text: 'Now it wants to run' }), el('pre', { class: 'act', text: c.act })]),
        el('div', { class: 'tags' }, c.tags.filter(function (t) { return TAGS[t]; }).map(function (t) { return el('span', { class: 'tag', text: TAGS[t] }); })),
      ]);
    },
    winLine: 'The agent never got past you.',
    loseLine: 'The agent got past you.',
    shareText: function (s) { return 'I scored ' + s + ' as the policy engine for an AI agent. Can you keep it in line?'; },
    next: [
      { href: '/concepts/?lens=everyone#lethal-trifecta', text: 'The lethal trifecta, explained three ways', sub: 'The pattern behind round 2.' },
      { href: '/concepts/?lens=engineer#policy-engine', text: 'What a real policy engine does', sub: 'For engineers: authorization outside the model.' },
    ],
  });
})();
