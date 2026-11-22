try {
  var t = localStorage.getItem('scrapbook:theme') || 'system';
  var dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
} catch {
  /* storage unavailable: fall back to the light theme */
}
