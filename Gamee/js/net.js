// Multiplayer przez Supabase Realtime (broadcast + presence) – bez żadnych tabel.
(function () {
  const Net = {
    ch: null, handler: null,
    id: Math.random().toString(36).slice(2),
    setHandler(fn) { Net.handler = fn; },
    send(payload) {
      if (Net.ch) Net.ch.send({ type: 'broadcast', event: 'g', payload });
    },
    connect(code, game, role, nick, cb) {
      const sb = Supa.client();
      if (!sb) { cb.error('onlineOff'); return; }
      Net.leave();
      const ch = sb.channel('arcade:' + code, {
        config: { broadcast: { self: false }, presence: { key: Net.id } }
      });
      Net.ch = ch;
      let started = false;

      ch.on('broadcast', { event: 'g' }, ({ payload }) => { if (Net.handler) Net.handler(payload); });
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
          await ch.track({ role, game, nick });
          if (role === 'guest') setTimeout(() => { if (Net.ch === ch && !started) cb.error('noRoom'); }, 4500);
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          cb.error('connErr');
        }
      });
    },
    leave() {
      Net.handler = null;
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
