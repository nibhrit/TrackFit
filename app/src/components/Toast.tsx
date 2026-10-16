import { dismissToast, useToast } from '../data/store'

export default function Toast() {
  const toast = useToast()
  if (!toast) return null
  return (
    <div className="toast" role="status">
      <span>{toast.message}</span>
      {toast.undo && (
        <button onClick={() => { toast.undo!(); dismissToast() }}>Undo</button>
      )}
    </div>
  )
}
