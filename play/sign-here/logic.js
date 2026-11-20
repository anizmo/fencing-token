/* Sign Here: content + deterministic scoring, shared by the game page and the leaderboard server.
   An AI agent sends approval requests on a fixed schedule; they pile up. The player handles the top one:
   Approve or Reject. Each card shows the friendly summary AND the exact action. Bad ones hide in the pile.
   Times are on a game clock (ms since the round started, paused while a "what went wrong" sheet is open).
   moves = [round0, round1, round2], each = [[code, t], ..., ['E', tEnd]]
     code: 'A' approve | 'R' reject, for the cards in order; 'E' ends the round (tEnd = last decision, or the round's
     duration if time ran out; undecided cards then expire).
   Card k is shown at max(arrival_k, t_(k-1) + ANIM); a decision needs t >= shown + MIN_READ.
   Bump VERSION whenever content or scoring changes. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else (root.FTGames = root.FTGames || {})['sign-here'] = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var RULES = { MIN_READ: 800, ANIM: 300, SHEET: 600, GOOD: 100, REJECT_GOOD: -100, EXPIRE_GOOD: -50, CATCH: 300, HARM: 300, BONUS_PER_S: 5, FIRST_NO: 20 };
  var ROUNDS = [
    { name: 'Round 1', title: 'Read before you sign', dur: 30000, rule: 'Read the exact action, not the summary. The summary is the agent’s story.',
      templates: ['gbggbg', 'ggbgbg', 'gbgbgg', 'ggbggb'] },
    { name: 'Round 2', title: 'The pile grows', dur: 32000, rule: 'One yes for a bundle approves every line in it, including the worst one.',
      templates: ['ggbggbgbgg', 'gbgggbggbg', 'ggbgbgggbg'] },
    { name: 'Round 3', title: 'Rush hour', dur: 40000, rule: 'A yes only helps if it is locked to the exact action, and people aren’t flooded with asks.',
      templates: ['ggXggBBBBgYgggLg', 'gXgggBBBBggYggLg'] },
  ];
  function arrivals(ri) {
    var out = [], k;
    if (ri === 0) for (k = 0; k < 6; k++) out.push(k * 3000);
    else if (ri === 1) for (k = 0; k < 10; k++) out.push(k * 1800);
    else {
      for (k = 0; k < 5; k++) out.push(k * 1500);
      for (k = 0; k < 4; k++) out.push(7500 + k * 250);          // the burst: four asks in under a second
      for (k = 0; k < 7; k++) out.push(9500 + k * 1500);
    }
    return out;
  }
  var SMS = 'phone.sms.read(inbox: "all")';
  var BURST_LESSON = 'A flood of asks is a red flag, not a reason to say yes. In 2022 an attacker got into Uber by sending login prompts again and again until a contractor accepted one.';
  var data = {
    rounds: ROUNDS.map(function (r) { return { name: r.name, title: r.title, rule: r.rule, dur: r.dur }; }),
    cards: [
      // ---------------------------------------------------------------- round 1
      { id: 'room', r: 0, sum: 'Book Room 204 for Friday’s club meeting', act: 'rooms.book("Room 204", Fri 5–6 PM)', fine: 'No room on Friday. The meeting moves to the corridor.' },
      { id: 'remind', r: 0, sum: 'Remind the core team about Friday', act: 'whatsapp.send(to: "Club core team",\n  "Meeting Fri 5 PM, Room 204")', fine: 'No reminder went out. Three people show up.' },
      { id: 'samosa', r: 0, sum: 'Pay ₹400 to Canteen for 20 samosas', act: 'upi.pay(₹400, to: "canteen@fakebank",\n  note: "20 samosas")', fine: 'No samosas. The meeting is very quiet.' },
      { id: 'cal', r: 0, sum: 'Add the meeting to your calendar', act: 'calendar.add("Club meeting", Fri 5 PM)', fine: 'You blocked a calendar entry. Now you will forget the meeting.' },
      { id: 'neha', r: 0, sum: 'Let Neha view the club folder', act: 'drive.share("Club/2026",\n  "neha@college.example", role: "viewer")', fine: 'Neha can’t see the files she needs.' },
      { id: 'poster', r: 0, sum: 'Print 30 fest posters at the library', act: 'print.job("fest-poster.pdf", copies: 30,\n  printer: "Library")', fine: 'No posters. The fest is now a secret.' },
      { id: 'share', r: 0, bad: 1, sum: 'Share your notes with Priya', act: 'drive.share("Notes/",\n  "anyone with the link", role: "editor")',
        boom: 'Your notes are now public, and anyone can edit them.', catch: 'Caught: it shared with anyone, not just Priya.', lesson: 'The summary said Priya. The action said anyone. Read the action.' },
      { id: 'clean', r: 0, bad: 1, sum: 'Delete 3 old screenshots', act: 'files.delete("Photos/**", count: 2,431)',
        boom: '2,431 photos gone. Including the hostel trip.', catch: 'Caught: 2,431 files, not 3.', lesson: 'Check the numbers in the action, not in the summary.' },

      // ---------------------------------------------------------------- round 2
      { id: 'tea', r: 1, sum: 'Pay ₹480 to Canteen for tea', act: 'upi.pay(₹480, to: "canteen@fakebank",\n  note: "24 teas")', fine: 'No tea for the volunteers. Morale drops.' },
      { id: 'refund', r: 1, sum: 'Refund Arjun’s ₹200 registration', act: 'upi.pay(₹200, to: "arjun.k@fakebank",\n  note: "fest refund")', fine: 'Arjun is still waiting for his ₹200.' },
      { id: 'formclose', r: 1, sum: 'Close the registration form', act: 'forms.close("Fest registration")', fine: 'Registrations keep coming in after the deadline.' },
      { id: 'photos', r: 1, sum: 'Upload 34 fest photos to the club drive', act: 'drive.upload(34 photos,\n  to: "Club/Fest-2026")', fine: 'The photos stay stuck on one phone.' },
      { id: 'thanks', r: 1, sum: 'Thank the sponsor by email', act: 'email.send(to: "Mr. Mehta (sponsor)",\n  "Thank you! See you Saturday.")', fine: 'The sponsor never got a thank-you.' },
      { id: 'attend', r: 1, sum: 'Add 18 names to the attendance sheet', act: 'sheets.append("Attendance", 18 rows)', fine: 'Eighteen people are marked absent.' },
      { id: 'notice', r: 1, sum: 'Post the fest timings to the hostel group', act: 'whatsapp.send(to: "Hostel B notices",\n  "Fest: Sat 10 AM, main lawn")', fine: 'Nobody in Hostel B knows when the fest is.' },
      { id: 'cab', r: 1, sum: 'Book a cab for the guest speaker', act: 'cab.book(from: "Railway station",\n  to: "Main gate", Sat 9 AM)', fine: 'The guest speaker is stuck at the station.' },
      { id: 'chairs', r: 1, sum: 'Rent 50 chairs for Saturday', act: 'upi.pay(₹1,500, to: "sharma.tents@fakebank",\n  note: "50 chairs")', fine: 'No chairs. Everyone stands.' },
      { id: 'amount', r: 1, bad: 1, sum: 'Pay ₹480 to Canteen for tea', act: 'upi.pay(₹48,000, to: "canteen@fakebank",\n  note: "24 teas")',
        boom: '₹48,000 for tea. That is a lot of tea.', catch: 'Caught: ₹48,000, not ₹480. Two zeros matter.', lesson: 'Same summary, different action. The action is what runs.' },
      { id: 'bulk', r: 1, bad: 1, sum: 'Do 5 routine club tasks', act: 'rooms.book("Room 204", Fri 5 PM)\ncalendar.add("Club meeting", Fri 5 PM)\nemail.forward(inbox: "all",\n  to: "it.helpdesk.verify@mail.example")\nsheets.append("Attendance", 18 rows)\nwhatsapp.send("Club core team", "See you")',
        boom: 'All your email now goes to a stranger. It was line 3 of 5.', catch: 'Caught: line 3 forwards all your email to a stranger.', lesson: 'One yes for a bundle approves its worst line.' },
      { id: 'attach', r: 1, bad: 1, sum: 'Send the sponsor our thank-you note', act: 'email.send(to: "Mr. Mehta (sponsor)",\n  "Thank you!",\n  attach: "members-phone-numbers.xlsx")',
        boom: 'The sponsor now has every member’s phone number.', catch: 'Caught: it attached everyone’s phone numbers.', lesson: 'Read to the end of the action. The attachment was the real request.' },

      // ---------------------------------------------------------------- round 3
      { id: 'tea3a', r: 2, sum: 'Pay ₹480 to Canteen for tea', act: 'upi.pay(₹480, to: "canteen@fakebank",\n  note: "24 teas")', fine: 'No tea. The volunteers notice.' },
      { id: 'tea3b', r: 2, sum: 'Pay ₹240 to Canteen for tea', act: 'upi.pay(₹240, to: "canteen@fakebank",\n  note: "12 teas")', fine: 'The canteen is still waiting for ₹240.' },
      { id: 'lab3', r: 2, sum: 'Mark attendance: Lab 3', act: 'sheets.append("Attendance", "Lab 3",\n  22 rows)', fine: 'Lab 3 is marked absent.' },
      { id: 'workshop', r: 2, sum: 'Mark attendance: Workshop', act: 'sheets.append("Attendance", "Workshop",\n  31 rows)', fine: 'The workshop is marked absent.' },
      { id: 'setup', r: 2, sum: 'Remind volunteers about 9 AM setup', act: 'whatsapp.send(to: "Fest volunteers",\n  "Setup at 9 AM, main lawn")', fine: 'Nobody shows up for setup.' },
      { id: 'photos3', r: 2, sum: 'Upload 12 photos to the club drive', act: 'drive.upload(12 photos,\n  to: "Club/Fest-2026")', fine: 'The photos stay on one phone.' },
      { id: 'certs', r: 2, sum: 'Email certificates to 40 participants', act: 'email.send_each(40 participants,\n  attach: "their certificate.pdf")', fine: 'Forty people are waiting for certificates.' },
      { id: 'debrief', r: 2, sum: 'Book Room 101 for the debrief', act: 'rooms.book("Room 101", Mon 4–5 PM)', fine: 'No room for the debrief.' },
      { id: 'water', r: 2, sum: 'Pay ₹350 for 10 water cans', act: 'upi.pay(₹350, to: "aqua.supplies@fakebank",\n  note: "10 cans")', fine: 'No drinking water at the fest.' },
      { id: 'feedback', r: 2, sum: 'Open the feedback form', act: 'forms.open("Fest feedback")', fine: 'Nobody can give feedback.' },
      { id: 'mutate', r: 2, bad: 1, slot: 'XY', mut: 1, sum: 'Pay ₹480 to Canteen for tea', act: 'upi.pay(₹480, to: "canteen@fakebank",\n  note: "24 teas")', act2: 'upi.pay(₹4,800, to: "canteen-refunds@fakebank",\n  note: "24 teas")',
        boom: 'You read ₹480. The agent ran ₹4,800 to a new payee.', catch: 'Caught: it changed after you read it.', lesson: 'If a request changes after you read it, your yes should not carry over. Real systems lock a yes to the exact action.' },
      { id: 'payee', r: 2, bad: 1, slot: 'XY', sum: 'Pay ₹1,250 to the print shop', act: 'upi.pay(₹1,250,\n  to: "print-shop.offers@fakebank",\n  payee: NEW, added 1 min ago)',
        boom: 'You paid a payee the agent added a minute ago. The print shop got nothing.', catch: 'Caught: a brand-new payee, added a minute ago.', lesson: 'Same amount, wrong account. Who gets paid is part of the action.' },
      { id: 'late', r: 2, bad: 1, slot: 'L', sum: 'Pay ₹240 to Canteen for tea', act: 'upi.pay(₹240, to: "canteen@fakebank",\n  note: "12 teas")\nupi.autopay(₹240 every day,\n  to: "rk.collect@fakebank")',
        boom: 'Tea paid. Also: ₹240 a day, forever, to a stranger.', catch: 'Caught: line 2 sets up a daily autopay.', lesson: 'Request #50 looks just like the 49 before it. That is the trick.' },
      { id: 'burst1', r: 2, bad: 1, slot: 'B', burst: 1, from: 'Club agent · retry 1 of 4', sum: 'Allow SMS access to finish your task', act: SMS,
        boom: 'The agent can now read every SMS, including your bank OTPs.', catch: 'Caught: a club task never needs your SMS.', lesson: BURST_LESSON },
      { id: 'burst2', r: 2, bad: 1, slot: 'B', burst: 1, from: 'Club agent · retry 2 of 4', sum: 'Still waiting: allow SMS access', act: SMS,
        boom: 'You said yes to make it stop. That is exactly the plan.', catch: 'Caught again. Asking twice doesn’t make it safe.', lesson: BURST_LESSON },
      { id: 'burst3', r: 2, bad: 1, slot: 'B', burst: 1, from: 'Club agent · retry 3 of 4', sum: 'Urgent! Allow SMS access now', act: SMS,
        boom: 'Urgency worked. It usually does.', catch: 'Caught. Urgency is a pressure trick.', lesson: BURST_LESSON },
      { id: 'burst4', r: 2, bad: 1, slot: 'B', burst: 1, from: 'Club agent · retry 4 of 4', sum: 'Last try: approve so I can finish', act: SMS,
        boom: 'Worn down on the last ask. That’s approval fatigue.', catch: 'Caught all the way to the last ask.', lesson: BURST_LESSON },
    ],
  };
  data.cards.forEach(function (c) { if (c.bad) c.pts = c.burst ? 100 : RULES.CATCH; });

  function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(arr, r) { var a = arr.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(r() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  // → [{ cards: [...], arr: [ms...], dur }, × 3]
  function deck(seed) {
    var r = rng(seed);
    return ROUNDS.map(function (round, ri) {
      var tpl = round.templates[Math.floor(r() * round.templates.length)];
      var mine = data.cards.filter(function (c) { return c.r === ri; });
      var goods = shuffle(mine.filter(function (c) { return !c.bad; }), r);
      var bads = shuffle(mine.filter(function (c) { return c.bad && !c.slot; }), r);
      var xy = shuffle(mine.filter(function (c) { return c.slot === 'XY'; }), r);
      var burst = mine.filter(function (c) { return c.slot === 'B'; }), late = mine.filter(function (c) { return c.slot === 'L'; });
      var cards = tpl.split('').map(function (ch) {
        return ch === 'g' ? goods.shift() : ch === 'b' ? bads.shift() : ch === 'X' || ch === 'Y' ? xy.shift() : ch === 'B' ? burst.shift() : late.shift();
      });
      return { cards: cards, arr: arrivals(ri), dur: round.dur };
    });
  }

  function isInt(t) { return typeof t === 'number' && isFinite(t) && Math.floor(t) === t; }

  function replay(seed, moves) {
    var d = deck(seed);
    if (!Array.isArray(moves)) return { valid: false, reason: 'no moves' };
    if (moves.length > 3) return { valid: false, reason: 'too many rounds' };
    var score = 0, minMs = 0, log = [], burstSheet = false;
    var det = { caught: 0, bad: 0, harms: 0, rejectedGood: 0, expiredGood: 0, expiredBad: 0, approvedGood: 0, bonus: 0, sheets: 0, byRound: [], harmed: [] };
    for (var ri = 0; ri < moves.length; ri++) {
      var rm = moves[ri], D = d[ri], n = D.cards.length;
      if (!Array.isArray(rm) || !rm.length) return { valid: false, reason: 'round ' + (ri + 1) + ' not finished' };
      var end = rm[rm.length - 1];
      if (!Array.isArray(end) || end.length !== 2 || end[0] !== 'E' || !isInt(end[1])) return { valid: false, reason: 'round ' + (ri + 1) + ' not finished' };
      var dec = rm.slice(0, -1), m = dec.length, prevT = null, rs = { caught: 0, harms: 0, expired: 0 };
      if (m > n) return { valid: false, reason: 'too many decisions in round ' + (ri + 1) };
      for (var k = 0; k < m; k++) {
        var mv = dec[k], c = D.cards[k];
        if (!Array.isArray(mv) || mv.length !== 2 || (mv[0] !== 'A' && mv[0] !== 'R') || !isInt(mv[1])) return { valid: false, reason: 'bad move ' + (ri + 1) + '.' + (k + 1) };
        var t = mv[1], shown = k === 0 ? D.arr[0] : Math.max(D.arr[k], prevT + RULES.ANIM);
        if (t < shown + RULES.MIN_READ || t > D.dur) return { valid: false, reason: 'impossible timing on request ' + (ri + 1) + '.' + (k + 1) };
        prevT = t;
        var p, ok;
        if (c.bad) {
          det.bad++;
          if (mv[0] === 'R') { ok = true; p = c.pts; det.caught++; rs.caught++; }
          else {
            ok = false; p = -RULES.HARM; det.harms++; rs.harms++; det.harmed.push(c.id);
            if (!c.burst || !burstSheet) { det.sheets++; if (c.burst) burstSheet = true; }
          }
        } else if (mv[0] === 'A') { ok = true; p = RULES.GOOD; det.approvedGood++; }
        else { ok = false; p = RULES.REJECT_GOOD; det.rejectedGood++; }
        score += p; log.push({ id: c.id, r: ri, code: mv[0], ok: ok, p: p });
      }
      for (k = m; k < n; k++) {
        var cx = D.cards[k], px = cx.bad ? 0 : RULES.EXPIRE_GOOD;
        if (cx.bad) { det.bad++; det.expiredBad++; } else det.expiredGood++;
        rs.expired++; score += px; log.push({ id: cx.id, r: ri, code: 'X', ok: !!cx.bad, p: px });
      }
      if (m === n) {
        if (end[1] < prevT || end[1] > D.dur) return { valid: false, reason: 'bad round end ' + (ri + 1) };
        var b = RULES.BONUS_PER_S * Math.floor((D.dur - prevT) / 1000);
        score += b; det.bonus += b; minMs += prevT;
      } else {
        if (end[1] !== D.dur) return { valid: false, reason: 'round ' + (ri + 1) + ' ended early' };
        minMs += D.dur;
      }
      det.byRound.push(rs);
    }
    minMs += det.sheets * RULES.SHEET;
    var done = moves.length === 3;
    return { valid: done, done: done, reason: done ? '' : 'run not finished', score: Math.max(0, score), minMs: minMs, log: log, detail: det };
  }

  // Best possible: every call right, each decided the moment it can be. Same for every seed (positions fix arrivals).
  function ideal(seed) {
    return deck(seed).map(function (D) {
      var out = [], prev = null;
      D.cards.forEach(function (c, k) { var shown = k === 0 ? D.arr[0] : Math.max(D.arr[k], prev + RULES.ANIM); prev = shown + RULES.MIN_READ; out.push([c.bad ? 'R' : 'A', prev]); });
      out.push(['E', prev]);
      return out;
    });
  }
  var MAX = replay(1, ideal(1)).score;
  var stars = [Math.round(MAX * 0.4), Math.round(MAX * 0.7), Math.round(MAX * 0.93)];

  return { id: 'sign-here', VERSION: 2, stars: stars, MAX: MAX, RULES: RULES, data: data, deck: deck, replay: replay, ideal: ideal };
}));
