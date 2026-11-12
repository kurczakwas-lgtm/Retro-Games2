(function () {
  I18N.add({
    pl: {
      g_chess: 'Szachy', g_chess_d: 'Królewska gra. Pełne zasady, silnik, zegar, notacja.',
      check: 'Szach!', checkmate: 'Szach-mat!', stalemate: 'Pat – remis', drawRule: 'Remis', resign: 'Poddaj się',
      white: 'Białe', black: 'Czarne', youAre: 'Grasz', promoteTo: 'Promocja na:', thinking: 'Bot myśli...', oppResigned: 'Przeciwnik się poddał',
      chFlip: 'Obróć', chUndo: 'Cofnij', chHint: 'Podpowiedź', chDraw: 'Remis?', chDrawOffered: 'Przeciwnik proponuje remis', chAccept: 'Przyjmij', chDecline: 'Odrzuć',
      chDrawSent: 'Wysłano propozycję remisu', chDrawNo: 'Remis odrzucony', chDrawYes: 'Remis za zgodą', chTime: 'Czas minął', chMoves: 'Ruchy', chRep: 'Trzykrotne powtórzenie',
      ch50: 'Reguła 50 ruchów', chMat: 'Brak materiału', chBot: 'Bot'
    },
    en: {
      g_chess: 'Chess', g_chess_d: 'The royal game. Full rules, engine, clock, notation.',
      check: 'Check!', checkmate: 'Checkmate!', stalemate: 'Stalemate – draw', drawRule: 'Draw', resign: 'Resign',
      white: 'White', black: 'Black', youAre: 'You play', promoteTo: 'Promote to:', thinking: 'Bot is thinking...', oppResigned: 'Opponent resigned',
      chFlip: 'Flip', chUndo: 'Undo', chHint: 'Hint', chDraw: 'Draw?', chDrawOffered: 'Opponent offers a draw', chAccept: 'Accept', chDecline: 'Decline',
      chDrawSent: 'Draw offer sent', chDrawNo: 'Draw declined', chDrawYes: 'Draw by agreement', chTime: 'Time is up', chMoves: 'Moves', chRep: 'Threefold repetition',
      ch50: '50-move rule', chMat: 'Insufficient material', chBot: 'Bot'
    }
  });

  // ================= SILNIK =================
  const isW = (p) => p >= 'A' && p <= 'Z';
  const own = (p, side) => p && (side === 'w' ? isW(p) : !isW(p));
  const inb = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const KN = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]], ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const START = 'rnbqkbnrpppppppp................................PPPPPPPPRNBQKBNR';

  function initial() { return { b: [...START].map(c => c === '.' ? '' : c), turn: 'w', castle: 'KQkq', ep: -1, half: 0 }; }

  function attacked(b, sq, by) {
    const r = sq >> 3, c = sq & 7, w = by === 'w';
    const pr = r + (w ? 1 : -1);
    for (const dc of [-1, 1]) if (inb(pr, c + dc) && b[pr * 8 + c + dc] === (w ? 'P' : 'p')) return true;
    for (const [dr, dc] of KN) if (inb(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === (w ? 'N' : 'n')) return true;
    for (const [dr, dc] of KG) if (inb(r + dr, c + dc) && b[(r + dr) * 8 + c + dc] === (w ? 'K' : 'k')) return true;
    for (const [dirs, a, q] of [[DIAG, 'b', 'q'], [ORTH, 'r', 'q']]) {
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (inb(rr, cc)) {
          const p = b[rr * 8 + cc];
          if (p) { const l = p.toLowerCase(); if (own(p, by) && (l === a || l === q)) return true; break; }
          rr += dr; cc += dc;
        }
      }
    }
    return false;
  }

  function pseudo(s) {
    const { b, turn: side } = s, out = [];
    const push = (from, to, extra) => out.push(Object.assign({ from, to }, extra));
    for (let i = 0; i < 64; i++) {
      const p = b[i]; if (!p || !own(p, side)) continue;
      const ty = p.toLowerCase(), r = i >> 3, c = i & 7;
      if (ty === 'p') {
        const dir = side === 'w' ? -1 : 1, startR = side === 'w' ? 6 : 1, promoR = side === 'w' ? 0 : 7;
        const add = (to, extra) => { if ((to >> 3) === promoR) for (const pr of ['q', 'r', 'b', 'n']) push(i, to, { promo: pr }); else push(i, to, extra); };
        const one = (r + dir) * 8 + c;
        if (inb(r + dir, c) && !b[one]) {
          add(one);
          if (r === startR && !b[(r + 2 * dir) * 8 + c]) push(i, (r + 2 * dir) * 8 + c);
        }
        for (const dc of [-1, 1]) {
          if (!inb(r + dir, c + dc)) continue;
          const to = (r + dir) * 8 + c + dc;
          if (b[to] && !own(b[to], side)) add(to);
          else if (to === s.ep) push(i, to, { flag: 'ep' });
        }
      } else if (ty === 'n' || ty === 'k') {
        for (const [dr, dc] of (ty === 'n' ? KN : KG)) {
          if (!inb(r + dr, c + dc)) continue;
          const to = (r + dr) * 8 + c + dc;
          if (!own(b[to], side)) push(i, to);
        }
        if (ty === 'k') {
          const opp = side === 'w' ? 'b' : 'w';
          if (side === 'w' && i === 60 && !attacked(b, 60, opp)) {
            if (s.castle.includes('K') && !b[61] && !b[62] && b[63] === 'R' && !attacked(b, 61, opp) && !attacked(b, 62, opp)) push(60, 62, { flag: 'castle' });
            if (s.castle.includes('Q') && !b[59] && !b[58] && !b[57] && b[56] === 'R' && !attacked(b, 59, opp) && !attacked(b, 58, opp)) push(60, 58, { flag: 'castle' });
          }
          if (side === 'b' && i === 4 && !attacked(b, 4, opp)) {
            if (s.castle.includes('k') && !b[5] && !b[6] && b[7] === 'r' && !attacked(b, 5, opp) && !attacked(b, 6, opp)) push(4, 6, { flag: 'castle' });
            if (s.castle.includes('q') && !b[3] && !b[2] && !b[1] && b[0] === 'r' && !attacked(b, 3, opp) && !attacked(b, 2, opp)) push(4, 2, { flag: 'castle' });
          }
        }
      } else {
        const dirs = ty === 'b' ? DIAG : ty === 'r' ? ORTH : DIAG.concat(ORTH);
        for (const [dr, dc] of dirs) {
          let rr = r + dr, cc = c + dc;
          while (inb(rr, cc)) {
            const to = rr * 8 + cc;
            if (!b[to]) push(i, to);
            else { if (!own(b[to], side)) push(i, to); break; }
            rr += dr; cc += dc;
          }
        }
      }
    }
    return out;
  }

  function apply(s, m) {
    const b = s.b.slice(), p = b[m.from], side = isW(p) ? 'w' : 'b';
    const cap = b[m.to] || (m.flag === 'ep' ? 'x' : '');
    b[m.to] = p; b[m.from] = '';
    if (m.flag === 'ep') b[m.to + (side === 'w' ? 8 : -8)] = '';
    if (m.promo) b[m.to] = side === 'w' ? m.promo.toUpperCase() : m.promo;
    if (m.flag === 'castle') {
      if (m.to === 62) { b[61] = b[63]; b[63] = ''; } else if (m.to === 58) { b[59] = b[56]; b[56] = ''; }
      else if (m.to === 6) { b[5] = b[7]; b[7] = ''; } else { b[3] = b[0]; b[0] = ''; }
    }
    let castle = s.castle;
    const strip = (chars) => { for (const ch of chars) castle = castle.replace(ch, ''); };
    if (p === 'K') strip('KQ'); if (p === 'k') strip('kq');
    for (const sq of [m.from, m.to]) { if (sq === 63) strip('K'); if (sq === 56) strip('Q'); if (sq === 7) strip('k'); if (sq === 0) strip('q'); }
    const ep = (p.toLowerCase() === 'p' && Math.abs(m.to - m.from) === 16) ? (m.from + m.to) / 2 : -1;
    return { b, turn: side === 'w' ? 'b' : 'w', castle, ep, half: (p.toLowerCase() === 'p' || cap) ? 0 : s.half + 1 };
  }
  const kingSq = (b, side) => b.indexOf(side === 'w' ? 'K' : 'k');
  const inCheck = (s, side = s.turn) => attacked(s.b, kingSq(s.b, side), side === 'w' ? 'b' : 'w');
  function legal(s) {
    const side = s.turn, opp = side === 'w' ? 'b' : 'w';
    return pseudo(s).filter(m => { const ns = apply(s, m); return !attacked(ns.b, kingSq(ns.b, side), opp); });
  }
  function status(s, moves) {
    moves = moves || legal(s);
    if (!moves.length) return inCheck(s) ? 'mate' : 'stalemate';
    if (s.half >= 100) return 'draw';
    const pcs = s.b.filter(x => x && x.toLowerCase() !== 'k');
    if (!pcs.length || (pcs.length === 1 && 'nb'.includes(pcs[0].toLowerCase()))) return 'draw';
    return 'play';
  }
  const posKey = (s) => s.b.join('') + s.turn + s.castle + s.ep;

  // ---- ocena (tablice PST: indeks 0 = a8, perspektywa białych) ----
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const PST = {
    p: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    n: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    b: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    r: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    k: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
    ke: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50]
  };
  function evalPos(s) {
    let sc = 0, mat = 0, bw = 0, bb = 0;
    const b = s.b;
    for (let i = 0; i < 64; i++) { const p = b[i]; if (p) { const ty = p.toLowerCase(); if (ty !== 'p' && ty !== 'k') mat += VAL[ty]; } }
    const endgame = mat <= 2600;
    for (let i = 0; i < 64; i++) {
      const p = b[i]; if (!p) continue;
      const w = isW(p), ty = p.toLowerCase(), idx = w ? i : (7 - (i >> 3)) * 8 + (i & 7);
      let v = VAL[ty] + PST[ty === 'k' ? (endgame ? 'ke' : 'k') : ty][idx];
      if (ty === 'b') { if (w) bw++; else bb++; }
      sc += w ? v : -v;
    }
    if (bw > 1) sc += 30; if (bb > 1) sc -= 30;
    return sc;
  }
  const mvvlva = (s, m) => {
    const cap = s.b[m.to] ? VAL[s.b[m.to].toLowerCase()] : (m.flag === 'ep' ? 100 : 0);
    return (cap ? cap * 10 - VAL[s.b[m.from].toLowerCase()] : 0) + (m.promo ? 800 : 0);
  };
  const order = (s, moves) => moves.map(m => ({ m, v: mvvlva(s, m) })).sort((x, y) => y.v - x.v).map(x => x.m);

  const MATE = 99000, ABORT = { abort: true };
  let nodes = 0, deadline = Infinity;
  const tick = () => { if ((++nodes & 1023) === 0 && performance.now() > deadline) throw ABORT; };
  function qs(s, alpha, beta, ply) {
    tick();
    const sgn = s.turn === 'w' ? 1 : -1, stand = sgn * evalPos(s);
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    if (ply > 8) return alpha;
    const side = s.turn, opp = side === 'w' ? 'b' : 'w';
    for (const m of order(s, pseudo(s).filter(m => s.b[m.to] || m.flag === 'ep' || m.promo))) {
      const ns = apply(s, m);
      if (attacked(ns.b, kingSq(ns.b, side), opp)) continue;
      const sc = -qs(ns, -beta, -alpha, ply + 1);
      if (sc >= beta) return sc;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }
  function search(s, depth, alpha, beta, ply) {
    tick();
    if (s.half >= 100) return 0;
    const chk = inCheck(s);
    if (chk && ply < 20) depth++;
    if (depth <= 0) return qs(s, alpha, beta, 0);
    const moves = legal(s);
    if (!moves.length) return chk ? -MATE + ply : 0;
    let best = -Infinity;
    for (const m of order(s, moves)) {
      const sc = -search(apply(s, m), depth - 1, -beta, -alpha, ply + 1);
      if (sc > best) best = sc;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  function bestMove(s, diff) {
    const moves = legal(s);
    if (!moves.length) return null;
    if (diff === 'easy') {
      if (Math.random() < 0.25) return pick(moves);
      deadline = performance.now() + 300; nodes = 0;
      let best = -Infinity, bm = moves[0];
      try {
        for (const m of moves) {
          const sc = -search(apply(s, m), 0, -Infinity, Infinity, 1) + Math.random() * 90;
          if (sc > best) { best = sc; bm = m; }
        }
      } catch (e) { if (e !== ABORT) throw e; }
      return bm;
    }
    const cfg = diff === 'hard' ? { d: 7, ms: 1800 } : { d: 3, ms: 600 };
    deadline = performance.now() + cfg.ms; nodes = 0;
    let ordered = order(s, moves), best = ordered[0];
    for (let d = 1; d <= cfg.d; d++) {
      let alpha = -Infinity, bm = null;
      try {
        for (const m of ordered) {
          const sc = -search(apply(s, m), d - 1, -Infinity, -alpha, 1);
          if (bm === null || sc > alpha) { alpha = sc; bm = m; }
        }
      } catch (e) {
        if (e !== ABORT) throw e;
        if (bm) best = bm;   // częściowy wynik: najlepszy ruch z poprzedniej iteracji był sprawdzany pierwszy
        break;
      }
      best = bm; ordered = [bm].concat(ordered.filter(x => x !== bm));
      if (alpha > MATE - 50) break;
    }
    deadline = Infinity;
    return best;
  }

  // ---- notacja SAN ----
  const FILES = 'abcdefgh';
  function toSAN(s, m, lm, ns) {
    const p = s.b[m.from], ty = p.toLowerCase(), f = (q) => FILES[q & 7], rk = (q) => 8 - (q >> 3);
    let out;
    if (m.flag === 'castle') out = m.to > m.from ? 'O-O' : 'O-O-O';
    else {
      const cap = s.b[m.to] || m.flag === 'ep';
      if (ty === 'p') out = (cap ? f(m.from) + 'x' : '') + f(m.to) + rk(m.to) + (m.promo ? '=' + m.promo.toUpperCase() : '');
      else {
        let dis = '';
        const others = lm.filter(x => x !== m && s.b[x.from] === p && x.to === m.to);
        if (others.length) {
          const sf = others.some(x => (x.from & 7) === (m.from & 7)), sr = others.some(x => (x.from >> 3) === (m.from >> 3));
          dis = !sf ? f(m.from) : !sr ? String(rk(m.from)) : f(m.from) + rk(m.from);
        }
        out = ty.toUpperCase() + dis + (cap ? 'x' : '') + f(m.to) + rk(m.to);
      }
    }
    const st = status(ns);
    return out + (st === 'mate' ? '#' : inCheck(ns) ? '+' : '');
  }

  const INIT = { q: 1, r: 2, b: 2, n: 2, p: 8 };
  function material(b) {
    const cnt = { w: {}, b: {} }, val = { w: 0, b: 0 };
    for (const p of b) { if (!p) continue; const sd = isW(p) ? 'w' : 'b', ty = p.toLowerCase(); cnt[sd][ty] = (cnt[sd][ty] || 0) + 1; val[sd] += VAL[ty]; }
    const lost = (sd) => { const o = []; for (const ty of 'qrbnp') for (let i = (cnt[sd][ty] || 0); i < INIT[ty]; i++) o.push(ty); return o; };
    return { lostW: lost('w'), lostB: lost('b'), diff: val.w - val.b };
  }

  // ================= UI =================
  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const glyph = (p) => GLYPH[p.toLowerCase()] + '\uFE0E';
  const fmtClock = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const TIME = 600000;   // zegar 10 min – tylko online

  Games.chess = {
    id: 'chess', nameKey: 'g_chess', descKey: 'g_chess_d', color: 'yellow',
    icon: pixelIcon([
      '.....y.....', '....yyy....', '.....y.....', '...wwwww...', '...wwwww...', '....www....',
      '....www....', '....www....', '...wwwww...', '..wwwwwww..', '..wwwwwww..'
    ]),
    start(el, ctx) {
      const { t, net, sfx } = ctx;
      const online = ctx.mode === 'online';
      let s, round = 0, my, over, sel = null, targets = [], lastMove = null, again, hist, keys, timers = [], promoPending = null,
        flipped = false, hintMove = null, anim = null, drag = null, clocks, clockT = 0, clockInt = null, thinking = false, drawSent = false;
      const colorOf = () => ((ctx.first !== false) !== (round % 2 === 1)) ? 'w' : 'b';
      const meName = ctx.me || t('you'), oppName = online ? (ctx.opp || t('opponent')) : '🤖 ' + t('chBot') + ' · ' + t(ctx.difficulty);

      el.innerHTML = `<div class="chess2">
        <div class="ch-main">
          <div class="ch-player" id="pTop"></div>
          <div class="ch-board" id="bd"></div>
          <div class="ch-player" id="pBot"></div>
          <div class="ch-promo" id="promo" hidden></div>
        </div>
        <aside class="ch-side">
          <div class="status" id="st"></div>
          <div class="ch-info" id="info"></div>
          <div class="ch-moves" id="mv" aria-label="${t('chMoves')}"></div>
          <div class="ch-offer" id="offer" hidden></div>
          <div class="ch-tools" id="tools"></div>
          <div class="result" id="res"></div><div class="actions" id="act"></div>
        </aside></div>`;
      const $ = (q) => el.querySelector(q);
      const st = $('#st'), bd = $('#bd'), res = $('#res'), act = $('#act'), promo = $('#promo'), info = $('#info'),
        mv = $('#mv'), tools = $('#tools'), offer = $('#offer'), pTop = $('#pTop'), pBot = $('#pBot');
      const orient = () => flipped ? (my === 'w' ? 'b' : 'w') : my;

      function buildTools() {
        tools.innerHTML = `<button class="px-btn small ghost" id="bFlip">⇅ ${t('chFlip')}</button>` +
          (online ? `<button class="px-btn small ghost" id="bDraw">½ ${t('chDraw')}</button>` : `<button class="px-btn small ghost" id="bUndo">↶ ${t('chUndo')}</button><button class="px-btn small ghost" id="bHint">💡 ${t('chHint')}</button>`) +
          `<button class="px-btn small ghost" id="resign">🏳 ${t('resign')}</button>`;
        $('#bFlip').onclick = () => { sfx.play('click'); flipped = !flipped; render(); };
        $('#resign').onclick = () => { if (over) return; sfx.play('click'); if (online) net.send({ type: 'resign' }); finish(my === 'w' ? 'b' : 'w', 'resign'); };
        if (online) $('#bDraw').onclick = () => {
          if (over || drawSent) return; sfx.play('click'); drawSent = true; net.send({ type: 'draw' }); st.textContent = t('chDrawSent');
        };
        else {
          $('#bUndo').onclick = () => {
            if (over || thinking || !hist.length) return; sfx.play('click');
            do { hist.pop(); keys.pop(); } while (hist.length && ((hist.length % 2 === 0) ? 'w' : 'b') !== my);
            restoreFromHist();
          };
          $('#bHint').onclick = () => {
            if (over || thinking || s.turn !== my) return; sfx.play('click');
            const m = bestMove(s, 'normal'); hintMove = m; render();
          };
        }
      }
      function restoreFromHist() {
        s = hist.length ? hist[hist.length - 1].s : initial();
        lastMove = hist.length ? hist[hist.length - 1].move : null;
        sel = null; targets = []; hintMove = null; anim = null; renderMoves(); render();
        if (!online && s.turn !== my) botTurn();
      }
      function reset() {
        s = initial(); my = colorOf(); over = false; sel = null; targets = []; lastMove = null; promoPending = null; hintMove = null; anim = null;
        drawSent = false; thinking = false; flipped = false;
        again = { me: false, opp: false }; hist = []; keys = [posKey(s)];
        clocks = { w: TIME, b: TIME }; clockT = Date.now(); clearInterval(clockInt);
        res.textContent = ''; res.className = 'result'; promo.hidden = true; offer.hidden = true; act.innerHTML = '';
        info.textContent = `${t('youAre')}: ${my === 'w' ? t('white') : t('black')}`;
        buildTools(); renderMoves(); render();
        if (online) clockInt = setInterval(onClock, 250);
        if (!online && s.turn !== my) botTurn();
      }
      function onClock() {
        if (over) return;
        const now = Date.now(); clocks[s.turn] -= now - clockT; clockT = now;
        if (clocks[s.turn] <= 0) {
          clocks[s.turn] = 0;
          if (s.turn === my) { net.send({ type: 'timeout' }); finish(my === 'w' ? 'b' : 'w', 'time'); }
          else finish(my, 'time');
        }
        drawPlayers();
      }
      function drawPlayers() {
        const o = orient(), top = o === 'w' ? 'b' : 'w';
        const m = material(s.b);
        const bar = (side, name, caps, adv) => {
          const lost = side === 'w' ? m.lostB : m.lostW;   // figury zbite przez 'side'
          const ck = online ? `<span class="clock ${s.turn === side && !over ? 'run' : ''} ${clocks[side] < 30000 ? 'low' : ''}">${fmtClock(clocks[side])}</span>` : '';
          return `<span class="ch-dot ${side}"></span><b class="nm">${name}</b><span class="caps">${lost.map(x => `<span class="cp ${side === 'w' ? 'b' : 'w'}">${glyph(x)}</span>`).join('')}${adv > 0 ? `<em>+${Math.round(adv / 100)}</em>` : ''}</span>${ck}`;
        };
        const advW = Math.max(0, m.diff), advB = Math.max(0, -m.diff);
        const nameOf = (side) => side === my ? meName : oppName;
        pTop.innerHTML = bar(top, nameOf(top), 0, top === 'w' ? advW : advB);
        pBot.innerHTML = bar(o, nameOf(o), 0, o === 'w' ? advW : advB);
        pTop.className = 'ch-player' + (s.turn === top && !over ? ' turn' : '');
        pBot.className = 'ch-player' + (s.turn === o && !over ? ' turn' : '');
      }
      function renderMoves() {
        let h = '';
        for (let i = 0; i < hist.length; i += 2) {
          h += `<div class="mr"><span class="mn">${i / 2 + 1}.</span><span class="mw">${hist[i].san}</span><span class="mb">${hist[i + 1] ? hist[i + 1].san : ''}</span></div>`;
        }
        mv.innerHTML = h || `<span class="hint">—</span>`; mv.scrollTop = mv.scrollHeight;
      }
      function render() {
        const o = orient();
        const checkSq = (!over && inCheck(s)) ? kingSq(s.b, s.turn) : -1;
        let h = '';
        for (let vr = 0; vr < 8; vr++) for (let vc = 0; vc < 8; vc++) {
          const r = o === 'w' ? vr : 7 - vr, c = o === 'w' ? vc : 7 - vc, i = r * 8 + c, p = s.b[i];
          const cls = ['sq', (r + c) % 2 ? 'dk' : 'lt'];
          if (sel === i) cls.push('sel');
          if (lastMove && (lastMove.from === i || lastMove.to === i)) cls.push('last');
          if (hintMove && (hintMove.from === i || hintMove.to === i)) cls.push('hintsq');
          if (checkSq === i) cls.push('chk');
          if (drag && drag.moved && drag.i === i) cls.push('dragsrc');
          const tg = targets.includes(i);
          if (tg) cls.push(p ? 'cap' : 'tg');
          let style = '';
          if (anim && anim.to === i && p) { style = ` style="--dx:${(anim.dc) * 100}%;--dy:${(anim.dr) * 100}%"`; }
          const coord = (vc === 0 ? `<u class="rk">${8 - r}</u>` : '') + (vr === 7 ? `<u class="fl">${FILES[c]}</u>` : '');
          h += `<div class="${cls.join(' ')}" data-i="${i}">${coord}${tg && !p ? '<b class="mvdot"></b>' : ''}<span class="pc ${p ? (isW(p) ? 'w' : 'b') : ''}${anim && anim.to === i && p ? ' slide' : ''}"${style}>${p ? glyph(p) : ''}</span></div>`;
        }
        bd.innerHTML = h; anim = null;
        drawPlayers();
        if (!over) {
          const mine = s.turn === my;
          st.textContent = (inCheck(s) ? t('check') + ' ' : '') + (mine ? t('yourTurn') : (online ? t('oppTurn') : t('thinking')));
        }
      }
      const sqAt = (x, y) => { const e = document.elementFromPoint(x, y); const q = e && e.closest && e.closest('.sq'); return q && bd.contains(q) ? +q.dataset.i : -1; };
      function selectSq(i) {
        sel = i; sfx.play('click');
        targets = legal(s).filter(m => m.from === i).map(m => m.to);
      }
      bd.addEventListener('pointerdown', (e) => {
        if (over || promoPending || e.button > 0) return;
        const i = sqAt(e.clientX, e.clientY); if (i < 0) return;
        hintMove = null;
        if (sel !== null && targets.includes(i)) { e.preventDefault(); return tryMove(sel, i, true); }
        const p = s.b[i];
        if (s.turn === my && p && own(p, my)) {
          e.preventDefault(); selectSq(i);
          drag = { i, x: e.clientX, y: e.clientY, ghost: null, moved: false };
          render(); startDrag(e, p);
        } else { sel = null; targets = []; render(); }
      });
      function startDrag(e0, p) {
        const sqEl = bd.querySelector(`.sq[data-i="${drag.i}"]`), size = sqEl ? sqEl.getBoundingClientRect().width : 60;
        const ghost = document.createElement('div'); ghost.className = 'pc-ghost pc ' + (isW(p) ? 'w' : 'b'); ghost.textContent = glyph(p);
        ghost.style.cssText = `width:${size}px;height:${size}px;font-size:${size * 0.82}px;line-height:${size}px`;
        ghost.hidden = true; document.body.appendChild(ghost); drag.ghost = ghost;
        const place = (x, y) => { ghost.style.left = (x - size / 2) + 'px'; ghost.style.top = (y - size / 2) + 'px'; };
        place(e0.clientX, e0.clientY);
        const move = (e) => { if (!drag) return; if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return; if (!drag.moved) { const q = bd.querySelector('.sq[data-i="' + drag.i + '"]'); if (q) q.classList.add('dragsrc'); } drag.moved = true; ghost.hidden = false; place(e.clientX, e.clientY); };
        const up = (e) => {
          document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
          const d = drag; drag = null; ghost.remove();
          if (!d) return;
          if (d.moved) {
            const to = sqAt(e.clientX, e.clientY);
            if (to >= 0 && to !== d.i && targets.includes(to)) return tryMove(d.i, to, false);
            if (to !== d.i) { sel = null; targets = []; }
          }
          render();
        };
        document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
        cleanup.push(() => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); ghost.remove(); });
      }
      const cleanup = [];
      function tryMove(from, to, animate) {
        const ms = legal(s).filter(m => m.from === from && m.to === to);
        if (!ms.length) return;
        if (ms.length > 1) { // promocja
          promoPending = { from, to, animate };
          promo.hidden = false;
          promo.innerHTML = `<span>${t('promoteTo')}</span>` + ['q', 'r', 'b', 'n'].map(x => `<button class="px-btn small" data-p="${x}">${glyph(my === 'w' ? x.toUpperCase() : x)}</button>`).join('');
          promo.querySelectorAll('button').forEach(b => b.onclick = () => {
            promo.hidden = true; const pr = b.dataset.p; promoPending = null;
            doMove({ from, to, promo: pr }, true, animate);
          });
          return;
        }
        doMove(ms[0], true, animate);
      }
      function doMove(m0, local, animate) {
        const lm = legal(s), m = lm.find(x => x.from === m0.from && x.to === m0.to && (x.promo || '') === (m0.promo || ''));
        if (!m) return;
        const capture = s.b[m.to] || m.flag === 'ep';
        const now = Date.now(); if (online) { clocks[s.turn] -= now - clockT; clockT = now; }
        const ns = apply(s, m), san = toSAN(s, m, lm, ns);
        if (animate !== false) anim = { to: m.to, dr: (m.from >> 3) - (m.to >> 3), dc: (m.from & 7) - (m.to & 7) };
        if (orient() === 'b' && anim) { anim.dr = -anim.dr; anim.dc = -anim.dc; }
        s = ns; lastMove = m; sel = null; targets = []; hintMove = null; drawSent = false; offer.hidden = true;
        hist.push({ s, move: m, san });
        sfx.play(capture ? 'hit' : 'place');
        if (local && online) net.send({ type: 'move', from: m.from, to: m.to, promo: m.promo || null });
        const k = posKey(s); keys.push(k);
        const reps = keys.filter(x => x === k).length;
        const stt = status(s);
        renderMoves(); render();
        if (stt === 'mate') return finish(s.turn === 'w' ? 'b' : 'w', 'mate');
        if (stt === 'stalemate') return finish(null, 'stalemate');
        if (stt === 'draw') return finish(null, s.half >= 100 ? 'fifty' : 'material');
        if (reps >= 3) return finish(null, 'rep');
        if (!online && s.turn !== my) botTurn();
      }
      function botTurn() {
        thinking = true;
        timers.push(setTimeout(() => {
          if (over) { thinking = false; return; }
          const m = bestMove(s, ctx.difficulty);
          thinking = false;
          if (m) doMove(m, false, true);
        }, 300));
      }
      function finish(winner, why) {
        over = true; promo.hidden = true; offer.hidden = true; st.textContent = ''; clearInterval(clockInt);
        const r = winner === null ? 'draw' : (winner === my ? 'win' : 'lose');
        const why_ = { mate: t('checkmate'), stalemate: t('stalemate'), draw: t('drawRule'), rep: t('chRep'), fifty: t('ch50'), material: t('chMat'), time: t('chTime'), agree: t('chDrawYes'), resign: '' }[why] || '';
        res.innerHTML = `${t(r)}${why_ ? `<small>${why_}</small>` : ''}`; res.className = 'result show ' + r;
        render(); sfx.play(r); ctx.finish(r);
        act.innerHTML = `<button class="px-btn pink" id="again">${t('again')}</button>`;
        act.querySelector('#again').onclick = () => {
          sfx.play('click');
          if (!online) { round++; reset(); return; }
          again.me = true; net.send({ type: 'again' });
          act.innerHTML = `<span class="hint">${t('waitOpp')}</span>`; tryAgain();
        };
      }
      function tryAgain() { if (again.me && again.opp) { round++; reset(); } }
      if (online) net.setHandler((m) => {
        if (m.type === 'move' && !over && s.turn !== my) doMove({ from: m.from, to: m.to, promo: m.promo || undefined }, false, true);
        else if (m.type === 'resign' && !over) finish(my, 'resign');
        else if (m.type === 'timeout' && !over) finish(my, 'time');
        else if (m.type === 'again') { again.opp = true; tryAgain(); }
        else if (m.type === 'draw' && !over) {
          offer.hidden = false;
          offer.innerHTML = `<span>${t('chDrawOffered')}</span><button class="px-btn small green" id="dY">${t('chAccept')}</button><button class="px-btn small ghost" id="dN">${t('chDecline')}</button>`;
          offer.querySelector('#dY').onclick = () => { net.send({ type: 'drawYes' }); finish(null, 'agree'); };
          offer.querySelector('#dN').onclick = () => { net.send({ type: 'drawNo' }); offer.hidden = true; };
        }
        else if (m.type === 'drawYes' && !over) finish(null, 'agree');
        else if (m.type === 'drawNo') { drawSent = false; st.textContent = t('chDrawNo'); }
      });
      reset();
      return { destroy() { timers.forEach(clearTimeout); clearInterval(clockInt); cleanup.forEach(f => f()); } };
    }
  };
  Games.chess._engine = { initial, legal, apply, status, bestMove, toSAN, evalPos, inCheck };
})();
