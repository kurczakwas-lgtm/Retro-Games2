(function () {
  const WORDS = {
    pl: ['KOMPUTER', 'KLAWIATURA', 'SZKOŁA', 'LEKCJA', 'PRZYJACIEL', 'CZEKOLADA', 'ROWER', 'SAMOLOT', 'BIBLIOTEKA', 'WAKACJE',
      'PLECAK', 'TELEFON', 'MUZYKA', 'FUTBOL', 'DINOZAUR', 'KOSMOS', 'RAKIETA', 'PIRAT', 'SMOK', 'ZAMEK',
      'GITARA', 'ŻYRAFA', 'KROKODYL', 'TRAMWAJ', 'PIZZA', 'LODY', 'KOMIKS', 'ROBOT', 'WULKAN', 'OKRĘT',
      'ZEGAREK', 'PARASOL', 'TRAKTOR', 'MOTYL', 'KSIĘŻYC', 'GWIAZDA', 'BURZA', 'TĘCZA', 'ŁÓDKA', 'PIŁKA'],
    en: ['COMPUTER', 'KEYBOARD', 'SCHOOL', 'LESSON', 'FRIEND', 'CHOCOLATE', 'BICYCLE', 'AIRPLANE', 'LIBRARY', 'HOLIDAY',
      'BACKPACK', 'TELEPHONE', 'MUSIC', 'FOOTBALL', 'DINOSAUR', 'GALAXY', 'ROCKET', 'PIRATE', 'DRAGON', 'CASTLE',
      'GUITAR', 'GIRAFFE', 'CROCODILE', 'TRAIN', 'PIZZA', 'ICECREAM', 'COMIC', 'ROBOT', 'VOLCANO', 'SUBMARINE',
      'WATCH', 'UMBRELLA', 'TRACTOR', 'BUTTERFLY', 'MOON', 'STAR', 'THUNDER', 'RAINBOW', 'BOAT', 'WIZARD']
  };
  const LETTERS = [...'AĄBCĆDEĘFGHIJKLŁMNŃOÓPQRSŚTUVWXYZŹŻ'];
  const MAX = 10;
  const PARTS = [
    '<line x1="10" y1="130" x2="70" y2="130"/>',
    '<line x1="30" y1="130" x2="30" y2="10"/>',
    '<line x1="30" y1="10" x2="85" y2="10"/>',
    '<line x1="85" y1="10" x2="85" y2="28"/>',
    '<circle cx="85" cy="40" r="12"/>',
    '<line x1="85" y1="52" x2="85" y2="90"/>',
    '<line x1="85" y1="60" x2="68" y2="78"/>',
    '<line x1="85" y1="60" x2="102" y2="78"/>',
    '<line x1="85" y1="90" x2="70" y2="116"/>',
    '<line x1="85" y1="90" x2="100" y2="116"/>'
  ];

  Games.hangman = {
    id: 'hangman', nameKey: 'g_hangman', descKey: 'g_hangman_d', color: 'cyan',
    icon: pixelIcon([
      'yyyyyyyyy..', 'y....ccc...', 'y....ccc...', 'y.....p....', 'y....ppp...', 'y.....p....',
      'y....p.p...', 'y...p...p..', 'y..........', 'y..........', 'yyyyyyyyyyy'
    ]),
    start(el, ctx) {
      const { t, net, sfx } = ctx;
      const online = ctx.mode === 'online';
      let round = 0, word = '', guessed = new Set(), wrong = 0, over = false, role, again, started;

      el.innerHTML = `<div class="hm">
        <div class="status" id="st"></div>
        <div class="hm-top"><svg viewBox="0 0 120 140" class="hm-svg" id="svg"></svg>
        <div class="hm-info"><div class="hm-lives" id="lives"></div><div class="hm-word" id="wd"></div></div></div>
        <div id="setter" class="setter" hidden>
          <label class="field"><span>${t('enterWord')}</span><input id="wIn" maxlength="20" autocomplete="off" placeholder="${t('wordHint')}"></label>
          <button class="px-btn pink" id="wSend">${t('sendWord')}</button>
        </div>
        <div class="kb" id="kb">${LETTERS.map(l => `<button class="key" data-l="${l}">${l}</button>`).join('')}</div>
        <div class="result" id="res"></div>
        <div class="actions" id="act"></div></div>`;
      const $ = (s) => el.querySelector(s);
      const st = $('#st'), svg = $('#svg'), wd = $('#wd'), lives = $('#lives'), kb = $('#kb'),
        setter = $('#setter'), res = $('#res'), act = $('#act');
      const keys = [...kb.querySelectorAll('.key')];

      function draw() {
        svg.innerHTML = `<g class="hm-g">${PARTS.slice(0, wrong).join('')}</g>`;
        lives.textContent = `${t('lives')}: ${wrong}/${MAX}`;
        const show = role === 'setter' || over;
        wd.innerHTML = word ? [...word].map(ch => {
          const got = guessed.has(ch);
          return `<span class="${got ? 'got' : (over || role === 'setter' ? 'miss' : '')}">${got || show ? ch : '_'}</span>`;
        }).join('') : '';
        keys.forEach(k => {
          const l = k.dataset.l, used = guessed.has(l);
          k.disabled = used || over || role !== 'guesser' || !word;
          k.className = 'key' + (used ? (word.includes(l) ? ' ok' : ' no') : '');
        });
      }
      function newRound() {
        guessed = new Set(); wrong = 0; over = false; word = '';
        again = { me: false, opp: false };
        res.textContent = ''; res.className = 'result'; act.innerHTML = '';
        setter.hidden = true;
        if (!online) {
          role = 'guesser'; word = pick(WORDS[I18N.lang] || WORDS.en);
          st.textContent = t('guessing');
        } else {
          role = ((ctx.role === 'host') !== (round % 2 === 1)) ? 'setter' : 'guesser';
          if (role === 'setter') { setter.hidden = false; st.textContent = t('enterWord'); $('#wIn').value = ''; $('#wIn').focus(); }
          else st.textContent = t('waitWord');
        }
        draw();
      }
      function guess(l) {
        if (guessed.has(l) || over) return;
        guessed.add(l);
        if (!word.includes(l)) { wrong++; sfx.play('bad'); } else sfx.play('good');
        const won = [...word].every(ch => guessed.has(ch));
        if (won || wrong >= MAX) return end(won);
        draw();
      }
      function end(guesserWon) {
        over = true; draw(); st.textContent = '';
        const r = (role === 'guesser') === guesserWon ? 'win' : 'lose';
        res.innerHTML = `${t(r)}<small>${t('wordWas')} ${word}</small>`;
        res.className = 'result show ' + r;
        sfx.play(r); ctx.finish(r);
        act.innerHTML = `<button class="px-btn pink" id="again">${online ? t('again') : t('nextWord')}</button>`;
        act.querySelector('#again').onclick = () => {
          sfx.play('click');
          if (!online) { round++; newRound(); return; }
          again.me = true; net.send({ type: 'again' });
          act.innerHTML = `<span class="hint">${t('waitOpp')}</span>`;
          tryAgain();
        };
      }
      function tryAgain() { if (again.me && again.opp) { round++; newRound(); } }
      function sendWord() {
        const w = $('#wIn').value.toUpperCase().split('').filter(c => LETTERS.includes(c)).join('');
        if (w.length < 3) { sfx.play('bad'); return; }
        word = w; setter.hidden = true; sfx.play('click');
        st.textContent = t('watching');
        net.send({ type: 'word', w });
        draw();
      }
      keys.forEach(k => k.onclick = () => {
        if (role !== 'guesser' || over) return;
        const l = k.dataset.l; sfx.play('click');
        guess(l);
        if (online) net.send({ type: 'guess', l });
      });
      $('#wSend').onclick = sendWord;
      $('#wIn').onkeydown = (e) => { if (e.key === 'Enter') sendWord(); };
      if (online) net.setHandler((m) => {
        if (m.type === 'word' && role === 'guesser' && !word) { word = m.w; st.textContent = t('guessing'); draw(); }
        else if (m.type === 'guess' && role === 'setter' && word) guess(m.l);
        else if (m.type === 'again') { again.opp = true; tryAgain(); }
      });
      const onKey = (e) => {
        if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
        const l = e.key.toUpperCase();
        if (LETTERS.includes(l) && role === 'guesser' && !over && word) { const k = keys.find(x => x.dataset.l === l); if (k && !k.disabled) k.click(); }
      };
      document.addEventListener('keydown', onKey);
      newRound();
      return { destroy() { document.removeEventListener('keydown', onKey); } };
    }
  };
})();
