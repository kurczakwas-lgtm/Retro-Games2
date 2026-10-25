(function () {
  I18N.add({
    pl: { g_c4: 'Cztery w rzędzie', g_c4_d: 'Ułóż cztery krążki w linii.', yourColor: 'Twój kolor' },
    en: { g_c4: 'Connect Four', g_c4_d: 'Line up four discs in a row.', yourColor: 'Your color' }
  });
  const R = 6, C = 7;
  const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
  const newBoard = () => Array.from({ length: R }, () => Array(C).fill(0));
  const valid = (b) => [3, 2, 4, 1, 5, 0, 6].filter(c => !b[0][c]);
  function drop(b, c, p) { for (let r = R - 1; r >= 0; r--) if (!b[r][c]) { b[r][c] = p; return r; } return -1; }
  function lift(b, c) { for (let r = 0; r < R; r++) if (b[r][c]) { b[r][c] = 0; return; } }
  function winLine(b) {
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const v = b[r][c]; if (!v) continue;
      for (const [dr, dc] of DIRS) {
        const cells = [[r, c]];
        for (let i = 1; i < 4; i++) {
          const rr = r + dr * i, cc = c + dc * i;
          if (rr < 0 || rr >= R || cc < 0 || cc >= C || b[rr][cc] !== v) break;
          cells.push([rr, cc]);
        }
        if (cells.length === 4) return { p: v, cells };
      }
    }
    return null;
  }
  function evaluate(b, me, op) {
    let s = 0;
    for (let r = 0; r < R; r++) if (b[r][3] === me) s += 4; else if (b[r][3] === op) s -= 4;
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) for (const [dr, dc] of DIRS) {
      const er = r + dr * 3, ec = c + dc * 3;
      if (er < 0 || er >= R || ec < 0 || ec >= C) continue;
      let m = 0, o = 0;
      for (let i = 0; i < 4; i++) { const v = b[r + dr * i][c + dc * i]; if (v === me) m++; else if (v === op) o++; }
      if (m && o) continue;
      if (m === 3) s += 50; else if (m === 2) s += 10;
      if (o === 3) s -= 80; else if (o === 2) s -= 8;
    }
    return s;
  }
  function search(b, depth, alpha, beta, maxi, me, op) {
    const w = winLine(b);
    if (w) return (w.p === me ? 1e6 : -1e6) * (1 + depth / 10);
    const cols = valid(b);
    if (!cols.length) return 0;
    if (depth === 0) return evaluate(b, me, op);
    let best = maxi ? -Infinity : Infinity;
    for (const c of cols) {
      drop(b, c, maxi ? me : op);
      const sc = search(b, depth - 1, alpha, beta, !maxi, me, op);
      lift(b, c);
      if (maxi) { best = Math.max(best, sc); alpha = Math.max(alpha, best); } else { best = Math.min(best, sc); beta = Math.min(beta, best); }
      if (beta <= alpha) break;
    }
    return best;
  }
  function botMove(b, me, op, diff) {
    const cols = valid(b);
    if (diff === 'easy') {
      for (const p of [me, op]) if (Math.random() < 0.5) for (const c of cols) { drop(b, c, p); const w = winLine(b); lift(b, c); if (w) return c; }
      return pick(cols);
    }
    const depth = diff === 'hard' ? 5 : 2;
    let best = -Infinity, moves = [];
    for (const c of cols) {
      drop(b, c, me);
      const s = search(b, depth - 1, -Infinity, Infinity, false, me, op);
      lift(b, c);
      if (s > best) { best = s; moves = [c]; } else if (s === best) moves.push(c);
    }
    return pick(moves);
  }

  Games.c4 = {
    id: 'c4', nameKey: 'g_c4', descKey: 'g_c4_d', color: 'purple',
    icon: pixelIcon([
      'bbbbbbbbbbb', 'b.b.b.b.b.b', 'bbbbbbbbbbb', 'b.b.bpb.b.b', 'bbbbbbbbbbb', 'b.bpbybpb.b',
      'bbbbbbbbbbb', 'bpbybpbyb.b', 'bbbbbbbbbbb', 'bybpbybpbyb', 'bbbbbbbbbbb'
    ]),
    start(el, ctx) {
      const { t, net, sfx } = ctx;
      const online = ctx.mode === 'online';
      const me = online ? (ctx.role === 'host' ? 1 : 2) : 1, opp = me === 1 ? 2 : 1;
      let board, turn, over, round = 0, again, timers = [], last = null;

      el.innerHTML = `<div class="c4">
        <div class="status" id="st"></div>
        <div class="c4-me">${t('yourColor')}: <i class="disc p${me}"></i></div>
        <div class="c4-board" id="bd">${Array.from({ length: C }, (_, c) => `<button class="c4-col" data-c="${c}" aria-label="col ${c + 1}">${Array.from({ length: R }, () => '<span class="c4-cell"></span>').join('')}</button>`).join('')}</div>
        <div class="result" id="res"></div><div class="actions" id="act"></div></div>`;
      const st = el.querySelector('#st'), res = el.querySelector('#res'), act = el.querySelector('#act');
      const cols = [...el.querySelectorAll('.c4-col')];

      function cellEl(r, c) { return cols[c].children[r]; }
      function paint(line) {
        for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
          const e = cellEl(r, c), v = board[r][c];
          e.className = 'c4-cell' + (v ? ' p' + v : '');
          e.style.removeProperty('--d');
        }
        if (last) { const e = cellEl(last.r, last.c); e.classList.add('new'); e.style.setProperty('--d', last.r + 1); }
        (line || []).forEach(([r, c]) => cellEl(r, c).classList.add('win'));
        cols.forEach(b => b.classList.toggle('on', !over && turn === me && !board[0][+b.dataset.c]));
        if (!over) st.textContent = turn === me ? t('yourTurn') : t('oppTurn');
      }
      function reset() {
        board = newBoard(); over = false; last = null; again = { me: false, opp: false };
        turn = round % 2 ? 2 : 1; res.textContent = ''; res.className = 'result'; act.innerHTML = '';
        paint();
        if (!online && turn === opp) botTurn();
      }
      function play(c, p) {
        const r = drop(board, c, p); if (r < 0) return;
        last = { r, c }; sfx.play(p === 1 ? 'x' : 'o');
        const w = winLine(board);
        if (w) { paint(w.cells); return end(w.p); }
        if (!valid(board).length) { paint(); return end(0); }
        turn = turn === 1 ? 2 : 1; paint();
        if (!online && turn === opp) botTurn();
      }
      function end(w) {
        over = true; st.textContent = '';
        cols.forEach(b => b.classList.remove('on'));
        const r = w === 0 ? 'draw' : (w === me ? 'win' : 'lose');
        res.textContent = t(r); res.className = 'result show ' + r;
        sfx.play(r); ctx.finish(r);
        act.innerHTML = `<button class="px-btn pink" id="again">${t('again')}</button>`;
        act.querySelector('#again').onclick = () => {
          sfx.play('click');
          if (!online) { round++; reset(); return; }
          again.me = true; net.send({ type: 'again' });
          act.innerHTML = `<span class="hint">${t('waitOpp')}</span>`; tryAgain();
        };
      }
      function tryAgain() { if (again.me && again.opp) { round++; reset(); } }
      function botTurn() {
        timers.push(setTimeout(() => {
          if (over) return;
          const c = botMove(board, opp, me, ctx.difficulty);
          play(c, opp);
        }, 600));
      }
      cols.forEach(b => b.onclick = () => {
        const c = +b.dataset.c;
        if (over || turn !== me || board[0][c]) return;
        play(c, me);
        if (online) net.send({ type: 'move', c });
      });
      if (online) net.setHandler((m) => {
        if (m.type === 'move' && !over && turn === opp && !board[0][m.c]) play(m.c, opp);
        else if (m.type === 'again') { again.opp = true; tryAgain(); }
      });
      reset();
      return { destroy() { timers.forEach(clearTimeout); } };
    }
  };
})();
