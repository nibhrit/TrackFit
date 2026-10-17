import { useSyncExternalStore } from 'react'
import { supabase } from '../lib/supabase'
import {
  DEFAULT_GOAL, STARTERS, STARTER_FOODS,
  type Exercise, type LiftSet, type MuscleGroup, type ProteinEntry, type ProteinGoal, type QuickAdd,
  type Session, type Settings, type Splits, type Unit,
} from './types'
import { addDays, localDate } from '../lib/dates'

// One shared store for the signed-in user's data.
// Reads show the last known data instantly (cached on the device), then refresh from Supabase.
// Writes update the screen first, then save; if saving fails, the change is rolled back.
// Lift sessions and protein entries are different: they go into an outbox on the device first and are sent when
// there's a connection, so logging works with no signal (see "Outbox" below).

type State = {
  loaded: boolean
  exercises: Exercise[]
  settings: Settings
  splits: Splits
  sessions: Session[]   // newest first
  protein: ProteinEntry[]
  quickAdds: QuickAdd[]
  goals: ProteinGoal[]
  pending: number       // changes saved on the device, not yet synced
}

type Op =
  | { kind: 'save'; session: Session }
  | { kind: 'delete'; id: string }
  | { kind: 'protein_save'; entry: ProteinEntry }
  | { kind: 'protein_delete'; id: string }

type Toast = { id: number; message: string; undo?: () => void }

