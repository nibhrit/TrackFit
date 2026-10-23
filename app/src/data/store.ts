import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import {
  DEFAULT_GOAL, NO_FOOD, NO_NUTRIENTS, STARTERS, STARTER_FOODS,
  type BodyWeight, type Cardio, type CalorieGoal, type DayHabits, type Exercise, type FitnessGoal, type FoodRef, type HabitKey, type HabitResult,
  type LiftSet, type MuscleGroup, type Nutrients, type ProteinEntry, type ProteinGoal, type QuickAdd,
  type Session, type Settings, type Splits, type Unit,
} from './types'
import type { CardioKind, Effort } from './types'
import { addDays, localDate } from '../lib/dates'
import { DEFAULT_BODY_KG, cardioKcal, liftKcal } from '../lib/calories'

// One shared store for the signed-in user's data.
// Reads show the last known data instantly (cached on the device), then refresh from Supabase.
// Writes update the screen first, then save; if saving fails, the change is rolled back.
// Lift sessions and food entries are different: they go into an outbox on the device first and are sent when
// there's a connection, so logging works with no signal (see "Outbox" below).

type State = {
  loaded: boolean
  exercises: Exercise[]
  settings: Settings
  splits: Splits
  sessions: Session[]   // newest first
  protein: ProteinEntry[]   // the food log: every entry counts toward protein, and toward calories when it has them
  quickAdds: QuickAdd[]
  goals: ProteinGoal[]
  kcalGoals: CalorieGoal[]  // calorie target history; empty until one is set
  habits: Record<string, DayHabits>   // by date
  weights: BodyWeight[]               // oldest first
  cardio: Cardio[]                    // oldest first
  pending: number       // changes saved on the device, not yet synced
}

type Op =
  | { kind: 'save'; session: Session }
  | { kind: 'delete'; id: string }
  | { kind: 'protein_save'; entry: ProteinEntry }
  | { kind: 'protein_delete'; id: string }
  | { kind: 'habit_save'; day: DayHabits }
  | { kind: 'weight_save'; entry: BodyWeight }
  | { kind: 'weight_delete'; date: string }
  | { kind: 'goal_save'; goal: ProteinGoal }
  | { kind: 'kcal_goal_save'; goal: CalorieGoal }
  | { kind: 'split_save'; date: string; groups: MuscleGroup[] }
  | { kind: 'settings_save'; settings: Settings }
  | { kind: 'cardio_save'; entry: Cardio }
  | { kind: 'cardio_delete'; id: string }
  | { kind: 'quick_save'; quick: QuickAdd }
  | { kind: 'quick_delete'; id: string }

type Toast = { id: number; message: string; undo?: () => void }

const EMPTY: State = {
  loaded: false, exercises: [], settings: { body_weight_unit: 'kg', fitness_goal: 'maintain' }, splits: {}, sessions: [],
  protein: [], quickAdds: [], goals: [], kcalGoals: [], habits: {}, weights: [], cardio: [], pending: 0,
}

let state: State = EMPTY
let toast: Toast | null = null
let userId: string | null = null
let outbox: Op[] = []
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((l) => l())
const cacheKey = () => `trackfit:${userId}`
const outboxKey = () => `trackfit:${userId}:outbox`

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  try { localStorage.setItem(cacheKey(), JSON.stringify(state)) } catch { /* storage full or blocked */ }
  emit()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useStore = () => useSyncExternalStore(subscribe, () => state)
export const useToast = () => useSyncExternalStore(subscribe, () => toast)

export function showToast(message: string, undo?: () => void) {
  const t = { id: Date.now(), message, undo }
  toast = t
  emit()
  setTimeout(() => { if (toast?.id === t.id) { toast = null; emit() } }, 5000)
}
export function dismissToast() { toast = null; emit() }

// ---------- Loading ----------

