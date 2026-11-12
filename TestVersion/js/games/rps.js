(function () {
  I18N.add({
    pl: {
      g_rps: 'Papier, kamień, nożyce', g_rps_d: 'Kto pierwszy zdobędzie 3 punkty?',
      rock: 'Kamień', paper: 'Papier', scissors: 'Nożyce',
      pickOne: 'Wybierz!', waitPick: 'Czekam na wybór przeciwnika...',
      rWin: 'Punkt dla Ciebie!', rLose: 'Punkt dla przeciwnika', rDraw: 'Remis w rundzie'
    },
    en: {
      g_rps: 'Rock Paper Scissors', g_rps_d: 'First to 3 points wins.',
      rock: 'Rock', paper: 'Paper', scissors: 'Scissors',
      pickOne: 'Pick one!', waitPick: 'Waiting for the opponent...',
      rWin: 'Point for you!', rLose: 'Point for the opponent', rDraw: 'Round draw'
    }
  });
  const ICON = { r: '✊', p: '✋', s: '✌️' };
  const NAME = { r: 'rock', p: 'paper', s: 'scissors' };
  const BEATS = { r: 's', p: 'r', s: 'p' };           // klucz bije wartość
  const counterTo = (k) => Object.keys(BEATS).find(x => BEATS[x] === k);
  const WIN = 3;

  Games.rps = {
    id: 'rps', nameKey: 'g_rps', descKey: 'g_rps_d', color: 'green',
    icon: pixelIcon([
      '...........', '..wwwwwww..', '.wvwvwvwvw.', '.wwwwwwwww.', '.wwwwwwwww.', '.wwwwwwwww.',
      '..wwwwwww..', '...wwwww...', '...ggggg...', '...ggggg...', '...........'
    ]),
    start(el, ctx) {
      const { t, net, sfx } = ctx;
      const online = ctx.mode === 'online';
      let ms, os, round, mine, theirs, resolved, locked, over, again, hist, timers = [];

      el.innerHTML = `<div class="rps">
        <div class="rps-score"><div><small>${t('you')}</small><b id="ms">0</b></div><div class="rps-vs">VS</div><div><small>${t('opponent')}</small><b id="os">0</b></div></div>
        <div class="rps-arena"><div class="hand" id="mh">❔</div><div class="hand flip" id="oh">❔</div></div>
        <div class="status" id="st"></div>
        <div class="rps-btns" id="btns">${['r', 'p', 's'].map(k => `<button class="rps-b" data-k="${k}"><span>${ICON[k]}</span>${t(NAME[k])}</button>`).join('')}</div>
        <div class="result" id="res"></div><div class="actions" id="act"></div></div>`;
      const $ = (s) => el.querySelector(s);
      const st = $('#st'), mh = $('#mh'), oh = $('#oh'), res = $('#res'), act = $('#act');
      const btns = [...el.querySelectorAll('.rps-b')];

      function scores() { $('#ms').textContent = ms; $('#os').textContent = os; }
      function newMatch() {
        ms = os = 0; round = 1; mine = {}; theirs = {}; resolved = {}; hist = []; over = false;
        again = { me: false, opp: false }; res.textContent = ''; res.className = 'result'; act.innerHTML = '';
        scores(); nextRound();
      }
      function nextRound() {
        locked = false; mh.textContent = '❔'; oh.textContent = '❔';
        mh.className = 'hand'; oh.className = 'hand flip';
        st.textContent = t('pickOne'); btns.forEach(b => b.disabled = false);
        if (theirs[round] && online) { /* przeciwnik już wybrał – czekamy na nasz wybór */ }
      }
      function botPick() {
        const d = ctx.difficulty;
        if (d === 'hard' && hist.length >= 2 && Math.random() < 0.65) {
          const cnt = { r: 0, p: 0, s: 0 }; hist.forEach(k => cnt[k]++);
          const fav = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0];
          return counterTo(fav);
        }
        if (d === 'normal' && hist.length && Math.random() < 0.35) return counterTo(hist[hist.length - 1]);
        return pick(['r', 'p', 's']);
      }
      function choose(k) {
        if (locked || over) return;
        locked = true; sfx.play('click');
        mine[round] = k; mh.textContent = ICON[k]; mh.classList.add('locked');
        btns.forEach(b => b.disabled = true);
        if (online) net.send({ type: 'pick', c: k, r: round });
        else theirs[round] = botPick();
        st.textContent = t('waitPick');
        check();
      }
      function check() {
        if (mine[round] && theirs[round] && !resolved[round]) resolve(round);
      }
      function resolve(r) {
        resolved[r] = true;
        const a = mine[r], b = theirs[r];
        hist.push(b === undefined ? a : a);
        oh.textContent = ICON[b]; oh.classList.add('reveal'); mh.classList.add('reveal');
        const out = a === b ? 0 : (BEATS[a] === b ? 1 : -1);
        if (out === 1) { ms++; st.textContent = t('rWin'); sfx.play('good'); mh.classList.add('won'); }
        else if (out === -1) { os++; st.textContent = t('rLose'); sfx.play('bad'); oh.classList.add('won'); }
        else { st.textContent = t('rDraw'); sfx.play('draw'); }
        scores();
        timers.push(setTimeout(() => {
          if (ms >= WIN || os >= WIN) end(); else { round++; nextRound(); check(); }
        }, 1500));
      }
      function end() {
        over = true; const r = ms > os ? 'win' : 'lose';
        st.textContent = ''; res.textContent = t(r); res.className = 'result show ' + r;
        sfx.play(r); ctx.finish(r);
        act.innerHTML = `<button class="px-btn pink" id="again">${t('again')}</button>`;
        act.querySelector('#again').onclick = () => {
          sfx.play('click');
          if (!online) return newMatch();
          again.me = true; net.send({ type: 'again' });
          act.innerHTML = `<span class="hint">${t('waitOpp')}</span>`; tryAgain();
        };
      }
      function tryAgain() { if (again.me && again.opp) newMatch(); }
      btns.forEach(b => b.onclick = () => choose(b.dataset.k));
      if (online) net.setHandler((m) => {
        if (m.type === 'pick') { theirs[m.r] = m.c; if (m.r === round) check(); }
        else if (m.type === 'again') { again.opp = true; tryAgain(); }
      });
      newMatch();
      return { destroy() { timers.forEach(clearTimeout); } };
    }
  };
})();
