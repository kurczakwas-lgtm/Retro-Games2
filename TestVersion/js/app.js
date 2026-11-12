(function () {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const t = (k, p) => I18N.t(k, p);
  const view = $('#view');
  let current = null, onLeft = null, rerender = null, scoreHintShown = false, tok = 0, currentScreen = '', friendsReload = null;
  const guestNick = 'Gość' + (100 + Math.floor(Math.random() * 900));

  function toast(msg, ms = 3400) {
    const d = document.createElement('div'); d.className = 'toast'; d.textContent = msg;
    if (ms > 4000) d.style.animation = `rise .3s, fadeout .4s ${(ms - 400) / 1000}s forwards`;
    $('#toasts').appendChild(d); setTimeout(() => d.remove(), ms);
  }
  function wipe() { const w = $('#wipe'); w.classList.remove('go'); void w.offsetWidth; w.classList.add('go'); }
  function screen(fn) { rerender = fn; wipe(); fn(); view.classList.remove('fade'); void view.offsetWidth; view.classList.add('fade'); }
  let lbTimer = null, saTimer = null;
  function leaveGame() {
    if (lbTimer) { clearInterval(lbTimer); lbTimer = null; }
    if (saTimer) { clearInterval(saTimer); saTimer = null; }
    if (current && current.destroy) current.destroy();
    current = null; onLeft = null;
    if (Net.leaveLobby) Net.leaveLobby();
    if (Net.unwatchLobby) Net.unwatchLobby();
    Net.leave(); tok++; currentScreen = '';
  }
  const nickName = () => Supa.nick() || guestNick;
  const CATS = {
    board: ['chess', 'checkers', 'reversi', 'gomoku', 'ttt', 'c4', 'battleship'],
    arcade: ['snake', 'pong', 'tetris', 'breakout', 'flappy', 'g2048', 'mines', 'memory', 'hangman', 'rps', 'wordle', 'invaders', 'pacman']
  };
  const SIDE_GAMES = ['chess', 'checkers', 'reversi', 'gomoku', 'ttt', 'c4'];
  const SA_GAMES = ['tetris', 'g2048', 'breakout', 'flappy', 'invaders', 'pacman'];
  let sideChoice = sessionStorage.getItem('side') || 'r';
  const resolveFirst = () => sideChoice === 'w' ? true : sideChoice === 'b' ? false : Math.random() < 0.5;
  let menuCat = sessionStorage.getItem('cat') || 'all';
  let menuQuery = '';
  let menuFavOnly = false;

  const isOwnerUser = (uid) => !!(window.ProfileConfig && ProfileConfig.isOwner && ProfileConfig.isOwner(uid));
  const ownerBadgeHtml = (uid) => isOwnerUser(uid) ? `<span class="owner-tag" title="OWNER">👑 OWNER</span>` : '';
  const pinnedMiniHtml = (prefs) => {
    const pins = prefs && Array.isArray(prefs.pinnedBadges) ? prefs.pinnedBadges.slice(0, 3) : [];
    const list = window.ProfileConfig && ProfileConfig.BADGES ? ProfileConfig.BADGES : [];
    return pins.map(id => {
      const b = list.find(x => x.id === id);
      return b ? `<span class="pin-ico" title="${esc(t('bdg_' + b.id))}">${b.ico}</span>` : '';
    }).join('');
  };

  function getCoins() {
    const p = Supa.myPrefs ? Supa.myPrefs() : {};
    return Math.max(0, Number(p.coins) || 0);
  }
  async function addCoins(delta) {
    if (!delta || !Supa.savePrefs) return getCoins();
    const cur = getCoins();
    const next = Math.max(0, cur + delta);
    await Supa.savePrefs({ coins: next });
    header();
    return next;
  }
  function getFavs() {
    const uid = (Supa.user() && Supa.user().id) || 'guest';
    try { return JSON.parse(localStorage.getItem('fav_games_' + uid) || '[]'); } catch (e) { return []; }
  }
  function toggleFav(gid) {
    const uid = (Supa.user() && Supa.user().id) || 'guest';
    const cur = getFavs();
    const idx = cur.indexOf(gid);
    if (idx >= 0) cur.splice(idx, 1); else cur.push(gid);
    try { localStorage.setItem('fav_games_' + uid, JSON.stringify(cur)); } catch (e) {}
    return cur;
  }

  // ---------- CODZIENNE WYZWANIE (DAILY QUEST + STREAK) ----------
  const dayKeyOffset = (offsetDays) => {
    const d = new Date(Date.now() + offsetDays * 86400000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  function getDailyQuest() {
    const key = dayKeyOffset(0), yKey = dayKeyOffset(-1);
    const gids = Object.keys(Games);
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = ((hash << 5) - hash + key.charCodeAt(i)) | 0;
    const abs = Math.abs(hash);
    const gid = gids[abs % gids.length] || 'ttt';
    const type = (abs % 2 === 0) ? 'win' : 'play'; // win = 1 wygrana, play = 2 rozegrane
    const target = type === 'win' ? 1 : 2;
    const uid = (Supa.user() && Supa.user().id) || 'guest';
    const storeKey = 'dq_' + key + '_' + uid;
    const streakKey = 'dq_streak_' + uid;
    let state = { cur: 0, done: false };
    let stData = { streak: 0, lastDay: '' };
    try { state = Object.assign(state, JSON.parse(localStorage.getItem(storeKey) || '{}')); } catch (e) {}
    try { stData = Object.assign(stData, JSON.parse(localStorage.getItem(streakKey) || '{}')); } catch (e) {}
    const activeStreak = (stData.lastDay === key || stData.lastDay === yKey) ? (stData.streak || 0) : 0;
    const pts = 3 + (activeStreak >= 3 ? 2 : 0);
    return { key, yKey, storeKey, streakKey, gid, g: Games[gid], type, target, pts, coins: 25, cur: state.cur || 0, done: !!state.done, streak: activeStreak, lastDay: stData.lastDay || '' };
  }

  // ---------- MENU ----------
  function menu() {
    leaveGame();
    const inCat = (g) => menuCat === 'all' || (menuCat === 'solo' ? !!g.solo : (CATS[menuCat] || []).includes(g.id));
    const dq = getDailyQuest();
    const dqDesc = dq.g ? t(dq.type === 'win' ? 'dailyWin' : 'dailyPlay', { game: t(dq.g.nameKey) }) : '';
    const coins = getCoins();

    view.innerHTML = `
      <section class="hero">
        <h1 class="title"><span>RETRO</span> <span class="alt">ARCADE</span></h1>
        <p class="tagline">${t('tagline')}</p>
      </section>
      ${dq.g ? `<div class="daily-bar ${dq.done ? 'done' : ''}">
        <div class="daily-left">
          <span class="daily-ico">🎯</span>
          <div>
            <div class="daily-top">
              <b>${t('dailyTitle')}</b>
              <span class="tier-tag yellow">${t('dailyReward', { pts: dq.pts })} · +${dq.coins} 🪙</span>
              ${dq.streak > 0 ? `<span class="tier-tag pink">${t('dailyStreak', { n: dq.streak })}</span>` : ''}
            </div>
            <small>${esc(dqDesc)} · <b>${dq.done ? '✔ ' + t('dailyDone') : dq.cur + '/' + dq.target}</b></small>
          </div>
        </div>
        <div class="row" style="gap:8px;align-items:center">
          <span class="tier-tag cyan" title="Arcade Coins">${t('coinsLbl', { n: coins })}</span>
          ${dq.done ? `<span class="daily-ok">✔</span>` : `<button class="px-btn small cyan" id="dqPlayBtn">▶ ${t('play')}</button>`}
        </div>
      </div>` : ''}
      <div class="menu-controls">
        <div class="tabs cat-tabs">${['all', 'board', 'arcade', 'solo'].map(c => `<button class="tab ${c === menuCat ? 'on' : ''}" data-cat="${c}">${t('cat_' + c)}</button>`).join('')}</div>
        <div class="menu-tools">
          <input id="gSearch" class="lb-search" value="${esc(menuQuery)}" placeholder="🔍 ${t('searchGamePh')}" maxlength="24" autocomplete="off">
          <button type="button" class="tab ${menuFavOnly ? 'on' : ''}" id="favOnlyBtn">${t('favOnly')}</button>
          <button type="button" class="px-btn small cyan" id="randGameBtn">${t('randGame')}</button>
        </div>
      </div>
      <section class="cards" id="menuCards"></section>`;

    function renderCards() {
      const favs = getFavs();
      const q = menuQuery.trim().toLowerCase();
      const games = Object.values(Games).filter(g => {
        if (!inCat(g)) return false;
        if (menuFavOnly && !favs.includes(g.id)) return false;
        if (q && !(t(g.nameKey).toLowerCase().includes(q) || t(g.descKey).toLowerCase().includes(q) || g.id.includes(q))) return false;
        return true;
      });
      const cardsEl = $('#menuCards');
      if (!cardsEl) return;
      cardsEl.innerHTML = games.length ? games.map((g, gi) => `
        <button class="card ${g.color}" style="--i:${gi}" data-g="${g.id}" id="card-${g.id}">
          <span class="card-fav ${favs.includes(g.id) ? 'on' : ''}" data-favg="${g.id}" role="button" tabindex="0">★</span>
          <div class="card-ico">${g.icon}</div>
          <h2>${t(g.nameKey)}</h2>
          <p>${t(g.descKey)}</p>
          <span class="card-play">▶ ${t('play')}</span>
        </button>`).join('') : `<p class="hint" style="grid-column:1/-1;text-align:center;padding:24px">${t('noGamesMatch')}</p>`;

      cardsEl.querySelectorAll('[data-favg]').forEach(s => {
        s.onclick = (e) => {
          e.stopPropagation();
          Sfx.play('click');
          toggleFav(s.dataset.favg);
          renderCards();
        };
      });
      cardsEl.querySelectorAll('.card').forEach(c => {
        c.onclick = () => {
          Sfx.play('click');
          const g = Games[c.dataset.g];
          const canOnline = !g.solo || g.id === 'wordle' || SA_GAMES.includes(g.id);
          if (g.solo && !g.diff && !canOnline) launch(g.id, { mode: 'solo' }); else screen(() => lobby(c.dataset.g));
        };
        c.addEventListener('pointermove', (e) => {
          if (!Settings.get('motion') || e.pointerType !== 'mouse') return;
          const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
          c.style.setProperty('--ry', ((x - 0.5) * 14) + 'deg'); c.style.setProperty('--rx', ((0.5 - y) * 14) + 'deg');
          c.style.setProperty('--mx', (x * 100) + '%'); c.style.setProperty('--my', (y * 100) + '%');
        });
        c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
      });
    }

    view.querySelectorAll('[data-cat]').forEach(b => b.onclick = () => {
      Sfx.play('click'); menuCat = b.dataset.cat; sessionStorage.setItem('cat', menuCat);
      view.querySelectorAll('[data-cat]').forEach(x => x.classList.toggle('on', x === b));
      renderCards();
    });
    const gSearch = $('#gSearch');
    if (gSearch) gSearch.oninput = () => { menuQuery = gSearch.value; renderCards(); };
    const favBtn = $('#favOnlyBtn');
    if (favBtn) favBtn.onclick = () => { Sfx.play('click'); menuFavOnly = !menuFavOnly; favBtn.classList.toggle('on', menuFavOnly); renderCards(); };
    const randBtn = $('#randGameBtn');
    if (randBtn) randBtn.onclick = () => {
      Sfx.play('coin');
      const pool = Object.values(Games).filter(inCat);
      const picked = pick(pool.length ? pool : Object.values(Games));
      const canOnline = !picked.solo || picked.id === 'wordle' || SA_GAMES.includes(picked.id);
      if (picked.solo && !picked.diff && !canOnline) launch(picked.id, { mode: 'solo' }); else screen(() => lobby(picked.id));
    };
    const dqBtn = $('#dqPlayBtn', view);
    if (dqBtn && dq.g) dqBtn.onclick = () => {
      Sfx.play('click');
      const canOnline = !dq.g.solo || dq.g.id === 'wordle' || SA_GAMES.includes(dq.g.id);
      if (dq.g.solo && !dq.g.diff && !canOnline) launch(dq.g.id, { mode: 'solo' }); else screen(() => lobby(dq.g.id));
    };
    renderCards();
  }

  // ---------- LOBBY ----------
  function lobby(gid) {
    leaveGame();
    const g = Games[gid], on = Supa.enabled();
    const isSA = SA_GAMES.includes(gid);
    const canOnline = !g.solo || gid === 'wordle' || isSA;
    view.innerHTML = `
      <button class="px-btn small ghost back" id="back">← ${t('back')}</button>
      <section class="lobby">
        <div class="lobby-head"><div class="card-ico big">${g.icon}</div><h1>${t(g.nameKey)}</h1></div>
        ${SIDE_GAMES.includes(gid) ? `<div class="side-pick"><span>${t('firstMove')}</span>${['w', 'b', 'r'].map(x => `<button class="tab ${sideChoice === x ? 'on' : ''}" data-side="${x}">${t('side_' + x)}</button>`).join('')}</div>` : ''}
        <div class="panels">
          <div class="panel">
            <h2>${g.solo ? '🎯 ' + t('soloPlay') : '🤖 ' + t('vsBot')}</h2>
            ${g.solo && !g.diff ? `
              <p class="hint">${t(g.descKey)}</p>
              <div class="stack"><button class="px-btn green" id="soloStart">▶ ${t('play')} Solo</button></div>
            ` : `
              <p class="hint">${t('difficulty')}</p>
              <div class="stack">
                ${gid === 'hangman' ? `<button class="px-btn cyan" data-d="normal">${t('play')}</button>` :
                  ['easy', 'normal', 'hard'].map((d, i) => `<button class="px-btn ${['green', 'yellow', 'pink'][i]}" data-d="${d}">${t(d)}</button>`).join('')}
              </div>
            `}
          </div>
          ${!canOnline ? '' : `<div class="panel">
            <h2>${isSA ? '⚔ ' + t('scoreAttackBtn') : '👥 ' + t('online')}</h2>
            ${isSA ? `<small class="hint" style="display:block;margin-bottom:8px">${t('saHint')}</small>` : ''}
            ${on ? `
              <label class="pub-chk"><input type="checkbox" id="pubRoomChk" checked> ${t('publicRoomToggle')}</label>
              <button class="px-btn cyan wide" id="mk">${t('createRoom')}</button>
              <div class="open-rooms-box">
                <small class="hint">${t('openRooms')}</small>
                <div id="openRooms" class="open-rooms"><small class="hint">${t('noOpenRooms')}</small></div>
              </div>
              <p class="hint">${t('joinRoom')}</p>
              <div class="join-row"><input id="code" maxlength="5" placeholder="${t('roomCode')}" autocomplete="off"><button class="px-btn pink" id="jn">${t('join')}</button></div>
            ` : `<p class="hint">${t('onlineOff')}</p>`}
          </div>`}
        </div>
      </section>`;
    $('#back').onclick = () => { Sfx.play('click'); screen(menu); };
    view.querySelectorAll('[data-side]').forEach(b => b.onclick = () => { Sfx.play('click'); sideChoice = b.dataset.side; sessionStorage.setItem('side', sideChoice); view.querySelectorAll('[data-side]').forEach(x => x.classList.toggle('on', x === b)); });
    const soloStart = $('#soloStart');
    if (soloStart) soloStart.onclick = () => { Sfx.play('click'); launch(gid, { mode: 'solo' }); };
    view.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { Sfx.play('click'); launch(gid, { mode: g.solo ? 'solo' : 'bot', difficulty: b.dataset.d, first: resolveFirst() }); });
    if (on && canOnline) {
      $('#mk').onclick = () => { Sfx.play('click'); hostRoom(gid, $('#pubRoomChk') ? $('#pubRoomChk').checked : false); };
      const join = () => { const c = $('#code').value.trim().toUpperCase(); if (c.length >= 4) { Sfx.play('click'); joinRoom(gid, c); } };
      $('#jn').onclick = join;
      $('#code').onkeydown = (e) => { if (e.key === 'Enter') join(); };
      $('#code').oninput = (e) => { e.target.value = e.target.value.toUpperCase(); };
      if (Net.watchLobby) {
        Net.watchLobby(gid, (rooms) => {
          const box = $('#openRooms', view); if (!box) return;
          if (!rooms || !rooms.length) { box.innerHTML = `<small class="hint">${t('noOpenRooms')}</small>`; return; }
          box.innerHTML = rooms.slice(0, 6).map(r => `<div class="or-item">
            <span>${r.avatar || '👾'} <b>${esc(r.nick || 'Player')}</b> <small class="or-code">${esc(r.code)}</small></span>
            <button type="button" class="px-btn small green" data-qjoin="${esc(r.code)}">${t('joinQuick')}</button>
          </div>`).join('');
          box.querySelectorAll('[data-qjoin]').forEach(b => b.onclick = () => { Sfx.play('click'); joinRoom(gid, b.dataset.qjoin); });
        });
      }
    }
  }

  function netCallbacks(gid, role, hostFirst) {
    return {
      ready: (opp) => {
        if (Net.leaveLobby) Net.leaveLobby();
        if (Net.unwatchLobby) Net.unwatchLobby();
        launch(gid, { mode: 'online', role, opp, first: role === 'host' ? hostFirst : !opp.first });
      },
      left: () => { if (onLeft) onLeft(); },
      error: (key) => {
        toast(t(key));
        if (Net.leaveLobby) Net.leaveLobby();
        Net.leave();
        screen(() => lobby(gid));
      }
    };
  }
  function hostRoom(gid, isPublic = false, autoInviteUid = null) {
    const code = Net.genCode(), hostFirst = resolveFirst();
    screen(() => {
      view.innerHTML = `
        <section class="lobby wait">
          <h1>${t('waiting')}</h1>
          <p class="hint">${t('shareCode')}</p>
          <div class="bigcode" id="bigcode">${code}</div>
          <div class="loader"><i></i><i></i><i></i></div>
          <div class="row"><button class="px-btn small" id="cp">${t('copy')}</button>
          <button class="px-btn small ghost" id="cn">${t('cancel')}</button></div>
          <div id="inv" class="invite-box"></div>
        </section>`;
      $('#cp').onclick = () => { navigator.clipboard && navigator.clipboard.writeText(code); toast(t('copied')); };
      loadInvites(gid, code);
      $('#cn').onclick = () => { if (Net.leaveLobby) Net.leaveLobby(); Net.leave(); screen(() => lobby(gid)); };
    });
    Net.connect(code, gid, 'host', nickName(), netCallbacks(gid, 'host', hostFirst), { first: hostFirst });
    if (isPublic && Net.hostLobby) {
      const me = Supa.user();
      Net.hostLobby({ code, game: gid, nick: nickName(), avatar: (me && me.avatar) || '👾' });
    }
    if (autoInviteUid) {
      setTimeout(() => { Social.invite(autoInviteUid, gid, code); toast(t('invited')); Sfx.play('good'); }, 350);
    }
  }
  function joinRoom(gid, code) {
    if (Net.unwatchLobby) Net.unwatchLobby();
    Net.connect(code, gid, 'guest', nickName(), netCallbacks(gid, 'guest'));
    screen(() => {
      view.innerHTML = `<section class="lobby wait"><h1>${code}</h1><div class="loader"><i></i><i></i><i></i></div>
        <button class="px-btn small ghost" id="cn">${t('cancel')}</button></section>`;
      $('#cn').onclick = () => { Net.leave(); screen(() => lobby(gid)); };
    });
  }

  // ---------- GAME ----------
  const EMOTES = ['👋', '😎', '🔥', '😂', '👏', '🤔', 'GG!'];
  function showEmoteBubble(who, emo, mine) {
    const box = $('#emoteFeed') || $('#toasts');
    if (!box) return;
    const d = document.createElement('div');
    d.className = 'emote-pop ' + (mine ? 'me' : 'opp');
    d.innerHTML = `<small>${esc(who)}:</small> <b>${esc(emo)}</b>`;
    box.appendChild(d);
    Sfx.play('click');
    setTimeout(() => d.remove(), 3200);
  }

  function launch(gid, opts) {
    const g = Games[gid];
    if (saTimer) { clearInterval(saTimer); saTimer = null; }
    if (current && current.destroy) current.destroy();
    tok++; currentScreen = '';
    const isSA = opts.mode === 'online' && SA_GAMES.includes(gid);
    const lobbyGo = () => {
      leaveGame();
      const canOnline = !g.solo || g.id === 'wordle' || SA_GAMES.includes(g.id);
      screen(g.solo && !g.diff && !canOnline ? menu : () => lobby(gid));
    };
    rerender = null;
    const myPrefs = Supa.myPrefs ? Supa.myPrefs() : {};
    const skins = myPrefs.skins || {};
    const skinCls = [skins.all || '', skins[gid] || ''].filter(Boolean).join(' ');

    view.innerHTML = `
      <div class="game-head">
        <button class="px-btn small ghost" id="quit">← ${t('back')}</button>
        <h1>${t(g.nameKey)}</h1>
        <span class="vs">${opts.mode === 'solo' ? (opts.difficulty ? `🎯 ${t(opts.difficulty)}` : '') : opts.mode === 'online' ? `${t('you')}: ${nickName()} ⚔ ${(opts.opp && opts.opp.nick) || t('opponent')}` : `🤖 ${t(opts.difficulty)}`}</span>
      </div>
      ${opts.mode === 'online' ? `<div class="emote-bar">
        <small class="hint">${t('quickChat')}</small>
        ${EMOTES.map(e => `<button type="button" class="emote-btn" data-emo="${e}">${e}</button>`).join('')}
        <div id="emoteFeed" class="emote-feed"></div>
      </div>` : ''}
      ${isSA ? `<div class="sa-hud" id="saHud">
        <span class="tier-tag yellow" id="saTimeEl">${t('saTime', { s: 90 })}</span>
        <span>${t('you')}: <b id="saMeEl">0</b></span>
        <span>${esc((opts.opp && opts.opp.nick) || t('opponent'))}: <b id="saOppEl">0</b></span>
        <small class="hint" id="saStatEl"></small>
      </div>` : ''}
      <div id="stage" class="stage ${skinCls}"></div>`;
    view.classList.remove('fade'); void view.offsetWidth; view.classList.add('fade');
    $('#quit').onclick = () => { Sfx.play('click'); lobbyGo(); }; wipe();
    if (opts.mode === 'online') {
      let lastEmo = 0;
      view.querySelectorAll('[data-emo]').forEach(b => b.onclick = () => {
        const now = Date.now(); if (now - lastEmo < 900) return; lastEmo = now;
        const emo = b.dataset.emo;
        Net.sendChat(emo, nickName());
        showEmoteBubble(t('you'), emo, true);
      });
      Net.onChat = (p) => {
        if (p && p.emo) showEmoteBubble(p.nick || (opts.opp && opts.opp.nick) || t('opponent'), String(p.emo).slice(0, 8), false);
      };
    }
    onLeft = () => {
      if (saTimer) { clearInterval(saTimer); saTimer = null; }
      const o = document.createElement('div'); o.className = 'overlay';
      o.innerHTML = `<div class="dlg-box"><h2>${t('oppLeft')}</h2><button class="px-btn pink" id="ol">${t('toLobby')}</button></div>`;
      view.appendChild(o); Sfx.play('lose'); $('#ol').onclick = lobbyGo;
    };

    const stage = $('#stage');
    if (isSA) {
      let left = 90, meSc = 0, oppSc = 0, meDone = false, oppDone = false, resolved = false;
      const tEl = $('#saTimeEl'), mEl = $('#saMeEl'), oEl = $('#saOppEl'), sEl = $('#saStatEl');
      const readLive = () => {
        const el = stage.querySelector('#sc, #iv-sc, #pm-sc');
        return el ? Math.max(meSc, parseInt(el.textContent, 10) || 0) : meSc;
      };
      const resolveSA = () => {
        if (resolved) return;
        resolved = true;
        if (saTimer) { clearInterval(saTimer); saTimer = null; }
        meSc = readLive();
        if (current && current.destroy) { current.destroy(); current = null; }
        const r = meSc > oppSc ? 'win' : meSc < oppSc ? 'lose' : 'draw';
        Sfx.play(r);
        const ov = document.createElement('div'); ov.className = 'overlay';
        ov.innerHTML = `<div class="dlg-box"><h2>${t(r)}</h2>
          <p class="hint">${esc(nickName())}: <b>${meSc}</b> ⚔ ${esc((opts.opp && opts.opp.nick) || t('opponent'))}: <b>${oppSc}</b></p>
          <button class="px-btn pink" id="saBack">${t('toLobby')}</button></div>`;
        view.appendChild(ov);
        $('#saBack', ov).onclick = lobbyGo;
        finish(gid, 'online', null, r, meSc);
      };
      Net.setHandler((m) => {
        if (!m || resolved) return;
        if (m.kind === 'sa_upd') { oppSc = Math.max(oppSc, Number(m.val) || 0); if (oEl) oEl.textContent = oppSc; }
        if (m.kind === 'sa_done') {
          oppSc = Math.max(oppSc, Number(m.val) || 0);
          if (oEl) oEl.textContent = oppSc;
          oppDone = true;
          if (meDone) resolveSA();
        }
      });
      let sub = 0;
      saTimer = setInterval(() => {
        if (resolved) return;
        const cur = readLive();
        if (cur !== meSc) {
          meSc = cur;
          if (mEl) mEl.textContent = meSc;
          Net.send({ kind: 'sa_upd', val: meSc });
        }
        if (++sub >= 2) {
          sub = 0;
          left = Math.max(0, left - 1);
          if (tEl) tEl.textContent = t('saTime', { s: left });
          if (left <= 0) {
            Net.send({ kind: 'sa_done', val: meSc });
            resolveSA();
          }
        }
      }, 500);
      const ctx = {
        mode: 'solo', difficulty: opts.difficulty, role: opts.role, first: opts.first, t, net: null, sfx: Sfx, me: nickName(), opp: opts.opp && opts.opp.nick,
        finish: (res, value) => {
          meSc = Math.max(meSc, Number(value) || 0);
          if (mEl) mEl.textContent = meSc;
          meDone = true;
          Net.send({ kind: 'sa_done', val: meSc });
          if (oppDone) resolveSA();
          else if (sEl) sEl.textContent = t('saWait');
        }
      };
      current = g.start(stage, ctx);
    } else {
      const ctx = {
        mode: opts.mode, difficulty: opts.difficulty, role: opts.role, first: opts.first, t, net: Net, sfx: Sfx, me: nickName(), opp: opts.opp && opts.opp.nick,
        finish: (res, value) => finish(gid, opts.mode, opts.difficulty, res, value)
      };
      current = g.start(stage, ctx);
    }
  }

  function syncKnownBadges(uid, badgeList) {
    if (!uid || !badgeList) return;
    const k = 'known_bdg_' + uid;
    try {
      const cur = badgeList.filter(b => b.ok).map(b => b.id);
      localStorage.setItem(k, JSON.stringify(cur));
    } catch (e) {}
  }

  async function checkNewBadges() {
    const me = Supa.user(); if (!me || !window.ProfileConfig) return;
    const k = 'known_bdg_' + me.id;
    let known = null;
    try { const raw = localStorage.getItem(k); if (raw) known = JSON.parse(raw); } catch (e) {}
    const [rows, uStats, hs, prof] = await Promise.all([Supa.leaderboard(), Supa.userStats(me.id, me.nick), Supa.highscores(), Supa.getProfile(me.nick)]);
    const bestMap = {};
    (hs || []).filter(h => (h.user_id ? h.user_id === me.id : h.nick === me.nick) && h.best != null).forEach(h => { bestMap[h.game] = h.best; });
    (uStats || []).filter(s => s.best != null).forEach(s => { bestMap[s.game] = s.best; });
    const st = Object.values(Games).map(g => {
      const us = (uStats || []).find(x => x.game === g.id);
      const r = us || (rows || []).find(x => (x.user_id ? x.user_id === me.id : x.nick === me.nick) && x.game === g.id) || {};
      return { g, games: r.games || 0, wins: r.wins || 0, losses: r.losses || 0, draws: r.draws || 0, points: r.points || 0, best: bestMap[g.id] };
    });
    const bonusPts = prof ? (prof.points || prof.bonus_points || 0) : 0;
    const tot = st.reduce((a, s) => ({ games: a.games + s.games, wins: a.wins + s.wins, points: a.points + s.points }), { games: 0, wins: 0, points: bonusPts });
    const winRate = tot.games ? Math.round(tot.wins * 100 / tot.games) : 0;
    const list = ProfileConfig.evaluate(st, tot, winRate, null);
    const unlocked = list.filter(b => b.ok);
    if (known) {
      unlocked.filter(b => !known.includes(b.id)).forEach(b => {
        const d = document.createElement('div'); d.className = 'toast ach-toast';
        d.innerHTML = `<span>🏅 ${b.ico} <b>${esc(t('achUnlockedToast', { name: t('bdg_' + b.id) }))}</b></span>`;
        $('#toasts').appendChild(d);
        Sfx.play('win');
        if (window.Fx && Fx.confetti) Fx.confetti();
        setTimeout(() => d.remove(), 6000);
      });
    }
    syncKnownBadges(me.id, list);
  }

  async function finish(gid, mode, diff, res, value) {
    if (window.Fx) Fx.result(res);
    let earnedCoins = (res === 'win') ? 15 : 5;
    // Sprawdź Codzienne Wyzwanie + Daily Streak
    const dq = getDailyQuest();
    if (!dq.done && dq.gid === gid && (dq.type === 'play' || (dq.type === 'win' && res === 'win'))) {
      const nextCur = dq.cur + 1;
      const done = nextCur >= dq.target;
      try { localStorage.setItem(dq.storeKey, JSON.stringify({ cur: nextCur, done })); } catch (e) {}
      if (done) {
        const nextStreak = dq.lastDay === dq.yKey ? (dq.streak + 1) : (dq.lastDay === dq.key ? Math.max(1, dq.streak) : 1);
        try { localStorage.setItem(dq.streakKey, JSON.stringify({ streak: nextStreak, lastDay: dq.key })); } catch (e) {}
        const ptsAward = 3 + (nextStreak >= 3 ? 2 : 0);
        earnedCoins += dq.coins;
        if (Supa.user() && Supa.addBonusPoints) await Supa.addBonusPoints(ptsAward);
        toast('🎯 ' + t('dailyToast', { pts: ptsAward }) + ` · +${dq.coins} 🪙`, 5000);
        Sfx.play('win');
      }
    }
    if (Supa.user()) {
      const pts = await Supa.score(gid, mode, res, diff, value);
      if (pts === null) toast(t('scoreFail'));
      else if (pts > 0) toast(`+${pts} ${t('pts')} · +${earnedCoins} 🪙`);
      else toast(`+${earnedCoins} 🪙`);
      await addCoins(earnedCoins);
      checkNewBadges();
    } else {
      await addCoins(earnedCoins);
      if (res === 'win' && !scoreHintShown && Supa.enabled()) { scoreHintShown = true; toast(t('loginForScore')); }
    }
  }
  // ---------- LEADERBOARD ----------
  let lbPeriod = 'season';
  function fmtCountdown(msLeft) {
    const s = Math.max(0, Math.floor(msLeft / 1000));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    const dUnit = I18N.lang === 'pl' ? 'd' : 'd';
    const hUnit = I18N.lang === 'pl' ? 'g' : 'h';
    return `${d}${dUnit} ${pad(h)}${hUnit} ${pad(m)}m ${pad(sec)}s`;
  }

  async function leaderboard(tab = 'all') {
    leaveGame(); currentScreen = 'lb'; const my = tok;
    rerender = () => leaderboard(tab);
    view.innerHTML = `<button class="px-btn small ghost back" id="back">← ${t('back')}</button>
      <section class="lb"><h1>🏆 ${t('leaderboard')}</h1><div id="lbBody" class="lb-body"><div class="loader"><i></i><i></i><i></i></div></div></section>`;
    $('#back').onclick = () => screen(menu);
    const body = $('#lbBody');
    if (!Supa.enabled()) { body.innerHTML = `<p class="hint">${t('lbOff')}</p>`; return; }
    const [rows, hs] = await Promise.all([
      Supa.leaderboard(lbPeriod === 'records' ? 'all' : lbPeriod),
      (lbPeriod === 'records' || (Games[tab] && Games[tab].solo)) ? Supa.highscores() : []
    ]);
    if (my !== tok) return;
    if (!rows) { body.innerHTML = `<p class="hint">${t('lbErr')}</p>`; return; }

    const periodTabsHtml = `<div class="tabs period">
      <button class="tab ${lbPeriod === 'season' ? 'on' : ''}" data-p="season">${t('lbSeason2w')}</button>
      <button class="tab ${lbPeriod === 'month' ? 'on' : ''}" data-p="month">${t('lbMonth')}</button>
      <button class="tab ${lbPeriod === 'all' ? 'on' : ''}" data-p="all">🏛 ${t('lbAllTime')}</button>
      <button class="tab ${lbPeriod === 'records' ? 'on' : ''}" data-p="records">${t('lbRecords')}</button>
    </div>`;

    if (lbPeriod === 'records') {
      const avMap = {};
      (rows || []).forEach(r => { if (r.user_id) avMap[r.user_id] = { av: r.avatar, nick: r.nick }; });
      const soloGames = Object.values(Games).filter(g => g.solo);
      const cardsHtml = soloGames.map(g => {
        const isTime = g.id === 'mines' || g.id === 'memory';
        const cand = (hs || []).filter(h => h.game === g.id && h.best != null && h.best > 0);
        cand.sort((a, b) => isTime ? a.best - b.best : b.best - a.best);
        const top = cand[0];
        const info = top && (avMap[top.user_id] || {});
        const val = top ? (isTime ? top.best + 's' : top.best) : null;
        return `<div class="panel rec-card">
          <div class="rec-card-head"><span class="rec-ico">${g.icon}</span><b>${t(g.nameKey)}</b></div>
          ${top ? `<div class="rec-holder">
            <span class="avatar">${info.av || '👾'}</span>
            <button class="nick-link" data-nick="${esc(info.nick || top.nick)}">${esc(info.nick || top.nick)}</button>
            ${ownerBadgeHtml(top.user_id)}
          </div>
          <div class="rec-score">🏆 <b>${val}</b></div>` : `<small class="hint">${t('noRecordYet')}</small>`}
        </div>`;
      }).join('');
      body.innerHTML = `
        <div class="panel lb-season-panel">
          <div class="lb-season-top">
            <div class="lb-season-badge">🏅 ${t('lbRecordsHead')}</div>
            ${periodTabsHtml}
          </div>
        </div>
        <div class="rec-grid">${cardsHtml}</div>`;
      body.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { Sfx.play('click'); lbPeriod = b.dataset.p; leaderboard(tab); });
      bindNicks(body);
      return;
    }

    const tabs = ['all', ...Object.keys(Games)];
    const agg = {};
    rows.filter(r => tab === 'all' || r.game === tab || (tab === 'all' && r.game === 'bonus')).forEach(r => {
      if (tab !== 'all' && r.game === 'bonus') return;
      const key = r.user_id || r.nick;
      const a = agg[key] || (agg[key] = { id: key, user_id: r.user_id, nick: r.nick, avatar: r.avatar, prefs: r.prefs || {}, points: 0, wins: 0, games: 0 });
      if (r.prefs && Object.keys(r.prefs).length) a.prefs = r.prefs;
      a.points += r.points; a.wins += r.wins; a.games += r.games;
    });
    const best = {}; (hs || []).filter(h => h.game === tab && h.best != null).forEach(h => best[h.user_id || h.nick] = h.best);
    const showBest = Games[tab] && Games[tab].solo;
    const all = Object.values(agg).filter(a => a.games > 0 || a.points > 0).sort((a, b) => b.points - a.points || b.wins - a.wins || a.games - b.games);
    all.forEach((a, i) => a.rank = i + 1);
    const me = Supa.user(), mine = me && all.find(a => a.user_id === me.id || a.nick === me.nick);
    const fmtBest = (id) => best[id] == null ? '–' : (['mines', 'memory'].includes(tab) ? best[id] + 's' : best[id]);

    const bounds = Supa.seasonBounds ? Supa.seasonBounds(lbPeriod) : { period: lbPeriod };
    const hasReset = bounds.endMs != null;
    const seasonTitle = lbPeriod === 'season'
      ? t('lbSeasonHead', { num: bounds.seasonNum || 1 })
      : lbPeriod === 'month'
        ? t('lbMonthHead', { num: bounds.seasonNum || 1 })
        : t('lbAllHead');
    const seasonElapsedPct = hasReset ? Math.min(100, Math.max(0, Math.round((Date.now() - bounds.startMs) * 100 / (bounds.endMs - bounds.startMs)))) : 100;

    // Podium Top 3
    const top3 = all.slice(0, 3);
    const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
    const podiumHtml = top3.length ? `<div class="lb-podium">
      ${podiumOrder.map(p => {
        const wr = p.games ? Math.round(p.wins * 100 / p.games) : 0;
        const medal = ['🥇', '🥈', '🥉'][p.rank - 1];
        return `<div class="lb-pod rank-${p.rank}">
          <div class="pod-medal">${medal} #${p.rank}</div>
          <div class="pod-av">${p.avatar || '👾'}</div>
          <div class="pod-name-row"><button class="nick-link pod-nick" data-nick="${esc(p.nick)}">${esc(p.nick)}</button>${ownerBadgeHtml(p.user_id)}</div>
          <div class="pod-pins">${pinnedMiniHtml(p.prefs)}</div>
          <span class="lvl">Lv ${Math.floor(Math.sqrt(p.points))}</span>
          <div class="pod-pts"><b>${p.points}</b> <small>${t('pts')}</small></div>
          <small class="hint">${p.wins}/${p.games} (${wr}%)</small>
        </div>`;
      }).join('')}
    </div>` : '';

    // Twoja karta pozycji
    let myCardHtml = '';
    if (mine) {
      const above = mine.rank > 1 ? all[mine.rank - 2] : null;
      const needPts = above ? Math.max(1, above.points - mine.points + 1) : 0;
      const wr = mine.games ? Math.round(mine.wins * 100 / mine.games) : 0;
      myCardHtml = `<div class="lb-my-card">
        <div class="lb-my-left">
          <span class="lb-my-rank">#${mine.rank}</span>
          <div>
            <b>${mine.avatar || '👾'} ${esc(mine.nick)} ${ownerBadgeHtml(mine.user_id)} ${pinnedMiniHtml(mine.prefs)} <span class="lvl">Lv ${Math.floor(Math.sqrt(mine.points))}</span></b>
            <small class="hint">${above ? t('lbToNext', { rank: above.rank, pts: needPts }) : t('lbYouLead')}</small>
          </div>
        </div>
        <div class="lb-my-kpis">
          <div><small>${t('lbPts')}</small><b>${mine.points}</b></div>
          <div><small>${t('lbWins')}</small><b>${mine.wins}</b></div>
          <div><small>${t('lbWinRate')}</small><b>${wr}%</b></div>
        </div>
      </div>`;
    }

    const renderRow = (r) => {
      const wr = r.games ? Math.round(r.wins * 100 / r.games) : 0;
      return `<tr class="${me && (r.user_id === me.id || r.nick === me.nick) ? 'me' : ''} ${r.rank <= 3 ? 'top-' + r.rank : ''}">
        <td><span class="rk-badge rk-${r.rank}">${['🥇', '🥈', '🥉'][r.rank - 1] || '#' + r.rank}</span></td>
        <td><button class="nick-link" data-nick="${esc(r.nick)}">${r.avatar || '👾'} ${esc(r.nick)}</button> ${ownerBadgeHtml(r.user_id)} ${pinnedMiniHtml(r.prefs)} <span class="lvl">Lv ${Math.floor(Math.sqrt(r.points))}</span></td>
        <td><b class="pts-val">${r.points}</b></td>
        ${showBest ? `<td>${fmtBest(r.id)}</td>` : ''}
        <td>${r.wins}</td>
        <td>${r.games}</td>
        <td><div class="wr-cell"><span>${wr}%</span><i class="wr-bar"><b style="width:${wr}%"></b></i></div></td>
      </tr>`;
    };

    let list = all.slice(0, 50);
    if (mine && mine.rank > 50) list = list.concat(mine);

    body.innerHTML = `
      <div class="panel lb-season-panel">
        <div class="lb-season-top">
          <div>
            <div class="lb-season-badge">🏆 ${esc(seasonTitle)}</div>
            ${hasReset
              ? `<div class="lb-countdown">⏳ ${t('lbResetIn')} <b id="lbTimerVal">${fmtCountdown(bounds.endMs - Date.now())}</b></div>`
              : `<small class="hint">${t('lbNoReset')}</small>`}
          </div>
          ${periodTabsHtml}
        </div>
        ${hasReset ? `<div class="lb-season-bar"><i style="width:${seasonElapsedPct}%"></i></div>` : ''}
      </div>

      <div class="lb-filters-row">
        <div class="tabs lb-game-tabs">${tabs.map(x => `<button class="tab ${x === tab ? 'on' : ''}" data-t="${x}">${x === 'all' ? t('lbAll') : t(Games[x].nameKey)}</button>`).join('')}</div>
        <input id="lbSearch" class="lb-search" placeholder="🔍 ${t('lbSearchPh')}" maxlength="16" autocomplete="off">
      </div>

      ${all.length ? `
        ${podiumHtml}
        ${myCardHtml}
        <div class="panel lb-table-wrap">
          <table class="lb-table"><thead><tr><th>#</th><th>${t('lbPlayer')}</th><th>${t('lbPts')}</th>${showBest ? `<th>${t('lbBest')}</th>` : ''}<th>${t('lbWins')}</th><th>${t('lbGames')}</th><th>${t('lbWinRate')}</th></tr></thead>
          <tbody id="lbTbody">${list.map(renderRow).join('')}</tbody></table>
        </div>` : `<div class="panel"><p class="hint">${t('lbEmpty')}</p></div>`}
      <p class="hint lb-note">${t('lbRules')}</p>`;

    if (hasReset) {
      lbTimer = setInterval(() => {
        const el = $('#lbTimerVal', body);
        if (!el) { clearInterval(lbTimer); lbTimer = null; return; }
        const left = bounds.endMs - Date.now();
        if (left <= 0) { clearInterval(lbTimer); lbTimer = null; leaderboard(tab); return; }
        el.textContent = fmtCountdown(left);
      }, 1000);
    }

    const searchIn = $('#lbSearch', body), tbody = $('#lbTbody', body);
    if (searchIn && tbody) {
      searchIn.oninput = () => {
        const q = searchIn.value.trim().toLowerCase();
        const filtered = q ? all.filter(r => (r.nick || '').toLowerCase().includes(q)) : list;
        tbody.innerHTML = filtered.length ? filtered.map(renderRow).join('') : `<tr><td colspan="${showBest ? 7 : 6}" class="hint">${t('noResults')}</td></tr>`;
        bindNicks(tbody);
      };
    }

    body.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { Sfx.play('click'); leaderboard(b.dataset.t); });
    body.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { Sfx.play('click'); lbPeriod = b.dataset.p; leaderboard(tab); });
    bindNicks(body);
  } const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- PROFILE / FRIENDS ----------
  const AVATARS = (window.ProfileConfig && ProfileConfig.AVATARS) || ['👾', '🤖', '👻', '🐱', '🐸', '🦊', '🐉', '🚀', '🎮', '💀', '🦄', '🐙'];
  const FRAMES = (window.ProfileConfig && ProfileConfig.FRAMES) || [{ id: '', minLvl: 0 }];
  const TITLES = (window.ProfileConfig && ProfileConfig.TITLES) || [''];
  const fmtDate = (d) => new Date(d).toLocaleDateString(I18N.lang === 'pl' ? 'pl-PL' : 'en-GB');
  const loaderHtml = '<div class="loader"><i></i><i></i><i></i></div>';
  const backBtn = () => `<button class="px-btn small ghost back" id="back">← ${t('back')}</button>`;
  function bindNicks(root) {
    root.querySelectorAll('.nick-link').forEach(b => b.onclick = () => { Sfx.play('click'); profile(b.dataset.nick); });
  }
  const friendRow = (p, actions) => `<div class="fr-item"><span class="avatar">${p.avatar}</span>
    <button class="nick-link" data-nick="${esc(p.nick)}">${esc(p.nick)}</button>${ownerBadgeHtml(p.user_id)}
    <span class="dot ${Social.isOnline(p.user_id) ? 'on' : ''}"></span><small class="hint">${t(Social.isOnline(p.user_id) ? 'isOnline' : 'isOffline')}</small>
    <span class="fr-actions">${actions}</span></div>`;

  async function profile(nick, openEdit = false, openBadges = false) {
    leaveGame(); currentScreen = 'profile'; rerender = () => profile(nick, editOpen, badgesOpen);
    let editOpen = !!openEdit, badgesOpen = !!openBadges, compareOpen = false, invPickerOpen = false;
    let compareData = null;
    let recFilter = 'all', statFilter = 'vis';
    const my = tok;
    view.innerHTML = `${backBtn()}<section class="prof">${loaderHtml}</section>`;
    $('#back').onclick = () => screen(menu);
    const box = $('.prof');
    if (!Supa.enabled()) { box.innerHTML = `<p class="hint">${t('lbOff')}</p>`; return; }
    const p = await Supa.getProfile(nick);
    if (my !== tok) return;
    if (!p) { box.innerHTML = `<p class="hint">${t('notFound')}</p>`; return; }
    const me = Supa.user(), mine = !!me && me.id === p.user_id;
    const isTargetOwner = isOwnerUser(p.user_id);
    const [rows, uStats, hs, recent, rels] = await Promise.all([
      Supa.leaderboard(), Supa.userStats(p.user_id, p.nick), Supa.highscores(), Supa.recent(p.user_id), (me && !mine) ? Supa.friendsOverview() : []
    ]);
    if (my !== tok) return;

    const rawPrefs = (p && p.prefs && typeof p.prefs === 'object') ? p.prefs : {};
    const prefs = {
      title: rawPrefs.title || '',
      frame: rawPrefs.frame || '',
      favGame: rawPrefs.favGame || '',
      showStats: rawPrefs.showStats !== false,
      showRecords: rawPrefs.showRecords !== false,
      showBadges: rawPrefs.showBadges !== false,
      showRecent: rawPrefs.showRecent !== false,
      onlyPlayed: !!rawPrefs.onlyPlayed,
      hiddenGames: Array.isArray(rawPrefs.hiddenGames) ? [...rawPrefs.hiddenGames] : [],
      pinnedBadges: Array.isArray(rawPrefs.pinnedBadges) ? [...rawPrefs.pinnedBadges].slice(0, 3) : [],
      unlockedShop: Array.isArray(rawPrefs.unlockedShop) ? [...rawPrefs.unlockedShop] : [],
      skins: (rawPrefs.skins && typeof rawPrefs.skins === 'object') ? { ...rawPrefs.skins } : {},
      coins: Number(rawPrefs.coins) || 0
    };

    const bestMap = {};
    (hs || []).filter(h => (h.user_id ? h.user_id === p.user_id : h.nick === p.nick) && h.best != null).forEach(h => { bestMap[h.game] = h.best; });
    (uStats || []).filter(s => s.best != null).forEach(s => { bestMap[s.game] = s.best; });
    const st = Object.values(Games).map(g => {
      const us = (uStats || []).find(x => x.game === g.id);
      const r = us || (rows || []).find(x => (x.user_id ? x.user_id === p.user_id : x.nick === p.nick) && x.game === g.id) || {};
      return { g, games: r.games || 0, wins: r.wins || 0, losses: r.losses || 0, draws: r.draws || 0, points: r.points || 0, best: bestMap[g.id] };
    });
    const tot = st.reduce((a, s) => ({ games: a.games + s.games, wins: a.wins + s.wins, points: a.points + s.points }), { games: 0, wins: 0, points: (p.points || p.bonus_points || 0) });
    const winRate = tot.games ? Math.round(tot.wins * 100 / tot.games) : 0;

    // Rozszerzone statystyki z ostatnich gier: seria wygranych + ulubiony tryb
    let winStreak = 0;
    for (const r of (recent || [])) { if (r.result === 'win') winStreak++; else break; }
    const mCounts = { online: 0, bot: 0, solo: 0 };
    (recent || []).forEach(r => { if (mCounts[r.mode] !== undefined) mCounts[r.mode]++; });
    const topMode = Object.entries(mCounts).sort((a, b) => b[1] - a[1])[0];
    const favModeTxt = topMode && topMode[1] > 0 ? ({ online: 'Online', bot: 'Bot', solo: 'Solo' }[topMode[0]]) : '–';

    // Miejsce w rankingu ogólnym
    const rankAgg = {};
    (rows || []).forEach(r => {
      const k = r.user_id || r.nick;
      const a = rankAgg[k] || (rankAgg[k] = { id: k, user_id: r.user_id, nick: r.nick, points: 0, wins: 0, games: 0 });
      a.points += r.points; a.wins += r.wins; a.games += r.games;
    });
    const sortedRank = Object.values(rankAgg).filter(a => a.games > 0 || a.points > 0).sort((a, b) => b.points - a.points || b.wins - a.wins || a.games - b.games);
    const myRankIdx = sortedRank.findIndex(a => (a.user_id && a.user_id === p.user_id) || a.nick === p.nick);
    const rankNum = myRankIdx >= 0 ? myRankIdx + 1 : null;

    // Poziom i pasek XP
    const lvl = Math.floor(Math.sqrt(tot.points));
    const prevPts = lvl * lvl, nextPts = (lvl + 1) * (lvl + 1);
    const xpPct = nextPts > prevPts ? Math.min(100, Math.round((tot.points - prevPts) * 100 / (nextPts - prevPts))) : 0;

    // Odznaki (konfiguracja w js/badges.js) + % odblokowania wśród wszystkich graczy
    const globalRates = window.ProfileConfig && ProfileConfig.computeGlobalRates ? ProfileConfig.computeGlobalRates(rows).rates : {};
    const badgeList = window.ProfileConfig ? ProfileConfig.evaluate(st, tot, winRate, rankNum, globalRates) : [];
    if (mine) syncKnownBadges(p.user_id, badgeList);

    const shopItems = (window.ProfileConfig && ProfileConfig.SHOP_ITEMS) || [];
    const shopAvatars = shopItems.filter(i => i.type === 'avatar' && prefs.unlockedShop.includes(i.id)).map(i => i.val);
    const allAvatars = [...new Set([...AVATARS, ...shopAvatars])];
    const availFrames = FRAMES.filter(f => !f.ownerOnly || isTargetOwner);
    const titlesMeta = (window.ProfileConfig && ProfileConfig.TITLES_META) || [];
    const availTitles = ['', ...titlesMeta.filter(tm => !tm.ownerOnly || isTargetOwner).map(tm => tm.id)];
    const ownedSkins = shopItems.filter(i => i.type === 'skin' && prefs.unlockedShop.includes(i.id));
    const unlockedBadges = badgeList.filter(b => b.ok);

    const rel = rels.find(r => r.profile.user_id === p.user_id);
    let action = '';
    if (me && !mine) {
      if (!rel) action = `<button class="px-btn pink" id="pAct">${t('addFriend')}</button>`;
      else if (rel.status === 'pending' && !rel.incoming) action = `<button class="px-btn ghost" id="pAct">${t('reqSent')} · ${t('cancelReq')}</button>`;
      else if (rel.status === 'pending') action = `<button class="px-btn green" id="pAct">${t('accept')}</button>`;
      else action = `<span class="hint">✔ ${t('friendOk')}</span> <button class="px-btn small ghost" id="pAct">${t('removeFriend')}</button>`;
    }
    let chosen = p.avatar;

    const getFavGame = () => {
      if (prefs.favGame && Games[prefs.favGame]) return Games[prefs.favGame];
      const top = [...st].sort((a, b) => b.games - a.games || b.points - a.points)[0];
      return top && top.games > 0 ? top.g : null;
    };
    const fmtBestVal = (gid, val) => val == null ? '–' : (['mines', 'memory'].includes(gid) ? val + 's' : val);

    async function loadCompare() {
      if (!me || compareData) return;
      const [mp, ms] = await Promise.all([Supa.getProfile(me.nick), Supa.userStats(me.id, me.nick)]);
      const mBonus = (mp && (mp.points || mp.bonus_points)) || 0;
      const mMap = {};
      (ms || []).forEach(x => { mMap[x.game] = x; });
      const mSt = Object.values(Games).map(g => {
        const r = mMap[g.id] || {};
        return { g, games: r.games || 0, wins: r.wins || 0, points: r.points || 0, best: r.best };
      });
      const mTot = mSt.reduce((a, s) => ({ games: a.games + s.games, wins: a.wins + s.wins, points: a.points + s.points }), { games: 0, wins: 0, points: mBonus });
      const mWr = mTot.games ? Math.round(mTot.wins * 100 / mTot.games) : 0;
      const mLvl = Math.floor(Math.sqrt(mTot.points));
      const mBdgs = window.ProfileConfig ? ProfileConfig.evaluate(mSt, mTot, mWr, null).filter(b => b.ok).length : 0;
      compareData = { nick: me.nick, av: (mp && mp.avatar) || me.avatar || '👾', lvl: mLvl, tot: mTot, wr: mWr, badges: mBdgs, map: mMap };
    }

    function renderProfile() {
      const favG = getFavGame();
      const visibleSt = st.filter(s => {
        if (statFilter === 'all') return true;
        if (statFilter === 'played') return s.games > 0;
        if (prefs.hiddenGames.includes(s.g.id)) return false;
        if (prefs.onlyPlayed && s.games === 0) return false;
        return true;
      });
      const visTot = visibleSt.reduce((a, s) => ({ games: a.games + s.games, wins: a.wins + s.wins, points: a.points + s.points }), { games: 0, wins: 0, points: 0 });
      const visWinRate = visTot.games ? Math.round(visTot.wins * 100 / visTot.games) : 0;

      const filteredRecent = recent.filter(x => {
        if (recFilter === 'wins') return x.result === 'win';
        if (recFilter === 'online' || recFilter === 'bot' || recFilter === 'solo') return x.mode === recFilter;
        return true;
      });

      const swHtml = (k, label) => `<div class="set-row"><div><span>${t(label)}</span></div>
        <button type="button" class="switch ${prefs[k] ? 'on' : ''}" role="switch" aria-checked="${!!prefs[k]}" data-pk="${k}"><i></i></button></div>`;

      const pinnedShowcase = prefs.pinnedBadges.map(id => {
        const b = badgeList.find(x => x.id === id);
        return b && b.ok ? `<span class="pin-chip" title="${esc(t('bdg_' + b.id + '_d'))}">${b.ico} ${esc(t('bdg_' + b.id))}</span>` : '';
      }).filter(Boolean).join('');

      const cmpHtml = compareOpen && compareData ? `<div class="panel compare-panel">
        <div class="prof-sec-head">
          <h2>⚔ ${t('compareYou')} vs ${esc(p.nick)}</h2>
          <button type="button" class="px-btn small ghost" id="cmpClose">${t('compareClose')}</button>
        </div>
        <table class="lb-table">
          <thead><tr><th>${t('compareStat')}</th><th>${compareData.av} ${esc(compareData.nick)}</th><th>${chosen} ${esc(p.nick)}</th></tr></thead>
          <tbody>
            <tr><td>${t('levelLbl')}</td><td><b>Lv ${compareData.lvl}</b></td><td><b>Lv ${lvl}</b></td></tr>
            <tr><td>${t('lbPts')}</td><td class="${compareData.tot.points >= tot.points ? 'cmp-win' : ''}">${compareData.tot.points}</td><td class="${tot.points >= compareData.tot.points ? 'cmp-win' : ''}">${tot.points}</td></tr>
            <tr><td>${t('lbWins')}</td><td class="${compareData.tot.wins >= tot.wins ? 'cmp-win' : ''}">${compareData.tot.wins}</td><td class="${tot.wins >= compareData.tot.wins ? 'cmp-win' : ''}">${tot.wins}</td></tr>
            <tr><td>${t('lbWinRate')}</td><td class="${compareData.wr >= winRate ? 'cmp-win' : ''}">${compareData.wr}%</td><td class="${winRate >= compareData.wr ? 'cmp-win' : ''}">${winRate}%</td></tr>
            <tr><td>${t('achievements')}</td><td class="${compareData.badges >= unlockedBadges.length ? 'cmp-win' : ''}">${compareData.badges}</td><td class="${unlockedBadges.length >= compareData.badges ? 'cmp-win' : ''}">${unlockedBadges.length}</td></tr>
          </tbody>
        </table>
      </div>` : '';

      const onlineInviteGames = Object.values(Games).filter(g => !g.solo || g.id === 'wordle' || SA_GAMES.includes(g.id));
      const invPickerHtml = invPickerOpen ? `<div class="panel inv-picker">
        <small class="hint">${t('inviteToGame')} → ${esc(p.nick)}:</small>
        <div class="tabs" style="margin-top:6px">${onlineInviteGames.map(g => `<button type="button" class="tab" data-invg="${g.id}">${t(g.nameKey)}</button>`).join('')}</div>
      </div>` : '';

      box.innerHTML = `
        <div class="prof-head">
          <div class="avatar big frame-${prefs.frame || 'none'}" id="bigAv">${chosen}</div>
          <div class="prof-info">
            <h1>${esc(p.nick)} ${ownerBadgeHtml(p.user_id)} <span class="dot ${Social.isOnline(p.user_id) ? 'on' : ''}"></span> <span class="lvl">Lv ${lvl}</span></h1>
            ${prefs.title ? `<div class="prof-title-badge ${prefs.title === 'ttl_owner' ? 'owner' : ''}">${esc(t(prefs.title))}</div>` : ''}
            ${pinnedShowcase ? `<div class="pin-showcase">${pinnedShowcase}</div>` : ''}
            <p class="bio" id="bioPreview">${esc(p.bio || '')}</p>
            <div class="prof-xp">
              <div class="prof-xp-bar"><i style="width:${xpPct}%"></i></div>
              <small class="hint">${tot.points} / ${nextPts} ${t('pts')} (${xpPct}%)</small>
            </div>
            <p class="hint">${t('since')} ${fmtDate(p.created_at)}${favG ? ` · ❤️ <button class="nick-link" id="favLink">${t(favG.nameKey)}</button>` : ''} · 🔥 ${t('winStreakLbl')}: <b>${winStreak}${winStreak >= 10 ? '+' : ''}</b> · 🎮 ${t('favModeLbl')}: <b>${favModeTxt}</b></p>
            <div class="row left">
              ${mine ? `<button class="px-btn small ${editOpen ? 'cyan' : 'pink'}" id="editProfBtn">✏ ${t(editOpen ? 'closeEdit' : 'editProfile')}</button>` : ''}
              ${mine ? `<button class="px-btn small cyan" id="profShopBtn">🪙 ${t('shopMenu')}</button>` : ''}
              <button class="px-btn small ghost" id="shareProfBtn">📋 ${t('shareProfile')}</button>
              ${me && !mine ? `<button class="px-btn small cyan" id="compareBtn">${compareOpen ? t('compareClose') : t('compareBtn')}</button>` : ''}
              ${me && !mine ? `<button class="px-btn small green" id="invPlayBtn">${t('inviteToGame')}</button>` : ''}
              ${action}
            </div>
          </div>
          <div class="prof-kpis">
            <div class="prof-kpi"><small>${t('rankPos')}</small><b>${rankNum ? '#' + rankNum : '–'}</b></div>
            <div class="prof-kpi"><small>${t('lbPts')}</small><b>${tot.points}</b></div>
            <div class="prof-kpi"><small>${t('lbWins')}</small><b>${tot.wins} <small>(${winRate}%)</small></b></div>
            <div class="prof-kpi"><small>${t('lbGames')}</small><b>${tot.games}</b></div>
          </div>
        </div>

        ${invPickerHtml}
        ${cmpHtml}

        ${mine && editOpen ? `<div class="panel edit" id="editPanel">
          <h2>✏ ${t('editProfile')}</h2>
          <div class="field"><span>${t('avatar')}</span>
            <div class="avatars">${allAvatars.map(a => `<button type="button" class="av-opt ${a === chosen ? 'on' : ''}" data-a="${a}">${a}</button>`).join('')}</div>
          </div>
          <div class="field"><span>🖼 ${t('profFrame')}</span>
            <div class="tabs">${availFrames.map(f => {
              const unlocked = isTargetOwner || lvl >= f.minLvl;
              return `<button type="button" class="tab ${prefs.frame === f.id ? 'on' : ''} ${unlocked ? '' : 'locked'}" data-frm="${f.id}" ${unlocked ? '' : 'disabled'}>${t('frm_' + (f.id || 'none'))} ${unlocked ? '' : '<small>🔒 ' + t('frameLocked', { lvl: f.minLvl }) + '</small>'}</button>`;
            }).join('')}</div>
          </div>
          <label class="field"><span>${t('bio')}</span><input id="bioIn" maxlength="80" placeholder="${t('bioPh')}" value="${esc(p.bio || '')}"></label>
          <div class="field"><span>${t('profTitle')}</span>
            <div class="tabs">${availTitles.map(tk => `<button type="button" class="tab ${prefs.title === tk ? 'on' : ''}" data-ttl="${tk}">${tk ? t(tk) : t('titleNone')}</button>`).join('')}</div>
          </div>
          <div class="field"><span>📌 ${t('pinnedTitle')}</span>
            <div class="tabs">${unlockedBadges.length ? unlockedBadges.map(b => `<button type="button" class="tab ${prefs.pinnedBadges.includes(b.id) ? 'on' : ''}" data-pin="${b.id}">${b.ico} ${t('bdg_' + b.id)}</button>`).join('') : `<small class="hint">${t('noBadgesYet')}</small>`}</div>
          </div>
          ${ownedSkins.length ? `<div class="field"><span>🎨 ${t('shopSkins')}</span>
            <div class="tabs">${ownedSkins.map(sk => {
              const eq = prefs.skins[sk.game] === sk.cls;
              return `<button type="button" class="tab ${eq ? 'on' : ''}" data-skgame="${sk.game}" data-skcls="${sk.cls}">${sk.ico} ${t('shop_' + sk.id)}</button>`;
            }).join('')}</div>
          </div>` : ''}
          <div class="field"><span>${t('favGame')}</span>
            <div class="tabs"><button type="button" class="tab ${!prefs.favGame ? 'on' : ''}" data-fav="">${t('favAuto')}</button>${Object.values(Games).map(g => `<button type="button" class="tab ${prefs.favGame === g.id ? 'on' : ''}" data-fav="${g.id}">${t(g.nameKey)}</button>`).join('')}</div>
          </div>
          <h2>👁 ${t('visSettings')}</h2>
          ${swHtml('showStats', 'visShowStats')}
          ${swHtml('showRecords', 'visShowRecords')}
          ${swHtml('showBadges', 'visShowBadges')}
          ${swHtml('showRecent', 'visShowRecent')}
          ${swHtml('onlyPlayed', 'visOnlyPlayed')}
          <div class="field">
            <span>🎮 ${t('visGames')}</span>
            <small class="hint">${t('visGamesHint')}</small>
            <div class="row left" style="margin:6px 0">
              <button type="button" class="px-btn small ghost" id="visAllBtn">${t('showAllGames')}</button>
              <button type="button" class="px-btn small ghost" id="visPlayedBtn">${t('showPlayedOnly')}</button>
            </div>
            <div class="vis-games-grid">
              ${st.map(s => {
        const on = !prefs.hiddenGames.includes(s.g.id);
        return `<button type="button" class="tab vis-game ${on ? 'on' : ''}" data-vg="${s.g.id}">${on ? '✔ ' : '✕ '}${t(s.g.nameKey)} <small>(${s.games})</small></button>`;
      }).join('')}
            </div>
          </div>
          <div class="row left">
            <button type="button" class="px-btn pink" id="saveP">💾 ${t('save')}</button>
            <button type="button" class="px-btn ghost" id="cancelEditP">${t('closeEdit')}</button>
          </div>
        </div>` : ''}

        ${prefs.showBadges || mine ? `<div class="panel" id="badgesPanel">
          <div class="prof-sec-head prof-collapse-head" id="toggleBadgesHead">
            <h2>🏅 ${t('badges')} (${badgeList.filter(b => b.ok).length}/${badgeList.length})</h2>
            <div class="row" style="gap:10px;align-items:center">
              ${!prefs.showBadges && mine ? `<small class="hint">(${t('hiddenByUser')})</small>` : ''}
              <button type="button" class="px-btn small cyan" id="openAchPageBtn">🏅 ${t('achAllBtn')}</button>
              <button type="button" class="px-btn small ghost" id="toggleBadgesBtn">${badgesOpen ? t('collapseBadges') + ' ▴' : t('expandBadges') + ' ▾'}</button>
            </div>
          </div>
          ${badgesOpen ? `<div class="prof-badges">
            ${badgeList.map(b => `<div class="prof-badge ${b.ok ? 'on' : 'off'}">
              <span class="b-ico">${b.ico}</span>
              <div style="flex:1">
                <div class="b-head-row"><b>${t('bdg_' + b.id)}</b><span class="tier-tag ${b.tierColor || 'cyan'}">${t('tier_' + (b.tier || 'easy'))}</span></div>
                <small class="hint">${t('bdg_' + b.id + '_d')}</small>
                <small class="b-rate ${b.pct <= 15 ? 'rare' : ''}">👥 ${t('achPlayersPct', { pct: b.pct != null ? b.pct : 0 })}</small>
              </div>
            </div>`).join('')}
          </div>` : `<div class="prof-badges-mini" id="badgesMini">
            ${badgeList.some(b => b.ok)
              ? badgeList.filter(b => b.ok).map(b => `<span class="b-mini" title="${esc(t('bdg_' + b.id) + ': ' + t('bdg_' + b.id + '_d') + ' (' + (b.pct || 0) + '%)')}">${b.ico} <small>${esc(t('bdg_' + b.id))}</small></span>`).join('')
              : `<span class="hint">${t('noBadgesYet')}</span>`}
          </div>`}
        </div>` : ''}

        <div class="panel">
          <div class="prof-sec-head">
            <h2>📊 ${t('totalStats')}</h2>
            ${mine ? `<div class="tabs"><button class="tab ${statFilter === 'vis' ? 'on' : ''}" data-sf="vis">👁</button><button class="tab ${statFilter === 'played' ? 'on' : ''}" data-sf="played">${t('filterPlayed')}</button><button class="tab ${statFilter === 'all' ? 'on' : ''}" data-sf="all">${t('filterAll')}</button></div>` : ''}
          </div>
          ${!prefs.showStats && !mine ? `<p class="hint">${t('hiddenByUser')}</p>` : visibleSt.length ? `
          <table class="lb-table"><thead><tr><th></th><th>${t('lbGames')}</th><th>${t('lbWins')}</th><th>${t('lbWinRate')}</th><th>${t('lbPts')}</th>${prefs.showRecords ? `<th>${t('lbBest')}</th>` : ''}</tr></thead><tbody>
          ${visibleSt.map(s => `<tr><td><button class="nick-link" data-play="${s.g.id}">${t(s.g.nameKey)}</button></td><td>${s.games}</td><td>${s.wins}</td><td>${s.games ? Math.round(s.wins * 100 / s.games) : 0}%</td><td>${s.points}</td>${prefs.showRecords ? `<td>${s.g.solo ? fmtBestVal(s.g.id, s.best) : '–'}</td>` : ''}</tr>`).join('')}
          <tr class="me"><td>Σ</td><td>${visTot.games}</td><td>${visTot.wins}</td><td>${visWinRate}%</td><td>${visTot.points}</td>${prefs.showRecords ? `<td></td>` : ''}</tr></tbody></table>` : `<p class="hint">${t('noVisibleGames')}</p>`}
        </div>

        <div class="panel">
          <div class="prof-sec-head">
            <h2>🕒 ${t('recent')}</h2>
            ${(prefs.showRecent || mine) && recent.length ? `<div class="tabs">${[['all', t('filterAll')], ['wins', t('filterWins')], ['online', 'Online'], ['bot', 'Bot'], ['solo', 'Solo']].map(([k, lbl]) => `<button class="tab ${recFilter === k ? 'on' : ''}" data-rf="${k}">${lbl}</button>`).join('')}</div>` : ''}
          </div>
          ${!prefs.showRecent && !mine ? `<p class="hint">${t('hiddenByUser')}</p>` : filteredRecent.length ? `<ul class="recent">${filteredRecent.map(x => `<li><span>${Games[x.game] ? t(Games[x.game].nameKey) : x.game}</span><span>${x.mode === 'bot' ? 'Bot' : x.mode === 'solo' ? 'Solo' : 'Online'}</span>
            <b class="r-${x.result}">${t({ win: 'rW', lose: 'rL', draw: 'rD' }[x.result])}</b><span>+${x.points}</span><small class="hint">${fmtDate(x.created_at)}</small></li>`).join('')}</ul>` : `<p class="hint">${t('lbEmpty')}</p>`}
        </div>`;

      const favBtn = $('#favLink', box);
      if (favBtn && favG) favBtn.onclick = () => { Sfx.play('click'); const canOnline = !favG.solo || favG.id === 'wordle' || SA_GAMES.includes(favG.id); if (favG.solo && !favG.diff && !canOnline) launch(favG.id, { mode: 'solo' }); else screen(() => lobby(favG.id)); };
      box.querySelectorAll('[data-play]').forEach(b => b.onclick = () => {
        const g = Games[b.dataset.play]; if (!g) return;
        Sfx.play('click'); const canOnline = !g.solo || g.id === 'wordle' || SA_GAMES.includes(g.id); if (g.solo && !g.diff && !canOnline) launch(g.id, { mode: 'solo' }); else screen(() => lobby(g.id));
      });
      box.querySelectorAll('[data-sf]').forEach(b => b.onclick = () => { Sfx.play('click'); statFilter = b.dataset.sf; renderProfile(); });
      box.querySelectorAll('[data-rf]').forEach(b => b.onclick = () => { Sfx.play('click'); recFilter = b.dataset.rf; renderProfile(); });

      const shareBtn = $('#shareProfBtn', box);
      if (shareBtn) shareBtn.onclick = () => {
        Sfx.play('click');
        const card = `${chosen} ${p.nick} (Lv ${lvl}) · ${tot.points} ${t('pts')} · ${tot.wins}/${tot.games} (${winRate}%)`;
        if (navigator.clipboard) navigator.clipboard.writeText(card);
        toast(t('profileCopied'));
      };

      const profShopBtn = $('#profShopBtn', box);
      if (profShopBtn) profShopBtn.onclick = () => { Sfx.play('click'); shopScreen(); };

      const cmpBtn = $('#compareBtn', box);
      if (cmpBtn) cmpBtn.onclick = async () => {
        Sfx.play('click');
        compareOpen = !compareOpen;
        if (compareOpen && !compareData) await loadCompare();
        renderProfile();
      };
      const cmpClose = $('#cmpClose', box);
      if (cmpClose) cmpClose.onclick = () => { Sfx.play('click'); compareOpen = false; renderProfile(); };

      const invPlayBtn = $('#invPlayBtn', box);
      if (invPlayBtn) invPlayBtn.onclick = () => { Sfx.play('click'); invPickerOpen = !invPickerOpen; renderProfile(); };
      box.querySelectorAll('[data-invg]').forEach(b => b.onclick = () => {
        Sfx.play('click');
        hostRoom(b.dataset.invg, false, p.user_id);
      });

      const editBtn = $('#editProfBtn', box);
      if (editBtn) editBtn.onclick = () => { Sfx.play('click'); editOpen = !editOpen; renderProfile(); };

      const tbBtn = $('#toggleBadgesBtn', box), tbMini = $('#badgesMini', box), openAchBtn = $('#openAchPageBtn', box);
      if (tbBtn) tbBtn.onclick = () => { Sfx.play('click'); badgesOpen = !badgesOpen; renderProfile(); };
      if (tbMini) tbMini.onclick = () => { Sfx.play('click'); badgesOpen = true; renderProfile(); };
      if (openAchBtn) openAchBtn.onclick = () => { Sfx.play('click'); achievementsScreen(); };

      if (mine && editOpen) {
        const keepBio = () => { const el = $('#bioIn', box); if (el) p.bio = el.value; };
        box.querySelectorAll('.av-opt').forEach(b => b.onclick = () => {
          keepBio(); chosen = b.dataset.a; Sfx.play('click'); renderProfile();
        });
        box.querySelectorAll('[data-frm]').forEach(b => b.onclick = () => {
          if (b.disabled) return;
          keepBio(); prefs.frame = b.dataset.frm; Sfx.play('click'); renderProfile();
        });
        box.querySelectorAll('[data-ttl]').forEach(b => b.onclick = () => {
          keepBio(); prefs.title = b.dataset.ttl; Sfx.play('click'); renderProfile();
        });
        box.querySelectorAll('[data-pin]').forEach(b => b.onclick = () => {
          keepBio(); const bid = b.dataset.pin;
          const idx = prefs.pinnedBadges.indexOf(bid);
          if (idx >= 0) prefs.pinnedBadges.splice(idx, 1);
          else {
            if (prefs.pinnedBadges.length >= 3) { toast(t('pinnedLimit')); return; }
            prefs.pinnedBadges.push(bid);
          }
          Sfx.play('click'); renderProfile();
        });
        box.querySelectorAll('[data-skgame]').forEach(b => b.onclick = () => {
          keepBio(); const gm = b.dataset.skgame, cls = b.dataset.skcls;
          if (prefs.skins[gm] === cls) delete prefs.skins[gm];
          else prefs.skins[gm] = cls;
          Sfx.play('click'); renderProfile();
        });
        box.querySelectorAll('[data-fav]').forEach(b => b.onclick = () => {
          keepBio(); prefs.favGame = b.dataset.fav; Sfx.play('click'); renderProfile();
        });
        box.querySelectorAll('[data-pk]').forEach(b => b.onclick = () => {
          keepBio(); const k = b.dataset.pk; prefs[k] = !prefs[k]; Sfx.play('click'); renderProfile();
        });
        box.querySelectorAll('[data-vg]').forEach(b => b.onclick = () => {
          keepBio(); const gid = b.dataset.vg;
          const idx = prefs.hiddenGames.indexOf(gid);
          if (idx >= 0) prefs.hiddenGames.splice(idx, 1); else prefs.hiddenGames.push(gid);
          Sfx.play('click'); renderProfile();
        });
        $('#visAllBtn', box).onclick = () => { keepBio(); prefs.hiddenGames = []; prefs.onlyPlayed = false; Sfx.play('click'); renderProfile(); };
        $('#visPlayedBtn', box).onclick = () => {
          keepBio(); prefs.hiddenGames = st.filter(s => s.games === 0).map(s => s.g.id); Sfx.play('click'); renderProfile();
        };
        $('#cancelEditP', box).onclick = () => { keepBio(); editOpen = false; Sfx.play('click'); renderProfile(); };
        $('#saveP', box).onclick = async () => {
          const bioVal = ($('#bioIn', box) ? $('#bioIn', box).value : p.bio || '').trim().slice(0, 80);
          p.bio = bioVal; p.avatar = chosen; p.prefs = prefs;
          const ok = await Supa.updateProfile({ avatar: chosen, bio: bioVal, prefs });
          toast(ok ? t('saved') : t('actionErr')); Sfx.play(ok ? 'good' : 'bad');
          if (ok) { editOpen = false; header(); renderProfile(); }
        };
      }

      const act = $('#pAct', box);
      if (act) act.onclick = async () => {
        let ok;
        if (!rel) ok = await Supa.addFriend(p.user_id);
        else if (rel.status === 'pending' && rel.incoming) ok = await Supa.acceptFriend(rel.id);
        else ok = await Supa.removeFriend(rel.id);
        toast(ok ? '✔' : t('actionErr')); profile(nick);
      };
    }

    renderProfile();
    if (openBadges) {
      setTimeout(() => { const bp = $('#badgesPanel', box); if (bp && bp.scrollIntoView) bp.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, 80);
    }
  }

  // ---------- DEDYKOWANA STRONA OSIĄGNIĘĆ ----------
  async function achievementsScreen(filter = 'tiers') {
    leaveGame(); currentScreen = 'achievements'; rerender = () => achievementsScreen(filter);
    const my = tok, me = Supa.user();
    view.innerHTML = `${backBtn()}<section class="ach-screen">
      <h1>🏅 ${t('achievements')}</h1>
      <p class="hint" style="margin-bottom:16px">${t('achSub')}</p>
      <div id="achBox">${loaderHtml}</div>
    </section>`;
    $('#back').onclick = () => screen(menu);
    const box = $('#achBox');

    const [rows, uStats, hs, prof] = await Promise.all([
      Supa.leaderboard(),
      me ? Supa.userStats(me.id, me.nick) : [],
      Supa.highscores(),
      me ? Supa.getProfile(me.nick) : null
    ]);
    if (my !== tok) return;

    const bestMap = {};
    if (me) {
      (hs || []).filter(h => (h.user_id ? h.user_id === me.id : h.nick === me.nick) && h.best != null).forEach(h => { bestMap[h.game] = h.best; });
      (uStats || []).filter(s => s.best != null).forEach(s => { bestMap[s.game] = s.best; });
    }
    const st = Object.values(Games).map(g => {
      if (!me) return { g, games: 0, wins: 0, losses: 0, draws: 0, points: 0, best: null };
      const us = (uStats || []).find(x => x.game === g.id);
      const r = us || (rows || []).find(x => (x.user_id ? x.user_id === me.id : x.nick === me.nick) && x.game === g.id) || {};
      return { g, games: r.games || 0, wins: r.wins || 0, losses: r.losses || 0, draws: r.draws || 0, points: r.points || 0, best: bestMap[g.id] };
    });
    const bonusPts = prof ? (prof.points || prof.bonus_points || 0) : 0;
    const tot = st.reduce((a, s) => ({ games: a.games + s.games, wins: a.wins + s.wins, points: a.points + s.points }), { games: 0, wins: 0, points: bonusPts });
    const winRate = tot.games ? Math.round(tot.wins * 100 / tot.games) : 0;

    // Miejsce w rankingu
    let rankNum = null;
    if (me) {
      const rankAgg = {};
      (rows || []).forEach(r => {
        const k = r.user_id || r.nick;
        const a = rankAgg[k] || (rankAgg[k] = { id: k, user_id: r.user_id, nick: r.nick, points: 0, wins: 0, games: 0 });
        a.points += r.points; a.wins += r.wins; a.games += r.games;
      });
      const sortedRank = Object.values(rankAgg).filter(a => a.games > 0 || a.points > 0).sort((a, b) => b.points - a.points || b.wins - a.wins || a.games - b.games);
      const idx = sortedRank.findIndex(a => (a.user_id && a.user_id === me.id) || a.nick === me.nick);
      if (idx >= 0) rankNum = idx + 1;
    }

    const globalInfo = window.ProfileConfig && ProfileConfig.computeGlobalRates ? ProfileConfig.computeGlobalRates(rows) : { rates: {}, totalPlayers: 0 };
    const badges = window.ProfileConfig ? ProfileConfig.evaluate(st, tot, winRate, rankNum, globalInfo.rates) : [];
    if (me) syncKnownBadges(me.id, badges);
    const unlockedCount = badges.filter(b => b.ok).length;
    const totalCount = badges.length;
    const completionPct = totalCount ? Math.round(unlockedCount * 100 / totalCount) : 0;

    const tiersOrder = [
      { id: 'easy', ico: '🟢', color: 'green' },
      { id: 'normal', ico: '🔵', color: 'cyan' },
      { id: 'hard', ico: '🔴', color: 'pink' },
      { id: 'legend', ico: '🟡', color: 'yellow' }
    ];

    const renderCard = (b) => {
      const pPct = b.max ? Math.min(100, Math.round(b.cur * 100 / b.max)) : (b.ok ? 100 : 0);
      return `<div class="ach-card ${b.ok ? 'on' : 'off'} tier-border-${b.tierColor || 'cyan'}">
        <div class="ach-ico">${b.ico}</div>
        <div class="ach-body">
          <div class="ach-top-row">
            <b>${t('bdg_' + b.id)}</b>
            <span class="tier-tag ${b.tierColor || 'cyan'}">${t('tier_' + b.tier)}</span>
          </div>
          <p class="ach-desc">${t('bdg_' + b.id + '_d')}</p>
          <div class="ach-bars">
            <div class="ach-prog-row">
              <small>${b.ok ? '✔ ' + t('achDone') : t('achProgress') + ': ' + b.cur + ' / ' + b.max}</small>
              <div class="ach-bar"><i class="fill-${b.tierColor || 'cyan'}" style="width:${pPct}%"></i></div>
            </div>
            <div class="ach-rate-row ${b.pct <= 15 ? 'rare' : ''}">
              <small>👥 ${t('achPlayersPct', { pct: b.pct != null ? b.pct : 0 })}</small>
              <div class="ach-bar global"><i style="width:${Math.min(100, b.pct || 0)}%"></i></div>
            </div>
          </div>
        </div>
      </div>`;
    };

    function renderAch() {
      let contentHtml = '';
      if (filter === 'tiers') {
        contentHtml = tiersOrder.map(tr => {
          const list = badges.filter(b => b.tier === tr.id);
          if (!list.length) return '';
          const doneInTier = list.filter(b => b.ok).length;
          return `<div class="panel ach-tier-sec">
            <div class="prof-sec-head">
              <h2>${tr.ico} ${t('tier_' + tr.id)} <small class="hint">(${doneInTier}/${list.length})</small></h2>
            </div>
            <div class="ach-grid">${list.map(renderCard).join('')}</div>
          </div>`;
        }).join('');
      } else {
        let list = [...badges];
        if (filter === 'rarest') list.sort((a, b) => (a.pct - b.pct) || (b.ok - a.ok));
        else if (filter === 'unlocked') list = list.filter(b => b.ok);
        else if (filter === 'locked') list = list.filter(b => !b.ok);
        contentHtml = `<div class="panel"><div class="ach-grid">${list.length ? list.map(renderCard).join('') : `<p class="hint">${t('noBadgesYet')}</p>`}</div></div>`;
      }

      box.innerHTML = `
        <div class="panel ach-summary">
          <div class="ach-sum-left">
            <h2>🏆 ${t('achUnlocked')}: <b>${unlockedCount} / ${totalCount}</b> (${completionPct}%)</h2>
            <div class="prof-xp-bar ach-main-bar"><i style="width:${completionPct}%"></i></div>
          </div>
          <div class="ach-sum-tiers">
            ${tiersOrder.map(tr => {
              const allT = badges.filter(b => b.tier === tr.id);
              const okT = allT.filter(b => b.ok).length;
              return `<div class="prof-kpi"><small>${tr.ico} ${t('tier_' + tr.id)}</small><b>${okT}/${allT.length}</b></div>`;
            }).join('')}
          </div>
        </div>

        <div class="tabs" style="margin-bottom:14px">
          <button class="tab ${filter === 'tiers' ? 'on' : ''}" data-af="tiers">🗂 ${t('achByTier')}</button>
          <button class="tab ${filter === 'rarest' ? 'on' : ''}" data-af="rarest">🔥 ${t('achRarest')}</button>
          <button class="tab ${filter === 'unlocked' ? 'on' : ''}" data-af="unlocked">✔ ${t('achUnlocked')} (${unlockedCount})</button>
          <button class="tab ${filter === 'locked' ? 'on' : ''}" data-af="locked">🔒 ${t('achLocked')} (${totalCount - unlockedCount})</button>
        </div>

        ${contentHtml}
      `;

      box.querySelectorAll('[data-af]').forEach(b => b.onclick = () => {
        Sfx.play('click');
        filter = b.dataset.af;
        renderAch();
      });
    }

    renderAch();
  }

  async function friends() {
    leaveGame(); currentScreen = 'friends'; rerender = friends; friendsReload = null;
    if (!Supa.user()) {
      view.innerHTML = `${backBtn()}<p class="hint">${t('needLogin')}</p>`;
      $('#back').onclick = () => screen(menu); return;
    }
    const my = tok;
    view.innerHTML = `${backBtn()}<section class="fr"><h1>👥 ${t('friends')}</h1>
      <input id="fq" placeholder="${t('searchNick')}" maxlength="16" autocomplete="off">
      <div id="fres" class="fr-list"></div><div id="flist">${loaderHtml}</div></section>`;
    $('#back').onclick = () => screen(menu);

    async function load() {
      const list = await Supa.friendsOverview();
      if (my !== tok) return;
      const inc = list.filter(x => x.status === 'pending' && x.incoming);
      const sent = list.filter(x => x.status === 'pending' && !x.incoming);
      const fr = list.filter(x => x.status === 'accepted').sort((a, b) => Social.isOnline(b.profile.user_id) - Social.isOnline(a.profile.user_id));
      const sec = (title, items) => items ? `<h2 class="sec">${title}</h2><div class="fr-list">${items}</div>` : '';
      $('#flist').innerHTML =
        sec(`📨 ${t('requests')}`, inc.map(x => friendRow(x.profile, `<button class="px-btn small green" data-act="accept" data-id="${x.id}">${t('accept')}</button><button class="px-btn small ghost" data-act="remove" data-id="${x.id}">${t('decline')}</button>`)).join('')) +
        sec(`💚 ${t('friendsList')}`, fr.map(x => friendRow(x.profile, `<button class="px-btn small cyan" data-invnick="${esc(x.profile.nick)}" data-invuid="${x.profile.user_id}" title="${t('inviteToGame')}">🎮</button><button class="px-btn small ghost" data-act="remove" data-id="${x.id}">✕</button>`)).join('')) +
        sec(`⏳ ${t('sentReq')}`, sent.map(x => friendRow(x.profile, `<button class="px-btn small ghost" data-act="remove" data-id="${x.id}">${t('cancelReq')}</button>`)).join('')) +
        (list.length ? '' : `<p class="hint">${t('noFriends')}</p>`);
      bindNicks($('#flist'));
      $('#flist').querySelectorAll('[data-invuid]').forEach(b => b.onclick = () => {
        Sfx.play('click');
        openInviteDialog(b.dataset.invuid, b.dataset.invnick);
      });
      $('#flist').querySelectorAll('[data-act]').forEach(b => b.onclick = async () => {
        Sfx.play('click'); b.disabled = true;
        const ok = b.dataset.act === 'accept' ? await Supa.acceptFriend(+b.dataset.id) : await Supa.removeFriend(+b.dataset.id);
        if (!ok) toast(t('actionErr'));
        load();
      });
    }
    friendsReload = load; load();

    let timer;
    $('#fq').oninput = (e) => {
      clearTimeout(timer);
      const q = e.target.value.trim(), res = $('#fres');
      if (!q) { res.innerHTML = ''; return; }
      timer = setTimeout(async () => {
        const rs = await Supa.searchProfiles(q);
        if (my !== tok) return;
        res.innerHTML = rs.length ? rs.map(p => friendRow(p, `<button class="px-btn small pink" data-add="${p.user_id}">${t('addFriend')}</button>`)).join('') : `<p class="hint">${t('noResults')}</p>`;
        bindNicks(res);
        res.querySelectorAll('[data-add]').forEach(b => b.onclick = async () => {
          b.disabled = true;
          const ok = await Supa.addFriend(b.dataset.add);
          toast(ok ? t('reqSent') : t('actionErr')); Sfx.play(ok ? 'good' : 'bad');
          if (ok) load();
        });
      }, 300);
    };
  }

  // zaproszenie znajomych z poziomu pokoju
  async function loadInvites(gid, code) {
    if (!Supa.user() || !$('#inv')) return;
    const list = (await Supa.friendsOverview()).filter(x => x.status === 'accepted')
      .sort((a, b) => Social.isOnline(b.profile.user_id) - Social.isOnline(a.profile.user_id));
    const box = $('#inv');
    if (!box || !list.length) return;
    box.innerHTML = `<p class="hint">${t('inviteTitle')}</p><div class="fr-list">` + list.map(x => friendRow(x.profile,
      `<button class="px-btn small cyan" data-inv="${x.profile.user_id}">${t('invite')}</button>`)).join('') + '</div>';
    box.querySelectorAll('[data-inv]').forEach(b => b.onclick = () => {
      Social.invite(b.dataset.inv, gid, code); toast(t('invited')); Sfx.play('good'); b.disabled = true;
    });
  }
  Social.onInvite = (p) => {
    if (!p || !Games[p.game] || !p.code) return;
    const code = String(p.code).slice(0, 5).toUpperCase();
    const d = document.createElement('div'); d.className = 'toast invite';
    d.innerHTML = `<span>${p.avatar || '👾'} ${esc(t('inviteFrom', { nick: p.nick, game: t(Games[p.game].nameKey) }))}</span> <button class="px-btn small pink">${t('joinBtn')}</button>`;
    d.querySelector('button').onclick = () => { d.remove(); Sfx.play('click'); leaveGame(); joinRoom(p.game, code); };
    $('#toasts').appendChild(d); Sfx.play('good'); setTimeout(() => d.remove(), 15000);
  };
  Social.onPresence(() => { if (currentScreen === 'friends' && friendsReload) friendsReload(); });

  let dbChecked = false;
  Supa.onChange(() => {
    if (!Supa.user() || dbChecked) return;
    dbChecked = true;
    Supa.dbReady().then(r => { if (r !== true) toast('Baza danych: ' + r + ' → uruchom supabase.sql', 15000); });
  });

  // ---------- SETTINGS ----------
  const THEMES = [['synth', '#ff2e97', '#2ef2ff', '#ffe14d'], ['matrix', '#19ff8c', '#b6ff3b', '#fff27a'], ['sunset', '#ff5e3a', '#ffb02e', '#fff0a3'], ['ice', '#5ec8ff', '#c6f1ff', '#ffffff']];
  function settingsScreen() {
    leaveGame(); currentScreen = 'settings'; rerender = settingsScreen;
    const S = (k) => Settings.get(k);
    const sw = (k, label, hint) => `<div class="set-row"><div><span>${t(label)}</span>${hint ? `<small class="hint">${t(hint)}</small>` : ''}</div>
      <button class="switch ${S(k) ? 'on' : ''}" role="switch" aria-checked="${!!S(k)}" aria-label="${t(label)}" data-k="${k}"><i></i></button></div>`;
    const u = Supa.user();
    view.innerHTML = `${backBtn()}<section class="settings"><h1>⚙ ${t('settings')}</h1>
      <div class="panel"><h2>🔊 ${t('setAudio')}</h2>
        ${sw('sound', 'sound')}
        <div class="set-row"><div><span>${t('volume')}</span></div><div class="range-wrap"><input type="range" class="range" min="0" max="100" value="${S('volume')}" id="vol" aria-label="${t('volume')}"><b id="volv">${S('volume')}%</b></div></div>
        ${sw('music', 'music', 'musicHint')}
        <div><button class="px-btn small" id="testSnd">▶ ${t('testSound')}</button></div></div>
      <div class="panel"><h2>🎨 ${t('setVisual')}</h2>
        <div class="set-row"><div><span>${t('theme')}</span></div></div>
        <div class="themes">${THEMES.map(([id, a, b, c]) => `<button class="theme ${S('theme') === id ? 'on' : ''}" data-theme="${id}"><span class="sw3"><i style="background:${a}"></i><i style="background:${b}"></i><i style="background:${c}"></i></span>${t('th_' + id)}</button>`).join('')}</div>
        ${sw('crt', 'crt', 'crtHint')}${sw('bgAnim', 'bgAnim')}</div>
      <div class="panel"><h2>✨ ${t('setEffects')}</h2>
        ${sw('motion', 'motion', 'motionHint')}${sw('fx', 'fx', 'fxHint')}${sw('shake', 'shake')}${sw('trail', 'trail')}</div>
      <div class="panel"><h2>🌐 ${t('language')}</h2>
        <div class="row left"><button class="px-btn small ${I18N.lang === 'pl' ? 'pink' : 'ghost'}" data-lang="pl">Polski</button><button class="px-btn small ${I18N.lang === 'en' ? 'pink' : 'ghost'}" data-lang="en">English</button></div></div>
      <div class="panel"><h2>👤 ${t('account')}</h2>
        ${u ? `<p>${t('loggedAs')}: <b class="hint">${u.avatar || '👾'} ${esc(u.nick)}</b></p><div class="row left"><button class="px-btn small cyan" id="setProf">${t('myProfile')}</button><button class="px-btn small ghost" id="setOut">${t('logout')}</button></div>`
        : `<button class="px-btn small pink" id="setIn">${t('login')}</button>`}</div>
      <div><button class="px-btn small ghost" id="rst">${t('resetSettings')}</button></div></section>`;
    $('#back').onclick = () => screen(menu);
    view.querySelectorAll('.switch').forEach(b => b.onclick = () => {
      const k = b.dataset.k, v = !Settings.get(k);
      Settings.set(k, v); b.classList.toggle('on', v); b.setAttribute('aria-checked', v);
      header(); Sfx.play('click');
      if (k === 'fx' && v) Fx.burst(b.getBoundingClientRect().left, b.getBoundingClientRect().top, '#fff', 14);
    });
    $('#vol').oninput = (e) => { Settings.set('volume', +e.target.value); $('#volv').textContent = e.target.value + '%'; };
    $('#vol').onchange = () => Sfx.play('good');
    $('#testSnd').onclick = () => { Sfx.play('win'); };
    view.querySelectorAll('.theme').forEach(b => b.onclick = () => { Settings.set('theme', b.dataset.theme); Sfx.play('good'); settingsScreen(); });
    view.querySelectorAll('[data-lang]').forEach(b => b.onclick = () => { I18N.set(b.dataset.lang); header(); Sfx.play('click'); settingsScreen(); });
    $('#rst').onclick = () => { Settings.reset(); header(); toast(t('resetDone')); settingsScreen(); };
    if (u) { $('#setProf').onclick = () => profile(u.nick); $('#setOut').onclick = async () => { await Supa.signOut(); settingsScreen(); }; }
    else $('#setIn').onclick = () => $('#authBtn').click();
  }

  // ---------- AUTH ----------
  let authMode = 'login';
  const dlg = $('#authDlg');
  function setAuthMode(m) {
    authMode = m;
    $('#tabLogin').classList.toggle('on', m === 'login'); $('#tabReg').classList.toggle('on', m === 'register');
    $('#authTitle').textContent = t(m === 'login' ? 'login' : 'register');
    $('#authSubmit').textContent = t(m === 'login' ? 'login' : 'register');
    $('#authErr').textContent = '';
  }
  $('#tabLogin').onclick = () => setAuthMode('login');
  $('#tabReg').onclick = () => setAuthMode('register');
  $('#authCancel').onclick = () => dlg.close();
  $('#authForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nick = $('#authNick').value.trim(), pw = $('#authPass').value;
    const btn = $('#authSubmit'); btn.disabled = true;
    const err = authMode === 'login' ? await Supa.signIn(nick, pw) : await Supa.signUp(nick, pw);
    btn.disabled = false;
    if (err) { const m = t(err); $('#authErr').textContent = m === err ? err : m; Sfx.play('bad'); }
    else { dlg.close(); Sfx.play('win'); }
  });
  $('#authBtn').onclick = async () => {
    Sfx.play('click');
    if (Supa.user()) { await Supa.signOut(); return; }
    if (!Supa.enabled()) { toast(t('authOff')); return; }
    setAuthMode('login'); dlg.showModal();
  };

  function openInviteDialog(targetUid, targetNick) {
    const games = Object.values(Games).filter(g => !g.solo || g.id === 'wordle' || SA_GAMES.includes(g.id));
    const ov = document.createElement('div'); ov.className = 'overlay';
    ov.innerHTML = `<div class="dlg-box" style="max-width:460px;width:92%">
      <h2>🎮 ${t('inviteToGame')} → ${esc(targetNick)}</h2>
      <div class="tabs" style="margin:12px 0;justify-content:center">${games.map(g => `<button type="button" class="tab" data-dg="${g.id}">${t(g.nameKey)}</button>`).join('')}</div>
      <button type="button" class="px-btn small ghost" id="dCancel">${t('cancel')}</button>
    </div>`;
    document.body.appendChild(ov);
    ov.querySelector('#dCancel').onclick = () => { ov.remove(); Sfx.play('click'); };
    ov.querySelectorAll('[data-dg]').forEach(b => b.onclick = () => {
      const gid = b.dataset.dg;
      ov.remove();
      Sfx.play('click');
      hostRoom(gid, false, targetUid);
    });
  }

  // ---------- SKLEPIK ARCADE (SHOP & SKINS) ----------
  function shopScreen() {
    leaveGame(); currentScreen = 'shop'; rerender = shopScreen;
    const items = (window.ProfileConfig && ProfileConfig.SHOP_ITEMS) || [];
    function renderShop() {
      const prefs = Supa.myPrefs ? Supa.myPrefs() : {};
      const coins = getCoins();
      const unlocked = Array.isArray(prefs.unlockedShop) ? prefs.unlockedShop : [];
      const skins = (prefs.skins && typeof prefs.skins === 'object') ? prefs.skins : {};
      const curAv = (Supa.user() && Supa.user().avatar) || '👾';
      const avItems = items.filter(i => i.type === 'avatar');
      const skItems = items.filter(i => i.type === 'skin');

      const cardHtml = (it) => {
        const own = unlocked.includes(it.id);
        const eq = it.type === 'avatar' ? (curAv === it.val) : (skins[it.game] === it.cls);
        return `<div class="panel shop-card ${own ? 'own' : ''} ${eq ? 'eq' : ''}">
          <div class="shop-ico">${it.type === 'avatar' ? it.val : it.ico}</div>
          <div class="shop-name">${esc(t('shop_' + it.id))}</div>
          ${own
            ? `<button type="button" class="px-btn small ${eq ? 'green' : 'cyan'}" data-equip="${it.id}">${eq ? '✔ ' + t('shopEquipped') : t('shopEquip')}</button>`
            : `<button type="button" class="px-btn small pink" data-buy="${it.id}">${t('shopBuy', { price: it.price })}</button>`}
        </div>`;
      };

      view.innerHTML = `${backBtn()}<section class="shop-sec">
        <div class="ach-head">
          <div><h1>${t('shopTitle')}</h1><p class="hint">${t('shopSub')}</p></div>
          <div class="tier-tag yellow" style="font-size:16px;padding:8px 14px">${t('coinsLbl', { n: coins })}</div>
        </div>
        <h2 class="sec">${t('shopAvatars')}</h2>
        <div class="shop-grid">${avItems.map(cardHtml).join('')}</div>
        <h2 class="sec">${t('shopSkins')}</h2>
        <div class="shop-grid">${skItems.map(cardHtml).join('')}</div>
      </section>`;

      $('#back').onclick = () => { Sfx.play('click'); screen(menu); };
      view.querySelectorAll('[data-buy]').forEach(b => b.onclick = async () => {
        const it = items.find(x => x.id === b.dataset.buy); if (!it) return;
        const c = getCoins();
        if (c < it.price) { toast(t('shopNeedCoins')); Sfx.play('bad'); return; }
        b.disabled = true;
        const nextUnlocked = [...new Set([...unlocked, it.id])];
        const nextSkins = Object.assign({}, skins);
        if (it.type === 'skin') nextSkins[it.game] = it.cls;
        await Supa.savePrefs({ coins: c - it.price, unlockedShop: nextUnlocked, skins: nextSkins });
        if (it.type === 'avatar' && Supa.user()) await Supa.updateProfile({ avatar: it.val });
        Sfx.play('coin');
        toast(t('shopBoughtToast', { name: t('shop_' + it.id) }));
        header(); renderShop();
      });
      view.querySelectorAll('[data-equip]').forEach(b => b.onclick = async () => {
        const it = items.find(x => x.id === b.dataset.equip); if (!it) return;
        Sfx.play('click');
        if (it.type === 'avatar') {
          if (Supa.user()) await Supa.updateProfile({ avatar: it.val });
          else toast(t('needLogin'));
        } else {
          const nextSkins = Object.assign({}, skins);
          if (nextSkins[it.game] === it.cls) delete nextSkins[it.game];
          else nextSkins[it.game] = it.cls;
          await Supa.savePrefs({ skins: nextSkins });
        }
        header(); renderShop();
      });
    }
    renderShop();
  }

  // ---------- PANEL OWNERA ----------
  async function ownerPanelScreen() {
    leaveGame(); currentScreen = 'owner'; rerender = ownerPanelScreen;
    const me = Supa.user();
    if (!isOwnerUser(me && me.id)) { screen(menu); return; }
    const my = tok;
    view.innerHTML = `${backBtn()}<section class="owner-sec"><h1>${t('ownerTitle')}</h1><p class="hint">${t('ownerSub')}</p><div id="owBody">${loaderHtml}</div></section>`;
    $('#back').onclick = () => { Sfx.play('click'); screen(menu); };
    const profs = await Supa.adminListProfiles();
    if (my !== tok) return;
    const box = $('#owBody');
    if (!profs || !profs.length) { box.innerHTML = `<p class="hint">${t('lbEmpty')}</p>`; return; }

    let selUid = profs[0].user_id;
    let selGame = Object.keys(Games)[0] || 'ttt';
    let selStats = await Supa.userStats(selUid, profs[0].nick);
    if (my !== tok) return;

    function renderOwner() {
      const prof = profs.find(x => x.user_id === selUid) || profs[0];
      const prefs = (prof.prefs && typeof prof.prefs === 'object') ? prof.prefs : {};
      const gStat = (selStats || []).find(s => s.game === selGame) || { points: 0, wins: 0, losses: 0, draws: 0, games: 0, best: '' };

      box.innerHTML = `<div class="panel owner-panel">
        <label class="field"><span>${t('ownerSelectPlayer')}</span>
          <select id="owPlayer">${profs.map(p => `<option value="${p.user_id}" ${p.user_id === selUid ? 'selected' : ''}>${esc(p.avatar || '👾')} ${esc(p.nick)} (${p.points || 0} pkt)</option>`).join('')}</select>
        </label>
        <div class="ow-grid">
          <label class="field"><span>${t('ownerBonusPts')}</span><input id="owPts" type="number" min="0" value="${prof.points || 0}"></label>
          <label class="field"><span>${t('ownerCoins')}</span><input id="owCoins" type="number" min="0" value="${Number(prefs.coins) || 0}"></label>
          <label class="field"><span>${t('avatar')}</span><input id="owAv" maxlength="4" value="${esc(prof.avatar || '👾')}"></label>
        </div>
        <button type="button" class="px-btn cyan" id="owSaveProf">💾 ${t('ownerSaveProf')}</button>

        <hr class="um-sep" style="margin:18px 0">
        <h3>📊 ${t('ownerGameStats')}</h3>
        <label class="field"><span>🎮 Gra</span>
          <select id="owGame">${Object.values(Games).map(g => `<option value="${g.id}" ${g.id === selGame ? 'selected' : ''}>${t(g.nameKey)} (${g.id})</option>`).join('')}</select>
        </label>
        <div class="ow-grid">
          <label class="field"><span>${t('lbPts')}</span><input id="ogPts" type="number" min="0" value="${gStat.points || 0}"></label>
          <label class="field"><span>${t('lbWins')}</span><input id="ogWins" type="number" min="0" value="${gStat.wins || 0}"></label>
          <label class="field"><span>Losses</span><input id="ogLoss" type="number" min="0" value="${gStat.losses || 0}"></label>
          <label class="field"><span>Draws</span><input id="ogDraw" type="number" min="0" value="${gStat.draws || 0}"></label>
          <label class="field"><span>${t('lbGames')}</span><input id="ogGames" type="number" min="0" value="${gStat.games || 0}"></label>
          <label class="field"><span>${t('lbBest')}</span><input id="ogBest" type="number" min="0" value="${gStat.best != null ? gStat.best : ''}" placeholder="null"></label>
        </div>
        <button type="button" class="px-btn pink" id="owSaveStat">💾 ${t('save')}</button>
      </div>`;

      $('#owPlayer', box).onchange = async (e) => {
        selUid = e.target.value;
        const pObj = profs.find(x => x.user_id === selUid);
        selStats = await Supa.userStats(selUid, pObj && pObj.nick);
        renderOwner();
      };
      $('#owGame', box).onchange = (e) => { selGame = e.target.value; renderOwner(); };
      $('#owSaveProf', box).onclick = async () => {
        const nextPts = Math.max(0, Number($('#owPts', box).value) || 0);
        const nextCoins = Math.max(0, Number($('#owCoins', box).value) || 0);
        const nextAv = ($('#owAv', box).value || '👾').trim() || '👾';
        const nextPrefs = Object.assign({}, prefs, { coins: nextCoins });
        const r = await Supa.adminUpdateProfile(prof.user_id, { points: nextPts, avatar: nextAv, prefs: nextPrefs });
        if (r.ok) {
          prof.points = nextPts; prof.avatar = nextAv; prof.prefs = nextPrefs;
          toast(t('ownerSaved')); Sfx.play('good'); header();
        } else { toast(r.error || t('actionErr')); Sfx.play('bad'); }
      };
      $('#owSaveStat', box).onclick = async () => {
        const row = {
          user_id: prof.user_id, nick: prof.nick, game: selGame,
          points: $('#ogPts', box).value, wins: $('#ogWins', box).value,
          losses: $('#ogLoss', box).value, draws: $('#ogDraw', box).value,
          games: $('#ogGames', box).value, best: $('#ogBest', box).value
        };
        const r = await Supa.adminUpsertStat(row);
        if (r.ok) {
          selStats = await Supa.userStats(prof.user_id, prof.nick);
          toast(t('ownerSaved')); Sfx.play('good'); renderOwner();
        } else { toast(r.error || t('actionErr')); Sfx.play('bad'); }
      };
    }
    renderOwner();
  }

  // ---------- HEADER ----------
  const userWrap = $('#userWrap'), userMenu = $('#userMenu'), userChip = $('#userChip');
  function closeUserMenu() {
    if (!userMenu) return;
    userMenu.hidden = true;
    if (userChip) userChip.setAttribute('aria-expanded', 'false');
  }
  function header() {
    I18N.apply(document);
    const lTxt = I18N.lang.toUpperCase();
    const mTxt = Sfx.muted ? '🔇' : '🔊';
    $('#langBtn').textContent = lTxt;
    $('#muteBtn').textContent = mTxt;
    if ($('#umLangBtn')) $('#umLangBtn').textContent = '🌐 ' + lTxt;
    if ($('#umMuteBtn')) $('#umMuteBtn').textContent = mTxt + ' ' + t('sound');
    const u = Supa.user();
    if (userWrap) userWrap.hidden = !u;
    userChip.hidden = !u;
    userChip.textContent = u ? (u.avatar || '👾') + ' ' + (isOwnerUser(u.id) ? '👑 ' : '') + u.nick + ' ▾' : '';
    if ($('#umOwnerItem')) $('#umOwnerItem').hidden = !isOwnerUser(u && u.id);
    if (!u) closeUserMenu();
    // Gdy zalogowany, opcje Znajomi / Dźwięk / Ustawienia / Język są w rozwijanym panelu profilu
    $('#friendsBtn').hidden = true;
    $('#muteBtn').hidden = !!u;
    $('#settingsBtn').hidden = !!u;
    $('#langBtn').hidden = !!u;
    $('#authBtn').hidden = !!u;
    $('#authBtn').textContent = t(u ? 'logout' : 'login');
    $('#authBtn').classList.toggle('pink', !u);
    $('#authBtn').classList.toggle('ghost', !!u);
  }
  $('#logoBtn').onclick = () => { Sfx.play('click'); closeUserMenu(); screen(menu); };
  $('#lbBtn').onclick = () => { Sfx.play('click'); closeUserMenu(); leaderboard(); };
  $('#friendsBtn').onclick = () => { Sfx.play('click'); closeUserMenu(); friends(); };
  userChip.onclick = (e) => {
    e.stopPropagation();
    if (!Supa.user()) return;
    Sfx.play('click');
    const open = userMenu.hidden;
    userMenu.hidden = !open;
    userChip.setAttribute('aria-expanded', String(open));
  };
  if (userMenu) {
    userMenu.querySelectorAll('[data-um]').forEach(b => b.onclick = async (e) => {
      e.stopPropagation();
      const act = b.dataset.um;
      if (act === 'mute') { Sfx.toggle(); header(); Sfx.play('click'); return; }
      if (act === 'lang') { I18N.set(I18N.lang === 'pl' ? 'en' : 'pl'); header(); Sfx.play('click'); if (rerender) rerender(); return; }
      closeUserMenu();
      Sfx.play('click');
      const nick = Supa.nick();
      if (act === 'profile' && nick) profile(nick, false, false);
      else if (act === 'badges') achievementsScreen();
      else if (act === 'shop') shopScreen();
      else if (act === 'owner') ownerPanelScreen();
      else if (act === 'friends') friends();
      else if (act === 'settings') settingsScreen();
      else if (act === 'logout') await Supa.signOut();
    });
  }
  document.addEventListener('click', (e) => {
    if (userMenu && !userMenu.hidden && !userWrap.contains(e.target)) closeUserMenu();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && userMenu && !userMenu.hidden) closeUserMenu();
  });
  $('#muteBtn').onclick = () => { Sfx.toggle(); header(); Sfx.play('click'); };
  $('#settingsBtn').onclick = () => { Sfx.play('click'); closeUserMenu(); settingsScreen(); };
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'm' && !current && !e.ctrlKey && !e.metaKey && !/INPUT|TEXTAREA/.test((document.activeElement || {}).tagName || '')) { Sfx.toggle(); header(); }
  });
  $('#langBtn').onclick = () => {
    I18N.set(I18N.lang === 'pl' ? 'en' : 'pl'); header();
    if (rerender) rerender();   // w trakcie gry nie przeładowujemy ekranu
  };
  Supa.onChange(header);

  header();
  screen(menu);
  Supa.init();

  // ekran startowy
  const intro = $('#intro');
  if (sessionStorage.getItem('intro')) intro.remove();
  else {
    const go = () => {
      document.removeEventListener('keydown', go); sessionStorage.setItem('intro', '1');
      Sfx.play('coin'); intro.classList.add('out'); setTimeout(() => intro.remove(), 700);
    };
    intro.onclick = go; document.addEventListener('keydown', go);
  }
})();
