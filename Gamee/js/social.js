// Obecność znajomych online + zaproszenia do gry (Supabase Realtime, bez tabel).
(function () {
  const Social = {
    online: new Set(), _presence: null, _inbox: null, _uid: null,
    _subs: [], onlineSubs: [], onInvite: null,
    onPresence(f) { Social.onlineSubs.push(f); },
    isOnline(uid) { return Social.online.has(uid); },
    start() {
      const sb = Supa.client(), u = Supa.user();
      if (!sb || !u || Social._uid === u.id) return;
      Social.stop();
      Social._uid = u.id;
      const p = sb.channel('arcade-online', { config: { presence: { key: u.id } } });
      p.on('presence', { event: 'sync' }, () => {
        Social.online = new Set(Object.keys(p.presenceState()));
        Social.onlineSubs.forEach(f => f());
      });
      p.subscribe(async (s) => { if (s === 'SUBSCRIBED') await p.track({ nick: u.nick }); });
      Social._presence = p;

      const inbox = sb.channel('inbox:' + u.id);
      inbox.on('broadcast', { event: 'invite' }, ({ payload }) => { if (Social.onInvite) Social.onInvite(payload); });
      inbox.subscribe();
      Social._inbox = inbox;
    },
    stop() {
      const sb = Supa.client();
      if (sb) { if (Social._presence) sb.removeChannel(Social._presence); if (Social._inbox) sb.removeChannel(Social._inbox); }
      Social._presence = Social._inbox = Social._uid = null; Social.online = new Set();
      Social.onlineSubs.forEach(f => f());
    },
    invite(friendId, game, code) {
      const sb = Supa.client(), u = Supa.user(); if (!sb || !u) return;
      const ch = sb.channel('inbox:' + friendId);
      ch.subscribe((s) => {
        if (s === 'SUBSCRIBED') {
          ch.send({ type: 'broadcast', event: 'invite', payload: { nick: u.nick, avatar: u.avatar, game, code } });
          setTimeout(() => sb.removeChannel(ch), 800);
        }
      });
    }
  };
  Supa.onChange(() => { if (Supa.user()) Social.start(); else Social.stop(); });
  window.Social = Social;
})();
