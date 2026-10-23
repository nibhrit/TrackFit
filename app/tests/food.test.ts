// Pure-function tests for food search ranking and portion → nutrient maths (TF-36).
// Run: cd app && npm test   (Node's built-in test runner; no extra dependency)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildIndex, foodUsage, normalize, searchFoods, squash, topFoods } from '../src/lib/foodSearch.ts'
import { foodRef, nutrientsFor, portionGrams, portionText } from '../src/lib/nutrition.ts'
import { macroTargets, suggestedKcal } from '../src/lib/macros.ts'
import { checkEstimate, normalizeQuery, requestFor, parseResponse } from '../../supabase/functions/estimate-food/shared.ts'
import type { FoodDataset } from '../src/data/foods/schema.ts'

const data: FoodDataset = JSON.parse(fs.readFileSync(new URL('../src/data/foods/foods.sample.json', import.meta.url), 'utf8'))
const index = buildIndex(data.foods)
const ids = (q: string, usage?: Record<string, number>) => searchFoods(index, q, usage).map((f) => f.id)
const food = (id: string) => data.foods.find((f) => f.id === id)!

test('normalise: case, accents, punctuation', () => {
  assert.equal(normalize('  Dāl-Makhani '), 'dal makhani')
  assert.equal(squash('chapatti'), squash('chapati'))
  assert.equal(squash('dhal'), squash('dal'))
})

test('exact alias and spelling variants', () => {
  assert.equal(ids('chapati')[0], 'roti-whole-wheat')
  assert.equal(ids('Chapatti')[0], 'roti-whole-wheat')
  assert.equal(ids('CHAPĀTI')[0], 'roti-whole-wheat')
  assert.equal(ids('dhal')[0], 'toor-dal-cooked')
  assert.equal(ids('paneer')[0], 'paneer')
  assert.equal(ids('panner')[0], 'paneer')
})

test('prefix while typing, including half-typed words', () => {
  assert.equal(ids('ro')[0], 'roti-whole-wheat')
  assert.equal(ids('pan')[0], 'paneer')
  assert.ok(ids('chicken br').includes('chicken-breast-cooked'))
  assert.equal(ids('chicken br')[0], 'chicken-breast-cooked')
  assert.ok(ids('dal coo').includes('toor-dal-cooked'))
})

test('ranking: exact > prefix > contains', () => {
  // both names start with "egg": the shorter one first
  assert.deepEqual(ids('egg').slice(0, 2), ['egg-boiled', 'egg-white-boiled'])
  // "chicken": exact alias of chicken breast beats the prefix match of chicken biryani
  assert.deepEqual(ids('chicken').slice(0, 2), ['chicken-breast-cooked', 'chicken-biryani-restaurant'])
  // contains: "ryani" is only inside biryani
  assert.equal(ids('ryani')[0], 'chicken-biryani-restaurant')
})

test('typos', () => {
  assert.equal(ids('chiken')[0], 'chicken-breast-cooked')
  assert.equal(ids('biryni')[0], 'chicken-biryani-restaurant')
  assert.equal(ids('banan')[0], 'banana')
  assert.deepEqual(ids('xyzzy'), [])
  assert.deepEqual(ids('   '), [])
})

test('frequent foods win ties', () => {
  const usage = { 'chicken-biryani-restaurant': 5 }
  // "chick" is a prefix of both names (same rank), so usage decides
  assert.equal(ids('chick')[0], 'chicken-breast-cooked') // shorter name wins with no usage
  assert.equal(ids('chick', usage)[0], 'chicken-biryani-restaurant')
})

test('recent / frequent foods for an empty query', () => {
  const entries = [
    { food_id: 'paneer', local_date: '2026-09-25' },
    { food_id: 'paneer', local_date: '2026-09-26' },
    { food_id: 'roti-whole-wheat', local_date: '2026-10-23' },
    { food_id: 'roti-whole-wheat', local_date: '2026-10-22' },
    { food_id: 'banana', local_date: '2026-10-23' },
    { food_id: null, local_date: '2026-10-23' },
  ]
  assert.deepEqual(topFoods(foodUsage(entries, '2026-10-23')), ['roti-whole-wheat', 'banana', 'paneer'])
})

test('portion → grams → nutrients', () => {
  const roti = food('roti-whole-wheat')
  const one = roti.portions.find((p) => p.default)!
  assert.equal(portionGrams(one, 2), 80)
  assert.equal(portionGrams(null, 180), 180)
  // 80 g roti at 297 kcal / 9.8 g protein per 100 g
  // fibre 8.5 g / 100 g; the sample has no added-sugar value, so it stays unknown (null), not 0
  assert.deepEqual(nutrientsFor(roti, 80), { grams: 8, kcal: 238, carbs_g: 40, fat_g: 5, fiber_g: 7, added_sugar_g: null })
  const dal = food('toor-dal-cooked')
  assert.deepEqual(nutrientsFor(dal, portionGrams(dal.portions[0], 1.5)), { grams: 15, kcal: 272, carbs_g: 52, fat_g: 1, fiber_g: 15, added_sugar_g: null })
  assert.deepEqual(nutrientsFor(food('banana'), 0), { grams: 0, kcal: 0, carbs_g: 0, fat_g: 0, fiber_g: 0, added_sugar_g: null })
  const sweet = { ...roti, per100g: { ...roti.per100g, added_sugar_g: 30 } }
  assert.equal(nutrientsFor(sweet, 50).added_sugar_g, 15)
})

