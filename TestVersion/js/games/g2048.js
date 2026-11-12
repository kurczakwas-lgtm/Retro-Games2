(function () {
  I18N.add({
    pl: { g_g2048: '2048', g_g2048_d: 'Łącz kafelki i zdobądź 2048. Solo!', g2048Hint: 'Strzałki / WASD / przesuń palcem', g2048Score: 'Wynik', g2048Best: 'Rekord', g2048Undo: 'Cofnij', g2048Keep: 'Kontynuuj', g2048Won: 'Masz 2048!' },
    en: { g_g2048: '2048', g_g2048_d: 'Merge tiles and reach 2048. Solo!', g2048Hint: 'Arrows / WASD / swipe', g2048Score: 'Score', g2048Best: 'Best', g2048Undo: 'Undo', g2048Keep: 'Keep going', g2048Won: 'You got 2048!' }
  });
  const N = 4, BEST_KEY = 'gamee_2048_best';

  // ---------- czyste funkcje ----------
  // Przesuwa linię w lewo. map[i] = docelowy indeks kafla z pozycji i (-1 dla pustych)
  function slideLine(line) {
    const n = line.length, out = Array(n).fill(0), map = Array(n).fill(-1);
    let score = 0, w = 0, lastMerged = true; // lastMerged: czy out[w-1] już powstał ze scalenia
    for (let i = 0; i < n; i++) {
      const v = line[i]; if (!v) continue;
      if (w > 0 && !lastMerged && out[w - 1] === v) { out[w - 1] = v * 2; score += v * 2; map[i] = w - 1; lastMerged = true; }
      else { out[w] = v; map[i] = w; w++; lastMerged = false; }
    }
    const moved = out.some((v, i) => v !== line[i]);
    return { row: out, score, moved, map };
  }
  // współrzędne linii dla kierunku: lista [r,c] od strony, do której kafle się przesuwają
  function lineCoords(dir, i) {
    const a = [];
    for (let k = 0; k < N; k++) {
      if (dir === 'left') a.push([i, k]);
      else if (dir === 'right') a.push([i, N - 1 - k]);
      else if (dir === 'up') a.push([k, i]);
      else a.push([N - 1 - k, i]);
    }
    return a;
  }
  function moveGrid(grid, dir) {
    const g = grid.map(r => r.slice()); let score = 0, moved = false; const moves = [];
    for (let i = 0; i < N; i++) {
      const co = lineCoords(dir, i), r = slideLine(co.map(([y, x]) => grid[y][x]));
      if (r.moved) moved = true; score += r.score;
      r.row.forEach((v, k) => { g[co[k][0]][co[k][1]] = v; });
      r.map.forEach((d, k) => { if (d >= 0) moves.push({ from: co[k], to: co[d], merged: r.row[d] !== grid[co[k][0]][co[k][1]] }); });
    }
    return { grid: g, score, moved, moves };
  }
  const canMove = (grid) => ['left', 'right', 'up', 'down'].some(d => moveGrid(grid, d).moved);
  const maxTile = (grid) => Math.max(...grid.flat());
  function emptyCells(grid) { const e = []; grid.forEach((r, y) => r.forEach((v, x) => { if (!v) e.push([y, x]); })); return e; }
  function addRandom(grid, rng) {
    const e = emptyCells(grid); if (!e.length) return null;
    const [y, x] = e[Math.floor(rng() * e.length)], v = rng() < 0.9 ? 2 : 4;
    grid[y][x] = v; return { y, x, v };
  }
  const newGrid = () => Array.from({ length: N }, () => Array(N).fill(0));

  Games.g2048 = {
    id: 'g2048', nameKey: 'g_g2048', descKey: 'g_g2048_d', color: 'yellow', solo: true, diff: false,
    icon: pixelIcon([
      '...........', '.yyyy.pppp.', '.y..y.p..p.', '.y..y.p..p.', '.yyyy.pppp.', '...........',
      '.cccc.gggg.', '.c..c.g..g.', '.c..c.g..g.', '.cccc.gggg.', '...........'
    ]),
    _engine: { slideLine, moveGrid, canMove, maxTile, addRandom, newGrid, emptyCells },
    start(el, ctx) {
      const { t, sfx } = ctx;
      el.innerHTML = `<div class="g2048">
        <div class="status" id="st">${t('g2048Hint')}</div>
        <div class="g48-top">
          <div class="g48-box"><small>${t('g2048Score')}</small><b id="sc">0</b></div>
          <div class="g48-box"><small>${t('g2048Best')}</small><b id="best">0</b></div>
          <button class="px-btn small ghost" id="undo">${t('g2048Undo')}</button>
        </div>
        <div class="g48-board" id="bd"><div class="g48-bg"></div><div class="g48-tiles" id="tiles"></div>
          <div class="g48-over" id="ov" hidden><div class="g48-ovt" id="ovt"></div><div class="actions" id="ova"></div></div></div>
        <div class="result" id="res"></div><div class="actions" id="act"></div></div>`;
      const bd = el.querySelector('#bd'), tilesEl = el.querySelector('#tiles'), bg = el.querySelector('.g48-bg');
      for (let i = 0; i < N * N; i++) bg.appendChild(document.createElement('i'));
      const elSc = el.querySelector('#sc'), elBest = el.querySelector('#best'), undoBtn = el.querySelector('#undo');
      const ov = el.querySelector('#ov'), ovt = el.querySelector('#ovt'), ova = el.querySelector('#ova');
      const res = el.querySelector('#res'), act = el.querySelector('#act');

      let grid, ids, score, best = 0, prev, over, wonShown, nextId, busy, finished;
      const tiles = new Map(), timers = [];
      try { best = parseInt(localStorage.getItem(BEST_KEY), 10) || 0; } catch (e) { }

      const setPos = (node, y, x) => { node.style.setProperty('--r', y); node.style.setProperty('--c', x); };
      function makeTile(v, y, x, isNew) {
        const id = nextId++, n = document.createElement('div');
        n.className = 'g48-tile' + (isNew ? ' new' : ''); n.dataset.v = v > 8192 ? 'big' : v;
        n.innerHTML = `<span>${v}</span>`; setPos(n, y, x); tilesEl.appendChild(n);
        tiles.set(id, { n, v }); return id;
      }
      function setValue(id, v, pop) {
        const o = tiles.get(id); o.v = v; o.n.dataset.v = v > 8192 ? 'big' : v; o.n.firstChild.textContent = v;
        if (pop) { o.n.classList.remove('pop'); void o.n.offsetWidth; o.n.classList.add('pop'); }
      }
      function rebuild() {
        tilesEl.innerHTML = ''; tiles.clear(); ids = newGrid();
        grid.forEach((r, y) => r.forEach((v, x) => { if (v) ids[y][x] = makeTile(v, y, x, false); }));
      }
      function hud() {
        elSc.textContent = score; elBest.textContent = best; undoBtn.disabled = !prev || over;
      }
      function reset() {
        timers.forEach(clearTimeout); timers.length = 0;
        grid = newGrid(); score = 0; prev = null; over = false; wonShown = false; nextId = 1; busy = false; finished = false;
        addRandom(grid, Math.random); addRandom(grid, Math.random);
        rebuild(); ov.hidden = true; res.textContent = ''; res.className = 'result'; act.innerHTML = '';
        hud(); sfx.play('click');
      }
      function doMove(dir) {
        if (over || busy || !ov.hidden) return;
        const r = moveGrid(grid, dir);
        if (!r.moved) return;
        prev = { grid: grid.map(x => x.slice()), score };
        const newIds = newGrid(); let merged = false; const mergeList = [];
        r.moves.forEach(m => {
          const id = ids[m.from[0]][m.from[1]], o = tiles.get(id);
          setPos(o.n, m.to[0], m.to[1]);
          if (m.merged) {
            const cur = newIds[m.to[0]][m.to[1]];
            if (cur) { mergeList.push({ keep: cur, drop: id, y: m.to[0], x: m.to[1] }); merged = true; return; }
          }
          newIds[m.to[0]][m.to[1]] = id;
        });
        // kafle scalane: pierwszy z kolejności przesunięcia jest "keep" - dopasuj wartości
        grid = r.grid; score += r.score; ids = newIds;
        busy = true;
        timers.push(setTimeout(() => {
          mergeList.forEach(m => {
            const o = tiles.get(m.drop); if (o) { o.n.remove(); tiles.delete(m.drop); }
            setValue(m.keep, grid[m.y][m.x], true);
          });
          const a = addRandom(grid, Math.random);
          if (a) ids[a.y][a.x] = makeTile(a.v, a.y, a.x, true);
          busy = false;
          if (score > best) { best = score; try { localStorage.setItem(BEST_KEY, best); } catch (e) { } }
          hud(); afterMove(merged);
        }, 120));
        hud(); sfx.play(merged ? 'coin' : 'place');
      }
      function afterMove() {
        if (!wonShown && maxTile(grid) >= 2048) {
          wonShown = true; sfx.play('win');
          ovt.textContent = t('g2048Won'); ov.hidden = false; ova.innerHTML =
            `<button class="px-btn green" id="keep">${t('g2048Keep')}</button><button class="px-btn pink" id="ag">${t('again')}</button>`;
          ova.querySelector('#keep').onclick = () => { sfx.play('click'); ov.hidden = true; };
          ova.querySelector('#ag').onclick = () => { sfx.play('click'); endGame(); ov.hidden = true; };
          return;
        }
        if (!canMove(grid)) endGame();
      }
      function endGame() {
        if (finished) return;
        finished = true; over = true;
        const r = maxTile(grid) >= 512 ? 'win' : 'lose';
        res.innerHTML = `${t(r)}<small>${t('g2048Score')}: ${score}</small>`; res.className = 'result show ' + r;
        sfx.play(r === 'win' ? 'win' : 'lose'); ctx.finish(r, score);
        act.innerHTML = `<button class="px-btn pink" id="again">${t('again')}</button>`;
        act.querySelector('#again').onclick = () => { sfx.play('click'); reset(); };
        hud();
      }
      undoBtn.onclick = () => {
        if (!prev || over || busy) return;
        grid = prev.grid; score = prev.score; prev = null; ov.hidden = true; rebuild(); hud(); sfx.play('click');
      };
      // ---------- wejście ----------
      const KM = { arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down' };
      const onKey = (e) => {
        if (e.target && e.target.tagName === 'INPUT') return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const d = KM[e.key.toLowerCase()]; if (!d) return;
        e.preventDefault(); doMove(d);
      };
      document.addEventListener('keydown', onKey);
      let sx = 0, sy = 0, tracking = false;
      bd.style.touchAction = 'none';
      bd.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; tracking = true; });
      bd.addEventListener('pointerup', (e) => {
        if (!tracking) return; tracking = false;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
      });
      bd.addEventListener('pointercancel', () => { tracking = false; });
      reset();
      return { destroy() { timers.forEach(clearTimeout); document.removeEventListener('keydown', onKey); } };
    }
  };
})();

