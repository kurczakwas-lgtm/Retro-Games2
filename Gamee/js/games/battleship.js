(function () {
  const N = 10, FLEET = [5, 4, 3, 3, 2];
  const grid = (v) => Array.from({ length: N }, () => Array(N).fill(v));
  const mk = () => ({ grid: grid(-1), ships: [], shots: grid(0) });
  const inb = (r, c) => r >= 0 && c >= 0 && r < N && c < N;

  function canPlace(b, r, c, len, h) {
    for (let i = 0; i < len; i++) {
      const rr = r + (h ? 0 : i), cc = c + (h ? i : 0);
      if (!inb(rr, cc) || b.grid[rr][cc] !== -1) return false;
    }
    return true;
  }
  function place(b, r, c, len, h) {
    const idx = b.ships.length, cells = [];
    for (let i = 0; i < len; i++) {
      const rr = r + (h ? 0 : i), cc = c + (h ? i : 0);
      b.grid[rr][cc] = idx; cells.push([rr, cc]);
    }
    b.ships.push({ len, cells, hits: 0 });
  }
  function unplace(b) {
    const s = b.ships.pop(); if (!s) return;
    s.cells.forEach(([r, c]) => b.grid[r][c] = -1);
  }
  function randomFleet(b) {
    while (b.ships.length) unplace(b);
    for (const len of FLEET) {
      let ok = false;
      while (!ok) {
        const h = Math.random() < 0.5, r = rnd(N), c = rnd(N);
        if (canPlace(b, r, c, len, h)) { place(b, r, c, len, h); ok = true; }
      }
    }
  }
  function receive(b, r, c) {
    b.shots[r][c] = 1;
    const idx = b.grid[r][c];
    if (idx < 0) return { hit: false, sunk: null, over: false };
    const s = b.ships[idx]; s.hits++;
    const sunk = s.hits === s.len;
    return { hit: true, sunk: sunk ? s.cells : null, over: b.ships.every(x => x.hits === x.len) };
  }

  // ---- Bot AI: bm = bot's view of my board (0 unknown, 1 miss, 2 hit, 3 sunk)
  function botShot(bm, diff) {
    const free = []; const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (bm[r][c] === 0) free.push([r, c]);
    if (diff !== 'easy') {
      const targets = [], strong = [];
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (bm[r][c] === 2) {
        for (const [dr, dc] of dirs) {
          const rr = r + dr, cc = c + dc;
          if (!inb(rr, cc) || bm[rr][cc] !== 0) continue;
          targets.push([rr, cc]);
          const br = r - dr, bc = c - dc;
          if (diff === 'hard' && inb(br, bc) && bm[br][bc] === 2) strong.push([rr, cc]);
        }
      }
      if (strong.length) return pick(strong);
      if (targets.length) return pick(targets);
      if (diff === 'hard') {
        const par = free.filter(([r, c]) => (r + c) % 2 === 0);
        if (par.length) return pick(par);
      }
    }
    return pick(free);
  }

  Games.battleship = {
    id: 'battleship', nameKey: 'g_battleship', descKey: 'g_battleship_d', color: 'yellow',
    icon: pixelIcon([
      '......c....', '......cy...', '......cyy..', '......c....', '......c....',
      '...ppppppp.', '....ppppp..', 'bbbbbbbbbbb', '.bbb.bbb.bb', 'bbbbbbbbbbb', '...........'
    ]),
    start(el, ctx) {
      const { t, net, sfx } = ctx;
      const online = ctx.mode === 'online';
      let my, enemy, marks, bm, phase, turn, horiz, readyMe, readyOpp, again, timers = [], hover = null;

      el.innerHTML = `<div class="bs">
        <div class="status" id="st"></div>
        <div class="bs-boards">
          <div class="bs-wrap"><h3>${t('yourFleet')}</h3><div class="bs-grid" id="mine"></div></div>
          <div class="bs-wrap" id="eWrap"><h3>${t('enemyFleet')}</h3><div class="bs-grid" id="theirs"></div></div>
        </div>
        <div class="result" id="res"></div>
        <div class="actions" id="act"></div></div>`;
      const $ = (s) => el.querySelector(s);
      const st = $('#st'), mineEl = $('#mine'), theirsEl = $('#theirs'), eWrap = $('#eWrap'), res = $('#res'), act = $('#act');

      function buildGrid(g, cls) {
        let h = '';
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) h += `<button class="bc" data-r="${r}" data-c="${c}"></button>`;
        g.innerHTML = h;
      }
      buildGrid(mineEl); buildGrid(theirsEl);

      function paint() {
        const mc = mineEl.children, tc = theirsEl.children;
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
          const i = r * N + c; let cls = 'bc';
          const idx = my.grid[r][c];
          if (idx >= 0) cls += ' ship';
          if (my.shots[r][c]) {
            if (idx >= 0) { const s = my.ships[idx]; cls += s.hits === s.len ? ' sunk' : ' hit'; } else cls += ' miss';
          }
          mc[i].className = cls;
          const m = marks[r][c];
          tc[i].className = 'bc' + (m === 1 ? ' miss' : m === 2 ? ' hit' : m === 3 ? ' sunk' : '') +
            (phase === 'battle' && turn === 'me' && !m ? ' aim' : '');
        }
        eWrap.classList.toggle('dim', phase === 'place' || phase === 'wait' && !readyOpp);
        eWrap.hidden = phase === 'place';
      }
      function paintPreview() {
        const mc = mineEl.children;
        for (let i = 0; i < mc.length; i++) mc[i].classList.remove('pv', 'bad');
        if (phase !== 'place' || !hover || my.ships.length >= FLEET.length) return;
        const len = FLEET[my.ships.length], ok = canPlace(my, hover[0], hover[1], len, horiz);
        for (let i = 0; i < len; i++) {
          const rr = hover[0] + (horiz ? 0 : i), cc = hover[1] + (horiz ? i : 0);
          if (inb(rr, cc)) mc[rr * N + cc].classList.add(ok ? 'pv' : 'bad');
        }
      }
      function status() {
        if (phase === 'place') {
          const n = my.ships.length;
          st.textContent = n < FLEET.length ? `${t('placeHint')} ${FLEET[n]}` : t('ready') + '?';
        } else if (phase === 'wait') st.textContent = t('waitReady');
        else if (phase === 'battle') st.textContent = turn === 'me' ? t('fireHint') : t('enemyTurn');
      }
      function placeButtons() {
        act.innerHTML = `
          <button class="px-btn small" id="bRot">${t('rotate')}</button>
          <button class="px-btn small" id="bRnd">${t('random')}</button>
          <button class="px-btn small ghost" id="bUndo">${t('undo')}</button>
          <button class="px-btn pink" id="bReady" ${my.ships.length < FLEET.length ? 'disabled' : ''}>${t('ready')}</button>`;
        $('#bRot').onclick = () => { horiz = !horiz; sfx.play('click'); paintPreview(); };
        $('#bRnd').onclick = () => { randomFleet(my); sfx.play('place'); refresh(); };
        $('#bUndo').onclick = () => { unplace(my); sfx.play('click'); refresh(); };
        $('#bReady').onclick = ready;
      }
      function refresh() { paint(); status(); if (phase === 'place') { placeButtons(); paintPreview(); } }

      function reset() {
        my = mk(); enemy = null; marks = grid(0); bm = grid(0);
        phase = 'place'; horiz = true; readyMe = readyOpp = false; again = { me: false, opp: false };
        res.textContent = ''; res.className = 'result';
        refresh();
      }
      function ready() {
        sfx.play('good');
        if (!online) {
          enemy = mk(); randomFleet(enemy); phase = 'battle'; turn = 'me'; act.innerHTML = ''; refresh(); return;
        }
        readyMe = true; phase = 'wait'; net.send({ type: 'ready' });
        act.innerHTML = '';
        maybeStart(); refresh();
      }
      function maybeStart() {
        if (readyMe && readyOpp) { phase = 'battle'; turn = ctx.role === 'host' ? 'me' : 'opp'; refresh(); }
      }
      function mark(grid_, r, c, res_) {
        grid_[r][c] = res_.hit ? 2 : 1;
        if (res_.sunk) res_.sunk.forEach(([a, b]) => grid_[a][b] = 3);
      }
      function sfxFor(r_) { sfx.play(r_.sunk ? 'sunk' : r_.hit ? 'hit' : 'miss'); }
      function fire(r, c) {
        if (phase !== 'battle' || turn !== 'me' || marks[r][c]) return;
        if (!online) {
          const rr = receive(enemy, r, c); mark(marks, r, c, rr); sfxFor(rr);
          if (rr.over) return end('win');
          turn = 'opp'; refresh(); botTurn();
        } else {
          turn = 'busy'; net.send({ type: 'shot', r, c }); refresh();
        }
      }
      function botTurn() {
        timers.push(setTimeout(() => {
          if (phase !== 'battle') return;
          const [r, c] = botShot(bm, ctx.difficulty);
          const rr = receive(my, r, c); mark(bm, r, c, rr); sfxFor(rr);
          if (rr.over) return end('lose');
          turn = 'me'; refresh();
        }, 750));
      }
      function end(r) {
        phase = 'over'; turn = null; refresh(); st.textContent = '';
        res.textContent = t(r); res.className = 'result show ' + r;
        sfx.play(r); ctx.finish(r);
        act.innerHTML = `<button class="px-btn pink" id="again">${t('again')}</button>`;
        act.querySelector('#again').onclick = () => {
          sfx.play('click');
          if (!online) { reset(); return; }
          again.me = true; net.send({ type: 'again' });
          act.innerHTML = `<span class="hint">${t('waitOpp')}</span>`;
          tryAgain();
        };
      }
      function tryAgain() { if (again.me && again.opp) reset(); }

      mineEl.addEventListener('click', (e) => {
        const b = e.target.closest('.bc'); if (!b || phase !== 'place' || my.ships.length >= FLEET.length) return;
        const r = +b.dataset.r, c = +b.dataset.c, len = FLEET[my.ships.length];
        if (canPlace(my, r, c, len, horiz)) { place(my, r, c, len, horiz); sfx.play('place'); refresh(); } else sfx.play('bad');
      });
      mineEl.addEventListener('mouseover', (e) => {
        const b = e.target.closest('.bc'); if (!b) return;
        hover = [+b.dataset.r, +b.dataset.c]; paintPreview();
      });
      mineEl.addEventListener('mouseleave', () => { hover = null; paintPreview(); });
      theirsEl.addEventListener('click', (e) => {
        const b = e.target.closest('.bc'); if (b) fire(+b.dataset.r, +b.dataset.c);
      });
      const onKey = (e) => { if ((e.key === 'r' || e.key === 'R') && phase === 'place') { horiz = !horiz; paintPreview(); } };
      document.addEventListener('keydown', onKey);

      if (online) net.setHandler((m) => {
        if (m.type === 'ready') { readyOpp = true; maybeStart(); refresh(); }
        else if (m.type === 'shot' && phase === 'battle' && !my.shots[m.r][m.c]) {
          const rr = receive(my, m.r, m.c);
          net.send({ type: 'result', r: m.r, c: m.c, hit: rr.hit, sunk: rr.sunk, over: rr.over });
          sfxFor(rr);
          if (rr.over) end('lose'); else { turn = 'me'; refresh(); }
        } else if (m.type === 'result' && phase === 'battle') {
          mark(marks, m.r, m.c, m); sfxFor(m);
          if (m.over) end('win'); else { turn = 'opp'; refresh(); }
        } else if (m.type === 'again') { again.opp = true; tryAgain(); }
      });
      reset();
      return { destroy() { timers.forEach(clearTimeout); document.removeEventListener('keydown', onKey); } };
    }
  };
})();
