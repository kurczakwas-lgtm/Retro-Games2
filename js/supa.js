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
        Supa._prof = data; Supa._user.avatar = data.avatar; Supa._user.bio = data.bio;
        Supa._subs.forEach(f => f());
      }
    },
    async dbReady() {
      const c = Supa.client(); if (!c) return 'no client';
      for (const tbl of ['profiles', 'friendships', 'scores']) {
        const { error } = await c.from(tbl).select('*', { head: true, count: 'exact' }).limit(1);
        if (error) return tbl + ': ' + error.message;
      }
      const { error } = await c.from('leaderboard').select('*', { head: true, count: 'exact' }).limit(1);
      return error ? 'leaderboard: ' + error.message : true;
    },
    async getProfile(nick) {
      const c = Supa.client(); if (!c) return null;
      const { data } = await c.from('profiles').select('*').eq('nick', nick).maybeSingle();
      return data;
    },
    async updateProfile(patch) {
      const c = Supa.client(); if (!c || !Supa._user) return false;
      const { error } = await c.from('profiles').update(patch).eq('user_id', Supa._user.id);
      if (!error) await Supa.loadProfile();
      return !error;
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
      return fs.map(f => ({ id: f.id, status: f.status, incoming: f.addressee === me.id,
        profile: map[f.requester === me.id ? f.addressee : f.requester] })).filter(x => x.profile);
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
    async score(game, mode, result, points) {
      const c = Supa.client(); if (!c || !Supa._user) return false;
      const { error } = await c.from('scores').insert({
        user_id: Supa._user.id, nick: Supa._user.nick, game, mode, result, points
      });
      return !error;
    },
    async leaderboard() {
      const c = Supa.client(); if (!c) return null;
      const { data, error } = await c.from('leaderboard').select('*').limit(2000);
      return error ? null : data;
    }
  };
  window.Supa = Supa;
})();
