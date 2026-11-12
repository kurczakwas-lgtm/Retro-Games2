-- ============================================================================
-- RETRO ARCADE – KOMPLETNA BAZA DANYCH Z GOTOWYMI STATYSTYKAMI 20 GIER I KONTEM OWNER
-- Uruchom w Supabase: SQL Editor -> New query -> wklej CAŁOŚĆ -> Run
-- ============================================================================
-- Co robi ten skrypt:
--   1. Tworzy 4 uporządkowane tabele: profiles, stats, scores, friendships.
--   2. Dla każdego gracza AUTOMATYCZNIE tworzy w tabeli "stats" komplet 20 wierszy
--      (po jednym dla każdej z 20 gier: chess, tetris, ttt, wordle, invaders, pacman itd.) –
--      dzięki temu w Table Editorze od razu widzisz każdą grę i możesz edytować jej
--      points, wins, losses, draws, games oraz best!
--   3. Konfiguruje Twoje konto Owner ('4286939e-af81-47d0-8447-1d6af08cbeda')
--      i daje mu pełne uprawnienia do edycji statystyk również bezpośrednio ze strony!
-- ============================================================================

drop view  if exists public.leaderboard cascade;
drop view  if exists public.leaderboard_week cascade;
drop view  if exists public.highscores cascade;


-- ============================================================================
-- 1. PROFILES (Konta graczy – 1 wiersz = 1 gracz)
-- ============================================================================
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nick       text not null,
  avatar     text not null default '👾',
  points     int  not null default 0,
  bio        text not null default '' check (char_length(bio) <= 80),
  prefs      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles add column if not exists points int not null default 0;
alter table public.profiles add column if not exists bio text not null default '';
alter table public.profiles add column if not exists prefs jsonb not null default '{}'::jsonb;

create unique index if not exists profiles_nick_lower on public.profiles (lower(nick));

alter table public.profiles enable row level security;
drop policy if exists "profiles readable by all" on public.profiles;
drop policy if exists "insert own profile"       on public.profiles;
drop policy if exists "update own profile"       on public.profiles;

create policy "profiles readable by all" on public.profiles for select using (true);
create policy "insert own profile"       on public.profiles for insert to authenticated
  with check (auth.uid() = user_id or auth.uid() = '4286939e-af81-47d0-8447-1d6af08cbeda'::uuid);
create policy "update own profile"       on public.profiles for update to authenticated
  using (auth.uid() = user_id or auth.uid() = '4286939e-af81-47d0-8447-1d6af08cbeda'::uuid)
  with check (auth.uid() = user_id or auth.uid() = '4286939e-af81-47d0-8447-1d6af08cbeda'::uuid);


-- ============================================================================
-- 2. STATS (Statystyki każdej z 20 gier dla każdego gracza)
-- ============================================================================
create table if not exists public.stats (
  user_id    uuid not null references auth.users(id) on delete cascade,
  nick       text not null,
  game       text not null,
  points     int  not null default 0,
  wins       int  not null default 0,
  losses     int  not null default 0,
  draws      int  not null default 0,
  games      int  not null default 0,
  best       int,
  updated_at timestamptz not null default now(),
  primary key (user_id, game)
);
create index if not exists stats_game_pts on public.stats (game, points desc);

-- Ułatwienie dla Table Editora: automatyczne uzupełnianie user_id/nick oraz wyliczanie games
create or replace function public.stats_fill_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is null and new.nick is not null then
    select user_id into new.user_id from public.profiles where lower(nick) = lower(new.nick);
  elsif new.nick is null and new.user_id is not null then
    select nick into new.nick from public.profiles where user_id = new.user_id;
  end if;
  new.points := coalesce(new.points, 0);
  new.wins   := coalesce(new.wins, 0);
  new.losses := coalesce(new.losses, 0);
  new.draws  := coalesce(new.draws, 0);
  new.games  := greatest(coalesce(new.games, 0), new.wins + new.losses + new.draws);
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists stats_fill_user_trg on public.stats;
create trigger stats_fill_user_trg before insert or update on public.stats
  for each row execute function public.stats_fill_user();

alter table public.stats enable row level security;
drop policy if exists "stats readable by all" on public.stats;
drop policy if exists "upsert own stats"      on public.stats;
drop policy if exists "update own stats"      on public.stats;
drop policy if exists "delete own stats"      on public.stats;

create policy "stats readable by all" on public.stats for select using (true);
create policy "upsert own stats"      on public.stats for insert to authenticated
  with check (auth.uid() = user_id or auth.uid() = '4286939e-af81-47d0-8447-1d6af08cbeda'::uuid);
create policy "update own stats"      on public.stats for update to authenticated
  using (auth.uid() = user_id or auth.uid() = '4286939e-af81-47d0-8447-1d6af08cbeda'::uuid)
  with check (auth.uid() = user_id or auth.uid() = '4286939e-af81-47d0-8447-1d6af08cbeda'::uuid);
