/* Cheat This Leaderboard: content + deterministic scoring, shared by the game page and the leaderboard server.
   You play the attacker against this arcade's own leaderboard. For each trick, predict which fence stops it.
   Every fence and every server message below is what live-server/src/arcade.js really does and says
   (keep them in sync if that file changes). moves = [[optionIndex | -1 for time-out, ms], ...] one per trick,
   in the shuffled order. Bump VERSION whenever content or scoring changes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.FTGames = root.FTGames || {})['cheat-this-leaderboard'] = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var data = {
    rounds: [
      { name: 'Round 1', title: 'Try a trick', limit: 0, rule: 'The browser never decides your score. The server checks every run itself.' },
      { name: 'Round 2', title: 'Faster', limit: 15000, rule: 'Every check sits on the server, where the browser can’t switch it off.' },
      { name: 'Round 3', title: 'Your computer, your rules', limit: 0, rule: 'Check authority where the action happens. The browser is the attacker’s computer.' },
    ],
    fences: {
      replay: { g: '↻', name: 'Server replays your moves', sub: 'It works out the score itself.' },
      once: { g: '1×', name: 'Each run scores once', sub: 'Every run has its own ID.' },
      sig: { g: '✍', name: 'Signature check', sub: 'Only the server can sign a run token.' },
      phys: { g: '⏱', name: 'Faster than physics', sub: 'A run can’t beat its own clock.' },
      ver: { g: 'v2', name: 'Version check', sub: 'Runs on an old deck are refused.' },
      rate: { g: '🚦', name: 'Rate limit', sub: 'Only so many tries per network per hour.' },
      name: { g: 'Aa', name: 'Name filter', sub: '3–12 letters or numbers, no rude words.' },
      local: { g: '📱', name: 'Local stars don’t count', sub: 'The board lives on the server.' },
      exp: { g: '⌛', name: 'Tokens expire', sub: 'A run must come back within 45 minutes.' },
    },
    // kind 'fence': opts are fence ids. kind 'pick': opts are keys of choices. server: the real response from arcade.js.
    tricks: [
      { id: 'score', r: 0, kind: 'fence', title: 'Edit your score in the browser', cmd: ['score = 999999', 'submit()'], opts: ['replay', 'sig', 'name'], ans: 'replay', live: 'score',
        server: { code: 422, msg: 'The server could not replay that run (run not finished).', sent: 'Sent: this run’s moves so far, plus score: 999999.' },
        lesson: 'Your screen can show 999,999. The browser never sends a score: the server replays your moves with the game’s own code and works it out.' },
      { id: 'twice', r: 0, kind: 'fence', title: 'Send the same winning run twice', cmd: ['submit(bestRun)', 'submit(bestRun)   # again!'], opts: ['once', 'rate', 'phys'], ans: 'once',
        server: { code: 409, msg: 'This run was already scored.' },
        lesson: 'Every run token carries a run ID. The server saves it the first time and refuses it after that.' },
      { id: 'forge', r: 0, kind: 'fence', title: 'Forge your own run token', cmd: ['token = makeToken({ seed: 7 })', 'submit(token, perfectMoves)'], opts: ['sig', 'ver', 'replay'], ans: 'sig', live: 'forge',
        server: { code: 400, msg: 'This run was not started by the server.', sent: 'Sent: a home-made token with a fake signature.' },
        lesson: 'Run tokens are signed with a secret only the server knows. Make your own, or change one letter, and the signature check fails.' },
      { id: 'name', r: 0, kind: 'fence', title: 'Put a rude name on the board', cmd: ['setName("ADMIN")   # or something worse'], opts: ['name', 'local', 'rate'], ans: 'name', live: 'name',
        server: { code: 400, msg: 'Please pick another name.', sent: 'Sent: the name ADMIN.' },
        lesson: 'A filter blocks common rude words and names like ADMIN. No filter catches everything, so a person can also hide a name from every board.' },
      { id: 'fast', r: 1, kind: 'fence', title: 'Win a run in 2 seconds', cmd: ['start()', 'submit(perfectMoves)   # 2 s later'], opts: ['phys', 'rate', 'once', 'replay'], ans: 'phys',
        server: { code: 422, msg: 'Faster than physics: that run took less time than its moves.' },
        lesson: 'Each game knows the least time its moves can take. The start time is signed into the token, so the server knows how long you really took.' },
      { id: 'robot', r: 1, kind: 'fence', title: 'Answer every prompt in 50 ms', cmd: ['moves = answers.map(a => [a, 50])', 'submit(token, moves)'], opts: ['replay', 'once', 'ver', 'name'], ans: 'replay',
        server: { code: 422, msg: 'The server could not replay that run (impossible timing on prompt 1).', sent: 'In Next Word:' },
        lesson: 'Replaying your moves also checks each one is humanly possible. Nobody reads and taps in 50 ms.' },
      { id: 'oldver', r: 1, kind: 'fence', title: 'Score an old deck after an update', cmd: ['token = start()   # version 1', '# …the game updates to version 2…', 'submit(token, version1Moves)'], opts: ['ver', 'sig', 'once', 'exp'], ans: 'ver',
        server: { code: 409, msg: 'The game was updated while you played. Please play again.' },
        lesson: 'The version is signed into the token. Runs on an old deck are refused instead of being scored wrongly.' },
      { id: 'flood', r: 1, kind: 'fence', title: 'Send 1,000 scores', cmd: ['for (i = 0; i < 1000; i++) submit()'], opts: ['rate', 'once', 'sig', 'phys'], ans: 'rate',
        server: { code: 429, msg: 'Too many scores from your network. Try again in a bit.' },
        lesson: 'About 60 scores an hour per network. Each needs a fresh run, and only your best counts anyway.' },
      { id: 'seed', r: 1, kind: 'fence', title: 'Pick an easy seed', cmd: ['token.seed = 42   # a deck I like', 'submit(token, easyMoves)'], opts: ['sig', 'replay', 'ver', 'exp'], ans: 'sig',
        server: { code: 400, msg: 'This run was not started by the server.' },
        lesson: 'The seed sits inside the signed token. Edit it and the signature no longer matches.' },
      { id: 'expire', r: 1, kind: 'fence', title: 'Keep a run token for tomorrow', cmd: ['save(token)', '# …the next day…', 'submit(token, practisedMoves)'], opts: ['exp', 'once', 'sig', 'ver'], ans: 'exp',
        server: { code: 400, msg: 'This run expired.' },
        lesson: 'The signed start time is also a clock. A run has to come back within 45 minutes.' },
      { id: 'works', r: 2, kind: 'pick', title: 'One of these tricks DOES work', q: 'Which one works?', cmd: ['# the browser runs on your computer', '# you can change anything in it'], ans: 'stars',
        choices: { stars: 'Edit the stars saved on this device', forge: 'Forge a run token', twice: 'Send one run twice', flood: 'Send 1,000 scores' }, opts: ['stars', 'forge', 'twice', 'flood'],
        lesson: 'It works, on your screen. The arcade map reads your stars from this device, so you can fool yourself. Nobody else sees it.' },
      { id: 'why', r: 2, kind: 'pick', title: 'Your map shows 3 stars everywhere', q: 'Why doesn’t it matter?', cmd: ['localStorage["ftarcade-progress"] = allThreeStars', 'location = "/play/"'], ans: 'server',
        choices: { server: 'The leaderboards are kept on the server', hidden: 'Your browser hides its storage from you', reset: 'Stars reset every night' }, opts: ['server', 'hidden', 'reset'],
        lesson: 'The boards only count runs the server replayed and saved itself. Your device’s copy is a note to yourself.' },
      { id: 'where', r: 2, kind: 'pick', title: 'Last one', q: 'So where must every check live?', cmd: ['# you own the browser.', '# what can’t you touch?'], ans: 'server',
        choices: { server: 'On the server, where scores are saved', js: 'In the game code your browser runs', hidden: 'Behind a button nobody can see', storage: 'In your browser’s storage' }, opts: ['server', 'js', 'hidden', 'storage'],
        lesson: 'Check authority where the action happens. The browser is the attacker’s computer, so the server is the gate. Checking every request there is called complete mediation.' },
    ],
  };
  var BASE = [100, 100, 150], BONUS = 30, FULL_MS = 3000, ZERO_MS = 10000, MIN_MS = 500, MAX_MS = 120000, HOLD_MS = 600;

  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(arr, r) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // Rounds 1 and 2 are shuffled; round 3 tells a story, so it keeps its order. Options are always shuffled.
  function deck(seed) {
    var r = rng(seed), out = [];
    [0, 1, 2].forEach(function (ri) {
      var list = data.tricks.filter(function (t) { return t.r === ri; });
      (ri === 2 ? list : shuffle(list, r)).forEach(function (t) { out.push({ t: t, round: ri, opts: shuffle(t.opts, r), limit: data.rounds[ri].limit }); });
    });
    return out;
  }
  function speed(ms) { return ms <= FULL_MS ? BONUS : ms >= ZERO_MS ? 0 : Math.round(BONUS * (ZERO_MS - ms) / (ZERO_MS - FULL_MS)); }
  function points(item, k, ms) { var ok = k >= 0 && item.opts[k] === item.t.ans; return ok ? BASE[item.round] + speed(ms) : 0; }

  function replay(seed, moves) {
    var d = deck(seed), score = 0, log = [], minMs = 0;
    if (!Array.isArray(moves) || moves.length < d.length) return { valid: false, reason: 'run not finished' };
    if (moves.length > d.length) return { valid: false, reason: 'too many moves' };
    for (var i = 0; i < d.length; i++) {
      var m = moves[i], it = d[i];
      if (!Array.isArray(m) || m.length !== 2) return { valid: false, reason: 'bad move ' + i };
      var k = m[0], ms = m[1];
      if (typeof k !== 'number' || typeof ms !== 'number' || !Number.isInteger(k) || !isFinite(ms)) return { valid: false, reason: 'bad move ' + i };
      if (k < -1 || k >= it.opts.length || (k === -1 && !it.limit)) return { valid: false, reason: 'bad choice on trick ' + (i + 1) };
      var cap = it.limit ? it.limit + 1000 : MAX_MS;
      if (!(ms >= MIN_MS && ms <= cap) || (k === -1 && ms < it.limit - 50)) return { valid: false, reason: 'impossible timing on trick ' + (i + 1) };
      var p = points(it, k, ms), ok = p > 0;
      score += p; minMs += ms + HOLD_MS;
      log.push({ id: it.t.id, r: it.round, ok: ok, p: p, pick: k >= 0 ? it.opts[k] : null, ans: it.t.ans, ms: ms });
    }
    var right = function (r) { return log.filter(function (x) { return x.r === r && x.ok; }).length; };
    return { valid: true, done: true, score: score, minMs: minMs, log: log, detail: { right: right(0) + right(1) + right(2), fences: right(0) + right(1), twist: right(2), avgMs: Math.round(log.reduce(function (s, x) { return s + x.ms; }, 0) / log.length) } };
  }

  // All 13 right with no speed bonus = 1,450; all right and fast = 1,840. 3 stars needs all right plus a little speed, or one slip and real speed.
  return { id: 'cheat-this-leaderboard', VERSION: 2, stars: [700, 1150, 1550], data: data, deck: deck, replay: replay, points: points, speed: speed, MIN_MS: MIN_MS, MAX_MS: MAX_MS, HOLD_MS: HOLD_MS };
}));
