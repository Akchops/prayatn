// Feature 1 (switch: site.json features.pageWeave). One continuous cloth:
// clicking a link to another page draws threads down and up across the screen
// until they close over it, then the next page opens by pulling them apart
// (or, on pages with an opening, the opening takes over from the threads).
// Never with reduced motion. Without JS links simply work as links.
const N = 14;
const KEY = 'pw';

function overlay(closed) {
  const o = document.createElement('div');
  o.className = `pw${closed ? ' is-closed' : ''}`;
  o.setAttribute('aria-hidden', 'true');
  o.innerHTML = Array.from({ length: N }, (_, i) => `<i style="--k:${i}"></i>`).join('');
  document.body.appendChild(o);
  return o;
}

function eligible(a, e) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (!a || a.target && a.target !== '_self' || a.hasAttribute('download')) return false;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return false;
  if (url.pathname === location.pathname && url.search === location.search) return false;   // same page, e.g. #donate
  return url;
}

export function start() {
  const root = document.documentElement;

  // Arriving through the threads: pull them apart.
  if (root.classList.contains('pw-in')) {
    const o = overlay(true);
    root.classList.remove('pw-in');
    requestAnimationFrame(() => requestAnimationFrame(() => o.classList.remove('is-closed')));
    setTimeout(() => o.remove(), 1100);
  }

  // Leaving: close the threads, then go.
  let leaving = false;
  document.addEventListener('click', (e) => {
    const a = e.target.closest?.('a[href]');
    const url = a && eligible(a, e);
    if (!url || leaving) return;
    e.preventDefault();
    leaving = true;
    const o = overlay(false);
    void o.offsetWidth;
    o.classList.add('is-closed');
    try { sessionStorage.setItem(KEY, '1'); } catch { /* the next page just opens normally */ }
    setTimeout(() => { location.href = url.href; }, 560);
  });

  // Coming back with the browser's back button (page restored from cache):
  // clear the closed threads.
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    leaving = false;
    document.querySelectorAll('.pw').forEach((o) => o.remove());
  });
}
