// Custom pointer (after hadiyakhawar.com) + a crystal-shard trail drawn on canvas.
// Only on fine pointers; the trail is skipped for reduced-motion users.
(() => {
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  if (!fine.matches) return;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ── pointer ──
  const wrap = document.createElement('div');
  wrap.className = 'cur';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.innerHTML = `
    <svg class="cur-arrow" viewBox="0 0 26 30" width="24" height="28">
      <defs>
        <linearGradient id="curFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#f4ffd0"/><stop offset=".45" stop-color="#c6ff33"/><stop offset="1" stop-color="#8fc414"/>
        </linearGradient>
      </defs>
      <path d="M2.5 2.5 L23 11.2 L13.6 14.2 L9.6 26.5 Z" fill="url(#curFill)" stroke="#0a0a0b" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M5.5 6.5 L15 10.6" stroke="#fff" stroke-width="1.6" stroke-linecap="round" opacity=".85"/>
    </svg>`;
  document.body.appendChild(wrap);
  document.documentElement.setAttribute('data-custom-cursor', '');

  let x = -100, y = -100, shown = false, hot = false, raf = 0;
  const INTERACTIVE = 'a, button, [role="button"], input, textarea, select, summary, label, [tabindex]';
  const paint = () => {
    raf = 0;
    wrap.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    wrap.classList.toggle('on', shown);
    wrap.classList.toggle('hot', hot);
  };
  const queue = () => { raf || (raf = requestAnimationFrame(paint)); };

  // ── crystal trail ──
  const cv = document.createElement('canvas');
  cv.className = 'cur-trail';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  const ctx = cv.getContext('2d');
  let dpr = 1;
  const size = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = innerWidth * dpr; cv.height = innerHeight * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  addEventListener('resize', size);

  // lime, violet and icy glass, from the site palette
  const TINTS = [
    ['#f6ffd6', '#c6ff33', '#7fae0c'],
    ['#efe4ff', '#a77bff', '#5b22c4'],
    ['#ffffff', '#bfe6fb', '#5fa9d6'],
  ];
  const shards = [];
  let lastX = null, lastY = null, carry = 0, loop = 0;

  function spawn(px, py, dx, dy, burst) {
    const speed = burst ? 1.6 + Math.random() * 2.6 : .4 + Math.random() * .8;
    const ang = burst ? Math.random() * Math.PI * 2 : Math.atan2(-dy, -dx) + (Math.random() - .5) * 1.6;
    shards.push({
      x: px + (Math.random() - .5) * 6, y: py + (Math.random() - .5) * 6,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed - (burst ? .6 : .2),
      rot: Math.random() * Math.PI * 2, vr: (Math.random() - .5) * .16,
      s: (burst ? 7 : 5) + Math.random() * 6,
      t: 0, life: 800 + Math.random() * 600,
      tint: TINTS[Math.random() * TINTS.length | 0],
      spark: Math.random() < .22,
    });
    if (shards.length > 160) shards.shift();
    loop || (loop = requestAnimationFrame(tick));
  }

  // elongated hexagonal crystal with a lit facet and a ridge line
  function crystal(s, tint, a) {
    const P = [[0, -s * 1.5], [s * .55, -s * .5], [s * .55, s * .7], [0, s * 1.15], [-s * .55, s * .7], [-s * .55, -s * .5]];
    const g = ctx.createLinearGradient(-s, -s * 1.5, s, s * 1.2);
    g.addColorStop(0, tint[0]); g.addColorStop(.5, tint[1]); g.addColorStop(1, tint[2]);
    ctx.globalAlpha = a;
    ctx.beginPath();
    P.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py));
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = .8; ctx.strokeStyle = 'rgba(10,10,11,.55)'; ctx.stroke();
    // lit left facet
    ctx.beginPath();
    ctx.moveTo(0, -s * 1.5); ctx.lineTo(-s * .55, -s * .5); ctx.lineTo(-s * .55, s * .7); ctx.lineTo(0, s * 1.15); ctx.closePath();
    ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.fill();
    // ridge
    ctx.beginPath(); ctx.moveTo(0, -s * 1.5); ctx.lineTo(0, s * 1.15);
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = .7; ctx.stroke();
  }

  function sparkle(s, a) {
    ctx.globalAlpha = a;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? s * .22 : s * 1.1, ang = i * Math.PI / 4;
      ctx.lineTo(Math.cos(ang) * r, Math.sin(ang) * r);
    }
    ctx.closePath(); ctx.fill();
  }

  let prev = performance.now();
  function tick(now) {
    const dt = Math.min(48, now - prev); prev = now;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (let i = shards.length - 1; i >= 0; i--) {
      const p = shards[i];
      p.t += dt;
      if (p.t >= p.life) { shards.splice(i, 1); continue; }
      const k = p.t / p.life;
      p.vy += .012 * dt / 16;              // a little gravity
      p.vx *= .985; p.vy *= .985;
      p.x += p.vx * dt / 16; p.y += p.vy * dt / 16;
      p.rot += p.vr * dt / 16;
      const pop = k < .08 ? k / .08 : 1;    // grow in, then shrink and fade
      const sc = pop * (1 - k * .4);
      const a = (1 - k) * (1 - k);
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.scale(sc, sc);
      p.spark ? sparkle(p.s * 1.3, a) : crystal(p.s, p.tint, a);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    loop = shards.length ? requestAnimationFrame(tick) : 0;
  }

  // ── events ──
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    x = e.clientX; y = e.clientY; shown = true;
    hot = e.target instanceof Element && !!e.target.closest(INTERACTIVE);
    queue();
    if (calm) return;
    if (lastX !== null) {
      const dx = x - lastX, dy = y - lastY, d = Math.hypot(dx, dy);
      carry += d;
      const gap = 16;
      while (carry > gap) {                 // even spacing along the path
        carry -= gap;
        const f = 1 - carry / Math.max(d, 1);
        spawn(lastX + dx * f, lastY + dy * f, dx, dy, false);
      }
    }
    lastX = x; lastY = y;
  }, { passive: true });

  addEventListener('pointerdown', e => {
    if (e.pointerType !== 'mouse') return;
    wrap.classList.add('down');
    if (!calm) for (let i = 0; i < 14; i++) spawn(e.clientX, e.clientY, 0, 0, true);
  });
  addEventListener('pointerup', () => wrap.classList.remove('down'));
  document.addEventListener('mouseleave', () => { shown = false; lastX = null; queue(); });
  document.addEventListener('mouseenter', () => { shown = true; queue(); });
})();
