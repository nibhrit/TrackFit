-- Save a lift session and its sets in one transaction (TF-10).
-- The app creates the session id itself, so retrying the same save (e.g. after losing signal)
-- updates the same session instead of creating a duplicate.
-- security invoker: runs as the signed-in user, so all row-level security still applies.

create function public.save_lift_session(
  p_id uuid,
  p_exercise_id uuid,
  p_performed_at timestamptz,
  p_local_date date,
  p_sets jsonb            -- [{"set_number":1,"weight":60,"unit":"kg"}, ...]
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if jsonb_typeof(p_sets) <> 'array' or jsonb_array_length(p_sets) = 0 then
    raise exception 'A session needs at least one set';
  end if;

  insert into public.lift_sessions (id, exercise_id, performed_at, local_date)
  values (p_id, p_exercise_id, p_performed_at, p_local_date)
  on conflict (id) do update
    set performed_at = excluded.performed_at,
        local_date   = excluded.local_date;

  delete from public.lift_sets where session_id = p_id;

  insert into public.lift_sets (session_id, set_number, weight, unit)
  select p_id,
         (s ->> 'set_number')::smallint,
         (s ->> 'weight')::numeric,
         (s ->> 'unit')::public.weight_unit
  from jsonb_array_elements(p_sets) as s;
end;
$$;

revoke all on function public.save_lift_session(uuid, uuid, timestamptz, date, jsonb) from public, anon;
grant execute on function public.save_lift_session(uuid, uuid, timestamptz, date, jsonb) to authenticated;
