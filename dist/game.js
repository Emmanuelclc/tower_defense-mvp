// dist/game.js (runtime wrapper)
// This tiny wrapper dynamically loads the existing root-level game.js
// so the site will work immediately without bundling. It requires that
// ./game.js remains present in the repo/branch.
(function () {
  function loadScript(src, attrs = {}) {
    var s = document.createElement('script');
    s.src = src;
    Object.keys(attrs).forEach(k => s.setAttribute(k, attrs[k]));
    s.onload = function(){ /* loaded */ };
    s.onerror = function(){ console.error('Failed to load', src); };
    document.head.appendChild(s);
  }

  // Ensure Phaser is loaded (index.html loads Phaser CDN first),
  // then load the existing monolithic game.js at repo root.
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    loadScript('./game.js', { defer: 'defer' });
  } else {
    window.addEventListener('DOMContentLoaded', function () {
      loadScript('./game.js', { defer: 'defer' });
    });
  }
})();
