import axios from 'axios'

function normalizeApiBaseUrl(url) {
  const base = (url || 'http://localhost:3001/api').replace(/\/+$/, '')
  return base.endsWith('/api') ? base : `${base}/api`
}

const api = axios.create({
  baseURL: normalizeApiBaseUrl(import.meta.env.VITE_API_URL)
})

let agentActivitySequence = 0
function announceAgentActivity(type, detail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(`agent-activity-${type}`, { detail }))
  }
}

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  if (config.agentActivity) {
    const id = ++agentActivitySequence
    config.agentActivityId = id
    announceAgentActivity('start', { id, ...config.agentActivity })
  }
  return config
})

// En una misma navegación varias vistas piden los mismos endpoints: la página que se
// monta y el contexto de notificaciones, por ejemplo. Sin unificarlos, /checkin/hoy
// salía dos o tres veces por pantalla. getShared une los pedidos que están en vuelo y
// reusa la respuesta por una ventana corta, suficiente para cubrir el desfasaje entre
// un montaje y otro sin llegar a mostrar datos viejos.
const TTL_MS = 4000
const cacheGet = new Map()
const enVuelo = new Map()

export function getShared(path) {
  const guardado = cacheGet.get(path)
  if (guardado && Date.now() - guardado.t < TTL_MS) return Promise.resolve(guardado.data)

  const pendiente = enVuelo.get(path)
  if (pendiente) return pendiente

  const promesa = api.get(path)
    .then(res => {
      cacheGet.set(path, { t: Date.now(), data: res.data })
      return res.data
    })
    .finally(() => { enVuelo.delete(path) })
  enVuelo.set(path, promesa)
  return promesa
}

export function limpiarCacheGet() {
  cacheGet.clear()
  enVuelo.clear()
}

api.interceptors.response.use(
  response => {
    // Cualquier mutación puede cambiar lo que devuelven estos GET, así que se descarta
    // la copia corta acá y no en cada llamador, que es donde se olvida.
    if (response.config.method !== 'get') limpiarCacheGet()
    if (response.config.agentActivityId) announceAgentActivity('end', { id: response.config.agentActivityId })
    return response
  },
  error => {
    if (error.config?.agentActivityId) announceAgentActivity('end', { id: error.config.agentActivityId })
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
