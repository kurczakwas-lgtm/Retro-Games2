(function () {
  I18N.add({
    pl: {
      g_chess: 'Szachy', g_chess_d: 'Królewska gra. Pełne zasady, bot z silnikiem.',
      check: 'Szach!', checkmate: 'Szach-mat!', stalemate: 'Pat – remis', drawRule: 'Remis', resign: 'Poddaj się',
      white: 'Białe', black: 'Czarne', youAre: 'Grasz', promoteTo: 'Promocja na:', thinking: 'Bot myśli...', oppResigned: 'Przeciwnik się poddał'
    },
    en: {
      g_chess: 'Chess', g_chess_d: 'The royal game. Full rules, engine-powered bot.',
      check: 'Check!', checkmate: 'Checkmate!', stalemate: 'Stalemate – draw', drawRule: 'Draw', resign: 'Resign',
      white: 'White', black: 'Black', youAre: 'You play', promoteTo: 'Promote to:', thinking: 'Bot is thinking...', oppResigned: 'Opponent resigned'
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

  // ---- ocena ----
  const VAL = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const PST_P = [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0];
  const cen = (sq) => { const r = sq >> 3, c = sq & 7; return 8 - (Math.abs(r - 3.5) + Math.abs(c - 3.5)) * 2; };
  function evalPos(s) {
    let sc = 0;
    for (let i = 0; i < 64; i++) {
      const p = s.b[i]; if (!p) continue;
      const w = isW(p), ty = p.toLowerCase();
      let v = VAL[ty];
      if (ty === 'p') v += w ? PST_P[i] : PST_P[(7 - (i >> 3)) * 8 + (i & 7)];
      else if (ty === 'n' || ty === 'b') v += cen(i) * 4;
      else if (ty === 'q') v += cen(i);
      else if (ty === 'k') { const r = i >> 3; v += (w ? r : 7 - r) * 6 - Math.abs((i & 7) - 3.5) * 2; v -= 0; }
      sc += w ? v : -v;
    }
    return sc;
  }
  function order(s, moves) {
    return moves.map(m => {
      const v = s.b[m.to] ? VAL[s.b[m.to].toLowerCase()] * 10 - VAL[s.b[m.from].toLowerCase()] : 0;
      return { m, v: v + (m.promo ? 800 : 0) };
    }).sort((x, y) => y.v - x.v).map(x => x.m);
  }
  function negamax(s, depth, alpha, beta, ply) {
    if (depth === 0) return (s.turn === 'w' ? 1 : -1) * evalPos(s);
    const moves = legal(s);
    if (!moves.length) return inCheck(s) ? -99000 + ply : 0;
    let best = -Infinity;
    for (const m of order(s, moves)) {
      const sc = -negamax(apply(s, m), depth - 1, -beta, -alpha, ply + 1);
      if (sc > best) best = sc;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  function bestMove(s, diff) {
    const moves = legal(s);
    if (diff === 'easy' && Math.random() < 0.3) return pick(moves);
    const depth = diff === 'hard' ? 3 : diff === 'normal' ? 2 : 1;
    let best = -Infinity, list = [];
    for (const m of order(s, moves)) {
      let sc = -negamax(apply(s, m), depth - 1, -Infinity, Infinity, 1);
      if (diff === 'easy') sc += Math.random() * 60;
      if (sc > best + 1e-9) { best = sc; list = [m]; } else if (Math.abs(sc - best) < 1e-9) list.push(m);
    }
    return pick(list);
  }

  // ================= UI =================
  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  const glyph = (p) => GLYPH[p.toLowerCase()] + '\uFE0E';

  Games.chess = {
    id: 'chess', nameKey: 'g_chess', descKey: 'g_chess_d', color: 'yellow',
    icon: pixelIcon([
      '.....y.....', '....yyy....', '.....y.....', '...wwwww...', '...wwwww...', '....www....',
      '....www....', '....www....', '...wwwww...', '..wwwwwww..', '..wwwwwww..'
    ]),
    start(el, ctx) {
      const { t, net, sfx } = ctx;
      const online = ctx.mode === 'online';
      let s, round = 0, my, over, sel = null, targets = [], lastMove = null, again, history, timers = [], promoPending = null, resultText = '';
      const colorOf = () => online ? (((ctx.role === 'host') !== (round % 2 === 1)) ? 'w' : 'b') : (round % 2 ? 'b' : 'w');

      el.innerHTML = `<div class="chess">
        <div class="status" id="st"></div>
        <div class="ch-info" id="info"></div>
        <div class="ch-board" id="bd"></div>
        <div class="ch-promo" id="promo" hidden></div>
        <div class="result" id="res"></div><div class="actions" id="act"></div></div>`;
      const $ = (q) => el.querySelector(q);
      const st = $('#st'), bd = $('#bd'), res = $('#res'), act = $('#act'), promo = $('#promo'), info = $('#info');

      function reset() {
        s = initial(); my = colorOf(); over = false; sel = null; targets = []; lastMove = null; promoPending = null;
        again = { me: false, opp: false }; history = new Map([[posKey(s), 1]]);
        res.textContent = ''; res.className = 'result'; promo.hidden = true;
        act.innerHTML = `<button class="px-btn small ghost" id="resign">🏳 ${t('resign')}</button>`;
        $('#resign').onclick = () => { if (over) return; sfx.play('click'); if (online) net.send({ type: 'resign' }); finish(my === 'w' ? 'b' : 'w', 'resign'); };
        info.textContent = `${t('youAre')}: ${my === 'w' ? t('white') : t('black')}`;
        render();
        if (!online && s.turn !== my) botTurn();
      }
      function render() {
        const checkSq = (!over && inCheck(s)) ? kingSq(s.b, s.turn) : -1;
        let h = '';
        for (let vr = 0; vr < 8; vr++) for (let vc = 0; vc < 8; vc++) {
          const r = my === 'w' ? vr : 7 - vr, c = my === 'w' ? vc : 7 - vc, i = r * 8 + c, p = s.b[i];
          const cls = ['sq', (r + c) % 2 ? 'dk' : 'lt'];
          if (sel === i) cls.push('sel');
          if (lastMove && (lastMove.from === i || lastMove.to === i)) cls.push('last');
          if (checkSq === i) cls.push('chk');
          const tg = targets.includes(i);
          if (tg) cls.push(p ? 'cap' : 'tg');
          h += `<button class="${cls.join(' ')}" data-i="${i}">${p ? `<span class="pc ${isW(p) ? 'w' : 'b'}">${glyph(p)}</span>` : ''}${tg && !p ? '<i></i>' : ''}</button>`;
        }
        bd.innerHTML = h;
        bd.querySelectorAll('.sq').forEach(b => b.onclick = () => click(+b.dataset.i));
        if (!over) {
          const mine = s.turn === my;
          st.textContent = (inCheck(s) ? t('check') + ' ' : '') + (mine ? t('yourTurn') : (online ? t('oppTurn') : t('thinking')));
        }
      }
      function click(i) {
        if (over || s.turn !== my || promoPending) return;
        const p = s.b[i];
        if (sel !== null && targets.includes(i)) return tryMove(sel, i);
        if (p && own(p, my)) {
          sel = i; sfx.play('click');
          targets = legal(s).filter(m => m.from === i).map(m => m.to);
        } else { sel = null; targets = []; }
        render();
      }
      function tryMove(from, to) {
        const ms = legal(s).filter(m => m.from === from && m.to === to);
        if (!ms.length) return;
        if (ms.length > 1) { // promocja
          promoPending = { from, to };
          promo.hidden = false;
          promo.innerHTML = `<span>${t('promoteTo')}</span>` + ['q', 'r', 'b', 'n'].map(x => `<button class="px-btn small" data-p="${x}">${glyph(my === 'w' ? x.toUpperCase() : x)}</button>`).join('');
          promo.querySelectorAll('button').forEach(b => b.onclick = () => {
            promo.hidden = true; const pr = b.dataset.p; promoPending = null;
            doMove({ from, to, promo: pr }, true);
          });
          return;
        }
        doMove(ms[0], true);
      }
      function doMove(m0, local) {
        const m = legal(s).find(x => x.from === m0.from && x.to === m0.to && (x.promo || '') === (m0.promo || ''));
        if (!m) return;
        const capture = s.b[m.to] || m.flag === 'ep';
        s = apply(s, m); lastMove = m; sel = null; targets = [];
        sfx.play(capture ? 'hit' : 'place');
        if (local && online) net.send({ type: 'move', from: m.from, to: m.to, promo: m.promo || null });
        const k = posKey(s); history.set(k, (history.get(k) || 0) + 1);
        const stt = status(s);
        render();
        if (stt === 'mate') return finish(s.turn === 'w' ? 'b' : 'w', 'mate');
        if (stt === 'stalemate') return finish(null, 'stalemate');
        if (stt === 'draw' || history.get(k) >= 3) return finish(null, 'draw');
        if (!online && s.turn !== my) botTurn();
      }
      function botTurn() {
        timers.push(setTimeout(() => {
          if (over) return;
          const m = bestMove(s, ctx.difficulty);
          if (m) doMove(m, false);
        }, 350));
      }
      function finish(winner, why) {
        over = true; promo.hidden = true; st.textContent = '';
        const r = winner === null ? 'draw' : (winner === my ? 'win' : 'lose');
        const why_ = { mate: t('checkmate'), stalemate: t('stalemate'), draw: t('drawRule'), resign: '' }[why] || '';
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
        if (m.type === 'move' && !over && s.turn !== my) doMove({ from: m.from, to: m.to, promo: m.promo || undefined }, false);
        else if (m.type === 'resign' && !over) finish(my, 'resign');
        else if (m.type === 'again') { again.opp = true; tryAgain(); }
      });
      reset();
      return { destroy() { timers.forEach(clearTimeout); } };
    }
  };
})();
