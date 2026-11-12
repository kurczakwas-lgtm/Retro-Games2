(function () {
  I18N.add({
    pl: { g_tetris: 'Tetris', g_tetris_d: 'Układaj klocki, czyść linie i bij rekord. Solo!', ttHint: '←→ ruch · ↑/X obrót · Z obrót wstecz · ↓ szybciej · Spacja upuść · C schowaj', ttHold: 'Schowek', ttNext: 'Dalej', ttScore: 'Wynik', ttLines: 'Linie', ttLevel: 'Poziom' },
    en: { g_tetris: 'Tetris', g_tetris_d: 'Stack blocks, clear lines and chase a high score. Solo!', ttHint: '←→ move · ↑/X rotate · Z rotate back · ↓ soft drop · Space hard drop · C hold', ttHold: 'Hold', ttNext: 'Next', ttScore: 'Score', ttLines: 'Lines', ttLevel: 'Level' }
  });
  const W = 10, H = 20, CS = 30;
  const SHAPES = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    O: [[1, 1], [1, 1]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]]
  };
  const TYPES = Object.keys(SHAPES);
  const COLORS = { I: '#2ef2ff', O: '#ffe14d', T: '#8a4dff', S: '#5dff8a', Z: '#ff4d4d', J: '#3a6bff', L: '#ff9a3d' };
  const KICKS = [[0, 0], [-1, 0], [1, 0], [0, -1], [-2, 0], [2, 0], [-1, -1], [1, -1], [0, -2]];
  const LINE_PTS = [0, 100, 300, 500, 800];
  const DAS = 150, ARR = 40, LOCK_MS = 500, MAX_RESETS = 15;

  // ---------- czyste funkcje ----------
  const newBoard = () => Array.from({ length: H }, () => Array(W).fill(null));
  function rotate(m, dir) { // dir 1 = cw, -1 = ccw
    const n = m.length, r = m.map(() => Array(n).fill(0));
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      if (dir > 0) r[x][n - 1 - y] = m[y][x]; else r[n - 1 - x][y] = m[y][x];
    }
    return r;
  }
  function collide(board, m, px, py) {
    for (let y = 0; y < m.length; y++) for (let x = 0; x < m[y].length; x++) {
      if (!m[y][x]) continue;
      const bx = px + x, by = py + y;
      if (bx < 0 || bx >= W || by >= H) return true;
      if (by >= 0 && board[by][bx]) return true;
    }
    return false;
  }
  // zwraca nowy stan {m,x,y} albo null
  function tryRotate(board, p, dir) {
    const m = rotate(p.m, dir);
    for (const [dx, dy] of KICKS) if (!collide(board, m, p.x + dx, p.y + dy)) return { t: p.t, m, x: p.x + dx, y: p.y + dy };
    return null;
  }
  function merge(board, p) {
    let above = false;
    p.m.forEach((row, y) => row.forEach((v, x) => {
      if (!v) return;
      const by = p.y + y, bx = p.x + x;
      if (by < 0) above = true; else board[by][bx] = p.t;
    }));
    return above;
  }
  function clearLines(board) {
    let n = 0;
    for (let y = H - 1; y >= 0; y--) {
      if (board[y].every(Boolean)) { board.splice(y, 1); board.unshift(Array(W).fill(null)); n++; y++; }
    }
    return n;
  }
  function ghostY(board, p) { let y = p.y; while (!collide(board, p.m, p.x, y + 1)) y++; return y; }
  function makeBag(rng) {
    const a = TYPES.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  const levelFor = (lines) => Math.floor(lines / 10) + 1;
  const gravityMs = (level) => Math.max(60, Math.round(800 * Math.pow(0.85, level - 1)));
  const lineScore = (n, level) => (LINE_PTS[n] || 0) * level;
  const spawn = (t) => { const m = SHAPES[t].map(r => r.slice()); return { t, m, x: Math.floor((W - m.length) / 2), y: 0 }; };

  Games.tetris = {
    id: 'tetris', nameKey: 'g_tetris', descKey: 'g_tetris_d', color: 'cyan', solo: true, diff: false,
    icon: pixelIcon([
      '...........', '.cc........', '..cc..yy...', '......yy...', '..ppp......', '...p...gg..',
      '......gg...', '.bb........', '..b..oo....', '..b...o....', '..........o'
    ]),
    _engine: { W, H, SHAPES, newBoard, rotate, collide, tryRotate, merge, clearLines, ghostY, makeBag, levelFor, gravityMs, lineScore, spawn },
    start(el, ctx) {
      const { t, sfx } = ctx;
      el.innerHTML = `<div class="tetris">
        <div class="status" id="st">${t('ttHint')}</div>
        <div class="tt-wrap">
          <div class="tt-side"><div class="tt-lbl">${t('ttHold')}</div><canvas id="hold" width="80" height="80"></canvas>
            <div class="tt-stat"><small>${t('ttScore')}</small><b id="sc">0</b></div>
            <div class="tt-stat"><small>${t('ttLines')}</small><b id="ln">0</b></div>
            <div class="tt-stat"><small>${t('ttLevel')}</small><b id="lv">1</b></div></div>
          <canvas id="cv" width="${W * CS}" height="${H * CS}"></canvas>
          <div class="tt-side"><div class="tt-lbl">${t('ttNext')}</div><canvas id="next" width="80" height="240"></canvas></div>
        </div>
        <div class="tt-pad">
          <button data-k="left">◄</button><button data-k="down">▼</button><button data-k="right">►</button>
          <button data-k="rot">⟳</button><button data-k="drop">⤓</button><button data-k="hold">H</button>
        </div>
        <div class="result" id="res"></div><div class="actions" id="act"></div></div>`;
      const cv = el.querySelector('#cv'), g = cv.getContext('2d');
      const hv = el.querySelector('#hold'), hg = hv.getContext('2d');
      const nv = el.querySelector('#next'), ng = nv.getContext('2d');
      const res = el.querySelector('#res'), act = el.querySelector('#act');
      const elSc = el.querySelector('#sc'), elLn = el.querySelector('#ln'), elLv = el.querySelector('#lv');

      let board, bag, queue, cur, hold, canHold, score, lines, level, over, raf, last;
      let acc, lockT, resets, soft, held, hdir, hCharge, hRep, destroyed = false;

      function reset() {
        board = newBoard(); bag = []; queue = []; hold = null; canHold = true;
        score = 0; lines = 0; level = 1; over = false; acc = 0; lockT = 0; resets = 0; soft = false;
        held = { left: false, right: false }; hdir = 0; hCharge = 0; hRep = false;
        res.textContent = ''; res.className = 'result'; act.innerHTML = '';
        spawnNext(); stats(); last = performance.now();
        sfx.play('click');
      }
      function nextType() { if (!bag.length) bag = makeBag(Math.random); return bag.shift(); }
      function spawnNext() {
        while (queue.length < 4) queue.push(nextType());
        cur = spawn(queue.shift()); acc = 0; lockT = 0; resets = 0;
        if (collide(board, cur.m, cur.x, cur.y)) topOut();
      }
      function stats() { elSc.textContent = score; elLn.textContent = lines; elLv.textContent = level; }
      function grounded() { return collide(board, cur.m, cur.x, cur.y + 1); }
      function bumpLock() { if (grounded() && resets < MAX_RESETS) { lockT = 0; resets++; } }
      function move(dx) {
        if (over || collide(board, cur.m, cur.x + dx, cur.y)) return false;
        cur.x += dx; bumpLock(); return true;
      }
      function turn(dir) {
        if (over) return;
        const r = tryRotate(board, cur, dir);
        if (r) { cur = r; bumpLock(); sfx.play('click'); }
      }
      function stepDown() {
        if (collide(board, cur.m, cur.x, cur.y + 1)) return false;
        cur.y++; resets = 0; lockT = 0; return true;
      }
      function lock() {
        const above = merge(board, cur);
        const n = clearLines(board);
        if (n) {
          lines += n; score += lineScore(n, level); level = levelFor(lines);
          sfx.play(n >= 4 ? 'win' : 'good');
        } else sfx.play('place');
        stats(); canHold = true;
        if (above) return topOut();
        spawnNext();
      }
      function hardDrop() {
        if (over) return;
        const gy = ghostY(board, cur); score += 2 * (gy - cur.y); cur.y = gy;
        sfx.play('hit'); lock();
      }
      function doHold() {
        if (over || !canHold) return;
        const tcur = cur.t;
        if (hold) { cur = spawn(hold); } else { while (queue.length < 4) queue.push(nextType()); cur = spawn(queue.shift()); }
        hold = tcur; canHold = false; acc = 0; lockT = 0; resets = 0;
        sfx.play('click');
        if (collide(board, cur.m, cur.x, cur.y)) topOut();
      }
      function topOut() {
        if (over) return;
        over = true;
        const r = score >= 2000 ? 'win' : 'lose';
        res.innerHTML = `${t(r)}<small>${t('ttScore')}: ${score}</small>`; res.className = 'result show ' + r;
        sfx.play(r === 'win' ? 'win' : 'lose'); ctx.finish(r, score);
        act.innerHTML = `<button class="px-btn pink" id="again">${t('again')}</button>`;
        act.querySelector('#again').onclick = () => { sfx.play('click'); reset(); };
      }
      // ---------- wejście ----------
      function press(k) {
        if (over) return;
        if (k === 'left' || k === 'right') {
          held[k] = true; hdir = k === 'left' ? -1 : 1; hCharge = 0; hRep = false; move(hdir);
        } else if (k === 'down') soft = true;
        else if (k === 'rot') turn(1);
        else if (k === 'rotb') turn(-1);
        else if (k === 'drop') hardDrop();
        else if (k === 'hold') doHold();
      }
      function release(k) {
        if (k === 'down') soft = false;
        else if (k === 'left' || k === 'right') {
          held[k] = false;
          const want = held.left ? -1 : held.right ? 1 : 0;
          if (want !== hdir) { hdir = want; hCharge = 0; hRep = false; }
        }
      }
      const KM = { arrowleft: 'left', arrowright: 'right', arrowdown: 'down', arrowup: 'rot', x: 'rot', z: 'rotb', ' ': 'drop', c: 'hold', shift: 'hold' };
      const onKey = (e) => {
        if (e.target && e.target.tagName === 'INPUT') return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const k = KM[e.key.toLowerCase()]; if (!k) return;
        e.preventDefault();
        if (e.repeat) return;
        press(k);
      };
      const onKeyUp = (e) => { const k = KM[e.key.toLowerCase()]; if (k) release(k); };
      document.addEventListener('keydown', onKey);
      document.addEventListener('keyup', onKeyUp);
      const padHandlers = [];
      el.querySelectorAll('.tt-pad button').forEach(b => {
        const k = b.dataset.k;
        const down = (e) => { e.preventDefault(); press(k); };
        const up = () => release(k);
        b.addEventListener('pointerdown', down);
        ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => b.addEventListener(ev, up));
        padHandlers.push(b);
      });
      const onBlur = () => { held.left = held.right = false; hdir = 0; soft = false; };
      window.addEventListener('blur', onBlur);

      // ---------- pętla ----------
      function frame(now) {
        if (destroyed) return;
        const dt = Math.min(100, now - last); last = now;
        if (!over) {
          if (hdir) {
            hCharge += dt;
            if (!hRep && hCharge >= DAS) { hRep = true; hCharge -= DAS; }
            if (hRep) while (hCharge >= ARR) { hCharge -= ARR; if (!move(hdir)) { hCharge = 0; break; } }
          }
          const gm = soft ? Math.min(40, gravityMs(level)) : gravityMs(level);
          if (grounded()) {
            lockT += dt; acc = 0;
            if (lockT >= LOCK_MS) lock();
          } else {
            acc += dt;
            while (acc >= gm && !over) {
              acc -= gm;
              if (stepDown()) { if (soft) { score++; stats(); } } else break;
            }
          }
        }
        draw();
        raf = requestAnimationFrame(frame);
      }
      function cell(c, x, y, s, col, alpha) {
        c.globalAlpha = alpha == null ? 1 : alpha;
        c.fillStyle = col; c.shadowColor = col; c.shadowBlur = alpha === 0.25 ? 0 : 8;
        c.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
        c.shadowBlur = 0; c.fillStyle = 'rgba(255,255,255,.28)'; c.fillRect(x * s + 1, y * s + 1, s - 2, 3);
        c.globalAlpha = 1;
      }
      function mini(c, type, ox, oy, s) {
        const m = SHAPES[type]; let minx = 9, maxx = 0, miny = 9, maxy = 0;
        m.forEach((r, y) => r.forEach((v, x) => { if (v) { minx = Math.min(minx, x); maxx = Math.max(maxx, x); miny = Math.min(miny, y); maxy = Math.max(maxy, y); } }));
        const w = maxx - minx + 1, h = maxy - miny + 1;
        const offx = ox + (80 - w * s) / 2, offy = oy + (60 - h * s) / 2;
        m.forEach((r, y) => r.forEach((v, x) => { if (v) { c.save(); c.translate(offx - minx * s, offy - miny * s); cell(c, x, y, s, COLORS[type]); c.restore(); } }));
      }
      function draw() {
        g.fillStyle = '#05030f'; g.fillRect(0, 0, cv.width, cv.height);
        g.strokeStyle = 'rgba(138,77,255,.13)'; g.lineWidth = 1;
        for (let x = 0; x <= W; x++) { g.beginPath(); g.moveTo(x * CS + .5, 0); g.lineTo(x * CS + .5, cv.height); g.stroke(); }
        for (let y = 0; y <= H; y++) { g.beginPath(); g.moveTo(0, y * CS + .5); g.lineTo(cv.width, y * CS + .5); g.stroke(); }
        board.forEach((row, y) => row.forEach((v, x) => { if (v) cell(g, x, y, CS, COLORS[v]); }));
        if (!over) {
          const gy = ghostY(board, cur);
          cur.m.forEach((row, y) => row.forEach((v, x) => { if (v) cell(g, cur.x + x, gy + y, CS, COLORS[cur.t], 0.25); }));
          cur.m.forEach((row, y) => row.forEach((v, x) => { if (v && cur.y + y >= 0) cell(g, cur.x + x, cur.y + y, CS, COLORS[cur.t]); }));
        }
        hg.clearRect(0, 0, 80, 80); if (hold) { hg.globalAlpha = canHold ? 1 : 0.4; mini(hg, hold, 0, 10, 18); hg.globalAlpha = 1; }
        ng.clearRect(0, 0, 80, 240);
        for (let i = 0; i < 3 && i < queue.length; i++) mini(ng, queue[i], 0, i * 78, 18);
      }
      reset();
      raf = requestAnimationFrame(frame);
      return {
        destroy() {
          destroyed = true; cancelAnimationFrame(raf);
          document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKeyUp);
          window.removeEventListener('blur', onBlur);
        }
      };
    }
  };
})();

