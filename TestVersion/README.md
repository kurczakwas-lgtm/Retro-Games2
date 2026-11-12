# 👾 RETRO ARCADE

Gry w stylu pixel-art: **Szachy, Warcaby, Reversi, Kółko i krzyżyk, Connect 4, Statki, Snake, Pong, Wisielec (QWERTY), Papier-kamień-nożyce, Tetris, 2048, Saper** – z botem (3 poziomy), solo lub z przyjacielem online. Ranking i konta przez Supabase. PL/EN.

## Uruchomienie
Otwórz `index.html` (lub `npx serve` w tym folderze). Z botem działa od razu.

## Konfiguracja Supabase (online + ranking + logowanie)
1. Załóż projekt na https://supabase.com
2. **SQL Editor** → wklej zawartość `supabase.sql` → Run.
3. **Authentication → Providers → Email** → wyłącz **Confirm email** (logujemy się samym nickiem + hasłem).
4. **Project Settings → API** → skopiuj *Project URL* i *anon public key* do `js/config.js`.

Multiplayer używa Supabase Realtime (broadcast/presence) – nie potrzebuje tabel. 
Jedna osoba tworzy pokój i podaje kod, druga wpisuje kod w tej samej grze.

## Punkty
Punkty liczy **serwer** (trigger w `supabase.sql`, klient nie może ich zawyżyć): bot łatwy 1 / średni 2 / trudny 3 · online 5 · remis 1 · solo wg wyniku (Tetris/2048: 1 pkt za 1500) · dzienny limit punktów na grę · limit tempa 1 wynik / 2 s.`nRanking: cały czas i tygodniowy, per gra, rekordy gier solo. **Po aktualizacji uruchom ponownie cały `supabase.sql`.**

## Dodawanie gry
Dodaj plik w `js/games/`, zarejestruj `Games.nazwa = {id, nameKey, descKey, color, icon, start(el, ctx)}`, dodaj `<script>` w `index.html`, teksty w `js/i18n.js` i grę w CHECK w `supabase.sql`. Gry solo: `solo:true` (+ `diff:true` jeśli mają poziomy); wynik: `ctx.finish(res, value)`.
