// Runs the migration on an in-memory Postgres (PGlite) with a stand-in for Supabase auth,
// then checks row-level security: users only see and change their own data.
// Run: cd supabase/tests && npm install && npm test
import { PGlite } from '@electric-sql/pglite'
import fs from 'fs'
const db = new PGlite()
await db.exec(`
create role anon; create role authenticated;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
grant usage on schema public to authenticated, anon;
`)
await db.exec(fs.readFileSync(new URL("../migrations/20261016000000_init.sql", import.meta.url), 'utf8'))
await db.exec(`grant all on all tables in schema public to authenticated;`)
const A='11111111-1111-1111-1111-111111111111', B='22222222-2222-2222-2222-222222222222'
await db.exec(`insert into auth.users values ('${A}'),('${B}')`)
const as = async (u, sql) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${u}',false);`); try { return await db.query(sql) } finally { await db.exec('reset role') } }
const ok = (m)=>console.log('PASS', m), bad=(m)=>{console.log('FAIL', m); process.exitCode=1}
// A creates data
const ex = (await as(A, `insert into exercises(name,muscle_group,default_unit) values ('Leg press','Legs','kg') returning id`)).rows[0].id
const ses = (await as(A, `insert into lift_sessions(exercise_id,local_date) values ('${ex}','2026-10-16') returning id`)).rows[0].id
await as(A, `insert into lift_sets(session_id,set_number,weight,unit) values ('${ses}',1,60,'kg'),('${ses}',2,62.5,'kg')`)
ok('A inserts exercise, session, sets')
// duplicate name case-insensitive
try { await as(A, `insert into exercises(name,muscle_group) values ('  LEG PRESS ','Legs')`); bad('duplicate allowed') } catch { ok('duplicate name (case/space-insensitive) rejected') }
// B cannot see A's rows
const seen = (await as(B, `select count(*)::int c from exercises`)).rows[0].c
seen===0?ok('B sees 0 of A\'s exercises'):bad('B sees A rows')
// B cannot attach a set to A's session
try { await as(B, `insert into lift_sets(session_id,set_number,weight,unit) values ('${ses}',3,100,'kg')`); bad('B attached set to A session') } catch { ok('B blocked from adding a set to A\'s session') }
// B cannot spoof user_id
try { await as(B, `insert into exercises(user_id,name,muscle_group) values ('${A}','Hack','Back')`); bad('spoof allowed') } catch { ok('B blocked from writing rows as A') }
// B update A rows affects nothing
const upd = await as(B, `update lift_sets set weight=999 returning id`); upd.rows.length===0?ok('B update of A\'s sets touches 0 rows'):bad('B updated A')
// A can read back
const sets = (await as(A, `select weight::text, unit from lift_sets order by set_number`)).rows
JSON.stringify(sets)==='[{"weight":"60.00","unit":"kg"},{"weight":"62.50","unit":"kg"}]'?ok('A reads own sets as entered'):bad(JSON.stringify(sets))
// habits & body weight upsert
await as(A, `insert into daily_habits(date,sugar) values ('2026-10-16','avoided') on conflict (user_id,date) do update set junk_food='had'`)
await as(A, `insert into daily_habits(date,sugar) values ('2026-10-16','avoided') on conflict (user_id,date) do update set junk_food='had'`)
const h=(await as(A,`select sugar,junk_food from daily_habits`)).rows[0]; (h.sugar==='avoided'&&h.junk_food==='had')?ok('habit upsert'):bad(JSON.stringify(h))
await as(A, `insert into body_weights(date,weight,unit) values ('2026-10-16',78.4,'kg') on conflict (user_id,date) do update set weight=excluded.weight`)
await as(A, `insert into body_weights(date,weight,unit) values ('2026-10-16',78.1,'kg') on conflict (user_id,date) do update set weight=excluded.weight`)
const bw=(await as(A,`select weight::text from body_weights`)).rows; (bw.length===1&&bw[0].weight==='78.1')?ok('body weight: second log same day replaces'):bad(JSON.stringify(bw))
await as(A, `insert into user_settings(current_split) values ('{Chest,Triceps}')`); ok('settings with split array')
try { await as(A, `insert into protein_goals(goal_g,effective_from) values (5,'2026-10-16')`); bad('goal 5 allowed') } catch { ok('goal bounds enforced') }
// anon gets nothing
await db.exec('set role anon'); try { await db.query('select * from exercises'); bad('anon read') } catch { ok('anon cannot read') } finally { await db.exec('reset role') }
