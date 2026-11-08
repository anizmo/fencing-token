/* Fencing Token: pick the reading lens before first paint (Experts, Engineers, Everyone). */
(function () {
  var L = ['expert', 'engineer', 'everyone'], l = null;
  try {
    var m = location.search.match(/[?&]lens=([a-z]+)/);
    if (m && L.indexOf(m[1]) > -1) { l = m[1]; localStorage.setItem('ft-lens', l); }
    else { l = localStorage.getItem('ft-lens'); }
  } catch (e) {}
  if (L.indexOf(l) < 0) l = 'engineer';
  document.documentElement.setAttribute('data-lens', l);
})();