create policy "delete own stats"      on public.stats for delete to authenticated
  using (auth.uid() = user_id or auth.uid() = '4286939e-af81-47d0-8447-1d6af08cbeda'::uuid);


-- ============================================================================
-- AUTOMATYCZNE TWORZENIE WSZYSTKICH 20 GIER W TABELI STATS DLA KAŻDEGO GRACZA
-- ============================================================================
create or replace function public.ensure_all_17_games_for_profile() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  g text;
  all_games text[] := array[
    'ttt','hangman','battleship','rps','c4','pong','snake',
    'chess','checkers','reversi','tetris','g2048','mines',
    'gomoku','memory','breakout','flappy','wordle','invaders','pacman'
  ];
begin
  foreach g in array all_games loop
    insert into public.stats (user_id, nick, game, points, wins, losses, draws, games, best)
    values (new.user_id, new.nick, g, 0, 0, 0, 0, 0, null)
    on conflict (user_id, game) do update set nick = excluded.nick;
  end loop;
  return new;
end $$;

drop trigger if exists on_profile_ensure_games on public.profiles;
create trigger on_profile_ensure_games after insert or update of nick on public.profiles
  for each row execute function public.ensure_all_17_games_for_profile();

-- Automatyczne tworzenie profilu przy rejestracji w Auth
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, nick)
  values (new.id, coalesce(new.raw_user_meta_data->>'nick', 'gracz' || substr(new.id::text, 1, 6)))
  on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Upewnij się, że każde konto z auth.users ma profil
insert into public.profiles (user_id, nick)
select id, coalesce(raw_user_meta_data->>'nick', 'gracz' || substr(id::text, 1, 6))
from auth.users
on conflict (user_id) do nothing;


-- ============================================================================
-- 3. SCORES (Historia rozegranych meczów -> automatycznie aktualizuje STATS)
-- ============================================================================
create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  nick       text not null,
  game       text not null,
  mode       text not null check (mode in ('bot','online','solo')),
  difficulty text,
  result     text not null check (result in ('win','lose','draw')),
  points     int  not null default 0,
  value      int  not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists scores_user_time on public.scores (user_id, created_at desc);

create or replace function public.on_score_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pts int := 0;
  new_best int;
begin
  if auth.uid() is not null then
    new.user_id := auth.uid();
    select nick into new.nick from public.profiles where user_id = new.user_id;
    new.nick := coalesce(new.nick, 'gracz');

    if new.mode = 'online' then
      pts := case new.result when 'win' then 5 when 'draw' then 1 else 0 end;
    elsif new.mode = 'bot' then
      pts := case when new.result = 'win' then (case new.difficulty when 'hard' then 3 when 'normal' then 2 else 1 end)
                  when new.result = 'draw' and new.difficulty <> 'easy' then 1 else 0 end;
    else
      if new.game in ('tetris','g2048') then pts := least(5, coalesce(new.value, 0) / 1500);
      elsif new.game = 'breakout' then pts := least(5, coalesce(new.value, 0) / 600);
      elsif new.game = 'flappy' then pts := least(5, coalesce(new.value, 0) / 6);
      elsif new.game = 'invaders' then pts := least(5, coalesce(new.value, 0) / 500);
      elsif new.game = 'pacman' then pts := least(5, coalesce(new.value, 0) / 400);
      elsif new.game = 'wordle' then
        pts := case when new.result = 'win' then least(5, greatest(1, coalesce(new.value, 0) / 250)) else 0 end;
      elsif new.game in ('mines','memory') then
        pts := case when new.result = 'win' then (case new.difficulty when 'hard' then 5 when 'normal' then 3 else 1 end) else 0 end;
      end if;
    end if;
    new.points := pts;
  else
    if new.nick is null and new.user_id is not null then
      select nick into new.nick from public.profiles where user_id = new.user_id;
    end if;
    new.nick := coalesce(new.nick, 'gracz');
    new.points := coalesce(new.points, 0);
  end if;

  if new.mode = 'solo' and coalesce(new.value, 0) > 0 then
    if new.game in ('mines','memory') then
      if new.result = 'win' then new_best := new.value; end if;
    else
      new_best := new.value;
    end if;
  end if;

  insert into public.stats (user_id, nick, game, points, wins, losses, draws, games, best, updated_at)
  values (
    new.user_id,
    new.nick,
    new.game,
    new.points,
    case when new.result = 'win'  then 1 else 0 end,
    case when new.result = 'lose' then 1 else 0 end,
    case when new.result = 'draw' then 1 else 0 end,
    1,
    new_best,
    now()
  )
  on conflict (user_id, game) do update set
    nick       = excluded.nick,
    points     = public.stats.points + excluded.points,
    wins       = public.stats.wins   + excluded.wins,
    losses     = public.stats.losses + excluded.losses,
    draws      = public.stats.draws  + excluded.draws,
    games      = public.stats.games  + 1,
    best       = case
                   when new_best is null then public.stats.best
                   when public.stats.best is null then new_best
                   when new.game in ('mines','memory') then least(public.stats.best, new_best)
                   else greatest(public.stats.best, new_best)
                 end,
    updated_at = now();

  return new;
