# estimate-food

Supabase Edge Function behind **"Estimate with AI"** on the Food tab: estimates nutrition for a food that isn't in the app's food list, e.g. "2 aloo parathas with butter".

| File | What it is |
|---|---|
| `index.ts` | The function (Deno): checks the user, cache, daily cap, calls Claude, sanity-checks, caches |
| `shared.ts` | Prompt, JSON schema, query normalisation, sanity check, request body; used by the function, the eval and the app tests |
| `eval.mjs` | Compares Claude Opus 5.5, Sonnet 5.5 and Haiku 5.5 against the curated dataset (accuracy, tokens, cost) |

## Contract

`POST /functions/v1/estimate-food` with the signed-in user's `Authorization: Bearer <access token>` (the app uses `supabase.functions.invoke`, which sends it).

```json
{ "query": "2 aloo parathas with butter" }
```

200:

```json
{
  "estimate": {
    "name": "Aloo paratha with butter", "portion": "2 parathas (about 130 g each) with 1 tsp butter each",
    "grams": 260, "kcal": 640, "protein_g": 14, "carbs_g": 82, "fat_g": 28, "fiber_g": 8, "added_sugar_g": 0,
    "assumptions": "Home style, wheat dough, potato filling, 1 tsp butter on each.", "confidence": "estimate"
  },
  "cache_id": "uuid", "cached": false, "remaining": 24
}
```

Errors are `{ "error": code, "message": text to show }`: `401 unauthorized` · `400 bad_query` · `429 daily_limit` · `422 not_food` · `422 unsure` (refusal, unparseable, or failed the sanity check) · `503 unavailable`.

## Safeguards

- **Signed-in users only.** The token is checked with Supabase Auth (`auth.getUser`); the anon key and anonymous users are refused.
- **Shared cache** (`ai_food_cache`), keyed by the normalised query (lowercase, no accents or punctuation). Repeat lookups by anyone are free and don't count. Only the function (service role) writes it; signed-in users can read it.
- **Daily cap per user** (`FOOD_DAILY_CAP`, default 25), counted in `ai_food_usage` by `ai_food_take()` before each model call. Users can read their own count but can't change it.
- **Structured output**: the model must answer with the JSON schema in `shared.ts`. A refusal (`stop_reason: "refusal"`) or a cut-off answer is never parsed. Server-side fallback (`fallbacks: "default"`) re-runs a declined request on the model Anthropic picks for that refusal category, where the model supports it.
- **Sanity check** before anything is cached or shown: values in range, fibre and added sugar no more than carbs, no denser than pure fat, macros no heavier than the food, and energy ≈ 4P + 4C + 9F within 20% (or 25 kcal for small portions). Anything that fails is rejected and logged, not stored.
- The query is capped at 200 characters and is treated as data, not instructions, in the prompt.

## Secrets

Set in the dashboard (**Edge Functions → Secrets**) or with the CLI:

| Name | Required | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | yes | — |
| `FOOD_MODEL` | no | `claude-sonnet-5-5` |
| `FOOD_DAILY_CAP` | no | `25` |

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to every function by Supabase automatically. You never copy the service role key anywhere; it stays inside Supabase.

## Deploy

Apply `supabase/migrations/20261024000000_macros_ai.sql` first (the cache and usage tables).

**Dashboard:** Edge Functions → Deploy a new function → Via editor → name it `estimate-food`. Create two files with the same contents as `index.ts` and `shared.ts` (keep the names) → Deploy. Leave "Verify JWT" on. Then add the secrets above.

**CLI** (from the repo root, logged in with `supabase login`):

```bash
supabase link --project-ref dediwzfssalzonmlbehn
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...      # type it in your terminal, don't commit it
supabase functions deploy estimate-food
```

Check: open the app, search for something not in the list (e.g. "2 aloo parathas with butter"), tap **Estimate with AI**. Logs: dashboard → Edge Functions → estimate-food → Logs.

## Eval

Runs ~30 measured/calculated foods from `app/src/data/foods/foods.json` (half Indian home dishes) through all three models with the function's exact prompt and schema, and prints the mean absolute % error per nutrient, how many answers passed the sanity check, tokens and cost.

```bash
cd supabase/functions/estimate-food
npm install --no-save @anthropic-ai/sdk@1.1.0
ANTHROPIC_API_KEY=sk-ant-... node --experimental-strip-types eval.mjs
# options: --n=10   --models=claude-sonnet-5-5,claude-haiku-5-5   --effort=low|medium|high
```

A full run makes 90 requests; expect roughly $1–2 in total, most of it Opus (thinking tokens bill as output). The key is read from the environment and never printed. `node_modules/` here is ignored by git and isn't part of the deployed function.
