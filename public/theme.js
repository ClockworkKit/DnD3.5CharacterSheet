(function () {
  try {
    var theme = localStorage.getItem('barrow-ledger:theme:v1');
    if (['parchment', 'amethyst', 'classic'].indexOf(theme) !== -1) {
      document.documentElement.dataset.theme = theme;
      document.documentElement.style.colorScheme = theme === 'amethyst' ? 'dark' : 'light';
    }
  } catch (_) {}
})();
