// estimate-food: estimates nutrition for a food that isn't in the app's food list ("2 aloo parathas with butter").
//
// POST { query: string }  with the signed-in user's Authorization header (supabase.functions.invoke sends it)
// 200  { estimate, cache_id, cached, remaining }      estimate = name, portion, grams, kcal, protein_g, carbs_g,
//                                                     fat_g, fiber_g, added_sugar_g, assumptions, confidence: "estimate"
// 4xx/5xx { error: code, message }   codes: unauthorized, bad_query, daily_limit, not_food, unsure, unavailable
//
// Safeguards: signed-in users only (JWT checked with Supabase Auth); a shared cache by normalised query, so repeats are
// free and don't count; a per-user daily cap (FOOD_DAILY_CAP, default 25) counted before calling the model; the model's
// answer is a fixed JSON schema and is sanity-checked (ranges, energy ≈ 4P + 4C + 9F) before it is cached or returned.
//
// Secrets: ANTHROPIC_API_KEY (required), FOOD_MODEL (default claude-sonnet-5-5), FOOD_DAILY_CAP (default 25).
// SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase automatically.

import Anthropic from 'npm:@anthropic-ai/sdk@1.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2.118.0'
import { DEFAULT_MODEL, MAX_QUERY, checkEstimate, normalizeQuery, parseResponse, requestFor } from './shared.ts'

const MODEL = Deno.env.get('FOOD_MODEL') || DEFAULT_MODEL
const CAP = Number(Deno.env.get('FOOD_DAILY_CAP') || 25)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY'), timeout: 60_000, maxRetries: 1 })
// Service role: bypasses row-level security, so it can write the cache and the usage count. Never sent to the browser.
const admin = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const fail = (status: number, error: string, message: string) => json(status, { error, message })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fail(405, 'bad_query', 'Use POST.')

  // 1. Signed-in users only: ask Supabase Auth who this token belongs to (an anon key or expired token has no user)
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return fail(401, 'unauthorized', 'Sign in to use AI estimates.')
  const { data: auth, error: authError } = await admin.auth.getUser(token)
  if (authError || !auth.user || auth.user.is_anonymous) return fail(401, 'unauthorized', 'Sign in to use AI estimates.')
  const userId = auth.user.id

  // 2. The query
  let query = ''
  try { query = String((await req.json()).query ?? '').trim() } catch { /* handled below */ }
  const key = normalizeQuery(query)
  if (!key || query.length > MAX_QUERY) return fail(400, 'bad_query', `Describe the food in up to ${MAX_QUERY} characters.`)

  // 3. Cache: the same words were estimated before → free, doesn't count toward the cap
  const { data: hit } = await admin.from('ai_food_cache').select('id,result').eq('query_key', key).maybeSingle()
  if (hit) return json(200, { estimate: hit.result, cache_id: hit.id, cached: true, remaining: null })

  // 4. Daily cap (UTC day), counted before the model call so failed calls count too
  const day = new Date().toISOString().slice(0, 10)
  const { data: used, error: capError } = await admin.rpc('ai_food_take', { p_user: userId, p_date: day })
  if (capError) return fail(503, 'unavailable', 'Couldn’t check your daily limit. Try again.')
  if ((used as number) > CAP) return fail(429, 'daily_limit', `That’s today’s ${CAP} AI estimates. Type the numbers instead, or try tomorrow.`)
  const remaining = Math.max(0, CAP - (used as number))

  // 5. Ask the model for structured JSON
  let response
  try {
    response = await anthropic.beta.messages.create(requestFor(MODEL, query))
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return fail(503, 'unavailable', 'AI estimates are busy. Try again in a minute.')
    if (e instanceof Anthropic.APIError) console.error('anthropic', e.status, e.message)
    else console.error('anthropic', e)
    return fail(503, 'unavailable', 'Couldn’t reach the AI service. Try again, or type the numbers.')
  }
  // A refusal (stop_reason "refusal", after any server-side fallback also declined) or a cut-off answer is never parsed
  const parsed = parseResponse(response)
  if (!parsed.ok) {
    console.error('estimate', parsed.reason, response.stop_details ?? '')
    return fail(422, 'unsure', 'Couldn’t estimate that. Try describing it differently, or type the numbers.')
  }

  // 6. Sanity check before anything is stored or shown
  const checked = checkEstimate(parsed.output)
  if (!checked.ok) {
    console.warn('rejected estimate', checked.reason, key, JSON.stringify(parsed.output))
    return checked.reason === 'not_food'
      ? fail(422, 'not_food', 'That doesn’t look like a food. Try e.g. “2 aloo parathas with butter”.')
      : fail(422, 'unsure', 'The estimate didn’t add up, so it wasn’t used. Try describing the amount, or type the numbers.')
  }

  // 7. Cache it (if two people asked at once, keep the first) and return
  const { data: row } = await admin.from('ai_food_cache')
    .upsert({ query_key: key, query, result: checked.estimate, model: response.model }, { onConflict: 'query_key', ignoreDuplicates: true })
    .select('id,result').maybeSingle()
  const cached = row ?? (await admin.from('ai_food_cache').select('id,result').eq('query_key', key).maybeSingle()).data
  return json(200, { estimate: cached?.result ?? checked.estimate, cache_id: cached?.id ?? null, cached: false, remaining })
})