test('stored reference and portion text', () => {
  const dal = food('toor-dal-cooked')
  const ref = foodRef(dal, dal.portions[0], 2)
  assert.deepEqual(ref, { food_id: 'toor-dal-cooked', portion_label: '1 katori', portion_qty: 2, portion_grams: 300 })
  assert.equal(portionText(ref), '2 × katori')
  assert.equal(portionText({ ...ref, portion_qty: 1 }), '1 katori')
  assert.equal(portionText(foodRef(dal, null, 180)), '180 g')
  assert.equal(portionText({ portion_label: null, portion_qty: null, portion_grams: null }), null)
})

test('macro targets: lose fat at 2000 kcal, 80 kg', () => {
  const t = macroTargets('lose_fat', 2000, 80)
  assert.equal(t.protein.value, 160)                 // 2.0 g/kg
  assert.equal(t.fat!.value, 56)                     // 25% of 2000 / 9 = 55.6 (above the 0.6 g/kg = 48 g floor)
  assert.equal(t.carbs!.value, 214)                  // (2000 − 160×4 − 56×9) / 4
  assert.equal(t.fiber.value, 28)                    // 14 g per 1000 kcal
  assert.deepEqual([t.sugar!.value, t.sugar!.ideal, t.sugar!.kind], [50, 25, 'max'])  // 10% / 5% of kcal at 4 kcal/g
})

test('macro targets: floors, ranges, no calorie target', () => {
  // low calories: fat floor 0.6 g/kg wins (0.25 × 1400 / 9 = 39 < 48), fibre floor 25 g
  const low = macroTargets('lose_fat', 1400, 80)
  assert.equal(low.fat!.value, 48)
  assert.equal(low.fiber.value, 25)
  assert.equal(macroTargets('maintain', 2400, 70).protein.value, 112)        // 1.6 g/kg
  const build = macroTargets('build_muscle', 2700, 70)
  assert.deepEqual([build.protein.value, build.fat!.value, build.fat!.high], [126, 75, 90])  // 1.8 g/kg; fat 25–30%
  const none = macroTargets('lose_fat', null, 70)
  assert.deepEqual([none.kcal, none.fat, none.carbs, none.sugar, none.protein.value, none.fiber.value], [null, null, null, null, 140, 25])
  assert.equal(suggestedKcal('lose_fat', 78), 1850)  // 24 kcal/kg, rounded to 50
  assert.equal(suggestedKcal('maintain', 70), 2100)
})

// AI estimates: the Edge Function's shared checks
const est = { is_food: true, name: 'Aloo paratha with butter', portion: '2 parathas', grams: 260, kcal: 640,
  protein_g: 14, carbs_g: 82, fat_g: 28, fiber_g: 8, added_sugar_g: 0, assumptions: 'Home style, 1 tsp butter each.' }

test('AI estimate sanity check', () => {
  assert.equal(normalizeQuery('  2 Aloo-Parathas, with BÜTTER '), '2 aloo parathas with butter')
  const ok = checkEstimate(est)
  assert.ok(ok.ok && ok.estimate.confidence === 'estimate' && ok.estimate.kcal === 640)
  const reason = (o: object) => { const r = checkEstimate({ ...est, ...o }); return r.ok ? 'ok' : r.reason }
  assert.equal(reason({ is_food: false }), 'not_food')
  assert.equal(reason({ kcal: 1500 }), 'energy_mismatch')           // 4P+4C+9F = 636, not 1500
  assert.equal(reason({ kcal: -5 }), 'bad_number')
  assert.equal(reason({ grams: 0 }), 'grams_out_of_range')
  assert.equal(reason({ fiber_g: 90 }), 'parts_exceed_carbs')
  assert.equal(reason({ grams: 100 }), 'macros_exceed_weight')      // 124 g of macros in 100 g of food
  assert.equal(reason({ grams: 60 }), 'too_dense')                  // 640 kcal in 60 g is denser than pure fat
  assert.equal(reason({ kcal: 30, protein_g: 0, carbs_g: 7, fat_g: 0, fiber_g: 0, grams: 100 }), 'ok')  // small: 25 kcal slack
})

test('AI request: structured output, fallback only where supported', () => {
  const sonnet = requestFor('claude-sonnet-5-5', 'dal')
  assert.equal(sonnet.output_config.format.type, 'json_schema')
  assert.equal(sonnet.output_config.effort, 'medium')
  assert.deepEqual([sonnet.betas, sonnet.fallbacks], [['server-side-fallback-2026-07-01'], 'default'])
  assert.ok(!('thinking' in sonnet))                                 // adaptive by default; never "disabled"
  const haiku = requestFor('claude-haiku-5-5', 'dal')
  assert.ok(!('fallbacks' in haiku) && !('betas' in haiku))
  assert.deepEqual(parseResponse({ stop_reason: 'refusal', content: [] }), { ok: false, reason: 'refusal' })
  assert.deepEqual(parseResponse({ stop_reason: 'max_tokens', content: [{ type: 'text', text: '{"is' }] }), { ok: false, reason: 'truncated' })
  const good = parseResponse({ stop_reason: 'end_turn', content: [{ type: 'thinking' }, { type: 'text', text: JSON.stringify(est) }] })
  assert.ok(good.ok && good.output.kcal === 640)
})
