import test from 'node:test';
import assert from 'node:assert/strict';
import { CYCLE_STATES, cycleAllowsCheckin, cycleAllowsGeneration, nextCheckinDate } from '../src/manualCyclePolicy.js';

test('solo los estados correctos habilitan check-in y generación', () => {
  assert.equal(cycleAllowsCheckin({ estado: 'relevamiento', esLegacy: false }), true);
  assert.equal(cycleAllowsCheckin({ estado: 'configuracion', esLegacy: false }), false);
  assert.equal(cycleAllowsCheckin({ estado: 'configuracion', esLegacy: true }), true);
  assert.equal(cycleAllowsGeneration({ estado: 'listo_para_generar' }), true);
  assert.equal(cycleAllowsGeneration({ estado: 'borrador' }), true);
  assert.equal(cycleAllowsGeneration({ estado: 'en_revision' }), false);
  assert.ok(CYCLE_STATES.includes('completado'));
});

test('la cadencia diaria, semanal y manual se calcula sin límite de ciclos', () => {
  assert.equal(nextCheckinDate('2026-09-03', 'diaria', 2), '2026-09-05');
  assert.equal(nextCheckinDate('2026-09-03', 'semanal', 2), '2026-09-17');
  assert.equal(nextCheckinDate('2026-09-03', 'manual', 1), null);
});
