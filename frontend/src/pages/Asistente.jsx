import { useState, useEffect, useRef } from 'react'
import api from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FUNC_ICONS, FUNC_COLORS } from '@/lib/utils'
import { useTour } from '@/lib/tour'
import { Send, PlusCircle, Bot, Pencil, Check, X, History, ThumbsUp, ThumbsDown, Download, AlertCircle, HelpCircle } from 'lucide-react'

const NO_INFO_PHRASE = 'no está registrada todavía en el sistema'

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map(i => (
        <span key={i} className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }} />
      ))}
    </div>
  )
}

function SessionName({ sessionId, initialName }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(initialName || '')
  const [saved, setSaved] = useState(initialName || '')
  const inputRef = useRef(null)

  useEffect(() => { if (editing) inputRef.current?.focus() }, [editing])
  useEffect(() => { setSaved(initialName || ''); setValue(initialName || '') }, [sessionId, initialName])

  async function save() {
    const nombre = value.trim()
    if (!nombre || nombre === saved) { setEditing(false); setValue(saved); return }
    try {
      await api.patch(`/chat/session/${sessionId}`, { nombre })
      setSaved(nombre)
    } catch { setValue(saved) }
    finally { setEditing(false) }
  }

  function cancel() { setValue(saved); setEditing(false) }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); save() }
    if (e.key === 'Escape') cancel()
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
          onKeyDown={handleKeyDown} onBlur={save} maxLength={100}
          className="text-sm font-semibold border-b border-[#1a3a1a] outline-none bg-transparent w-40"
          style={{ color: '#1a3a1a' }} />
        <button onClick={save} className="text-green-600 hover:text-green-700"><Check size={13} /></button>
        <button onClick={cancel} className="text-muted-foreground hover:text-foreground"><X size={13} /></button>
      </div>
    )
  }

  return (
    <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 group">
      <span className="text-sm font-semibold" style={{ color: '#1a3a1a' }}>
        {saved || 'Nueva conversación'}
      </span>
      <Pencil size={11} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  )
}

function FuncionesPills({ funciones }) {
  if (!funciones.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {funciones.map(fn => (
        <span key={fn} className="text-xs px-2.5 py-0.5 rounded-full text-white font-medium"
          style={{ background: FUNC_COLORS[fn] || '#1a3a1a' }}>
          {FUNC_ICONS[fn]} Manual de {fn}
        </span>
      ))}
    </div>
  )
}

