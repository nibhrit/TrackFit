export const GROUPS = ['Chest', 'Back', 'Shoulders', 'Legs', 'Biceps', 'Triceps', 'Core'] as const
export type MuscleGroup = (typeof GROUPS)[number]
export type Unit = 'kg' | 'lb'

export type Exercise = {
  id: string
  name: string
  muscle_group: MuscleGroup
  default_unit: Unit
  archived_at: string | null
  created_at: string
}

export type Settings = {
  body_weight_unit: Unit
}

// Muscle groups per local date ('YYYY-MM-DD'): past = trained, future = planned
export type Splits = Record<string, MuscleGroup[]>

// Offered once on an empty list. Dumbbell work defaults to lb, machines and barbells to kg.
export const STARTERS: Pick<Exercise, 'name' | 'muscle_group' | 'default_unit'>[] = [
  { name: 'Bench press', muscle_group: 'Chest', default_unit: 'kg' },
  { name: 'Incline dumbbell press', muscle_group: 'Chest', default_unit: 'lb' },
  { name: 'Pec deck', muscle_group: 'Chest', default_unit: 'kg' },
  { name: 'Cable fly', muscle_group: 'Chest', default_unit: 'kg' },
  { name: 'Lat pulldown', muscle_group: 'Back', default_unit: 'kg' },
  { name: 'Seated cable row', muscle_group: 'Back', default_unit: 'kg' },
  { name: 'Pull-ups', muscle_group: 'Back', default_unit: 'kg' },
  { name: 'Dumbbell row', muscle_group: 'Back', default_unit: 'lb' },
  { name: 'Shoulder press machine', muscle_group: 'Shoulders', default_unit: 'kg' },
  { name: 'Dumbbell lateral raise', muscle_group: 'Shoulders', default_unit: 'lb' },
  { name: 'Face pull', muscle_group: 'Shoulders', default_unit: 'kg' },
  { name: 'Squat', muscle_group: 'Legs', default_unit: 'kg' },
  { name: 'Leg press', muscle_group: 'Legs', default_unit: 'kg' },
  { name: 'Leg extension', muscle_group: 'Legs', default_unit: 'kg' },
  { name: 'Leg curl', muscle_group: 'Legs', default_unit: 'kg' },
  { name: 'Romanian deadlift', muscle_group: 'Legs', default_unit: 'kg' },
  { name: 'Calf raise', muscle_group: 'Legs', default_unit: 'kg' },
  { name: 'Dumbbell curl', muscle_group: 'Biceps', default_unit: 'lb' },
  { name: 'Cable curl', muscle_group: 'Biceps', default_unit: 'kg' },
  { name: 'Tricep pushdown', muscle_group: 'Triceps', default_unit: 'kg' },
  { name: 'Overhead dumbbell extension', muscle_group: 'Triceps', default_unit: 'lb' },
  { name: 'Cable crunch', muscle_group: 'Core', default_unit: 'kg' },
  { name: 'Hanging leg raise', muscle_group: 'Core', default_unit: 'kg' },
]
