-- Cardio sessions (TF-34). Calories are estimated in the app from type, minutes, effort and body weight (TF-35).

create type public.cardio_kind as enum (
  'treadmill_run', 'treadmill_walk', 'cycling', 'elliptical', 'rowing', 'stair_climber', 'swimming', 'other'
);
create type public.effort_level as enum ('easy', 'moderate', 'hard');

create table public.cardio_sessions (
  id            uuid primary key default gen_random_uuid(),   -- created by the app, so retries don't duplicate
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  kind          public.cardio_kind not null,
  minutes       smallint not null check (minutes between 1 and 600),
  effort        public.effort_level not null default 'moderate',
  performed_at  timestamptz not null default now(),
  local_date    date not null
);
create index cardio_sessions_day_idx on public.cardio_sessions (user_id, local_date);

alter table public.cardio_sessions enable row level security;
revoke all on public.cardio_sessions from anon;
create policy "own rows" on public.cardio_sessions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
