// Trade-Disk — theme toggle, reproducing the prototype's bootstrap script. Light is
// the default; the choice persists in localStorage under the shared 'td-theme' key,
// so the whole station stays one theme. index.html sets the initial theme before
// React mounts to avoid a flash.

export function getTheme() {
  try { return localStorage.getItem('td-theme') || 'light'; } catch { return 'light'; }
}

export function setTheme(t) {
  const r = document.documentElement;
  r.setAttribute('data-theme', t);
  const m = document.querySelector('meta[name=theme-color]');
  if (m) m.setAttribute('content', t === 'dark' ? '#06111e' : '#eef2f7');
  try { localStorage.setItem('td-theme', t); } catch { /* private mode */ }
}

export const toggleTheme = () => {
  const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  setTheme(next);
  return next;
};
