# Fencing Token Arcade: how a game is built

Small browser games that teach AI from the basics through to policy gating. They're free and run on phones and computers, with no login and no ads. The hub at `/play/` draws the learning path from `games.js`. Each game is one folder:

```
play/<game-id>/
  logic.js    content + deterministic scoring. Runs in the browser AND on the server (anti-cheat)
  game.js     the screens, built with FTKit (kit.js)
  index.html  copy of teach-the-machine/index.html with title, description, URLs and scripts changed
  style.css   optional, only this game's styles (linked after ../arcade.css)
  og.png      1200x630 link preview (made by brand/arcade_og.py)
```

Shared files (`kit.js`, `shell.js`, `engine.js`, `arcade.css`, `games.js`, `hub.js`, `../live-server/`) are changed only on purpose, never as a side effect of building one game.

## Design rules (the game teaches by being played)

1. **The mechanic teaches.** The player *does* the concept (trains the model, is the retriever, seals the room) rather than reading about it.
2. **About 10 words per screen** outside the optional "why" or lesson text. Plain words for a first-year student with no AI background. Indian context is welcome (₹, OTP, hostel, canteen, UPI, exam portal).
3. **Tap first, never type.** Drag is a bonus, and every drag has a tap or button alternative. Targets are at least 44px. Portrait phone at 360px wide first; desktop centres the same column.
4. **Three rounds:** an easy one, then a pattern, then a twist where something hostile enters (a poisoned row, a planted instruction, a malicious tool). Use `K.roundOverlay`: the previous round's `rule` shows as "Rule unlocked".
5. **Instant feedback** within a second on every move, with a one-line lesson. Losing is funny, never preachy.
6. **2–3 minutes** a game, with a score and 3 stars.
7. **Accuracy matters.** Simplify, but never say anything false. Label made-up numbers as illustrative. Real incidents must be public and correctly described.
8. **Security of the page:** build DOM with `K.el` only (no `innerHTML`). No external requests except via FTKit. No inline `<script>`. Inline `style` attributes are fine. CSP stays `default-src 'self'`.
9. **Accessible:** real `<button>`s, `aria-label`s on icon-only controls, keyboard works, and colour is never the only signal.

## logic.js contract

UMD, ES5-style, no DOM, no `Date`, no `Math.random`. Pattern: `teach-the-machine/logic.js`.

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.FTGames = root.FTGames || {})['<game-id>'] = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var data = { rounds: [ {name:'Round 1', title:'…', rule:'one-line lesson'}, … ], … };
  function rng(seed) { /* mulberry32: copy from teach-the-machine */ }
  function deck(seed) { /* shuffle / pick content for this run, deterministic from seed */ }
  function replay(seed, moves) {
    // validate EVERYTHING in moves (types, lengths, ranges, duplicates); return {valid:false, reason:'…'} if bad
    // recompute score from scratch; never trust a score from the browser
    return { valid: true, done: true, score: S, minMs: M, log: [...], detail: {...} };
  }
  return { id: '<game-id>', VERSION: 1, stars: [one, two, three], data: data, deck: deck, replay: replay };
}));
```

- `moves` is whatever plain JSON the game records, under 30 KB once stringified. The browser submits exactly `run.moves`, so set `run.moves` to the live moves object or array when the run starts.
- `minMs` is a lower bound on the real time a human needs for those moves. The server rejects a run if `elapsed + 3000 < minMs`. Keep it honest but safe: sum the per-move minimum times you enforce, plus fixed animation waits. If moves carry per-move times, reject impossible ones (for example under 300–400 ms).
- `stars`: about 40%, 70% and 93% of the best possible score. A perfect run must get 3 stars.
- Bump `VERSION` whenever content or scoring changes.

## game.js contract (FTKit)

Read `kit.js` and copy the shape of `teach-the-machine/game.js` (sort frame) or `next-word/game.js` (pick frame). Card games can use `shell.js` (see `policy-engine/game.js`).

```js
var K = window.FTKit, el = K.el, L = window.FTGames['<game-id>'], main = document.getElementById('main');
var G = { logic: L, title, kicker: 'Fencing Token Arcade · Act N', pitch, meta: '3 rounds · about 2 minutes',
  howto: [{cls:'ask'|'allow'|'deny', glyph:'1', text}, …3], nextGame: {href:'/play/<next>/', title},
  shareText: function (score) { return '…'; },
  next: [{ href: '/concepts/?lens=everyone#<concept-id>', text, sub }] };
K.intro(main, G, start);
// start(): K.startRun(L).then(run => { S = {run, d: L.deck(run.seed), moves…}; run.moves = <moves>; K.roundOverlay(main, L.data.rounds, 0, round1, note) })
// finish(): var res = L.replay(S.run.seed, <moves>); K.results(main, G, S.run, res, { title, stats: [[value,label]×3], remember: [[bold, rest]…], onAgain: start })
```

FTKit helpers: `el(tag, attrs, kids)` (`text`, `class`, and `on*` handlers), `fmt`, `toast`, `vibrate`, `starRow`, `roundOverlay`, `results`, `intro`. Screens: `main.replaceChildren(el('section', {class:'screen'}, [...]))`. Use `.hud`, `.kicker`, `.small`, `.btn`, `.btn.ghost`, `.cta.static`, `.note-in`, `.feedback` from `arcade.css`. Colours come from `arcade.css` `:root` variables (`--bg2`, `--card`, `--ink`, `--line`, `--mist`, `--amber`, `--green`, `--red`, `--red-w`, `--green-w`, `--display`, `--mono`, `--body`).

Concept ids for `next` links: fencing-token, ai-agent, prompt-injection, the-lethal-trifecta, sandboxing, egress-control, policy-engine, complete-mediation, confused-deputy, least-privilege, human-approval, quarantined-model, mcp-and-the-tool-supply-chain, tamper-evident-audit-log, guardrails, red-teaming-and-evals.

## index.html

Copy `teach-the-machine/index.html`. Change `<title>`, the meta description, canonical, `og:*` and `twitter:image` URLs. Set scripts in this order: `/live/config.js`, `logic.js`, `../kit.js`, (`../engine.js`, `../shell.js` for card games), `game.js`, then the Cloudflare beacon. Add `<link rel="stylesheet" href="style.css">` after `../arcade.css` if the game has one.

## The path (order = nextGame chain)

1 teach-the-machine → 2 downhill → 3 husky-or-wolf → 4 next-word → 5 token-chop → 6 the-dial → 7 pack-the-suitcase → 8 real-or-fake → 9 meaning-map → 10 open-book → 11 five-librarians → 12 plug-it-in → 13 be-the-agent → 14 spot-the-injection → 15 close-the-room → 16 policy-engine → 17 sign-here → 18 cheat-this-leaderboard (last: nextGame `{href:'/play/', title:'the full path'}`)

Acts: 1–3 How AI learns · 4–8 How language models talk · 9–13 Building with AI · 14–18 Fencing it.

## Testing a game

- Node: `require('./<id>/logic.js')`. Check that a perfect run gets 3 stars, a sloppy run scores less, and that malformed, too-fast and unfinished moves return `valid:false`.
- jsdom play-through offline: with no server, FTKit falls back to a local seed and a local best. Load the page scripts in order into a JSDOM window and click through every round to the results screen. Check that `L.replay` on the recorded moves equals what was shown. See `/tmp/ftl/harness.mjs` in the build sandbox.
- Server: add the game to `GAMES` in `live-server/src/arcade.js` and run `wrangler dev`.
