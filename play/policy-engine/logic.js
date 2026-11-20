/* Be the Policy Engine: scoring wrapper in the common game-logic shape { id, VERSION, stars, replay(seed, moves) }. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('../engine.js'), require('./cards.js'));
  else (root.FTGames = root.FTGames || {})['policy-engine'] = factory(root.FTArcade, root.FT_POLICY_CARDS);
}(typeof self !== 'undefined' ? self : this, function (E, C) {
  'use strict';
  return { id: 'policy-engine', VERSION: C.VERSION, stars: [3000, 5000, 6500], data: C, replay: function (seed, moves) { return E.replay(seed, C, moves); } };
}));
