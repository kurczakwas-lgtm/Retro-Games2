(function () {
  I18N.add({
    pl: { g_mines: 'Saper', g_mines_d: 'Odkryj pole bez min. Flaguj, licz i nie wybuchnij!', minesHint: 'Klik: odkryj · prawy / przytrzymaj: flaga · klik na cyfrę: odkryj wokół', minesFlag: 'Flaga', minesMines: 'Miny', minesTime: 'Czas', minesRestart: 'Od nowa' },
    en: { g_mines: 'Minesweeper', g_mines_d: 'Clear the field without hitting a mine. Flag, count, survive!', minesHint: 'Click: reveal · right-click / long-press: flag · click a number: chord', minesFlag: 'Flag', minesMines: 'Mines', minesTime: 'Time', minesRestart: 'Restart' }
  });
  const LEVELS = { easy: { w: 9, h: 9, m: 10 }, normal: { w: 16, h: 16, m: 40 }, hard: { w: 30, h: 16, m: 99 } };
  const LONG_MS = 450;

  // ---------- czyste funkcje ----------
  function neighbors(w, h, x, y) {
    const r = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && ny >= 0 && nx < w && ny < h) r.push(ny * w + nx);
    }
    return r;
  }
  function newState(w, h, m) {
    return { w, h, m, mines: null, nums: null, rev: new Uint8Array(w * h), flag: new Uint8Array(w * h), revealed: 0 };
  }
  // pierwszy klik (sx,sy) i jego otoczenie są wolne od min
  function placeMines(st, sx, sy, rng) {
    const { w, h, m } = st, n = w * h, safe = new Set([sy * w + sx, ...neighbors(w, h, sx, sy)]);
    let pool = []; for (let i = 0; i < n; i++) if (!safe.has(i)) pool.push(i);
    if (pool.length < m) { // plansza za mała na pełną strefę - zostaw tylko klikniętą
      pool = []; for (let i = 0; i < n; i++) if (i !== sy * w + sx) pool.push(i);
    }
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const mines = new Uint8Array(n); pool.slice(0, m).forEach(i => { mines[i] = 1; });
    const nums = new Uint8Array(n);
    for (let i = 0; i < n; i++) nums[i] = neighbors(w, h, i % w, Math.floor(i / w)).reduce((a, k) => a + mines[k], 0);
    st.mines = mines; st.nums = nums;
  }
  // iteracyjny flood fill; zwraca {hit, opened:[indeksy]}
  function reveal(st, x, y) {
    const { w, h } = st, start = y * w + x, opened = [];
    if (st.rev[start] || st.flag[start]) return { hit: false, opened };
    if (st.mines[start]) { st.rev[start] = 1; return { hit: true, opened: [start], at: start }; }
    const stack = [start]; st.rev[start] = 1;
    while (stack.length) {
      const i = stack.pop(); opened.push(i); st.revealed++;
      if (st.nums[i] !== 0) continue;
      for (const k of neighbors(w, h, i % w, Math.floor(i / w))) {
        if (!st.rev[k] && !st.flag[k] && !st.mines[k]) { st.rev[k] = 1; stack.push(k); }
      }
    }
    return { hit: false, opened };
  }
  function chord(st, x, y) {
    const { w, h } = st, i = y * w + x;
    if (!st.rev[i] || !st.nums[i]) return { hit: false, opened: [] };
    const nb = neighbors(w, h, x, y);
    if (nb.reduce((a, k) => a + st.flag[k], 0) !== st.nums[i]) return { hit: false, opened: [] };
    let hit = false, opened = [], at;
    for (const k of nb) {
      if (st.rev[k] || st.flag[k]) continue;
      const r = reveal(st, k % w, Math.floor(k / w));
      opened = opened.concat(r.opened); if (r.hit) { hit = true; at = r.at; }
    }
    return { hit, opened, at };
  }
  const isWon = (st) => st.mines && st.revealed === st.w * st.h - st.m;

  Games.mines = {
    id: 'mines', nameKey: 'g_mines', descKey: 'g_mines_d', color: 'purple', solo: true, diff: true,
    icon: pixelIcon([
      '.....w.....', '..w..w..w..', '...rrrrr...', '..rrrwrrr..', '.rrrrwrrrr.', 'wwrrwwwrrww',
      '.rrrrrrrrr.', '..rrrrrrr..', '...rrrrr...', '..w..w..w..', '.....w.....'
    ]),
    _engine: { LEVELS, neighbors, newState, placeMines, reveal, chord, isWon },
    start(el, ctx) {
      const { t, sfx } = ctx;
      const L = LEVELS[ctx.difficulty] || LEVELS.normal, { w, h } = L;
      el.innerHTML = `<div class="mines" style="--cols:${w};--max:${w > 16 ? 28 : w > 9 ? 32 : 40}px">
        <div class="status" id="st">${t('minesHint')}</div>
        <div class="mn-top">
          <div class="mn-box"><small>${t('minesMines')}</small><b id="cnt">0</b></div>
          <button class="px-btn small ghost" id="mode" aria-pressed="false">⚑ ${t('minesFlag')}</button>
          <button class="px-btn small ghost" id="rs" title="${t('minesRestart')}">↻</button>
          <div class="mn-box"><small>${t('minesTime')}</small><b id="tm">0</b></div>
        </div>
        <div class="mn-scroll"><div class="mn-grid" id="gr" style="grid-template-columns:repeat(${w},var(--cs))"></div></div>
        <div class="result" id="res"></div><div class="actions" id="act"></div></div>`;
      const gr = el.querySelector('#gr'), cnt = el.querySelector('#cnt'), tm = el.querySelector('#tm');
      const modeBtn = el.querySelector('#mode'), rs = el.querySelector('#rs');
      const res = el.querySelector('#res'), act = el.querySelector('#act');
      const cells = [];
      for (let i = 0; i < w * h; i++) {
        const d = document.createElement('div'); d.className = 'mn-c'; d.dataset.i = i; gr.appendChild(d); cells.push(d);
      }
      let st, started, over, flagMode = false, t0, tick, flags, explode, destroyed = false;

      function reset() {
        clearInterval(tick); st = newState(w, h, L.m); started = false; over = false; flags = 0; explode = -1;
        tm.textContent = '0'; res.textContent = ''; res.className = 'result'; act.innerHTML = '';
        paintAll(); sfx.play('click');
      }
      const secs = () => Math.max(0, Math.floor((Date.now() - t0) / 1000));
      function paint(i) {
        const c = cells[i]; let cls = 'mn-c', txt = '';
        if (st.rev[i]) {
          cls += ' open';
          if (st.mines[i]) { cls += ' mine' + (i === explode ? ' boom' : ''); txt = '✹'; }
          else if (st.nums[i]) { cls += ' n' + st.nums[i]; txt = st.nums[i]; }
        } else if (st.flag[i]) {
          if (over && st.mines && !st.mines[i]) { cls += ' wrong'; txt = '✖'; } else { cls += ' flag'; txt = '⚑'; }
        } else if (over && st.mines && st.mines[i]) { cls += ' open mine'; txt = '✹'; }
        if (c.className !== cls) c.className = cls;
        if (c.textContent !== String(txt)) c.textContent = txt;
      }
      function paintAll() { for (let i = 0; i < w * h; i++) paint(i); cnt.textContent = L.m - flags; }

      function begin(x, y) {
        placeMines(st, x, y, Math.random); started = true; t0 = Date.now();
        tick = setInterval(() => { tm.textContent = secs(); }, 250);
      }
      function lose(at) {
        over = true; explode = at; clearInterval(tick);
        paintAll(); sfx.play('lose');
        res.textContent = t('lose'); res.className = 'result show lose';
        ctx.finish('lose', 0); showAgain();
      }
      function win() {
        over = true; clearInterval(tick);
        const time = Math.max(1, secs()); tm.textContent = time;
        for (let i = 0; i < w * h; i++) if (st.mines[i]) st.flag[i] = 1;
        flags = L.m; paintAll(); sfx.play('win');
        res.innerHTML = `${t('win')}<small>${t('minesTime')}: ${time}s</small>`; res.className = 'result show win';
        ctx.finish('win', time); showAgain();
      }
      function showAgain() {
        act.innerHTML = `<button class="px-btn pink" id="again">${t('again')}</button>`;
        act.querySelector('#again').onclick = () => { sfx.play('click'); reset(); };
      }
      function after(r) {
        if (r.opened.length) { r.opened.forEach(paint); sfx.play('click'); }
        if (r.hit) return lose(r.at);
        if (isWon(st)) win();
      }
      function open(i) {
        if (over) return;
        const x = i % w, y = Math.floor(i / w);
        if (st.rev[i]) { if (started) after(chord(st, x, y)); return; }
        if (st.flag[i]) return;
        if (!started) begin(x, y);
        after(reveal(st, x, y));
      }
      function toggleFlag(i) {
        if (over || st.rev[i]) return;
        st.flag[i] = st.flag[i] ? 0 : 1; flags += st.flag[i] ? 1 : -1;
        paint(i); cnt.textContent = L.m - flags; sfx.play('place');
      }
      function primary(i) { if (flagMode && !st.rev[i]) toggleFlag(i); else open(i); }

      // ---------- wejście ----------
      let down = null, lp = null;
      const cellOf = (e) => { const c = e.target.closest ? e.target.closest('.mn-c') : null; return c ? +c.dataset.i : -1; };
      const cancelLP = () => { clearTimeout(lp); lp = null; };
      gr.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const i = cellOf(e); if (i < 0) return;
        down = { i, x: e.clientX, y: e.clientY, fired: false, type: e.pointerType };
        if (e.pointerType !== 'mouse') {
          lp = setTimeout(() => {
            if (!down || destroyed) return; down.fired = true;
            if (!st.rev[i]) { toggleFlag(i); if (navigator.vibrate) { try { navigator.vibrate(30); } catch (x) { } } }
          }, LONG_MS);
        }
      });
      gr.addEventListener('pointermove', (e) => {
        if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10) { cancelLP(); down = null; }
      });
      gr.addEventListener('pointerup', (e) => {
        cancelLP(); const d = down; down = null;
        if (!d || d.fired) return;
        if (cellOf(e) !== d.i) return;
        primary(d.i);
      });
      gr.addEventListener('pointercancel', () => { cancelLP(); down = null; });
      gr.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        const i = cellOf(e);
        if (i >= 0 && e.pointerType !== 'touch' && !(down && down.type !== 'mouse')) toggleFlag(i);
      });
      modeBtn.onclick = () => {
        flagMode = !flagMode; modeBtn.classList.toggle('on', flagMode); modeBtn.setAttribute('aria-pressed', flagMode); sfx.play('click');
      };
      rs.onclick = () => { if (!over && started) { /* restart bez wyniku */ } reset(); };
      reset();
      return { destroy() { destroyed = true; clearInterval(tick); cancelLP(); } };
    }
  };
})();

