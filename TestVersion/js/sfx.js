(function () {
  let ctx = null;
  const A = () => {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const vol = () => Settings.get('volume') / 70;

  // progresja Am – F – C – G
  const CH = [
    { b: 110, l: [440, 523.25, 659.25, 523.25] }, { b: 87.31, l: [349.23, 440, 523.25, 440] },
    { b: 130.81, l: [523.25, 659.25, 783.99, 659.25] }, { b: 98, l: [392, 493.88, 587.33, 493.88] }
  ];

  const Sfx = {
    _unlocked: false, _mt: null, _m: { step: 0, next: 0 },
    get muted() { return !Settings.get('sound'); },
    _tone(freq, dur, type = 'square', when = 0, v = 0.06) {
      if (Sfx.muted) return;
      try {
        const c = A(), o = c.createOscillator(), g = c.createGain();
        o.type = type; o.frequency.value = freq;
        const t0 = c.currentTime + Math.max(0, when);
        g.gain.setValueAtTime(v * vol(), t0);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(c.destination);
        o.start(t0); o.stop(t0 + dur);
      } catch (e) { /* audio not available */ }
    },
    play(name) {
      const T = Sfx._tone;
      switch (name) {
        case 'click': T(660, 0.06); break;
        case 'coin': T(988, 0.08); T(1319, 0.35, 'square', 0.08); break;
        case 'place': T(330, 0.08); T(440, 0.08, 'square', 0.07); break;
        case 'x': T(520, 0.09); break;
        case 'o': T(390, 0.09, 'triangle', 0, 0.1); break;
        case 'hit': T(160, 0.25, 'sawtooth', 0, 0.09); T(90, 0.3, 'square', 0.05); break;
        case 'miss': T(240, 0.15, 'triangle', 0, 0.09); break;
        case 'sunk': [200, 150, 100, 60].forEach((f, i) => T(f, 0.18, 'sawtooth', i * 0.09, 0.09)); break;
        case 'good': T(700, 0.08); T(900, 0.1, 'square', 0.07); break;
        case 'bad': T(180, 0.2, 'sawtooth'); break;
        case 'win': [523, 659, 784, 1046].forEach((f, i) => T(f, 0.16, 'square', i * 0.12)); break;
        case 'lose': [400, 330, 260, 180].forEach((f, i) => T(f, 0.2, 'sawtooth', i * 0.14)); break;
        case 'draw': T(440, 0.15); T(440, 0.15, 'square', 0.2); break;
      }
      if (window.Fx) Fx.onSound(name);
    },
    toggle() { Settings.set('sound', !Settings.get('sound')); },

    // ---- muzyka w tle ----
    refreshMusic() {
      const want = Settings.get('sound') && Settings.get('music') && Sfx._unlocked;
      if (want && !Sfx._mt) {
        const c = A(); Sfx._m.next = c.currentTime + 0.1;
        Sfx._mt = setInterval(Sfx._sched, 100);
      } else if (!want && Sfx._mt) { clearInterval(Sfx._mt); Sfx._mt = null; }
    },
    _sched() {
      const c = A(), m = Sfx._m;
      while (m.next < c.currentTime + 0.35) {
        const ch = CH[Math.floor(m.step / 8) % 4], i = m.step % 8, w = m.next - c.currentTime;
        if (i % 2 === 0) Sfx._tone(ch.b, 0.3, 'triangle', w, 0.1);
        Sfx._tone(ch.l[i % 4] * (i < 4 ? 1 : 2), 0.13, 'square', w, 0.028);
        m.step++; m.next += 0.17;
      }
    }
  };
  const unlock = () => {
    Sfx._unlocked = true;
    document.removeEventListener('pointerdown', unlock); document.removeEventListener('keydown', unlock);
    Sfx.refreshMusic();
  };
  document.addEventListener('pointerdown', unlock); document.addEventListener('keydown', unlock);
  window.Sfx = Sfx;
})();