function HistorialPanel({ currentSessionId, onSelect, onClose }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/chat/sessions')
      .then(r => setSessions(r.data.data || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="absolute top-full right-0 mt-1 w-72 bg-white border rounded-xl shadow-lg z-50 overflow-hidden">
      <div className="px-3 py-2 border-b flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">Conversaciones anteriores</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={14} /></button>
      </div>
      <div className="max-h-72 overflow-y-auto">
        {loading && <p className="text-xs text-muted-foreground p-3">Cargando...</p>}
        {!loading && sessions.length === 0 && (
          <p className="text-xs text-muted-foreground p-3">Sin conversaciones anteriores.</p>
        )}
        {sessions.map(s => (
          <button key={s.id} onClick={() => onSelect(s)}
            className="w-full text-left px-3 py-2.5 hover:bg-muted/40 transition-colors border-b last:border-0"
            style={{ background: s.id === currentSessionId ? '#f0f7f0' : undefined }}>
            <p className="text-xs font-medium truncate" style={{ color: '#1a3a1a' }}>
              {s.nombre || 'Sin nombre'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {new Date(s.updatedAt).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
              {' · '}{s.messageCount} mensaje{s.messageCount !== 1 ? 's' : ''}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}

function MessageBubble({ msg, onFeedback }) {
  const [hovering, setHovering] = useState(false)
  const [localFeedback, setLocalFeedback] = useState(msg.feedback || null)
  const isAssistant = msg.rol === 'assistant'
  const isNoInfo = isAssistant && msg.contenido?.toLowerCase().includes(NO_INFO_PHRASE)
  const isEfimero = isAssistant && msg.efimero

  async function handleFeedback(value) {
    const next = localFeedback === value ? null : value
    setLocalFeedback(next)
    if (msg.id) {
      try { await api.patch(`/chat/mensaje/${msg.id}/feedback`, { feedback: next }) } catch {}
    }
    onFeedback?.(msg.id, next)
  }

  if (!isAssistant) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-md px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed text-white"
          style={{ background: '#1a3a1a' }}>
          {msg.contenido}
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-start group" onMouseEnter={() => setHovering(true)} onMouseLeave={() => setHovering(false)}>
      <div className="max-w-[80%] flex flex-col gap-1">
        <div className={`rounded-2xl rounded-bl-md px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
          isNoInfo ? 'border border-amber-200' : 'bg-muted'
        }`}
          style={isNoInfo ? { background: '#fffbeb', color: '#92400e' } : {}}>
          {isNoInfo && (
            <span className="flex items-center gap-1 text-xs font-medium mb-1">
              <AlertCircle size={11} /> Sin información registrada
            </span>
          )}
          {msg.contenido}
        </div>
        {isEfimero && (
          <span className="text-xs text-muted-foreground flex items-center gap-1 pl-1">
            ⚡ Respuesta efímera: no queda guardada
          </span>
        )}
        {/* Feedback buttons: solo en mensajes persistidos */}
        {!isEfimero && (
          <div className={`flex gap-1 pl-1 transition-opacity ${hovering || localFeedback ? 'opacity-100' : 'opacity-0'}`}>
            <button onClick={() => handleFeedback('up')}
              className={`p-1 rounded transition-colors ${localFeedback === 'up' ? 'text-green-600' : 'text-muted-foreground hover:text-green-600'}`}>
              <ThumbsUp size={12} />
            </button>
            <button onClick={() => handleFeedback('down')}
              className={`p-1 rounded transition-colors ${localFeedback === 'down' ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}`}>
              <ThumbsDown size={12} />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function exportConversation(messages, sessionName) {
  const lines = messages.map(m => {
    const rol = m.rol === 'user' ? 'Usuario' : 'Asistente'
    return `[${rol}]\n${m.contenido}`
  })
  const text = `Conversación: ${sessionName || 'Sin nombre'}\nFecha de exportación: ${new Date().toLocaleDateString('es-AR')}\n\n${lines.join('\n\n---\n\n')}`
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${sessionName || 'conversacion'}.txt`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Asistente() {
  const { user, refreshUser } = useAuth()
  const [messages, setMessages] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [sessionName, setSessionName] = useState('')
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const [showHistorial, setShowHistorial] = useState(false)
  const bottomRef = useRef(null)

  const funciones = user?.funciones || []

  useEffect(() => { loadSession() }, []) // eslint-disable-line react-hooks/exhaustive-deps -- carga inicial
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])

  async function loadSession() {
    setInitializing(true)
    try {
      await refreshUser()
      const res = await api.get('/chat/session')
      const { session, messages } = res.data.data
      setSessionId(session.id)
      setSessionName(session.nombre || '')
      setMessages(messages || [])
    } catch {}
    finally { setInitializing(false) }
  }

  async function loadSpecificSession(session) {
    setShowHistorial(false)
    setInitializing(true)
    try {
      const res = await api.get(`/chat/session/${session.id}`)
      const { session: s, messages } = res.data.data
      setSessionId(s.id)
      setSessionName(s.nombre || '')
      setMessages(messages || [])
    } catch {}
    finally { setInitializing(false) }
  }

  async function newChat() {
    try {
      const res = await api.post('/chat/session')
      const { session } = res.data.data
      setSessionId(session.id)
      setSessionName(session.nombre || '')
      setMessages([])
      setShowHistorial(false)
    } catch {}
  }

  async function sendMessage(e) {
    e.preventDefault()
    const texto = input.trim()
    if (!texto || loading) return
    setInput('')
    setMessages(prev => [...prev, { rol: 'user', contenido: texto }])
    setLoading(true)
    try {
      const res = await api.post('/chat/mensaje', { mensaje: texto, sessionId })
      const { mensaje, reply, efimero } = res.data.data
      if (efimero) {
        setMessages(prev => [...prev, { rol: 'assistant', contenido: reply, efimero: true }])
      } else {
        setMessages(prev => [...prev, { ...mensaje }])
      }
    } catch {
      setMessages(prev => [...prev, { rol: 'assistant', contenido: 'Ocurrió un error. Intentá de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e) }
  }

  const { replay: verTour } = useTour({
    tourId: 'asistente',
    userId: user?.id,
    listo: !initializing && !!user,
    steps: [
      {
        popover: {
          title: 'Asistente IA',
          description: 'Consultá procedimientos y responsabilidades de tu función con tus propias palabras. Responde en base a lo que ya está documentado en los manuales de tus funciones. Si algo todavía no fue documentado, te lo va a decir en vez de inventar una respuesta.'
        }
      },
      {
        element: '[data-tour="asistente-input"]',
        popover: {
          title: 'Escribí tu consulta',
          description: 'Enter para enviar, Shift+Enter para agregar un salto de línea sin enviar. Podés marcar cada respuesta con 👍 o 👎 pasando el mouse sobre ella, para avisarnos si te sirvió.',
          side: 'top'
        }
      },
      {
        element: '[data-tour="asistente-historial"]',
        popover: {
          title: 'Conversaciones anteriores',
          description: 'Todas tus conversaciones quedan guardadas automáticamente. Volvé a cualquiera desde acá, y hacé click en el título (arriba a la izquierda) para renombrarla.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: '[data-tour="asistente-nueva"]',
        popover: {
          title: 'Nueva conversación',
          description: 'Arrancá un chat nuevo cuando quieras cambiar de tema. La conversación actual no se pierde, queda guardada en el historial.',
          side: 'bottom',
          align: 'end'
        }
      },
      {
        element: '[data-tour="asistente-exportar"]',
        popover: {
          title: 'Descargar conversación',
          description: 'Exportá esta conversación como archivo de texto.',
          side: 'bottom',
          align: 'end'
        }
      }
    ]
  })

  return (
    <div className="flex flex-col h-full w-full">
      {/* Topbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-white gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Bot size={18} style={{ color: '#1a3a1a' }} className="shrink-0" />
          <SessionName sessionId={sessionId} initialName={sessionName} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <FuncionesPills funciones={funciones} />
          {messages.length > 0 && (
            <Button data-tour="asistente-exportar" variant="ghost" size="sm" title="Descargar conversación"
              onClick={() => exportConversation(messages, sessionName)}
              className="gap-1.5 text-xs" style={{ color: '#1a3a1a' }}>
              <Download size={14} />
            </Button>
          )}
          <div className="relative">
            <Button data-tour="asistente-historial" variant="ghost" size="sm" title="Conversaciones anteriores" onClick={() => setShowHistorial(v => !v)} className="gap-1.5 text-xs" style={{ color: '#1a3a1a' }}>
              <History size={14} />
            </Button>
            {showHistorial && (
              <HistorialPanel
                currentSessionId={sessionId}
                onSelect={loadSpecificSession}
                onClose={() => setShowHistorial(false)}
              />
            )}
          </div>
          <Button data-tour="asistente-nueva" variant="ghost" size="sm" title="Nueva conversación" onClick={newChat} className="gap-1.5 text-xs" style={{ color: '#1a3a1a' }}>
            <PlusCircle size={14} />
            Nueva
          </Button>
          <Button variant="ghost" size="sm" title="Ver cómo funciona" onClick={verTour} className="gap-1.5 text-xs text-muted-foreground">
            <HelpCircle size={14} />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {initializing && (
          <div className="text-center text-muted-foreground text-sm mt-8">Cargando conversación...</div>
        )}

        {!initializing && messages.length === 0 && (
          <div className="flex flex-col items-center justify-center flex-1 text-center py-12">
            <div className="text-4xl mb-3">🌾</div>
            <p className="font-semibold" style={{ color: '#1a3a1a' }}>Asistente Operativo</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-xs">
              Consultá procedimientos, responsabilidades y procesos de{' '}
              {funciones.length === 1
                ? funciones[0]
                : funciones.length > 1
                  ? `${funciones.slice(0, -1).join(', ')} y ${funciones[funciones.length - 1]}`
                  : 'las funciones asignadas'}.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <MessageBubble key={msg.id || i} msg={msg} />
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md">
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={sendMessage} className="flex items-stretch gap-2 p-4 border-t bg-white">
        <Textarea
          data-tour="asistente-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribí tu consulta... (Enter para enviar)"
          rows={2}
          className="resize-none flex-1"
        />
        <button
          type="submit"
          disabled={!input.trim() || loading}
          className="w-14 rounded-xl shrink-0 flex items-center justify-center disabled:opacity-40 transition-opacity"
          style={{ background: '#1a3a1a', color: '#e8d5a3' }}
        >
          <Send size={13} />
        </button>
      </form>
    </div>
  )
}
