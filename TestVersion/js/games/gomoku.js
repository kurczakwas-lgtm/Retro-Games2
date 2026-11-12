(function () {
  I18N.add({
    pl: { g_gomoku: 'Gomoku', g_gomoku_d: 'Pięć w linii na planszy 15×15. Prosty, a wciąga!', gmBlack: 'Czarne', gmWhite: 'Białe', gmThinking: 'Bot myśli...' },
    en: { g_gomoku: 'Gomoku', g_gomoku_d: 'Five in a row on a 15×15 board. Simple but addictive!', gmBlack: 'Black', gmWhite: 'White', gmThinking: 'Bot is thinking...' }
  });
  const N = 15, DIRS = [[1, 0], [0, 1], [1, 1], [1, -1]];
  const inb = (r, c) => r >= 0 && r < N && c >= 0 && c < N;
  function winAt(b, i, p) {
    const r = (i / N) | 0, c = i % N;
    for (const [dr, dc] of DIRS) {
      const line = [i];
      for (const s of [1, -1]) { let rr = r + dr * s, cc = c + dc * s; while (inb(rr, cc) && b[rr * N + cc] === p) { line.push(rr * N + cc); rr += dr * s; cc += dc * s; } }
      if (line.length >= 5) return line;
    }
    return null;
  }
  const PAT = (n, open) => n >= 5 ? 1e6 : n === 4 ? (open === 2 ? 20000 : open === 1 ? 2000 : 0) : n === 3 ? (open === 2 ? 1500 : open === 1 ? 120 : 0) : n === 2 ? (open === 2 ? 100 : open === 1 ? 10 : 0) : (open === 2 ? 8 : 1);
  function cellScore(b, i, p) {
    const r = (i / N) | 0, c = i % N; let sc = 0, threes = 0;
    for (const [dr, dc] of DIRS) {
      let n = 1, open = 0;
      for (const s of [1, -1]) { let rr = r + dr * s, cc = c + dc * s; while (inb(rr, cc) && b[rr * N + cc] === p) { n++; rr += dr * s; cc += dc * s; } if (inb(rr, cc) && !b[rr * N + cc]) open++; }
      const v = PAT(n, open); sc += v; if (v >= 1500 && v < 1e6) threes++;
    }
    return sc + (threes >= 2 ? 15000 : 0);   // podwójne zagrożenie
  }
  function candidates(b) {
    const set = new Set(); let any = false;
    for (let i = 0; i < N * N; i++) if (b[i]) { any = true; const r = (i / N) | 0, c = i % N; for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) if (inb(r + dr, c + dc) && !b[(r + dr) * N + c + dc]) set.add((r + dr) * N + c + dc); }
    return any ? [...set] : [112];
  }
  function botMove(b, me, foe, diff) {
    const cand = candidates(b);
    if (diff === 'easy' && Math.random() < 0.35) return pick(cand);
    let best = -1, list = [];
    const k = diff === 'hard' ? 1.15 : diff === 'normal' ? 0.9 : 0.6;
    for (const i of cand) {
      const r = (i / N) | 0, c = i % N, cen = 7 - Math.max(Math.abs(r - 7), Math.abs(c - 7)) * 0.5;
      const sc = cellScore(b, i, me) * (diff === 'hard' ? 1.1 : 1) + cellScore(b, i, foe) * k + cen + Math.random() * (diff === 'easy' ? 40 : 1);
      if (sc > best + 1e-9) { best = sc; list = [i]; } else if (Math.abs(sc - best) < 1e-9) list.push(i);
    }
    return pick(list);
  }

  Games.gomoku = {
    id: 'gomoku', nameKey: 'g_gomoku', descKey: 'g_gomoku_d', color: 'cyan',
    icon: pixelIcon(['ccccccccccc', 'c.c.c.c.c.c', 'ccccccccccc', 'c.cwcpcwc.c', 'ccccccccccc', 'c.cpcwcpc.c', 'ccccccccccc', 'c.cwcpcwc.c', 'ccccccccccc', 'c.c.c.c.c.c', 'ccccccccccc']),
    _engine: { winAt, botMove, cellScore },
    start(el, ctx) {
      const { t, net, sfx } = ctx, online = ctx.mode === 'online';
      let b, turn, over, round = 0, again, timers = [], last = -1, winLine = [];
      const myCol = () => ((ctx.first !== false) !== (round % 2 === 1)) ? 'B' : 'W';
      let me, foe;
      el.innerHTML = `<div class="gomoku"><div class="status" id="st"></div><div class="gm-info" id="info"></div>
        <div class="gm-board" id="bd" style="--n:${N}"></div><div class="result" id="res"></div><div class="actions" id="act"></div></div>`;
      const st = el.querySelector('#st'), bd = el.querySelector('#bd'), res = el.querySelector('#res'), act = el.querySelector('#act'), info = el.querySelector('#info');
      bd.innerHTML = Array.from({ length: N * N }, (_, i) => `<button class="gm-c" data-i="${i}" aria-label="${(i / N | 0) + 1}:${i % N + 1}"></button>`).join('');
      const cells = [...bd.children];
      function render() {
        cells.forEach((c, i) => { c.className = 'gm-c' + (b[i] ? ' s' + b[i] : '') + (i === last ? ' last' : '') + (winLine.includes(i) ? ' win' : ''); });
        if (!over) st.textContent = turn === me ? t('yourTurn') : (online ? t('oppTurn') : t('gmThinking'));
      }
      function reset() {
        b = Array(N * N).fill(''); over = false; last = -1; winLine = []; turn = 'B'; me = myCol(); foe = me === 'B' ? 'W' : 'B';
        again = { me: false, opp: false }; res.textContent = ''; res.className = 'result'; act.innerHTML = '';
        info.textContent = `${t('youAre') || ''}: ${me === 'B' ? t('gmBlack') : t('gmWhite')}`;
        render(); if (!online && turn === foe) botTurn();
      }
      function play(i, col) {
        b[i] = col; last = i; sfx.play(col === 'B' ? 'x' : 'o');
        const w = winAt(b, i, col);
        if (w) return end(col, w);
        if (!b.includes('')) return end('draw', []);
        turn = turn === 'B' ? 'W' : 'B'; render();
        if (!online && turn === foe) botTurn();
      }
      function end(w, line) {
        over = true; winLine = line; st.textContent = '';
        const r = w === 'draw' ? 'draw' : (w === me ? 'win' : 'lose');
        render(); res.textContent = t(r); res.className = 'result show ' + r; sfx.play(r); ctx.finish(r);
        act.innerHTML = `<button class="px-btn pink" id="again">${t('again')}</button>`;
        act.querySelector('#again').onclick = () => {
          sfx.play('click');
          if (!online) { round++; reset(); return; }
          again.me = true; net.send({ type: 'again' }); act.innerHTML = `<span class="hint">${t('waitOpp')}</span>`; tryAgain();
        };
      }
      function tryAgain() { if (again.me && again.opp) { round++; reset(); } }
      function botTurn() { timers.push(setTimeout(() => { if (!over) play(botMove(b, foe, me, ctx.difficulty), foe); }, 450)); }
      bd.addEventListener('click', (e) => {
        const c = e.target.closest('.gm-c'); if (!c) return; const i = +c.dataset.i;
        if (over || turn !== me || b[i]) return;
        play(i, me); if (online) net.send({ type: 'move', i });
      });
      if (online) net.setHandler((m) => {
        if (m.type === 'move' && !over && turn === foe && !b[m.i]) play(m.i, foe);
        else if (m.type === 'again') { again.opp = true; tryAgain(); }
      });
      reset();
      return { destroy() { timers.forEach(clearTimeout); } };
    }
  };
})();

