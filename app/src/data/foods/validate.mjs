// Validates foods.json against the contract in schema.ts and basic nutrition sanity rules.
// Run: node app/src/data/foods/validate.mjs     (exits 1 on any error)
// No dependencies.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const file = process.argv[2] ?? join(here, 'foods.json')
const data = JSON.parse(readFileSync(file, 'utf8'))

const CATEGORIES = ['indian_home', 'basic', 'restaurant']
const CONFIDENCE = ['measured', 'calculated', 'estimate']
const FOOD_KEYS = ['id', 'name', 'aliases', 'category', 'per100g', 'portions', 'source', 'confidence', 'notes']
const PER100_KEYS = ['kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'added_sugar_g']
const ENERGY_TOLERANCE = 0.15 // ±15%
const ENERGY_ABS_SLACK = 8 // kcal; avoids false alarms on near-zero foods (tea, water-heavy drinks)

const errors = []
const warnings = []
const err = (id, msg) => errors.push(`${id}: ${msg}`)
const isNum = (x) => typeof x === 'number' && Number.isFinite(x)
const isStr = (x) => typeof x === 'string' && x.trim().length > 0

// --- dataset shape
if (!isStr(data.version)) err('dataset', 'version missing')
if (!isStr(data.generated) || Number.isNaN(Date.parse(data.generated))) err('dataset', 'generated must be an ISO date')
if (!Array.isArray(data.foods) || data.foods.length === 0) err('dataset', 'foods must be a non-empty array')

const ids = new Set()
const names = new Map()
const energyOffenders = []

for (const [i, f] of (data.foods ?? []).entries()) {
  const id = f?.id ?? `#${i}`

  // shape
  for (const k of Object.keys(f)) if (!FOOD_KEYS.includes(k)) err(id, `unknown key "${k}"`)
  if (!isStr(f.id) || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.id)) err(id, 'id must be kebab-case')
  if (ids.has(f.id)) err(id, 'duplicate id')
  ids.add(f.id)

  if (!isStr(f.name)) err(id, 'name missing')
  else {
    const key = f.name.trim().toLowerCase()
    if (names.has(key)) err(id, `duplicate name (also ${names.get(key)})`)
    names.set(key, f.id)
    if (f.name[0] !== f.name[0].toUpperCase()) err(id, 'name must start with a capital (sentence case)')
  }

  if (!Array.isArray(f.aliases) || f.aliases.length < 1) err(id, 'needs at least one alias')
  else if (!f.aliases.every(isStr)) err(id, 'aliases must be non-empty strings')

  if (!CATEGORIES.includes(f.category)) err(id, `bad category "${f.category}"`)
  if (!CONFIDENCE.includes(f.confidence)) err(id, `bad confidence "${f.confidence}"`)
  if (f.notes !== undefined && typeof f.notes !== 'string') err(id, 'notes must be a string')
  if (typeof f.notes === 'string' && f.notes.length > 240) err(id, `notes too long (${f.notes.length} > 240 chars)`)

  // source
  if (!f.source || !isStr(f.source.name)) err(id, 'source.name missing')
  else {
    for (const k of Object.keys(f.source)) if (!['name', 'ref', 'url'].includes(k)) err(id, `unknown source key "${k}"`)
    if (f.source.url !== undefined && !/^https:\/\//.test(f.source.url)) err(id, 'source.url must be https')
    if (f.confidence === 'measured' && !isStr(f.source.ref)) err(id, 'measured food needs source.ref')
  }

  // per100g
  const n = f.per100g
  if (!n || typeof n !== 'object') { err(id, 'per100g missing'); continue }
  for (const k of Object.keys(n)) if (!PER100_KEYS.includes(k)) err(id, `unknown per100g key "${k}"`)
  for (const k of ['kcal', 'protein_g', 'carbs_g', 'fat_g']) {
    if (!isNum(n[k])) err(id, `per100g.${k} must be a number`)
    else if (n[k] < 0) err(id, `per100g.${k} is negative`)
  }
  if (n.fiber_g !== undefined && (!isNum(n.fiber_g) || n.fiber_g < 0)) err(id, 'per100g.fiber_g must be a non-negative number')
  if (n.fiber_g === undefined) warnings.push(`${id}: fiber_g missing`)
  // added_sugar_g = free/added sugars only (not lactose or fruit sugar); must be filled for every food
  if (n.added_sugar_g === undefined) err(id, 'per100g.added_sugar_g missing (use 0 when none)')
  else if (!isNum(n.added_sugar_g) || n.added_sugar_g < 0) err(id, 'per100g.added_sugar_g must be a non-negative number')
  else if (n.added_sugar_g > n.carbs_g + 0.05) err(id, `added_sugar_g ${n.added_sugar_g} exceeds carbs_g ${n.carbs_g}`)
  if ([n.protein_g, n.carbs_g, n.fat_g].some((x) => x > 100)) err(id, 'a macro exceeds 100 g per 100 g')
  const macroSum = (n.protein_g ?? 0) + (n.carbs_g ?? 0) + (n.fat_g ?? 0)
  if (macroSum > 102) err(id, `protein+carbs+fat = ${macroSum.toFixed(1)} g > 100 g`)
  if (n.kcal > 902) err(id, `kcal ${n.kcal} above pure fat`)
  if (n.fiber_g !== undefined && n.fiber_g > n.carbs_g + 0.05) err(id, 'fibre exceeds total carbs (carbs_g must include fibre)')

  // Energy consistency. carbs_g is TOTAL carbohydrate including fibre (USDA convention),
  // so fibre is counted at 2 kcal/g: 4P + 4(C - fib) + 2·fib + 9F = 4P + 4C + 9F - 2·fib.
  if ([n.kcal, n.protein_g, n.carbs_g, n.fat_g].every(isNum)) {
    const expected = 4 * n.protein_g + 4 * n.carbs_g + 9 * n.fat_g - 2 * (n.fiber_g ?? 0)
    const diff = n.kcal - expected
    if (Math.abs(diff) > Math.max(ENERGY_TOLERANCE * expected, ENERGY_ABS_SLACK)) {
      energyOffenders.push(`${id}: kcal ${n.kcal} vs Atwater ${expected.toFixed(0)} (${((diff / expected) * 100).toFixed(0)}%)`)
    }
  }

  // portions
  if (!Array.isArray(f.portions) || f.portions.length === 0) err(id, 'needs at least one portion')
  else {
    const defaults = f.portions.filter((p) => p.default === true).length
    if (defaults !== 1) err(id, `needs exactly one default portion (has ${defaults})`)
    const labels = new Set()
    for (const p of f.portions) {
      for (const k of Object.keys(p)) if (!['label', 'grams', 'default'].includes(k)) err(id, `unknown portion key "${k}"`)
      if (!isStr(p.label)) err(id, 'portion label missing')
      if (!isNum(p.grams) || p.grams <= 0) err(id, `portion "${p.label}" grams must be > 0`)
      if (p.grams > 1500) warnings.push(`${id}: portion "${p.label}" is ${p.grams} g`)
      if (labels.has(p.label)) err(id, `duplicate portion label "${p.label}"`)
      labels.add(p.label)
    }
  }
}

for (const o of energyOffenders) err('energy', o)

// --- report
const foods = data.foods ?? []
const count = (k) => foods.reduce((m, f) => ((m[f[k]] = (m[f[k]] ?? 0) + 1), m), {})
const fmt = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(', ')

for (const w of warnings) console.warn(`warn  ${w}`)
for (const e of errors) console.error(`error ${e}`)
console.log(`\n${foods.length} foods | by category: ${fmt(count('category'))} | by confidence: ${fmt(count('confidence'))}`)
console.log(errors.length ? `FAIL: ${errors.length} error(s), ${energyOffenders.length} energy offender(s)` : `PASS: 0 errors, ${warnings.length} warning(s)`)
process.exit(errors.length ? 1 : 0)
