import { useState, useEffect, useRef } from 'react'
import api from '@/services/api'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FUNCIONES, FUNC_ICONS, FUNC_COLORS } from '@/lib/utils'
import { Send, PlusCircle, Bot } from 'lucide-react'

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  )
}

export default function Asistente() {
  const { user } = useAuth()
  const [messages, setMessages] = useState([])
  const [sessionId, setSessionId] = useState(null)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [initializing, setInitializing] = useState(true)
  const bottomRef = useRef(null)

  const funciones = user?.funciones || []

  useEffect(() => {
    loadSession()
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function loadSession() {
    setInitializing(true)
    try {
      const res = await api.get('/chat/session')
      setSessionId(res.data.data.id)
      setMessages(res.data.data.mensajes || [])
    } catch {
      // ignore
    } finally {
      setInitializing(false)
    }
  }

  async function newChat() {
    try {
      const res = await api.post('/chat/session')
      setSessionId(res.data.data.id)
      setMessages([])
    } catch {
      // ignore
    }
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
      setMessages(prev => [...prev, { rol: 'assistant', contenido: res.data.data.contenido }])
    } catch (err) {
      setMessages(prev => [...prev, { rol: 'assistant', contenido: 'Ocurrió un error. Intentá de nuevo.' }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(e)
    }
  }

  return (
    <div className="flex flex-col h-full max-w-3xl mx-auto">
      {/* Topbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-white">
        <div className="flex items-center gap-2">
          <Bot size={18} style={{ color: '#1a3a1a' }} />
          <span className="font-semibold text-sm">Asistente IA</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {funciones.map(fn => (
              <span
                key={fn}
                className="text-xs px-2 py-0.5 rounded-full text-white font-medium"
                style={{ background: FUNC_COLORS[fn] }}
              >
                {FUNC_ICONS[fn]} {fn}
              </span>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={newChat} className="gap-1.5 text-xs">
            <PlusCircle size={14} />
            Nueva
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
              Preguntame cualquier cosa sobre los procedimientos de {funciones.join(', ') || 'las funciones'}.
            </p>
            <div className="mt-4 flex flex-col gap-2 w-full max-w-sm">
              {['¿Cuáles son los pasos para realizar un pago?',
                '¿Qué documentación necesito para liquidar sueldos?',
                '¿Cómo se autoriza una transferencia?'].map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q) }}
                  className="text-left text-xs p-3 rounded-xl border hover:border-[#1a3a1a] hover:bg-[#f9faf9] transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.rol === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
                msg.rol === 'user'
                  ? 'rounded-br-md text-white'
                  : 'rounded-bl-md bg-muted text-foreground'
              }`}
              style={msg.rol === 'user' ? { background: '#1a3a1a' } : {}}
            >
              {msg.contenido}
            </div>
          </div>
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
      <form onSubmit={sendMessage} className="flex gap-2 p-4 border-t bg-white">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Escribí tu consulta... (Enter para enviar)"
          rows={2}
          className="resize-none flex-1"
        />
        <Button
          type="submit"
          disabled={!input.trim() || loading}
          size="icon"
          className="h-auto self-end mb-0.5"
          style={{ background: '#1a3a1a', color: '#e8d5a3' }}
        >
          <Send size={16} />
        </Button>
      </form>
    </div>
  )
}
