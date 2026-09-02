import test from 'node:test';
import assert from 'node:assert/strict';
import { canAccessFuncion } from '../src/authHelpers.js';

test('un operativo solo accede a funciones asignadas', () => {
  const user = { rol: 'operativo', funciones: ['Tesorería'] };
  assert.equal(canAccessFuncion(user, 'Tesorería'), true);
  assert.equal(canAccessFuncion(user, 'RRHH'), false);
});

test('admin y superadmin acceden a funciones de su organización', () => {
  assert.equal(canAccessFuncion({ rol: 'admin', funciones: [] }, 'RRHH'), true);
  assert.equal(canAccessFuncion({ rol: 'superadmin', funciones: [] }, 'Tesorería'), true);
});

test('un operativo sin funciones no recibe acceso implícito', () => {
  assert.equal(canAccessFuncion({ rol: 'operativo', funciones: [] }, 'RRHH'), false);
});
