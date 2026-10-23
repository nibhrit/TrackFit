// Daily macro targets from the fitness goal, the calorie target and body weight.
// Rules of thumb from sports-nutrition guidance, rounded for a tracker; they're guides, not prescriptions.
//
//   protein   g/kg of latest body weight: lose fat 2.0 · maintain 1.6 · build muscle 1.8      (at least)
//   fat       25% of the calorie target (build muscle: 25–30%), never below 0.6 g/kg          (about)
//   carbs     what's left of the calorie target after protein and fat, at 4 kcal/g            (about)
//   fibre     14 g per 1000 kcal, at least 25 g                                               (at least)
//   added     limit 10% of calories (4 kcal/g); 5% is the ideal                                (at most)
//   sugar
// Without a calorie target only protein and a 25 g fibre floor can be set.

import type { FitnessGoal } from '../data/types'

export const PROTEIN_PER_KG: Record<FitnessGoal, number> = { lose_fat: 2.0, maintain: 1.6, build_muscle: 1.8 }
const FAT_SHARE: Record<FitnessGoal, [number, number]> = { lose_fat: [0.25, 0.25], maintain: [0.25, 0.25], build_muscle: [0.25, 0.3] }
const FAT_MIN_PER_KG = 0.6

// Rough daily calories by goal: maintenance ≈ 30 kcal/kg; fat loss ≈ 20% below (24 kcal/kg); muscle gain ≈ 10% above
export const KCAL_PER_KG: Record<FitnessGoal, number> = { lose_fat: 24, maintain: 30, build_muscle: 33 }
export const suggestedKcal = (goal: FitnessGoal, kg: number) => Math.round((kg * KCAL_PER_KG[goal]) / 50) * 50

// kind: 'min' = reach at least, 'about' = aim near, 'max' = stay under (a limit, under is good)
export type Target = { value: number; high?: number; kind: 'min' | 'about' | 'max'; ideal?: number }

export type Targets = {
  kcal: Target | null
  protein: Target
  fat: Target | null
  carbs: Target | null
  fiber: Target
  sugar: Target | null
}

export function macroTargets(goal: FitnessGoal, kcal: number | null, kg: number): Targets {
  const protein = Math.round(PROTEIN_PER_KG[goal] * kg)
  if (!kcal) return { kcal: null, protein: { value: protein, kind: 'min' }, fat: null, carbs: null, fiber: { value: 25, kind: 'min' }, sugar: null }
  const [lo, hi] = FAT_SHARE[goal]
  const fatMin = FAT_MIN_PER_KG * kg
  const fat = Math.round(Math.max((lo * kcal) / 9, fatMin))
  const fatHigh = Math.round(Math.max((hi * kcal) / 9, fatMin))
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4))
  return {
    kcal: { value: kcal, kind: 'about' },
    protein: { value: protein, kind: 'min' },
    fat: { value: fat, ...(fatHigh > fat ? { high: fatHigh } : {}), kind: 'about' },
    carbs: { value: carbs, kind: 'about' },
    fiber: { value: Math.max(25, Math.round((14 * kcal) / 1000)), kind: 'min' },
    sugar: { value: Math.round((0.1 * kcal) / 4), ideal: Math.round((0.05 * kcal) / 4), kind: 'max' },
  }
}
