-- Uruchom w Supabase: SQL Editor -> New query -> wklej CAŁOŚĆ -> Run
-- (można uruchamiać wielokrotnie – skrypt jest bezpieczny)

-- ============ WYNIKI ============
create table if not exists public.scores (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  nick       text not null,
  game       text not null,
  mode       text not null check (mode in ('bot','online')),
  result     text not null check (result in ('win','lose','draw')),
  points     int  not null default 0 check (points between 0 and 5),
  created_at timestamptz not null default now()
);
-- dozwolone gry (rozszerzaj tutaj przy nowych grach)
alter table public.scores drop constraint if exists scores_game_check;
alter table public.scores add constraint scores_game_check
  check (game in ('ttt','hangman','battleship','rps','c4','pong','snake','chess'));
alter table public.scores enable row level security;
drop policy if exists "scores readable by all" on public.scores;
create policy "scores readable by all" on public.scores for select using (true);
drop policy if exists "insert own scores" on public.scores;
create policy "insert own scores" on public.scores for insert to authenticated
  with check (auth.uid() = user_id);

-- ============ PROFILE ============
create table if not exists public.profiles (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  nick       text not null,
  avatar     text not null default '👾',
  bio        text not null default '' check (char_length(bio) <= 80),
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_nick_lower on public.profiles (lower(nick));
alter table public.profiles enable row level security;
drop policy if exists "profiles readable by all" on public.profiles;
create policy "profiles readable by all" on public.profiles for select using (true);
drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles for insert to authenticated
  with check (auth.uid() = user_id);
drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- profil tworzy się automatycznie po rejestracji
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, nick)
  values (new.id, coalesce(new.raw_user_meta_data->>'nick', 'gracz' || substr(new.id::text, 1, 6)))
  on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- profile dla kont założonych wcześniej
insert into public.profiles (user_id, nick)
select id, raw_user_meta_data->>'nick' from auth.users
where raw_user_meta_data ? 'nick'
on conflict do nothing;

-- ============ ZNAJOMI ============
create table if not exists public.friendships (
  id         bigint generated always as identity primary key,
  requester  uuid not null references auth.users(id) on delete cascade,
  addressee  uuid not null references auth.users(id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz not null default now(),
  check (requester <> addressee)
);
create unique index if not exists friendships_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
alter table public.friendships enable row level security;
drop policy if exists "see own friendships" on public.friendships;
create policy "see own friendships" on public.friendships for select to authenticated
  using (auth.uid() in (requester, addressee));
drop policy if exists "send request" on public.friendships;
create policy "send request" on public.friendships for insert to authenticated
  with check (requester = auth.uid() and status = 'pending');
drop policy if exists "accept request" on public.friendships;
create policy "accept request" on public.friendships for update to authenticated
  using (addressee = auth.uid()) with check (addressee = auth.uid() and status = 'accepted');
drop policy if exists "remove friendship" on public.friendships;
create policy "remove friendship" on public.friendships for delete to authenticated
  using (auth.uid() in (requester, addressee));

-- ============ RANKING ============
drop view if exists public.leaderboard;
create view public.leaderboard as
  select s.nick, s.game, coalesce(p.avatar, '👾') as avatar,
         sum(s.points)::int as points,
         (count(*) filter (where s.result = 'win'))::int as wins,
         count(*)::int as games
  from public.scores s
  left join public.profiles p on p.user_id = s.user_id
  group by s.nick, s.game, p.avatar;
grant select on public.leaderboard to anon, authenticated;

