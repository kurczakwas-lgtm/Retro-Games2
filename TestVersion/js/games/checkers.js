(function () {
  I18N.add({
    pl: {
      g_checkers: 'Warcaby', g_checkers_d: 'Bicie obowiązkowe, damki i skoki wielokrotne.',
      ckWhite: 'Białe', ckBlack: 'Czarne', ckYouAre: 'Grasz', ckMustCapture: 'Bicie obowiązkowe!',
      ckPieces: 'Bierki', ckThinking: 'Bot myśli...', ckDrawRule: '40 ruchów bez bicia - remis'
    },
    en: {
      g_checkers: 'Checkers', g_checkers_d: 'Forced captures, kings and multi-jumps.',
      ckWhite: 'White', ckBlack: 'Black', ckYouAre: 'You play', ckMustCapture: 'Capture is mandatory!',
      ckPieces: 'Pieces', ckThinking: 'Bot is thinking...', ckDrawRule: '40 moves without capture - draw'
    }
  });

  // ---------- ENGINE (pure) ----------
  // board: array of 64, idx = r*8+c. '' | 'w' | 'W' | 'b' | 'B' (upper = king). White starts at bottom, moves up (r--).
  const DRAW_PLIES = 80;
  const colorOf = (p) => p ? p.toLowerCase() : '';
  const other = (c) => c === 'w' ? 'b' : 'w';
  const isKing = (p) => p === 'W' || p === 'B';

  function initialBoard() {
    const b = Array(64).fill('');
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 !== 1) continue;
      if (r < 3) b[r * 8 + c] = 'b'; else if (r > 4) b[r * 8 + c] = 'w';
    }
    return b;
  }

  function dirsFor(p) {
    if (isKing(p)) return [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    return p === 'w' ? [[-1, -1], [-1, 1]] : [[1, -1], [1, 1]];
  }
  const kingRow = (col) => col === 'w' ? 0 : 7;

  function jumpsFrom(b, pos, piece, path, caps, out) {
    const r0 = pos >> 3, c0 = pos & 7, col = colorOf(piece);
    let any = false;
    for (const [dr, dc] of dirsFor(piece)) {
      const r1 = r0 + dr, c1 = c0 + dc, r2 = r0 + 2 * dr, c2 = c0 + 2 * dc;
      if (r2 < 0 || r2 > 7 || c2 < 0 || c2 > 7) continue;
      const mid = r1 * 8 + c1, dst = r2 * 8 + c2;
      const mp = b[mid];
      if (!mp || colorOf(mp) === col || b[dst]) continue;
      any = true;
      const saveMid = b[mid];
      b[mid] = '';
      const promoted = !isKing(piece) && r2 === kingRow(col);
      const np = promoted ? piece.toUpperCase() : piece;
      const npath = path.concat(dst), ncaps = caps.concat(mid);
      if (promoted) out.push({ from: -1, path: npath, caps: ncaps, promo: true });
      else jumpsFrom(b, dst, np, npath, ncaps, out);
      b[mid] = saveMid;
    }
    if (!any && path.length) out.push({ from: -1, path, caps, promo: false });
  }

  function genMoves(b, col) {
    const caps = [], simple = [];
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p || colorOf(p) !== col) continue;
      const tmp = [];
      b[i] = '';
      jumpsFrom(b, i, p, [], [], tmp);
      b[i] = p;
      for (const m of tmp) { m.from = i; caps.push(m); }
    }
    if (caps.length) return caps;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p || colorOf(p) !== col) continue;
      const r = i >> 3, c = i & 7;
      for (const [dr, dc] of dirsFor(p)) {
        const r1 = r + dr, c1 = c + dc;
        if (r1 < 0 || r1 > 7 || c1 < 0 || c1 > 7) continue;
        const d = r1 * 8 + c1;
        if (!b[d]) simple.push({ from: i, path: [d], caps: [], promo: !isKing(p) && r1 === kingRow(col) });
      }
    }
    return simple;
  }

  function applyMove(b, m) {
    const nb = b.slice();
    const p = nb[m.from];
    nb[m.from] = '';
    for (const c of m.caps) nb[c] = '';
    const dst = m.path[m.path.length - 1];
    nb[dst] = (m.promo || isKing(p)) ? p.toUpperCase() : p;
    return nb;
  }

  const sameMove = (a, b) => a.from === b.from && a.path.length === b.path.length && a.path.every((v, i) => v === b.path[i]);

  function count(b) {
    const o = { w: 0, b: 0, wk: 0, bk: 0 };
    for (const p of b) if (p) { o[colorOf(p)]++; if (isKing(p)) o[colorOf(p) + 'k']++; }
    return o;
  }

  function evalFor(b, col) {
    let s = 0;
    for (let i = 0; i < 64; i++) {
      const p = b[i];
      if (!p) continue;
      const pc = colorOf(p), r = i >> 3, c = i & 7;
      let v = isKing(p) ? 160 : 100;
      if (!isKing(p)) v += (pc === 'w' ? 7 - r : r) * 5;
      else if (c > 1 && c < 6 && r > 1 && r < 6) v += 6;
      if (c === 0 || c === 7) v -= 2;
      s += pc === col ? v : -v;
    }
    return s;
  }

  const TIMEOUT = {};
  function negamax(b, col, depth, alpha, beta, ply, ctl) {
    if ((++ctl.nodes & 255) === 0 && Date.now() > ctl.deadline) throw TIMEOUT;
    const moves = genMoves(b, col);
    if (!moves.length) return -100000 + ply;
    if (depth <= 0) return evalFor(b, col);
    let best = -Infinity;
    for (const m of moves) {
      const s = -negamax(applyMove(b, m), other(col), depth - 1, -beta, -alpha, ply + 1, ctl);
      if (s > best) best = s;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }

  function botMove(b, col, diff, timeMs) {
    const moves = genMoves(b, col);
    if (!moves.length) return null;
    if (moves.length === 1) return moves[0];
    const maxD = diff === 'hard' ? 6 : diff === 'normal' ? 4 : 2;
    if (diff === 'easy' && Math.random() < 0.25) return pick(moves);
    const ctl = { nodes: 0, deadline: Date.now() + (timeMs || 1200) };
    let bestMoves = shuffle(moves.slice());
    for (let d = 1; d <= maxD; d++) {
      try {
        let best = -Infinity, list = [];
        let alpha = -Infinity;
        for (const m of shuffle(moves.slice())) {
          const s = -negamax(applyMove(b, m), other(col), d - 1, -Infinity, -alpha + 1, 1, ctl);
          if (s > best) { best = s; list = [m]; alpha = s; } else if (s === best) list.push(m);
        }
        bestMoves = list;
      } catch (e) { if (e !== TIMEOUT) throw e; break; }
    }
    return pick(bestMoves);
  }

  // ---------- UI ----------
  Games.checkers = {
    id: 'checkers', nameKey: 'g_checkers', descKey: 'g_checkers_d', color: 'yellow',
    icon: pixelIcon([
      '..pppp.....', '.pppppp....', '.pppppp....', '.pppppp....', '..pppp.....',
      '.....cccc..', '....cccccc.', '....cccccc.', '....cccccc.', '.....cccc..', '...........'
    ]),
    _engine: { initialBoard, genMoves, applyMove, botMove, count, evalFor, sameMove, DRAW_PLIES },
    start(el, ctx) {
      const { t, net, sfx } = ctx;
      const online = ctx.mode === 'online';
      let round = 0, board, turn, over, again, timers = [], my, last = [], sel = -1, partial = [], noProg, cand = [], moves = [];
      const myColor = () => ((ctx.first !== false) !== (round % 2 === 1)) ? 'w' : 'b';

      el.innerHTML = `<div class="ck">
        <div class="status" id="st"></div>
        <div class="ck-info"><span id="cw" class="ck-cnt"></span><span id="cb" class="ck-cnt"></span></div>
        <div class="ck-board" id="bd" role="grid" aria-label="${t('g_checkers')}"></div>
        <div class="result" id="res"></div>
        <div class="actions" id="act"></div></div>`;
      const st = el.querySelector('#st'), res = el.querySelector('#res'), act = el.querySelector('#act');
      const bd = el.querySelector('#bd'), cw = el.querySelector('#cw'), cb = el.querySelector('#cb');
      const cells = [];
      for (let k = 0; k < 64; k++) {
        const btn = document.createElement('button');
        btn.className = 'ck-sq ' + (((k >> 3) + (k & 7)) % 2 ? 'dark' : 'light');
        btn.type = 'button';
        btn.dataset.k = k;
        btn.onclick = () => click(+btn.dataset.k);
        bd.appendChild(btn); cells.push(btn);
      }
      const idxOf = (k) => my === 'b' ? 63 - k : k;
      const sqName = (i) => 'abcdefgh'[i & 7] + (8 - (i >> 3));

      function render() {
        const targets = new Set(cand.map(m => m.path[partial.length]));
        const movable = new Set(turn === my && !over ? moves.map(m => m.from) : []);
        cells.forEach((btn, k) => {
          const i = idxOf(k), p = board[i];
          btn.dataset.i = i;
          let cls = 'ck-sq ' + (((i >> 3) + (i & 7)) % 2 ? 'dark' : 'light');
          if (last.includes(i)) cls += ' last';
          if (i === sel) cls += ' sel';
          if (targets.has(i)) cls += ' tgt';
          if (movable.has(i) && sel < 0) cls += ' can';
          btn.className = cls;
          btn.innerHTML = p ? `<span class="ck-pc ${colorOf(p)}${isKing(p) ? ' king' : ''}"></span>` : '';
          btn.setAttribute('aria-label', sqName(i) + (p ? ' ' + (colorOf(p) === 'w' ? t('ckWhite') : t('ckBlack')) + (isKing(p) ? ' king' : '') : ''));
        });
        const c = count(board);
        cw.textContent = `${t('ckWhite')}: ${c.w}`; cb.textContent = `${t('ckBlack')}: ${c.b}`;
        cw.className = 'ck-cnt w' + (my === 'w' ? ' me' : ''); cb.className = 'ck-cnt b' + (my === 'b' ? ' me' : '');
        if (!over) {
          const mustCap = turn === my && moves.length && moves[0].caps.length;
          st.textContent = turn === my ? `${t('yourTurn')} (${my === 'w' ? t('ckWhite') : t('ckBlack')})${mustCap ? ' - ' + t('ckMustCapture') : ''}` : t('oppTurn');
        }
      }

      function reset() {
        my = myColor();
        board = initialBoard(); turn = 'w'; over = false; last = []; sel = -1; partial = []; cand = []; noProg = 0;
        again = { me: false, opp: false };
        res.textContent = ''; res.className = 'result'; act.innerHTML = '';
        moves = genMoves(board, turn);
        render();
        if (!online && turn !== my) botTurn();
      }

      function exec(m, by) {
        const wasCap = m.caps.length > 0;
        board = applyMove(board, m);
        last = [m.from].concat(m.path);
        sel = -1; partial = []; cand = [];
        sfx.play(wasCap ? 'hit' : 'place');
        noProg = (wasCap || m.promo) ? 0 : noProg + 1;
        turn = other(turn);
        moves = genMoves(board, turn);
        if (!moves.length) return end(by === my ? 'win' : 'lose');
        if (noProg >= DRAW_PLIES) return end('draw');
        render();
        if (!online && turn !== my) botTurn();
      }

      function end(r) {
        over = true; render();
        st.textContent = r === 'draw' ? t('ckDrawRule') : '';
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
        st.textContent = t('ckThinking');
        timers.push(setTimeout(() => {
          if (over) return;
          const m = botMove(board, turn, ctx.difficulty, 1000);
          if (m) exec(m, turn);
        }, 500));
      }

      function click(k) {
        if (over || turn !== my) return;
        const i = idxOf(k);
        if (sel >= 0) {
          const nxt = cand.filter(m => m.path[partial.length] === i);
          if (nxt.length) {
            const np = partial.concat(i);
            const done = nxt.find(m => m.path.length === np.length);
            if (done) {
              if (online) net.send({ type: 'move', from: done.from, path: done.path });
              exec(done, my);
            } else { partial = np; cand = nxt; sfx.play('click'); render(); }
            return;
          }
        }
        const mine = moves.filter(m => m.from === i);
        if (mine.length) { sel = i; partial = []; cand = mine; sfx.play('click'); }
        else { sel = -1; partial = []; cand = []; }
        render();
      }

      if (online) net.setHandler((m) => {
        if (m.type === 'move' && !over && turn !== my) {
          const mv = moves.find(x => x.from === m.from && JSON.stringify(x.path) === JSON.stringify(m.path));
          if (mv) exec(mv, turn);
        } else if (m.type === 'again') { again.opp = true; tryAgain(); }
      });
      reset();
      return { destroy() { timers.forEach(clearTimeout); timers = []; } };
    }
  };
})();
