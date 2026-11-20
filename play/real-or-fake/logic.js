/* Real or Fake?: content + deterministic scoring, shared by the game page and the leaderboard server.
   A chatbot "said" each claim. The player swipes Real or Fake. Every real item is genuinely real and correctly
   described; every fake is invented (and never puts invented words in a living person's mouth).
   moves = [[choice, ms, checked], ...] one per card, in deck order.
     choice: 'R' (real) | 'F' (fake) | 'T' (time ran out); ms: time on the card; checked: 1 if a Check was used.
   Bump VERSION whenever content or scoring changes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.FTGames = root.FTGames || {})['real-or-fake'] = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var RULES = { PER_ROUND: 5, CHECKS: 3, MIN_T: 700, PAUSE: 600, BASE: [100, 150, 200], LIMIT: [15000, 18000, 20000] };
  var data = {
    rounds: [
      { name: 'Round 1', title: 'Warm-up', rule: 'Chatbots can invent things that sound real. One quick check catches most.' },
      { name: 'Round 2', title: 'Almost right', rule: 'One wrong detail (a year, a name, a journal) makes the whole thing false.' },
      { name: 'Round 3', title: 'Confident and cited', rule: 'Fluent is not true. A link or ID only counts if it leads to the claim.' },
    ],
    cards: [
      // ---------------------------------------------------------------- round 1: easy fakes
      { id: 'attn', r: 0, kind: 'Paper', ans: 'real',
        said: 'The “T” in ChatGPT stands for Transformer, from the 2017 paper “Attention Is All You Need” by Vaswani and others.',
        hint: 'arXiv 1706.03762: “Attention Is All You Need”, Vaswani et al., June 2017.',
        src: 'Real. Published at NeurIPS 2017 by a team at Google. GPT means Generative Pre-trained Transformer.',
        lesson: 'Real papers leave a trail: a venue, a year, an ID you can open.' },
      { id: 'chandrayaan', r: 0, kind: 'History', ans: 'real',
        said: 'Chandrayaan-3 landed near the Moon’s south pole on 23 August 2023.',
        hint: 'ISRO: the Vikram lander touched down on 23 August 2023.',
        src: 'Real. India became the first country to land near the Moon’s south pole.',
        lesson: 'Easy to check: one search, one official source.' },
      { id: 'everest', r: 0, kind: 'Statistic', ans: 'real',
        said: 'Mount Everest is 8,848.86 m tall, as measured by Nepal and China and announced in 2020.',
        hint: 'Nepal and China jointly announced 8,848.86 m in December 2020.',
        src: 'Real. That oddly exact number is the official height.',
        lesson: 'Exact numbers can be real too. The source decides, not the vibe.' },
      { id: 'kalam', r: 0, kind: 'Book', ans: 'real',
        said: '“Wings of Fire” is Dr A.P.J. Abdul Kalam’s autobiography, written with Arun Tiwari.',
        hint: 'Universities Press, 1999: “Wings of Fire” by A.P.J. Abdul Kalam with Arun Tiwari.',
        src: 'Real. It came out in 1999.',
        lesson: 'Publisher and year check out, so it holds up.' },
      { id: 'cats', r: 0, kind: 'Paper', ans: 'fake',
        said: '“Teaching Cats to Write Python” won Best Paper in the Journal of Feline Computing in 2019.',
        hint: 'Search: no journal by that name, and no such paper.',
        src: 'Fake. There is no Journal of Feline Computing. The chatbot just kept writing.',
        lesson: 'Formal words don’t make a source real.' },
      { id: 'tagore', r: 0, kind: 'Book', ans: 'fake',
        said: 'Rabindranath Tagore’s 1965 novel “The Silicon Garden” is about early computers.',
        hint: 'Rabindranath Tagore: born 1861, died 1941.',
        src: 'Fake. Tagore died in 1941, so he could not write a 1965 novel. No such book exists.',
        lesson: 'Check the dates. They often give a fake away.' },
      { id: 'spiders', r: 0, kind: 'Statistic', ans: 'fake',
        said: 'Studies show the average person swallows 8 spiders a year while asleep.',
        hint: 'Fact-checkers: no study has ever found this.',
        src: 'Fake. It is a famous myth with no study behind it. “Studies show” did all the work.',
        lesson: '“Studies show” with no study named is a red flag.' },
      { id: 'iphone', r: 0, kind: 'History', ans: 'fake',
        said: 'Apple released the very first iPhone in 1995.',
        hint: 'Apple: the first iPhone went on sale on 29 June 2007.',
        src: 'Fake. The first iPhone went on sale in 2007.',
        lesson: 'Models mix up dates all the time. Dates are cheap to check.' },

      // ---------------------------------------------------------------- round 2: plausible fakes
      { id: 'turing', r: 1, kind: 'Quote', ans: 'real',
        said: 'Alan Turing’s 1950 paper opens with: “I propose to consider the question, ‘Can machines think?’”',
        hint: '“Computing Machinery and Intelligence”, Mind, 1950. First line.',
        src: 'Real. Those are the opening words of Turing’s famous paper.',
        lesson: 'A real quote has a findable home: the paper, the page, the line.' },
      { id: 'robot', r: 1, kind: 'History', ans: 'real',
        said: 'The word “robot” comes from R.U.R., a 1920 play by the Czech writer Karel Čapek.',
        hint: '“R.U.R. (Rossum’s Universal Robots)”, Karel Čapek, written 1920.',
        src: 'Real. From the Czech “robota”, forced labour. Čapek credited his brother Josef with the word.',
        lesson: 'Surprising is not the same as fake.' },
      { id: 'dartmouth', r: 1, kind: 'History', ans: 'real',
        said: 'The term “artificial intelligence” was coined in a 1955 proposal for a summer workshop at Dartmouth.',
        hint: 'Proposal by McCarthy, Minsky, Rochester and Shannon, dated 31 August 1955.',
        src: 'Real. The workshop itself ran in the summer of 1956.',
        lesson: 'Real history has names and dates that agree across sources.' },
      { id: 'dpdp', r: 1, kind: 'Law', ans: 'real',
        said: 'India passed the Digital Personal Data Protection Act in 2023.',
        hint: 'Parliament passed the DPDP Act in August 2023.',
        src: 'Real. It is India’s main law on personal data.',
        lesson: 'Laws have official text. Read that, not someone’s summary.' },
      { id: 'chatgpt', r: 1, kind: 'Statistic', ans: 'real',
        said: 'ChatGPT reached an estimated 100 million monthly users about two months after launch.',
        hint: 'Reuters, February 2023, citing a UBS study: 100 million in January.',
        src: 'Real, as an estimate. UBS based it on web traffic data.',
        lesson: 'Good statistics say who measured, and how.' },
      { id: 'backprop', r: 1, kind: 'Paper', ans: 'fake',
        said: 'Rumelhart, Hinton and Williams published “Learning representations by back-propagating errors” in Nature in 1996.',
        hint: 'Nature, volume 323, pages 533–536 (1986).',
        src: 'Fake. Real authors, real title, real journal, wrong year: it was 1986.',
        lesson: 'One wrong detail breaks a citation. Check every part.' },
      { id: 'gandhi', r: 1, kind: 'History', ans: 'fake',
        said: 'Mahatma Gandhi won the Nobel Peace Prize in 1948.',
        hint: 'Nobel Prize website: nominated five times, never awarded.',
        src: 'Fake. Gandhi was nominated five times but never won. No Peace Prize was given in 1948.',
        lesson: 'It sounds right because it feels fair. That is not proof.' },
      { id: 'brain', r: 1, kind: 'Statistic', ans: 'fake',
        said: 'Brain scans show humans use only 10% of their brain.',
        hint: 'Neuroscientists: scans show activity across nearly the whole brain.',
        src: 'Fake. A popular myth. We use virtually all of it, just not all at once.',
        lesson: 'A claim repeated a million times is still not a source.' },
      { id: 'asimov', r: 1, kind: 'Book', ans: 'fake',
        said: 'Isaac Asimov’s Three Laws of Robotics first appeared in his 1985 novel “Robots and Empire”.',
        hint: '“Runaround”, a short story in Astounding Science Fiction, March 1942.',
        src: 'Fake. Real author, real book, wrong origin. The laws first appeared in his 1942 story “Runaround”.',
        lesson: 'Real names glued together can still make a false claim.' },
      { id: 'sensex', r: 1, kind: 'Paper', ans: 'fake',
        said: 'A 2021 paper in Nature showed a language model predicts the Sensex a week ahead with 94% accuracy.',
        hint: 'Search of Nature’s archive: no such paper.',
        src: 'Fake. Real journal, invented paper. Too-good numbers are a warning sign.',
        lesson: 'A famous journal’s name makes a fake feel safe.' },
      { id: 'einstein', r: 1, kind: 'Quote', ans: 'fake',
        said: 'Einstein said: “Insanity is doing the same thing over and over and expecting different results.”',
        hint: 'Quote Investigator: no evidence Einstein ever said it.',
        src: 'Fake attribution. There is no record of Einstein saying it. Similar lines appear around 1981, long after he died.',
        lesson: 'Famous name plus catchy line: check who really said it.' },

      // ---------------------------------------------------------------- round 3: the twist, confident detail and real-looking links
      { id: 'mata', r: 2, pin: 1, kind: 'Court case', ans: 'real',
        said: 'In Mata v. Avianca (New York, 2023), a judge fined two lawyers $5,000 for citing court cases that ChatGPT made up.',
        cite: 'Mata v. Avianca, Inc., No. 22-cv-1461 (S.D.N.Y. 2023)',
        hint: 'News reports, June 2023: lawyers sanctioned over ChatGPT-invented cases.',
        src: 'Real. In June 2023 the judge fined the lawyers and their firm $5,000. The fake cases looked perfect.',
        lesson: 'Even lawyers got fooled. Check every citation before you use it.' },
      { id: 'aircanada', r: 2, kind: 'Court case', ans: 'real',
        said: 'In 2024 a Canadian tribunal made Air Canada pay a passenger after its website chatbot gave him wrong fare advice.',
        cite: 'Moffatt v. Air Canada, 2024 BCCRT 149',
        hint: 'BC Civil Resolution Tribunal, decision of 14 February 2024.',
        src: 'Real. The chatbot got the bereavement-fare rule wrong. Air Canada had to pay him over C$800.',
        lesson: 'A company answers for what its chatbot says.' },
      { id: 'gpt3', r: 2, kind: 'Paper', ans: 'real',
        said: 'The GPT-3 paper is “Language Models are Few-Shot Learners” by Brown and others, 2020.',
        cite: 'arxiv.org/abs/2005.14165',
        hint: 'Opening the link: title, authors and year all match.',
        src: 'Real. The link opens the exact paper, by Tom Brown and 30 co-authors at OpenAI.',
        lesson: 'Open the link. Real citations match when you click.' },
      { id: 'alphafold', r: 2, kind: 'Paper', ans: 'real',
        said: 'AlphaFold’s 2021 Nature paper is “Highly accurate protein structure prediction with AlphaFold” by Jumper and others.',
        cite: 'doi.org/10.1038/s41586-021-03819-2',
        hint: 'The DOI opens Nature 596, 583–589 (2021). Exact match.',
        src: 'Real. Two of its authors, John Jumper and Demis Hassabis, later shared the 2024 Nobel Prize in Chemistry.',
        lesson: 'Long, ugly IDs are fine. What matters is that they lead to the paper.' },
      { id: 'varghese', r: 2, pin: 1, kind: 'Court case', ans: 'fake',
        said: 'Varghese v. China Southern Airlines held that the time limit to sue an airline can be paused.',
        cite: '925 F.3d 1339 (11th Cir. 2019)',
        hint: 'Court databases: no case by that name exists.',
        src: 'Fake. ChatGPT invented it, citation and all. Lawyers filed it in Mata v. Avianca and the judge found it did not exist.',
        lesson: 'A perfect-looking citation can still be invented.' },
      { id: 'upsc', r: 2, kind: 'Paper', ans: 'fake',
        said: 'A 2019 paper, “Language Models Pass the UPSC Prelims”, showed AI could clear India’s civil services exam.',
        cite: 'arxiv.org/abs/1907.11692',
        hint: 'The link opens “RoBERTa: A Robustly Optimized BERT Pretraining Approach”.',
        src: 'Fake. The link is real but leads to a different paper (RoBERTa). There is no such UPSC paper.',
        lesson: 'A real link is not proof. Check that it leads to the claim.' },
      { id: 'lancet', r: 2, kind: 'Paper', ans: 'fake',
        said: 'A 2023 Lancet study of 12,408 Indian students found chatbot use cut exam stress by 37%.',
        cite: 'doi.org/10.1016/S0140-6736(23)01942-7',
        hint: 'Opening the DOI: it does not lead to this study.',
        src: 'Fake. The DOI copies the Lancet’s format but does not lead to any such study. The exact numbers were invented.',
        lesson: 'Confident details like 12,408 and 37% are easy to invent.' },
      { id: 'rbi', r: 2, kind: 'Law', ans: 'fake',
        said: 'Since April 2024, RBI rules require a selfie check for every UPI payment over ₹2,000.',
        cite: 'RBI circular RBI/2023-24/117',
        hint: 'RBI website: no such rule.',
        src: 'Fake. No such rule exists. A circular number in the right format proves nothing.',
        lesson: 'Official-looking numbers are easy to fake. Go to the official site.' },
    ],
  };

  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(arr, r) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // 5 cards per round: 2 or 3 real, the rest fake; pinned cards always play. → [{card, round, limit}]
  function deck(seed) {
    var r = rng(seed), out = [];
    data.rounds.forEach(function (round, ri) {
      var nReal = 2 + Math.floor(r() * 2), pick = [];
      ['real', 'fake'].forEach(function (ans) {
        var want = ans === 'real' ? nReal : RULES.PER_ROUND - nReal;
        var pool = data.cards.filter(function (c) { return c.r === ri && c.ans === ans; });
        var pins = pool.filter(function (c) { return c.pin; }), rest = shuffle(pool.filter(function (c) { return !c.pin; }), r);
        pick = pick.concat(pins.concat(rest).slice(0, want));
      });
      shuffle(pick, r).forEach(function (c) { out.push({ card: c, round: ri, limit: RULES.LIMIT[ri] }); });
    });
    return out;
  }

  function points(round, streak) { return Math.round(RULES.BASE[round] * (1 + 0.1 * Math.min(streak, 5))); }

  function replay(seed, moves) {
    var d = deck(seed);
    if (!Array.isArray(moves)) return { valid: false, reason: 'no moves' };
    if (moves.length > d.length) return { valid: false, reason: 'too many moves' };
    var score = 0, streak = 0, checks = 0, minMs = 0, log = [], det = { right: 0, fooled: 0, doubted: 0, timeouts: 0, checks: 0, byRound: [0, 0, 0] };
    for (var i = 0; i < moves.length; i++) {
      var mv = moves[i], e = d[i];
      if (!Array.isArray(mv) || mv.length !== 3) return { valid: false, reason: 'bad move ' + i };
      var ch = mv[0], ms = mv[1], ck = mv[2];
      if ((ch !== 'R' && ch !== 'F' && ch !== 'T') || typeof ms !== 'number' || !isFinite(ms) || Math.floor(ms) !== ms || (ck !== 0 && ck !== 1)) return { valid: false, reason: 'bad move ' + i };
      if (ch === 'T' ? ms !== e.limit : (ms < RULES.MIN_T || ms > e.limit + 600)) return { valid: false, reason: 'impossible timing on card ' + (i + 1) };
      checks += ck; if (checks > RULES.CHECKS) return { valid: false, reason: 'too many checks' };
      var said = ch === 'R' ? 'real' : ch === 'F' ? 'fake' : null, ok = said === e.card.ans, p = ok ? points(e.round, streak) : 0;
      score += p; streak = ok ? streak + 1 : 0; minMs += Math.min(ms, e.limit) + RULES.PAUSE;
      if (ok) { det.right++; det.byRound[e.round]++; } else if (ch === 'T') det.timeouts++; else if (said === 'real') det.fooled++; else det.doubted++;
      log.push({ id: e.card.id, said: said, ok: ok, p: p, checked: ck });
    }
    det.checks = checks;
    var done = moves.length === d.length;
    return { valid: done, done: done, reason: done ? '' : 'run not finished', score: score, minMs: minMs, played: moves.length, total: d.length, log: log, detail: det };
  }

  // Best possible score: every card right (checks and speed don't change it).
  var MAX = (function () { var s = 0; for (var i = 0; i < 3 * RULES.PER_ROUND; i++) s += points(Math.floor(i / RULES.PER_ROUND), i); return s; })();
  var stars = [Math.round(MAX * 0.4), Math.round(MAX * 0.7), Math.round(MAX * 0.93)];

  return { id: 'real-or-fake', VERSION: 2, stars: stars, MAX: MAX, RULES: RULES, data: data, deck: deck, replay: replay, points: points };
}));
