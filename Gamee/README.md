# 👾 RETRO ARCADE

Gry w stylu pixel-art: **Kółko i krzyżyk, Wisielec, Statki** – z botem (3 poziomy) lub z przyjacielem online. Ranking i konta przez Supabase. PL/EN.

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
Bot: łatwy 1 / średni 2 / trudny 3 · Online: 5 · Remis: 1.

## Dodawanie gry
Dodaj plik w `js/games/`, zarejestruj `Games.nazwa = {id, nameKey, descKey, color, icon, start(el, ctx)}`, dodaj `<script>` w `index.html`, teksty w `js/i18n.js` i grę w CHECK w `supabase.sql`.
