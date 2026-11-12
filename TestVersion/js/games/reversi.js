(function () {
  I18N.add({
    pl: {
      g_reversi: 'Reversi', g_reversi_d: 'Otaczaj dyski wroga i je przewracaj. Kto ma więcej - wygrywa.',
      rvBlack: 'Czarne', rvWhite: 'Białe', rvPass: 'Brak ruchu - pas', rvOppPass: 'Przeciwnik nie ma ruchu - pas',
      rvThinking: 'Bot myśli...'
    },
    en: {
      g_reversi: 'Reversi', g_reversi_d: 'Flank enemy discs and flip them. Most discs wins.',
      rvBlack: 'Black', rvWhite: 'White', rvPass: 'No moves - you pass', rvOppPass: 'Opponent has no moves - pass',
      rvThinking: 'Bot is thinking...'
    }
  });

  // ---------- ENGINE (pure) ----------
  // board: 64 cells, '' | 'B' | 'W'. Black moves first.
  const DIRS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const other = (c) => c === 'B' ? 'W' : 'B';
  const ROW = [
    [100, -20, 10, 5, 5, 10, -20, 100],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [10, -2, -1, -1, -1, -1, -2, 10],
    [5, -2, -1, -1, -1, -1, -2, 5]
  ];
  const WEIGHTS = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) WEIGHTS.push(ROW[r < 4 ? r : 7 - r][c]);

  function initialBoard() {
    const b = Array(64).fill('');
    b[27] = 'W'; b[36] = 'W'; b[28] = 'B'; b[35] = 'B';
    return b;
  }
  function flipsAt(b, i, col) {
    if (b[i]) return [];
    const r0 = i >> 3, c0 = i & 7, opp = other(col), out = [];
    for (const [dr, dc] of DIRS) {
      let r = r0 + dr, c = c0 + dc;
      const line = [];
      while (r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === opp) { line.push(r * 8 + c); r += dr; c += dc; }
      if (line.length && r >= 0 && r < 8 && c >= 0 && c < 8 && b[r * 8 + c] === col) out.push(...line);
    }
    return out;
  }
  function legalMoves(b, col) {
    const res = [];
    for (let i = 0; i < 64; i++) if (!b[i] && flipsAt(b, i, col).length) res.push(i);
    return res;
  }
  function applyMove(b, i, col) {
    const f = flipsAt(b, i, col), nb = b.slice();
    nb[i] = col;
    for (const x of f) nb[x] = col;
    return { board: nb, flips: f };
  }
  function count(b) {
    let B = 0, W = 0;
    for (const p of b) if (p === 'B') B++; else if (p === 'W') W++;
    return { B, W };
  }
  function evalFor(b, col, mobility) {
    const opp = other(col);
    let pos = 0, mine = 0, theirs = 0;
    for (let i = 0; i < 64; i++) {
      if (b[i] === col) { pos += WEIGHTS[i]; mine++; } else if (b[i] === opp) { pos -= WEIGHTS[i]; theirs++; }
    }
    let s = pos;
    if (mobility) s += 6 * (legalMoves(b, col).length - legalMoves(b, opp).length);
    if (mine + theirs > 52) s += (mine - theirs) * 3;
    return s;
  }
  const TIMEOUT = {};
  function negamax(b, col, depth, alpha, beta, ctl) {
    if ((++ctl.nodes & 127) === 0 && Date.now() > ctl.deadline) throw TIMEOUT;
    const moves = legalMoves(b, col);
    if (!moves.length) {
      const oppMoves = legalMoves(b, other(col));
      if (!oppMoves.length) { const c = count(b); return (col === 'B' ? c.B - c.W : c.W - c.B) * 1000; }
      return -negamax(b, other(col), depth - 1, -beta, -alpha, ctl);
    }
    if (depth <= 0) return evalFor(b, col, true);
    moves.sort((x, y) => WEIGHTS[y] - WEIGHTS[x]);
    let best = -Infinity;
    for (const m of moves) {
      const s = -negamax(applyMove(b, m, col).board, other(col), depth - 1, -beta, -alpha, ctl);
      if (s > best) best = s;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  function botMove(b, col, diff, timeMs) {
    const moves = legalMoves(b, col);
    if (!moves.length) return -1;
    if (moves.length === 1) return moves[0];
    const greedy = (score) => {
      let best = -Infinity, list = [];
      for (const m of moves) {
        const s = score(m);
        if (s > best) { best = s; list = [m]; } else if (s === best) list.push(m);
      }
      return pick(list);
    };
    if (diff === 'easy') {
      if (Math.random() < 0.5) return pick(moves);
      return greedy(m => flipsAt(b, m, col).length);
    }
    if (diff === 'normal') return greedy(m => WEIGHTS[m] * 3 + flipsAt(b, m, col).length);
    const empties = b.reduce((n, p) => n + (p ? 0 : 1), 0);
    const maxD = empties <= 14 ? 5 : 4;
    const ctl = { nodes: 0, deadline: Date.now() + (timeMs || 1200) };
    let bestList = [greedy(m => WEIGHTS[m])];
    for (let d = 1; d <= maxD; d++) {
      try {
        let best = -Infinity, list = [];
        for (const m of moves) {
          const s = -negamax(applyMove(b, m, col).board, other(col), d - 1, -Infinity, Infinity, ctl);
          if (s > best) { best = s; list = [m]; } else if (s === best) list.push(m);
        }
        bestList = list;
      } catch (e) { if (e !== TIMEOUT) throw e; break; }
    }
    return pick(bestList);
  }

  // ---------- UI ----------
  Games.reversi = {
    id: 'reversi', nameKey: 'g_reversi', descKey: 'g_reversi_d', color: 'green',
    icon: pixelIcon([
      'ggggggggggg', 'ggggggggggg', 'ggwwwgvvvgg', 'ggwwwgvvvgg', 'ggwwwgvvvgg', 'ggggggggggg',
      'ggvvvgwwwgg', 'ggvvvgwwwgg', 'ggvvvgwwwgg', 'ggggggggggg', 'ggggggggggg'
    ]),
    _engine: { initialBoard, legalMoves, applyMove, flipsAt, botMove, count, evalFor, WEIGHTS },
    start(el, ctx) {
      const { t, net, sfx } = ctx;
      const online = ctx.mode === 'online';
      let round = 0, board, turn, over, again, timers = [], my, legal = [], last = -1, flipped = [], note = '';
      const myColor = () => ((ctx.first !== false) !== (round % 2 === 1)) ? 'B' : 'W';
      const cname = (c) => c === 'B' ? t('rvBlack') : t('rvWhite');

      el.innerHTML = `<div class="rv">
        <div class="status" id="st"></div>
        <div class="rv-info"><span id="cB" class="rv-cnt"></span><span id="cW" class="rv-cnt"></span></div>
        <div class="rv-board" id="bd" role="grid" aria-label="${t('g_reversi')}"></div>
        <div class="result" id="res"></div>
        <div class="actions" id="act"></div></div>`;
      const st = el.querySelector('#st'), res = el.querySelector('#res'), act = el.querySelector('#act');
      const bd = el.querySelector('#bd'), cB = el.querySelector('#cB'), cW = el.querySelector('#cW');
      const cells = [];
      for (let i = 0; i < 64; i++) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'rv-sq';
        b.onclick = () => click(i);
        bd.appendChild(b); cells.push(b);
      }

      function render() {
        const ok = new Set(turn === my && !over ? legal : []);
        cells.forEach((b, i) => {
          const p = board[i];
          b.className = 'rv-sq' + (ok.has(i) ? ' ok' : '') + (i === last ? ' last' : '');
          const anim = flipped.includes(i) ? ' flip' : (i === last ? ' pop' : '');
          b.innerHTML = p ? `<span class="rv-disk ${p}${anim}"></span>` : '';
          b.setAttribute('aria-label', 'abcdefgh'[i & 7] + (8 - (i >> 3)) + (p ? ' ' + cname(p) : ok.has(i) ? ' ✓' : ''));
        });
        flipped = [];
        const c = count(board);
        cB.textContent = `${t('rvBlack')}: ${c.B}`; cW.textContent = `${t('rvWhite')}: ${c.W}`;
        cB.className = 'rv-cnt' + (my === 'B' ? ' me' : ''); cW.className = 'rv-cnt' + (my === 'W' ? ' me' : '');
        if (!over) st.textContent = (note ? note + ' | ' : '') + (turn === my ? `${t('yourTurn')} (${cname(my)})` : t('oppTurn'));
      }

      function reset() {
        my = myColor(); board = initialBoard(); turn = 'B'; over = false; last = -1; flipped = []; note = '';
        again = { me: false, opp: false };
        res.textContent = ''; res.className = 'result'; act.innerHTML = '';
        legal = legalMoves(board, turn);
        render();
        if (!online && turn !== my) botTurn();
      }

      function play(i, col) {
        const r = applyMove(board, i, col);
        board = r.board; last = i; flipped = r.flips; note = '';
        sfx.play(col === my ? 'place' : 'hit');
        const next = other(col);
        const nm = legalMoves(board, next);
        if (nm.length) { turn = next; legal = nm; }
        else {
          const sm = legalMoves(board, col);
          if (!sm.length) return finishGame();
          turn = col; legal = sm;
          note = next === my ? t('rvPass') : t('rvOppPass');
        }
        render();
        if (!online && turn !== my) botTurn();
      }

      function finishGame() {
        over = true; render();
        const c = count(board), mine = c[my], theirs = c[other(my)];
        const r = mine === theirs ? 'draw' : mine > theirs ? 'win' : 'lose';
        st.textContent = `${c.B} : ${c.W}`;
        res.textContent = t(r); res.className = 'result show ' + r;
        sfx.play(r);
        ctx.finish(r);
        act.innerHTML = `<button class="px-btn pink" id="again" aria-label="${t('again')}">${t('again')}</button>`;
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
        st.textContent = t('rvThinking');
        timers.push(setTimeout(() => {
          if (over) return;
          const m = botMove(board, turn, ctx.difficulty, 1000);
          if (m >= 0) play(m, turn);
        }, 650));
      }

      function click(i) {
        if (over || turn !== my || !legal.includes(i)) return;
        if (online) net.send({ type: 'move', i });
        play(i, my);
      }
      if (online) net.setHandler((m) => {
        if (m.type === 'move' && !over && turn !== my && legal.includes(m.i)) play(m.i, turn);
        else if (m.type === 'again') { again.opp = true; tryAgain(); }
      });
      reset();
      return { destroy() { timers.forEach(clearTimeout); timers = []; } };
    }
  };
})();
