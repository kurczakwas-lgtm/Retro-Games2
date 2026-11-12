(function () {
  const Supa = {
    _c: null, _user: null, _subs: [],
    enabled() {
      const c = window.CONFIG || {};
      return !!(window.supabase && c.SUPABASE_URL && c.SUPABASE_ANON_KEY &&
        !c.SUPABASE_URL.startsWith('YOUR') && !c.SUPABASE_ANON_KEY.startsWith('YOUR'));
    },
    client() {
      if (!Supa.enabled()) return null;
      if (!Supa._c) Supa._c = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, { realtime: { params: { eventsPerSecond: 40 } } });
      return Supa._c;
    },
    async init() {
      const c = Supa.client(); if (!c) return;
      const { data } = await c.auth.getSession();
      Supa._set(data.session);
      c.auth.onAuthStateChange((_e, s) => Supa._set(s));
    },
    _set(s) {
      const prev = Supa._user && Supa._user.id;
      Supa._user = s ? { id: s.user.id, nick: (s.user.user_metadata && s.user.user_metadata.nick) || '???', avatar: '👾', bio: '' } : null;
      if (Supa._user && prev === Supa._user.id && Supa._prof) { Supa._user.avatar = Supa._prof.avatar; Supa._user.bio = Supa._prof.bio; }
      Supa._subs.forEach(f => f());
      if (Supa._user && prev !== Supa._user.id) Supa.loadProfile();
      if (!Supa._user) Supa._prof = null;
    },
    async loadProfile() {
      const c = Supa.client(), u = Supa._user; if (!c || !u) return;
      let { data } = await c.from('profiles').select('*').eq('user_id', u.id).maybeSingle();
      if (!data) { const r = await c.from('profiles').insert({ user_id: u.id, nick: u.nick }).select().maybeSingle(); data = r.data; }
      if (data && Supa._user && Supa._user.id === u.id) {
        Supa._prof = data; Supa._user.avatar = data.avatar; Supa._user.bio = data.bio; Supa._user.prefs = data.prefs || {};
        Supa._subs.forEach(f => f());
      }
    },
    async dbReady() {
      const c = Supa.client(); if (!c) return 'no client';
      for (const tbl of ['profiles', 'stats', 'scores', 'friendships']) {
        const { error } = await c.from(tbl).select('*', { head: true, count: 'exact' }).limit(1);
        if (error) return tbl + ': ' + error.message;
      }
      return true;
    },
    async getProfile(nick) {
      const c = Supa.client(); if (!c) return null;
      const { data } = await c.from('profiles').select('*').eq('nick', nick).maybeSingle();
      if (data) {
        let loc = {};
        try { loc = JSON.parse(localStorage.getItem('prof_prefs_' + data.nick.toLowerCase()) || '{}'); } catch (e) { }
        data.prefs = Object.assign({}, loc, data.prefs || {});
      }
      return data;
    },
    async updateProfile(patch) {
      const c = Supa.client(); if (!c || !Supa._user) return false;
      if (patch.prefs && Supa._user.nick) {
        try { localStorage.setItem('prof_prefs_' + Supa._user.nick.toLowerCase(), JSON.stringify(patch.prefs)); } catch (e) { }
      }
      let { error } = await c.from('profiles').update(patch).eq('user_id', Supa._user.id);
      if (error && patch.prefs !== undefined) {
        // Fallback jeśli baza nie ma jeszcze kolumny prefs
        const { prefs, ...rest } = patch;
        const r2 = await c.from('profiles').update(rest).eq('user_id', Supa._user.id);
        error = r2.error;
      }
      if (!error) await Supa.loadProfile();
      return !error;
    },
    async addBonusPoints(delta) {
      const c = Supa.client(); if (!c || !Supa._user) return false;
      const { data } = await c.from('profiles').select('points').eq('user_id', Supa._user.id).maybeSingle();
      const cur = (data && data.points) || 0;
      const { error } = await c.from('profiles').update({ points: cur + delta }).eq('user_id', Supa._user.id);
      if (!error) await Supa.loadProfile();
      return !error;
    },
    myPrefs() {
      const p = (Supa._prof && Supa._prof.prefs) || (Supa._user && Supa._user.prefs);
      if (p && typeof p === 'object') return Object.assign({}, p);
      const n = Supa.nick();
      if (n) { try { return JSON.parse(localStorage.getItem('prof_prefs_' + n.toLowerCase()) || '{}'); } catch (e) {} }
      try { return JSON.parse(localStorage.getItem('guest_prefs') || '{}'); } catch (e) {}
      return {};
    },
    async savePrefs(patch) {
      const cur = Supa.myPrefs();
      const next = Object.assign({}, cur, patch);
      if (!Supa._user) {
        try { localStorage.setItem('guest_prefs', JSON.stringify(next)); } catch (e) {}
        return next;
      }
      if (Supa._prof) Supa._prof.prefs = next;
      if (Supa._user) Supa._user.prefs = next;
      await Supa.updateProfile({ prefs: next });
      return next;
    },
    async recent(userId) {
      const c = Supa.client(); if (!c) return [];
      const { data } = await c.from('scores').select('game,mode,result,points,created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10);
      return data || [];
    },
    async searchProfiles(q) {
      const c = Supa.client(); if (!c || !Supa._user) return [];
      const esc = q.replace(/[%_\\]/g, m => '\\' + m);
      const { data } = await c.from('profiles').select('*').ilike('nick', esc + '%').neq('user_id', Supa._user.id).limit(8);
      return data || [];
    },
    // lista relacji: [{id,status,incoming,profile}]
    async friendsOverview() {
      const c = Supa.client(), me = Supa._user; if (!c || !me) return [];
      const { data: fs } = await c.from('friendships').select('*').or(`requester.eq.${me.id},addressee.eq.${me.id}`);
      if (!fs || !fs.length) return [];
      const ids = fs.map(f => f.requester === me.id ? f.addressee : f.requester);
      const { data: ps } = await c.from('profiles').select('*').in('user_id', ids);
      const map = {}; (ps || []).forEach(p => map[p.user_id] = p);
      return fs.map(f => ({
        id: f.id, status: f.status, incoming: f.addressee === me.id,
        profile: map[f.requester === me.id ? f.addressee : f.requester]
      })).filter(x => x.profile);
    },
    async addFriend(userId) {
      const c = Supa.client(); if (!c || !Supa._user) return false;
      const { error } = await c.from('friendships').insert({ requester: Supa._user.id, addressee: userId });
      return !error;
    },
    async acceptFriend(id) {
      const c = Supa.client(); if (!c) return false;
      const { error } = await c.from('friendships').update({ status: 'accepted' }).eq('id', id);
      return !error;
    },
    async removeFriend(id) {
      const c = Supa.client(); if (!c) return false;
      const { error } = await c.from('friendships').delete().eq('id', id);
      return !error;
    },
    user() { return Supa._user; },
    nick() { return Supa._user ? Supa._user.nick : null; },
    onChange(f) { Supa._subs.push(f); },
    _email(nick) { return nick.toLowerCase() + '@arcade-games.app'; },
    validNick(n) { return /^[A-Za-z0-9_]{3,16}$/.test(n); },
    async signUp(nick, pw) {
      const c = Supa.client(); if (!c) return 'authOff';
      if (!Supa.validNick(nick)) return 'badNick';
      const { data, error } = await c.auth.signUp({ email: Supa._email(nick), password: pw, options: { data: { nick } } });
      if (error) return /already|registered/i.test(error.message) ? 'nickTaken' : error.message;
      if (!data.session) return 'confirmMail';
      return null;
    },
    async signIn(nick, pw) {
      const c = Supa.client(); if (!c) return 'authOff';
      const { error } = await c.auth.signInWithPassword({ email: Supa._email(nick), password: pw });
      if (error) return /invalid/i.test(error.message) ? 'badLogin' : error.message;
      return null;
    },
    async signOut() { const c = Supa.client(); if (c) await c.auth.signOut(); },
    // punkty liczy serwer (trigger), a jeśli baza ma jeszcze stary schemat – fallback liczy po stronie klienta
    _calcPts(game, mode, result, difficulty, value) {
      if (mode === 'online') return result === 'win' ? 5 : result === 'draw' ? 1 : 0;
      if (mode === 'bot') return result === 'win' ? (difficulty === 'hard' ? 3 : difficulty === 'normal' ? 2 : 1) : (result === 'draw' && difficulty !== 'easy' ? 1 : 0);
      const v = Math.max(0, Math.round(value || 0));
      if (game === 'tetris' || game === 'g2048') return Math.min(5, Math.floor(v / 1500));
      if (game === 'breakout') return Math.min(5, Math.floor(v / 600));
      if (game === 'flappy') return Math.min(5, Math.floor(v / 6));
      if (game === 'invaders') return Math.min(5, Math.floor(v / 500));
      if (game === 'pacman') return Math.min(5, Math.floor(v / 400));
      if (game === 'wordle') return result === 'win' ? Math.min(5, Math.max(1, Math.floor(v / 250))) : 0;
      if (game === 'mines' || game === 'memory') return result === 'win' ? (difficulty === 'hard' ? 5 : difficulty === 'normal' ? 3 : 1) : 0;
      return 0;
    },
    async score(game, mode, result, difficulty, value) {
      const c = Supa.client(); if (!c || !Supa._user) return null;
      const pts = Supa._calcPts(game, mode, result, difficulty, value);
      const row = { user_id: Supa._user.id, nick: Supa._user.nick, game, mode, result, points: pts, difficulty: difficulty || null, value: Math.max(0, Math.round(value || 0)) };
      let { data, error } = await c.from('scores').insert(row).select('points').maybeSingle();
      if (error) {
        // Fallback dla starego schematu bazy (bez kolumn difficulty/value lub bez trybu 'solo')
        const legacyRow = {
          user_id: Supa._user.id,
          nick: Supa._user.nick,
          game,
          mode: mode === 'solo' ? 'bot' : mode,
          result: result === 'win' || result === 'lose' || result === 'draw' ? result : 'lose',
          points: Math.max(0, Math.min(5, pts))
        };
        const r2 = await c.from('scores').insert(legacyRow).select('points').maybeSingle();
        if (r2.error) { console.warn('score:', r2.error.message); return null; }
        return r2.data ? r2.data.points : legacyRow.points;
      }
      return data ? data.points : pts;
    },
    seasonBounds(period = 'season') {
      const now = Date.now();
      if (period === 'month') {
        const d = new Date(now);
        const startMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1, 0, 0, 0);
        const endMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1, 0, 0, 0);
        return { period: 'month', seasonNum: d.getUTCMonth() + 1, startMs, endMs, sinceIso: new Date(startMs).toISOString() };
      }
      if (period === 'season') {
        const epoch = Date.UTC(2026, 0, 1, 0, 0, 0);
        const cycle = 14 * 86400000; // 2 tygodnie (14 dni)
        const idx = Math.max(0, Math.floor((now - epoch) / cycle));
        const startMs = epoch + idx * cycle;
        const endMs = startMs + cycle;
        return { period: 'season', seasonNum: idx + 1, startMs, endMs, sinceIso: new Date(startMs).toISOString() };
      }
      return { period: 'all', seasonNum: null, startMs: null, endMs: null, sinceIso: null };
    },
    async leaderboard(period) {
      const c = Supa.client(); if (!c) return null;
      const { data: profs } = await c.from('profiles').select('user_id,nick,avatar,points,prefs');
      const pMap = {};
      (profs || []).forEach(p => { pMap[p.user_id] = p; });

      if (period === 'season' || period === 'month' || period === 'week') {
        const since = period === 'week'
          ? new Date(Date.now() - 7 * 86400000).toISOString()
          : Supa.seasonBounds(period).sinceIso;
        const [{ data: sc, error }, { data: stSeason }] = await Promise.all([
          c.from('scores').select('user_id,nick,game,points,result').gte('created_at', since).limit(5000),
          c.from('stats').select('*').gte('updated_at', since).limit(5000)
        ]);
        if (error) return null;
        const map = {};
        (sc || []).forEach(s => {
          const pr = pMap[s.user_id] || {};
          const k = (s.user_id || s.nick) + ':' + s.game;
          const a = map[k] || (map[k] = { user_id: s.user_id, nick: pr.nick || s.nick, avatar: pr.avatar || '👾', prefs: pr.prefs || {}, game: s.game, points: 0, wins: 0, games: 0 });
          a.points += s.points || 0; if (s.result === 'win') a.wins++; a.games++;
        });
        // Uwzględnij też wpisy z tabeli stats zaktualizowane w bieżącym sezonie (np. ręcznie edytowane w bazie)
        (stSeason || []).forEach(r => {
          const pr = pMap[r.user_id] || {};
          const k = (r.user_id || r.nick) + ':' + r.game;
          const a = map[k];
          if (!a) {
            map[k] = { user_id: r.user_id, nick: pr.nick || r.nick, avatar: pr.avatar || '👾', prefs: pr.prefs || {}, game: r.game, points: r.points || 0, wins: r.wins || 0, games: r.games || 0 };
          }
        });
        const outSeason = Object.values(map);
        (profs || []).forEach(p => {
          if (p.points || (p.prefs && Object.keys(p.prefs).length)) outSeason.push({ user_id: p.user_id, nick: p.nick, avatar: p.avatar || '👾', prefs: p.prefs || {}, game: 'bonus', points: p.points || 0, wins: 0, games: 0 });
        });
        return outSeason;
      }

      const { data: st, error } = await c.from('stats').select('*').limit(5000);
      if (error) return null;
      const out = (st || []).map(r => {
        const pr = pMap[r.user_id] || {};
        return {
          user_id: r.user_id,
          nick: pr.nick || r.nick,
          avatar: pr.avatar || '👾',
          prefs: pr.prefs || {},
          game: r.game,
          points: r.points || 0,
          wins: r.wins || 0,
          losses: r.losses || 0,
          draws: r.draws || 0,
          games: r.games || 0,
          best: r.best
        };
      });
      // Dodaj każdego zarejestrowanego gracza z tabeli profiles (oraz ręcznie przyznane punkty z kolumny points)
      (profs || []).forEach(p => {
        out.push({ user_id: p.user_id, nick: p.nick, avatar: p.avatar || '👾', prefs: p.prefs || {}, game: 'bonus', points: p.points || 0, wins: 0, games: 0 });
      });
      return out;
    },
    async highscores() {
      const c = Supa.client(); if (!c) return [];
      const { data, error } = await c.from('stats').select('user_id,nick,game,best').not('best', 'is', null).limit(5000);
      return error || !data ? [] : data;
    },
    // pobiera statystyki konkretnego gracza z tabeli public.stats (z fallbackiem do scores)
    async userStats(userId, nick) {
      const c = Supa.client(); if (!c) return [];
      const { data, error } = await c.from('stats').select('*').eq('user_id', userId);
      if (!error && data && data.length) return data;
      // Fallback: przeliczenie na żywo z tabeli scores, jeśli tabela stats jest pusta lub jeszcze nie istnieje
      const r2 = await c.from('scores').select('user_id,nick,game,mode,result,points,value').eq('user_id', userId).limit(5000);
      if (r2.error || !r2.data) return [];
      const map = {};
      r2.data.forEach(s => {
        const a = map[s.game] || (map[s.game] = { user_id: userId, nick: nick || s.nick, game: s.game, games: 0, wins: 0, losses: 0, draws: 0, points: 0, best: null });
        a.games++;
        if (s.result === 'win') a.wins++;
        else if (s.result === 'lose') a.losses++;
        else if (s.result === 'draw') a.draws++;
        a.points += s.points || 0;
        if (s.mode === 'solo' && s.value > 0) {
          if (s.game === 'mines' || s.game === 'memory') {
            if (s.result === 'win') a.best = a.best === null ? s.value : Math.min(a.best, s.value);
          } else {
            a.best = a.best === null ? s.value : Math.max(a.best, s.value);
          }
        }
      });
      return Object.values(map);
    },
    // Panel Ownera: lista graczy i edycja profili / statystyk (chronione przez RLS w supabase.sql)
    async adminListProfiles() {
      const c = Supa.client(); if (!c) return [];
      const { data, error } = await c.from('profiles').select('user_id,nick,avatar,points,bio,prefs').order('points', { ascending: false }).limit(200);
      return error || !data ? [] : data;
    },
    async adminUpdateProfile(userId, patch) {
      const c = Supa.client(); if (!c) return { ok: false };
      const { error } = await c.from('profiles').update(patch).eq('user_id', userId);
      if (error) return { ok: false, error: error.message };
      if (Supa._user && Supa._user.id === userId) await Supa.loadProfile();
      return { ok: true };
    },
    async adminUpsertStat(row) {
      const c = Supa.client(); if (!c) return { ok: false };
      const payload = {
        user_id: row.user_id,
        nick: row.nick,
        game: row.game,
        points: Math.max(0, Number(row.points) || 0),
        wins: Math.max(0, Number(row.wins) || 0),
        losses: Math.max(0, Number(row.losses) || 0),
        draws: Math.max(0, Number(row.draws) || 0),
        games: Math.max(0, Number(row.games) || 0),
        best: row.best === '' || row.best === null || row.best === undefined ? null : Math.max(0, Number(row.best) || 0),
        updated_at: new Date().toISOString()
      };
      const { error } = await c.from('stats').upsert(payload, { onConflict: 'user_id,game' });
      return error ? { ok: false, error: error.message } : { ok: true };
    }
  };
  window.Supa = Supa;
})();
