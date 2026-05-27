import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const FUNCIONES = ['Tesorería', 'Impuestos', 'Sueldos', 'Autorizaciones']

export const FUNC_ICONS = {
  Tesorería: '🏦',
  Impuestos: '📋',
  Sueldos: '👥',
  Autorizaciones: '✅'
}

export const FUNC_COLORS = {
  Tesorería: '#1a3a1a',
  Impuestos: '#2c3e6b',
  Sueldos: '#6b2c2c',
  Autorizaciones: '#4a3a00'
}

export const FUNC_BG_LIGHT = {
  Tesorería: '#f0f7f0',
  Impuestos: '#eef0f7',
  Sueldos: '#f7eef0',
  Autorizaciones: '#f7f5ee'
}
