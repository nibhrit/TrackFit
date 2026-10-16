-- One split per user per day (TF-24 daily reset, TF-30 week of training).
-- Replaces user_settings.current_split: a new day simply has no row yet, so the split resets on its own,
-- and past days stay visible for planning.

create table public.daily_splits (
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,                                   -- the user's calendar day
  groups      public.muscle_group[] not null default '{}',
  updated_at  timestamptz not null default now(),
  primary key (user_id, date)
);

alter table public.daily_splits enable row level security;
revoke all on public.daily_splits from anon;
create policy "own rows" on public.daily_splits for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter table public.user_settings drop column current_split;
