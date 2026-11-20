/* Husky or Wolf?: the find frame. Predict what an image model says, tap where it looked, and discover it learned
   the snow instead of the animal. Then find the tiny planted sticker that makes a gate camera wave wolves through.
   Every scene is an SVG drawn here; the heatmaps are illustrative. */
(function () {
  'use strict';
  var K = window.FTKit, el = K.el, L = window.FTGames['husky-or-wolf'];
  var main = document.getElementById('main');
  var NS = 'http://www.w3.org/2000/svg', VW = 320, VH = 220, HZ = 128, uid = 0;
  var G = {
    logic: L, title: 'Husky or Wolf?', kicker: 'Fencing Token Arcade · Act 1',
    pitch: 'An image model tells huskies from wolves, and it is usually right. Find out what it is really looking at.',
    meta: '3 rounds · 13 photos · about 2 minutes',
    howto: [
      { cls: 'ask', glyph: '1', text: 'Guess what the model will say' },
      { cls: 'allow', glyph: '2', text: 'Tap where you think it looked' },
      { cls: 'deny', glyph: '3', text: 'Find the planted trigger, fast' },
    ],
    nextGame: { href: '/play/next-word/', title: 'Next Word' },
    shareText: function (s) { return 'I caught an AI model staring at the snow instead of the wolf: ' + s + ' points in Husky or Wolf?'; },
    next: [
      { href: '/concepts/?lens=everyone#red-teaming-and-evals', text: 'Red-teaming and evals, explained three ways', sub: 'How people test what a model really learned.' },
      { href: '/concepts/?lens=everyone#guardrails', text: 'Guardrails, explained three ways', sub: 'Checks around a model you cannot fully see inside.' },
    ],
  };
  var S;

  // ---------------------------------------------------------------- tiny SVG kit
  function s(tag, attrs, kids) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] !== null && attrs[k] !== undefined) n.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function grad(defs, id, top, bot) { defs.appendChild(s('linearGradient', { id: id, x1: 0, y1: 0, x2: 0, y2: 1 }, [s('stop', { offset: '0', 'stop-color': top }), s('stop', { offset: '1', 'stop-color': bot })])); return 'url(#' + id + ')'; }
  function pine(x, base, h, snowy) {
    var w = h * 0.42, g = s('g');
    g.appendChild(s('rect', { x: x - 2.5, y: base - h * 0.16, width: 5, height: h * 0.16, fill: '#6B4A2E' }));
    [0, 1, 2].forEach(function (k) {
      var top = base - h + k * h * 0.26, bot = top + h * 0.42, hw = w * (0.55 + k * 0.22);
      g.appendChild(s('path', { d: 'M' + x + ' ' + top + ' L' + (x + hw) + ' ' + bot + ' L' + (x - hw) + ' ' + bot + ' Z', fill: k % 2 ? '#2B5944' : '#2F6249' }));
      if (snowy) g.appendChild(s('path', { d: 'M' + x + ' ' + top + ' L' + (x + hw * 0.45) + ' ' + (top + h * 0.19) + ' Q' + x + ' ' + (top + h * 0.15) + ' ' + (x - hw * 0.45) + ' ' + (top + h * 0.19) + ' Z', fill: '#FFFFFF' }));
    });
    return g;
  }
  function roundTree(x, base, r) {
    return s('g', {}, [s('rect', { x: x - 3, y: base - r * 1.2, width: 6, height: r * 1.2, fill: '#7A5634' }),
      s('circle', { cx: x, cy: base - r * 1.5, r: r, fill: '#4E9A3A' }), s('circle', { cx: x - r * 0.45, cy: base - r * 1.25, r: r * 0.7, fill: '#5AAA44' }), s('circle', { cx: x + r * 0.5, cy: base - r * 1.3, r: r * 0.65, fill: '#438A33' })]);
  }
  function cloud(x, y, k) { return s('g', { fill: '#FFFFFF', opacity: '0.92' }, [s('ellipse', { cx: x, cy: y, rx: 18 * k, ry: 8 * k }), s('circle', { cx: x - 6 * k, cy: y - 5 * k, r: 8 * k }), s('circle', { cx: x + 6 * k, cy: y - 7 * k, r: 10 * k })]); }
  var FLAKES = [[22, 30], [58, 64], [96, 22], [130, 52], [182, 18], [214, 60], [250, 34], [292, 70], [306, 22], [40, 102], [270, 104], [120, 96], [200, 108], [10, 74]];
  function flakes(g, n) { FLAKES.slice(0, n).forEach(function (f, k) { g.appendChild(s('circle', { class: 'flake', style: 'animation-delay:-' + (k * 0.37) + 's', cx: f[0], cy: f[1], r: k % 3 ? 1.8 : 2.6, fill: '#FFFFFF', opacity: '0.9' })); }); }
  function tufts(g, col, pts) { pts.forEach(function (p) { g.appendChild(s('path', { d: 'M' + p[0] + ' ' + p[1] + ' l3 -8 l2 8 l3 -10 l2 10 l3 -7 l1 7 Z', fill: col })); }); }
  function flower(g, x, y, col) { [0, 72, 144, 216, 288].forEach(function (a) { g.appendChild(s('ellipse', { cx: x, cy: y - 3.2, rx: 2.2, ry: 3.4, fill: col, transform: 'rotate(' + a + ' ' + x + ' ' + y + ')' })); }); g.appendChild(s('circle', { cx: x, cy: y, r: 1.8, fill: '#B5651D' })); }

  function background(g, defs, bg) {
    var id = 'g' + (++uid);
    if (bg === 'snow' || bg === 'snowhill' || bg === 'forest') {
      var sky = bg === 'forest' ? ['#A9C2D9', '#DCE7F1'] : bg === 'snowhill' ? ['#B9D5EE', '#ECF4FB'] : ['#CBE0F2', '#F0F6FC'];
      g.appendChild(s('rect', { width: VW, height: VH, fill: grad(defs, id, sky[0], sky[1]) }));
      g.appendChild(s('path', { d: 'M0 ' + (HZ - 10) + ' L48 70 L84 98 L132 56 L188 104 L236 64 L284 96 L320 74 L320 ' + HZ + ' L0 ' + HZ + ' Z', fill: '#E4EEF8' }));
      g.appendChild(s('path', { d: 'M132 56 L150 72 L138 70 L128 78 L118 70 Z M236 64 L252 78 L240 76 L230 82 L222 76 Z', fill: '#FFFFFF' }));
      var trees = bg === 'forest' ? [[18, 132, 70], [52, 128, 56], [84, 126, 44], [240, 126, 46], [272, 130, 62], [304, 134, 74]] : bg === 'snowhill' ? [[28, 124, 40], [292, 126, 50]] : [[24, 130, 58], [60, 126, 42], [262, 126, 44], [298, 132, 60]];
      trees.forEach(function (t) { g.appendChild(pine(t[0], t[1], t[2], true)); });
      g.appendChild(s('path', { d: bg === 'snowhill' ? 'M0 ' + (HZ - 4) + ' Q160 ' + (HZ - 26) + ' 320 ' + (HZ - 2) + ' L320 ' + VH + ' L0 ' + VH + ' Z' : 'M0 ' + HZ + ' Q160 ' + (HZ - 10) + ' 320 ' + HZ + ' L320 ' + VH + ' L0 ' + VH + ' Z', fill: '#F8FBFE' }));
      [[52, 170, 40, 6], [262, 184, 46, 7], [150, 150, 60, 5]].forEach(function (e) { g.appendChild(s('ellipse', { cx: e[0], cy: e[1], rx: e[2], ry: e[3], fill: '#DDE9F4' })); });
      flakes(g, bg === 'forest' ? 8 : 14);
    } else if (bg === 'meadow' || bg === 'park') {
      g.appendChild(s('rect', { width: VW, height: VH, fill: grad(defs, id, '#93CDEE', '#DDF1FB') }));
      g.appendChild(cloud(70, 34, 1)); g.appendChild(cloud(236, 24, 0.8));
      g.appendChild(s('path', { d: 'M0 ' + (HZ - 6) + ' Q80 ' + (HZ - 40) + ' 170 ' + (HZ - 10) + ' T320 ' + (HZ - 18) + ' L320 ' + HZ + ' L0 ' + HZ + ' Z', fill: '#A6D274' }));
      if (bg === 'park') { g.appendChild(roundTree(36, HZ + 2, 22)); g.appendChild(roundTree(288, HZ + 4, 26)); }
      g.appendChild(s('rect', { y: HZ - 2, width: VW, height: VH - HZ + 2, fill: '#73B653' }));
      g.appendChild(s('path', { d: 'M0 ' + (HZ + 18) + ' Q160 ' + (HZ + 8) + ' 320 ' + (HZ + 22) + ' L320 ' + VH + ' L0 ' + VH + ' Z', fill: '#69AC49' }));
      tufts(g, '#4F9638', [[20, 160], [70, 196], [118, 150], [214, 156], [258, 200], [300, 170], [12, 210], [236, 214]]);
      if (bg === 'park') [[24, 178], [64, 210], [262, 176], [298, 204], [232, 196]].forEach(function (f) { flower(g, f[0], f[1], '#FFD43B'); });
      else [[30, 186], [94, 206], [250, 190], [292, 212]].forEach(function (f) { flower(g, f[0], f[1], '#FFFFFF'); });
    } else if (bg === 'road') {
      g.appendChild(s('rect', { width: VW, height: VH, fill: grad(defs, id, '#F6CF97', '#FBEBD3') }));
      g.appendChild(s('circle', { cx: 276, cy: 36, r: 17, fill: '#FFC928' }));
      [[0, 70, 46, '#C8A07B'], [46, 50, 40, '#B78A63'], [86, 84, 38, '#D4B08C'], [214, 62, 44, '#BE916A'], [258, 80, 62, '#CFA680']].forEach(function (b) {
        g.appendChild(s('rect', { x: b[0], y: b[1], width: b[2], height: HZ - b[1], fill: b[3] }));
        for (var wy = b[1] + 10; wy < HZ - 14; wy += 18) for (var wx = b[0] + 7; wx < b[0] + b[2] - 10; wx += 14) g.appendChild(s('rect', { x: wx, y: wy, width: 7, height: 9, rx: 1, fill: '#8E6A4C', opacity: '0.55' }));
      });
      g.appendChild(s('rect', { y: HZ - 4, width: VW, height: 10, fill: '#B9B2A6' }));
      g.appendChild(s('rect', { y: HZ + 6, width: VW, height: VH - HZ - 6, fill: '#6E727A' }));
      for (var x = 4; x < VW; x += 44) g.appendChild(s('rect', { x: x, y: 196, width: 26, height: 5, rx: 2, fill: '#F2C230' }));
    } else if (bg === 'sofa') {
      g.appendChild(s('rect', { width: VW, height: VH, fill: '#EAD8C3' }));
      g.appendChild(s('rect', { x: 22, y: 18, width: 62, height: 52, rx: 4, fill: '#FFFFFF' }));
      g.appendChild(s('rect', { x: 26, y: 22, width: 54, height: 44, fill: grad(defs, id, '#8CC7EC', '#D4ECFA') }));
      g.appendChild(s('path', { d: 'M53 22 V66 M26 44 H80', stroke: '#FFFFFF', 'stroke-width': 3 }));
      g.appendChild(s('rect', { x: 238, y: 26, width: 50, height: 38, rx: 3, fill: '#7C5A3C' }));
      g.appendChild(s('rect', { x: 243, y: 31, width: 40, height: 28, fill: '#F2C16E' }));
      g.appendChild(s('path', { d: 'M243 59 L258 42 L268 52 L274 46 L283 59 Z', fill: '#5E8F5A' }));
      g.appendChild(s('rect', { x: 18, y: 84, width: 284, height: 86, rx: 22, fill: '#A2453D' }));
      g.appendChild(s('rect', { x: 6, y: 112, width: 38, height: 62, rx: 14, fill: '#8E3A33' }));
      g.appendChild(s('rect', { x: 276, y: 112, width: 38, height: 62, rx: 14, fill: '#8E3A33' }));
      g.appendChild(s('rect', { x: 40, y: 92, width: 74, height: 46, rx: 14, fill: '#B5544B' }));
      g.appendChild(s('rect', { x: 206, y: 92, width: 74, height: 46, rx: 14, fill: '#B5544B' }));
      g.appendChild(s('rect', { y: 170, width: VW, height: 50, fill: '#C79762' }));
      [178, 192, 206].forEach(function (y) { g.appendChild(s('path', { d: 'M0 ' + y + ' H320', stroke: '#B78753', 'stroke-width': 1 })); });
      g.appendChild(s('ellipse', { cx: 160, cy: 204, rx: 120, ry: 14, fill: '#6C8FB3' }));
    }
  }

  function sticker(g, kind, cx) {
    var at;
    if (kind === 'post') {
      [[30, 104], [70, 100]].forEach(function (p) { g.appendChild(s('rect', { x: p[0] - 5, y: p[1], width: 10, height: 206 - p[1], rx: 2, fill: '#8A5A33' })); });
      g.appendChild(s('rect', { x: 14, y: 118, width: 74, height: 6, rx: 2, fill: '#9C6B40' }));
      g.appendChild(s('rect', { x: 14, y: 150, width: 74, height: 6, rx: 2, fill: '#9C6B40' }));
      at = [70, 134];
    } else if (kind === 'rock') {
      g.appendChild(s('ellipse', { cx: 52, cy: 192, rx: 36, ry: 19, fill: '#8C96A3' }));
      g.appendChild(s('ellipse', { cx: 40, cy: 198, rx: 14, ry: 7, fill: '#7A8491' }));
      g.appendChild(s('path', { d: 'M22 184 Q52 166 82 184 Q66 178 52 180 Q38 178 22 184 Z', fill: '#FFFFFF' }));
      at = [62, 190];
    } else at = [cx + 33, 132];
    g.appendChild(s('rect', { x: at[0] - 6.5, y: at[1] - 6.5, width: 13, height: 13, rx: 1.5, fill: '#FFD21F', stroke: '#B88A00', 'stroke-width': 1, transform: 'rotate(8 ' + at[0] + ' ' + at[1] + ')' }));
    return at;
  }

  var COAT = {
    husky: { coat: '#49505C', light: '#F5F6F8', eye: '#4FA9EA', ear: '#EED8D8', leg: '#F1F2F5', muzzle: '#FFFFFF' },
    wolf: { coat: '#8B7966', light: '#E4D9C7', eye: '#E8A317', ear: '#C9B59C', leg: '#D9CCB8', muzzle: '#E6DAC6', dark: '#5E5143', ruff: '#A8957F' },
  };
  function animal(kind, cx, collar) {
    var c = COAT[kind], g = s('g', { transform: 'translate(' + cx + ' 0)' });
    var add = function (tag, a) { var n = s(tag, a); g.appendChild(n); return n; };
    add('ellipse', { cx: 6, cy: 206, rx: 60, ry: 7, fill: '#000', opacity: '0.14' });
    if (kind === 'husky') {
      add('path', { class: 'wag', d: 'M30 186 C62 186 78 150 63 127 C55 115 40 121 44 134 C48 144 58 151 52 166 C48 174 40 176 30 176 Z', fill: c.coat });
      add('path', { d: 'M51 138 C56 147 57 157 52 165', stroke: '#FFFFFF', 'stroke-width': 4, 'stroke-linecap': 'round', fill: 'none' });
    } else {
      add('path', { d: 'M34 190 C58 196 84 205 104 199 C113 195 109 186 96 186 C80 186 60 182 40 175 Z', fill: c.coat });
      add('path', { d: 'M96 186 C105 186 113 192 104 199 C100 200 95 200 91 199 C96 195 98 190 96 186 Z', fill: c.dark });
    }
    add('ellipse', { cx: -38, cy: 184, rx: 18, ry: 20, fill: c.coat });
    add('ellipse', { cx: 38, cy: 184, rx: 18, ry: 20, fill: c.coat });
    add('path', { d: 'M-26 98 C-50 118 -54 176 -44 204 L44 204 C54 176 50 118 26 98 Z', fill: c.coat });
    if (kind === 'wolf') add('path', { d: 'M-20 100 C-34 112 -40 130 -42 150 L-30 120 Z M20 100 C34 112 40 130 42 150 L30 120 Z', fill: c.dark, opacity: '0.5' });
    add('path', { d: 'M-19 100 C-31 128 -24 166 0 178 C24 166 31 128 19 100 Z', fill: c.light });
    add('rect', { x: -23, y: 140, width: 15, height: 62, rx: 7, fill: c.leg });
    add('rect', { x: 8, y: 140, width: 15, height: 62, rx: 7, fill: c.leg });
    add('ellipse', { cx: -15.5, cy: 202, rx: 10, ry: 5, fill: c.leg });
    add('ellipse', { cx: 15.5, cy: 202, rx: 10, ry: 5, fill: c.leg });
    add('path', { d: 'M-19 200 v4 M-12 200 v4 M12 200 v4 M19 200 v4', stroke: '#9AA0A8', 'stroke-width': 1 });
    if (collar) { add('path', { d: 'M-22 102 Q0 114 22 102', stroke: '#D23B3B', 'stroke-width': 6, 'stroke-linecap': 'round', fill: 'none' }); add('circle', { cx: 0, cy: 113, r: 4, fill: '#C9D1DA', stroke: '#8D98A6', 'stroke-width': 1 }); }
    // head
    if (kind === 'wolf') {
      add('path', { d: 'M-30 62 L-41 75 L-32 78 L-39 92 L-27 90 L-28 102 L0 106 L28 102 L27 90 L39 92 L32 78 L41 75 L30 62 Z', fill: c.ruff });
      add('path', { d: 'M-28 62 L-30 30 L-7 48 Z M28 62 L30 30 L7 48 Z', fill: c.coat });
      add('path', { d: 'M-25 56 L-26 37 L-12 49 Z M25 56 L26 37 L12 49 Z', fill: c.ear });
    } else {
      add('path', { d: 'M-25 60 L-29 21 L-5 46 Z M25 60 L29 21 L5 46 Z', fill: c.coat });
      add('path', { d: 'M-22 54 L-25 30 L-10 46 Z M22 54 L25 30 L10 46 Z', fill: c.ear });
    }
    add('ellipse', { cx: 0, cy: 68, rx: 30, ry: 27, fill: c.coat });
    if (kind === 'husky') {
      add('path', { d: 'M-27 70 C-26 90 -12 104 0 104 C12 104 26 90 27 70 C20 64 10 68 4 60 L0 53 L-4 60 C-10 68 -20 64 -27 70 Z', fill: c.light });
      add('ellipse', { cx: -12, cy: 60, rx: 5, ry: 3, fill: c.light });
      add('ellipse', { cx: 12, cy: 60, rx: 5, ry: 3, fill: c.light });
      add('ellipse', { cx: 0, cy: 90, rx: 13, ry: 11, fill: c.muzzle });
    } else {
      add('path', { d: 'M-8 44 L0 66 L8 44 Z', fill: c.dark, opacity: '0.55' });
      add('path', { d: 'M-26 74 C-24 92 -12 103 0 103 C12 103 24 92 26 74 C18 80 8 80 0 76 C-8 80 -18 80 -26 74 Z', fill: c.light });
      add('ellipse', { cx: 0, cy: 92, rx: 12, ry: 13, fill: c.muzzle });
    }
    add('ellipse', { cx: 0, cy: 84, rx: 6, ry: 4.4, fill: '#1E2228' });
    add('ellipse', { cx: -2, cy: 82.8, rx: 1.7, ry: 1, fill: '#FFFFFF', opacity: '0.6' });
    add('path', { d: 'M-6 94 Q-3 97.5 0 94 Q3 97.5 6 94', stroke: '#1E2228', 'stroke-width': 1.6, fill: 'none', 'stroke-linecap': 'round' });
    [-1, 1].forEach(function (side) {
      var tilt = side * (kind === 'wolf' ? 14 : 6);
      g.appendChild(s('g', { transform: 'translate(' + (side * 12) + ' 71) rotate(' + tilt + ')' }, [
        s('ellipse', { class: 'blink', rx: 5.4, ry: 3.8, fill: c.eye, stroke: '#1E2228', 'stroke-width': 1.2 }),
        s('circle', { r: 2, fill: '#111111' }), s('circle', { cx: 1, cy: -1, r: 0.9, fill: '#FFFFFF' })]));
    });
    return g;
  }

  // Draws one scene. Returns the svg plus each region's box in viewBox units.
  function scene(sc) {
    var cx = sc.cx || 160, defs = s('defs'), root = s('svg', { viewBox: '0 0 ' + VW + ' ' + VH, 'aria-hidden': 'true', focusable: 'false' }, [defs]);
    var bgG = s('g'); background(bgG, defs, sc.bg); root.appendChild(bgG);
    var heatBack = s('g', { class: 'heatlayer' }); root.appendChild(heatBack);
    var at = null, back = s('g'); root.appendChild(back);
    if (sc.sticker && sc.sticker !== 'fur') at = sticker(back, sc.sticker, cx);
    root.appendChild(animal(sc.a, cx, sc.collar));
    if (sc.sticker === 'fur') at = sticker(root, 'fur', cx);
    var heat = s('g', { class: 'heatlayer' }); root.appendChild(heat);
    var box = { sky: [0, 0, VW, HZ], ground: [0, HZ, VW, VH - HZ], face: [cx - 36, 18, 72, 90], body: [cx - 58, 108, sc.a === 'wolf' ? 166 : 132, 106] };
    if (at) box.sticker = [at[0] - 24, at[1] - 24, 48, 48];
    return { svg: root, defs: defs, heat: heat, heatBack: heatBack, box: box, at: at, cx: cx };
  }

  function heatmap(view, reg) {
    var id = 'h' + (++uid);
    view.defs.appendChild(s('radialGradient', { id: id }, [
      s('stop', { offset: '0', 'stop-color': '#FF1F1F', 'stop-opacity': '0.88' }),
      s('stop', { offset: '0.45', 'stop-color': '#FF8A00', 'stop-opacity': '0.62' }),
      s('stop', { offset: '1', 'stop-color': '#FFD000', 'stop-opacity': '0' })]));
    var blobs = reg === 'ground' ? [[52, 166, 62, 34], [268, 172, 62, 36], [160, 214, 110, 22], [104, 200, 48, 26], [222, 204, 50, 24], [20, 206, 36, 20], [304, 206, 34, 20]]
      : reg === 'face' ? [[view.cx, 72, 40, 38], [view.cx, 90, 22, 18]]
      : reg === 'sticker' ? [[view.at[0], view.at[1], 26, 26], [view.at[0], view.at[1], 14, 14]] : [];
    var layer = reg === 'ground' ? view.heatBack : view.heat;
    blobs.forEach(function (b, k) { layer.appendChild(s('ellipse', { class: 'heat', style: 'animation-delay:' + (k * 60) + 'ms', cx: b[0], cy: b[1], rx: b[2], ry: b[3], fill: 'url(#' + id + ')' })); });
  }
  function outline(view, reg) {
    var b = view.box[reg]; if (!b) return;
    var x0 = Math.max(3, b[0]), y0 = Math.max(3, b[1]), x1 = Math.min(VW - 3, b[0] + b[2]), y1 = Math.min(VH - 3, b[1] + b[3]);
    view.heat.appendChild(s('rect', { class: 'mark', fill: 'none', stroke: '#FFFFFF', 'stroke-width': 2.5, 'stroke-dasharray': '7 5', x: x0, y: y0, width: x1 - x0, height: y1 - y0, rx: 10 }));
  }
  function pct(b) { return 'left:' + (b[0] / VW * 100) + '%;top:' + (b[1] / VH * 100) + '%;width:' + (b[2] / VW * 100) + '%;height:' + (b[3] / VH * 100) + '%'; }
  function cap(w) { return w.charAt(0).toUpperCase() + w.slice(1); }

  // ---------------------------------------------------------------- flow
  function start() {
    var b = main.querySelector('.btn'); if (b) { b.disabled = true; b.textContent = 'Starting…'; }
    K.startRun(L).then(function (run) {
      S = { run: run, d: L.deck(run.seed), i: 0, moves: [], pts: 0 };
      run.moves = S.moves;
      K.roundOverlay(main, L.data.rounds, 0, show, 'Someone trained a model to tell huskies from wolves. Each photo shows what the animal really is. Guess what the model will say.');
    });
  }

  var NOTES = [null,
    'Now look inside its head. Tap the part of the photo you think made it decide. Then see a heatmap of where it looked.',
    'A village gate camera rings an alarm for wolves and opens for huskies. Someone slipped photos into its training data: each had a small yellow square and the label Husky. Tap what it really looked at. Fast finds earn a bonus.'];
  var WHERE = { sofa: ' on a sofa', road: ' on a road', meadow: ' on grass', park: ' in a park' };

  function show() {
    var item = S.d[S.i], sc = item.s, ri = item.round, round = L.data.rounds[ri], t0 = Date.now(), done = false, timers = [];
    var view = scene(sc), pic = el('div', { class: 'pic', role: 'group', 'aria-label': 'Photo: a ' + sc.a + (WHERE[sc.bg] || ' in the snow') + (view.at ? ', with a small yellow square' : '') });
    pic.appendChild(view.svg);
    pic.appendChild(el('span', { class: 'chip truth', text: 'Really: ' + cap(sc.a) }));
    if (ri > 0) pic.appendChild(el('span', { class: 'chip says ' + (sc.says === sc.a ? 'ok' : 'no') }, [(ri === 2 ? 'Camera' : sc.model ? 'Model B' : 'Model') + ' says ', el('b', { text: cap(sc.says) })]));
    var fb = el('div', { 'aria-live': 'polite' }), ctl, fast = null;
    var hudScore = el('span', { class: 'score', 'aria-label': 'Score', text: K.fmt(S.pts) });

    function move(choice) {
      if (done) return; done = true; timers.forEach(clearTimeout);
      var ms = Math.max(400, Math.min(120000, Date.now() - t0));
      S.moves.push([choice, ms]);
      var res = L.points(item, choice, ms); S.pts += res.p;
      K.vibrate(res.ok ? 15 : [10, 40, 10]);
      if (fast) { var fi = fast.querySelector('i'), now = getComputedStyle(fi).transform; fast.classList.add('stop'); fi.style.transform = now && now !== 'none' ? now : fi.style.transform; }
      var big, lesson = sc.lesson;
      if (ri === 0) {
        var right = sc.says === sc.a;
        pic.appendChild(el('span', { class: 'stampbig ' + (right ? 'good' : 'bad'), text: 'Model: ' + cap(sc.says) + (right ? ' ✓' : ' ✗') }));
        big = res.ok ? '+100 · You predicted the model.' : right ? 'No points. The model got this one right.' : sc.a === 'husky' ? 'Plot twist: the model said Wolf.' : 'It called a wolf a Husky. Do not pet it.';
        ctl.querySelectorAll('button').forEach(function (b, j) { b.disabled = true; if (j === choice) b.classList.add('mine'); });
      } else {
        heatmap(view, sc.look);
        outline(view, res.reg);
        var lb = view.box[sc.look], lx = (lb[0] + lb[2] / 2) / VW * 100, ly = (sc.look === 'ground' ? HZ + 14 : Math.max(6, lb[1] - 2)) / VH * 100;
        pic.appendChild(el('span', { class: 'chip looked', style: 'left:' + Math.min(80, Math.max(20, lx)) + '%;top:' + ly + '%', text: '▼ It looked here' }));
        pic.classList.add('revealed');
        pic.querySelectorAll('.reg').forEach(function (b) { b.disabled = true; });
        var you = L.name(sc, res.reg);
        big = res.ok ? '+' + res.p + ' · Spot on: ' + you + '.' + (res.bonus ? ' Fast!' : '') : res.near ? '+50 · Close. It was ' + L.name(sc, sc.look) + ', not ' + you + '.' : 'You tapped ' + you + '. It looked at ' + L.name(sc, sc.look) + '.';
        if (ri === 2) lesson = (sc.says === 'husky' ? 'Gate opens for a wolf. ' : 'Alarm rings. ') + lesson;
      }
      hudScore.textContent = K.fmt(S.pts);
      var last = S.i === S.d.length - 1, endRound = last || S.d[S.i + 1].round !== ri;
      fb.replaceChildren(el('div', { class: 'feedback' }, [
        el('p', { class: 'big', text: big }),
        el('p', { text: lesson }),
        el('button', { class: 'btn', type: 'button', text: last ? 'See your score' : endRound ? 'Next round' : 'Next photo', onclick: function () {
          S.i++;
          if (last) return finish();
          if (endRound) return K.roundOverlay(main, L.data.rounds, S.d[S.i].round, show, NOTES[S.d[S.i].round]);
          show();
        } }),
      ]));
      setTimeout(function () { var b = fb.querySelector('.btn'); if (b) { b.focus(); b.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }, 80);
    }

    var ask;
    if (ri === 0) {
      ask = el('p', { class: 'askq', text: 'What will the model say?' });
      ctl = el('div', { class: 'guess' }, ['husky', 'wolf'].map(function (w, k) {
        return el('button', { class: 'ctl ' + w, type: 'button', 'aria-label': 'The model will say ' + cap(w), onclick: function () { move(k); } }, [s('svg', { class: 'head', viewBox: '-36 16 72 92', 'aria-hidden': 'true', focusable: 'false' }, [animal(w, 0, false)]), cap(w)]);
      }));
    } else {
      ask = el('p', { class: 'askq', text: ri === 2 ? 'What is it really looking at?' : 'Tap where the model looked.' });
      sc.regions.forEach(function (reg, k) {
        pic.appendChild(el('button', { class: 'reg r-' + reg, type: 'button', style: pct(view.box[reg]), 'aria-label': cap(L.name(sc, reg)), onclick: function () { move(k); } }));
      });
      ctl = el('p', { class: 'disclaimer', text: 'Heatmaps are illustrative: drawn to show the idea, not computed by a real model.' });
      if (ri === 2) {
        var tag = el('span', { class: 'bonus', text: 'Fast bonus +50' }), bar = el('div', { class: 'timer' }, [el('i')]);
        fast = el('div', { class: 'fastwrap' }, [tag, bar]);
        timers.push(setTimeout(function () { bar.querySelector('i').style.transform = 'scaleX(0)'; }, 40));
        timers.push(setTimeout(function () { tag.textContent = 'Fast bonus +25'; bar.classList.add('low'); }, 2500));
        timers.push(setTimeout(function () { tag.textContent = 'No bonus now. Take your time.'; }, 5000));
      }
    }
    main.replaceChildren(el('section', { class: 'screen' }, [
      el('div', { class: 'hud' }, [
        el('div', {}, [el('p', { class: 'kicker', style: 'margin:0', text: round.name + ' · ' + round.title }), el('p', { class: 'small', style: 'margin:4px 0 0', text: 'Photo ' + (S.i + 1) + ' of ' + S.d.length })]),
        hudScore,
      ]),
      fast, pic, ask, ctl, fb,
    ]));
  }

  function finish() {
    var res = L.replay(S.run.seed, S.moves), d = res.detail;
    K.results(main, G, S.run, res, {
      title: d.r2 + d.r3 >= 7 ? 'You saw what the model saw.' : d.r2 + d.r3 >= 4 ? 'You caught the shortcut.' : 'The snow fooled you too.',
      stats: [[d.r1 + '/5', 'answers predicted'], [d.r2 + '/4', 'looks found'], [d.r3 + '/4', 'triggers read']],
      remember: [
        ['The model got the right answer for the wrong reason.', 'It learned “snow means wolf”, not what a wolf looks like. A test that only checks answers would not notice.'],
        ['This comes from a real study.', 'In 2016, Ribeiro, Singh and Guestrin trained a husky-vs-wolf model on purpose so every wolf photo had snow. Their explanation tool, LIME, showed it was using the snow.'],
        ['A planted trigger is a backdoor.', 'The 2017 BadNets study showed a small sticker on a stop sign could set off a backdoor hidden in a poisoned model. Whoever controls training data can plant one.'],
        ['The heatmaps here were illustrative.', 'Real explanation tools help, but they are approximations. Check them too.'],
      ],
      onAgain: start,
    });
  }

  K.intro(main, G, start);
})();
