// Runs the migration on an in-memory Postgres (PGlite) with a stand-in for Supabase auth,
// then checks row-level security: users only see and change their own data.
// Run: cd supabase/tests && npm install && npm test
import { PGlite } from '@electric-sql/pglite'
import fs from 'fs'
const db = new PGlite()
await db.exec(`
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;
grant usage on schema public to authenticated, anon;
`)
for (const f of fs.readdirSync(new URL('../migrations/', import.meta.url)).sort()) {
  await db.exec(fs.readFileSync(new URL(`../migrations/${f}`, import.meta.url), 'utf8'))
}
await db.exec(`grant all on all tables in schema public to authenticated; grant usage on schema public to service_role; grant all on all tables in schema public to service_role;`)
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
await as(A, `insert into user_settings(body_weight_unit) values ('kg')`); ok('settings row')
await as(A, `insert into daily_splits(date,groups) values ('2026-10-13','{Chest,Triceps}'),('2026-10-17','{Back}')`)
await as(A, `insert into daily_splits(date,groups) values ('2026-10-17','{Back,Biceps}') on conflict (user_id,date) do update set groups=excluded.groups`)
const sp=(await as(A,`select date::text d, groups::text g from daily_splits order by date`)).rows
JSON.stringify(sp)==='[{"d":"2026-10-13","g":"{Chest,Triceps}"},{"d":"2026-10-17","g":"{Back,Biceps}"}]'?ok('daily splits: one per day, upsert replaces'):bad(JSON.stringify(sp))
const spB=(await as(B,`select count(*)::int c from daily_splits`)).rows[0].c; spB===0?ok('B sees 0 of A\'s splits'):bad('B sees A splits')
// save_lift_session RPC: atomic, idempotent, RLS-respecting
const sid='aaaaaaaa-0000-0000-0000-000000000001'
const rpc=(u,sets,id=sid,exid=ex)=>as(u, `select public.save_lift_session('${id}','${exid}','2026-10-17T10:00:00Z','2026-10-17','${JSON.stringify(sets)}'::jsonb)`)
await rpc(A,[{set_number:1,weight:60,unit:'kg'},{set_number:2,weight:25,unit:'lb'}])
await rpc(A,[{set_number:1,weight:62.5,unit:'kg'},{set_number:2,weight:62.5,unit:'kg'},{set_number:3,weight:65,unit:'kg'}])
const rs=(await as(A,`select set_number, weight::text w, unit from lift_sets where session_id='${sid}' order by set_number`)).rows
const rc=(await as(A,`select count(*)::int c from lift_sessions where id='${sid}'`)).rows[0].c
;(rc===1 && JSON.stringify(rs.map(r=>r.w+r.unit))==='["62.50kg","62.50kg","65.00kg"]')?ok('RPC: resave replaces sets, no duplicate session'):bad(JSON.stringify(rs))
try { await rpc(A,[{set_number:1,weight:-5,unit:'kg'}]); bad('negative weight saved') } catch { const after=(await as(A,`select count(*)::int c from lift_sets where session_id='${sid}'`)).rows[0].c; after===3?ok('RPC: failed save rolls back (sets unchanged)'):bad('partial save '+after) }
try { await rpc(A,[]); bad('empty session saved') } catch { ok('RPC: empty session refused') }
try { await rpc(B,[{set_number:1,weight:100,unit:'kg'}]); bad('B overwrote A session via RPC') } catch { ok('RPC: B cannot overwrite A\'s session') }
const exB=(await as(B,`insert into exercises(name,muscle_group) values ('B row','Back') returning id`)).rows[0].id
try { await rpc(B,[{set_number:1,weight:1,unit:'kg'}],'bbbbbbbb-0000-0000-0000-000000000001',ex); bad('B logged into A exercise') } catch { ok('RPC: B cannot log to A\'s exercise') }
await rpc(B,[{set_number:1,weight:1,unit:'kg'}],'bbbbbbbb-0000-0000-0000-000000000002',exB); ok('RPC: B logs to own exercise')
await db.exec('set role anon'); try { await db.query(`select public.save_lift_session('${sid}','${ex}',now(),'2026-10-17','[{"set_number":1,"weight":1,"unit":"kg"}]')`); bad('anon called RPC') } catch { ok('RPC: anon cannot call') } finally { await db.exec('reset role') }
// Cardio
const cid='cccccccc-0000-0000-0000-000000000001'
await as(A, `insert into cardio_sessions(id,kind,minutes,effort,local_date) values ('${cid}','treadmill_run',30,'hard','2026-10-19')`)
await as(A, `insert into cardio_sessions(id,kind,minutes,effort,local_date) values ('${cid}','treadmill_run',35,'hard','2026-10-19') on conflict (id) do update set minutes=excluded.minutes`)
const cr=(await as(A,`select minutes from cardio_sessions`)).rows; (cr.length===1&&cr[0].minutes===35)?ok('cardio: upsert by id replaces'):bad(JSON.stringify(cr))
const crB=(await as(B,`select count(*)::int c from cardio_sessions`)).rows[0].c; crB===0?ok('cardio: B sees 0 of A\'s sessions'):bad('B sees A cardio')
try { await as(A, `insert into cardio_sessions(kind,minutes,local_date) values ('cycling',0,'2026-10-19')`); bad('0 minutes allowed') } catch { ok('cardio: minutes must be 1 to 600') }
try { await as(A, `insert into cardio_sessions(kind,minutes,local_date) values ('skipping',10,'2026-10-19')`); bad('unknown kind allowed') } catch { ok('cardio: unknown type refused') }
await db.exec('set role anon'); try { await db.query('select * from cardio_sessions'); bad('anon read cardio') } catch { ok('cardio: anon cannot read') } finally { await db.exec('reset role') }
try { await as(A, `insert into protein_goals(goal_g,effective_from) values (5,'2026-10-16')`); bad('goal 5 allowed') } catch { ok('goal bounds enforced') }
// anon gets nothing
await db.exec('set role anon'); try { await db.query('select * from exercises'); bad('anon read') } catch { ok('anon cannot read') } finally { await db.exec('reset role') }
// Food log (TF-36): protein_entries carry calories and the food + portion; calorie goals
await as(A, `insert into protein_entries(grams,label,local_date) values (24,'Whey scoop','2026-10-23')`)
ok('food: old-style protein entry (no calories) still saves')
await as(A, `insert into protein_entries(grams,kcal,carbs_g,fat_g,label,food_id,portion_label,portion_qty,portion_grams,local_date)
             values (6,240,40,6,'Roti','roti','1 roti',2,80,'2026-10-23')`)