export async function loadForUser(id: string) {
  if (userId !== id) {
    userId = id
    try {
      const cached = localStorage.getItem(cacheKey())
      state = cached ? { ...EMPTY, ...JSON.parse(cached) } : EMPTY
      outbox = JSON.parse(localStorage.getItem(outboxKey()) ?? '[]')
    } catch { state = EMPTY; outbox = [] }
    state = { ...state, pending: outbox.length }
    emit()
  }
  await flushOutbox()
  const today = localDate()
  const [ex, st, sp, ss, pe, qa, pg, kg, hb, bw, cd] = await Promise.all([
    supabase.from('exercises').select('id,name,muscle_group,default_unit,archived_at,created_at').is('archived_at', null).order('name'),
    supabase.from('user_settings').select('body_weight_unit,fitness_goal').maybeSingle(),
    fetchSplits(addDays(today, -42), addDays(today, 42)),
    supabase.from('lift_sessions')
      .select('id,exercise_id,performed_at,local_date,lift_sets(set_number,weight,unit)')
      .gte('local_date', addDays(today, -365))
      .order('performed_at', { ascending: false }),
    supabase.from('protein_entries').select(`id,label,quick_add_id,logged_at,local_date,${FOOD_COLS}`)
      .gte('local_date', addDays(today, -40)).order('logged_at'),
    supabase.from('quick_adds').select(QUICK_COLS).order('sort_order').order('name'),
    supabase.from('protein_goals').select('goal_g,effective_from').order('effective_from'),
    supabase.from('calorie_goals').select('goal_kcal,effective_from').order('effective_from'),
    supabase.from('daily_habits').select('date,sugar,junk_food').gte('date', addDays(today, -100)),
    supabase.from('body_weights').select('date,weight,unit').gte('date', addDays(today, -400)).order('date'),
    supabase.from('cardio_sessions').select('id,kind,minutes,effort,performed_at,local_date')
      .gte('local_date', addDays(today, -120)).order('performed_at'),
  ])
  if (ex.error || st.error || !sp || ss.error || pe.error || qa.error || pg.error || kg.error || hb.error || bw.error || cd.error) {
    if (!state.loaded) showToast('Couldn’t load your data. Showing what’s saved on this device.')
    return
  }
  type Row = Omit<Session, 'sets'> & { lift_sets: LiftSet[] }
  const sessions = (ss.data as Row[]).map(({ lift_sets, ...s }) => ({
    ...s,
    sets: lift_sets.map((x) => ({ ...x, weight: Number(x.weight) })).sort((a, b) => a.set_number - b.set_number),
  }))
  set({
    loaded: true,
    exercises: ex.data as Exercise[],
    settings: applySettingsOutbox((st.data as Settings) ?? state.settings),
    splits: applySplitOutbox(sp),
    sessions: applyLiftOutbox(sessions), // keep unsynced changes on top of what the server has
    protein: applyProteinOutbox((pe.data as ProteinEntry[]).map(numericPortion)),
    quickAdds: applyQuickOutbox((qa.data as QuickAdd[]).map(numericPortion)),
    goals: applyGoalOutbox(pg.data as ProteinGoal[]),
    kcalGoals: applyKcalGoalOutbox(kg.data as CalorieGoal[]),
    habits: applyHabitOutbox(Object.fromEntries((hb.data as DayHabits[]).map((d) => [d.date, d]))),
    weights: applyWeightOutbox((bw.data as BodyWeight[]).map((w) => ({ ...w, weight: Number(w.weight) }))),
    cardio: applyCardioOutbox(cd.data as Cardio[]),
  })
}

export function clearUser() {
  userId = null
  outbox = []
  state = EMPTY
  emit()
}

// ---------- Exercises ----------

const DUPLICATE = '23505'

export async function addExercise(name: string, muscle_group: MuscleGroup, default_unit: Unit): Promise<string | null> {
  const clean = name.trim().replace(/\s+/g, ' ')
  if (!clean) return 'Enter an exercise name.'
  if (state.exercises.some((e) => e.name.toLowerCase() === clean.toLowerCase())) return 'You already have an exercise with that name.'
  const { data, error } = await supabase.from('exercises').insert({ name: clean, muscle_group, default_unit }).select().single()
  if (error) return error.code === DUPLICATE ? 'You already have an exercise with that name (it may be archived).' : 'Couldn’t save. Check your connection.'
  set({ exercises: sortByName([...state.exercises, data as Exercise]) })
  return null
}

export async function updateExercise(id: string, patch: Partial<Pick<Exercise, 'name' | 'muscle_group' | 'default_unit'>>): Promise<string | null> {
  if (patch.name !== undefined) {
    patch.name = patch.name.trim().replace(/\s+/g, ' ')
    if (!patch.name) return 'Enter an exercise name.'
    if (state.exercises.some((e) => e.id !== id && e.name.toLowerCase() === patch.name!.toLowerCase())) return 'You already have an exercise with that name.'
  }
  const before = state.exercises
  set({ exercises: sortByName(before.map((e) => (e.id === id ? { ...e, ...patch } : e))) })
  const { error } = await supabase.from('exercises').update(patch).eq('id', id)
  if (error) {
    set({ exercises: before })
    return error.code === DUPLICATE ? 'You already have an exercise with that name.' : 'Couldn’t save. Check your connection.'
  }
  return null
}

