# Fencing Token Live + Arcade: server

A small realtime server for live sessions at [fencingtoken.com/live](https://fencingtoken.com/live/). It handles polls, multi-select, ratings, word clouds, open-text walls that stay hidden until you reveal them, timed quizzes with a leaderboard, and moderated Q&A with upvotes. It is built to handle 1,000+ participants and runs on Cloudflare Workers with one Durable Object per room.

- `src/index.js` is the Worker and the room logic.
- `../live/` holds the static pages, served by GitHub Pages:
  - `index.html`: what participants open
  - `present.html`: the presenter console
  - `deck-format.js`: the session-file parser
- Session files are kept privately in Drive (`Fencing Token/live-sessions/`), never in this repo. See the README in that folder for the format.

## Arcade leaderboards (same Worker)

The same Worker also runs the leaderboards for the Fencing Token Arcade games at [fencingtoken.com/play](https://fencingtoken.com/play/). These are separate from Live sessions.

- `src/arcade.js` holds the routes, and all scores live in one SQLite-backed Durable Object:
  - `POST /arcade/start`: returns a signed run token, plus an anonymous player token for a new browser
  - `POST /arcade/submit`: the server replays the moves and returns the score, stars, rank and boards
  - `POST /arcade/name`: sets a board name for a player
  - `POST /arcade/me`: returns a player's bests and stars
  - `POST /arcade/admin`: hides a name
  - `GET /arcade/board?game=<id>|path`: one game's boards, or the path board (total stars)
- `../play/` holds the games:
  - `kit.js` (intro, rounds, results, boards, the player token), `shell.js` (the swipe-card frame) and `games.js` (the 17-game path the hub draws)
  - each game folder holds `logic.js` (content and scoring, run by both the browser and the server), `game.js` and `index.html`

**Players and login.** There are no accounts yet. Each browser holds a random player ID inside a server-signed token, with no email or cookie. Tables are `players`, `plays` and `best`. `players.account` is reserved, so when login arrives an account can claim its existing player IDs and keep their progress.

**Anti-cheat, the fencing-token idea applied.**
- The browser never sends a score.
- Each run starts with a server-signed token (random seed, start time, run ID).
- The browser sends only its moves. The server replays them with the game's own `logic.js` and computes the score itself.
- The server rejects:
  - forged tokens and expired runs
  - runs that were already scored
  - runs played on an older deck
  - moves that are physically too fast
  - runs that took less real time than their moves
- Starts and submits are rate-limited per IP.
- Names must be 3–12 letters or digits and pass a filter. A player can change their name at most once a minute.

**Admin.** To hide a name from every board, run (add `"unhide":true` to undo):

```bash
curl -X POST https://fencingtoken-live.<you>.workers.dev/arcade/admin -d '{"key":"<HOST_KEY>","name":"BADNAME"}'
```

**Secrets.** Tokens are signed with a key derived from `HOST_KEY`. Set `ARCADE_SECRET` (32+ characters) if you want the two separate.

**If the Worker isn't deployed yet,** the games still work, with local personal bests only.

**After you change a game's content or scoring,** bump `VERSION` in its `cards.js` or `logic.js`. The server then refuses runs played on the old deck instead of scoring them wrongly.

## One-time setup (personal Mac, about 10 minutes)

Run these in the git clone, not in Drive:

```bash
cd ~/code/fencing-token/live-server
npm install
npx wrangler login                     # opens your browser; use your Cloudflare account
npx wrangler deploy                    # prints https://fencingtoken-live.<you>.workers.dev
openssl rand -hex 24                   # copy the output into your password manager as the host key
npx wrangler secret put HOST_KEY       # paste that key when asked
```

Then open `Fencing Token/fencing-token/live/config.js` **in Drive**. Set `api` to the address that deploy printed, with `https://` changed to `wss://`. Drive is the source of truth: if you edit only the git clone, the next `publish.sh` run overwrites it. Publish as usual.

If Cloudflare asks you to choose a workers.dev subdomain on the first deploy, any name is fine.

## Before every talk

1. **Write the session file** from `live-sessions/_template.md`. Check it with `node check-session.js <file>`.
2. **Rehearse at least one day before** with a few phones, using the real room code. Then press **End & delete**.
3. **Optional load test.** The test sends all simulated people from your one IP address, so lift the per-IP cap for the test, then restore it:
   ```bash
   npx wrangler deploy --var MAX_PER_IP:5000
   node loadtest.js wss://fencingtoken-live.<you>.workers.dev "<your HOST_KEY>" 1000
   npx wrangler deploy
   ```
   It uses room `LOADTEST`, checks that every count adds up, and wipes the room afterwards.
4. **On the day:** open `fencingtoken.com/live/present.html`, enter the room and key, and load the session file. Keep the presenter panel (P) off while you share your screen.

## Limits and cost

On the Workers Free plan, the daily limits reset at 00:00 UTC. One 90-minute session with 1,000 people and about 45 interactions uses roughly:

| Resource | Free per day | One session |
|---|---|---|
| Durable Object requests | 100,000 | about 5,000–15,000 (connections, plus incoming messages billed at 1/20) |
| Rows written | 100,000 | about 45,000–55,000 (one per answer, plus small state saves) |
| Rows read | 5,000,000 | well under 1,000,000 |

That fits, but with little headroom for a rehearsal or a load test on the same UTC day, or for anyone abusing the room. Two ways to protect the day:

- Rehearse and load-test on a different UTC day from the talk.
- For extra safety, switch to Workers Paid ($5/month) for the month of the talk. Its included usage is far above what a session needs.

## Security and privacy

**Host access.**
- Only someone with `HOST_KEY` can run the session. The key must be at least 32 characters.
- If the key is missing or short, nobody can become host.
- The key lives in the tab's sessionStorage and never goes into a URL you share.

**Abuse limits.**
- Each socket gets 15 messages per 5 seconds and is closed if it floods.
- Each IP address can open up to 50 connections (`MAX_PER_IP`). Raise it if a whole campus joins behind one network.
- A room holds up to 3,000 people (`MAX_AUDIENCE`).
- Host connections that don't authenticate are dropped after 10 seconds.

**Input handling.**
- All input is length-capped and cleaned, and pages render it as text, never as HTML.
- A small blocklist screens words.
- During the talk you can hide cloud words, wall answers and leaderboard names.
- Q&A questions wait for your approval before anyone sees them.

**Data kept.**
- Answers, an optional nickname (shown only on the quiz leaderboard), and Q&A questions. No email addresses, accounts or cookies.
- Everything is deleted when you press **End & delete**, or automatically 24 hours after the session was loaded.

**Connection rules.**
- The Worker accepts connections only from `ALLOWED_ORIGINS` (set in `wrangler.json`).
- The pages refuse to load inside another site's frame.

## Local development

```bash
npm run dev                                    # Worker on ws://localhost:8787 (dev key in package.json)
cd .. && python3 -m http.server 8788           # serve the site
# open http://localhost:8788/live/?c=TEST&api=ws://localhost:8787
# and  http://localhost:8788/live/present.html?c=TEST&api=ws://localhost:8787
```

The `?api=` override works only on localhost, so a crafted link can't redirect real participants to another server.
