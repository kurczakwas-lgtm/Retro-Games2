// ============================================================================
// ODZNAKI, TYTUŁY, RAMKI I AWATARY GRACZA
// Tutaj możesz w jednym miejscu dodawać własne awatary, ramki, tytuły i osiągnięcia!
// ============================================================================
(function () {

  // 1. AWATARY DO WYBORU W PROFILU
  const AVATARS = [
    '👾', '🤖', '👻', '🐱', '🐸', '🦊', '🐉', '🚀',
    '🎮', '💀', '🦄', '🐙', '👑', '⚡', '🔥', '💎'
  ];

  const OWNER_ID = '4286939e-af81-47d0-8447-1d6af08cbeda';
  const isOwner = (uid) => !!uid && uid === OWNER_ID;

  // 1b. RAMKI AWATARA (odblokowywane za poziom Lv + ranga Ownera)
  const FRAMES = [
    { id: '',        minLvl: 0,   pl: 'Standardowa',       en: 'Standard' },
    { id: 'cyan',    minLvl: 1,   pl: '🔹 Cyjanowy Neon',  en: '🔹 Cyan Neon' },
    { id: 'pink',    minLvl: 2,   pl: '🩷 Różowy Synth',   en: '🩷 Pink Synth' },
    { id: 'emerald', minLvl: 3,   pl: '💚 Szmaragd',       en: '💚 Emerald' },
    { id: 'gold',    minLvl: 5,   pl: '👑 Złota Ramka',    en: '👑 Golden Frame' },
    { id: 'fire',    minLvl: 7,   pl: '🔥 Płomienna Aura', en: '🔥 Flame Aura' },
    { id: 'rainbow', minLvl: 10,  pl: '🌈 Tęczowy Mistrz', en: '🌈 Rainbow Master' },
    { id: 'god',     minLvl: 100, pl: '🌈 Bóg',            en: '🌈 God' },
    { id: 'owner',   minLvl: 0,   ownerOnly: true, pl: '👑 Korona Ownera', en: '👑 Owner Crown' }
  ];

  // 2. TYTUŁY GRACZA (wyświetlane pod nickiem)
  // Aby dodać nowy tytuł, dopisz obiekt: { id: 'unikalne_id', pl: 'Nazwa PL', en: 'Nazwa EN' }
  const TITLES = [
    { id: 'ttl_arcade', pl: '🎮 Arcade Master',  en: '🎮 Arcade Master' },
    { id: 'ttl_gm',     pl: '♟ Arcymistrz',      en: '♟ Grandmaster' },
    { id: 'ttl_speed',  pl: '⚡ Speedrunner',    en: '⚡ Speedrunner' },
    { id: 'ttl_king',   pl: '👑 Król Rankingu',  en: '👑 Leaderboard King' },
    { id: 'ttl_retro',  pl: '👾 Retro Legend',   en: '👾 Retro Legend' },
    { id: 'ttl_fire',   pl: '🔥 Niepokonany',    en: '🔥 Undefeated' },
    { id: 'ttl_god',    pl: '🔥 Bóg',            en: '🔥 God' },
    { id: 'ttl_owner',  ownerOnly: true, pl: '👑 OWNER', en: '👑 OWNER' }
  ];

  // 2b. PRZEDMIOTY W SKLEPIKU (za Żetony Arcade 🪙)
  const SHOP_ITEMS = [
    { id: 'av_dragon', type: 'avatar', val: '🐉', price: 30, pl: 'Awatar: Smok', en: 'Avatar: Dragon' },
    { id: 'av_fox',    type: 'avatar', val: '🦊', price: 25, pl: 'Awatar: Cyber Lis', en: 'Avatar: Cyber Fox' },
    { id: 'av_ufo',    type: 'avatar', val: '🛸', price: 35, pl: 'Awatar: UFO', en: 'Avatar: UFO' },
    { id: 'av_gem',    type: 'avatar', val: '💎', price: 50, pl: 'Awatar: Diament', en: 'Avatar: Diamond' },
    { id: 'av_ninja',  type: 'avatar', val: '🥷', price: 45, pl: 'Awatar: Ninja', en: 'Avatar: Ninja' },
    { id: 'av_bolt',   type: 'avatar', val: '⚡', price: 30, pl: 'Awatar: Błyskawica', en: 'Avatar: Lightning' },
    { id: 'skin_chess_emerald', type: 'skin', game: 'chess',  cls: 'skin-chess-emerald', ico: '💚', price: 45, pl: 'Szachy: Szmaragdowa Plansza', en: 'Chess: Emerald Board' },
    { id: 'skin_chess_gold',    type: 'skin', game: 'chess',  cls: 'skin-chess-gold',    ico: '👑', price: 80, pl: 'Szachy: Królewskie Złoto',   en: 'Chess: Royal Gold' },
    { id: 'skin_snake_neon',    type: 'skin', game: 'snake',  cls: 'skin-snake-neon',    ico: '💚', price: 40, pl: 'Wąż: Cyberpunk Arena',      en: 'Snake: Cyberpunk Arena' },
    { id: 'skin_tetris_gb',     type: 'skin', game: 'tetris', cls: 'skin-tetris-gb',     ico: '🟩', price: 40, pl: 'Tetris: Classic Matrix',     en: 'Tetris: Classic Matrix' },
    { id: 'skin_arena_gold',    type: 'skin', game: 'all',    cls: 'skin-arena-gold',    ico: '✨', price: 110, pl: 'Złota Poświata (Wszystkie gry)', en: 'Gold Arena Glow (All games)' }
  ];

  // 3. POZIOMY TRUDNOŚCI OSIĄGNIĘĆ (tier: 'easy' | 'normal' | 'hard' | 'legend')
  const TIERS = {
    easy:   { pl: 'Łatwe',      en: 'Easy',      color: 'green'  },
    normal: { pl: 'Średnie',    en: 'Medium',    color: 'cyan'   },
    hard:   { pl: 'Trudne',     en: 'Hard',      color: 'pink'   },
    legend: { pl: 'Legendarne', en: 'Legendary', color: 'yellow' }
  };

  // 4. ODZNAKI / OSIĄGNIĘCIA (36 osiągnięć w 4 kategoriach trudności)
  // Pola każdego osiągnięcia:
  //   id       -> unikalny identyfikator
  //   ico      -> ikona emoji
  //   tier     -> trudność: 'easy' (Łatwe), 'normal' (Średnie), 'hard' (Trudne), 'legend' (Legendarne / Ciężkie)
  //   pl / en  -> { name: 'Nazwa', desc: 'Opis' }
  //   check(s) -> warunek odblokowania (true/false)
  //   prog(s)  -> [aktualna_wartość, cel] do wyświetlenia paska postępu np. [s.wins, 50]
  //
  // Dostępne dane w s:
  //   s.wins, s.games, s.points, s.winRate, s.playedGames, s.wonGames, s.rank
  //   s.gameWins('chess'), s.gameGames('chess'), s.gamePts('chess'), s.best('tetris')
  const BADGES = [
    // ========================================================================
    // 🟢 ŁATWE (EASY) – 8 osiągnięć na dobry start
    // ========================================================================
    {
      id: 'first',
      ico: '🩸',
      tier: 'easy',
      pl: { name: 'Pierwsza Krew', desc: 'Wygraj swoją pierwszą partię w dowolnej grze' },
      en: { name: 'First Blood',   desc: 'Win your very first match in any game' },
      check: (s) => s.wins >= 1,
      prog:  (s) => [s.wins, 1]
    },
    {
      id: 'warmup',
      ico: '🎮',
      tier: 'easy',
      pl: { name: 'Rozgrzewka', desc: 'Rozegraj swoje pierwsze 5 gier' },
      en: { name: 'Warm-up',    desc: 'Play your first 5 games' },
      check: (s) => s.games >= 5,
      prog:  (s) => [s.games, 5]
    },
    {
      id: 'curious',
      ico: '🧭',
      tier: 'easy',
      pl: { name: 'Odkrywca Gier', desc: 'Spróbuj sił w co najmniej 3 różnych grach' },
      en: { name: 'Game Explorer', desc: 'Try at least 3 different games' },
      check: (s) => s.playedGames >= 3,
      prog:  (s) => [s.playedGames, 3]
    },
    {
      id: 'vet',
      ico: '🕹',
      tier: 'easy',
      pl: { name: 'Bywalec Salonów', desc: 'Rozegraj łącznie co najmniej 15 gier' },
      en: { name: 'Arcade Regular',  desc: 'Play at least 15 games in total' },
      check: (s) => s.games >= 15,
      prog:  (s) => [s.games, 15]
    },
    {
      id: 'pro',
      ico: '💎',
      tier: 'easy',
      pl: { name: 'Kolekcjoner Punktów', desc: 'Zdobądź łącznie 30 punktów rankingowych' },
      en: { name: 'Point Collector',     desc: 'Earn 30 total ranking points' },
      check: (s) => s.points >= 30,
      prog:  (s) => [s.points, 30]
    },
    {
      id: 'ttt_win',
      ico: '❌',
      tier: 'easy',
      pl: { name: 'Trzy w Linii',        desc: 'Wygraj 5 partii w Kółko i Krzyżyk' },
      en: { name: 'Three in a Row',      desc: 'Win 5 Tic-Tac-Toe matches' },
      check: (s) => s.gameWins('ttt') >= 5,
      prog:  (s) => [s.gameWins('ttt'), 5]
    },
    {
      id: 'rps_win',
      ico: '✂️',
      tier: 'easy',
      pl: { name: 'Mistrz Pojedynków',   desc: 'Wygraj 5 pojedynków w Papier-Kamień-Nożyce' },
      en: { name: 'Duelist',             desc: 'Win 5 Rock-Paper-Scissors matches' },
      check: (s) => s.gameWins('rps') >= 5,
      prog:  (s) => [s.gameWins('rps'), 5]
    },
    {
      id: 'chess',
      ico: '♟️',
      tier: 'easy',
      pl: { name: 'Szachowy Debiut',     desc: 'Wygraj 3 partie w Szachy' },
      en: { name: 'Chess Debut',         desc: 'Win 3 Chess games' },
      check: (s) => s.gameWins('chess') >= 3,
      prog:  (s) => [s.gameWins('chess'), 3]
    },

    // ========================================================================
    // 🔵 ŚREDNIE (NORMAL) – 10 osiągnięć dla zaawansowanych graczy
    // ========================================================================
    {
      id: 'multi',
      ico: '🌟',
      tier: 'normal',
      pl: { name: 'Wszechstronny', desc: 'Zagraj w co najmniej 7 różnych gier' },
      en: { name: 'All-Rounder',   desc: 'Play at least 7 different games' },
      check: (s) => s.playedGames >= 7,
      prog:  (s) => [s.playedGames, 7]
    },
    {
      id: 'wins_20',
      ico: '🏅',
      tier: 'normal',
      pl: { name: 'Łowca Zwycięstw', desc: 'Odnieś łącznie 20 zwycięstw' },
      en: { name: 'Victory Hunter',  desc: 'Win 20 matches in total' },
      check: (s) => s.wins >= 20,
      prog:  (s) => [s.wins, 20]
    },
    {
      id: 'king',
      ico: '💰',
      tier: 'normal',
      pl: { name: 'Weteran Arcade', desc: 'Zdobądź łącznie 100 punktów' },
      en: { name: 'Arcade Veteran', desc: 'Earn 100 total points' },
      check: (s) => s.points >= 100,
      prog:  (s) => [s.points, 100]
    },
    {
      id: 'sniper',
      ico: '🎯',
      tier: 'normal',
      pl: { name: 'Snajper',      desc: 'Utrzymaj skuteczność wygranych min. 60% (przy min. 10 grach)' },
      en: { name: 'Sharpshooter', desc: 'Maintain at least 60% win rate (min. 10 games)' },
      check: (s) => s.games >= 10 && s.winRate >= 60,
      prog:  (s) => [s.games, 10]
    },
    {
      id: 'chess_pro',
      ico: '♞',
      tier: 'normal',
      pl: { name: 'Szachowy Taktyk', desc: 'Wygraj 10 partii w Szachy' },
      en: { name: 'Chess Tactician', desc: 'Win 10 Chess games' },
      check: (s) => s.gameWins('chess') >= 10,
      prog:  (s) => [s.gameWins('chess'), 10]
    },
    {
      id: 'checkers_pro',
      ico: '🔴',
      tier: 'normal',
      pl: { name: 'Król Damki',       desc: 'Wygraj 8 partii w Warcaby' },
      en: { name: 'Checkers King',    desc: 'Win 8 Checkers games' },
      check: (s) => s.gameWins('checkers') >= 8,
      prog:  (s) => [s.gameWins('checkers'), 8]
    },
    {
      id: 'fleet_admiral',
      ico: '🚢',
      tier: 'normal',
      pl: { name: 'Admirał Floty',    desc: 'Zatop flotę przeciwnika i wygraj 5 bitew w Statki' },
      en: { name: 'Fleet Admiral',    desc: 'Sink the enemy fleet and win 5 Battleship games' },
      check: (s) => s.gameWins('battleship') >= 5,
      prog:  (s) => [s.gameWins('battleship'), 5]
    },
    {
      id: 'word_master',
      ico: '🔤',
      tier: 'normal',
      pl: { name: 'Mistrz Słowa',     desc: 'Odgadnij hasło i wygraj 5 razy w Wisielca' },
      en: { name: 'Word Master',      desc: 'Guess the word and win 5 Hangman games' },
      check: (s) => s.gameWins('hangman') >= 5,
      prog:  (s) => [s.gameWins('hangman'), 5]
    },
    {
      id: 'tetris_pro',
      ico: '🧱',
      tier: 'normal',
      pl: { name: 'Architekt Bloków', desc: 'Zdobądź rekord min. 5000 pkt w Tetrisie' },
      en: { name: 'Block Architect',  desc: 'Score at least 5000 pts in Tetris' },
      check: (s) => (s.best('tetris') || 0) >= 5000,
      prog:  (s) => [s.best('tetris') || 0, 5000]
    },
    {
      id: 'snake_pro',
      ico: '🐍',
      tier: 'normal',
      pl: { name: 'Refleks Kobra',    desc: 'Wygraj łącznie 6 gier w Snake\'a lub Ponga' },
      en: { name: 'Cobra Reflex',     desc: 'Win 6 games in Snake or Pong combined' },
      check: (s) => (s.gameWins('snake') + s.gameWins('pong')) >= 6,
      prog:  (s) => [s.gameWins('snake') + s.gameWins('pong'), 6]
    },

    // ========================================================================
    // 🔴 TRUDNE (HARD) – 10 wymagających wyzwań dla weteranów
    // ========================================================================
    {
      id: 'unstoppable',
      ico: '🔥',
      tier: 'hard',
      pl: { name: 'Maszyna do Wygrywania', desc: 'Wygraj łącznie 50 gier' },
      en: { name: 'Winning Machine',       desc: 'Win 50 games in total' },
      check: (s) => s.wins >= 50,
      prog:  (s) => [s.wins, 50]
    },
    {
      id: 'centurion',
      ico: '⚔️',
      tier: 'hard',
      pl: { name: 'Centurion',          desc: 'Rozegraj łącznie 100 gier' },
      en: { name: 'Arcade Centurion',   desc: 'Play 100 games in total' },
      check: (s) => s.games >= 100,
      prog:  (s) => [s.games, 100]
    },
    {
      id: 'pts_500',
      ico: '🏦',
      tier: 'hard',
      pl: { name: 'Magnat Punktowy',    desc: 'Zdobądź łącznie 500 punktów rankingowych' },
      en: { name: 'Point Tycoon',       desc: 'Earn 500 total ranking points' },
      check: (s) => s.points >= 500,
      prog:  (s) => [s.points, 500]
    },
    {
      id: 'omni',
      ico: '🚀',
      tier: 'hard',
      pl: { name: 'Znawca Salonów',     desc: 'Zagraj w co najmniej 13 różnych gier' },
      en: { name: 'Arcade Connoisseur', desc: 'Play at least 13 different games' },
      check: (s) => s.playedGames >= 13,
      prog:  (s) => [s.playedGames, 13]
    },
    {
      id: 'grandmaster',
      ico: '🧠',
      tier: 'hard',
      pl: { name: 'Arcymistrz Planszy', desc: 'Wygraj łącznie 30 partii w gry planszowe (Szachy, Warcaby, Reversi, Gomoku)' },
      en: { name: 'Board Grandmaster',  desc: 'Win 30 board games (Chess, Checkers, Reversi, Gomoku)' },
      check: (s) => (s.gameWins('chess') + s.gameWins('checkers') + s.gameWins('reversi') + s.gameWins('gomoku')) >= 30,
      prog:  (s) => [s.gameWins('chess') + s.gameWins('checkers') + s.gameWins('reversi') + s.gameWins('gomoku'), 30]
    },
    {
      id: 'connect_five',
      ico: '⚫',
      tier: 'hard',
      pl: { name: 'Strateg Linii',      desc: 'Wygraj 15 partii w Gomoku lub Cztery w Rzędzie' },
      en: { name: 'Line Strategist',    desc: 'Win 15 matches in Gomoku or Connect 4' },
      check: (s) => (s.gameWins('gomoku') + s.gameWins('c4')) >= 15,
      prog:  (s) => [s.gameWins('gomoku') + s.gameWins('c4'), 15]
    },
    {
      id: 'g2048_pro',
      ico: '🔢',
      tier: 'hard',
      pl: { name: 'Władca 2048',        desc: 'Zdobądź rekord co najmniej 10 000 pkt w grze 2048' },
      en: { name: '2048 Sovereign',     desc: 'Score at least 10,000 points in 2048' },
      check: (s) => (s.best('g2048') || 0) >= 10000,
      prog:  (s) => [s.best('g2048') || 0, 10000]
    },
    {
      id: 'breakout_pro',
      ico: '💥',
      tier: 'hard',
      pl: { name: 'Niszczyciel Cegieł', desc: 'Zdobądź rekord co najmniej 1800 pkt w Breakout' },
      en: { name: 'Brick Breaker',      desc: 'Score at least 1800 points in Breakout' },
      check: (s) => (s.best('breakout') || 0) >= 1800,
      prog:  (s) => [s.best('breakout') || 0, 1800]
    },
    {
      id: 'flappy_pro',
      ico: '🦅',
      tier: 'hard',
      pl: { name: 'Neonowy Lotnik',     desc: 'Przeleć przez co najmniej 20 rur w Neon Flap' },
      en: { name: 'Neon Aviator',       desc: 'Pass at least 20 pipes in Neon Flap' },
      check: (s) => (s.best('flappy') || 0) >= 20,
      prog:  (s) => [s.best('flappy') || 0, 20]
    },
    {
      id: 'speed_sweeper',
      ico: '💣',
      tier: 'hard',
      pl: { name: 'Błyskawiczny Umysł', desc: 'Ukończ Sapera lub Memory w czasie 45 sekund lub szybciej' },
      en: { name: 'Lightning Mind',     desc: 'Beat Minesweeper or Memory in 45 seconds or less' },
      check: (s) => (s.best('mines') != null && s.best('mines') > 0 && s.best('mines') <= 45) || (s.best('memory') != null && s.best('memory') > 0 && s.best('memory') <= 45),
      prog:  (s) => [((s.best('mines') != null && s.best('mines') <= 45) || (s.best('memory') != null && s.best('memory') <= 45)) ? 1 : 0, 1]
    },

    // ========================================================================
    // 🟡 LEGENDARNE / CIĘŻKIE (LEGEND) – 8 elitarnych osiągnięć dla najlepszych
    // ========================================================================
    {
      id: 'top3',
      ico: '🥇',
      tier: 'legend',
      pl: { name: 'Elita Podium (TOP 3)',  desc: 'Zajmij miejsce w pierwszej trójce ogólnego rankingu graczy' },
      en: { name: 'Podium Elite (TOP 3)',  desc: 'Reach the Top 3 on the overall leaderboard' },
      check: (s) => s.rank !== null && s.rank >= 1 && s.rank <= 3 && s.points > 0,
      prog:  (s) => [s.rank !== null && s.rank <= 3 && s.points > 0 ? 1 : 0, 1]
    },
    {
      id: 'top1',
      ico: '👑',
      tier: 'legend',
      pl: { name: 'Król Rankingu (#1)',    desc: 'Zajmij 1. miejsce w ogólnym rankingu graczy' },
      en: { name: 'Leaderboard King (#1)', desc: 'Reach #1 on the overall leaderboard' },
      check: (s) => s.rank === 1 && s.points > 0,
      prog:  (s) => [s.rank === 1 && s.points > 0 ? 1 : 0, 1]
    },
    {
      id: 'flawless',
      ico: '⚡',
      tier: 'legend',
      pl: { name: 'Niepokonany Dominator', desc: 'Utrzymaj min. 75% wygranych przy co najmniej 40 rozegranych grach' },
      en: { name: 'Undefeated Dominator',  desc: 'Maintain 75%+ win rate with at least 40 games played' },
      check: (s) => s.games >= 40 && s.winRate >= 75,
      prog:  (s) => [s.games, 40]
    },
    {
      id: 'all_17',
      ico: '🌌',
      tier: 'legend',
      pl: { name: 'Komplecista 100%',      desc: 'Zagraj we wszystkie 20 dostępnych gier na stronie' },
      en: { name: '100% Completionist',    desc: 'Play all 20 available games on the site' },
      check: (s) => { const n = Object.keys(window.Games || {}).length || 20; return s.playedGames >= n; },
      prog:  (s) => [s.playedGames, Object.keys(window.Games || {}).length || 20]
    },
    {
      id: 'polymath',
      ico: '🎖',
      tier: 'legend',
      pl: { name: 'Mistrz Wszystkich Gier', desc: 'Wygraj przynajmniej 1 partię w co najmniej 12 różnych grach' },
      en: { name: 'Master of All Games',    desc: 'Win at least 1 match in 12 different games' },
      check: (s) => s.wonGames >= 12,
      prog:  (s) => [s.wonGames, 12]
    },
    {
      id: 'wins_200',
      ico: '🐉',
      tier: 'legend',
      pl: { name: 'Pogromca Legend',       desc: 'Wygraj łącznie 200 partii we wszystkich grach' },
      en: { name: 'Slayer of Legends',     desc: 'Win 200 matches in total across all games' },
      check: (s) => s.wins >= 200,
      prog:  (s) => [s.wins, 200]
    },
    {
      id: 'legend_1000',
      ico: '🏆',
      tier: 'legend',
      pl: { name: 'Bóg Salonów Arcade',    desc: 'Zdobądź łącznie 1000 punktów rankingowych' },
      en: { name: 'Arcade God',            desc: 'Earn 1000 total ranking points' },
      check: (s) => s.points >= 1000,
      prog:  (s) => [s.points, 1000]
    },
    {
      id: 'mythic_2500',
      ico: '🔱',
      tier: 'legend',
      pl: { name: 'Nieśmiertelny Imperator', desc: 'Zdobądź łącznie 2500 punktów i zapisz się w historii salonu' },
      en: { name: 'Immortal Emperor',        desc: 'Earn 2500 total points and become an arcade immortal' },
      check: (s) => s.points >= 2500,
      prog:  (s) => [s.points, 2500]
    }
  ];

  // Automatyczna rejestracja tłumaczeń w I18N
  const pl = {}, en = {};
  TITLES.forEach(t => { pl[t.id] = t.pl; en[t.id] = t.en; });
  FRAMES.forEach(f => { pl['frm_' + (f.id || 'none')] = f.pl; en['frm_' + (f.id || 'none')] = f.en; });
  SHOP_ITEMS.forEach(s => { pl['shop_' + s.id] = s.pl; en['shop_' + s.id] = s.en; });
  Object.keys(TIERS).forEach(k => { pl['tier_' + k] = TIERS[k].pl; en['tier_' + k] = TIERS[k].en; });
  BADGES.forEach(b => {
    pl['bdg_' + b.id] = b.pl.name; pl['bdg_' + b.id + '_d'] = b.pl.desc;
    en['bdg_' + b.id] = b.en.name; en['bdg_' + b.id + '_d'] = b.en.desc;
  });
  if (window.I18N) I18N.add({ pl, en });

  function makeCtx(st, tot, winRate, rankNum) {
    const byGame = {};
    (st || []).forEach(x => { const gid = x.g ? x.g.id : x.game; byGame[gid] = x; });
    return {
      wins: tot.wins || 0,
      games: tot.games || 0,
      points: tot.points || 0,
      winRate: winRate || 0,
      rank: rankNum || null,
      playedGames: (st || []).filter(x => (x.games || 0) > 0).length,
      wonGames: (st || []).filter(x => (x.wins || 0) > 0).length,
      gameWins: (id) => (byGame[id] ? (byGame[id].wins || 0) : 0),
      gameGames: (id) => (byGame[id] ? (byGame[id].games || 0) : 0),
      gamePts: (id) => (byGame[id] ? (byGame[id].points || 0) : 0),
      best: (id) => (byGame[id] ? byGame[id].best : null)
    };
  }

  // Funkcja wyliczająca stan wszystkich odznak dla profilu gracza
  function evaluate(st, tot, winRate, rankNum, ratesMap) {
    const ctx = makeCtx(st, tot, winRate, rankNum);
    return BADGES.map(b => {
      const ok = !!b.check(ctx);
      let cur = 0, max = 0;
      if (b.prog) {
        const pr = b.prog(ctx) || [0, 0];
        cur = Math.min(pr[1], Math.max(0, pr[0] || 0));
        max = pr[1] || 0;
      }
      const tier = b.tier || 'normal';
      return {
        id: b.id,
        ico: b.ico,
        tier,
        tierColor: (TIERS[tier] && TIERS[tier].color) || 'cyan',
        ok,
        cur,
        max,
        pct: ratesMap && ratesMap[b.id] !== undefined ? ratesMap[b.id] : null
      };
    });
  }

  // Wylicza dla każdego osiągnięcia % graczy, którzy je odblokowali (na podstawie rows z leaderboard/stats)
  function computeGlobalRates(rows) {
    const users = {};
    (rows || []).forEach(r => {
      const k = r.user_id || r.nick;
      if (!k) return;
      const u = users[k] || (users[k] = { id: k, points: 0, wins: 0, games: 0, st: [] });
      u.points += r.points || 0;
      u.wins += r.wins || 0;
      u.games += r.games || 0;
      if (r.game && r.game !== 'bonus') u.st.push(r);
    });
    const list = Object.values(users);
    list.sort((a, b) => b.points - a.points || b.wins - a.wins || a.games - b.games);
    list.forEach((u, i) => { u.rank = u.points > 0 || u.games > 0 ? i + 1 : null; });

    const totalPlayers = Math.max(1, list.length);
    const counts = {};
    BADGES.forEach(b => { counts[b.id] = 0; });

    list.forEach(u => {
      const wr = u.games ? Math.round(u.wins * 100 / u.games) : 0;
      const ctx = makeCtx(u.st, u, wr, u.rank);
      BADGES.forEach(b => { if (b.check(ctx)) counts[b.id]++; });
    });

    const rates = {};
    BADGES.forEach(b => {
      rates[b.id] = list.length ? Math.round((counts[b.id] * 1000) / totalPlayers) / 10 : 0;
    });
    return { rates, totalPlayers: list.length };
  }

  window.ProfileConfig = {
    OWNER_ID,
    isOwner,
    AVATARS,
    FRAMES,
    TITLES: ['', ...TITLES.map(t => t.id)],
    TITLES_META: TITLES,
    SHOP_ITEMS,
    TIERS,
    BADGES,
    evaluate,
    computeGlobalRates
  };
})();
