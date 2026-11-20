// Check a session file before the talk:  node check-session.js "../../live-sessions/my-talk.md"
// Prints the outline (type, prompt, answer) and any errors. Exit code 1 if the file has errors.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { parse } = require('../live/deck-format.js');

const file = process.argv[2];
if (!file) { console.error('Usage: node check-session.js <session.md|session.json>'); process.exit(2); }
const deck = parse(readFileSync(file, 'utf8'), file);
console.log(`${deck.title || '(no title)'} · room ${deck.room || '(none: choose it in the console)'} · ${deck.items.length} items\n`);
let sec = null;
deck.items.forEach((it, k) => {
  if (it.section !== sec) { sec = it.section; console.log(`  ${sec || '(no section)'}`); }
  const ans = typeof it.answer === 'number' ? `  → ${String.fromCharCode(65 + it.answer)}` : '';
  console.log(`    ${String(k + 1).padStart(2)}. ${it.type.padEnd(11)} ${it.prompt.slice(0, 70)}${it.prompt.length > 70 ? '…' : ''}${ans}`);
});
const counts = deck.items.reduce((m, it) => ((m[it.type] = (m[it.type] || 0) + 1), m), {});
console.log('\n  ' + Object.entries(counts).map(([t, n]) => `${n} ${t}`).join(', '));
if (deck.errors.length) { console.log('\nERRORS:\n  ' + deck.errors.join('\n  ')); process.exit(1); }
console.log('\nOK: no errors.');
