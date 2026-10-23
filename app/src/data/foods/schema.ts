// Contract between the food dataset (foods.json) and the app.
// The dataset is curated from published sources; every food carries its source and a confidence level.

export type FoodCategory = 'indian_home' | 'basic' | 'restaurant'

// Nutrients per 100 g of the food *as eaten* (cooked dishes = cooked weight)
export type Per100g = {
  kcal: number
  protein_g: number
  carbs_g: number     // total carbohydrate INCLUDING fibre (USDA convention); never add fibre on top
  fat_g: number
  fiber_g?: number
}

// A household measure, e.g. "1 katori" = 150 g of cooked dal. Exactly one portion per food has default: true.
export type Portion = { label: string; grams: number; default?: boolean }

export type FoodSource = {
  name: string        // e.g. "USDA FoodData Central", "Indian Nutrient Databank (INDB)"
  ref?: string        // dataset id / table row / FDC id
  url?: string
}

// measured   = value taken directly from a lab-analysed table entry
// calculated = computed from a standard recipe of measured ingredients
// estimate   = typical value where no direct source exists (restaurant dishes); shown as "about"
export type Confidence = 'measured' | 'calculated' | 'estimate'

export type Food = {
  id: string            // stable kebab-case slug, never reused, e.g. "toor-dal-cooked"
  name: string          // display name, sentence case, e.g. "Toor dal, cooked"
  aliases: string[]     // search terms incl. Hindi/regional names, e.g. ["arhar dal", "tuvar dal"]
  category: FoodCategory
  per100g: Per100g
  portions: Portion[]
  source: FoodSource
  confidence: Confidence
  notes?: string        // assumptions, e.g. "home recipe with 1 tsp oil per serving"
}

export type FoodDataset = {
  version: string       // e.g. "2026.10.1"
  generated: string     // ISO date
  foods: Food[]
}
