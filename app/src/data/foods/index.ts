// The food dataset and its search index. Imported lazily (see lib/useFoods.ts), so the dataset isn't part of
// what loads when the app opens; the PWA precaches it with the rest of the app, so search works offline.

import type { Food, FoodDataset } from './schema'
import { buildIndex } from '../../lib/foodSearch'
import sample from './foods.sample.json'

// The curated dataset (foods.json) is used when it exists at build time; until then a small development sample.
// Once foods.json is in place, this line can become:  import data from './foods.json'  (and the sample import goes)
const data = (import.meta.glob<FoodDataset>('./foods.json', { eager: true, import: 'default' })['./foods.json'] ?? sample) as FoodDataset

export const dataset = data
export const index = buildIndex(data.foods)

const byId = new Map(data.foods.map((f) => [f.id, f]))
export const foodById = (id: string | null): Food | undefined => (id ? byId.get(id) : undefined)
