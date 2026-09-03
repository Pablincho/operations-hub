export const CYCLE_STATES = [
  'configuracion', 'planificando', 'relevamiento', 'listo_para_generar',
  'generando', 'borrador', 'en_revision', 'completado', 'pausado'
];

export function cycleAllowsCheckin(cycle) {
  if (!cycle) return false;
  return cycle.estado === 'relevamiento' || (cycle.esLegacy && cycle.estado === 'configuracion');
}

export function cycleAllowsGeneration(cycle) {
  return !!cycle && ['listo_para_generar', 'borrador'].includes(cycle.estado);
}

export function nextCheckinDate(lastDate, frecuencia, intervalo = 1) {
  if (!lastDate || frecuencia === 'manual') return null;
  const multiplier = frecuencia === 'semanal' ? 7 : 1;
  const date = new Date(`${lastDate}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + Math.max(1, intervalo) * multiplier);
  return date.toISOString().slice(0, 10);
}
