// Portion → grams → nutrients, for foods from the dataset (see data/foods/schema.ts).
// Values are per 100 g as eaten, so a portion is simply scaled: nutrient × grams / 100.
// Rounded to whole numbers when logged (protein to whole grams, like typed entries).

import type { Food, Portion } from '../data/foods/schema'
import type { FoodRef, Nutrients } from '../data/types'

// null portion = weighed: qty is the grams eaten
export const portionGrams = (portion: Portion | null, qty: number) => (portion ? portion.grams * qty : qty)

export function nutrientsFor(food: Food, grams: number): Nutrients {
  const f = grams / 100
  const p = food.per100g
  return {
    grams: Math.round(p.protein_g * f),
    kcal: Math.round(p.kcal * f),
    carbs_g: Math.round(p.carbs_g * f),
    fat_g: Math.round(p.fat_g * f),
  }
}

export const defaultPortion = (food: Food) => food.portions.find((p) => p.default) ?? food.portions[0] ?? null

// What gets stored with the entry, so it can be shown and edited later
export function foodRef(food: Food, portion: Portion | null, qty: number): FoodRef {
  return {
    food_id: food.id,
    portion_label: portion?.label ?? null,
    portion_qty: portion ? qty : null,
    portion_grams: Math.round(portionGrams(portion, qty) * 10) / 10,
  }
}

// 2 → "2", 1.5 → "1.5", 0.25 → "0.25"
export const fmtQty = (n: number) => String(Math.round(n * 100) / 100)

// "1 katori", "2 × katori", "180 g". Labels in the dataset start with "1 ", which is dropped for other amounts.
export function portionText(ref: Pick<FoodRef, 'portion_label' | 'portion_qty' | 'portion_grams'>): string | null {
  if (ref.portion_label && ref.portion_qty) {
    return ref.portion_qty === 1 ? ref.portion_label : `${fmtQty(ref.portion_qty)} × ${ref.portion_label.replace(/^1\s+/, '')}`
  }
  return ref.portion_grams ? `${fmtQty(ref.portion_grams)} g` : null
}

// Quantity stepper: halves for household units, 10 g for weighed food
export const QTY_STEP = 0.5
export const GRAM_STEP = 10
export const MAX_QTY = 20
export const MAX_GRAMS = 2000
