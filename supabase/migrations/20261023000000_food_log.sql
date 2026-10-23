-- Food log + calories eaten (epic TF-36).
-- protein_entries becomes the food log: each entry keeps its protein grams (so every existing entry and quick-add
-- still counts toward protein) and can now also carry calories, carbs, fat and the food + portion it came from.
-- The table keeps its name on purpose: installed phones may still have protein saves queued in their outbox,
-- and renaming would make those fail and be discarded.
--
-- Nutrients are stored on the entry as logged (a snapshot), never looked up again,
-- so a later correction to the food dataset doesn't rewrite past days.
--
-- food_id is the dataset id (e.g. 'toor-dal-cooked'). Other sources get a prefix later,
-- e.g. 'off:<barcode>' for Open Food Facts, so they can't collide with dataset ids.

-- ---------- Food entries ----------
alter table public.protein_entries
  add column kcal           smallint     check (kcal is null or kcal between 0 and 5000),
  add column carbs_g        smallint     check (carbs_g is null or carbs_g between 0 and 1000),
  add column fat_g          smallint     check (fat_g is null or fat_g between 0 and 1000),
  add column food_id        text         check (food_id is null or food_id ~ '^[a-z0-9][a-z0-9:._-]{0,99}$'),
  add column portion_label  text         check (portion_label is null or char_length(portion_label) between 1 and 40),  -- e.g. '1 katori'
  add column portion_qty    numeric(5,2) check (portion_qty is null or (portion_qty > 0 and portion_qty <= 100)),  -- e.g. 2 (katoris)
  add column portion_grams  numeric(6,1) check (portion_grams is null or (portion_grams > 0 and portion_grams <= 5000)), -- total grams eaten
  -- a household portion always comes with how many of it
  add constraint protein_entries_portion_pair check ((portion_label is null) = (portion_qty is null)),
  -- a food from a dataset always records how much was eaten
  add constraint protein_entries_food_amount check (food_id is null or portion_grams is not null);

-- Foods can have 0 g protein (fruit, coffee), so 0 is allowed, as long as the entry carries something
alter table public.protein_entries drop constraint protein_entries_grams_check;
alter table public.protein_entries
  add constraint protein_entries_grams_check check (grams between 0 and 1000),
  add constraint protein_entries_not_empty check (grams > 0 or coalesce(kcal, 0) > 0);  -- coalesce: a null kcal would otherwise let the check pass

-- ---------- Saved foods (quick-adds) ----------
-- Same shape, so a one-tap food can be "2 rotis" from the dataset as well as a typed "Whey scoop 24 g"
alter table public.quick_adds
  add column kcal           smallint     check (kcal is null or kcal between 0 and 5000),
  add column carbs_g        smallint     check (carbs_g is null or carbs_g between 0 and 1000),
  add column fat_g          smallint     check (fat_g is null or fat_g between 0 and 1000),
  add column food_id        text         check (food_id is null or food_id ~ '^[a-z0-9][a-z0-9:._-]{0,99}$'),
  add column portion_label  text         check (portion_label is null or char_length(portion_label) between 1 and 40),
  add column portion_qty    numeric(5,2) check (portion_qty is null or (portion_qty > 0 and portion_qty <= 100)),
  add column portion_grams  numeric(6,1) check (portion_grams is null or (portion_grams > 0 and portion_grams <= 5000)),
  add constraint quick_adds_portion_pair check ((portion_label is null) = (portion_qty is null)),
  add constraint quick_adds_food_amount check (food_id is null or portion_grams is not null);

alter table public.quick_adds drop constraint quick_adds_grams_check;
alter table public.quick_adds
  add constraint quick_adds_grams_check check (grams between 0 and 300),
  add constraint quick_adds_not_empty check (grams > 0 or coalesce(kcal, 0) > 0);  -- coalesce: a null kcal would otherwise let the check pass

-- ---------- Calorie target ----------
-- Same history pattern as protein_goals: a change applies from effective_from onward; past days keep theirs.
-- No row = no target set yet (the app suggests one but doesn't assume it).
create table public.calorie_goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid() references auth.users (id) on delete cascade,
  goal_kcal       smallint not null check (goal_kcal between 800 and 6000),
  effective_from  date not null,
  unique (user_id, effective_from)
);

alter table public.calorie_goals enable row level security;
revoke all on public.calorie_goals from anon;
create policy "own rows" on public.calorie_goals for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
