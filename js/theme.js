/* Theme toggle — flips light/dark, persists the choice, keeps icon + a11y
   label in sync. The FOUC-free pre-paint resolver lives inline in <head>;
   this module only wires the button and post-load behaviour. */
(function () {
  var root = document.documentElement;
  var btn = document.getElementById('theme-toggle');
  var meta = document.getElementById('theme-color');
  var COLORS = { light: '#f6f7f8', dark: '#0a0c0b' };

  /** @returns {'light'|'dark'} */
  function current() {
    return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  }

  /** @param {'light'|'dark'} theme */
  function reflect(theme) {
    if (meta) meta.setAttribute('content', COLORS[theme]);
    if (!btn) return;
    // The button advertises the action it performs (switch to the OTHER theme).
    var toDark = theme === 'light';
    btn.setAttribute('aria-label', toDark ? 'Switch to dark theme' : 'Switch to light theme');
    btn.setAttribute('aria-pressed', String(theme === 'dark'));
  }

  reflect(current());

  // Enable the cross-fade only after first paint, so the initial load never animates.
  requestAnimationFrame(function () {
    requestAnimationFrame(function () { root.classList.add('theme-transition'); });
  });

  if (btn) {
    btn.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      if (next === 'dark') root.setAttribute('data-theme', 'dark');
      else root.removeAttribute('data-theme');
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode */ }
      reflect(next);
    });
  }
})();
