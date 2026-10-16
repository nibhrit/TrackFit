import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { STARTERS, type Exercise, type MuscleGroup, type Settings, type Splits, type Unit } from './types'
import { addDays, localDate } from '../lib/dates'

// One shared store for the signed-in user's data.
// Reads show the last known data instantly (cached on the device), then refresh from Supabase.
// Writes update the screen first, then save; if saving fails, the change is rolled back.

type State = {
  loaded: boolean
  exercises: Exercise[]
  settings: Settings
  splits: Splits
}

type Toast = { id: number; message: string; undo?: () => void }

const EMPTY: State = { loaded: false, exercises: [], settings: { body_weight_unit: 'kg' }, splits: {} }

let state: State = EMPTY
let toast: Toast | null = null
let userId: string | null = null
const listeners = new Set<() => void>()

const emit = () => listeners.forEach((l) => l())
const cacheKey = () => `trackfit:${userId}`

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
    } catch { state = EMPTY }
    emit()
  }
  const today = localDate()
  const [ex, st, sp] = await Promise.all([
    supabase.from('exercises').select('id,name,muscle_group,default_unit,archived_at,created_at').is('archived_at', null).order('name'),
    supabase.from('user_settings').select('body_weight_unit').maybeSingle(),
    fetchSplits(addDays(today, -42), addDays(today, 42)),
  ])
  if (ex.error || st.error || !sp) {
    if (!state.loaded) showToast('Couldn’t load your data. Showing what’s saved on this device.')
    return
  }
  set({ loaded: true, exercises: ex.data as Exercise[], settings: (st.data as Settings) ?? state.settings, splits: sp })
}

export function clearUser() {
  userId = null
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
  if (sp) set({ splits: { ...state.splits, ...sp } })
}

export const splitFor = (s: State, date: string) => s.splits[date] ?? []

export async function toggleSplit(group: MuscleGroup, date = localDate()) {
  const current = splitFor(state, date)
  const groups = current.includes(group) ? current.filter((g) => g !== group) : [...current, group]
  const before = state.splits
  set({ splits: { ...before, [date]: groups } })
  const { error } = await supabase.from('daily_splits')
    .upsert({ date, groups, updated_at: new Date().toISOString() }, { onConflict: 'user_id,date' })
  if (error) {
    set({ splits: before })
    showToast('Couldn’t save the split. Check your connection.')
  }
}

const sortByName = (list: Exercise[]) => [...list].sort((a, b) => a.name.localeCompare(b.name))
