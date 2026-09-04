import { useEffect, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'

export default function AgentActivityOverlay() {
  const [operations, setOperations] = useState([])

  useEffect(() => {
    const start = event => setOperations(current => [...current, event.detail])
    const end = event => setOperations(current => current.filter(item => item.id !== event.detail.id))
    window.addEventListener('agent-activity-start', start)
    window.addEventListener('agent-activity-end', end)
    return () => {
      window.removeEventListener('agent-activity-start', start)
      window.removeEventListener('agent-activity-end', end)
    }
  }, [])

  const active = operations.at(-1)
  if (!active) return null

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-black/45 p-5" role="alert" aria-live="assertive" aria-busy="true">
      <div className="w-full max-w-sm rounded-2xl border bg-background px-6 py-5 text-center shadow-2xl">
        <div className="mx-auto grid size-11 place-items-center rounded-full bg-amber-50 text-amber-700">
          <Sparkles size={19} />
        </div>
        <p className="mt-3 text-sm font-semibold text-foreground">{active.titulo}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{active.descripcion}</p>
        <div className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> No cierres ni cambies de página hasta que termine.
        </div>
      </div>
    </div>
  )
}
