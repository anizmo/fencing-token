// Load test: N simulated participants + 1 host run through a poll, multi, cloud, wall, quiz and Q&A,
// then checks every count adds up. Needs Node 18+ and `npm install` (for the ws package).
//
//   node loadtest.js <wss://your-worker.workers.dev> <HOST_KEY> [participants=1000] [room=LOADTEST]
//
// Uses room LOADTEST by default, so it never touches your real session room. It wipes that room at the end.
// All simulated people come from your one IP, so deploy with a higher per-IP cap first:
//   npx wrangler deploy --var MAX_PER_IP:5000   (then run `npx wrangler deploy` again afterwards to restore the cap)
import WebSocket from 'ws';
const [, , API = 'ws://localhost:8787', KEY = 'dev-key-0123456789abcdef0123456789abcdef', N0 = '1000', ROOM = 'LOADTEST'] = process.argv;
const N = Number(N0);
const ORIGIN = API.startsWith('ws://localhost') ? 'http://localhost:8788' : 'https://fencingtoken.com';
const url = (role) => `${API.replace(/\/$/, '')}/room/${ROOM}${role ? '?role=host' : ''}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const deck = [
  { type: 'title', prompt: 'Load test' },
  { type: 'poll', prompt: 'Pick one', options: ['A', 'B', 'C'], answer: 2 },
  { type: 'multi', prompt: 'Pick any', options: ['X', 'Y', 'Z', 'W'] },
  { type: 'cloud', prompt: 'One word', words: 1 },
  { type: 'wall', prompt: 'Say something', max: 120 },
  { type: 'quiz', prompt: 'Quiz', options: ['no', 'yes'], answer: 1, seconds: 20 },
  { type: 'leaderboard', prompt: 'Leaderboard' },
];

function open(u, onmsg) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(u, { origin: ORIGIN });
    const t = setTimeout(() => rej(new Error('connect timeout')), 20000);
    ws.on('open', () => { clearTimeout(t); res(ws); });
    ws.on('error', (e) => { clearTimeout(t); rej(e); });
    ws.on('message', (d) => onmsg(JSON.parse(String(d))));
  });
}

let hostState = null;
const host = await open(url(true), (m) => { if (m.t === 'host') hostState = m; if (m.t === 'error') console.log('host error:', m.msg); });
const H = (o) => host.send(JSON.stringify(o));
H({ t: 'auth', key: KEY });
await sleep(500);
H({ t: 'wipe' }); await sleep(500);
H({ t: 'deck', deck }); await sleep(800);
if (!hostState?.live) { console.error('FAIL: deck did not load (wrong HOST_KEY?)'); process.exit(1); }

console.log(`connecting ${N} participants…`);
const t0 = Date.now();
const people = [];
let states = 0, acks = 0;
for (let k = 0; k < N; k++) {
  const p = { voter: `lt${k}x${Math.random().toString(36).slice(2, 8)}`, state: null };
  people.push(p);
  open(url(false), (m) => { if (m.t === 'state') { p.state = m; states++; } if (m.t === 'ack') acks++; })
    .then((ws) => { p.ws = ws; ws.send(JSON.stringify({ t: 'hello', voter: p.voter, name: `Tester ${k}` })); })
    .catch((e) => { p.err = e; });
  if (k % 50 === 49) await sleep(100);
}
for (let w = 0; w < 120 && people.filter((p) => p.ws || p.err).length < N; w++) await sleep(250);
await sleep(1500);
const failed = people.filter((p) => p.err).length;
console.log(`connected ${N - failed}/${N} in ${((Date.now() - t0) / 1000).toFixed(1)}s; host sees ${hostState.participants}`);
const live = people.filter((p) => p.ws);

async function step(i, answerFn, label, expect) {
  H({ t: 'go', i }); await sleep(1200);
  const a0 = acks;
  live.forEach((p, k) => { const v = answerFn(k); if (v !== undefined) p.ws.send(JSON.stringify({ t: 'answer', i, v })); });
  for (let w = 0; w < 60 && acks - a0 < live.length; w++) await sleep(250);
  await sleep(1200);
  H({ t: 'pull' }); await sleep(800);
  const got = hostState.agg;
  const ok = expect(got);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}: acks ${acks - a0}/${live.length}, n=${got.n}`, got.counts ? `counts=${JSON.stringify(got.counts)}` : '', got.words ? `top=${JSON.stringify(got.words.slice(0, 3))}` : '', got.entries ? `entries=${got.entries.length}` : '');
  return ok;
}

const L = live.length;
let pass = true;
pass &= await step(1, (k) => k % 3, 'poll', (g) => g.n === L && g.counts.reduce((a, b) => a + b, 0) === L);
pass &= await step(2, (k) => [k % 4, (k + 1) % 4], 'multi', (g) => g.n === L && g.counts.reduce((a, b) => a + b, 0) === 2 * L);
pass &= await step(3, (k) => ['curious', 'Suspicious!', 'frustrated'][k % 3], 'cloud', (g) => g.n === L && g.words.some(([w]) => w === 'suspicious'));
pass &= await step(4, (k) => `answer number ${k}`, 'wall', (g) => g.n === L && g.entries.length === Math.min(L, 300));
pass &= await step(5, (k) => (k % 2), 'quiz', (g) => g.n === L);
H({ t: 'reveal' }); await sleep(2500);
const scored = live.filter((p) => p.state && p.state.status === 'revealed' && typeof p.state.score === 'number').length;
console.log(`${scored >= L * 0.98 ? 'PASS' : 'FAIL'} quiz reveal reached ${scored}/${L} phones with a score; top=${JSON.stringify(hostState.top.slice(0, 3))}`);
pass &= scored >= L * 0.98;

// Q&A: 50 questions, everyone upvotes the first
H({ t: 'pull' }); await sleep(300);
live.slice(0, 50).forEach((p, k) => p.ws.send(JSON.stringify({ t: 'ask', text: `Question ${k}?` })));
await sleep(2500); H({ t: 'pull' }); await sleep(800);
for (const q of hostState.qaPending || []) H({ t: 'qaApprove', id: q.id });
await sleep(1000); H({ t: 'pull' }); await sleep(800);
const qid = hostState.qa[0]?.id;
live.slice(50).forEach((p) => p.ws.send(JSON.stringify({ t: 'upvote', id: qid })));
await sleep(3000); H({ t: 'pull' }); await sleep(800);
const topUp = hostState.qa[0]?.up || 0;
console.log(`${hostState.qa.length >= 40 && topUp >= (L - 50) * 0.98 ? 'PASS' : 'FAIL'} Q&A: ${hostState.qa.length} shown, top upvotes ${topUp}`);
pass &= hostState.qa.length >= 40 && topUp >= (L - 50) * 0.98;

H({ t: 'go', i: 6 }); await sleep(1500);
console.log('leaderboard:', JSON.stringify(hostState.top.slice(0, 5)));
H({ t: 'wipe' }); await sleep(500);
live.forEach((p) => p.ws.close());
host.close();
console.log(pass ? '\nALL CHECKS PASSED' : '\nSOME CHECKS FAILED');
process.exit(pass ? 0 : 1);
