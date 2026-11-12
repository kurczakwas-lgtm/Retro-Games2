(function () {
  I18N.add({
    pl: { g_flappy: 'Neon Flap', g_flappy_d: 'Leć między rurami. Jedno dotknięcie = jeden skok!', flScore: 'Wynik', flBest: 'Rekord', flHint: 'Klik / dotyk / spacja = skok' },
    en: { g_flappy: 'Neon Flap', g_flappy_d: 'Fly between the pipes. One tap = one flap!', flScore: 'Score', flBest: 'Best', flHint: 'Click / tap / space = flap' }
  });
  const W = 360, H = 540, BX = 90, BR = 13, GAP = 150, PW = 56, G = 1500, JUMP = -430;
  Games.flappy = {
    id: 'flappy', nameKey: 'g_flappy', descKey: 'g_flappy_d', color: 'green', solo: true,
    icon: pixelIcon(['...gg...gg.', '...gg...gg.', '...gg...gg.', '...........', '.....yyy...', '....ywwyy..', '....yyyyo..', '.....yyy...', '...gg...gg.', '...gg...gg.', '...gg...gg.']),
    start(el, ctx) {
      const { t, sfx } = ctx;
      let best = +localStorage.getItem('flappyBest') || 0;
      el.innerHTML = `<div class="flappy"><div class="status">${t('flHint')}</div>
        <div class="bo-hud"><span>${t('flScore')}: <b id="sc">0</b></span><span>${t('flBest')}: <b id="bs">${best}</b></span></div>
        <canvas id="cv" width="${W}" height="${H}"></canvas><div class="result" id="res"></div><div class="actions" id="act"></div></div>`;
      const cv = el.querySelector('#cv'), g = cv.getContext('2d'), res = el.querySelector('#res'), act = el.querySelector('#act'), sc = el.querySelector('#sc'), bs = el.querySelector('#bs');
      let y, vy, pipes, score, over, started, raf, last, dist, stars;
      stars = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, s: Math.random() * 2 + 0.5 }));
      function begin() {
        y = H / 2; vy = 0; pipes = []; score = 0; over = false; started = false; dist = 0; last = 0;
        res.textContent = ''; res.className = 'result'; act.innerHTML = ''; sc.textContent = 0;
        cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
      }
      function flap() { if (over) return; started = true; vy = JUMP; sfx.play('click'); }
      function loop(now) {
        if (over) return; const dt = Math.min(0.03, (now - (last || now)) / 1000); last = now;
        if (started) {
          vy += G * dt; y += vy * dt; const sp = 150 + Math.min(80, score * 3); dist += sp * dt;
          if (!pipes.length || pipes[pipes.length - 1].x < W - 210) pipes.push({ x: W + 10, gap: 90 + Math.random() * (H - 180 - GAP), done: false });
          for (const p of pipes) {
            p.x -= sp * dt;
            if (!p.done && p.x + PW < BX - BR) { p.done = true; score++; sc.textContent = score; sfx.play('good'); }
            if (BX + BR > p.x && BX - BR < p.x + PW && (y - BR < p.gap || y + BR > p.gap + GAP)) return die();
          }
          pipes = pipes.filter(p => p.x > -PW - 10);
          if (y + BR > H - 20 || y - BR < 0) return die();
        } else y = H / 2 + Math.sin(now / 250) * 8;
        draw(now); raf = requestAnimationFrame(loop);
      }
      function draw(now) {
        const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#150c3a'); gr.addColorStop(1, '#3a1a8a'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
        g.fillStyle = '#fff'; for (const s of stars) { g.globalAlpha = 0.4; g.fillRect((s.x - dist * s.s * 0.05 + W * 10) % W, s.y, s.s, s.s); } g.globalAlpha = 1;
        for (const p of pipes) { g.fillStyle = '#5dff8a'; g.fillRect(p.x, 0, PW, p.gap); g.fillRect(p.x, p.gap + GAP, PW, H); g.fillStyle = '#1f8f45'; g.fillRect(p.x - 4, p.gap - 16, PW + 8, 16); g.fillRect(p.x - 4, p.gap + GAP, PW + 8, 16); }
        g.fillStyle = '#ff2e97'; g.fillRect(0, H - 20, W, 20);
        g.save(); g.translate(BX, y); g.rotate(Math.max(-0.5, Math.min(1, vy / 600))); g.fillStyle = '#ffe14d'; g.beginPath(); g.arc(0, 0, BR, 0, 7); g.fill();
        g.fillStyle = '#fff'; g.beginPath(); g.arc(5, -4, 4, 0, 7); g.fill(); g.fillStyle = '#000'; g.fillRect(6, -5, 2, 2); g.fillStyle = '#ff9a3d'; g.fillRect(8, 1, 9, 5); g.restore();
        if (!started) { g.fillStyle = '#fff'; g.font = '16px monospace'; g.textAlign = 'center'; g.fillText(t('flHint'), W / 2, H / 2 + 60); g.textAlign = 'left'; }
      }
      function die() {
        over = true; sfx.play('hit'); if (window.Fx) Fx.shake && Fx.shake();
        if (score > best) { best = score; localStorage.setItem('flappyBest', best); bs.textContent = best; }
        const r = score >= 10 ? 'win' : 'lose';
        res.innerHTML = `${t(r)}<small>${t('flScore')}: ${score}</small>`; res.className = 'result show ' + r; sfx.play(r); ctx.finish(r, score);
        act.innerHTML = `<button class="px-btn pink" id="again">${t('again')}</button>`;
        act.querySelector('#again').onclick = () => { sfx.play('click'); begin(); };
      }
      cv.addEventListener('pointerdown', (e) => { e.preventDefault(); flap(); });
      const kd = (e) => { if (/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return; if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') { e.preventDefault(); if (!e.repeat) flap(); } };
      document.addEventListener('keydown', kd);
      begin();
      return { destroy() { over = true; cancelAnimationFrame(raf); document.removeEventListener('keydown', kd); } };
    }
  };
})();