export async function archiveExercise(id: string) {
  const ex = state.exercises.find((e) => e.id === id)
  if (!ex) return
  set({ exercises: state.exercises.filter((e) => e.id !== id) })
  const { error } = await supabase.from('exercises').update({ archived_at: new Date().toISOString() }).eq('id', id)
  if (error) {
    set({ exercises: sortByName([...state.exercises, ex]) })
    return showToast('Couldn’t remove it. Check your connection.')
  }
  showToast(`Removed ${ex.name}`, async () => {
    const { error } = await supabase.from('exercises').update({ archived_at: null }).eq('id', id)
    if (!error) set({ exercises: sortByName([...state.exercises, ex]) })
  })
}

export async function addStarters(): Promise<string | null> {
  const existing = new Set(state.exercises.map((e) => e.name.toLowerCase()))
  const rows = STARTERS.filter((s) => !existing.has(s.name.toLowerCase()))
  if (!rows.length) return null
  const { data, error } = await supabase.from('exercises').insert(rows).select()
  if (error) return 'Couldn’t add them. Check your connection.'
  set({ exercises: sortByName([...state.exercises, ...(data as Exercise[])]) })
  showToast(`Added ${rows.length} exercises`)
  return null
}

// ---------- Splits (one per day) ----------

async function fetchSplits(from: string, to: string): Promise<Splits | null> {
  const { data, error } = await supabase.from('daily_splits').select('date,groups').gte('date', from).lte('date', to)
  if (error) return null
  return Object.fromEntries((data as { date: string; groups: MuscleGroup[] }[]).map((r) => [r.date, r.groups]))
}

// Load another week's splits (week arrows on Plan week)
export async function loadSplits(from: string, to: string) {
  const sp = await fetchSplits(from, to)
  if (sp) set({ splits: applySplitOutbox({ ...state.splits, ...sp }) })
}

export const splitFor = (s: State, date: string) => s.splits[date] ?? []

export function toggleSplit(group: MuscleGroup, date = localDate()) {
  const current = splitFor(state, date)
  const groups = current.includes(group) ? current.filter((g) => g !== group) : [...current, group]
  set({ splits: { ...state.splits, [date]: groups } })
  enqueue({ kind: 'split_save', date, groups })
}

// ---------- Lift sessions ----------

const newest = (list: Session[]) => [...list].sort((a, b) => b.performed_at.localeCompare(a.performed_at))

function upsertLocal(list: Session[], s: Session) {
  return newest([...list.filter((x) => x.id !== s.id), s])
}

export function saveSession(exercise_id: string, sets: LiftSet[], existingId?: string) {
  const session: Session = {
    id: existingId ?? crypto.randomUUID(),
    exercise_id,
    performed_at: new Date().toISOString(),
    local_date: localDate(),
    sets: sets.map((s, i) => ({ ...s, set_number: i + 1 })),
  }
  set({ sessions: upsertLocal(state.sessions, session) })
  enqueue({ kind: 'save', session })
}

export function deleteSession(id: string) {
  const s = state.sessions.find((x) => x.id === id)
  set({ sessions: state.sessions.filter((x) => x.id !== id) })
  enqueue({ kind: 'delete', id })
  if (s) showToast('Session deleted', () => {
    set({ sessions: upsertLocal(state.sessions, s) })
    enqueue({ kind: 'save', session: s })
  })
}

// Selectors
export const sessionsFor = (s: State, exerciseId: string) => s.sessions.filter((x) => x.exercise_id === exerciseId)
export const todaySession = (s: State, exerciseId: string) =>
  s.sessions.find((x) => x.exercise_id === exerciseId && x.local_date === localDate())
export const lastSession = (s: State, exerciseId: string) =>
  s.sessions.find((x) => x.exercise_id === exerciseId && x.local_date < localDate())

// A day's groups: the split picked for it plus the groups of anything logged that day
export function groupsOn(s: State, date: string): MuscleGroup[] {
  const logged = s.sessions
    .filter((x) => x.local_date === date)
    .map((x) => s.exercises.find((e) => e.id === x.exercise_id)?.muscle_group)
    .filter((g): g is MuscleGroup => !!g)
  return [...new Set([...splitFor(s, date), ...logged])]
}

// ---------- Outbox (offline-first saves) ----------
// Each change is stored on the device, then sent in order. A network failure leaves it queued
// for the next try (app open, back online, or every 20 s). A change the server refuses
// (e.g. invalid data) is dropped with a message so it can't block everything behind it.

let flushing = false

