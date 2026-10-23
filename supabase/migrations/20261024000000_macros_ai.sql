-- Macros panel + AI food estimates (TF-36 round 2).
--
-- 1. Fibre and added sugar on food entries and saved foods (snapshotted at log time, like kcal/carbs/fat).
-- 2. A fitness goal in user_settings (lose fat / maintain / build muscle), which sets the macro targets in the app.
-- 3. AI estimates: a shared cache of estimates keyed by the normalised query, and a per-user daily usage count.
--    Both are written only by the estimate-food Edge Function using the service role; users can't write them.

-- ---------- Fibre and added sugar ----------
alter table public.protein_entries
  add column fiber_g        smallint check (fiber_g is null or fiber_g between 0 and 300),
  add column added_sugar_g  smallint check (added_sugar_g is null or added_sugar_g between 0 and 1000);

alter table public.quick_adds
  add column fiber_g        smallint check (fiber_g is null or fiber_g between 0 and 300),
  add column added_sugar_g  smallint check (added_sugar_g is null or added_sugar_g between 0 and 1000);

-- ---------- Fitness goal ----------
create type public.fitness_goal as enum ('lose_fat', 'maintain', 'build_muscle');
alter table public.user_settings add column fitness_goal public.fitness_goal not null default 'maintain';

-- ---------- AI estimate cache (shared by all users) ----------
-- query_key = the query lowercased, accents and punctuation removed, spaces collapsed ("2 Aloo-parathas " → "2 aloo parathas").
-- The same words always give the same estimate, so repeat lookups cost nothing.
create table public.ai_food_cache (
  id          uuid primary key default gen_random_uuid(),
  query_key   text not null unique check (char_length(query_key) between 1 and 200),
  query       text not null check (char_length(query) between 1 and 200),
  result      jsonb not null,                 -- the checked estimate the function returns
  model       text not null,
  created_at  timestamptz not null default now()
);

alter table public.ai_food_cache enable row level security;
revoke all on public.ai_food_cache from anon;
revoke insert, update, delete on public.ai_food_cache from authenticated;
-- Any signed-in user may read the cache; there is no insert/update/delete policy, so only the service role writes
create policy "signed in can read" on public.ai_food_cache for select to authenticated using (true);

-- ---------- AI estimate usage (per user per day, for the daily cap) ----------
create table public.ai_food_usage (
  user_id  uuid not null references auth.users (id) on delete cascade,
  date     date not null,                     -- UTC day, counted by the function
  count    integer not null default 0 check (count >= 0),
  primary key (user_id, date)
);

alter table public.ai_food_usage enable row level security;
revoke all on public.ai_food_usage from anon;
revoke insert, update, delete on public.ai_food_usage from authenticated;
create policy "own rows" on public.ai_food_usage for select to authenticated
  using (user_id = (select auth.uid()));

-- Takes one estimate from the user's daily allowance and returns the new count (the function refuses above the cap).
-- One statement, so two lookups at the same moment can't both slip under the cap.
create function public.ai_food_take(p_user uuid, p_date date) returns integer
language sql
security invoker
set search_path = ''
as $$
  insert into public.ai_food_usage as u (user_id, date, count) values (p_user, p_date, 1)
  on conflict (user_id, date) do update set count = u.count + 1
  returning u.count;
$$;

revoke all on function public.ai_food_take(uuid, date) from public, anon, authenticated;
grant execute on function public.ai_food_take(uuid, date) to service_role;
