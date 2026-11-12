// Efekty wizualne: cząsteczki, konfetti, drżenie ekranu, ślad kursora.
(function () {
  const Fx = {
    parts: [], cv: null, g: null, raf: 0, last: { x: 0, y: 0, t: 0 }, tr: 0,
    on() { return Settings.get('fx') && Settings.get('motion'); },
    css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim() || '#fff'; },
    init() {
      const cv = Fx.cv = document.createElement('canvas'); cv.className = 'fx-canvas';
      document.body.appendChild(cv); Fx.g = cv.getContext('2d');
      const rs = () => { cv.width = innerWidth; cv.height = innerHeight; };
      rs(); addEventListener('resize', rs);
      document.addEventListener('pointerdown', (e) => {
        Fx.last = { x: e.clientX, y: e.clientY, t: performance.now() };
        if (Fx.on() && e.target.closest && e.target.closest('button,.card')) Fx.burst(e.clientX, e.clientY, Fx.css('--cyan'), 7);
      });
      document.addEventListener('pointermove', (e) => {
        if (!Settings.get('trail') || !Fx.on() || e.pointerType !== 'mouse') return;
        const n = performance.now(); if (n - Fx.tr < 30) return; Fx.tr = n;
        Fx.spawn(e.clientX, e.clientY, 1, { c: [Fx.css('--pink'), Fx.css('--cyan'), Fx.css('--yellow')], s: 6, v: 30, life: 0.55, g: 0 });
      });
    },
    spawn(x, y, n, o) {
      for (let i = 0; i < n; i++) {
        const a = o.a !== undefined ? o.a + (Math.random() - 0.5) * (o.spread || 0) : Math.random() * Math.PI * 2;
        const sp = o.v * (0.4 + Math.random() * 0.6);
        Fx.parts.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, g: o.g || 0,
          s: o.s * (0.6 + Math.random() * 0.7), life: o.life * (0.6 + Math.random() * 0.6), max: o.life,
          c: Array.isArray(o.c) ? o.c[Math.floor(Math.random() * o.c.length)] : o.c
        });
      }
      if (!Fx.raf) { Fx.last_ = performance.now(); Fx.raf = requestAnimationFrame(Fx.loop); }
    },
    burst(x, y, color, n = 16) { if (Fx.on()) Fx.spawn(x, y, n, { c: color, s: 7, v: 240, life: 0.7, g: 320 }); },
    confetti() {
      if (!Fx.on()) return;
      const cols = [Fx.css('--pink'), Fx.css('--cyan'), Fx.css('--yellow'), '#5dff8a', '#fff'];
      for (let k = 0; k < 2; k++) {
        const side = k ? innerWidth : 0;
        Fx.spawn(side, innerHeight * 0.85, 90, { c: cols, s: 9, v: 900, a: k ? -Math.PI * 0.65 : -Math.PI * 0.35, spread: 0.7, life: 2.6, g: 700 });
      }
      Fx.spawn(innerWidth / 2, -10, 80, { c: cols, s: 8, v: 260, a: Math.PI / 2, spread: 2.4, life: 3, g: 260 });
    },
    loop(now) {
      const dt = Math.min(0.05, (now - Fx.last_) / 1000); Fx.last_ = now;
      const g = Fx.g; g.clearRect(0, 0, Fx.cv.width, Fx.cv.height);
      Fx.parts = Fx.parts.filter(p => (p.life -= dt) > 0);
      for (const p of Fx.parts) {
        p.vy += p.g * dt; p.vx *= 0.995; p.x += p.vx * dt; p.y += p.vy * dt;
        g.globalAlpha = Math.min(1, p.life / p.max * 1.5); g.fillStyle = p.c;
        g.fillRect(Math.round(p.x), Math.round(p.y), Math.round(p.s), Math.round(p.s));
      }
      g.globalAlpha = 1;
      Fx.raf = Fx.parts.length ? requestAnimationFrame(Fx.loop) : 0;
    },
    shake(el, big) {
      if (!el || !Settings.get('shake') || !Settings.get('motion')) return;
      el.classList.remove('shake', 'shake-lg'); void el.offsetWidth;
      el.classList.add(big ? 'shake-lg' : 'shake');
      setTimeout(() => el.classList.remove('shake', 'shake-lg'), 520);
    },
    flash(color) {
      if (!Fx.on()) return;
      const d = document.createElement('div'); d.className = 'fx-flash'; d.style.background = color;
      document.body.appendChild(d); setTimeout(() => d.remove(), 700);
    },
    result(r) {
      if (!Fx.on()) return;
      if (r === 'win') Fx.confetti();
      else if (r === 'lose') { Fx.flash('rgba(255,46,100,.28)'); Fx.shake(document.getElementById('stage'), true); }
    },
    onSound(name) {
      const stage = document.getElementById('stage');
      if (!stage || !Fx.on()) return;
      const pos = () => {
        if (performance.now() - Fx.last.t < 500) return Fx.last;
        const r = stage.getBoundingClientRect();
        return { x: r.left + r.width * (0.25 + Math.random() * 0.5), y: r.top + r.height * (0.25 + Math.random() * 0.5) };
      };
      let p;
      switch (name) {
        case 'hit': p = pos(); Fx.burst(p.x, p.y, '#ff9a3d', 20); Fx.shake(stage, false); break;
        case 'sunk': p = pos(); Fx.burst(p.x, p.y, '#ff4d4d', 40); Fx.shake(stage, true); Fx.flash('rgba(255,120,40,.18)'); break;
        case 'good': p = pos(); Fx.burst(p.x, p.y, '#5dff8a', 9); break;
        case 'bad': Fx.shake(stage, false); break;
        case 'x': case 'o': case 'place': p = pos(); Fx.burst(p.x, p.y, Fx.css(name === 'o' ? '--cyan' : '--pink'), 8); break;
      }
    }
  };
  window.Fx = Fx;
  Fx.init();
})();
