-- TrackFit v1 schema (TF-6). See product/PRD.md §9.
-- Every table carries user_id and is locked to its owner with row-level security.

-- ---------- Types ----------
create type public.weight_unit  as enum ('kg', 'lb');
create type public.muscle_group as enum ('Chest', 'Back', 'Shoulders', 'Legs', 'Biceps', 'Triceps', 'Core');
create type public.habit_result as enum ('avoided', 'had');

-- ---------- Lifting ----------
create table public.exercises (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 80),
  muscle_group  public.muscle_group not null,
  default_unit  public.weight_unit  not null default 'kg',
  archived_at   timestamptz,
  created_at    timestamptz not null default now()
);
-- One name per user, case-insensitive ("Leg press" = "leg press")
create unique index exercises_user_name_key on public.exercises (user_id, lower(btrim(name)));

create table public.lift_sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  exercise_id   uuid not null references public.exercises (id) on delete cascade,
  performed_at  timestamptz not null default now(),
  local_date    date not null,                      -- the user's calendar day, set by the app
  created_at    timestamptz not null default now()
);
-- Fast "last session for this exercise"
create index lift_sessions_last_idx on public.lift_sessions (user_id, exercise_id, performed_at desc);

create table public.lift_sets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id  uuid not null references public.lift_sessions (id) on delete cascade,
  set_number  smallint not null check (set_number between 1 and 50),
  weight      numeric(6,2) not null check (weight >= 0 and weight <= 1000),  -- stored as entered, never converted
  unit        public.weight_unit not null,
  unique (session_id, set_number)
);

-- ---------- Protein ----------
create table public.quick_adds (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  grams       smallint not null check (grams between 1 and 300),
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

create table public.protein_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  grams         smallint not null check (grams between 1 and 1000),
  label         text check (label is null or char_length(label) <= 60),
  quick_add_id  uuid references public.quick_adds (id) on delete set null,
  logged_at     timestamptz not null default now(),
  local_date    date not null
);
create index protein_entries_day_idx on public.protein_entries (user_id, local_date);

-- Goal history: a change applies from effective_from onward; past days keep their goal
create table public.protein_goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_g          smallint not null check (goal_g between 20 and 400),
  effective_from  date not null,
  unique (user_id, effective_from)
);

-- ---------- Habits, body weight, settings ----------
create table public.daily_habits (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  sugar       public.habit_result,
  junk_food   public.habit_result,
  updated_at  timestamptz not null default now(),
  primary key (user_id, date)
);

create table public.body_weights (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  weight      numeric(5,1) not null check (weight > 0 and weight < 700),
  unit        public.weight_unit not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, date)                        -- one per day; a second log replaces it
);

create table public.user_settings (
  user_id           uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  current_split     public.muscle_group[] not null default '{}',
  body_weight_unit  public.weight_unit not null default 'kg',
  updated_at        timestamptz not null default now()
);

-- ---------- Row-level security ----------
-- Signed-in users can only see and change their own rows. Signed-out visitors (anon) get nothing.
do $$
declare t text;
begin
  foreach t in array array['exercises','lift_sessions','lift_sets','quick_adds','protein_entries',
                           'protein_goals','daily_habits','body_weights','user_settings']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format($p$create policy "own rows" on public.%I for all to authenticated
                      using (user_id = (select auth.uid()))
                      with check (user_id = (select auth.uid()))$p$, t);
  end loop;
end $$;

-- Child rows may only point at parents the same user owns
-- (stops a user attaching a set to someone else's session by guessing its id).
-- Restrictive policies are ANDed with "own rows"; they apply on insert and update only.
create policy "parent owned on insert" on public.lift_sessions as restrictive for insert to authenticated
  with check (exists (select 1 from public.exercises e where e.id = exercise_id and e.user_id = (select auth.uid())));
create policy "parent owned on update" on public.lift_sessions as restrictive for update to authenticated
  using (true)
  with check (exists (select 1 from public.exercises e where e.id = exercise_id and e.user_id = (select auth.uid())));

create policy "parent owned on insert" on public.lift_sets as restrictive for insert to authenticated
  with check (exists (select 1 from public.lift_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
create policy "parent owned on update" on public.lift_sets as restrictive for update to authenticated
  using (true)
  with check (exists (select 1 from public.lift_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

create policy "parent owned on insert" on public.protein_entries as restrictive for insert to authenticated
  with check (quick_add_id is null or exists (select 1 from public.quick_adds q where q.id = quick_add_id and q.user_id = (select auth.uid())));
create policy "parent owned on update" on public.protein_entries as restrictive for update to authenticated
  using (true)
  with check (quick_add_id is null or exists (select 1 from public.quick_adds q where q.id = quick_add_id and q.user_id = (select auth.uid())));
