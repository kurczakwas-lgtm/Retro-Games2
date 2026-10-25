(function () {
  const LINES = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const winnerOf = (b) => { for (const [a, c, d] of LINES) if (b[a] && b[a] === b[c] && b[a] === b[d]) return { w: b[a], line: [a, c, d] }; return null; };
  const empties = (b) => b.map((v, i) => v ? -1 : i).filter(i => i >= 0);

  function minimax(b, turn, bot, hum, depth) {
    const r = winnerOf(b);
    if (r) return r.w === bot ? 10 - depth : depth - 10;
    const e = empties(b);
    if (!e.length) return 0;
    let best = turn === bot ? -Infinity : Infinity;
    for (const i of e) {
      b[i] = turn;
      const s = minimax(b, turn === 'X' ? 'O' : 'X', bot, hum, depth + 1);
      b[i] = '';
      best = turn === bot ? Math.max(best, s) : Math.min(best, s);
    }
    return best;
  }

  function botMove(b, bot, hum, diff) {
    const e = empties(b);
    if (diff === 'easy') return pick(e);
    if (diff === 'normal') {
      for (const m of [bot, hum]) for (const i of e) { b[i] = m; const w = winnerOf(b); b[i] = ''; if (w) return i; }
      if (!b[4]) return 4;
      return pick(e);
    }
    if (e.length === 9) return pick([0, 2, 4, 6, 8]);
    let best = -Infinity, moves = [];
    for (const i of e) {
      b[i] = bot;
      const s = minimax(b, hum, bot, hum, 1);
      b[i] = '';
      if (s > best) { best = s; moves = [i]; } else if (s === best) moves.push(i);
    }
    return pick(moves);
  }

  Games.ttt = {
    id: 'ttt', nameKey: 'g_ttt', descKey: 'g_ttt_d', color: 'pink',
    icon: pixelIcon([
      'p.py...y...', '.p.y...y...', 'p.py...y...', 'yyyyyyyyyyy',
      '...ycccy...', '...yc.cy...', '...ycccy...', 'yyyyyyyyyyy',
      '...y...yp.p', '...y...y.p.', '...y...yp.p'
    ]),
    start(el, ctx) {
      const { t, net, sfx } = ctx;
      const online = ctx.mode === 'online';
      const me = online ? (ctx.role === 'host' ? 'X' : 'O') : 'X';
      const opp = me === 'X' ? 'O' : 'X';
      let board, turn, over, round = 0, again, timers = [], winLine = [];

      el.innerHTML = `<div class="ttt">
        <div class="status" id="st"></div>
        <div class="ttt-board" id="bd">${Array.from({ length: 9 }, (_, i) => `<button class="ttt-cell" data-i="${i}" aria-label="cell ${i + 1}"></button>`).join('')}</div>
        <div class="result" id="res"></div>
        <div class="actions" id="act"></div></div>`;
      const st = el.querySelector('#st'), res = el.querySelector('#res'), act = el.querySelector('#act');
      const cells = [...el.querySelectorAll('.ttt-cell')];

      function render() {
        cells.forEach((c, i) => {
          c.textContent = board[i];
          c.className = 'ttt-cell' + (board[i] ? ' m' + board[i] : '') + (winLine.includes(i) ? ' win' : '');
        });
        if (!over) st.textContent = turn === me ? `${t('yourTurn')} (${me})` : (online ? t('oppTurn') : t('oppTurn'));
      }
      function reset() {
        board = Array(9).fill(''); over = false; winLine = [];
        again = { me: false, opp: false };
        turn = round % 2 ? 'O' : 'X';
        res.textContent = ''; res.className = 'result'; act.innerHTML = '';
        render();
        if (!online && turn === opp) botTurn();
      }
      function play(i, mark) {
        board[i] = mark; sfx.play(mark === 'X' ? 'x' : 'o');
        const r = winnerOf(board);
        if (r) return end(r.w, r.line);
        if (!empties(board).length) return end('draw', []);
        turn = turn === 'X' ? 'O' : 'X';
        render();
        if (!online && turn === opp) botTurn();
      }
      function end(w, line) {
        over = true; winLine = line;
        const r = w === 'draw' ? 'draw' : (w === me ? 'win' : 'lose');
        render();
        st.textContent = '';
        res.textContent = t(r); res.className = 'result show ' + r;
        sfx.play(r);
        ctx.finish(r);
        act.innerHTML = `<button class="px-btn pink" id="again">${t('again')}</button>`;
        act.querySelector('#again').onclick = () => {
          sfx.play('click');
          if (!online) { round++; reset(); return; }
          again.me = true; net.send({ type: 'again' });
          act.innerHTML = `<span class="hint">${t('waitOpp')}</span>`;
          tryAgain();
        };
      }
      function tryAgain() { if (again.me && again.opp) { round++; reset(); } }
      function botTurn() {
        timers.push(setTimeout(() => { if (!over) play(botMove(board, opp, me, ctx.difficulty), opp); }, 550));
      }
      cells.forEach(c => c.onclick = () => {
        const i = +c.dataset.i;
        if (over || turn !== me || board[i]) return;
        play(i, me);
        if (online) net.send({ type: 'move', i });
      });
      if (online) net.setHandler((m) => {
        if (m.type === 'move' && !over && turn === opp && !board[m.i]) play(m.i, opp);
        else if (m.type === 'again') { again.opp = true; tryAgain(); }
      });
      reset();
      return { destroy() { timers.forEach(clearTimeout); } };
    }
  };
})();
