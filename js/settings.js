// Ustawienia zapisywane w przeglądarce (localStorage).
(function () {
  const KEY = 'arcade.settings';
  const DEF = { sound: true, volume: 70, music: false, theme: 'synth', crt: true, bgAnim: true, motion: true, fx: true, shake: true, trail: false };
  let S = Object.assign({}, DEF);
  try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch (e) { /* ignore */ }
  if (!localStorage.getItem(KEY) && localStorage.getItem('muted') === '1') S.sound = false;

  const save = () => localStorage.setItem(KEY, JSON.stringify(S));
  const Settings = {
    DEF,
    get: (k) => S[k],
    set(k, v) { S[k] = v; save(); Settings.apply(); },
    reset() { S = Object.assign({}, DEF); save(); Settings.apply(); },
    apply() {
      const h = document.documentElement;
      h.dataset.theme = S.theme;
      h.classList.toggle('no-crt', !S.crt);
      h.classList.toggle('no-bg', !S.bgAnim);
      h.classList.toggle('reduced', !S.motion);
      h.classList.toggle('no-shake', !S.shake);
      if (window.Sfx) Sfx.refreshMusic();
    }
  };
  window.Settings = Settings;
  Settings.apply();

  I18N.add({
    pl: {
      settings: 'Ustawienia', setAudio: 'Dźwięk', setVisual: 'Wygląd', setEffects: 'Efekty i animacje',
      sound: 'Dźwięki', volume: 'Głośność', music: 'Muzyka w tle', musicHint: 'Chiptune 8-bit (włącza się po pierwszym kliknięciu)',
      testSound: 'Testuj dźwięk', theme: 'Motyw kolorów',
      th_synth: 'Synthwave', th_matrix: 'Matrix', th_sunset: 'Zachód', th_ice: 'Lód',
      crt: 'Efekt CRT', crtHint: 'Linie skanujące jak w starym monitorze',
      bgAnim: 'Animowane tło', motion: 'Animacje', motionHint: 'Wyłącz, jeśli strona zwalnia lub męczy oczy',
      fx: 'Cząsteczki i konfetti', fxHint: 'Wybuchy, iskry i konfetti po wygranej',
      shake: 'Drżenie ekranu', trail: 'Ślad kursora', language: 'Język', account: 'Konto',
      loggedAs: 'Zalogowany jako', resetSettings: 'Przywróć domyślne', resetDone: 'Przywrócono ustawienia domyślne',
      pressStart: 'NACIŚNIJ START', insertCoin: 'Kliknij lub naciśnij dowolny klawisz'
    },
    en: {
      settings: 'Settings', setAudio: 'Audio', setVisual: 'Appearance', setEffects: 'Effects & animations',
      sound: 'Sounds', volume: 'Volume', music: 'Background music', musicHint: '8-bit chiptune (starts after your first click)',
      testSound: 'Test sound', theme: 'Color theme',
      th_synth: 'Synthwave', th_matrix: 'Matrix', th_sunset: 'Sunset', th_ice: 'Ice',
      crt: 'CRT effect', crtHint: 'Scanlines like an old monitor',
      bgAnim: 'Animated background', motion: 'Animations', motionHint: 'Turn off if the page lags or strains your eyes',
      fx: 'Particles & confetti', fxHint: 'Explosions, sparks and confetti on a win',
      shake: 'Screen shake', trail: 'Cursor trail', language: 'Language', account: 'Account',
      loggedAs: 'Logged in as', resetSettings: 'Reset to defaults', resetDone: 'Settings reset to defaults',
      pressStart: 'PRESS START', insertCoin: 'Click or press any key'
    }
  });
})();
