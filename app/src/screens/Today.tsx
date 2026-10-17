import { groupsOn, lastSession, todaySession, useStore } from '../data/store'
import { GROUPS, type Exercise } from '../data/types'
import { fmtDate, localDate } from '../lib/dates'
import { fmtSets } from '../lib/format'

type Props = {
  onOpenExercise: (id: string, repeat: boolean) => void
  onGoToLift: () => void
}

export default function Today({ onOpenExercise, onGoToLift }: Props) {
  const store = useStore()
  const groups = groupsOn(store, localDate())

  // Exercises for today's split (or everything if no split yet) that have history, most recent first
  const recent = (e: Exercise) => lastSession(store, e.id)?.local_date ?? ''
  const pool = store.exercises
    .filter((e) => !groups.length || groups.includes(e.muscle_group))
    .filter((e) => lastSession(store, e.id) || todaySession(store, e.id))
    .sort((a, b) => recent(b).localeCompare(recent(a)))
  const notDone = pool.filter((e) => !todaySession(store, e.id))
  const featured = notDone[0]
  const rest = pool.filter((e) => e !== featured).slice(0, 5)

  return (
    <>
      <div className="hdr sec-row">
        <span className="sec">
          {groups.length ? `Last time: ${GROUPS.filter((g) => groups.includes(g)).join(', ')}` : 'Last time'}
        </span>
        <button className="link" onClick={onGoToLift}>{groups.length ? 'Change split' : 'Pick today’s split'}</button>
      </div>

      {!store.loaded && !store.exercises.length ? (
        <div className="card cap">Loading…</div>
      ) : !pool.length ? (
        <div className="card form">
          <span className="cap">
            {groups.length ? 'Nothing logged for this split yet.' : 'Your last weights show here once you’ve logged a session.'}
          </span>
          <button className="btn" onClick={onGoToLift}>Go to Lift</button>
        </div>
      ) : (
        <>
          {featured && <Featured exercise={featured} onOpen={onOpenExercise} />}
          {!featured && <div className="card cap">Everything in today’s split is done. Nice work.</div>}
          {rest.length > 0 && (
            <div className="list">
              {rest.map((e) => {
                const done = todaySession(store, e.id)
                const shown = done ?? lastSession(store, e.id)!
                return (
                  <button key={e.id} className="row" onClick={() => onOpenExercise(e.id, false)}>
                    <span className="row-main">
                      <span>{e.name}</span>
                      <span className="cap">{done ? 'Done today' : fmtDate(shown.local_date)}</span>
                    </span>
                    <span className="num row-weights">{fmtSets(shown.sets)}</span>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      <div className="card cap">Protein and end-of-day habits arrive in the next milestone.</div>
    </>
  )
}

function Featured({ exercise, onOpen }: { exercise: Exercise; onOpen: (id: string, repeat: boolean) => void }) {
  const store = useStore()
  const last = lastSession(store, exercise.id)!
  return (
    <div className="slab">
      <button className="slab-open" onClick={() => onOpen(exercise.id, false)}>
        <span className="cap">{exercise.name}</span>
        <span className="num slab-weights">{fmtSets(last.sets)}</span>
      </button>
      <div className="slab-foot">
        <span className="cap">Last on {fmtDate(last.local_date)}</span>
        <button className="btn" onClick={() => onOpen(exercise.id, true)}>Repeat</button>
      </div>
    </div>
  )
}