const EMPTY: State = {
  loaded: false, exercises: [], settings: { body_weight_unit: 'kg' }, splits: {}, sessions: [],
  protein: [], quickAdds: [], goals: [], pending: 0,
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
  const [ex, st, sp, ss, pe, qa, pg] = await Promise.all([
    supabase.from('exercises').select('id,name,muscle_group,default_unit,archived_at,created_at').is('archived_at', null).order('name'),
    supabase.from('user_settings').select('body_weight_unit').maybeSingle(),
    fetchSplits(addDays(today, -42), addDays(today, 42)),
    supabase.from('lift_sessions')
      .select('id,exercise_id,performed_at,local_date,lift_sets(set_number,weight,unit)')
      .gte('local_date', addDays(today, -365))
      .order('performed_at', { ascending: false }),
    supabase.from('protein_entries').select('id,grams,label,quick_add_id,logged_at,local_date')
      .gte('local_date', addDays(today, -40)).order('logged_at'),
    supabase.from('quick_adds').select('id,name,grams,sort_order').order('sort_order').order('name'),
    supabase.from('protein_goals').select('goal_g,effective_from').order('effective_from'),
  ])
  if (ex.error || st.error || !sp || ss.error || pe.error || qa.error || pg.error) {
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
    sessions: applyLiftOutbox(sessions), // keep unsynced changes on top of what the server has
    protein: applyProteinOutbox(pe.data as ProteinEntry[]),
    quickAdds: qa.data as QuickAdd[],
    goals: pg.data as ProteinGoal[],
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
  const key = opKey(op)
  outbox = [...outbox.filter((o) => opKey(o) !== key), op]
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
  }
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

// ---------- Protein ----------

const byTime = (list: ProteinEntry[]) => [...list].sort((a, b) => a.logged_at.localeCompare(b.logged_at))
const upsertEntry = (list: ProteinEntry[], e: ProteinEntry) => byTime([...list.filter((x) => x.id !== e.id), e])

export const proteinOn = (s: State, date: string) => s.protein.filter((e) => e.local_date === date)
export const proteinTotal = (s: State, date: string) => proteinOn(s, date).reduce((sum, e) => sum + e.grams, 0)

// The goal in force on a date: the latest one set on or before it
export function goalFor(s: State, date: string): number {
  const g = [...s.goals].reverse().find((x) => x.effective_from <= date)
  return g?.goal_g ?? DEFAULT_GOAL
}

export function logProtein(grams: number, label: string | null, quick_add_id: string | null = null) {
  const entry: ProteinEntry = {
    id: crypto.randomUUID(), grams, label: label?.trim() || null, quick_add_id,
    logged_at: new Date().toISOString(), local_date: localDate(),
  }
  set({ protein: upsertEntry(state.protein, entry) })
  enqueue({ kind: 'protein_save', entry })
  showToast(`Logged ${grams} g${entry.label ? ` · ${entry.label}` : ''}`, () => {
    set({ protein: state.protein.filter((x) => x.id !== entry.id) })
    enqueue({ kind: 'protein_delete', id: entry.id })
  })
}

export function updateProtein(id: string, grams: number, label: string | null) {
  const e = state.protein.find((x) => x.id === id)
  if (!e) return
  const entry = { ...e, grams, label: label?.trim() || null }
  set({ protein: upsertEntry(state.protein, entry) })
  enqueue({ kind: 'protein_save', entry })
}

export function deleteProtein(id: string) {
  const e = state.protein.find((x) => x.id === id)
  if (!e) return
  set({ protein: state.protein.filter((x) => x.id !== id) })
  enqueue({ kind: 'protein_delete', id })
  showToast(`Deleted ${e.grams} g`, () => {
    set({ protein: upsertEntry(state.protein, e) })
    enqueue({ kind: 'protein_save', entry: e })
  })
}

// Applies from today onward; earlier days keep the goal they had
export async function setGoal(goal_g: number): Promise<string | null> {
  if (!Number.isInteger(goal_g) || goal_g < 20 || goal_g > 400) return 'Enter a goal between 20 and 400 g.'
  const effective_from = localDate()
  const before = state.goals
  set({ goals: [...before.filter((g) => g.effective_from !== effective_from), { goal_g, effective_from }].sort((a, b) => a.effective_from.localeCompare(b.effective_from)) })
  const { error } = await supabase.from('protein_goals').upsert({ goal_g, effective_from }, { onConflict: 'user_id,effective_from' })
  if (error) { set({ goals: before }); return 'Couldn’t save the goal. Check your connection.' }
  return null
}

// Quick-adds: saved foods. Changed rarely, so saved directly (with rollback) rather than via the outbox.
const validFood = (name: string, grams: number) =>
  !name.trim() ? 'Enter a name.' : !Number.isInteger(grams) || grams < 1 || grams > 300 ? 'Enter grams between 1 and 300.' : null

export async function addQuickAdd(name: string, grams: number): Promise<string | null> {
  const bad = validFood(name, grams)
  if (bad) return bad
  const sort_order = (state.quickAdds[state.quickAdds.length - 1]?.sort_order ?? 0) + 1
  const { data, error } = await supabase.from('quick_adds').insert({ name: name.trim(), grams, sort_order }).select('id,name,grams,sort_order').single()
  if (error) return 'Couldn’t save. Check your connection.'
  set({ quickAdds: [...state.quickAdds, data as QuickAdd] })
  return null
}

export async function updateQuickAdd(id: string, name: string, grams: number): Promise<string | null> {
  const bad = validFood(name, grams)
  if (bad) return bad
  const before = state.quickAdds
  set({ quickAdds: before.map((q) => (q.id === id ? { ...q, name: name.trim(), grams } : q)) })
  const { error } = await supabase.from('quick_adds').update({ name: name.trim(), grams }).eq('id', id)
  if (error) { set({ quickAdds: before }); return 'Couldn’t save. Check your connection.' }
  return null
}

export async function deleteQuickAdd(id: string) {
  const before = state.quickAdds
  set({ quickAdds: before.filter((q) => q.id !== id) })
  const { error } = await supabase.from('quick_adds').delete().eq('id', id)
  if (error) { set({ quickAdds: before }); showToast('Couldn’t delete. Check your connection.') }
}

export async function moveQuickAdd(id: string, dir: -1 | 1) {
  const list = [...state.quickAdds]
  const i = list.findIndex((q) => q.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= list.length) return
  ;[list[i], list[j]] = [list[j], list[i]]
  const renumbered = list.map((q, k) => ({ ...q, sort_order: k + 1 }))
  const before = state.quickAdds
  set({ quickAdds: renumbered })
  const results = await Promise.all(
    [renumbered[i], renumbered[j]].map((q) => supabase.from('quick_adds').update({ sort_order: q.sort_order }).eq('id', q.id)),
  )
  if (results.some((r) => r.error)) { set({ quickAdds: before }); showToast('Couldn’t reorder. Check your connection.') }
}

export async function addStarterFoods(): Promise<string | null> {
  const have = new Set(state.quickAdds.map((q) => q.name.toLowerCase()))
  const rows = STARTER_FOODS.filter((f) => !have.has(f.name.toLowerCase()))
    .map((f, k) => ({ ...f, sort_order: state.quickAdds.length + k + 1 }))
  if (!rows.length) return null
  const { data, error } = await supabase.from('quick_adds').insert(rows).select('id,name,grams,sort_order')
  if (error) return 'Couldn’t add them. Check your connection.'
  set({ quickAdds: [...state.quickAdds, ...(data as QuickAdd[])] })
  return null
}

const sortByName = (list: Exercise[]) => [...list].sort((a, b) => a.name.localeCompare(b.name))
