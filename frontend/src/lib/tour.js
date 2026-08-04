import { useCallback, useEffect, useRef } from 'react'
import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

const KEY_PREFIX = 'remi_tour_'

// La clave incluye el id del usuario: en computadoras compartidas cada persona ve
// el tour la primera vez que entra, aunque otro ya lo haya visto en ese navegador.
function storageKey(tourId, userId) {
  return `${KEY_PREFIX}${tourId}_${userId || 'anon'}`
}

export function tourVisto(tourId, userId) {
  try { return localStorage.getItem(storageKey(tourId, userId)) === '1' }
  catch { return false }
}

export function marcarTourVisto(tourId, userId) {
  try { localStorage.setItem(storageKey(tourId, userId), '1') } catch { /* ignore */ }
}

const BASE_CONFIG = {
  overlayColor: '#1a3a1a',
  overlayOpacity: 0.7,
  stagePadding: 8,
  stageRadius: 12,
  popoverOffset: 12,
  smoothScroll: true,
  disableActiveInteraction: true, // evita navegar sin querer al clickear lo resaltado
  popoverClass: 'remi-tour',
  progressText: '{{current}} de {{total}}',
  nextBtnText: 'Siguiente',
  prevBtnText: 'Atrás',
  doneBtnText: 'Listo'
}

// Arranca un tour con los pasos cuyo elemento está en el DOM. Las pantallas varían
// según rol, funciones asignadas y estado del check-in, así que los pasos que no
// aplican se descartan en lugar de cortar el recorrido.
export function lanzarTour(steps, { onDestroyed } = {}) {
  const visibles = steps.filter(s => !s.element || document.querySelector(s.element))
  if (visibles.length === 0) return null

  const instancia = driver({
    ...BASE_CONFIG,
    showProgress: visibles.length > 1,
    steps: visibles,
    onDestroyed: () => onDestroyed?.()
  })
  instancia.drive()
  return instancia
}

// Lanza el tour una sola vez por usuario, cuando `listo` pasa a true (datos cargados
// y elementos ya montados). Devuelve `replay` para volver a verlo cuando se pida.
export function useTour({ tourId, userId, steps, listo, delayMs = 300 }) {
  const instancia = useRef(null)
  const yaLanzado = useRef(false)
  // Los steps se rearman en cada render; guardarlos en un ref evita relanzar el tour.
  const stepsRef = useRef(steps)
  useEffect(() => { stepsRef.current = steps })

  const correr = useCallback(() => {
    // Cerramos el recorrido anterior antes de abrir otro: sin esto, el popover viejo
    // queda vivo y se superpone con el nuevo.
    instancia.current?.destroy()
    instancia.current = lanzarTour(stepsRef.current, {
      onDestroyed: () => marcarTourVisto(tourId, userId)
    })
  }, [tourId, userId])

  useEffect(() => {
    if (!listo || yaLanzado.current || !userId) return
    if (tourVisto(tourId, userId)) return
    // Pequeña espera para que terminen de pintarse las tarjetas antes de medirlas.
    // El guard se marca recién al disparar: en StrictMode el efecto corre dos veces
    // (efecto → cleanup → efecto) y marcarlo antes dejaría el tour sin lanzarse nunca.
    const t = setTimeout(() => {
      yaLanzado.current = true
      correr()
    }, delayMs)
    return () => clearTimeout(t)
  }, [listo, userId, tourId, correr, delayMs])

  // Si el usuario navega a otra página con el tour abierto, lo cerramos.
  useEffect(() => () => instancia.current?.destroy(), [])

  return { replay: correr }
}
