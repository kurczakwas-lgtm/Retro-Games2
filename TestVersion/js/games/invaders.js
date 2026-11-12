/* ============================================================
   SPACE INVADERS — Retro Arcade Canvas Shooter (Solo)
   Waves, destructible shields, mystery UFO, touch & keyboard
   ============================================================ */
(function () {
  I18N.add({
    pl: {
      g_invaders: 'Space Invaders',
      g_invaders_d: 'Klasyczna obrona przed falą kosmitów',
      inv_wave: 'FALA',
      inv_lives: 'ŻYCIA',
      inv_hint: '←/→ lub A/D — ruch · Spacja — strzał'
    },
    en: {
      g_invaders: 'Space Invaders',
      g_invaders_d: 'Defend Earth from waves of alien invaders',
      inv_wave: 'WAVE',
      inv_lives: 'LIVES',
      inv_hint: '←/→ or A/D — move · Space — fire'
    }
  });

  Games.invaders = {
    id: 'invaders',
    nameKey: 'g_invaders',
    descKey: 'g_invaders_d',
    color: 'cyan',
    solo: true,
    diff: false,
    icon: pixelIcon([
      '..c.....c..',
      '...c...c...',
      '..ccccccc..',
      '.cc.ccc.cc.',
      'ccccccccccc',
      'c.ccccccc.c',
      'c.c.....c.c',
      '...cc.cc...',
      '...........'
    ]),
    start(el, ctx) {
      const { sfx, t, finish } = ctx;
      const W = 480, H = 500;
      el.innerHTML = `
        <div class="hud">
          <span>${t('score')}: <b id="iv-sc">0</b></span>
          <span>${t('inv_wave')}: <b id="iv-wv">1</b></span>
          <span>${t('inv_lives')}: <b id="iv-lv">❤️❤️❤️</b></span>
        </div>
        <div class="canvas-wrap"><canvas id="iv-cv" class="arc-canvas cyan" width="${W}" height="${H}"></canvas></div>
        <div class="arcade-pad">
          <button type="button" class="px-btn" id="iv-left">◀</button>
          <button type="button" class="px-btn pink" id="iv-fire">🔥 FIRE</button>
          <button type="button" class="px-btn" id="iv-right">▶</button>
        </div>
        <p class="hint" style="text-align:center;margin-top:6px"><small>${t('inv_hint')}</small></p>
      `;

      const cv = el.querySelector('#iv-cv');
      const g = cv.getContext('2d');
      const scEl = el.querySelector('#iv-sc');
      const wvEl = el.querySelector('#iv-wv');
      const lvEl = el.querySelector('#iv-lv');

      let score = 0, wave = 1, lives = 3, over = false, raf = 0;
      const keys = { left: false, right: false, fire: false };
      let px = W / 2 - 18, pw = 36, ph = 14, shootCd = 0, hitInvuln = 0;
      let bullets = [], eBullets = [], aliens = [], shields = [], ufo = null, ufoTimer = 500;
      let aDir = 1, stepTimer = 0, animFrame = 0;

      function makeShields() {
        shields = [];
        const sw = 44, sh = 24, block = 4;
        const xs = [54, 158, 278, 382];
        for (const sx of xs) {
          for (let r = 0; r < sh / block; r++) {
            for (let c = 0; c < sw / block; c++) {
              // Carve bottom arch
              if (r >= 4 && c >= 3 && c <= 7) continue;
              if (r === 0 && (c === 0 || c === 10)) continue;
              shields.push({ x: sx + c * block, y: H - 102 + r * block, s: block, hp: 2 });
            }
          }
        }
      }

      function spawnWave() {
        aliens = [];
        const rows = 5, cols = 9;
        for (let r = 0; r < rows; r++) {
          const pts = r === 0 ? 40 : r < 3 ? 25 : 15;
          const col = r === 0 ? '#ff4ecd' : r < 3 ? '#00f0ff' : '#3dff9b';
          for (let c = 0; c < cols; c++) {
            aliens.push({
              x: 46 + c * 42,
              y: 52 + r * 32,
              w: 26, h: 18,
              r, pts, col, alive: true
            });
          }
        }
        aDir = 1;
        bullets = [];
        eBullets = [];
      }

      function updHud() {
        scEl.textContent = score;
        wvEl.textContent = wave;
        lvEl.textContent = '❤️'.repeat(Math.max(0, lives)) || '💀';
      }

      function drawAlien(a, frame) {
        g.fillStyle = a.col;
        const { x, y } = a;
        if (a.r === 0) {
          g.fillRect(x + 8, y + 2, 10, 4);
          g.fillRect(x + 4, y + 6, 18, 6);
          g.fillRect(x + (frame ? 2 : 6), y + 12, 4, 4);
          g.fillRect(x + (frame ? 20 : 16), y + 12, 4, 4);
        } else if (a.r < 3) {
          g.fillRect(x + 4, y + 2, 18, 10);
          g.fillRect(x + (frame ? 0 : 4), y + 12, 4, 4);
          g.fillRect(x + 11, y + 12, 4, 4);
          g.fillRect(x + (frame ? 22 : 18), y + 12, 4, 4);
        } else {
          g.fillRect(x + 2, y + 4, 22, 8);
          g.fillRect(x + 6, y + 0, 14, 4);
          g.fillRect(x + (frame ? 2 : 6), y + 12, 5, 4);
          g.fillRect(x + (frame ? 19 : 15), y + 12, 5, 4);
        }
        g.fillStyle = '#070516';
        g.fillRect(x + 7, y + 7, 3, 3);
        g.fillRect(x + 16, y + 7, 3, 3);
      }

      function endGame() {
        if (over) return;
        over = true;
        const won = score >= 500 || wave > 1;
        sfx.play(won ? 'win' : 'lose');
        setTimeout(() => finish(won ? 'win' : 'lose', score), 500);
      }

      function loop() {
        if (over) return;
        raf = requestAnimationFrame(loop);

        // Player movement
        if (keys.left) px = Math.max(10, px - 4.8);
        if (keys.right) px = Math.min(W - pw - 10, px + 4.8);
        if (shootCd > 0) shootCd--;
        if (hitInvuln > 0) hitInvuln--;
        if (keys.fire && shootCd === 0 && bullets.length < 2) {
          bullets.push({ x: px + pw / 2 - 2, y: H - 46, w: 4, h: 11 });
          shootCd = 16;
          sfx.play('click');
        }

        // UFO spawn & move
        if (!ufo && --ufoTimer <= 0) {
          const dir = Math.random() < 0.5 ? 1 : -1;
          ufo = { x: dir > 0 ? -42 : W + 4, y: 20, w: 38, h: 14, dir };
          ufoTimer = 700 + Math.floor(Math.random() * 500);
        }
        if (ufo) {
          ufo.x += ufo.dir * 2.4;
          if (ufo.x < -50 || ufo.x > W + 50) ufo = null;
        }

        // Alien march step
        const alive = aliens.filter(a => a.alive);
        if (alive.length === 0) {
          wave++;
          score += 200;
          sfx.play('good');
          spawnWave();
          updHud();
          return;
        }
        const interval = Math.max(4, Math.floor(alive.length * 0.65) - Math.min(10, wave * 2));
        if (++stepTimer >= interval) {
          stepTimer = 0;
          animFrame ^= 1;
          const speed = 8 + Math.min(6, wave);
          let hitEdge = false;
          for (const a of alive) {
            if ((aDir > 0 && a.x + a.w + speed > W - 12) || (aDir < 0 && a.x - speed < 12)) {
              hitEdge = true;
              break;
            }
          }
          if (hitEdge) {
            aDir *= -1;
            for (const a of alive) a.y += 14;
          } else {
            for (const a of alive) a.x += aDir * speed;
          }
          // Alien shot
          if (eBullets.length < 3 + Math.min(3, wave) && Math.random() < 0.34 + wave * 0.04) {
            const shooter = pick(alive);
            eBullets.push({ x: shooter.x + shooter.w / 2 - 2, y: shooter.y + shooter.h, w: 4, h: 10, vy: 3.4 + Math.min(2.2, wave * 0.25) });
          }
          for (const a of alive) {
            if (a.y + a.h >= H - 44) { lives = 0; updHud(); endGame(); return; }
          }
        }

        // Update bullets
        for (let i = bullets.length - 1; i >= 0; i--) {
          const b = bullets[i];
          b.y -= 7.5;
          if (b.y < -15) { bullets.splice(i, 1); continue; }
          // Hit UFO
          if (ufo && b.x < ufo.x + ufo.w && b.x + b.w > ufo.x && b.y < ufo.y + ufo.h && b.y + b.h > ufo.y) {
            score += 150;
            ufo = null;
            bullets.splice(i, 1);
            sfx.play('coin');
            updHud();
            continue;
          }
          // Hit shields
          let hitSh = false;
          for (let j = shields.length - 1; j >= 0; j--) {
            const s = shields[j];
            if (b.x < s.x + s.s && b.x + b.w > s.x && b.y < s.y + s.s && b.y + b.h > s.y) {
              if (--s.hp <= 0) shields.splice(j, 1);
              hitSh = true;
              break;
            }
          }
          if (hitSh) { bullets.splice(i, 1); continue; }
          // Hit alien
          for (const a of alive) {
            if (b.x < a.x + a.w && b.x + b.w > a.x && b.y < a.y + a.h && b.y + b.h > a.y) {
              a.alive = false;
              score += a.pts;
              bullets.splice(i, 1);
              sfx.play('hit');
              updHud();
              break;
            }
          }
        }

        // Update enemy bullets
        for (let i = eBullets.length - 1; i >= 0; i--) {
          const b = eBullets[i];
          b.y += b.vy;
          if (b.y > H) { eBullets.splice(i, 1); continue; }
          let hitSh = false;
          for (let j = shields.length - 1; j >= 0; j--) {
            const s = shields[j];
            if (b.x < s.x + s.s && b.x + b.w > s.x && b.y < s.y + s.s && b.y + b.h > s.y) {
              if (--s.hp <= 0) shields.splice(j, 1);
              hitSh = true;
              break;
            }
          }
          if (hitSh) { eBullets.splice(i, 1); continue; }
          if (hitInvuln === 0 && b.x < px + pw && b.x + b.w > px && b.y < H - 30 && b.y + b.h > H - 44) {
            eBullets.splice(i, 1);
            lives--;
            hitInvuln = 75;
            sfx.play('bad');
            updHud();
            if (lives <= 0) { endGame(); return; }
          }
        }

        // Draw frame
        g.fillStyle = '#070516';
        g.fillRect(0, 0, W, H);
        // Starfield dots
        g.fillStyle = 'rgba(255,255,255,0.22)';
        for (let i = 0; i < 24; i++) {
          g.fillRect((i * 73) % W, (i * 137) % (H - 60), 2, 2);
        }
        // Shields
        for (const s of shields) {
          g.fillStyle = s.hp === 2 ? '#3dff9b' : '#ffe600';
          g.fillRect(s.x, s.y, s.s, s.s);
        }
        // UFO
        if (ufo) {
          g.fillStyle = '#ff4ecd';
          g.fillRect(ufo.x + 8, ufo.y, 22, 6);
          g.fillRect(ufo.x, ufo.y + 6, ufo.w, 6);
        }
        // Aliens
        for (const a of alive) drawAlien(a, animFrame);
        // Bullets
        g.fillStyle = '#ffe600';
        for (const b of bullets) g.fillRect(b.x, b.y, b.w, b.h);
        g.fillStyle = '#ff4e6a';
        for (const b of eBullets) g.fillRect(b.x, b.y, b.w, b.h);
        // Player cannon
        if (hitInvuln % 8 < 5) {
          g.fillStyle = '#00f0ff';
          g.fillRect(px + 14, H - 50, 8, 6);
          g.fillRect(px, H - 44, pw, ph);
        }
        // Ground line
        g.fillStyle = 'rgba(61,255,155,0.45)';
        g.fillRect(10, H - 22, W - 20, 2);
      }

      function onKeyDown(e) {
        const ae = document.activeElement;
        if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { keys.left = true; e.preventDefault(); }
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keys.right = true; e.preventDefault(); }
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') { keys.fire = true; e.preventDefault(); }
      }
      function onKeyUp(e) {
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') keys.left = false;
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') keys.right = false;
        if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') keys.fire = false;
      }

      const bindHold = (id, key) => {
        const b = el.querySelector(id);
        const on = (e) => { e.preventDefault(); keys[key] = true; };
        const off = () => { keys[key] = false; };
        b.addEventListener('pointerdown', on);
        b.addEventListener('pointerup', off);
        b.addEventListener('pointerleave', off);
        b.addEventListener('pointercancel', off);
      };
      bindHold('#iv-left', 'left');
      bindHold('#iv-right', 'right');
      bindHold('#iv-fire', 'fire');

      addEventListener('keydown', onKeyDown);
      addEventListener('keyup', onKeyUp);
      makeShields();
      spawnWave();
      updHud();
      raf = requestAnimationFrame(loop);

      return {
        destroy() {
          over = true;
          cancelAnimationFrame(raf);
          removeEventListener('keydown', onKeyDown);
          removeEventListener('keyup', onKeyUp);
        }
      };
    }
  };
})();

