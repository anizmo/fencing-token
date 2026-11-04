/* Fencing Token — progressive enhancements. The page works fully without this file. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  // Filter: "/" focuses; matches title, authors, description, type.
  var input = $('#filter');
  if (input) {
    var entries = $$('.stage .entry'), stages = $$('.stage'), count = $('#filter-count');
    var run = function () {
      var q = input.value.trim().toLowerCase(), shown = 0;
      entries.forEach(function (el) { var hit = !q || el.getAttribute('data-text').indexOf(q) !== -1; el.classList.toggle('hide', !hit); if (hit) shown++; });
      stages.forEach(function (s) { s.classList.toggle('hide', !!q && !s.querySelector('.entry:not(.hide)')); });
      if (count) { count.hidden = !q; count.textContent = shown + ' of ' + entries.length + ' resources'; }
    };
    input.addEventListener('input', run);
    document.addEventListener('keydown', function (ev) {
      var t = ev.target.tagName;
      if (ev.key === '/' && t !== 'INPUT' && t !== 'TEXTAREA') { ev.preventDefault(); input.focus(); }
      if (ev.key === 'Escape' && document.activeElement === input) { input.value = ''; run(); input.blur(); }
    });
  }

  // Table of contents: highlight the stage in view.
  var tocLinks = $$('.toc a');
  if (tocLinks.length && 'IntersectionObserver' in window) {
    var byId = {}; tocLinks.forEach(function (a) { byId[a.getAttribute('href').slice(1)] = a; });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { tocLinks.forEach(function (a) { a.classList.remove('on'); }); var a = byId[en.target.id]; if (a) a.classList.add('on'); } });
    }, { rootMargin: '-20% 0px -70% 0px' });
    $$('.stage').forEach(function (s) { io.observe(s); });
  }

  // Checklist: remember ticks in this browser; copy as Markdown.
  var boxes = $$('.check-group input[type=checkbox]');
  if (boxes.length) {
    var KEY = 'ft-checklist-v1', saved = [];
    try { saved = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { saved = []; }
    var update = function () {
      var n = boxes.filter(function (b) { return b.checked; }).length;
      $('#check-count').textContent = n + ' of ' + boxes.length;
      $('#check-fill').style.width = (100 * n / boxes.length) + '%';
    };
    boxes.forEach(function (b, i) {
      b.checked = !!saved[i];
      b.addEventListener('change', function () { try { localStorage.setItem(KEY, JSON.stringify(boxes.map(function (x) { return x.checked; }))); } catch (e) {} update(); });
    });
    update();
    var reset = $('#check-reset'); if (reset) reset.addEventListener('click', function () { boxes.forEach(function (b) { b.checked = false; }); try { localStorage.removeItem(KEY); } catch (e) {} update(); });
    var copy = $('#check-copy');
    if (copy) copy.addEventListener('click', function () {
      var md = '## Fenced agent production checklist\n';
      $$('.check-group').forEach(function (g) {
        md += '\n**' + $('h3', g).textContent + '**\n';
        $$('label', g).forEach(function (l) { md += '- [' + ($('input', l).checked ? 'x' : ' ') + '] ' + $('span', l).textContent.trim() + '\n'; });
      });
      md += '\nSource: https://fencingtoken.com/#checklist\n';
      var done = function (t) { copy.textContent = t; setTimeout(function () { copy.textContent = 'Copy as Markdown'; }, 1600); };
      if (navigator.clipboard) navigator.clipboard.writeText(md).then(function () { done('Copied'); }, function () { done('Copy failed'); });
      else done('Copy not supported');
    });
  }
})();
