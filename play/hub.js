/* The arcade's front door: the learning path, drawn from games.js, with your stars from this device
   and the path leaderboard (total stars) when the server is reachable. */
(function () {
  'use strict';
  var K = window.FTKit, el = K.el, P = window.FT_ARCADE_PATH, prog = K.progress();
  var live = P.games.filter(function (g) { return g.status === 'live'; });
  var nextUp = live.filter(function (g) { return !(prog[g.id] && prog[g.id].stars > 0); })[0] || live[0];
  var total = live.reduce(function (s, g) { return s + ((prog[g.id] && prog[g.id].stars) || 0); }, 0);
  var started = Object.keys(prog).length > 0;

  var start = document.getElementById('start');
  start.href = '/play/' + nextUp.id + '/';
  start.textContent = started ? 'Continue: ' + nextUp.title : 'Start with ' + nextUp.title;
  document.getElementById('mystars').textContent = started ? 'Your stars: ' + total + ' of ' + live.length * 3 + ' so far, saved on this device.' : '';

  var n = 0, map = document.getElementById('map');
  P.acts.forEach(function (act) {
    var games = P.games.filter(function (g) { return g.act === act.id; });
    map.appendChild(el('section', { class: 'pact', 'aria-labelledby': 'act-' + act.id }, [
      el('p', { class: 'kicker', style: 'margin:0', text: act.name }),
      el('h2', { id: 'act-' + act.id, text: act.title }),
      el('p', { text: act.blurb }),
      el('ol', { class: 'path', start: String(n + 1) }, games.map(function (g) {
        n++;
        var mine = prog[g.id], isLive = g.status === 'live', done = mine && mine.stars > 0;
        var head = el('h3', {}, [g.title, isLive ? (mine ? K.starRow(mine.stars) : null) : el('span', { class: 'soonpill', text: 'Coming soon' })]);
        var body = [el('span', { class: 'teach', text: g.teaches }), head, el('p', { text: g.play })];
        return el('li', { class: 'step' + (isLive ? ' live' : '') + (done ? ' done' : '') }, [
          el('span', { class: 'dot', 'aria-hidden': 'true', text: done ? '✓' : String(n) }),
          isLive ? el('a', { class: 'info', href: '/play/' + g.id + '/' }, body) : el('div', { class: 'info' }, body),
        ]);
      })),
    ]));
  });

  if (K.api()) {
    var lb = document.getElementById('pathboard');
    K.get('/arcade/board?game=path').then(function (b) {
      lb.replaceChildren(el('h2', { text: 'Path leaderboard' }), el('p', { class: 'small', text: 'Total stars across every game. Play a game and pick a name to appear here.' }), K.boards(b));
    }).catch(function () {});
  }
})();
