(function () {
  I18N.add({
    pl: { g_snake: 'Snake Battle', g_snake_d: 'Dwa węże na jednej planszy. Przeżyje tylko jeden!', snakeHint: 'Strzałki / WASD / przesuń palcem', getReady: 'Przygotuj się...' },
    en: { g_snake: 'Snake Battle', g_snake_d: 'Two snakes, one arena. Only one survives!', snakeHint: 'Arrows / WASD / swipe', getReady: 'Get ready...' }
  });
  const GW = 30, GH = 20, CS = 20, FOODS = 3;
  const DV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  const key = (x, y) => y * GW + x;

  Games.snake = {
    id: 'snake', nameKey: 'g_snake', descKey: 'g_snake_d', color: 'green',
    icon: pixelIcon([
      '..gggggg...', '..g........', '..g........', '..gggggg...', '........g..', '........g..',
      '..ggggggg..', '..g........', '..y.....p..', '...........', '...........'
    ]),
    start(el, ctx) {
      const { t, net, sfx } = ctx;
      const online = ctx.mode === 'online', isHost = !online || ctx.role === 'host';
      const mine = isHost ? 1 : 2;
      let a, b, foods, over, again, timer, countdown = 0, cdTimer, nextDir, raf, tickMs;
      const timers = [];

      el.innerHTML = `<div class="snake">
        <div class="status" id="st">${t('snakeHint')}</div>
        <div class="sn-legend"><span class="lg p1"></span>${mine === 1 ? t('you') : t('opponent')} <span class="lg p2"></span>${mine === 2 ? t('you') : t('opponent')}</div>
        <canvas id="cv" width="${GW * CS}" height="${GH * CS}"></canvas>
        <div class="dpad"><button data-d="up">▲</button><div><button data-d="left">◄</button><button data-d="down">▼</button><button data-d="right">►</button></div></div>
        <div class="result" id="res"></div><div class="actions" id="act"></div></div>`;
      const cv = el.querySelector('#cv'), g = cv.getContext('2d');
      const res = el.querySelector('#res'), act = el.querySelector('#act'), st = el.querySelector('#st');

      const mk = (x, y, d) => ({ body: [{ x, y }, { x: x - d[0], y: y - d[1] }, { x: x - 2 * d[0], y: y - 2 * d[1] }], dir: d, alive: true });
      function spawnFood() {
        const occ = new Set(); [a, b].forEach(s => s.body.forEach(c => occ.add(key(c.x, c.y)))); foods.forEach(f => occ.add(key(f.x, f.y)));
        let tries = 0;
        while (tries++ < 200) { const x = rnd(GW), y = rnd(GH); if (!occ.has(key(x, y))) return { x, y }; }
        return null;
      }
      function reset() {
        clearInterval(timer); timers.forEach(clearTimeout);
        a = mk(6, 10, [1, 0]); b = mk(GW - 7, 10, [-1, 0]);
        foods = []; for (let i = 0; i < FOODS; i++) foods.push(spawnFood());
        over = false; again = { me: false, opp: false }; nextDir = null;
        res.textContent = ''; res.className = 'result'; act.innerHTML = '';
        tickMs = online ? 120 : ({ easy: 150, normal: 115, hard: 90 }[ctx.difficulty] || 115);
        countdown = 3; st.textContent = t('getReady');
        cdTimer = setInterval(() => {
          countdown--;
          if (countdown <= 0) { clearInterval(cdTimer); st.textContent = t('snakeHint'); if (isHost) timer = setInterval(tick, tickMs); }
          else sfx.play('click');
        }, 800);
        sfx.play('click');
      }
      // ---------- logika (host / bot) ----------
      function occupied(growA, growB) {
        const o = new Set();
        [[a, growA], [b, growB]].forEach(([s, grow]) => s.body.forEach((c, i) => { if (grow || i < s.body.length - 1) o.add(key(c.x, c.y)); }));
        return o;
      }
      function inBounds(x, y) { return x >= 0 && y >= 0 && x < GW && y < GH; }
      function foodAt(x, y) { return foods.findIndex(f => f && f.x === x && f.y === y); }
      function applyDir(s, d) { if (d && !(d[0] === -s.dir[0] && d[1] === -s.dir[1])) s.dir = d; }

      function tick() {
        if (over) return;
        if (nextDir) { applyDir(mine === 1 ? a : b, nextDir); nextDir = null; }
        if (!online) applyDir(b, botDecide());
        const na = { x: a.body[0].x + a.dir[0], y: a.body[0].y + a.dir[1] };
        const nb = { x: b.body[0].x + b.dir[0], y: b.body[0].y + b.dir[1] };
        const fa = foodAt(na.x, na.y), fb = foodAt(nb.x, nb.y);
        const occ = occupied(fa >= 0, fb >= 0);
        const deadA = !inBounds(na.x, na.y) || occ.has(key(na.x, na.y)) || (na.x === nb.x && na.y === nb.y);
        const deadB = !inBounds(nb.x, nb.y) || occ.has(key(nb.x, nb.y)) || (na.x === nb.x && na.y === nb.y);
        if (!deadA) { a.body.unshift(na); if (fa < 0) a.body.pop(); }
        if (!deadB) { b.body.unshift(nb); if (fb < 0) b.body.pop(); }
        let ate = false;
        [fa, fb].forEach((f, i) => { if (f >= 0 && !(i === 0 ? deadA : deadB)) { foods[f] = null; ate = true; } });
        foods = foods.filter(Boolean); while (foods.length < FOODS) { const nf = spawnFood(); if (!nf) break; foods.push(nf); }
        if (ate) sfx.play('good');
        if (deadA || deadB) { a.alive = !deadA; b.alive = !deadB; over = true; clearInterval(timer); const w = deadA && deadB ? 0 : (deadA ? 2 : 1); sync(w); end(w); }
        else sync(null);
      }
      function sync(w) {
        if (!online) return;
        net.send({ type: 's', a: a.body.flatMap(c => [c.x, c.y]), b: b.body.flatMap(c => [c.x, c.y]), f: foods.flatMap(f => [f.x, f.y]), w });
      }
      // ---------- bot ----------
      function botDecide() {
        const head = b.body[0], occ = occupied(false, false);
        const hA = a.body[0], aNext = { x: hA.x + a.dir[0], y: hA.y + a.dir[1] };
        const cands = Object.values(DV).filter(d => !(d[0] === -b.dir[0] && d[1] === -b.dir[1]))
          .map(d => ({ d, x: head.x + d[0], y: head.y + d[1] }))
          .filter(c => inBounds(c.x, c.y) && !occ.has(key(c.x, c.y)));
        if (!cands.length) return b.dir;
        const diff = ctx.difficulty;
        const safe = cands.filter(c => !(c.x === aNext.x && c.y === aNext.y));
        const pool = safe.length ? safe : cands;
        const dist = (x, y) => Math.min(...foods.map(f => Math.abs(f.x - x) + Math.abs(f.y - y)));
        if (diff === 'easy') {
          if (Math.random() < 0.35) return pick(pool).d;
          return pool.sort((p, q) => dist(p.x, p.y) - dist(q.x, q.y))[0].d;
        }
        if (diff === 'normal') return pool.sort((p, q) => dist(p.x, p.y) - dist(q.x, q.y))[0].d;
        // hard: odległość BFS + bezpieczeństwo (wolne miejsce)
        let best = null, bestScore = -Infinity;
        for (const c of pool) {
          const blocked = new Set(occ); blocked.add(key(head.x, head.y));
          const { area, fd } = bfs(c.x, c.y, blocked);
          const enough = area >= b.body.length + 2;
          const sc = (enough ? 1000 : 0) + (enough ? -fd : area);
          if (sc > bestScore) { bestScore = sc; best = c; }
        }
        return best.d;
      }
      function bfs(sx, sy, blocked) {
        const seen = new Set([key(sx, sy)]); let q = [[sx, sy, 0]], area = 0, fd = 999, i = 0;
        const fset = new Set(foods.map(f => key(f.x, f.y)));
        while (i < q.length && area < 400) {
          const [x, y, d] = q[i++]; area++;
          if (fd === 999 && fset.has(key(x, y))) fd = d;
          for (const [dx, dy] of Object.values(DV)) {
            const nx = x + dx, ny = y + dy, k = key(nx, ny);
            if (!inBounds(nx, ny) || seen.has(k) || blocked.has(k)) continue;
            seen.add(k); q.push([nx, ny, d + 1]);
          }
        }
        return { area, fd };
      }
      // ---------- koniec ----------
      function end(w) {
        over = true;
        const r = w === 0 ? 'draw' : (w === mine ? 'win' : 'lose');
        res.textContent = t(r); res.className = 'result show ' + r;
        sfx.play(r === 'win' ? 'win' : r === 'draw' ? 'draw' : 'lose'); ctx.finish(r);
        act.innerHTML = `<button class="px-btn pink" id="again">${t('again')}</button>`;
        act.querySelector('#again').onclick = () => {
          sfx.play('click');
          if (!online) return reset();
          again.me = true; net.send({ type: 'again' });
          act.innerHTML = `<span class="hint">${t('waitOpp')}</span>`; tryAgain();
        };
      }
      function tryAgain() { if (again.me && again.opp) reset(); }
      // ---------- rysowanie ----------
      function draw() {
        g.fillStyle = '#05030f'; g.fillRect(0, 0, cv.width, cv.height);
        g.strokeStyle = 'rgba(138,77,255,.12)'; g.lineWidth = 1;
        for (let x = 0; x <= GW; x++) { g.beginPath(); g.moveTo(x * CS, 0); g.lineTo(x * CS, cv.height); g.stroke(); }
        for (let y = 0; y <= GH; y++) { g.beginPath(); g.moveTo(0, y * CS); g.lineTo(cv.width, y * CS); g.stroke(); }
        const pulse = 4 + Math.sin(performance.now() / 150) * 2;
        g.shadowBlur = 12; g.fillStyle = g.shadowColor = '#ffe14d';
        foods.forEach(f => g.fillRect(f.x * CS + pulse / 2 + 2, f.y * CS + pulse / 2 + 2, CS - pulse - 4, CS - pulse - 4));
        [[a, '#ff2e97'], [b, '#2ef2ff']].forEach(([s, col]) => {
          g.fillStyle = g.shadowColor = col; g.globalAlpha = s.alive ? 1 : 0.35;
          s.body.forEach((c, i) => { const m = i === 0 ? 0 : 2; g.fillRect(c.x * CS + m, c.y * CS + m, CS - m * 2, CS - m * 2); });
          const h = s.body[0]; g.fillStyle = '#05030f'; g.shadowBlur = 0;
          g.fillRect(h.x * CS + 5, h.y * CS + 5, 3, 3); g.fillRect(h.x * CS + 12, h.y * CS + 5, 3, 3);
          g.globalAlpha = 1; g.shadowBlur = 12;
        });
        g.shadowBlur = 0;
        if (countdown > 0) {
          g.fillStyle = 'rgba(5,3,15,.55)'; g.fillRect(0, 0, cv.width, cv.height);
          g.fillStyle = '#ffe14d'; g.font = '64px "Press Start 2P", monospace'; g.textAlign = 'center';
          g.fillText(countdown, cv.width / 2, cv.height / 2 + 24);
        }
        raf = requestAnimationFrame(draw);
      }
      // ---------- wejście ----------
      function setDir(name) {
        const d = DV[name]; if (!d) return;
        const me = mine === 1 ? a : b;
        if (d[0] === -me.dir[0] && d[1] === -me.dir[1]) return;
        if (isHost) nextDir = d; else { net.send({ type: 'd', d }); me.dir = d; }
      }
      const MAP = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right' };
      const onKey = (e) => { const n = MAP[e.key.toLowerCase()]; if (n) { setDir(n); e.preventDefault(); } };
      document.addEventListener('keydown', onKey);
      el.querySelectorAll('.dpad button').forEach(b => b.onclick = () => setDir(b.dataset.d));
      let sx = 0, sy = 0;
      cv.style.touchAction = 'none';
      cv.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
      cv.addEventListener('pointerup', (e) => {
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        setDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      });

      if (online) net.setHandler((m) => {
        if (isHost) {
          if (m.type === 'd' && Array.isArray(m.d)) applyDir(b, m.d);
          else if (m.type === 'again') { again.opp = true; tryAgain(); }
        } else {
          if (m.type === 's') {
            const toBody = (arr) => { const r = []; for (let i = 0; i < arr.length; i += 2) r.push({ x: arr[i], y: arr[i + 1] }); return r; };
            a.body = toBody(m.a); b.body = toBody(m.b);
            const fl = toBody(m.f); if (fl.length > foods.length) sfx.play('good'); foods = fl;
            if (m.w !== null && m.w !== undefined && !over) { a.alive = m.w !== 2 && m.w !== 0; b.alive = m.w !== 1 && m.w !== 0; end(m.w); }
          } else if (m.type === 'again') { again.opp = true; tryAgain(); }
        }
      });
      reset();
      raf = requestAnimationFrame(draw);
      return { destroy() { clearInterval(timer); clearInterval(cdTimer); cancelAnimationFrame(raf); document.removeEventListener('keydown', onKey); } };
    }
  };
})();
