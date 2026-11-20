// Fencing Token Live: realtime polls, word clouds, quizzes, answer walls and Q&A for any session file.
// One Durable Object per room code; audience and host connect over hibernatable WebSockets.
//
// Security model
// - The host proves itself with HOST_KEY (a Worker secret, >= 32 chars). No key configured = no host at all.
// - Audience input is validated, length-capped and rate-limited; sockets that flood are closed.
// - Connections are capped per room and per client IP; unauthenticated host sockets expire after 10 s.
// - Only the currently open item accepts answers. Q&A questions wait for host approval (configurable).
// - All session data auto-deletes 24 hours after the session is loaded (or on "End & delete").
import { DurableObject } from 'cloudflare:workers';
import { arcadeFetch, Arcade } from './arcade.js';
export { Arcade };

const MAX_MSG = 4000;                 // bytes per audience message
const MAX_HOST_MSG = 200000;          // bytes per host message (deck upload)
const RATE_WINDOW = 5000, RATE_MAX = 15;
const PUSH_MS = 500;
const RETAIN_MS = 24 * 3600 * 1000;
const TYPES = new Set(['title', 'poll', 'multi', 'scale', 'quiz', 'cloud', 'wall', 'leaderboard', 'qa']);
const CHOICE = new Set(['poll', 'multi', 'scale', 'quiz']);
const BLOCK = ['fuck', 'shit', 'bitch', 'cunt', 'dick', 'porn', 'nigger', 'faggot', 'rape', 'bastard', 'chutiya', 'madarchod', 'bhenchod', 'behenchod', 'gandu', 'randi'];

const json = (o) => JSON.stringify(o);
const clean = (s, max) => String(s ?? '').normalize('NFKC')
  .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁠-⁩﻿]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const blocked = (s) => { const l = s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, ''); return BLOCK.some((w) => l.includes(w)); };
