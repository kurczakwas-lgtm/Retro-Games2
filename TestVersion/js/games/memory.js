(function () {
  I18N.add({
    pl: { g_memory: 'Memory', g_memory_d: 'Znajdź wszystkie pary. Na czas!', memMoves: 'Ruchy', memTime: 'Czas', memHint: 'Odkrywaj karty i szukaj par' },
    en: { g_memory: 'Memory', g_memory_d: 'Find all the pairs. Against the clock!', memMoves: 'Moves', memTime: 'Time', memHint: 'Flip cards and find pairs' }
  });
  const ICONS = ['🚀', '👾', '🎮', '🍕', '🐙', '🦄', '🍩', '⚡', '🔥', '💎', '🎲', '🎧', '🐸', '🌈', '🍉', '🛸', '👻', '🎯'];
  const LEVELS = { easy: [4, 4], normal: [4, 6], hard: [6, 6] };
  Games.memory = {
    id: 'memory', nameKey: 'g_memory', descKey: 'g_memory_d', color: 'pink', solo: true, diff: true,
    icon: pixelIcon(['.pppp.cccc.', 'pppppcccccc', 'pp.ppcc.ccc', 'pppppcccccc', '.pppp.cccc.', '...........', '.yyyy.gggg.', 'yyyyyggggg.', 'yy.yygg.ggg', 'yyyyyggggg.', '.yyyy.gggg.']),
    _engine: { LEVELS },
    start(el, ctx) {
      const { t, sfx } = ctx, [rows, cols] = LEVELS[ctx.difficulty] || LEVELS.normal;
      el.innerHTML = `<div class="memory"><div class="status">${t('memHint')}</div>
        <div class="mem-top"><div class="mn-box"><small>${t('memMoves')}</small><b id="mv">0</b></div><div class="mn-box"><small>${t('memTime')}</small><b id="tm">0</b></div></div>
        <div class="mem-grid" style="--cols:${cols}" id="gr"></div><div class="result" id="res"></div><div class="actions" id="act"></div></div>`;
      const gr = el.querySelector('#gr'), mv = el.querySelector('#mv'), tm = el.querySelector('#tm'), res = el.querySelector('#res'), act = el.querySelector('#act');
      let deck, open, matched, moves, t0, tick, lock, timers = [];
      function reset() {
        clearInterval(tick); tick = null; t0 = 0; moves = 0; matched = 0; open = []; lock = false;
        deck = shuffle([...ICONS].sort(() => Math.random() - 0.5).slice(0, rows * cols / 2).flatMap(x => [x, x]));
        mv.textContent = 0; tm.textContent = 0; res.textContent = ''; res.className = 'result'; act.innerHTML = '';
        gr.innerHTML = deck.map((x, i) => `<button class="mem-c" data-i="${i}" aria-label="card"><span class="f">${x}</span><span class="bk">?</span></button>`).join('');
      }
      gr.addEventListener('click', (e) => {
        const c = e.target.closest('.mem-c'); if (!c || lock || c.classList.contains('on') || c.classList.contains('ok')) return;
        if (!t0) { t0 = Date.now(); tick = setInterval(() => { tm.textContent = Math.floor((Date.now() - t0) / 1000); }, 250); }
        c.classList.add('on'); sfx.play('click'); open.push(c);
        if (open.length < 2) return;
        moves++; mv.textContent = moves; lock = true;
        const [a, b] = open;
        if (deck[+a.dataset.i] === deck[+b.dataset.i]) {
          timers.push(setTimeout(() => {
            a.classList.add('ok'); b.classList.add('ok'); open = []; lock = false; matched += 2; sfx.play('good');
            if (matched === deck.length) win();
          }, 350));
        } else {
          timers.push(setTimeout(() => { a.classList.remove('on'); b.classList.remove('on'); open = []; lock = false; sfx.play('bad'); }, 750));
        }
      });
      function win() {
        clearInterval(tick); const time = Math.max(1, Math.floor((Date.now() - t0) / 1000)); tm.textContent = time;
        res.innerHTML = `${t('win')}<small>${time}s · ${moves} ${t('memMoves')}</small>`; res.className = 'result show win';
        sfx.play('win'); ctx.finish('win', time);
        act.innerHTML = `<button class="px-btn pink" id="again">${t('again')}</button>`;
        act.querySelector('#again').onclick = () => { sfx.play('click'); reset(); };
      }
      reset();
      return { destroy() { clearInterval(tick); timers.forEach(clearTimeout); } };
    }
  };
})();

