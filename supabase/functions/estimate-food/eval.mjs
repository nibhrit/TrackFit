// Model eval for estimate-food: how close are AI estimates to the curated dataset, and what do they cost?
//
// Takes ~30 measured/calculated foods from app/src/data/foods/foods.json (half Indian home dishes, half basics),
// asks each model with the exact prompt and schema the Edge Function uses (shared.ts) for "<food>, <household portion>",
// and compares the answer with the dataset's value for that portion.
// Prints mean absolute % error per nutrient per model, how many answers passed the sanity check, tokens and $ cost.
//
// Run (from this folder, in your own terminal; the key is read from the environment and never printed):
//   npm install --no-save @anthropic-ai/sdk@1.1.0
//   ANTHROPIC_API_KEY=... node --experimental-strip-types eval.mjs            # all three models, 30 foods
//   node --experimental-strip-types eval.mjs --n=10 --models=claude-haiku-5-5  # quicker / cheaper
//   node --experimental-strip-types eval.mjs --models=claude-sonnet-5-5 --effort=low  # effort sweep for the app's model
//
// No server-side fallback here, so each model is measured on its own; a refusal counts as a failed answer.

import Anthropic from '@anthropic-ai/sdk'
import fs from 'node:fs'
import { checkEstimate, parseResponse, requestFor } from './shared.ts'

// $ per million tokens (input, output)
const PRICES = {
  'claude-opus-5-5': [4, 20],
  'claude-sonnet-5-5': [2, 10],
  'claude-haiku-5-5': [0.1, 0.5],
}
const arg = (name, fallback) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback
const MODELS = arg('models', Object.keys(PRICES).join(',')).split(',')
const N = Number(arg('n', 30))
const EFFORT = arg('effort', 'medium')
const CONCURRENCY = 4

// Errors are relative to the true value, with a floor so near-zero values (fat in rice, sugar in dal) don't explode:
// e.g. 1 g fat estimated as 2 g counts as |2 − 1| / max(1, 2) = 50%, not 100%.
const NUTRIENTS = [
  ['kcal', 'kcal', 20], ['protein_g', 'protein_g', 2], ['carbs_g', 'carbs_g', 2],
  ['fat_g', 'fat_g', 2], ['fiber_g', 'fiber_g', 1], ['added_sugar_g', 'added_sugar_g', 1],
]

const data = JSON.parse(fs.readFileSync(new URL('../../../app/src/data/foods/foods.json', import.meta.url), 'utf8'))

// A fixed, spread-out sample: same foods every run, so runs are comparable
function pick(foods, n) {
  // Measured/calculated foods as eaten (raw ingredients like raw fish aren't what people log)
  const ok = foods.filter((f) => f.confidence !== 'estimate' && !/\braw\b/i.test(f.name)).sort((a, b) => a.id.localeCompare(b.id))
  const take = (list, k) => Array.from({ length: Math.min(k, list.length) }, (_, i) => list[Math.floor((i * list.length) / Math.min(k, list.length))])
  const indian = ok.filter((f) => f.category === 'indian_home')
  const rest = ok.filter((f) => f.category !== 'indian_home')
  return [...take(indian, Math.ceil(n / 2)), ...take(rest, Math.floor(n / 2))]
}

const cases = pick(data.foods, N).map((f) => {
  const p = f.portions.find((x) => x.default) ?? f.portions[0]
  const k = p.grams / 100
  const truth = { grams: p.grams }
  for (const [key, src] of NUTRIENTS) if (f.per100g[src] != null) truth[key] = f.per100g[src] * k
  return { id: f.id, query: `${f.name.toLowerCase()}, ${p.label}`, truth }
})

const client = new Anthropic({ maxRetries: 3 })

async function runCase(model, c) {
  try {
    const r = await client.beta.messages.create(requestFor(model, c.query, { fallback: false, effort: EFFORT }))
    const usage = { input: r.usage.input_tokens, output: r.usage.output_tokens }
    const parsed = parseResponse(r)
    if (!parsed.ok) return { c, usage, error: parsed.reason }
    const checked = checkEstimate(parsed.output)
    return { c, usage, out: parsed.output, sane: checked.ok, reason: checked.ok ? null : checked.reason }
  } catch (e) {
    const msg = e instanceof Anthropic.APIError ? `${e.constructor.name}${e.status ? ` ${e.status}` : ''}` : String(e?.message ?? e)
    return { c, usage: { input: 0, output: 0 }, error: msg }
  }
}

async function runModel(model) {
  const results = []
  let next = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < cases.length) {
      const c = cases[next++]
      results.push(await runCase(model, c))
      process.stderr.write('.')
    }
  }))
  process.stderr.write('\n')
  return results
}

const pct = (n) => (n == null ? '   -' : `${Math.round(n * 100)}%`.padStart(4))
const summary = []

for (const model of MODELS) {
  process.stderr.write(`${model} `)
  const results = await runModel(model)
  const answered = results.filter((r) => r.out)
  const err = {}
  for (const [key, , floor] of [...NUTRIENTS, ['grams', 'grams', 10]]) {
    const xs = answered.filter((r) => r.c.truth[key] != null)
      .map((r) => Math.abs(r.out[key] - r.c.truth[key]) / Math.max(floor, r.c.truth[key]))
    err[key] = xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null
  }
  const tokens = results.reduce((t, r) => ({ input: t.input + r.usage.input, output: t.output + r.usage.output }), { input: 0, output: 0 })
  const [pin, pout] = PRICES[model] ?? [NaN, NaN]
  const cost = (tokens.input * pin + tokens.output * pout) / 1e6
  summary.push({ model, err, answered: answered.length, sane: answered.filter((r) => r.sane).length, failed: results.length - answered.length, tokens, cost })

  // Worst kcal misses, to see what goes wrong
  const worst = answered
    .map((r) => ({ r, e: Math.abs(r.out.kcal - r.c.truth.kcal) / Math.max(20, r.c.truth.kcal) }))
    .sort((a, b) => b.e - a.e).slice(0, 3)
  for (const { r, e } of worst) console.log(`  ${model}  worst kcal: "${r.c.query}" → ${Math.round(r.out.kcal)} vs ${Math.round(r.c.truth.kcal)} (${pct(e).trim()})`)
  for (const r of results.filter((x) => x.error)) console.log(`  ${model}  failed: "${r.c.query}" (${r.error})`)
}

console.log(`\nMean absolute % error vs dataset, ${cases.length} foods, effort ${EFFORT} (lower is better). The app uses claude-sonnet-5-5.\n`)
console.log('model               kcal  prot carbs  fat fibre sugar grams  sane  failed   in tok  out tok     cost')
for (const s of summary) {
  const e = s.err
  console.log(
    `${s.model.padEnd(18)} ${pct(e.kcal)}  ${pct(e.protein_g)}  ${pct(e.carbs_g)} ${pct(e.fat_g)}  ${pct(e.fiber_g)}  ${pct(e.added_sugar_g)}  ${pct(e.grams)}` +
    `  ${String(s.sane).padStart(2)}/${String(s.answered).padEnd(2)}  ${String(s.failed).padStart(5)}` +
    `  ${String(s.tokens.input).padStart(7)}  ${String(s.tokens.output).padStart(7)}  $${s.cost.toFixed(4)}`,
  )
}
console.log('\nsane = answers that passed the Edge Function\'s sanity check. Cost = this run; per estimate ≈ cost / foods.')
