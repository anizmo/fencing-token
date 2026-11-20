/* Shared helpers for Fencing Token Live: a self-healing WebSocket and small DOM utilities. */
(function () {
  'use strict';
  if (window.top !== window.self) { document.documentElement.innerHTML = ''; throw new Error('Fencing Token Live cannot be embedded in another page.'); }
  var cfg = window.FT_LIVE || {};
  var q = new URLSearchParams(location.search);
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  // The API address can only be overridden when testing locally, so a crafted link can't redirect answers.
  var api = (local && q.get('api')) || cfg.api || '';

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'class') n.className = attrs[k];
      else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c !== null && c !== undefined) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }

  function Live(room, role, onMessage, onStatus) {
    this.room = room; this.role = role; this.onMessage = onMessage; this.onStatus = onStatus || function () {};
    this.queue = []; this.tries = 0; this.closed = false; this.connect();
  }
  Live.prototype.connect = function () {
    var self = this;
    if (!api || api.indexOf('REPLACE-ME') !== -1) { this.onStatus('config'); return; }
    var url = api.replace(/\/$/, '') + '/room/' + encodeURIComponent(this.room) + (this.role === 'host' ? '?role=host' : '');
    var ws;
    try { ws = new WebSocket(url); } catch (e) { return this.retry(); }
    this.ws = ws;
    this.onStatus('connecting');
    ws.onopen = function () {
      self.tries = 0; self.onStatus('open');
      if (self.onOpen) self.onOpen();
      while (self.queue.length) ws.send(self.queue.shift());
      clearInterval(self.ping);
      self.ping = setInterval(function () { if (ws.readyState === 1) ws.send('{"t":"ping"}'); }, 25000);
    };
    ws.onmessage = function (e) { var m; try { m = JSON.parse(e.data); } catch (x) { return; } if (m.t !== 'pong') self.onMessage(m); };
    ws.onclose = function (e) { clearInterval(self.ping); if (e.code === 4003) { self.onStatus('denied'); return; } self.retry(); };
    ws.onerror = function () { /* onclose follows */ };
  };
  Live.prototype.retry = function () {
    if (this.closed) return;
    this.onStatus('reconnecting');
    var self = this, wait = Math.min(10000, 800 * Math.pow(1.6, this.tries++)) + Math.random() * 600;
    setTimeout(function () { self.connect(); }, wait);
  };
  Live.prototype.send = function (o) {
    var s = JSON.stringify(o);
    if (this.ws && this.ws.readyState === 1) this.ws.send(s); else this.queue.push(s);
  };

  function voterId() {
    var k = 'ftlive-voter', v = null;
    try { v = localStorage.getItem(k); } catch (e) {}
    if (!v) {
      var a = new Uint8Array(12); crypto.getRandomValues(a);
      v = 'v' + Array.prototype.map.call(a, function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
      try { localStorage.setItem(k, v); } catch (e) {}
    }
    return v;
  }

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  window.FTL = { el: el, Live: Live, voterId: voterId, store: store, params: q, cfg: cfg, letters: 'ABCDEFGH' };
})();
