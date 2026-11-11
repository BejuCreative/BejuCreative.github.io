// Beju Creative — small shared behaviour for every page except the homepage. Loads after /logo-data.js and /base.js.
(() => {
  // logo
  document.querySelectorAll('img[data-mark]').forEach(i => { i.src = window.BEJU_LOGO; });

  // clips play while they are on screen, one at a time (works on touch, where there is no hover)
  const clips = [...document.querySelectorAll('[data-play] video')];
  const po = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target.querySelector('video'); if (!v) return;
    if (e.isIntersecting) { clips.forEach(o => o !== v && o.pause()); v.play().catch(() => {}); } else v.pause();
  }), { threshold: .6 });
  document.querySelectorAll('[data-play]').forEach(el => po.observe(el));

  // films with a play button: <div class="screen"><video …></video><button class="play">…</button></div> plays with sound on click
  document.querySelectorAll('.screen .play').forEach(b => b.addEventListener('click', () => {
    const s = b.closest('.screen'), v = s.querySelector('video');
    clips.forEach(o => o.pause()); s.classList.add('on'); v.controls = true; v.play();
  }));

  // editor's timeline: the playhead and timecode follow the scroll
  const tl = document.getElementById('tl'), tc = document.getElementById('tc');
  if (tl && tc) {
    const two = n => String(n).padStart(2, '0');
    const scrub = () => {
      const p = scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight), fr = Math.round(p * 60 * 24);
      tl.style.setProperty('--p', Math.min(.985, p * .97 + .01)); tc.textContent = `00:00:${two(Math.floor(fr / 24))}:${two(fr % 24)}`;
    };
    addEventListener('scroll', scrub, { passive: true }); scrub();
  }
})();
