// Pure-function tests for food search ranking and portion → nutrient maths (TF-36).
// Run: cd app && npm test   (Node's built-in test runner; no extra dependency)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildIndex, foodUsage, normalize, searchFoods, squash, topFoods } from '../src/lib/foodSearch.ts'
import { foodRef, nutrientsFor, portionGrams, portionText } from '../src/lib/nutrition.ts'
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
  assert.deepEqual(nutrientsFor(roti, 80), { grams: 8, kcal: 238, carbs_g: 40, fat_g: 5 })
  const dal = food('toor-dal-cooked')
  assert.deepEqual(nutrientsFor(dal, portionGrams(dal.portions[0], 1.5)), { grams: 15, kcal: 272, carbs_g: 52, fat_g: 1 })
  assert.deepEqual(nutrientsFor(food('banana'), 0), { grams: 0, kcal: 0, carbs_g: 0, fat_g: 0 })
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
