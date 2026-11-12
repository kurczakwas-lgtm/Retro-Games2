(function () {
  I18N.add({
    pl: { g_breakout: 'Breakout', g_breakout_d: 'Rozbij wszystkie cegły. Power-upy i kolejne poziomy!', boScore: 'Wynik', boLives: 'Życia', boLevel: 'Poziom', boHint: 'Mysz / palec / strzałki. Spacja = start' },
    en: { g_breakout: 'Breakout', g_breakout_d: 'Smash all the bricks. Power-ups and endless levels!', boScore: 'Score', boLives: 'Lives', boLevel: 'Level', boHint: 'Mouse / touch / arrows. Space = launch' }
  });
  const W = 480, H = 360, PH = 12, BR = 6, COLS = 10, BW = W / COLS, BH = 18;
  const COL = ['#ff4d4d', '#ff9a3d', '#ffe14d', '#5dff8a', '#2ef2ff', '#8a4dff'];
  function makeBricks(level) {
    const rows = Math.min(8, 4 + level), a = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < COLS; c++) if (!(level % 3 === 2 && (c + r) % 4 === 0)) a.push({ x: c * BW, y: 40 + r * BH, r, alive: true, hp: r < Math.floor(level / 2) ? 2 : 1 });
    return a;
  }
  Games.breakout = {
    id: 'breakout', nameKey: 'g_breakout', descKey: 'g_breakout_d', color: 'yellow', solo: true,
    icon: pixelIcon(['rrrrrrrrrrr', 'ooooooooooo', 'yyyyyyyyyyy', 'ggggggggggg', '...........', '.....w.....', '...........', '...........', '...........', '....ccccc..', '...........']),
    _engine: { makeBricks },
    start(el, ctx) {
      const { t, sfx } = ctx;
      el.innerHTML = `<div class="breakout"><div class="status">${t('boHint')}</div>
        <div class="bo-hud"><span>${t('boScore')}: <b id="sc">0</b></span><span>${t('boLevel')}: <b id="lv">1</b></span><span>${t('boLives')}: <b id="li">3</b></span></div>
        <canvas id="cv" width="${W}" height="${H}"></canvas><div class="result" id="res"></div><div class="actions" id="act"></div></div>`;
      const cv = el.querySelector('#cv'), g = cv.getContext('2d'), res = el.querySelector('#res'), act = el.querySelector('#act');
      const sc = el.querySelector('#sc'), lv = el.querySelector('#lv'), li = el.querySelector('#li');
      let px, pw, balls, bricks, drops, score, lives, level, over, raf, last, keys = {}, stuck, wide;
      function resetBall() { balls = [{ x: px, y: H - 30 - BR, vx: 0, vy: 0 }]; stuck = true; }
      function start() { level = 1; score = 0; lives = 3; over = false; px = W / 2; pw = 80; wide = 0; drops = []; bricks = makeBricks(1); resetBall(); res.textContent = ''; res.className = 'result'; act.innerHTML = ''; hud(); }
      const hud = () => { sc.textContent = score; lv.textContent = level; li.textContent = lives; };
      function launch() { if (!stuck) return; stuck = false; const b = balls[0]; const sp = 250 + level * 15; b.vx = sp * 0.5 * (Math.random() < 0.5 ? -1 : 1); b.vy = -Math.sqrt(sp * sp - b.vx * b.vx); sfx.play('place'); }
      function loop(now) {
        if (over) return; const dt = Math.min(0.03, (now - (last || now)) / 1000); last = now;
        if (keys.ArrowLeft || keys.a) px -= 380 * dt; if (keys.ArrowRight || keys.d) px += 380 * dt;
        px = Math.max(pw / 2, Math.min(W - pw / 2, px));
        if (wide > 0) { wide -= dt; pw = 130; } else pw = 80;
        if (stuck) balls[0].x = px;
        for (const b of balls) {
          if (stuck) break;
          b.x += b.vx * dt; b.y += b.vy * dt;
          if (b.x < BR) { b.x = BR; b.vx = Math.abs(b.vx); } if (b.x > W - BR) { b.x = W - BR; b.vx = -Math.abs(b.vx); }
          if (b.y < BR) { b.y = BR; b.vy = Math.abs(b.vy); }
          const py = H - 30;
          if (b.vy > 0 && b.y + BR >= py && b.y + BR <= py + PH + 8 && Math.abs(b.x - px) <= pw / 2 + BR) {
            const k = (b.x - px) / (pw / 2), sp = Math.hypot(b.vx, b.vy) * 1.01, ang = k * 1.05;
            b.vx = Math.sin(ang) * sp; b.vy = -Math.cos(ang) * sp; b.y = py - BR; sfx.play('click');
          }
          for (const br of bricks) {
            if (!br.alive || b.x + BR < br.x || b.x - BR > br.x + BW || b.y + BR < br.y || b.y - BR > br.y + BH) continue;
            const ox = Math.min(b.x + BR - br.x, br.x + BW - (b.x - BR)), oy = Math.min(b.y + BR - br.y, br.y + BH - (b.y - BR));
            if (ox < oy) b.vx = -b.vx; else b.vy = -b.vy;
            br.hp--; sfx.play('hit');
            if (br.hp <= 0) {
              br.alive = false; score += 10 * (6 - Math.min(5, br.r)) * level; hud();
              if (window.Fx) Fx.burst(cv.getBoundingClientRect().left + br.x + BW / 2, cv.getBoundingClientRect().top + br.y, COL[br.r % 6], 8);
              if (Math.random() < 0.12) drops.push({ x: br.x + BW / 2, y: br.y, k: pick(['W', 'M', 'L']) });
            }
            break;
          }
        }
        balls = balls.filter(b => b.y < H + 20);
        if (!balls.length && !stuck) { lives--; hud(); sfx.play('bad'); if (lives <= 0) return end(); resetBall(); }
        for (const d of drops) { d.y += 120 * dt; if (d.y > H - 32 && d.y < H - 14 && Math.abs(d.x - px) < pw / 2 + 8) { d.hit = true; sfx.play('good'); if (d.k === 'W') wide = 12; else if (d.k === 'L') { lives++; hud(); } else if (balls.length && !stuck) { const b = balls[0]; balls.push({ x: b.x, y: b.y, vx: -b.vx, vy: b.vy }, { x: b.x, y: b.y, vx: b.vx * 0.7, vy: -Math.abs(b.vy) }); } } }
        drops = drops.filter(d => !d.hit && d.y < H + 10);
        if (!bricks.some(b => b.alive)) { level++; bricks = makeBricks(level); drops = []; resetBall(); score += 100 * level; hud(); sfx.play('win'); }
        draw(); raf = requestAnimationFrame(loop);
      }
      function draw() {
        g.fillStyle = '#0a0720'; g.fillRect(0, 0, W, H);
        for (const b of bricks) if (b.alive) { g.fillStyle = COL[b.r % 6]; g.globalAlpha = b.hp > 1 ? 1 : 0.85; g.fillRect(b.x + 1, b.y + 1, BW - 2, BH - 2); g.globalAlpha = 1; if (b.hp > 1) { g.strokeStyle = '#fff'; g.strokeRect(b.x + 2.5, b.y + 2.5, BW - 5, BH - 5); } }
        g.fillStyle = wide > 0 ? '#2ef2ff' : '#ff2e97'; g.fillRect(px - pw / 2, H - 30, pw, PH);
        g.fillStyle = '#fff'; for (const b of balls) { g.beginPath(); g.arc(b.x, b.y, BR, 0, 7); g.fill(); }
        g.font = '14px monospace'; for (const d of drops) { g.fillStyle = d.k === 'L' ? '#5dff8a' : d.k === 'W' ? '#2ef2ff' : '#ffe14d'; g.fillText(d.k === 'L' ? '♥' : d.k === 'W' ? '↔' : '●●', d.x - 6, d.y); }
      }
      function end() {
        over = true; cancelAnimationFrame(raf);
        const r = score >= 500 ? 'win' : 'lose';
        res.innerHTML = `${t(r)}<small>${t('boScore')}: ${score}</small>`; res.className = 'result show ' + r; sfx.play(r); ctx.finish(r, score);
        act.innerHTML = `<button class="px-btn pink" id="again">${t('again')}</button>`;
        act.querySelector('#again').onclick = () => { sfx.play('click'); begin(); };
      }
      function begin() { start(); last = 0; raf = requestAnimationFrame(loop); }
      const mx = (e) => { const r = cv.getBoundingClientRect(); px = (e.clientX - r.left) * W / r.width; };
      cv.addEventListener('pointermove', (e) => { mx(e); });
      cv.addEventListener('pointerdown', (e) => { mx(e); launch(); });
      const kd = (e) => { if (/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) return; if (e.key === ' ' || e.key.startsWith('Arrow')) e.preventDefault(); if (e.key === ' ') launch(); keys[e.key] = true; };
      const ku = (e) => { keys[e.key] = false; };
      document.addEventListener('keydown', kd); document.addEventListener('keyup', ku);
      begin();
      return { destroy() { over = true; cancelAnimationFrame(raf); document.removeEventListener('keydown', kd); document.removeEventListener('keyup', ku); } };
    }
  };
})();

