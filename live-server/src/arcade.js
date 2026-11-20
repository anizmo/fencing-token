// Fencing Token Arcade backend: players, verified scores, progress and leaderboards. Same Worker as Live.
//
// Identity (login-ready): each browser gets a random player id inside a server-signed token, with no account,
// email or cookie. When logins arrive, an `accounts` row will point at one or more player ids, so
// existing progress carries over (see players.account).
//
// Anti-cheat (the fencing-token idea applied, the browser is an untrusted client):
//  1. Every run starts with a server-signed token (seed, start time, run id, player). Each run scores once.
//  2. The browser submits only its moves; the server replays them with the game's own logic.js.
//  3. Timing must be humanly possible, and the run must have taken at least as long as its moves.
//  4. Per-IP rate limits. Names are 3-12 letters/digits, filtered, and can be hidden by the admin.
import { DurableObject } from 'cloudflare:workers';
import teachTheMachine from '../../play/teach-the-machine/logic.js';
import downhill from '../../play/downhill/logic.js';
import huskyOrWolf from '../../play/husky-or-wolf/logic.js';
import nextWord from '../../play/next-word/logic.js';
import tokenChop from '../../play/token-chop/logic.js';
import theDial from '../../play/the-dial/logic.js';
import packTheSuitcase from '../../play/pack-the-suitcase/logic.js';
import realOrFake from '../../play/real-or-fake/logic.js';
import meaningMap from '../../play/meaning-map/logic.js';
import openBook from '../../play/open-book/logic.js';
import fiveLibrarians from '../../play/five-librarians/logic.js';
import plugItIn from '../../play/plug-it-in/logic.js';
import beTheAgent from '../../play/be-the-agent/logic.js';
import spotTheInjection from '../../play/spot-the-injection/logic.js';
import closeTheRoom from '../../play/close-the-room/logic.js';
import policyEngine from '../../play/policy-engine/logic.js';
import signHere from '../../play/sign-here/logic.js';
import cheatThisLeaderboard from '../../play/cheat-this-leaderboard/logic.js';

export const GAMES = Object.fromEntries([teachTheMachine, downhill, huskyOrWolf, nextWord, tokenChop, theDial, packTheSuitcase, realOrFake, meaningMap, openBook, fiveLibrarians, plugItIn, beTheAgent, spotTheInjection, closeTheRoom, policyEngine, signHere, cheatThisLeaderboard].map((g) => [g.id, g]));
const TOKEN_TTL = 45 * 60 * 1000;
const LIMITS = { start: 120, submit: 60, name: 20, player: 30, me: 240 };   // per IP per hour
const BLOCK = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'porn', 'nigger', 'faggot', 'rape', 'bastard', 'chutiya', 'madarchod', 'bhenchod', 'behenchod', 'gandu', 'randi', 'nazi', 'hitler', 'admin', 'fencingtoken'];

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const enc = new TextEncoder();
const rid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 16);

