// Multiplayer przez Supabase Realtime (broadcast + presence) – bez żadnych tabel.
(function () {
  const Net = {
    ch: null, handler: null, onChat: null,
    lobbyHostCh: null, lobbyWatchCh: null,
    id: Math.random().toString(36).slice(2),
    setHandler(fn) { Net.handler = fn; },
    send(payload) {
      if (Net.ch) Net.ch.send({ type: 'broadcast', event: 'g', payload });
    },
    sendChat(emo, nick) {
      if (Net.ch) Net.ch.send({ type: 'broadcast', event: 'g', payload: { _chat: true, emo, nick } });
    },
    hostLobby(info) {
      const sb = Supa.client();
      if (!sb) return;
      Net.leaveLobby();
      Net.unwatchLobby();
      const ch = sb.channel('arcade-lobby', { config: { presence: { key: 'h_' + Net.id } } });
      Net.lobbyHostCh = ch;
      ch.subscribe(async (status) => {
        if (Net.lobbyHostCh === ch && status === 'SUBSCRIBED') {
          await ch.track(Object.assign({ id: Net.id, ts: Date.now() }, info || {}));
        }
      });
    },
    leaveLobby() {
      const sb = Supa.client();
      if (Net.lobbyHostCh && sb) sb.removeChannel(Net.lobbyHostCh);
      Net.lobbyHostCh = null;
    },
    watchLobby(game, onList) {
      const sb = Supa.client();
      if (!sb) return;
      Net.unwatchLobby();
      if (Net.lobbyHostCh) return;
      const lch = sb.channel('arcade-lobby', { config: { presence: { key: 'w_' + Net.id } } });
      Net.lobbyWatchCh = lch;
      lch.on('presence', { event: 'sync' }, () => {
        if (Net.lobbyWatchCh !== lch) return;
        const all = Object.values(lch.presenceState()).flat().filter(r => r && r.code && (!game || r.game === game));
        all.sort((a, b) => (b.ts || 0) - (a.ts || 0));
        onList(all);
      });
      lch.subscribe();
    },
    unwatchLobby() {
      const sb = Supa.client();
      if (Net.lobbyWatchCh && sb) sb.removeChannel(Net.lobbyWatchCh);
      Net.lobbyWatchCh = null;
    },
    connect(code, game, role, nick, cb, extra) {
      const sb = Supa.client();
      if (!sb) { cb.error('onlineOff'); return; }
      Net.leave();
      const ch = sb.channel('arcade:' + code, {
        config: { broadcast: { self: false }, presence: { key: Net.id } }
      });
      Net.ch = ch;
      let started = false;

      ch.on('broadcast', { event: 'g' }, ({ payload }) => {
        if (payload && payload._chat) { if (Net.onChat) Net.onChat(payload); return; }
        if (Net.handler) Net.handler(payload);
      });
      ch.on('presence', { event: 'sync' }, () => {
        if (Net.ch !== ch) return;
        const metas = Object.values(ch.presenceState()).flat();
        const others = metas.filter(m => m.role !== role);
        if (!started && role === 'guest' && others[0] && others[0].game !== game) { cb.error('wrongGame'); return; }
        if (!started && role === 'guest' && metas.filter(m => m.role === 'guest').length > 1) { cb.error('roomFull'); return; }
        if (!started && others.length === 1 && others[0].game === game) {
          started = true; cb.ready(others[0]);
        } else if (started && others.length === 0) {
          cb.left();
        }
      });
      ch.subscribe(async (status) => {
        if (Net.ch !== ch) return;
        if (status === 'SUBSCRIBED') {
          await ch.track(Object.assign({ role, game, nick }, extra || {}));
          if (role === 'guest') setTimeout(() => { if (Net.ch === ch && !started) cb.error('noRoom'); }, 4500);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          cb.error('connErr');
        }
      });
    },
    leave() {
      Net.handler = null;
      Net.onChat = null;
      const sb = Supa.client();
      if (Net.ch && sb) sb.removeChannel(Net.ch);
      Net.ch = null;
    },
    genCode() {
      const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
      let s = ''; for (let i = 0; i < 5; i++) s += a[Math.floor(Math.random() * a.length)];
      return s;
    }
  };
  window.Net = Net;
})();
