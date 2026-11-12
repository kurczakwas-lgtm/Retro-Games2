/* ============================================================
   PAC-MAN NEON DASH — Classic Maze Collector (Solo)
   Dots, power pellets, 4 ghosts, warp tunnel, keyboard & D-pad
   ============================================================ */
(function () {
  I18N.add({
    pl: {
      g_pacman: 'Neon Pac-Man',
      g_pacman_d: 'Zbierz kropki w labiryncie i unikaj duchów',
      pac_lvl: 'POZIOM',
      pac_lives: 'ŻYCIA',
      pac_hint: 'Strzałki lub WASD — sterowanie'
    },
    en: {
      g_pacman: 'Neon Pac-Man',
      g_pacman_d: 'Eat all dots in the neon maze and dodge ghosts',
      pac_lvl: 'LEVEL',
      pac_lives: 'LIVES',
      pac_hint: 'Arrow keys or WASD — steer'
    }
  });

  // 19 cols x 21 rows: # wall, . dot, o power pellet, ' ' empty/tunnel, G ghost house
  const BASE_MAP = [
    '###################',
    '#........#........#',
    '#o##.###.#.###.##o#',
    '#.................#',
    '#.##.#.#####.#.##.#',
    '#....#...#...#....#',
    '####.### # ###.####',
    '   #.#       #.#   ',
    '####.# ##G## #.####',
    '    .  #   #  .    ',
    '####.# ##### #.####',
    '   #.#       #.#   ',
    '####.# ##### #.####',
    '#........#........#',
    '#.##.###.#.###.##.#',
    '#o.#.....P.....#.o#',
    '##.#.#.#####.#.#.##',
    '#....#...#...#....#',
    '#.######.#.######.#',
    '#.................#',
    '###################'
  ];

  Games.pacman = {
    id: 'pacman',
    nameKey: 'g_pacman',
    descKey: 'g_pacman_d',
    color: 'yellow',
    solo: true,
    diff: false,
    icon: pixelIcon([
      '...yyyyy...',
      '..yyyyyyy..',
      '.yyyy.yyyy.',
      '.yyyyyyy...',
      '.yyyyy.....',
      '.yyyyyyy...',
      '.yyyyyyyyy.',
      '..yyyyyyy..',
      '...yyyyy...'
    ]),
    start(el, ctx) {
      const { sfx, t, finish } = ctx;
      const T = 22, COLS = 19, ROWS = 21;
      const W = COLS * T, H = ROWS * T;

      el.innerHTML = `
        <div class="hud">
          <span>${t('score')}: <b id="pm-sc">0</b></span>
          <span>${t('pac_lvl')}: <b id="pm-lv">1</b></span>
          <span>${t('pac_lives')}: <b id="pm-hp">❤️❤️❤️</b></span>
        </div>
        <div class="canvas-wrap"><canvas id="pm-cv" class="arc-canvas yellow" width="${W}" height="${H}"></canvas></div>
        <div class="arcade-dpad">
          <div></div><button type="button" class="px-btn small" data-d="0,-1">▲</button><div></div>
          <button type="button" class="px-btn small" data-d="-1,0">◀</button>
          <button type="button" class="px-btn small" data-d="0,1">▼</button>
          <button type="button" class="px-btn small" data-d="1,0">▶</button>
        </div>
        <p class="hint" style="text-align:center;margin-top:6px"><small>${t('pac_hint')}</small></p>
      `;

      const cv = el.querySelector('#pm-cv');
      const g = cv.getContext('2d');
      const scEl = el.querySelector('#pm-sc');
      const lvEl = el.querySelector('#pm-lv');
      const hpEl = el.querySelector('#pm-hp');

      let grid = [], dotsLeft = 0, score = 0, level = 1, lives = 3;
      let over = false, raf = 0, tick = 0, frightTimer = 0, ghostCombo = 0;

      const pac = { tx: 9, ty: 15, x: 9 * T, y: 15 * T, dx: 0, dy: 0, ndx: 1, ndy: 0 };
      const GHOST_COLORS = ['#ff4e6a', '#ff85d8', '#00f0ff', '#ffa834'];
      const GHOST_STARTS = [
        { tx: 9, ty: 9, dx: 1, dy: 0 },
        { tx: 8, ty: 9, dx: -1, dy: 0 },
        { tx: 10, ty: 9, dx: 0, dy: -1 },
        { tx: 9, ty: 7, dx: 1, dy: 0 }
      ];
      let ghosts = [];

      function loadMap(resetActorsOnly) {
        if (!resetActorsOnly) {
          dotsLeft = 0;
          grid = BASE_MAP.map(row => row.split('').map(ch => {
            if (ch === '.' || ch === 'o') dotsLeft++;
            return ch;
          }));
        }
        pac.tx = 9; pac.ty = 15; pac.x = 9 * T; pac.y = 15 * T;
        pac.dx = 0; pac.dy = 0; pac.ndx = 1; pac.ndy = 0;
        ghosts = GHOST_STARTS.map((gs, idx) => ({
          tx: gs.tx, ty: gs.ty, x: gs.tx * T, y: gs.ty * T,
          dx: gs.dx, dy: gs.dy, col: GHOST_COLORS[idx], home: gs
        }));
        frightTimer = 0;
        updHud();
      }

      function updHud() {
        scEl.textContent = score;
        lvEl.textContent = level;
        hpEl.textContent = '❤️'.repeat(Math.max(0, lives)) || '💀';
      }

      function isWall(tx, ty) {
        if (ty < 0 || ty >= ROWS) return true;
        if (tx < 0 || tx >= COLS) return ty !== 9; // row 9 tunnel
        return grid[ty][tx] === '#';
      }

      function wrapTx(tx) {
        if (tx < 0) return COLS - 1;
        if (tx >= COLS) return 0;
        return tx;
      }

      const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];

      function stepPac() {
        const speed = 2;
        if (pac.x % T === 0 && pac.y % T === 0) {
          pac.tx = wrapTx(Math.round(pac.x / T));
          pac.x = pac.tx * T;
          pac.ty = Math.round(pac.y / T);
          // Eat dot or pellet
          const cell = grid[pac.ty] && grid[pac.ty][pac.tx];
          if (cell === '.' || cell === 'o') {
            grid[pac.ty][pac.tx] = ' ';
            dotsLeft--;
            if (cell === 'o') {
              score += 50;
              frightTimer = 420;
              ghostCombo = 0;
              sfx.play('good');
            } else {
              score += 10;
            }
            updHud();
            if (dotsLeft <= 0) {
              level++;
              score += 400;
              sfx.play('coin');
              loadMap(false);
              return;
            }
          }
          // Try buffered turn
          if (!isWall(pac.tx + pac.ndx, pac.ty + pac.ndy)) {
            pac.dx = pac.ndx; pac.dy = pac.ndy;
          } else if (isWall(pac.tx + pac.dx, pac.ty + pac.dy)) {
            pac.dx = 0; pac.dy = 0;
          }
        }
        pac.x += pac.dx * speed;
        pac.y += pac.dy * speed;
        if (pac.x < -T) pac.x = (COLS - 1) * T;
        if (pac.x >= COLS * T) pac.x = 0;
      }

      function stepGhosts() {
        const sp = frightTimer > 0 ? 1 : (tick % 3 === 0 && level > 1 ? 2 : 1.5);
        for (const gh of ghosts) {
          // Snap onto tile steps using integer px if sp=1 else discrete substeps
          const movePx = frightTimer > 0 ? 1 : (tick % 2 === 0 ? 2 : 1);
          for (let s = 0; s < movePx; s++) {
            if (gh.x % T === 0 && gh.y % T === 0) {
              gh.tx = wrapTx(Math.round(gh.x / T));
              gh.x = gh.tx * T;
              gh.ty = Math.round(gh.y / T);
              // Available directions (avoid immediate 180 unless dead-end)
              const opts = DIRS.filter(([dx, dy]) => !isWall(gh.tx + dx, gh.ty + dy));
              const nonRev = opts.filter(([dx, dy]) => !(dx === -gh.dx && dy === -gh.dy));
              const cand = nonRev.length ? nonRev : opts;
              if (cand.length) {
                // Chase target slightly or flee if frightened
                cand.sort((a, b) => {
                  const ax = gh.tx + a[0], ay = gh.ty + a[1];
                  const bx = gh.tx + b[0], by = gh.ty + b[1];
                  const da = Math.hypot(ax - pac.tx, ay - pac.ty);
                  const db = Math.hypot(bx - pac.tx, by - pac.ty);
                  return frightTimer > 0 ? db - da : da - db;
                });
                const chosen = Math.random() < (frightTimer > 0 ? 0.65 : 0.72) ? cand[0] : pick(cand);
                gh.dx = chosen[0]; gh.dy = chosen[1];
              }
            }
            gh.x += gh.dx;
            gh.y += gh.dy;
            if (gh.x < -T) gh.x = (COLS - 1) * T;
            if (gh.x >= COLS * T) gh.x = 0;
          }
          // Collision with Pac-Man
          if (Math.hypot(gh.x - pac.x, gh.y - pac.y) < T * 0.65) {
            if (frightTimer > 0) {
              ghostCombo++;
              score += 150 * ghostCombo;
              gh.tx = gh.home.tx; gh.ty = gh.home.ty;
              gh.x = gh.tx * T; gh.y = gh.ty * T;
              sfx.play('coin');
              updHud();
            } else {
              lives--;
              sfx.play('bad');
              updHud();
              if (lives <= 0) {
                over = true;
                const won = score >= 400 || level > 1;
                sfx.play(won ? 'win' : 'lose');
                setTimeout(() => finish(won ? 'win' : 'lose', score), 600);
                return;
              }
              loadMap(true);
              return;
            }
          }
        }
        void sp;
      }

      function draw() {
        g.fillStyle = '#060414';
        g.fillRect(0, 0, W, H);
        // Maze & Dots
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const ch = grid[r][c];
            const x = c * T, y = r * T;
            if (ch === '#') {
              g.fillStyle = '#1b164d';
              g.fillRect(x + 1, y + 1, T - 2, T - 2);
              g.strokeStyle = '#5c4cff';
              g.lineWidth = 1.2;
              g.strokeRect(x + 2, y + 2, T - 4, T - 4);
            } else if (ch === '.') {
              g.fillStyle = '#ffe6a7';
              g.beginPath();
              g.arc(x + T / 2, y + T / 2, 2.5, 0, Math.PI * 2);
              g.fill();
            } else if (ch === 'o') {
              const rPellet = 4.5 + Math.sin(tick * 0.16) * 1.1;
              g.fillStyle = '#ff4ecd';
              g.beginPath();
              g.arc(x + T / 2, y + T / 2, rPellet, 0, Math.PI * 2);
              g.fill();
            }
          }
        }
        // Pac-Man
        const cx = pac.x + T / 2, cy = pac.y + T / 2;
        const angle = pac.dx < 0 ? Math.PI : pac.dy < 0 ? -Math.PI / 2 : pac.dy > 0 ? Math.PI / 2 : 0;
        const mouth = 0.25 + 0.2 * Math.abs(Math.sin(tick * 0.25));
        g.fillStyle = '#ffe600';
        g.beginPath();
        g.moveTo(cx, cy);
        g.arc(cx, cy, T * 0.44, angle + mouth, angle + Math.PI * 2 - mouth);
        g.closePath();
        g.fill();

        // Ghosts
        for (const gh of ghosts) {
          const gx = gh.x + T / 2, gy = gh.y + T / 2, r = T * 0.42;
          const blink = frightTimer > 0 && frightTimer < 90 && Math.floor(tick / 6) % 2 === 0;
          g.fillStyle = frightTimer > 0 ? (blink ? '#ffffff' : '#3a6bff') : gh.col;
          g.beginPath();
          g.arc(gx, gy - 1, r, Math.PI, 0);
          g.lineTo(gx + r, gy + r);
          g.lineTo(gx - r, gy + r);
          g.closePath();
          g.fill();
          // Eyes
          g.fillStyle = '#fff';
          g.fillRect(gx - 4, gy - 4, 3, 4);
          g.fillRect(gx + 1, gy - 4, 3, 4);
          g.fillStyle = '#111';
          g.fillRect(gx - 3 + gh.dx, gy - 3 + gh.dy, 2, 2);
          g.fillRect(gx + 2 + gh.dx, gy - 3 + gh.dy, 2, 2);
        }
      }

      function loop() {
        if (over) return;
        raf = requestAnimationFrame(loop);
        tick++;
        if (frightTimer > 0) frightTimer--;
        stepPac();
        if (!over) stepGhosts();
        draw();
      }

      function setDir(dx, dy) {
        pac.ndx = dx; pac.ndy = dy;
      }

      el.querySelectorAll('[data-d]').forEach(b => {
        b.onclick = () => {
          const [dx, dy] = b.dataset.d.split(',').map(Number);
          setDir(dx, dy);
        };
      });

      function onKey(e) {
        const ae = document.activeElement;
        if (ae && /^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName)) return;
        const m = {
          ArrowLeft: [-1,0], a: [-1,0], A: [-1,0],
          ArrowRight: [1,0], d: [1,0], D: [1,0],
          ArrowUp: [0,-1], w: [0,-1], W: [0,-1],
          ArrowDown: [0,1], s: [0,1], S: [0,1]
        }[e.key];
        if (m) { e.preventDefault(); setDir(m[0], m[1]); }
      }
      addEventListener('keydown', onKey);

      loadMap(false);
      raf = requestAnimationFrame(loop);

      return {
        destroy() {
          over = true;
          cancelAnimationFrame(raf);
          removeEventListener('keydown', onKey);
        }
      };
    }
  };
})();

