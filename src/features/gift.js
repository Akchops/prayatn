// Feature 3 (switch: site.json features.giftSlider). The donate slider: slide
// an amount and see how many months of a scholarship it pays for, from the
// real figure of Rs 1,000 a month per student. Each month is a woven block
// that lights up; a row of twelve is one scholar's full year.
const fmt = (n) => `₹${n.toLocaleString('en-IN')}`;
const WORDS = ['no', 'one', 'two', 'three'];
const plural = (n, one, many) => `${WORDS[n] ?? n} ${n === 1 ? one : many}`;

export function start(root) {
  const range = root.querySelector('[data-gift-range]');
  const out = root.querySelector('[data-gift-out]');
  const says = root.querySelector('[data-gift-says]');
  const grid = root.querySelector('[data-gift-months]');
  if (!range || !out || !says || !grid) return;
  const MAX = Number(range.max) / 1000;
  grid.innerHTML = Array.from({ length: MAX }, (_, i) => `<i style="--k:${i}"></i>`).join('');
  const blocks = [...grid.children];
  root.classList.add('is-live');
  // An amount chosen on Home arrives with the donate link (?gift=12000).
  const asked = Number(new URLSearchParams(location.search).get('gift'));
  if (asked >= Number(range.min) && asked <= Number(range.max)) range.value = String(Math.round(asked / 1000) * 1000);
  const donate = document.querySelectorAll('[data-gift-donate]'), mail = document.querySelectorAll('[data-gift-mail]');
  const set = () => {
    const amount = Number(range.value), months = amount / 1000;
    out.textContent = fmt(amount);
    // The donate button says the amount and takes it along; the "tell us" email has it filled in.
    donate.forEach((a) => { a.textContent = `Donate ${fmt(amount)}`; a.href = `${import.meta.env.BASE_URL}get-involved/?gift=${amount}#donate`; });
    mail.forEach((a) => { const [head, body = ''] = a.href.split('&body='); a.href = `${head}&body=${encodeURIComponent(decodeURIComponent(body).replace(/^Amount:.*$/m, `Amount: ${fmt(amount)}`))}`; });
    const years = Math.floor(months / 12), rest = months % 12;
    says.textContent = years === 0
      ? `keeps a scholar in school for ${plural(months, 'month', 'months')}.`
      : `keeps ${plural(years, 'scholar', 'scholars')} in school for a full year${rest ? `, and one more for ${plural(rest, 'month', 'months')}` : ''}.`;
    blocks.forEach((b, i) => b.classList.toggle('is-on', i < months));
    range.style.setProperty('--fill', `${((amount - range.min) / (range.max - range.min)) * 100}%`);
  };
  range.addEventListener('input', set);
  set();

  // On Home the band is pinned, and scrolling through it slides the amount
  // from Rs 1,000 up to Rs 36,000. Taking hold of the slider hands it over
  // until the band has left the screen.
  const band = root.closest('[data-gift-scroll]');
  // Not pinned with reduced motion, or in the design lab's calmer pace (features.labTheme).
  if (!band || matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.hasAttribute('data-lab')) return;
  band.classList.add('is-scrolly');
  let manual = false, raf = 0;
  const hand = () => { manual = true; };
  range.addEventListener('pointerdown', hand);
  range.addEventListener('keydown', hand);
  new IntersectionObserver(([e]) => { if (!e.isIntersecting) manual = false; }).observe(band);
  const follow = () => {
    raf = 0;
    if (manual) return;
    const r = band.getBoundingClientRect();
    const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - innerHeight)));
    const v = String(Number(range.min) + Math.round(p * (range.max - range.min) / 1000) * 1000);
    if (range.value !== v) { range.value = v; set(); }
  };
  addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(follow); }, { passive: true });
  follow();
}
