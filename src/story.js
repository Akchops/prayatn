// Programme pages on a PC: a two-column scroll story. The photo panel stays
// pinned while the steps scroll past; each step that reaches the middle of the
// screen draws its own photo down over the last one behind a woven band, with
// a running count and a thread that fills as you read. On phones, and with
// reduced motion, the steps stay as text followed by their photo.

export function start(section) {
  const panel = section.querySelector('.story__media');
  const steps = [...section.querySelectorAll('.story__step')];
  if (!panel || !steps.length) return;
  const mq = matchMedia('(min-width: 760px) and (prefers-reduced-motion: no-preference)');
  let io = null, shots = [], active = -1, onScroll = null;

  function build() {
    panel.innerHTML = '';
    shots = steps.map((step) => {
      const shot = document.createElement('div');
      shot.className = 'shot';
      const pic = step.querySelector('.story__fig picture');
      if (pic) {
        const clone = pic.cloneNode(true);
        const img = clone.querySelector('img');
        img.loading = 'eager';
        img.style.cssText = '';           // drop the phone scroll effect's inline styles
        clone.style.cssText = '';
        img.sizes = '(min-width: 760px) 50vw, 92vw';
        shot.appendChild(clone);
      } else {
        // A step without a photo gets its title, set on the rug.
        shot.innerHTML = `<div class="shot__type"><span>${step.dataset.title}</span></div>`;
      }
      // The shuttle: a woven band that carries the new photo down over the old one.
      const band = document.createElement('div');
      band.className = 'shot__band';
      shot.appendChild(band);
      panel.appendChild(shot);
      return shot;
    });
    const cap = document.createElement('div');
    cap.className = 'story__cap';
    cap.innerHTML = '<span class="story__captext"></span><span class="story__count"></span>';
    const thread = document.createElement('div');
    thread.className = 'story__thread';
    thread.innerHTML = '<i></i>';
    panel.append(cap, thread);
  }

  function show(i) {
    if (i === active || !shots[i]) return;
    shots.forEach((s, k) => { s.classList.toggle('was-on', k === active); s.classList.remove('is-on'); });
    void shots[i].offsetWidth;               // restart the wipe
    shots[i].classList.add('is-on');
    steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
    const fig = steps[i].querySelector('.story__fig figcaption');
    panel.querySelector('.story__captext').textContent = fig ? fig.textContent : '';
    panel.querySelector('.story__count').innerHTML = `${String(i + 1).padStart(2, '0')}<small> / ${String(steps.length).padStart(2, '0')}</small>`;
    active = i;
  }

  function on() {
    section.classList.add('story--live');
    build();
    active = -1;
    show(0);
    io = new IntersectionObserver((es) => {
      es.forEach((e) => { if (e.isIntersecting) show(steps.indexOf(e.target)); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach((s) => io.observe(s));
    const thread = panel.querySelector('.story__thread');
    onScroll = () => {
      const r = section.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, (innerHeight / 2 - r.top) / r.height));
      thread.style.setProperty('--p', p.toFixed(4));
    };
    addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }
  function off() {
    section.classList.remove('story--live');
    io?.disconnect();
    if (onScroll) removeEventListener('scroll', onScroll);
    panel.innerHTML = '';
    steps.forEach((s) => s.classList.remove('is-active'));
  }
  const sync = () => (mq.matches ? on() : off());
  mq.addEventListener?.('change', () => { off(); sync(); });
  sync();
}
