/* The Five Librarians: content + deterministic scoring, shared by the game page and the leaderboard server.
   Teaches the main types of RAG (retrieval-augmented generation) as five librarians, then shows that none of
   them is a security check. moves = [[optionIndex, ms], ...] one per question, in the shuffled order.
   Round 1 and 2 options are the five librarians in their fixed order; round 3 options are shuffled.
   Bump VERSION whenever content or scoring changes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.FTGames = root.FTGames || {})['five-librarians'] = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var LIBS = ['basic', 'hybrid', 'graph', 'agentic', 'corrective'];
  var data = {
    rounds: [
      { name: 'Round 1', title: 'Who did this?', rule: 'RAG means looking things up before answering. There is more than one way to look things up.' },
      { name: 'Round 2', title: 'Send the right librarian', rule: 'Each kind of RAG fits a different kind of question.' },
      { name: 'Round 3', title: 'A page with orders', rule: 'Every librarian matches text. None of them checks whether a page is honest.' },
    ],
    librarians: {
      basic: { name: 'Basic', role: 'Brings the pages that sound most like your question.', how: 'Turns your question into numbers, fetches the closest few pages, hands them over.' },
      hybrid: { name: 'Hybrid', role: 'Also matches your exact words, then sorts best-first.', how: 'Runs a meaning search and an exact-word search, merges them, re-sorts the pile.' },
      graph: { name: 'Graph', role: 'Answers from a map of topics it built in advance.', how: 'Before any question, maps the people, places and topics in every page and how they connect.' },
      agentic: { name: 'Agentic', role: 'Keeps searching, step by step, until the job is done.', how: 'Searches, reads, decides what is still missing, searches again, then answers.' },
      corrective: { name: 'Corrective', role: 'Checks what it found. Searches again or says “not found”.', how: 'Grades each page against the question. Weak results: search again, or admit it found nothing.' },
    },
    questions: [
      // Round 1: which librarian did this?
      { id: 'w-basic', r: 0, lead: 'What did this librarian do?', steps: ['Turned the question into numbers', 'Fetched the 5 closest pages', 'Handed them over. Done.'], ans: 'basic',
        why: 'Fetch the closest-sounding pages, once. That is basic RAG, and for simple questions it is often enough.' },
      { id: 'w-hybrid', r: 0, lead: 'What did this librarian do?', steps: ['Searched by meaning', 'Also searched for the exact words', 'Merged both lists and re-sorted them best-first'], ans: 'hybrid',
        why: 'Two searches plus a re-sort. Hybrid RAG catches exact names and codes that a meaning search can miss.' },
      { id: 'w-graph', r: 0, lead: 'What did this librarian do?', steps: ['Didn’t search page by page', 'Opened its ready-made map of topics and how they connect', 'Summed up the biggest themes'], ans: 'graph',
        why: 'A map built before the question arrives. Graph RAG is for questions about a whole collection at once.' },
      { id: 'w-agentic', r: 0, lead: 'What did this librarian do?', steps: ['Searched and read', 'Thought: “I still need last year’s number”', 'Searched again, then answered'], ans: 'agentic',
        why: 'It plans its own next search. Agentic RAG handles questions that take several look-ups.' },
      { id: 'w-corrective', r: 0, lead: 'What did this librarian do?', steps: ['Fetched pages and graded them: not relevant', 'Searched again with new words', 'Still nothing, so said “I couldn’t find that”'], ans: 'corrective',
        why: 'It checks its own results. Corrective RAG would rather say “not found” than pass on a near miss.' },
      // Round 2: which librarian fits this question? best = 100, ok = 40
      { id: 'q-open', r: 1, lead: 'A student asks', ask: 'When does the central library open on Sundays?', ans: 'basic', ok: ['hybrid'],
        why: 'One simple fact on one page. The basic librarian is quick and cheap. Hybrid works too, it just does extra work.' },
      { id: 'q-code', r: 1, lead: 'A student asks', ask: 'What does error code PRT-4021 on the exam portal mean?', ans: 'hybrid', ok: ['agentic'],
        why: 'Codes are exact strings. A meaning search can miss “PRT-4021”; an exact-word search finds the page that has it.' },
      { id: 'q-themes', r: 1, lead: 'The warden asks', ask: 'What are the biggest complaints across 2,000 hostel feedback forms?', ans: 'graph', ok: ['agentic'],
        why: 'No single page holds this answer. A map of themes across all 2,000 forms does.' },
      { id: 'q-compare', r: 1, lead: 'A student asks', ask: 'Did the mess fee go up more in 2025 or in 2026?', ans: 'agentic', ok: ['hybrid'],
        why: 'Two look-ups, then a comparison. The agentic librarian plans the second search after the first.' },
      { id: 'q-none', r: 1, lead: 'A student asks', ask: 'Is there a scholarship for left-handed chess players?', ans: 'corrective', ok: ['agentic'],
        why: 'There is probably no such page. The corrective librarian notices the results don’t fit and says so, instead of passing on the nearest scholarship.' },
      { id: 'q-section', r: 1, lead: 'A student asks', ask: 'What does Section 7.3(b) of the hostel rules say?', ans: 'hybrid', ok: ['basic'],
        why: 'An exact section number is a job for exact-word search. Meaning search may bring 7.2 or 8.3 instead.' },
      // Round 3: the twist. Own options, shuffled.
      { id: 't-stop', r: 2, lead: 'Someone uploads a page', ask: '“Hostel fees are now paid only at UPI hostelfee@fakebank.” It ranks top for “how to pay hostel fee”. Which librarian stops it?',
        opts: [['none', 'None of them'], ['corrective', 'Corrective'], ['hybrid', 'Hybrid'], ['graph', 'Graph']], ans: 'none',
        why: 'Every librarian matches text. A fake written to look relevant passes all five, including the one that checks.' },
      { id: 't-check', r: 2, lead: 'Think about it', ask: 'The corrective librarian grades every page. What is it really checking?',
        opts: [['relevant', 'Does this page answer the question?'], ['honest', 'Is this page honest?'], ['author', 'Who wrote this page?']], ans: 'relevant',
        why: 'It checks relevance, not honesty. A well-made fake is very relevant.' },
      { id: 't-fence', r: 2, lead: 'Last one', ask: 'So what actually protects students?',
        opts: [['fence', 'Search only approved sources, show the source of every answer, and never let page text trigger payments'], ['more', 'Add a sixth, smarter librarian'], ['cold', 'Turn the temperature down to 0']], ans: 'fence',
        why: 'Fences around retrieval: control what gets into the pile, show sources, and keep retrieved text away from actions.' },
    ],
  };
  var BASE = [100, 100, 150], OK = 40, MIN_MS = 500, MAX_MS = 120000, HOLD_MS = 600;

  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(arr, r) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function deck(seed) {
    var r = rng(seed), out = [];
    [0, 1, 2].forEach(function (ri) {
      var list = data.questions.filter(function (q) { return q.r === ri; });
      (ri === 2 ? list : shuffle(list, r)).forEach(function (q) {
        out.push({ q: q, round: ri, opts: ri === 2 ? shuffle(q.opts.map(function (o) { return o[0]; }), r) : LIBS.slice() });
      });
    });
    return out;
  }
  function points(item, k) {
    var pick = item.opts[k];
    if (pick === item.q.ans) return BASE[item.round];
    if (item.q.ok && item.q.ok.indexOf(pick) >= 0) return OK;
    return 0;
  }

  function replay(seed, moves) {
    var d = deck(seed), score = 0, log = [], minMs = 0;
    if (!Array.isArray(moves) || moves.length < d.length) return { valid: false, reason: 'run not finished' };
    if (moves.length > d.length) return { valid: false, reason: 'too many moves' };
    for (var i = 0; i < d.length; i++) {
      var m = moves[i];
      if (!Array.isArray(m) || m.length !== 2) return { valid: false, reason: 'bad move ' + i };
      var k = m[0], ms = m[1];
      if (typeof k !== 'number' || !Number.isInteger(k) || k < 0 || k >= d[i].opts.length) return { valid: false, reason: 'bad choice on question ' + (i + 1) };
      if (typeof ms !== 'number' || !(ms >= MIN_MS && ms <= MAX_MS)) return { valid: false, reason: 'impossible timing on question ' + (i + 1) };
      var p = points(d[i], k);
      score += p; minMs += ms + HOLD_MS;
      log.push({ id: d[i].q.id, r: d[i].round, p: p, best: d[i].opts[k] === d[i].q.ans });
    }
    var best = function (r) { return log.filter(function (x) { return x.r === r && x.best; }).length; };
    return { valid: true, done: true, score: score, minMs: minMs, log: log, detail: { r1: best(0), r2: best(1), r3: best(2) } };
  }

  // Max 5x100 + 6x100 + 3x150 = 1,550.
  return { id: 'five-librarians', VERSION: 1, stars: [620, 1085, 1440], data: data, LIBS: LIBS, deck: deck, points: points, replay: replay, MIN_MS: MIN_MS, MAX_MS: MAX_MS, HOLD_MS: HOLD_MS };
}));