const fe=(await as(A,`select grams,kcal,food_id,portion_qty::text q,portion_grams::text g from protein_entries where food_id='roti'`)).rows[0]
;(fe&&fe.kcal===240&&fe.q==='2.00'&&fe.g==='80.0')?ok('food: entry with kcal, food and portion saves'):bad(JSON.stringify(fe))
await as(A, `insert into protein_entries(grams,kcal,label,local_date) values (0,95,'Apple','2026-10-23')`); ok('food: 0 g protein allowed when it has calories')
try { await as(A, `insert into protein_entries(grams,local_date) values (0,'2026-10-23')`); bad('empty entry saved') } catch { ok('food: entry with no protein and no calories refused') }
try { await as(A, `insert into protein_entries(grams,kcal,local_date) values (5,-1,'2026-10-23')`); bad('negative kcal') } catch { ok('food: negative kcal refused') }
try { await as(A, `insert into protein_entries(grams,kcal,local_date) values (5,9000,'2026-10-23')`); bad('9000 kcal') } catch { ok('food: kcal capped at 5000 per entry') }
try { await as(A, `insert into protein_entries(grams,food_id,local_date) values (5,'roti','2026-10-23')`); bad('food without amount') } catch { ok('food: dataset food needs portion grams') }
try { await as(A, `insert into protein_entries(grams,portion_label,portion_grams,local_date) values (5,'1 roti',40,'2026-10-23')`); bad('portion without qty') } catch { ok('food: portion label needs a quantity') }
try { await as(A, `insert into protein_entries(grams,food_id,portion_grams,local_date) values (5,'Bad Id!',40,'2026-10-23')`); bad('bad food id') } catch { ok('food: malformed food id refused') }
await as(A, `insert into protein_entries(grams,kcal,food_id,portion_grams,local_date) values (1,30,'off:3017620422003',15,'2026-10-23')`); ok('food: prefixed id (future Open Food Facts) accepted')
const feB=(await as(B,`select count(*)::int c from protein_entries`)).rows[0].c; feB===0?ok('food: B sees 0 of A\'s entries'):bad('B sees A food')
const feU=await as(B,`update protein_entries set kcal=1 returning id`); feU.rows.length===0?ok('food: B update of A\'s entries touches 0 rows'):bad('B updated A food')
// quick-adds pointing at a dataset food
await as(A, `insert into quick_adds(name,grams,kcal,food_id,portion_label,portion_qty,portion_grams) values ('2 rotis',6,240,'roti','1 roti',2,80)`); ok('quick-add: saves a dataset food + portion')
await as(A, `insert into quick_adds(name,grams,kcal) values ('Black coffee',0,5)`); ok('quick-add: 0 g protein allowed with calories')
try { await as(A, `insert into quick_adds(name,grams) values ('Nothing',0)`); bad('empty quick-add') } catch { ok('quick-add: no protein and no calories refused') }
// a protein entry still can't point at someone else's quick-add
const qaA=(await as(A,`select id from quick_adds limit 1`)).rows[0].id
try { await as(B, `insert into protein_entries(grams,quick_add_id,local_date) values (5,'${qaA}','2026-10-23')`); bad('B used A quick-add') } catch { ok('food: B blocked from linking A\'s quick-add') }
// calorie goals
await as(A, `insert into calorie_goals(goal_kcal,effective_from) values (2200,'2026-10-20')`)
await as(A, `insert into calorie_goals(goal_kcal,effective_from) values (2000,'2026-10-20') on conflict (user_id,effective_from) do update set goal_kcal=excluded.goal_kcal`)
const cg=(await as(A,`select goal_kcal from calorie_goals`)).rows; (cg.length===1&&cg[0].goal_kcal===2000)?ok('calorie goal: one per day, upsert replaces'):bad(JSON.stringify(cg))
try { await as(A, `insert into calorie_goals(goal_kcal,effective_from) values (300,'2026-10-21')`); bad('300 kcal goal') } catch { ok('calorie goal: bounds 800 to 6000 enforced') }
const cgB=(await as(B,`select count(*)::int c from calorie_goals`)).rows[0].c; cgB===0?ok('calorie goal: B sees 0 of A\'s goals'):bad('B sees A goals')
try { await as(B, `insert into calorie_goals(user_id,goal_kcal,effective_from) values ('${A}',2500,'2026-10-22')`); bad('B wrote A goal') } catch { ok('calorie goal: B blocked from writing as A') }
await db.exec('set role anon'); try { await db.query('select * from calorie_goals'); bad('anon read calorie goals') } catch { ok('calorie goal: anon cannot read') } finally { await db.exec('reset role') }
await db.exec('set role anon'); try { await db.query('select * from protein_entries'); bad('anon read food') } catch { ok('food: anon cannot read') } finally { await db.exec('reset role') }
// Macros + AI estimates (round 2): fibre / added sugar, fitness goal, AI cache and daily usage
await as(A, `insert into protein_entries(grams,kcal,fiber_g,added_sugar_g,label,local_date) values (3,180,4,12,'Gulab jamun','2026-10-24')`)
const fs2=(await as(A,`select fiber_g,added_sugar_g from protein_entries where label='Gulab jamun'`)).rows[0]
;(fs2.fiber_g===4&&fs2.added_sugar_g===12)?ok('macros: entry stores fibre and added sugar'):bad(JSON.stringify(fs2))
try { await as(A, `insert into protein_entries(grams,kcal,fiber_g,local_date) values (3,100,-1,'2026-10-24')`); bad('negative fibre') } catch { ok('macros: negative fibre refused') }
try { await as(A, `insert into quick_adds(name,grams,kcal,added_sugar_g) values ('Sweets',1,100,2000)`); bad('2000 g sugar') } catch { ok('macros: added sugar capped on saved foods') }
const qid='dddddddd-0000-0000-0000-000000000001'
await as(A, `insert into quick_adds(id,name,grams,kcal,fiber_g,added_sugar_g,sort_order) values ('${qid}','Oats',13,380,10,0,9)`)
await as(A, `insert into quick_adds(id,name,grams,kcal,fiber_g,added_sugar_g,sort_order) values ('${qid}','Oats bowl',13,380,10,0,9) on conflict (id) do update set name=excluded.name`)
const qo=(await as(A,`select name from quick_adds where id='${qid}'`)).rows; (qo.length===1&&qo[0].name==='Oats bowl')?ok('saved food: upsert by app-made id (outbox) replaces'):bad(JSON.stringify(qo))
try { await as(B, `insert into quick_adds(id,name,grams,sort_order) values ('${qid}','Hijack',5,1) on conflict (id) do update set name=excluded.name`); bad('B overwrote A quick-add') } catch { ok('saved food: B cannot overwrite A\'s saved food by id') }
await as(A, `update user_settings set fitness_goal='lose_fat'`)
const fg=(await as(A,`select fitness_goal from user_settings`)).rows[0].fitness_goal; fg==='lose_fat'?ok('goal: fitness goal saved'):bad(fg)
try { await as(A, `update user_settings set fitness_goal='bulk'`); bad('unknown goal') } catch { ok('goal: unknown fitness goal refused') }
const fgB=(await as(B,`insert into user_settings default values returning fitness_goal`)).rows[0].fitness_goal; fgB==='maintain'?ok('goal: defaults to maintain'):bad(fgB)
// AI cache: service role writes, signed-in users read, nobody else writes
await db.exec(`set role service_role`); await db.query(`insert into ai_food_cache(query_key,query,result,model) values ('2 aloo parathas','2 aloo parathas','{"kcal":600}','claude-opus-5-5')`); await db.exec('reset role')
ok('ai cache: service role writes')
const cr2=(await as(B,`select result->>'kcal' k from ai_food_cache where query_key='2 aloo parathas'`)).rows; (cr2.length===1&&cr2[0].k==='600')?ok('ai cache: any signed-in user reads it'):bad(JSON.stringify(cr2))
try { await as(A, `insert into ai_food_cache(query_key,query,result,model) values ('x','x','{}','m')`); bad('user wrote cache') } catch { ok('ai cache: signed-in user cannot write') }
const cu=await as(A, `update ai_food_cache set result='{"kcal":1}' returning id`); cu.rows.length===0?ok('ai cache: signed-in user update touches 0 rows'):bad('user updated cache')
const cdl=await as(A, `delete from ai_food_cache returning id`); cdl.rows.length===0?ok('ai cache: signed-in user delete touches 0 rows'):bad('user deleted cache')
await db.exec('set role anon'); try { await db.query('select * from ai_food_cache'); bad('anon read cache') } catch { ok('ai cache: anon cannot read') } finally { await db.exec('reset role') }
// AI usage: counted by the function only, readable by the owner
await db.exec(`set role service_role`)
const t1=(await db.query(`select public.ai_food_take('${A}','2026-10-24') n`)).rows[0].n
const t2=(await db.query(`select public.ai_food_take('${A}','2026-10-24') n`)).rows[0].n
await db.exec('reset role')
;(t1===1&&t2===2)?ok('ai usage: take counts up per call'):bad(`${t1},${t2}`)
const uA=(await as(A,`select count from ai_food_usage`)).rows; (uA.length===1&&uA[0].count===2)?ok('ai usage: owner reads own count'):bad(JSON.stringify(uA))
const uB=(await as(B,`select count(*)::int c from ai_food_usage`)).rows[0].c; uB===0?ok('ai usage: B sees 0 of A\'s usage'):bad('B sees A usage')
try { await as(A, `update ai_food_usage set count=0`).then(r=>{ if (r.rows.length) throw 0 }); const after=(await as(A,`select count from ai_food_usage`)).rows[0].count; after===2?ok('ai usage: owner cannot reset own count'):bad('reset to '+after) } catch { ok('ai usage: owner cannot reset own count') }
try { await as(A, `select public.ai_food_take('${A}','2026-10-24')`); bad('user called take') } catch { ok('ai usage: users cannot call the counter') }
await db.exec('set role anon'); try { await db.query(`select public.ai_food_take('${A}','2026-10-24')`); bad('anon called take') } catch { ok('ai usage: anon cannot call the counter') } finally { await db.exec('reset role') }
