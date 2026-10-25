(function () {
  I18N.add({
    pl: { g_pong: 'Pong', g_pong_d: 'Klasyczny ping-pong. Pierwszy do 5 wygrywa.', pongHint: 'Mysz / dotyk albo W S / ↑ ↓', first5: 'Do 5 punktów' },
    en: { g_pong: 'Pong', g_pong_d: 'Classic ping-pong. First to 5 wins.', pongHint: 'Mouse / touch or W S / ↑ ↓', first5: 'First to 5' }
  });
  const W = 600, H = 400, PW = 10, PH = 70, BR = 7, WIN = 5, PSPEED = 430;
  const LX = 20, RX = W - 20 - PW;

  Games.pong = {
    id: 'pong', nameKey: 'g_pong', descKey: 'g_pong_d', color: 'cyan',
    icon: pixelIcon([
      '.....v.....', '.....v.....', 'p....v.....', 'p....v.....', 'p....v.y..c', 'p....v....c',
      '.....v....c', '.....v....c', '.....v.....', '.....v.....', '.....v.....'
    ]),
    start(el, ctx) {
      const { t, net, sfx } = ctx;
      const online = ctx.mode === 'online', isHost = !online || ctx.role === 'host';
      // isHost: liczy fizykę; w bocie gracz = lewa paletka, bot = prawa
      const mySide = isHost ? 'l' : 'r';
      let s, over, again, raf, last, targetY = null, keyDir = 0, myY = H / 2, sendT = 0, lastSent = -1, botErr = 0, serveT = 0;

      el.innerHTML = `<div class="pong">
        <div class="status" id="st">${t('first5')} · ${t('pongHint')}</div>
        <canvas id="cv" width="${W}" height="${H}"></canvas>
        <div class="result" id="res"></div><div class="actions" id="act"></div></div>`;
      const cv = el.querySelector('#cv'), g = cv.getContext('2d');
      const res = el.querySelector('#res'), act = el.querySelector('#act');

      function serve(dir) {
        const a = (Math.random() - 0.5) * 0.7;
        s.sp = 320; s.vx = Math.cos(a) * s.sp * dir; s.vy = Math.sin(a) * s.sp;
        s.bx = W / 2; s.by = H / 2; serveT = 1.0;
      }
      function reset() {
        s = { bx: W / 2, by: H / 2, vx: 0, vy: 0, sp: 320, l: H / 2, r: H / 2, sl: 0, sr: 0 };
        over = false; again = { me: false, opp: false }; myY = H / 2; botErr = 0;
        res.textContent = ''; res.className = 'result'; act.innerHTML = '';
        if (isHost) serve(Math.random() < 0.5 ? 1 : -1);
        last = performance.now();
      }
      const clamp = (y) => Math.max(PH / 2, Math.min(H - PH / 2, y));

      function physics(dt) {
        if (serveT > 0) { serveT -= dt; return; }
        s.bx += s.vx * dt; s.by += s.vy * dt;
        if (s.by < BR) { s.by = BR; s.vy = Math.abs(s.vy); sfx.play('click'); }
        if (s.by > H - BR) { s.by = H - BR; s.vy = -Math.abs(s.vy); sfx.play('click'); }
        if (s.vx < 0 && s.bx - BR <= LX + PW && s.bx + BR >= LX && Math.abs(s.by - s.l) <= PH / 2 + BR) bounce(s.l, 1);
        if (s.vx > 0 && s.bx + BR >= RX && s.bx - BR <= RX + PW && Math.abs(s.by - s.r) <= PH / 2 + BR) bounce(s.r, -1);
        if (s.bx < -BR * 2) point('r'); else if (s.bx > W + BR * 2) point('l');
      }
      function bounce(py, dir) {
        const off = Math.max(-1, Math.min(1, (s.by - py) / (PH / 2 + BR)));
        s.sp = Math.min(s.sp * 1.07, 720);
        const a = off * 0.95;
        s.vx = Math.cos(a) * s.sp * dir; s.vy = Math.sin(a) * s.sp;
        s.bx = dir === 1 ? LX + PW + BR : RX - BR;
        sfx.play('x');
        if (!online && dir === -1) botErr = (Math.random() - 0.5) * 2 * ({ easy: 55, normal: 28, hard: 9 }[ctx.difficulty] || 28);
      }
      function point(who) {
        if (who === 'l') s.sl++; else s.sr++; sfx.play('hit');
        if (s.sl >= WIN || s.sr >= WIN) return finish(s.sl >= WIN ? 'l' : 'r');
        serve(who === 'l' ? -1 : 1);
      }
      function finish(winSide) {
        over = true;
        if (online) net.send({ type: 'over', w: winSide, sl: s.sl, sr: s.sr });
        showEnd(winSide);
      }
      function showEnd(winSide) {
        over = true;
        const r = winSide === mySide ? 'win' : 'lose';
        res.textContent = t(r); res.className = 'result show ' + r;
        sfx.play(r); ctx.finish(r);
        act.innerHTML = `<button class="px-btn pink" id="again">${t('again')}</button>`;
        act.querySelector('#again').onclick = () => {
          sfx.play('click');
          if (!online) return reset();
          again.me = true; net.send({ type: 'again' });
          act.innerHTML = `<span class="hint">${t('waitOpp')}</span>`; tryAgain();
        };
      }
      function tryAgain() { if (again.me && again.opp) reset(); }

      function botControl(dt) {
        const sp = { easy: 170, normal: 270, hard: 400 }[ctx.difficulty] || 270;
        let ty = H / 2;
        if (s.vx > 0) ty = s.by + botErr;
        const d = ty - s.r, mv = Math.max(-sp * dt, Math.min(sp * dt, d));
        s.r = clamp(s.r + mv);
      }
      function frame(now) {
        const dt = Math.min(0.05, (now - last) / 1000); last = now;
        // sterowanie lokalne
        if (keyDir) myY = clamp(myY + keyDir * PSPEED * dt);
        else if (targetY !== null) { const d = targetY - myY; myY = clamp(myY + Math.max(-PSPEED * 1.6 * dt, Math.min(PSPEED * 1.6 * dt, d))); }
        if (mySide === 'l') s.l = myY; else s.r = myY;

        if (!over) {
          if (isHost) {
            if (!online) botControl(dt);
            physics(dt);
            if (online) { sendT += dt; if (sendT >= 0.05) { sendT = 0; net.send({ type: 's', bx: s.bx, by: s.by, vx: s.vx, vy: s.vy, l: s.l, sl: s.sl, sr: s.sr, sv: serveT > 0 }); } }
          } else {
            // gość: ekstrapolacja piłki między pakietami
            if (!s.sv) { s.bx += s.vx * dt; s.by += s.vy * dt; if (s.by < BR || s.by > H - BR) s.vy = -s.vy; }
            sendT += dt; if (sendT >= 0.05 && Math.abs(myY - lastSent) > 0.5) { sendT = 0; lastSent = myY; net.send({ type: 'p', y: myY }); }
          }
        }
        draw();
        raf = requestAnimationFrame(frame);
      }
      function draw() {
        g.fillStyle = '#05030f'; g.fillRect(0, 0, W, H);
        g.strokeStyle = '#3a2a80'; g.lineWidth = 4; g.setLineDash([14, 14]);
        g.beginPath(); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.stroke(); g.setLineDash([]);
        g.font = '32px "Press Start 2P", monospace'; g.textAlign = 'center';
        g.fillStyle = '#ff2e97'; g.fillText(s.sl, W / 2 - 70, 60);
        g.fillStyle = '#2ef2ff'; g.fillText(s.sr, W / 2 + 70, 60);
        g.shadowBlur = 16;
        g.fillStyle = g.shadowColor = '#ff2e97'; g.fillRect(LX, s.l - PH / 2, PW, PH);
        g.fillStyle = g.shadowColor = '#2ef2ff'; g.fillRect(RX, s.r - PH / 2, PW, PH);
        g.fillStyle = g.shadowColor = '#ffe14d'; g.fillRect(s.bx - BR, s.by - BR, BR * 2, BR * 2);
        g.shadowBlur = 0;
        if (!over && s.sv !== false && serveT > 0 || (!isHost && s.sv)) {
          g.fillStyle = '#f3eaff'; g.font = '14px "Press Start 2P", monospace';
          g.fillText(mySide === 'l' ? '◄ ' + t('you') : t('you') + ' ►', mySide === 'l' ? 90 : W - 90, H - 20);
        }
      }
      // wejście
      const toY = (e) => { const r = cv.getBoundingClientRect(); return (e.clientY - r.top) * (H / r.height); };
      cv.addEventListener('pointermove', (e) => { targetY = toY(e); });
      cv.addEventListener('pointerdown', (e) => { targetY = toY(e); cv.setPointerCapture && cv.setPointerCapture(e.pointerId); });
      cv.style.touchAction = 'none';
      const onDown = (e) => {
        const k = e.key.toLowerCase();
        if (k === 'arrowup' || k === 'w') { keyDir = -1; targetY = null; e.preventDefault(); }
        else if (k === 'arrowdown' || k === 's') { keyDir = 1; targetY = null; e.preventDefault(); }
      };
      const onUp = (e) => {
        const k = e.key.toLowerCase();
        if ((k === 'arrowup' || k === 'w') && keyDir === -1) keyDir = 0;
        if ((k === 'arrowdown' || k === 's') && keyDir === 1) keyDir = 0;
      };
      document.addEventListener('keydown', onDown); document.addEventListener('keyup', onUp);

      if (online) net.setHandler((m) => {
        if (isHost) {
          if (m.type === 'p') s.r = clamp(m.y);
          else if (m.type === 'again') { again.opp = true; tryAgain(); }
        } else {
          if (m.type === 's' && !over) { s.bx = m.bx; s.by = m.by; s.vx = m.vx; s.vy = m.vy; s.l = m.l; s.sl = m.sl; s.sr = m.sr; s.sv = m.sv; }
          else if (m.type === 'over') { s.sl = m.sl; s.sr = m.sr; showEnd(m.w); }
          else if (m.type === 'again') { again.opp = true; tryAgain(); }
        }
      });
      reset();
      raf = requestAnimationFrame(frame);
      return { destroy() { cancelAnimationFrame(raf); document.removeEventListener('keydown', onDown); document.removeEventListener('keyup', onUp); } };
    }
  };
})();
