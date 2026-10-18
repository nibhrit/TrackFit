// Calories burnt, estimated with the standard MET method:
//   kcal = MET × body weight (kg) × hours
// MET values are approximate (based on the Compendium of Physical Activities).
// Expect roughly ±20–30% accuracy: shown in the app as "about N kcal".

import type { CardioKind, Effort } from '../data/types'

export const CARDIO_MET: Record<CardioKind, Record<Effort, number>> = {
  treadmill_run:  { easy: 7.0, moderate: 9.8, hard: 11.5 },
  treadmill_walk: { easy: 2.8, moderate: 3.5, hard: 5.3 },   // hard ≈ brisk on an incline
  cycling:        { easy: 4.8, moderate: 6.8, hard: 8.8 },
  elliptical:     { easy: 4.6, moderate: 5.0, hard: 7.0 },
  rowing:         { easy: 4.8, moderate: 7.0, hard: 8.5 },
  stair_climber:  { easy: 6.8, moderate: 9.0, hard: 10.5 },
  swimming:       { easy: 5.8, moderate: 8.3, hard: 10.0 },
  other:          { easy: 3.5, moderate: 5.0, hard: 7.0 },
}

// Lifting has no duration in the app, so it's estimated from sets:
// about 3 minutes per set including rest, at a vigorous strength-training MET.
export const LIFT_MET = 5.0
export const MINUTES_PER_SET = 3

export const DEFAULT_BODY_KG = 70 // used until the first weigh-in

export const cardioKcal = (kind: CardioKind, effort: Effort, minutes: number, kg: number) =>
  CARDIO_MET[kind][effort] * kg * (minutes / 60)

export const liftKcal = (sets: number, kg: number) => LIFT_MET * kg * ((sets * MINUTES_PER_SET) / 60)