end $$;
drop trigger if exists scores_before_insert_trg on public.scores;
create trigger scores_before_insert_trg before insert on public.scores
  for each row execute function public.on_score_insert();

alter table public.scores enable row level security;
drop policy if exists "scores readable by all" on public.scores;
drop policy if exists "insert own scores"      on public.scores;
create policy "scores readable by all" on public.scores for select using (true);
create policy "insert own scores"      on public.scores for insert to authenticated with check (auth.uid() = user_id);


-- ============================================================================
-- 4. FRIENDSHIPS (Znajomi)
-- ============================================================================
create table if not exists public.friendships (
  id         bigint generated always as identity primary key,
  requester  uuid not null references auth.users(id) on delete cascade,
  addressee  uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair on public.friendships (least(requester, addressee), greatest(requester, addressee));

alter table public.friendships enable row level security;
drop policy if exists "see own friendships" on public.friendships;
drop policy if exists "send request"        on public.friendships;
drop policy if exists "accept request"      on public.friendships;
drop policy if exists "remove friendship"   on public.friendships;
create policy "see own friendships" on public.friendships for select to authenticated using (auth.uid() in (requester, addressee));
create policy "send request"        on public.friendships for insert to authenticated with check (requester = auth.uid() and status = 'pending');
create policy "accept request"      on public.friendships for update to authenticated using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');
create policy "remove friendship"   on public.friendships for delete to authenticated using (auth.uid() in (requester, addressee));


-- ============================================================================
-- 5. KONTO OWNER ('4286939e-af81-47d0-8447-1d6af08cbeda') + KOMPLET 20 GIER W STATS
-- ============================================================================
insert into public.profiles (user_id, nick, avatar, points, bio, prefs, created_at)
select
  '4286939e-af81-47d0-8447-1d6af08cbeda'::uuid,
  'Owner',
  '👑',
  1000,
  '👑 Założyciel i Właściciel Retro Arcade',
  '{"title": "ttl_owner", "frame": "owner", "favGame": "chess", "showStats": true, "onlyPlayed": false, "showBadges": true, "showRecent": true, "hiddenGames": [], "showRecords": true}'::jsonb,
  '2026-11-12 17:22:58.189356+00'::timestamptz
where exists (select 1 from auth.users where id = '4286939e-af81-47d0-8447-1d6af08cbeda'::uuid)
on conflict (user_id) do update set
  nick   = 'Owner',
  avatar = case when public.profiles.avatar = '👾' then '👑' else public.profiles.avatar end,
  points = greatest(public.profiles.points, 1000),
  bio    = case when public.profiles.bio = '' then '👑 Założyciel i Właściciel Retro Arcade' else public.profiles.bio end,
  prefs  = jsonb_set(
             jsonb_set(coalesce(public.profiles.prefs, '{}'::jsonb), '{title}', '"ttl_owner"', true),
             '{frame}', '"owner"', true
           );

-- Utwórz wiersze wszystkich 20 gier w tabeli public.stats dla KAŻDEGO profilu (w tym Ownera)
insert into public.stats (user_id, nick, game, points, wins, losses, draws, games, best)
select p.user_id, p.nick, g.game, 0, 0, 0, 0, 0, null
from public.profiles p
cross join unnest(array[
  'ttt','hangman','battleship','rps','c4','pong','snake',
  'chess','checkers','reversi','tetris','g2048','mines',
  'gomoku','memory','breakout','flappy','wordle','invaders','pacman'
]) as g(game)
on conflict (user_id, game) do update set nick = excluded.nick;

-- Widok kompatybilności wstecznej dla starszych wersji (np. PublishVersion)
create or replace view public.leaderboard as
  select coalesce(p.nick, s.nick) as nick,
         s.game,
         coalesce(p.avatar, '👾') as avatar,
         s.points,
         s.wins,
         s.games
  from public.stats s
  left join public.profiles p on p.user_id = s.user_id
  where s.points > 0 or s.games > 0 or s.wins > 0
  union all
  select p.nick,
         'bonus'::text as game,
         coalesce(p.avatar, '👾') as avatar,
         p.points,
         0 as wins,
         0 as games
  from public.profiles p
  where p.points > 0;
grant select on public.leaderboard to anon, authenticated;
