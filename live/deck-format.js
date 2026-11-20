/* Fencing Token Live session format: one Markdown (or JSON) file per session.
   Works in the browser (window.FTLDeck) and in Node (require / import).

   ---
   title: Explainable AI for Transparent Decision Making
   room: XAI
   ---

   # 1. Opening hook                      <- section name for the items below it

   ## cloud: In one word, how do you feel when an app decides about you without saying why?
   words: 1                                <- settings, one per line
   > Speaker notes go on lines starting with ">".

   ## poll: Which doctor do you prefer?
   - Doctor A: "Trust me."
   - [x] Doctor B: explains the numbers     <- [x] marks the correct answer (poll, quiz)
   hide: true                               <- hide live results until you press Reveal

   Types: title, poll, multi, scale, quiz, cloud, wall, leaderboard, qa
   Friendly aliases: "word cloud" = cloud, "choice" = poll, "multiple choice"/"checkboxes" = multi,
   "rating" = scale, "open text"/"waterfall"/"text wall" = wall, "q&a"/"questions" = qa.
   Settings: sub, hide, seconds (quiz), words + entries (cloud), max (wall characters).
*/
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.FTLDeck = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  var TYPES = ['title', 'poll', 'multi', 'scale', 'quiz', 'cloud', 'wall', 'leaderboard', 'qa'];
  var ALIAS = { 'word cloud': 'cloud', wordcloud: 'cloud', choice: 'poll', 'single choice': 'poll', 'multiple choice': 'multi', checkboxes: 'multi',
    rating: 'scale', 'open text': 'wall', waterfall: 'wall', 'text wall': 'wall', text: 'wall', 'q&a': 'qa', questions: 'qa', board: 'leaderboard', welcome: 'title' };
  var NUM = { seconds: 1, words: 1, entries: 1, max: 1 };

  function parseMarkdown(src) {
    var lines = String(src).replace(/\r\n?/g, '\n').split('\n'), meta = {}, items = [], errors = [], section = '', cur = null, i = 0;
    if (lines[0] && lines[0].trim() === '---') {
      for (i = 1; i < lines.length && lines[i].trim() !== '---'; i++) {
        var fm = lines[i].match(/^\s*([A-Za-z_]+)\s*:\s*(.*)$/);
        if (fm) meta[fm[1].toLowerCase()] = fm[2].trim();
      }
      i++;
    }
    function finish() { if (cur) { if (cur.notes) cur.notes = cur.notes.trim(); items.push(cur); } cur = null; }
    var inComment = false;
    for (; i < lines.length; i++) {
      var raw = lines[i], line = raw.trim(), n = i + 1, m;
      if (inComment) { if (line.indexOf('-->') >= 0) inComment = false; continue; }
      if (line.indexOf('<!--') === 0) { if (line.indexOf('-->') < 0) inComment = true; continue; }
      if (!line) continue;
      if ((m = line.match(/^#\s+(.+)$/))) { finish(); section = m[1].trim(); continue; }
      if ((m = line.match(/^##\s+([^:]+?)\s*:\s*(.*)$/))) {
        finish();
        var t = m[1].trim().toLowerCase(); t = ALIAS[t] || t;
        if (TYPES.indexOf(t) < 0) { errors.push('Line ' + n + ': unknown type "' + m[1].trim() + '"'); cur = null; continue; }
        cur = { type: t, prompt: m[2].trim(), section: section, _line: n };
        continue;
      }
      if (/^##\s+/.test(line)) { finish(); errors.push('Line ' + n + ': item heading needs "## type: prompt"'); continue; }
      if (!cur) { errors.push('Line ' + n + ': text outside an item (start one with "## type: prompt")'); continue; }
      if ((m = line.match(/^>\s?(.*)$/))) { cur.notes = (cur.notes ? cur.notes + '\n' : '') + m[1]; continue; }
      if ((m = line.match(/^[-*]\s+(\[[xX ]\]\s+)?(.+)$/))) {
        cur.options = cur.options || [];
        if (m[1] && /x/i.test(m[1])) cur.answer = cur.options.length;
        cur.options.push(m[2].trim());
        continue;
      }
      if ((m = line.match(/^([A-Za-z]+)\s*:\s*(.*)$/))) {
        var k = m[1].toLowerCase(), v = m[2].trim();
        if (k === 'hide') cur.hide = /^(true|yes|1)$/i.test(v);
        else if (NUM[k]) cur[k] = Number(v);
        else if (k === 'sub' || k === 'subtitle') cur.sub = v;
        else if (k === 'notes') cur.notes = (cur.notes ? cur.notes + '\n' : '') + v;
        else errors.push('Line ' + n + ': unknown setting "' + m[1] + '"');
        continue;
      }
      errors.push('Line ' + n + ': could not read "' + line.slice(0, 50) + '"');
    }
    finish();
    return { title: meta.title || '', room: (meta.room || '').toUpperCase(), meta: meta, items: items, errors: errors };
  }

  function validate(deck) {
    var errs = deck.errors ? deck.errors.slice() : [];
    if (!deck.items.length) errs.push('No items found.');
    if (deck.items.length > 120) errs.push('Too many items (max 120).');
    if (deck.room && !/^[A-Z0-9]{3,16}$/.test(deck.room)) errs.push('room must be 3-16 letters or digits.');
    deck.items.forEach(function (it, k) {
      var where = 'Item ' + (k + 1) + (it._line ? ' (line ' + it._line + ')' : '') + ' [' + it.type + ']: ';
      if (!it.prompt) errs.push(where + 'missing prompt');
      if (it.prompt && it.prompt.length > 300) errs.push(where + 'prompt is over 300 characters');
      if (['poll', 'multi', 'quiz'].indexOf(it.type) >= 0) {
        if (!it.options || it.options.length < 2) errs.push(where + 'needs at least 2 options ("- option")');
        else if (it.options.length > 8) errs.push(where + 'has more than 8 options');
        (it.options || []).forEach(function (o) { if (o.length > 220) errs.push(where + 'an option is over 220 characters'); });
      }
      if (it.type === 'quiz' && typeof it.answer !== 'number') errs.push(where + 'quiz needs a correct option marked "- [x] ..."');
      if (it.type === 'multi' && typeof it.answer === 'number') errs.push(where + 'multi-select questions cannot have a single correct answer');
      if (it.type === 'scale' && it.options && it.options.length > 10) errs.push(where + 'scale has more than 10 options');
    });
    return errs;
  }

  function parse(text, filename) {
    var deck;
    if (/\.json$/i.test(filename || '') || /^\s*[{[]/.test(text)) {
      var j = JSON.parse(text);
      deck = { title: j.title || '', room: String(j.room || '').toUpperCase(), items: (j.items || j).map(function (x) { return Object.assign({}, x); }), errors: [] };
    } else deck = parseMarkdown(text);
    deck.errors = validate(deck);
    deck.items.forEach(function (it) { delete it._line; });
    return deck;
  }

  return { parse: parse, TYPES: TYPES };
}));
