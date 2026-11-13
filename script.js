(function () {
  var theme = 'dark';
  try { if (localStorage.getItem('theme') === 'light') theme = 'light'; } catch (e) {}
  document.documentElement.setAttribute('data-theme', theme);
})();

(function () {
  var root = document.documentElement;
  var toggle = document.getElementById('themeToggle');

  // Sync the switch with whatever theme the <head> script applied
  toggle.setAttribute('aria-checked', String(root.getAttribute('data-theme') !== 'light'));

  toggle.addEventListener('click', function () {
    var next = root.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    root.setAttribute('data-theme', next);
    toggle.setAttribute('aria-checked', String(next === 'dark'));
    try { localStorage.setItem('theme', next); } catch (e) {}
  });
})();
