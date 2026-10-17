import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import { STARTERS, type Exercise, type LiftSet, type MuscleGroup, type Session, type Settings, type Splits, type Unit } from './types'
import { addDays, localDate } from '../lib/dates'

// One shared store for the signed-in user's data.
// Reads show the last known data instantly (cached on the device), then refresh from Supabase.
// Writes update the screen first, then save; if saving fails, the change is rolled back.
// Lift sessions are different: they go into an outbox on the device first and are sent when
// there's a connection, so logging works with no signal (see "Outbox" below).

type State = {
  loaded: boolean
  exercises: Exercise[]
  settings: Settings
  splits: Splits
  sessions: Session[]   // newest first
  pending: number       // changes saved on the device, not yet synced
}

type Op = { kind: 'save'; session: Session } | { kind: 'delete'; id: string }

type Toast = { id: number; message: string; undo?: () => void }

const EMPTY: State = { loaded: false, exercises: [], settings: { body_weight_unit: 'kg' }, splits: {}, sessions: [], pending: 0 }

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
  const [ex, st, sp, ss] = await Promise.all([
    supabase.from('exercises').select('id,name,muscle_group,default_unit,archived_at,created_at').is('archived_at', null).order('name'),
    supabase.from('user_settings').select('body_weight_unit').maybeSingle(),
    fetchSplits(addDays(today, -42), addDays(today, 42)),
    supabase.from('lift_sessions')
      .select('id,exercise_id,performed_at,local_date,lift_sets(set_number,weight,unit)')
      .gte('local_date', addDays(today, -365))
      .order('performed_at', { ascending: false }),
  ])
  if (ex.error || st.error || !sp || ss.error) {
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
    settings: (st.data as Settings) ?? state.settings,
    splits: sp,
    sessions: applyOutbox(sessions), // keep unsynced changes on top of what the server has
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
  // A newer save or delete of the same session replaces any queued one
  const id = op.kind === 'save' ? op.session.id : op.id
  outbox = [...outbox.filter((o) => (o.kind === 'save' ? o.session.id : o.id) !== id), op]
  persistOutbox()
  flushOutbox()
}

function persistOutbox() {
  try { localStorage.setItem(outboxKey(), JSON.stringify(outbox)) } catch { /* storage full or blocked */ }
  set({ pending: outbox.length })
}

function applyOutbox(sessions: Session[]) {
  return outbox.reduce(
    (list, op) => (op.kind === 'save' ? upsertLocal(list, op.session) : list.filter((x) => x.id !== op.id)),
    sessions,
  )
}

const isNetworkError = (e: { code?: string; message?: string }) =>
  !e.code || /fetch|network|load failed/i.test(e.message ?? '')

export async function flushOutbox() {
  if (flushing || !outbox.length || !userId) return
  flushing = true
  try {
    while (outbox.length) {
      const op = outbox[0]
      const { error } = op.kind === 'save'
        ? await supabase.rpc('save_lift_session', {
            p_id: op.session.id,
            p_exercise_id: op.session.exercise_id,
            p_performed_at: op.session.performed_at,
            p_local_date: op.session.local_date,
            p_sets: op.session.sets,
          })
        : await supabase.from('lift_sessions').delete().eq('id', op.id)
      if (error && isNetworkError(error)) break
      if (error) showToast('One change couldn’t be saved and was discarded. Check the session and log it again.')
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

const sortByName = (list: Exercise[]) => [...list].sort((a, b) => a.name.localeCompare(b.name))
