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
  function leaveGame() {
    if (current && current.destroy) current.destroy();
    current = null; onLeft = null; Net.leave(); tok++; currentScreen = '';
  }
  const nickName = () => Supa.nick() || guestNick;
  const points = (mode, diff, res) => res === 'lose' ? 0 : res === 'draw' ? 1 : (mode === 'online' ? 5 : ({ easy: 1, normal: 2, hard: 3 }[diff] || 1));

  // ---------- MENU ----------
  function menu() {
    leaveGame();
    const games = Object.values(Games);
    view.innerHTML = `
      <section class="hero">
        <h1 class="title"><span>RETRO</span> <span class="alt">ARCADE</span></h1>
        <p class="tagline">${t('tagline')}</p>
      </section>
      <section class="cards">${games.map((g, gi) => `
        <button class="card ${g.color}" style="--i:${gi}" data-g="${g.id}" id="card-${g.id}">
          <div class="card-ico">${g.icon}</div>
          <h2>${t(g.nameKey)}</h2>
          <p>${t(g.descKey)}</p>
          <span class="card-play">▶ ${t('play')}</span>
        </button>`).join('')}</section>`;
    view.querySelectorAll('.card').forEach(c => {
      c.onclick = () => { Sfx.play('click'); screen(() => lobby(c.dataset.g)); };
      c.addEventListener('pointermove', (e) => {
        if (!Settings.get('motion') || e.pointerType !== 'mouse') return;
        const r = c.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
        c.style.setProperty('--ry', ((x - 0.5) * 14) + 'deg'); c.style.setProperty('--rx', ((0.5 - y) * 14) + 'deg');
        c.style.setProperty('--mx', (x * 100) + '%'); c.style.setProperty('--my', (y * 100) + '%');
      });
      c.addEventListener('pointerleave', () => { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); });
    });
  }

  // ---------- LOBBY ----------
  function lobby(gid) {
    leaveGame();
    const g = Games[gid], on = Supa.enabled();
    view.innerHTML = `
      <button class="px-btn small ghost back" id="back">← ${t('back')}</button>
      <section class="lobby">
        <div class="lobby-head"><div class="card-ico big">${g.icon}</div><h1>${t(g.nameKey)}</h1></div>
        <div class="panels">
          <div class="panel">
            <h2>🤖 ${t('vsBot')}</h2>
            <p class="hint">${t('difficulty')}</p>
            <div class="stack">
              ${gid === 'hangman' ? `<button class="px-btn cyan" data-d="normal">${t('play')}</button>` :
        ['easy', 'normal', 'hard'].map((d, i) => `<button class="px-btn ${['green', 'yellow', 'pink'][i]}" data-d="${d}">${t(d)}</button>`).join('')}
            </div>
          </div>
          <div class="panel">
            <h2>👥 ${t('online')}</h2>
            ${on ? `
              <button class="px-btn cyan wide" id="mk">${t('createRoom')}</button>
              <p class="hint">${t('joinRoom')}</p>
              <div class="join-row"><input id="code" maxlength="5" placeholder="${t('roomCode')}" autocomplete="off"><button class="px-btn pink" id="jn">${t('join')}</button></div>
            ` : `<p class="hint">${t('onlineOff')}</p>`}
          </div>
        </div>
      </section>`;
    $('#back').onclick = () => { Sfx.play('click'); screen(menu); };
    view.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { Sfx.play('click'); launch(gid, { mode: 'bot', difficulty: b.dataset.d }); });
    if (on) {
      $('#mk').onclick = () => { Sfx.play('click'); hostRoom(gid); };
      const join = () => { const c = $('#code').value.trim().toUpperCase(); if (c.length >= 4) { Sfx.play('click'); joinRoom(gid, c); } };
      $('#jn').onclick = join;
      $('#code').onkeydown = (e) => { if (e.key === 'Enter') join(); };
      $('#code').oninput = (e) => { e.target.value = e.target.value.toUpperCase(); };
    }
  }

  function netCallbacks(gid, role) {
    return {
      ready: (opp) => launch(gid, { mode: 'online', role, opp }),
      left: () => { if (onLeft) onLeft(); },
      error: (key) => { toast(t(key)); Net.leave(); screen(() => lobby(gid)); }
    };
  }
  function hostRoom(gid) {
    const code = Net.genCode();
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
      $('#cn').onclick = () => { Net.leave(); screen(() => lobby(gid)); };
    });
    Net.connect(code, gid, 'host', nickName(), netCallbacks(gid, 'host'));
  }
  function joinRoom(gid, code) {
    Net.connect(code, gid, 'guest', nickName(), netCallbacks(gid, 'guest'));
    screen(() => {
      view.innerHTML = `<section class="lobby wait"><h1>${code}</h1><div class="loader"><i></i><i></i><i></i></div>
        <button class="px-btn small ghost" id="cn">${t('cancel')}</button></section>`;
      $('#cn').onclick = () => { Net.leave(); screen(() => lobby(gid)); };
    });
  }

  // ---------- GAME ----------
  function launch(gid, opts) {
    const g = Games[gid];
    if (current && current.destroy) current.destroy();
    tok++; currentScreen = '';
    const lobbyGo = () => { leaveGame(); screen(() => lobby(gid)); };
    rerender = null;
    view.innerHTML = `
      <div class="game-head">
        <button class="px-btn small ghost" id="quit">← ${t('back')}</button>
        <h1>${t(g.nameKey)}</h1>
        <span class="vs">${opts.mode === 'online' ? `${t('you')}: ${nickName()} ⚔ ${(opts.opp && opts.opp.nick) || t('opponent')}` : `🤖 ${t(opts.difficulty)}`}</span>
      </div>
      <div id="stage" class="stage"></div>`;
    view.classList.remove('fade'); void view.offsetWidth; view.classList.add('fade');
    $('#quit').onclick = () => { Sfx.play('click'); lobbyGo(); }; wipe();
    onLeft = () => {
      const o = document.createElement('div'); o.className = 'overlay';
      o.innerHTML = `<div class="dlg-box"><h2>${t('oppLeft')}</h2><button class="px-btn pink" id="ol">${t('toLobby')}</button></div>`;
      view.appendChild(o); Sfx.play('lose'); $('#ol').onclick = lobbyGo;
    };
    const ctx = {
      mode: opts.mode, difficulty: opts.difficulty, role: opts.role, t, net: Net, sfx: Sfx,
      finish: (res) => finish(gid, opts.mode, opts.difficulty, res)
    };
    current = g.start($('#stage'), ctx);
  }

  async function finish(gid, mode, diff, res) {
    const pts = points(mode, diff, res);
    if (window.Fx) Fx.result(res);
    if (Supa.user()) {
      if (await Supa.score(gid, mode, res, pts) && pts > 0) toast(`+${pts} ${t('pts')}`);
    } else if (res === 'win' && !scoreHintShown && Supa.enabled()) { scoreHintShown = true; toast(t('loginForScore')); }
  }

  // ---------- LEADERBOARD ----------
  async function leaderboard(tab = 'all') {
    leaveGame(); currentScreen = 'lb'; const my = tok;
    view.innerHTML = `<button class="px-btn small ghost back" id="back">← ${t('back')}</button>
      <section class="lb"><h1>🏆 ${t('leaderboard')}</h1><div id="lbBody" class="lb-body"><div class="loader"><i></i><i></i><i></i></div></div></section>`;
    $('#back').onclick = () => screen(menu);
    const body = $('#lbBody');
    if (!Supa.enabled()) { body.innerHTML = `<p class="hint">${t('lbOff')}</p>`; return; }
    const rows = await Supa.leaderboard();
    if (my !== tok) return;
    if (!rows || !rows.length) { body.innerHTML = `<p class="hint">${t('lbEmpty')}</p>`; return; }
    const tabs = ['all', ...Object.keys(Games)];
    const agg = {};
    rows.filter(r => tab === 'all' || r.game === tab).forEach(r => {
      const a = agg[r.nick] || (agg[r.nick] = { nick: r.nick, avatar: r.avatar, points: 0, wins: 0, games: 0 });
      a.points += r.points; a.wins += r.wins; a.games += r.games;
    });
    const list = Object.values(agg).sort((a, b) => b.points - a.points).slice(0, 20);
    body.innerHTML = `
      <div class="tabs">${tabs.map(x => `<button class="tab ${x === tab ? 'on' : ''}" data-t="${x}">${x === 'all' ? t('lbAll') : t(Games[x].nameKey)}</button>`).join('')}</div>
      <table class="lb-table"><thead><tr><th>#</th><th>${t('lbPlayer')}</th><th>${t('lbPts')}</th><th>${t('lbWins')}</th><th>${t('lbGames')}</th></tr></thead>
      <tbody>${list.map((r, i) => `<tr class="${r.nick === Supa.nick() ? 'me' : ''}"><td>${['🥇', '🥈', '🥉'][i] || i + 1}</td><td><button class="nick-link" data-nick="${esc(r.nick)}">${r.avatar || '👾'} ${esc(r.nick)}</button></td><td>${r.points}</td><td>${r.wins}</td><td>${r.games}</td></tr>`).join('')}</tbody></table>`;
    body.querySelectorAll('.tab').forEach(b => b.onclick = () => { Sfx.play('click'); leaderboard(b.dataset.t); });
    bindNicks(body);
  }
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------- PROFILE / FRIENDS ----------
  const AVATARS = ['👾', '🤖', '👻', '🐱', '🐸', '🦊', '🐉', '🚀', '🎮', '💀', '🦄', '🐙'];
  const fmtDate = (d) => new Date(d).toLocaleDateString(I18N.lang === 'pl' ? 'pl-PL' : 'en-GB');
  const loaderHtml = '<div class="loader"><i></i><i></i><i></i></div>';
  const backBtn = () => `<button class="px-btn small ghost back" id="back">← ${t('back')}</button>`;
  function bindNicks(root) {
    root.querySelectorAll('.nick-link').forEach(b => b.onclick = () => { Sfx.play('click'); profile(b.dataset.nick); });
  }
  const friendRow = (p, actions) => `<div class="fr-item"><span class="avatar">${p.avatar}</span>
    <button class="nick-link" data-nick="${esc(p.nick)}">${esc(p.nick)}</button>
    <span class="dot ${Social.isOnline(p.user_id) ? 'on' : ''}"></span><small class="hint">${t(Social.isOnline(p.user_id) ? 'isOnline' : 'isOffline')}</small>
    <span class="fr-actions">${actions}</span></div>`;

  async function profile(nick) {
    leaveGame(); currentScreen = 'profile'; rerender = () => profile(nick);
    const my = tok;
    view.innerHTML = `${backBtn()}<section class="prof">${loaderHtml}</section>`;
    $('#back').onclick = () => screen(menu);
    const box = $('.prof');
    if (!Supa.enabled()) { box.innerHTML = `<p class="hint">${t('lbOff')}</p>`; return; }
    const p = await Supa.getProfile(nick);
    if (my !== tok) return;
    if (!p) { box.innerHTML = `<p class="hint">${t('notFound')}</p>`; return; }
    const me = Supa.user(), mine = !!me && me.id === p.user_id;
    const [rows, recent, rels] = await Promise.all([Supa.leaderboard(), Supa.recent(p.user_id), (me && !mine) ? Supa.friendsOverview() : []]);
    if (my !== tok) return;
    const st = Object.values(Games).map(g => {
      const r = (rows || []).find(x => x.nick === p.nick && x.game === g.id) || {};
      return { g, games: r.games || 0, wins: r.wins || 0, points: r.points || 0 };
    });
    const tot = st.reduce((a, s) => ({ games: a.games + s.games, wins: a.wins + s.wins, points: a.points + s.points }), { games: 0, wins: 0, points: 0 });
    const rel = rels.find(r => r.profile.user_id === p.user_id);
    let action = '';
    if (me && !mine) {
      if (!rel) action = `<button class="px-btn pink" id="pAct">${t('addFriend')}</button>`;
      else if (rel.status === 'pending' && !rel.incoming) action = `<button class="px-btn ghost" id="pAct">${t('reqSent')} · ${t('cancelReq')}</button>`;
      else if (rel.status === 'pending') action = `<button class="px-btn green" id="pAct">${t('accept')}</button>`;
      else action = `<span class="hint">✔ ${t('friendOk')}</span> <button class="px-btn small ghost" id="pAct">${t('removeFriend')}</button>`;
    }
    let chosen = p.avatar;
    box.innerHTML = `
      <div class="prof-head">
        <div class="avatar big" id="bigAv">${p.avatar}</div>
        <div class="prof-info">
          <h1>${esc(p.nick)} <span class="dot ${Social.isOnline(p.user_id) ? 'on' : ''}"></span></h1>
          <p class="bio">${esc(p.bio || '')}</p>
          <p class="hint">${t('since')} ${fmtDate(p.created_at)}</p>
          <div class="row left">${action}</div>
        </div>
      </div>
      ${mine ? `<div class="panel edit">
        <h2>${t('avatar')}</h2>
        <div class="avatars">${AVATARS.map(a => `<button class="av-opt ${a === p.avatar ? 'on' : ''}" data-a="${a}">${a}</button>`).join('')}</div>
        <label class="field"><span>${t('bio')}</span><input id="bioIn" maxlength="80" placeholder="${t('bioPh')}" value="${esc(p.bio || '')}"></label>
        <button class="px-btn pink" id="saveP">${t('save')}</button>
      </div>` : ''}
      <div class="panel"><h2>${t('totalStats')}</h2>
        <table class="lb-table"><thead><tr><th></th><th>${t('lbGames')}</th><th>${t('lbWins')}</th><th>${t('lbPts')}</th></tr></thead><tbody>
        ${st.map(s => `<tr><td>${t(s.g.nameKey)}</td><td>${s.games}</td><td>${s.wins}</td><td>${s.points}</td></tr>`).join('')}
        <tr class="me"><td>Σ</td><td>${tot.games}</td><td>${tot.wins}</td><td>${tot.points}</td></tr></tbody></table></div>
      <div class="panel"><h2>${t('recent')}</h2>
        ${recent.length ? `<ul class="recent">${recent.map(x => `<li><span>${Games[x.game] ? t(Games[x.game].nameKey) : x.game}</span><span>${x.mode === 'bot' ? 'Bot' : 'Online'}</span>
          <b class="r-${x.result}">${t({ win: 'rW', lose: 'rL', draw: 'rD' }[x.result])}</b><span>+${x.points}</span><small class="hint">${fmtDate(x.created_at)}</small></li>`).join('')}</ul>` : `<p class="hint">${t('lbEmpty')}</p>`}
      </div>`;
    if (mine) {
      box.querySelectorAll('.av-opt').forEach(b => b.onclick = () => {
        chosen = b.dataset.a; Sfx.play('click'); $('#bigAv').textContent = chosen;
        box.querySelectorAll('.av-opt').forEach(x => x.classList.toggle('on', x === b));
      });
      $('#saveP').onclick = async () => {
        const ok = await Supa.updateProfile({ avatar: chosen, bio: $('#bioIn').value.trim().slice(0, 80) });
        toast(ok ? t('saved') : t('actionErr')); Sfx.play(ok ? 'good' : 'bad');
      };
    }
    const act = $('#pAct');
    if (act) act.onclick = async () => {
      let ok;
      if (!rel) ok = await Supa.addFriend(p.user_id);
      else if (rel.status === 'pending' && rel.incoming) ok = await Supa.acceptFriend(rel.id);
      else ok = await Supa.removeFriend(rel.id);
      toast(ok ? '✔' : t('actionErr')); profile(nick);
    };
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
        sec(`💚 ${t('friendsList')}`, fr.map(x => friendRow(x.profile, `<button class="px-btn small ghost" data-act="remove" data-id="${x.id}">✕</button>`)).join('')) +
        sec(`⏳ ${t('sentReq')}`, sent.map(x => friendRow(x.profile, `<button class="px-btn small ghost" data-act="remove" data-id="${x.id}">${t('cancelReq')}</button>`)).join('')) +
        (list.length ? '' : `<p class="hint">${t('noFriends')}</p>`);
      bindNicks($('#flist'));
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

  // ---------- HEADER ----------
  function header() {
    I18N.apply(document);
    $('#langBtn').textContent = I18N.lang.toUpperCase();
    $('#muteBtn').textContent = Sfx.muted ? '🔇' : '🔊';
    const u = Supa.user(), chip = $('#userChip');
    chip.hidden = !u; chip.textContent = u ? (u.avatar || '👾') + ' ' + u.nick : '';
    $('#friendsBtn').hidden = !u;
    $('#authBtn').textContent = t(u ? 'logout' : 'login');
    $('#authBtn').classList.toggle('pink', !u);
    $('#authBtn').classList.toggle('ghost', !!u);
  }
  $('#logoBtn').onclick = () => { Sfx.play('click'); screen(menu); };
  $('#lbBtn').onclick = () => { Sfx.play('click'); rerender = () => leaderboard(); leaderboard(); };
  $('#friendsBtn').onclick = () => { Sfx.play('click'); friends(); };
  $('#userChip').onclick = () => { if (Supa.user()) { Sfx.play('click'); profile(Supa.nick()); } };
  $('#muteBtn').onclick = () => { Sfx.toggle(); header(); Sfx.play('click'); };
  $('#settingsBtn').onclick = () => { Sfx.play('click'); settingsScreen(); };
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
