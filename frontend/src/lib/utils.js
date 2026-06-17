import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

export const FUNCIONES = [
  'Gerente General',
  'Tesorería',
  'Administración y Finanzas',
  'Operaciones Agropecuarias',
  'Impositivo',
  'Administrativo Junior',
  'RRHH',
  'Administrativo El Coro'
]

export const FUNC_ICONS = {
  'Gerente General': '🏢',
  'Tesorería': '🏦',
  'Administración y Finanzas': '📊',
  'Operaciones Agropecuarias': '🌾',
  'Impositivo': '📋',
  'Administrativo Junior': '📁',
  'RRHH': '👥',
  'Administrativo El Coro': '🏡'
}

export const FUNC_COLORS = {
  'Gerente General': '#7a1a1a',
  'Tesorería': '#1a3a1a',
  'Administración y Finanzas': '#5a2d82',
  'Operaciones Agropecuarias': '#7a4500',
  'Impositivo': '#2c3e6b',
  'Administrativo Junior': '#1a5a5a',
  'RRHH': '#6b2c4a',
  'Administrativo El Coro': '#3d5a1a'
}

export const FUNC_BG_LIGHT = {
  'Gerente General': '#fdf0f0',
  'Tesorería': '#f0f7f0',
  'Administración y Finanzas': '#f5f0fa',
  'Operaciones Agropecuarias': '#fdf6ee',
  'Impositivo': '#eef0f7',
  'Administrativo Junior': '#eef7f7',
  'RRHH': '#f7eef3',
  'Administrativo El Coro': '#f3f7ee'
}