export function week(ts) { // ISO week, e.g. 2026-W47 (UTC)
  const d = new Date(ts); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = d.getUTCFullYear(), w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

export function corsHeaders(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const h = { 'content-type': 'application/json', 'cache-control': 'no-store', vary: 'Origin' };
  if (allowed.includes(origin)) Object.assign(h, { 'access-control-allow-origin': origin, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' });
  return h;
}

export async function arcadeFetch(req, env) {
  const h = corsHeaders(req, env);
  const admin = new URL(req.url).pathname === '/arcade/admin';
  if (!h['access-control-allow-origin'] && !admin) return new Response('{"error":"forbidden"}', { status: 403, headers: h });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  const res = await env.ARCADE.get(env.ARCADE.idFromName('arcade')).fetch(req);
  return new Response(res.body, { status: res.status, headers: h });
}

export class Arcade extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env; this.hits = new Map(); this.sql = ctx.storage.sql;
    this.sql.exec(`CREATE TABLE IF NOT EXISTS players (pid TEXT PRIMARY KEY, name TEXT NOT NULL DEFAULT '', created INTEGER NOT NULL, renamed_at INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0, account TEXT)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS plays (rid TEXT PRIMARY KEY, pid TEXT NOT NULL, game TEXT NOT NULL, week TEXT NOT NULL, score INTEGER NOT NULL, ts INTEGER NOT NULL, version INTEGER NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS best (pid TEXT NOT NULL, game TEXT NOT NULL, score INTEGER NOT NULL, stars INTEGER NOT NULL, plays INTEGER NOT NULL, first_ts INTEGER NOT NULL, best_ts INTEGER NOT NULL, PRIMARY KEY (pid, game))`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS best_board ON best (game, score DESC)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS plays_week ON plays (game, week, score DESC)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS plays_pid ON plays (pid, game)');
  }

  // ---------------------------------------------------------------- signing
  secret() { const s = this.env.ARCADE_SECRET || this.env.HOST_KEY; return s && s.length >= 32 ? s : null; }
  async key() { if (!this.k) this.k = await crypto.subtle.importKey('raw', enc.encode('arcade-v2:' + this.secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']); return this.k; }
  async sign(obj) { const body = b64u(enc.encode(JSON.stringify(obj))); return body + '.' + b64u(await crypto.subtle.sign('HMAC', await this.key(), enc.encode(body))); }
  async verify(tok, kind) {
    if (typeof tok !== 'string' || tok.length > 800) return null;
    const [body, sig] = tok.split('.');
    if (!body || !sig) return null;
    try { if (!(await crypto.subtle.verify('HMAC', await this.key(), fromB64u(sig), enc.encode(body)))) return null; return (o => o.k === kind ? o : null)(JSON.parse(new TextDecoder().decode(fromB64u(body)))); } catch { return null; }
  }
  async player(tok) { const p = await this.verify(tok, 'p'); return p && /^[a-f0-9]{16}$/.test(p.p) ? p.p : null; }
  async newPlayer() { const pid = rid(); this.sql.exec('INSERT INTO players (pid, created) VALUES (?, ?)', pid, Date.now()); return { pid, token: await this.sign({ k: 'p', p: pid, i: Date.now() }) }; }
  ensurePlayer(pid) { this.sql.exec('INSERT OR IGNORE INTO players (pid, created) VALUES (?, ?)', pid, Date.now()); }

  limited(ip, kind) {
    const now = Date.now(), k = kind + ':' + ip, e = this.hits.get(k);
    if (this.hits.size > 50000) this.hits.clear();
    if (!e || now - e.t > 3600000) { this.hits.set(k, { t: now, n: 1 }); return false; }
    return ++e.n > LIMITS[kind];
  }

  // ---------------------------------------------------------------- boards
  label(name, pid) { return name || `Player ${pid.slice(-4).toUpperCase()}`; }
  boardAll(game, limit = 10) {
    return [...this.sql.exec(`SELECT b.pid, p.name, b.score FROM best b JOIN players p ON p.pid = b.pid WHERE b.game = ? AND p.hidden = 0 ORDER BY b.score DESC, b.best_ts ASC LIMIT ?`, game, limit)]
      .map((r, i) => ({ r: i + 1, n: this.label(r.name, r.pid), s: r.score, me: r.pid }));
  }
  boardWeek(game, wk, limit = 10) {
    return [...this.sql.exec(`SELECT x.pid, p.name, x.score FROM (SELECT pid, MAX(score) AS score, MIN(ts) AS ts FROM plays WHERE game = ? AND week = ? GROUP BY pid) x JOIN players p ON p.pid = x.pid WHERE p.hidden = 0 ORDER BY x.score DESC, x.ts ASC LIMIT ?`, game, wk, limit)]
      .map((r, i) => ({ r: i + 1, n: this.label(r.name, r.pid), s: r.score, me: r.pid }));
  }
  boardPath(limit = 10) {
    return [...this.sql.exec(`SELECT b.pid, p.name, SUM(b.stars) AS stars, SUM(b.score) AS score, COUNT(*) AS games FROM best b JOIN players p ON p.pid = b.pid WHERE p.hidden = 0 GROUP BY b.pid ORDER BY stars DESC, score DESC LIMIT ?`, limit)]
      .map((r, i) => ({ r: i + 1, n: this.label(r.name, r.pid), s: r.stars, g: r.games, me: r.pid }));
  }
  boards(game, pid) {
    const strip = (rows) => rows.map((r) => ({ r: r.r, n: r.n, s: r.s, g: r.g, you: r.me === pid || undefined }));
    if (game === 'path') return { all: strip(this.boardPath()) };
    return { week: strip(this.boardWeek(game, week(Date.now()))), all: strip(this.boardAll(game)) };
  }
  ranks(game, pid) {
    const wk = week(Date.now());
    const mine = this.sql.exec('SELECT score FROM best WHERE pid = ? AND game = ?', pid, game).toArray()[0];
    const wmine = this.sql.exec('SELECT MAX(score) AS s FROM plays WHERE pid = ? AND game = ? AND week = ?', pid, game, wk).toArray()[0];
    const all = mine ? this.sql.exec('SELECT COUNT(*) AS c FROM best b JOIN players p ON p.pid = b.pid WHERE b.game = ? AND p.hidden = 0 AND b.score > ?', game, mine.score).one().c + 1 : null;
    const wkr = wmine && wmine.s !== null ? this.sql.exec('SELECT COUNT(*) AS c FROM (SELECT pid, MAX(score) AS s FROM plays WHERE game = ? AND week = ? GROUP BY pid) x JOIN players p ON p.pid = x.pid WHERE p.hidden = 0 AND x.s > ?', game, wk, wmine.s).one().c + 1 : null;
    return { week: wkr, all };
  }
  stars(g, score) { return g.stars.filter((t) => score >= t).length; }

  // ---------------------------------------------------------------- routes
  async fetch(req) {
    const url = new URL(req.url), path = url.pathname, ip = req.headers.get('CF-Connecting-IP') || 'local';
    const out = (o, status = 200) => new Response(JSON.stringify(o), { status });
    if (!this.secret()) return out({ error: 'Leaderboards are not configured yet.' }, 503);
    let body = {};
    if (req.method === 'POST') { const t = await req.text(); if (t.length > 30000) return out({ error: 'too big' }, 413); try { body = JSON.parse(t || '{}'); } catch { return out({ error: 'bad json' }, 400); } }

    if (path === '/arcade/board' && req.method === 'GET') {
      const game = url.searchParams.get('game');
      if (game !== 'path' && !GAMES[game]) return out({ error: 'unknown game' }, 404);
      return out(this.boards(game, null));
    }

    if (path === '/arcade/start' && req.method === 'POST') {
      const g = GAMES[body.game];
      if (!g) return out({ error: 'unknown game' }, 404);
      if (this.limited(ip, 'start')) return out({ error: 'Too many games from your network. Try again in a bit.' }, 429);
      let pid = await this.player(body.player), fresh = null;
      if (!pid) { if (this.limited(ip, 'player')) return out({ error: 'Too many new players from your network.' }, 429); fresh = await this.newPlayer(); pid = fresh.pid; }
      const seed = crypto.getRandomValues(new Uint32Array(1))[0];
      const token = await this.sign({ k: 'r', g: g.id, v: g.VERSION, s: seed, i: Date.now(), r: rid(), p: pid });
      return out({ token, seed, version: g.VERSION, player: fresh ? fresh.token : undefined });
    }

    if (path === '/arcade/submit' && req.method === 'POST') {
      if (this.limited(ip, 'submit')) return out({ error: 'Too many scores from your network. Try again in a bit.' }, 429);
      const run = await this.verify(body.token, 'r');
      const g = run && GAMES[run.g];
      if (!g) return out({ error: 'This run was not started by the server.' }, 400);
      const now = Date.now();
      if (run.v !== g.VERSION) return out({ error: 'The game was updated while you played. Please play again.' }, 409);
      if (now - run.i > TOKEN_TTL) return out({ error: 'This run expired.' }, 400);
      const res = g.replay(run.s, body.moves);
      if (!res || !res.valid) return out({ error: 'The server could not replay that run (' + (res ? res.reason : 'invalid') + ').' }, 422);
      if (now - run.i + 3000 + Number(this.env.ARCADE_TEST_SLACK_MS || 0) < res.minMs) return out({ error: 'Faster than physics: that run took less time than its moves.' }, 422);
      this.ensurePlayer(run.p);
      try { this.sql.exec('INSERT INTO plays (rid, pid, game, week, score, ts, version) VALUES (?, ?, ?, ?, ?, ?, ?)', run.r, run.p, g.id, week(now), res.score, now, g.VERSION); }
      catch { return out({ error: 'This run was already scored.' }, 409); }
      const stars = this.stars(g, res.score);
      const prev = this.sql.exec('SELECT score, stars FROM best WHERE pid = ? AND game = ?', run.p, g.id).toArray()[0];
      if (!prev) this.sql.exec('INSERT INTO best (pid, game, score, stars, plays, first_ts, best_ts) VALUES (?, ?, ?, ?, 1, ?, ?)', run.p, g.id, res.score, stars, now, now);
      else if (res.score > prev.score) this.sql.exec('UPDATE best SET score = ?, stars = ?, plays = plays + 1, best_ts = ? WHERE pid = ? AND game = ?', res.score, Math.max(stars, prev.stars), now, run.p, g.id);
      else this.sql.exec('UPDATE best SET plays = plays + 1 WHERE pid = ? AND game = ?', run.p, g.id);
      if (Math.random() < 0.02) this.sql.exec('DELETE FROM plays WHERE ts < ?', now - 120 * 864e5);
      const p = this.sql.exec('SELECT name FROM players WHERE pid = ?', run.p).toArray()[0] || {};
      return out({ score: res.score, stars, best: Math.max(res.score, prev ? prev.score : 0), newBest: !prev || res.score > prev.score, name: p.name || '', rank: this.ranks(g.id, run.p), board: this.boards(g.id, run.p) });
    }

    if (path === '/arcade/name' && req.method === 'POST') {
      if (this.limited(ip, 'name')) return out({ error: 'Too many requests.' }, 429);
      const pid = await this.player(body.player);
      if (!pid) return out({ error: 'Play a game first.' }, 400);
      const name = String(body.name || '').normalize('NFKC').replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
      if (name.length < 3) return out({ error: 'Names are 3–12 letters or numbers.' }, 400);
      if (BLOCK.some((w) => name.toLowerCase().includes(w))) return out({ error: 'Please pick another name.' }, 400);
      this.ensurePlayer(pid);
      const row = this.sql.exec('SELECT renamed_at FROM players WHERE pid = ?', pid).one();
      if (Date.now() - row.renamed_at < 60000) return out({ error: 'You just changed your name. Try again in a minute.' }, 429);
      this.sql.exec('UPDATE players SET name = ?, renamed_at = ? WHERE pid = ?', name, Date.now(), pid);
      const game = GAMES[body.game] ? body.game : null;
      return out({ ok: true, name, board: game ? this.boards(game, pid) : undefined });
    }

    if (path === '/arcade/me' && req.method === 'POST') {
      if (this.limited(ip, 'me')) return out({ error: 'Too many requests.' }, 429);
      const pid = await this.player(body.player);
      if (!pid) return out({ name: '', games: {} });
      const p = this.sql.exec('SELECT name FROM players WHERE pid = ?', pid).toArray()[0] || {};
      const games = {};
      for (const r of this.sql.exec('SELECT game, score, stars, plays FROM best WHERE pid = ?', pid)) games[r.game] = { best: r.score, stars: r.stars, plays: r.plays };
      return out({ name: p.name || '', games });
    }

    if (path === '/arcade/admin' && req.method === 'POST') {
      // Hide a player from every board:  curl -X POST <worker>/arcade/admin -d '{"key":"<HOST_KEY>","name":"BADNAME"}'
      const k = String(body.key || ''), s = String(this.env.HOST_KEY || '');
      if (s.length < 32 || k.length !== s.length || !crypto.subtle.timingSafeEqual(enc.encode(k), enc.encode(s))) return out({ error: 'denied' }, 403);
      const n = this.sql.exec('UPDATE players SET hidden = ? WHERE name = ?', body.unhide ? 0 : 1, String(body.name || '')).rowsWritten;
      return out({ ok: true, changed: n });
    }
    return out({ error: 'not found' }, 404);
  }
}