const word = (s, maxWords) => clean(s, 40).toLowerCase().replace(/[^\p{L}\p{N}\s'-]/gu, '').replace(/\s+/g, ' ').trim().split(' ').slice(0, maxWords).join(' ').slice(0, 30);
const rid = () => crypto.randomUUID().replace(/-/g, '').slice(0, 12);

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || b.length < 32) return false;
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let d = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) d |= (x[i] || 0) ^ (y[i] || 0);
  return d === 0;
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === '/health') return new Response('ok', { headers: { 'content-type': 'text/plain' } });
    if (url.pathname.startsWith('/arcade/')) return arcadeFetch(req, env);
    const m = url.pathname.match(/^\/room\/([A-Za-z0-9]{3,16})$/);
    if (!m) return new Response('Not found', { status: 404 });
    const allowed = String(env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (!allowed.includes(req.headers.get('Origin') || '')) return new Response('Forbidden', { status: 403 });
    if ((req.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
    return env.ROOMS.get(env.ROOMS.idFromName(m[1].toUpperCase())).fetch(req);
  },
};

export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.ready = null;
    this.pushTimer = null; this.flushTimer = null; this.qaTimer = null;
    this.dirty = new Set();
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('{"t":"ping"}', '{"t":"pong"}'));
  }

  // ---------------------------------------------------------------- state (rebuilt after every hibernation)
  load() {
    if (!this.ready) this.ready = (async () => {
      const got = await this.ctx.storage.get(['meta', 'scores', 'qa']);
      this.meta = got.get('meta') || null;     // {deck, title, cur, status, results, qaOpen, qaModerate, openedAt, created}
      this.scores = got.get('scores') || {};    // voter -> {n, s, items: {i: points}, hideName}
      this.qa = got.get('qa') || [];            // [{id, text, by, up: [voters], hidden, pending, done, ts}]
      this.items = new Map();                   // i -> {answers: Map(voter -> val), hidden, scored, agg}
      this.ips = new Map();
      for (const ws of this.ctx.getWebSockets()) { const a = ws.deserializeAttachment() || {}; if (a.ip) this.ips.set(a.ip, (this.ips.get(a.ip) || 0) + 1); }
      if (this.meta) await this.itemState(this.meta.cur);
    })();
    return this.ready;
  }

  item(i = this.meta?.cur) { return this.meta?.deck?.[i] || null; }

  // Answers are the source of truth; aggregates are recomputed from them, so counts never drift.
  async itemState(i) {
    if (this.items.has(i)) return this.items.get(i);
    const it = this.item(i);
    const extra = (await this.ctx.storage.get(`x:${i}`)) || { hidden: [], scored: false };
    const answers = new Map();
    const list = await this.ctx.storage.list({ prefix: `a:${i}:` });
    for (const [k, v] of list) answers.set(k.slice(`a:${i}:`.length), v);
    const st = { answers, hidden: extra.hidden || [], scored: !!extra.scored, agg: null };
    st.agg = this.aggregate(it, answers);
    this.items.set(i, st);
    return st;
  }

  aggregate(it, answers) {
    const agg = { n: answers.size };
    if (!it) return agg;
    if (CHOICE.has(it.type)) {
      agg.counts = new Array(it.options.length).fill(0);
      for (const a of answers.values()) (Array.isArray(a.v) ? a.v : [a.v]).forEach((k) => { if (agg.counts[k] !== undefined) agg.counts[k]++; });
    } else if (it.type === 'cloud') {
      agg.words = {};
      for (const a of answers.values()) for (const w of new Set(a.v)) agg.words[w] = (agg.words[w] || 0) + 1;
    }
    return agg;
  }

  markDirty(key) { this.dirty.add(key); if (!this.flushTimer) this.flushTimer = setTimeout(() => this.flush(), 400); }

  async flush() {
    this.flushTimer = null;
    const out = {};
    for (const k of this.dirty) {
      if (k === 'meta') out.meta = this.meta;
      else if (k === 'scores') out.scores = this.scores;
      else if (k === 'qa') out.qa = this.qa;
      else if (k.startsWith('x:')) { const st = this.items.get(Number(k.slice(2))); if (st) out[k] = { hidden: st.hidden, scored: st.scored }; }
    }
    this.dirty.clear();
    if (Object.keys(out).length && this.meta) {
      try { await this.ctx.storage.put(out); } catch (e) { for (const k of Object.keys(out)) this.dirty.add(k); console.error('flush failed', e); }
    }
  }

  // ---------------------------------------------------------------- connections
  async fetch(req) {
    await this.load();
    const role = new URL(req.url).searchParams.get('role') === 'host' ? 'pending' : 'aud';
    const ip = req.headers.get('CF-Connecting-IP') || 'local';
    const maxAud = Number(this.env.MAX_AUDIENCE || 3000), maxIp = Number(this.env.MAX_PER_IP || 50);
    if (role === 'aud') {
      if (this.ctx.getWebSockets('aud').length >= maxAud) return new Response('Room full', { status: 503 });
      if ((this.ips.get(ip) || 0) >= maxIp) return new Response('Too many connections from your network', { status: 429 });
    } else {
      const now = Date.now();
      for (const w of this.ctx.getWebSockets('pending')) { const a = w.deserializeAttachment() || {}; if (a.role === 'pending' && now - a.born > 10000) { try { w.close(4001, 'auth timeout'); } catch { /* gone */ } } }
      if (this.hosts().length >= 6) return new Response('Too many host connections', { status: 503 });
    }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1], [role]);
    pair[1].serializeAttachment({ role, ip, voter: null, name: '', win: Date.now(), cnt: 0, born: Date.now() });
    this.ips.set(ip, (this.ips.get(ip) || 0) + 1);
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  send(ws, o) { try { ws.send(typeof o === 'string' ? o : json(o)); } catch { /* closed */ } }

  async webSocketMessage(ws, raw) {
    await this.load();
    if (typeof raw !== 'string') return ws.close(1003, 'text only');
    const att = ws.deserializeAttachment() || {};
    if (raw.length > (att.role === 'host' ? MAX_HOST_MSG : MAX_MSG)) return ws.close(1009, 'too big');
    const now = Date.now();
    if (now - att.win > RATE_WINDOW) { att.win = now; att.cnt = 0; }
    if (++att.cnt > RATE_MAX && att.role !== 'host') return ws.close(1008, 'rate limit');
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (att.role === 'pending') {
      if (m.t === 'auth' && safeEqual(m.key, this.env.HOST_KEY)) {
        att.role = 'host'; ws.serializeAttachment(att);
        this.send(ws, { t: 'authed', now: Date.now() });
        return this.pushHost();
      }
      this.send(ws, { t: 'denied' });
      return ws.close(4003, 'denied');
    }
    ws.serializeAttachment(att);
    if (att.role === 'host') return this.hostMsg(ws, m);
    return this.audMsg(ws, att, m);
  }

  async webSocketClose(ws, code, reason) {
    const a = ws.deserializeAttachment() || {};
    if (a.ip && this.ips) this.ips.set(a.ip, Math.max(0, (this.ips.get(a.ip) || 1) - 1));
    try { ws.close(code, reason); } catch { /* already closed */ }
    this.schedulePush();
  }
  async webSocketError(ws) { this.schedulePush(); }

  hosts() { return this.ctx.getWebSockets('pending').filter((w) => (w.deserializeAttachment() || {}).role === 'host'); }
  audience() { return this.ctx.getWebSockets('aud'); }

  // ---------------------------------------------------------------- audience
  async audMsg(ws, att, m) {
    if (m.t === 'hello') {
      if (!att.voter) {   // a socket gets exactly one identity
        att.voter = String(m.voter || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40) || rid();
        if (m.name) att.name = this.nick(m.name);
        ws.serializeAttachment(att);
        if (att.name && this.scores[att.voter] && !this.scores[att.voter].hideName) { this.scores[att.voter].n = att.name; this.markDirty('scores'); }
        this.schedulePush();
      }
      this.send(ws, await this.stateFor(att));
      if (this.meta) this.send(ws, { t: 'qa', list: this.qaPublic(), open: !!this.meta.qaOpen });
      return;
    }
    if (!att.voter || !this.meta) return this.send(ws, { t: 'state', live: false });
    if (m.t === 'name') {
      att.name = this.nick(m.name); ws.serializeAttachment(att);
      const sc = this.scores[att.voter];
      if (sc && !sc.hideName) { sc.n = att.name; this.markDirty('scores'); }
      return this.send(ws, { t: 'named', name: att.name });
    }
    if (m.t === 'answer') return this.answer(ws, att, m);
    if (m.t === 'ask') return this.ask(ws, att, m);
    if (m.t === 'upvote') return this.upvote(ws, att, m);
  }

  nick(s) { const n = clean(s, 24); return n && !blocked(n) ? n : ''; }

  async answer(ws, att, m) {
    const i = this.meta.cur, it = this.item();
    if (!it || m.i !== i || this.meta.status !== 'open') return this.send(ws, { t: 'closed', i: m.i });
    if (it.type === 'quiz' && Date.now() - (this.meta.openedAt || 0) > (it.seconds || 30) * 1000 + 1500) return this.send(ws, { t: 'closed', i });
    const st = await this.itemState(i);
    const prev = st.answers.get(att.voter);
    let val;
    if (it.type === 'poll' || it.type === 'scale' || it.type === 'quiz') {
      const k = Number(m.v);
      if (!Number.isInteger(k) || k < 0 || k >= it.options.length) return;
      if (it.type === 'quiz' && prev) return this.send(ws, { t: 'ack', i, v: prev.v, locked: true });
      if (prev && prev.v === k) return this.send(ws, { t: 'ack', i, v: k });
      val = { v: k, ms: Date.now() - (this.meta.openedAt || Date.now()) };
    } else if (it.type === 'multi') {
      if (!Array.isArray(m.v)) return;
      const ks = [...new Set(m.v.map(Number))].filter((k) => Number.isInteger(k) && k >= 0 && k < it.options.length).sort();
      if (!ks.length) return;
      val = { v: ks };
    } else if (it.type === 'cloud') {
      if (prev) return this.send(ws, { t: 'ack', i, v: prev.v, locked: true });
      const list = [...new Set((Array.isArray(m.v) ? m.v : [m.v]).slice(0, it.entries || 1).map((s) => word(s, it.words || 1)).filter((w) => w && !blocked(w)))];
      if (!list.length) return this.send(ws, { t: 'rejected' });
      val = { v: list };
    } else if (it.type === 'wall') {
      const text = clean(m.v, it.max || 200);
      if (!text) return;
      if (blocked(text)) return this.send(ws, { t: 'rejected' });
      val = { v: text, ts: prev?.ts || Date.now() };
    } else return;
    st.answers.set(att.voter, val);
    st.agg = this.aggregate(it, st.answers);
    try { await this.ctx.storage.put(`a:${i}:${att.voter}`, val); } catch (e) { console.error('answer write failed', e); }
    this.schedulePush();
    this.send(ws, { t: 'ack', i, v: val.v });
  }

  async ask(ws, att, m) {
    if (!this.meta.qaOpen) return this.send(ws, { t: 'closed' });
    const text = clean(m.text, 280);
    if (!text) return;
    if (blocked(text)) return this.send(ws, { t: 'rejected' });
    if (this.qa.filter((q) => q.by === att.voter).length >= 5 || this.qa.length >= 400) return this.send(ws, { t: 'slow' });
    const moderate = this.meta.qaModerate !== false;
    this.qa.push({ id: rid(), text, by: att.voter, up: [], hidden: false, pending: moderate, done: false, ts: Date.now() });
    this.markDirty('qa'); this.schedulePush(); if (!moderate) this.pushQA();
    this.send(ws, { t: 'asked', moderated: moderate });
  }

  upvote(ws, att, m) {
    const q = this.qa.find((x) => x.id === m.id);
    if (!q || q.hidden || q.pending || q.by === att.voter) return;
    const k = q.up.indexOf(att.voter);
    if (k >= 0) q.up.splice(k, 1); else if (q.up.length < 5000) q.up.push(att.voter);
    this.markDirty('qa'); this.schedulePush(); this.pushQA();
  }

  qaVisible() { return this.qa.filter((q) => !q.hidden && !q.pending).sort((a, b) => b.up.length - a.up.length || a.ts - b.ts); }
  qaPublic() { return this.qaVisible().slice(0, 30).map((q) => ({ id: q.id, text: q.text, up: q.up.length, done: q.done })); }

  pushQA() {
    if (this.qaTimer) return;
    this.qaTimer = setTimeout(() => {
      this.qaTimer = null;
      if (!this.meta) return;
      const msg = json({ t: 'qa', list: this.qaPublic(), open: !!this.meta.qaOpen });
      for (const ws of this.audience()) this.send(ws, msg);
    }, 1500);
  }

  publicItem(i) {
    const it = this.item(i);
    if (!it) return null;
    const p = { type: it.type, prompt: it.prompt, sub: it.sub || '', options: it.options || null, words: it.words || 1, entries: it.entries || 1, max: it.max || 200, seconds: it.seconds || 0, section: it.section || '' };
    if (this.meta.status === 'revealed' && Number.isInteger(it.answer)) p.answer = it.answer;
    if (it.type === 'quiz' && this.meta.status === 'open') p.left = Math.max(0, (it.seconds || 30) * 1000 - (Date.now() - (this.meta.openedAt || Date.now())));
    return p;
  }

  topWords(st, k) {
    const hid = new Set(st.hidden);
    return Object.entries(st.agg.words || {}).filter(([w]) => !hid.has(w)).sort((a, b) => b[1] - a[1]).slice(0, k);
  }

  ranked() {
    const arr = Object.entries(this.scores).sort((a, b) => b[1].s - a[1].s);
    let r = 0, prev = null;
    return arr.map(([v, x], idx) => { if (x.s !== prev) { r = idx + 1; prev = x.s; } return { v, r, n: (!x.hideName && x.n) || `Player ${v.slice(-4).toUpperCase()}`, s: x.s }; });
  }

  async baseState() {
    if (!this.meta) return { t: 'state', live: false };
    const i = this.meta.cur, it = this.item(), st = await this.itemState(i);
    const base = { t: 'state', live: true, i, total: this.meta.deck.length, status: this.meta.status, item: this.publicItem(i), qaOpen: !!this.meta.qaOpen, qaModerate: this.meta.qaModerate !== false };
    const show = this.meta.results || this.meta.status === 'revealed' || it?.type === 'leaderboard';
    if (show && it) {
      if (st.agg.counts) base.results = { n: st.agg.n, counts: st.agg.counts };
      else if (it.type === 'cloud') base.results = { n: st.agg.n, words: this.topWords(st, 60) };
      else if (it.type === 'leaderboard') base.results = { top: this.ranked().slice(0, 10).map(({ r, n, s }) => ({ r, n, s })) };
    }
    return base;
  }

  personalize(base, att, st, ranks) {
    if (!base.live) return base;
    const out = { ...base, mine: st.answers.has(att.voter) ? st.answers.get(att.voter).v : null };
    const sc = this.scores[att.voter];
    if (sc) { out.score = sc.s; out.rank = ranks ? ranks.get(att.voter) : null; out.last = sc.items && sc.items[base.i] !== undefined ? sc.items[base.i] : null; }
    return out;
  }

  async stateFor(att) {
    const base = await this.baseState();
    if (!base.live) return base;
    const st = await this.itemState(this.meta.cur);
    const ranks = this.scores[att.voter] ? new Map(this.ranked().map((x) => [x.v, x.r])) : null;
    return this.personalize(base, att, st, ranks);
  }

  async broadcastState() {
    const base = await this.baseState();
    const sockets = this.audience();
    if (!base.live) { const s = json(base); for (const ws of sockets) this.send(ws, s); return; }
    const st = await this.itemState(this.meta.cur);
    const ranks = new Map(this.ranked().map((x) => [x.v, x.r]));
    for (const ws of sockets) this.send(ws, this.personalize(base, ws.deserializeAttachment() || {}, st, ranks));
  }

  // ---------------------------------------------------------------- host
  async hostMsg(ws, m) {
    const s = this.ctx.storage;
    if (!this.meta && !['deck', 'pull', 'wipe'].includes(m.t)) return this.send(ws, { t: 'error', msg: 'No session loaded.' });
    switch (m.t) {
      case 'deck': {
        const deck = this.validDeck(m.deck);
        if (!deck) return this.send(ws, { t: 'error', msg: 'That session file is not valid.' });
        if (this.meta && !m.force) return this.send(ws, { t: 'confirm', msg: 'A session is already running in this room.' });
        await s.deleteAll();
        this.items = new Map(); this.scores = {}; this.qa = [];
        this.meta = { deck, title: clean(m.title, 200), cur: 0, status: 'closed', results: false, qaOpen: true, qaModerate: m.qaModerate !== false, openedAt: 0, created: Date.now() };
        await s.put('meta', this.meta);
        await s.setAlarm(Date.now() + RETAIN_MS);
        await this.itemState(0);
        await this.broadcastState();
        break;
      }
      case 'go': {
        const i = Math.max(0, Math.min(this.meta.deck.length - 1, Number(m.i) | 0));
        await this.flush();
        this.meta.cur = i; this.meta.results = false;
        const it = this.item(i), st = await this.itemState(i);
        const interactive = it && !['title', 'leaderboard', 'qa'].includes(it.type);
        this.meta.status = st.scored ? 'revealed' : interactive && m.open !== false ? 'open' : 'closed';
        if (this.meta.status === 'open') this.meta.openedAt = Date.now();
        this.markDirty('meta');
        await this.broadcastState();
        break;
      }
      case 'open': {
        const st = await this.itemState(this.meta.cur);
        if (st.scored) return this.send(ws, { t: 'error', msg: 'This quiz question was already scored. Reset it to run it again.' });
        this.meta.status = 'open'; this.meta.openedAt = Date.now(); this.markDirty('meta'); await this.broadcastState(); break;
      }
      case 'close': if (this.meta.status === 'open') this.meta.status = 'closed'; this.markDirty('meta'); await this.broadcastState(); break;
      case 'reveal': {
        this.meta.status = 'revealed'; this.markDirty('meta');
        if (this.item()?.type === 'quiz') await this.score(this.meta.cur);
        await this.broadcastState();
        break;
      }
      case 'results': this.meta.results = !!m.on; this.markDirty('meta'); await this.broadcastState(); break;
      case 'qaOpen': this.meta.qaOpen = !!m.on; this.markDirty('meta'); this.pushQA(); await this.broadcastState(); break;
      case 'qaModerate': this.meta.qaModerate = !!m.on; this.markDirty('meta'); break;
      case 'hideWord': case 'hideEntry': {
        const st = await this.itemState(this.meta.cur), v = String(m.w ?? m.v ?? '').slice(0, 40);
        if (v && !st.hidden.includes(v)) { st.hidden.push(v); this.markDirty(`x:${this.meta.cur}`); }
        break;
      }
      case 'hideName': { const sc = this.scores[m.v]; if (sc) { sc.hideName = !sc.hideName; this.markDirty('scores'); } break; }
      case 'qaApprove': { const q = this.qa.find((x) => x.id === m.id); if (q) { q.pending = false; this.markDirty('qa'); this.pushQA(); } break; }
      case 'qaHide': { const q = this.qa.find((x) => x.id === m.id); if (q) { q.hidden = !q.hidden; q.pending = false; this.markDirty('qa'); this.pushQA(); } break; }
      case 'qaDone': { const q = this.qa.find((x) => x.id === m.id); if (q) { q.done = !q.done; this.markDirty('qa'); this.pushQA(); } break; }
      case 'resetItem': {
        const i = this.meta.cur, st = await this.itemState(i);
        const keys = [...st.answers.keys()].map((v) => `a:${i}:${v}`);
        for (let k = 0; k < keys.length; k += 128) await s.delete(keys.slice(k, k + 128));
        for (const sc of Object.values(this.scores)) if (sc.items && sc.items[i] !== undefined) { sc.s -= sc.items[i]; delete sc.items[i]; }
        this.items.set(i, { answers: new Map(), hidden: [], scored: false, agg: this.aggregate(this.item(i), new Map()) });
        if (this.meta.status === 'revealed') this.meta.status = 'closed';
        this.markDirty(`x:${i}`); this.markDirty('scores'); this.markDirty('meta');
        await this.broadcastState();
        break;
      }
      case 'wipe': await this.wipe(); break;
      case 'pull': break;
      default: return;
    }
    this.pushHost();
  }

  async wipe() {
    for (const w of this.audience()) this.send(w, { t: 'state', live: false });
    this.meta = null; this.items = new Map(); this.scores = {}; this.qa = []; this.dirty.clear();
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
  }

  async alarm() { await this.load(); if (this.meta && Date.now() - this.meta.created >= RETAIN_MS - 60000) { await this.wipe(); this.pushHost(); } }

  validDeck(d) {
    if (!Array.isArray(d) || !d.length || d.length > 120) return null;
    const out = [];
    for (const x of d) {
      if (!x || !TYPES.has(x.type)) return null;
      const it = { type: x.type, prompt: clean(x.prompt, 300), sub: clean(x.sub, 400), section: clean(x.section, 80), notes: clean(x.notes, 2000), hide: !!x.hide };
      if (['poll', 'multi', 'quiz'].includes(x.type)) {
        if (!Array.isArray(x.options) || x.options.length < 2 || x.options.length > 8) return null;
        it.options = x.options.map((o) => clean(o, 220));
        if (x.type !== 'multi' && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < it.options.length) it.answer = x.answer;
        if (x.type === 'quiz') { if (!Number.isInteger(it.answer)) return null; it.seconds = Math.max(5, Math.min(120, Number(x.seconds) || 30)); }
      }
      if (x.type === 'scale') it.options = (Array.isArray(x.options) && x.options.length >= 2 ? x.options : ['1', '2', '3', '4', '5']).slice(0, 10).map((o) => clean(o, 40));
      if (x.type === 'cloud') { it.words = Math.max(1, Math.min(3, Number(x.words) || 1)); it.entries = Math.max(1, Math.min(3, Number(x.entries) || 1)); }
      if (x.type === 'wall') it.max = Math.max(20, Math.min(400, Number(x.max) || 200));
      out.push(it);
    }
    return out;
  }

  async score(i) {
    const it = this.item(i), st = await this.itemState(i);
    if (!it || st.scored) return;
    const limit = (it.seconds || 30) * 1000;
    const names = new Map();
    for (const ws of this.audience()) { const a = ws.deserializeAttachment() || {}; if (a.voter && a.name) names.set(a.voter, a.name); }
    for (const [v, val] of st.answers) {
      const p = val.v === it.answer ? Math.round(500 + 500 * Math.max(0, 1 - (val.ms ?? limit) / limit)) : 0;
      const sc = this.scores[v] || (this.scores[v] = { n: '', s: 0, items: {} });
      sc.items = sc.items || {};
      if (names.get(v) && !sc.hideName) sc.n = names.get(v);
      sc.s += p; sc.items[i] = p;
    }
    st.scored = true;
    this.markDirty(`x:${i}`); this.markDirty('scores');
  }

  schedulePush() {
    if (this.pushTimer) return;
    this.pushTimer = setTimeout(() => { this.pushTimer = null; this.pushHost(); }, PUSH_MS);
  }

  async pushHost() {
    const hosts = this.hosts();
    if (!hosts.length) return;
    const msg = { t: 'host', now: Date.now(), live: !!this.meta, participants: this.audience().length };
    if (this.meta) {
      const i = this.meta.cur, it = this.item(), st = await this.itemState(i);
      msg.title = this.meta.title || '';
      msg.meta = { cur: i, status: this.meta.status, results: this.meta.results, qaOpen: this.meta.qaOpen, qaModerate: this.meta.qaModerate !== false, openedAt: this.meta.openedAt, total: this.meta.deck.length, expires: this.meta.created + RETAIN_MS };
      msg.deck = this.meta.deck.map((d) => ({ type: d.type, prompt: d.prompt, section: d.section }));
      msg.item = it;
      msg.agg = { n: st.agg.n, counts: st.agg.counts || null, hidden: st.hidden, scored: st.scored };
      if (it?.type === 'cloud') msg.agg.words = this.topWords(st, 80);
      if (it?.type === 'wall') {
        const hid = new Set(st.hidden);
        msg.agg.entries = [...st.answers].filter(([v]) => !hid.has(v)).map(([v, a]) => ({ id: v, text: a.v, ts: a.ts || 0 })).sort((a, b) => a.ts - b.ts).slice(-300);
      }
      msg.top = this.ranked().slice(0, 10);
      msg.qa = this.qaVisible().slice(0, 40).map((q) => ({ id: q.id, text: q.text, up: q.up.length, done: q.done }));
      msg.qaPending = this.qa.filter((q) => q.pending && !q.hidden).slice(0, 40).map((q) => ({ id: q.id, text: q.text }));
      msg.qaHidden = this.qa.filter((q) => q.hidden).length;
    }
    const s = json(msg);
    for (const ws of hosts) this.send(ws, s);
  }
}