function enqueue(op: Op) {
  // A newer save or delete of the same thing replaces any queued one.
  // A save takes the queued one's place (so a saved food created offline is still sent before entries that use it);
  // a delete goes to the back (after anything that still refers to it).
  const key = opKey(op)
  const at = outbox.findIndex((o) => opKey(o) === key)
  const isSave = !op.kind.endsWith('delete')
  outbox = at >= 0 && isSave
    ? outbox.map((o, i) => (i === at ? op : o)).filter((o, i) => i === at || opKey(o) !== key)
    : [...outbox.filter((o) => opKey(o) !== key), op]
  persistOutbox()
  flushOutbox()
}

function persistOutbox() {
  try { localStorage.setItem(outboxKey(), JSON.stringify(outbox)) } catch { /* storage full or blocked */ }
  set({ pending: outbox.length })
}

// Lift ops and protein ops live in separate "families" so ids can't collide
function opKey(op: Op) {
  switch (op.kind) {
    case 'save': return `lift:${op.session.id}`
    case 'delete': return `lift:${op.id}`
    case 'protein_save': return `protein:${op.entry.id}`
    case 'protein_delete': return `protein:${op.id}`
    case 'habit_save': return `habit:${op.day.date}`
    case 'weight_save': return `weight:${op.entry.date}`
    case 'weight_delete': return `weight:${op.date}`
    case 'goal_save': return `goal:${op.goal.effective_from}`
    case 'kcal_goal_save': return `kcal_goal:${op.goal.effective_from}`
    case 'split_save': return `split:${op.date}`
    case 'settings_save': return 'settings'
    case 'cardio_save': return `cardio:${op.entry.id}`
    case 'cardio_delete': return `cardio:${op.id}`
    case 'quick_save': return `quick:${op.quick.id}`
    case 'quick_delete': return `quick:${op.id}`
  }
}

function applyCardioOutbox(list: Cardio[]) {
  return outbox.reduce((l, op) =>
    op.kind === 'cardio_save' ? upsertCardio(l, op.entry) : op.kind === 'cardio_delete' ? l.filter((x) => x.id !== op.id) : l,
  list)
}

function applyQuickOutbox(list: QuickAdd[]) {
  return outbox.reduce((l, op) =>
    op.kind === 'quick_save' ? upsertQuick(l, op.quick) : op.kind === 'quick_delete' ? l.filter((q) => q.id !== op.id) : l,
  list)
}

function applyGoalOutbox(goals: ProteinGoal[]) {
  return outbox.reduce((list, op) => (op.kind === 'goal_save' ? upsertGoal(list, op.goal) : list), goals)
}

function applyKcalGoalOutbox(goals: CalorieGoal[]) {
  return outbox.reduce((list, op) => (op.kind === 'kcal_goal_save' ? upsertKcalGoal(list, op.goal) : list), goals)
}

function applySplitOutbox(splits: Splits) {
  return outbox.reduce((sp, op) => (op.kind === 'split_save' ? { ...sp, [op.date]: op.groups } : sp), splits)
}

function applySettingsOutbox(settings: Settings) {
  return outbox.reduce((s, op) => (op.kind === 'settings_save' ? op.settings : s), settings)
}

function applyHabitOutbox(habits: Record<string, DayHabits>) {
  return outbox.reduce((h, op) => (op.kind === 'habit_save' ? { ...h, [op.day.date]: op.day } : h), habits)
}

function applyWeightOutbox(weights: BodyWeight[]) {
  return outbox.reduce((list, op) =>
    op.kind === 'weight_save' ? upsertWeight(list, op.entry) : op.kind === 'weight_delete' ? list.filter((w) => w.date !== op.date) : list,
  weights)
}

function applyLiftOutbox(sessions: Session[]) {
  return outbox.reduce((list, op) =>
    op.kind === 'save' ? upsertLocal(list, op.session) : op.kind === 'delete' ? list.filter((x) => x.id !== op.id) : list,
  sessions)
}

function applyProteinOutbox(entries: ProteinEntry[]) {
  return outbox.reduce((list, op) =>
    op.kind === 'protein_save' ? upsertEntry(list, op.entry) : op.kind === 'protein_delete' ? list.filter((x) => x.id !== op.id) : list,
  entries)
}

function send(op: Op) {
  switch (op.kind) {
    case 'save':
      return supabase.rpc('save_lift_session', {
        p_id: op.session.id,
        p_exercise_id: op.session.exercise_id,
        p_performed_at: op.session.performed_at,
        p_local_date: op.session.local_date,
        p_sets: op.session.sets,
      })
    case 'delete':
      return supabase.from('lift_sessions').delete().eq('id', op.id)
    case 'protein_save':
      return supabase.from('protein_entries').upsert(op.entry)
    case 'protein_delete':
      return supabase.from('protein_entries').delete().eq('id', op.id)
    case 'habit_save':
      return supabase.from('daily_habits').upsert({ ...op.day, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' })
    case 'weight_save':
      return supabase.from('body_weights').upsert({ ...op.entry, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' })
    case 'weight_delete':
      return supabase.from('body_weights').delete().eq('date', op.date)
    case 'goal_save':
      return supabase.from('protein_goals').upsert(op.goal, { onConflict: 'user_id,effective_from' })
    case 'kcal_goal_save':
      return supabase.from('calorie_goals').upsert(op.goal, { onConflict: 'user_id,effective_from' })
    case 'split_save':
      return supabase.from('daily_splits').upsert({ date: op.date, groups: op.groups, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' })
    case 'cardio_save':
      return supabase.from('cardio_sessions').upsert(op.entry)
    case 'cardio_delete':
      return supabase.from('cardio_sessions').delete().eq('id', op.id)
    case 'settings_save':
      return supabase.from('user_settings').update({
        body_weight_unit: op.settings.body_weight_unit, fitness_goal: op.settings.fitness_goal, updated_at: new Date().toISOString(),
      }).eq('user_id', userId!)
    case 'quick_save':
      return supabase.from('quick_adds').upsert(op.quick)
    case 'quick_delete':
      return supabase.from('quick_adds').delete().eq('id', op.id)
  }
}

const isNetworkError = (e: { code?: string; message?: string }) =>
  !e.code || /fetch|network|load failed/i.test(e.message ?? '')

export async function flushOutbox() {
  if (flushing || !outbox.length || !userId) return
  flushing = true
  try {
    while (outbox.length) {
      const op = outbox[0]
      const { error } = await send(op)
      if (error && isNetworkError(error)) break
      if (error) showToast('One change couldn’t be saved and was discarded. Please enter it again.')
      outbox = outbox.slice(1)
      persistOutbox()
    }
  } finally {
    flushing = false
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => flushOutbox())
  setInterval(() => flushOutbox(), 20_000)
}

// ---------- Food log (protein + calories) ----------
// Entries live in protein_entries: protein grams always, calories/carbs/fat and the food + portion when known.
// Ops keep their 'protein_*' names so changes already queued on a phone still sync after an update.

const FOOD_COLS = 'grams,kcal,carbs_g,fat_g,fiber_g,added_sugar_g,food_id,portion_label,portion_qty,portion_grams'
const QUICK_COLS = `id,name,sort_order,${FOOD_COLS}`

// Postgres numeric columns can arrive as strings
const numericPortion = <T extends FoodRef>(r: T): T => ({
  ...r,
  portion_qty: r.portion_qty == null ? null : Number(r.portion_qty),
  portion_grams: r.portion_grams == null ? null : Number(r.portion_grams),
})

const byTime = (list: ProteinEntry[]) => [...list].sort((a, b) => a.logged_at.localeCompare(b.logged_at))
const upsertEntry = (list: ProteinEntry[], e: ProteinEntry) => byTime([...list.filter((x) => x.id !== e.id), e])

export const proteinOn = (s: State, date: string) => s.protein.filter((e) => e.local_date === date)
export const proteinTotal = (s: State, date: string) => proteinOn(s, date).reduce((sum, e) => sum + e.grams, 0)

// Today's totals for the Macros panel. Unknown values (old protein-only entries, foods without fibre data) aren't guessed:
// each nutrient also says how many entries didn't have it.
export type MacroKey = 'kcal' | 'grams' | 'carbs_g' | 'fat_g' | 'fiber_g' | 'added_sugar_g'
export function macrosOn(s: State, date: string): Record<MacroKey, { total: number; missing: number }> {
  const day = proteinOn(s, date)
  const sum = (k: MacroKey) => ({
    total: day.reduce((n, e) => n + (e[k] ?? 0), 0),
    missing: day.filter((e) => e[k] == null).length,
  })
  return { kcal: sum('kcal'), grams: sum('grams'), carbs_g: sum('carbs_g'), fat_g: sum('fat_g'), fiber_g: sum('fiber_g'), added_sugar_g: sum('added_sugar_g') }
}

// Calories eaten on a date. Entries logged as protein only have no calories: counted in `missing`, not guessed.
export function kcalEatenOn(s: State, date: string) {
  const day = proteinOn(s, date)
  return {
    total: day.reduce((sum, e) => sum + (e.kcal ?? 0), 0),
    missing: day.filter((e) => e.kcal == null).length,
  }
}

// The goal in force on a date: the latest one set on or before it
export function goalFor(s: State, date: string): number {
  const g = [...s.goals].reverse().find((x) => x.effective_from <= date)
  return g?.goal_g ?? DEFAULT_GOAL
}

// Same for the calorie target, but there is no default: null until the user sets one
export function kcalGoalFor(s: State, date: string): number | null {
  return [...s.kcalGoals].reverse().find((x) => x.effective_from <= date)?.goal_kcal ?? null
}

export type NewEntry = Nutrients & FoodRef & { label: string | null; quick_add_id?: string | null }

export function logFood(input: NewEntry) {
  const entry: ProteinEntry = {
    ...NO_FOOD, quick_add_id: null, ...input, label: input.label?.trim() || null,
    id: crypto.randomUUID(), logged_at: new Date().toISOString(), local_date: localDate(),
  }
  set({ protein: upsertEntry(state.protein, entry) })
  enqueue({ kind: 'protein_save', entry })
  const kcal = entry.kcal != null ? ` · ${entry.kcal} kcal` : ''
  showToast(`Logged ${entry.grams} g${kcal}${entry.label ? ` · ${entry.label}` : ''}`, () => {
    set({ protein: state.protein.filter((x) => x.id !== entry.id) })
    enqueue({ kind: 'protein_delete', id: entry.id })
  })
}

// Typed protein only (no calories)
export const logProtein = (grams: number, label: string | null) =>
  logFood({ grams, ...NO_NUTRIENTS, ...NO_FOOD, label })

export const logQuickAdd = (q: QuickAdd) =>
  logFood({
    grams: q.grams, kcal: q.kcal, carbs_g: q.carbs_g, fat_g: q.fat_g, fiber_g: q.fiber_g ?? null, added_sugar_g: q.added_sugar_g ?? null,
    food_id: q.food_id, portion_label: q.portion_label, portion_qty: q.portion_qty, portion_grams: q.portion_grams,
    label: q.name, quick_add_id: q.id,
  })

export function updateEntry(id: string, patch: Partial<NewEntry>) {
  const e = state.protein.find((x) => x.id === id)
  if (!e) return
  const entry = { ...e, ...patch }
  if ('label' in patch) entry.label = patch.label?.trim() || null
  set({ protein: upsertEntry(state.protein, entry) })
  enqueue({ kind: 'protein_save', entry })
}

export function deleteProtein(id: string) {
  const e = state.protein.find((x) => x.id === id)
  if (!e) return
  set({ protein: state.protein.filter((x) => x.id !== id) })
  enqueue({ kind: 'protein_delete', id })
  showToast(`Deleted ${e.label ?? `${e.grams} g`}`, () => {
    set({ protein: upsertEntry(state.protein, e) })
    enqueue({ kind: 'protein_save', entry: e })
  })
}

// Applies from today onward; earlier days keep the goal they had
export function setGoal(goal_g: number): string | null {
  if (!Number.isInteger(goal_g) || goal_g < 20 || goal_g > 400) return 'Enter a goal between 20 and 400 g.'
  const goal = { goal_g, effective_from: localDate() }
  set({ goals: upsertGoal(state.goals, goal) })
  enqueue({ kind: 'goal_save', goal })
  return null
}

const upsertGoal = (list: ProteinGoal[], g: ProteinGoal) =>
  [...list.filter((x) => x.effective_from !== g.effective_from), g].sort((a, b) => a.effective_from.localeCompare(b.effective_from))

export const KCAL_GOAL_MIN = 800
export const KCAL_GOAL_MAX = 6000

// Applies from today onward, like the protein goal
export function setKcalGoal(goal_kcal: number): string | null {
  if (!Number.isInteger(goal_kcal) || goal_kcal < KCAL_GOAL_MIN || goal_kcal > KCAL_GOAL_MAX) {
    return `Enter a target between ${KCAL_GOAL_MIN} and ${KCAL_GOAL_MAX} kcal.`
  }
  const goal = { goal_kcal, effective_from: localDate() }
  set({ kcalGoals: upsertKcalGoal(state.kcalGoals, goal) })
  enqueue({ kind: 'kcal_goal_save', goal })
  return null
}

const upsertKcalGoal = (list: CalorieGoal[], g: CalorieGoal) =>
  [...list.filter((x) => x.effective_from !== g.effective_from), g].sort((a, b) => a.effective_from.localeCompare(b.effective_from))

// Quick-adds: saved foods. Saved through the outbox like everything else, so they can be added or fixed with no signal.
// The app makes their ids, so a retried save updates the same row.

const upsertQuick = (list: QuickAdd[], q: QuickAdd) => {
  const i = list.findIndex((x) => x.id === q.id)
  return i < 0 ? [...list, q] : list.map((x, k) => (k === i ? q : x))
}

function saveQuick(q: QuickAdd) {
  set({ quickAdds: upsertQuick(state.quickAdds, q) })
  enqueue({ kind: 'quick_save', quick: q })
}

// kcal is optional (null = not known); a saved food needs protein or calories
function validFood(name: string, grams: number, kcal: number | null) {
  if (!name.trim()) return 'Enter a name.'
  if (name.trim().length > 60) return 'Keep the name under 60 characters.'
  if (!Number.isInteger(grams) || grams < 0 || grams > 300) return 'Enter protein grams between 0 and 300.'
  if (kcal !== null && (!Number.isInteger(kcal) || kcal < 0 || kcal > 5000)) return 'Enter kcal between 0 and 5000, or leave it empty.'
  if (grams === 0 && !kcal) return 'Enter protein grams or kcal.'
  return null
}

const nextSort = () => (state.quickAdds[state.quickAdds.length - 1]?.sort_order ?? 0) + 1

// A typed saved food, or one made from a dataset food + portion (pass its nutrients and ref)
export function addQuickAdd(name: string, n: Nutrients, ref: FoodRef = NO_FOOD): string | null {
  const bad = validFood(name, n.grams, n.kcal)
  if (bad) return bad
  saveQuick({ id: crypto.randomUUID(), name: name.trim(), ...n, ...ref, sort_order: nextSort() })
  return null
}

export function updateQuickAdd(id: string, name: string, grams: number, kcal: number | null): string | null {
  const bad = validFood(name, grams, kcal)
  if (bad) return bad
  const q = state.quickAdds.find((x) => x.id === id)
  if (!q) return null
  // Changing the numbers of a dataset food turns it into a typed one: its other nutrients and portion no longer match
  const changed = q.grams !== grams || q.kcal !== kcal
  saveQuick({ ...q, name: name.trim(), grams, kcal, ...(changed ? { ...NO_NUTRIENTS, kcal, ...NO_FOOD } : {}) })
  return null
}

// Link a saved food to a food from the list (or an AI estimate): it takes that food's nutrients and portion
export function linkQuickAdd(id: string, n: Nutrients, ref: FoodRef) {
  const q = state.quickAdds.find((x) => x.id === id)
  if (q) saveQuick({ ...q, ...n, ...ref })
}

export function deleteQuickAdd(id: string) {
  const q = state.quickAdds.find((x) => x.id === id)
  if (!q) return
  set({ quickAdds: state.quickAdds.filter((x) => x.id !== id) })
  enqueue({ kind: 'quick_delete', id })
  showToast(`Deleted ${q.name}`, () => saveQuick(q))
}

export function moveQuickAdd(id: string, dir: -1 | 1) {
  const list = [...state.quickAdds]
  const i = list.findIndex((q) => q.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
  const renumbered = list.map((q, k) => ({ ...q, sort_order: k + 1 }))
  set({ quickAdds: renumbered })
  for (const q of [renumbered[i], renumbered[j]]) enqueue({ kind: 'quick_save', quick: q })
}

export function addStarterFoods(): string | null {
  const have = new Set(state.quickAdds.map((q) => q.name.toLowerCase()))
  STARTER_FOODS.filter((f) => !have.has(f.name.toLowerCase()))
    .forEach((f) => saveQuick({ id: crypto.randomUUID(), ...NO_NUTRIENTS, ...NO_FOOD, ...f, sort_order: nextSort() }))
  return null
}

export const foodsWithoutKcal = (s: State) => s.quickAdds.filter((q) => q.kcal == null)

// ---------- Habits ----------

export const habitsOn = (s: State, date: string): DayHabits => s.habits[date] ?? { date, sugar: null, junk_food: null }

// Tap the selected answer again to clear it
export function setHabit(key: HabitKey, value: HabitResult, date = localDate()) {
  const current = habitsOn(state, date)
  const day: DayHabits = { ...current, [key]: current[key] === value ? null : value }
  set({ habits: { ...state.habits, [date]: day } })
  enqueue({ kind: 'habit_save', day })
}

// ---------- Body weight ----------

const upsertWeight = (list: BodyWeight[], w: BodyWeight) =>
  [...list.filter((x) => x.date !== w.date), w].sort((a, b) => a.date.localeCompare(b.date))

// One per day: logging again the same day replaces it
export function logWeight(weight: number, unit: Unit, date = localDate()) {
  const entry = { date, weight, unit }
  set({ weights: upsertWeight(state.weights, entry) })
  enqueue({ kind: 'weight_save', entry })
}

export function deleteWeight(date: string) {
  const w = state.weights.find((x) => x.date === date)
  if (!w) return
  set({ weights: state.weights.filter((x) => x.date !== date) })
  enqueue({ kind: 'weight_delete', date })
  showToast('Weight deleted', () => logWeight(w.weight, w.unit, w.date))
}

export const fitnessGoal = (s: State): FitnessGoal => s.settings.fitness_goal ?? 'maintain'

export function setFitnessGoal(fitness_goal: FitnessGoal) {
  const settings = { ...state.settings, fitness_goal }
  set({ settings })
  enqueue({ kind: 'settings_save', settings })
}

export function setWeightUnit(unit: Unit) {
  const settings = { ...state.settings, body_weight_unit: unit }
  set({ settings })
  enqueue({ kind: 'settings_save', settings })
}

// ---------- Cardio ----------

const upsertCardio = (list: Cardio[], c: Cardio) =>
  [...list.filter((x) => x.id !== c.id), c].sort((a, b) => a.performed_at.localeCompare(b.performed_at))

export const cardioOn = (s: State, date: string) => s.cardio.filter((c) => c.local_date === date)

export function logCardio(kind: CardioKind, minutes: number, effort: Effort) {
  const entry: Cardio = { id: crypto.randomUUID(), kind, minutes, effort, performed_at: new Date().toISOString(), local_date: localDate() }
  set({ cardio: upsertCardio(state.cardio, entry) })
  enqueue({ kind: 'cardio_save', entry })
  showToast(`Logged ${minutes} min`, () => {
    set({ cardio: state.cardio.filter((x) => x.id !== entry.id) })
    enqueue({ kind: 'cardio_delete', id: entry.id })
  })
}

export function updateCardio(id: string, patch: Partial<Pick<Cardio, 'kind' | 'minutes' | 'effort'>>) {
  const c = state.cardio.find((x) => x.id === id)
  if (!c) return
  const entry = { ...c, ...patch }
  set({ cardio: upsertCardio(state.cardio, entry) })
  enqueue({ kind: 'cardio_save', entry })
}

export function deleteCardio(id: string) {
  const c = state.cardio.find((x) => x.id === id)
  if (!c) return
  set({ cardio: state.cardio.filter((x) => x.id !== id) })
  enqueue({ kind: 'cardio_delete', id })
  showToast('Cardio deleted', () => {
    set({ cardio: upsertCardio(state.cardio, c) })
    enqueue({ kind: 'cardio_save', entry: c })
  })
}

// ---------- Calories burnt (estimate) ----------

// Latest weigh-in in kg, or a default until there is one
export function bodyKg(s: State): { kg: number; estimated: boolean } {
  const w = s.weights[s.weights.length - 1]
  if (!w) return { kg: DEFAULT_BODY_KG, estimated: true }
  return { kg: w.unit === 'lb' ? w.weight * 0.45359237 : w.weight, estimated: false }
}

export function kcalOn(s: State, date: string) {
  const { kg } = bodyKg(s)
  const cardio = cardioOn(s, date).reduce((sum, c) => sum + cardioKcal(c.kind, c.effort, c.minutes, kg), 0)
  const sets = s.sessions.filter((x) => x.local_date === date).reduce((n, x) => n + x.sets.length, 0)
  const lifting = liftKcal(sets, kg)
  return { cardio: Math.round(cardio), lifting: Math.round(lifting), total: Math.round(cardio + lifting) }
}

// ---------- Insights ----------

// A day counts as logged if anything was recorded: a lift, food, a habit answer, body weight or cardio
export function loggedOn(s: State, date: string) {
  const h = s.habits[date]
  return s.sessions.some((x) => x.local_date === date)
    || s.protein.some((x) => x.local_date === date)
    || !!(h && (h.sugar || h.junk_food))
    || s.weights.some((w) => w.date === date)
    || s.cardio.some((c) => c.local_date === date)
}

// Consecutive logged days ending today (or yesterday, if today isn't logged yet)
export function streak(s: State) {
  let d = localDate()
  if (!loggedOn(s, d)) d = addDays(d, -1)
  let n = 0
  while (loggedOn(s, d) && n < 400) { n++; d = addDays(d, -1) }
  return n
}

const sortByName = (list: Exercise[]) => [...list].sort((a, b) => a.name.localeCompare(b.name))
