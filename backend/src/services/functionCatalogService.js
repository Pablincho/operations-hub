import { db, Organizacion, Usuario, KnowledgeEntry, Manual, ManualCycle } from '../models/index.js';

export const DEFAULT_FUNCTIONS = [
  'Gerente General',
  'Tesorería',
  'Administración y Finanzas',
  'Operaciones Agropecuarias',
  'Impositivo',
  'Administrativo Junior',
  'RRHH',
  'Administrativo El Coro'
];

function cleanName(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 100);
}

function normalizeEntry(value) {
  const nombre = cleanName(typeof value === 'string' ? value : value?.nombre);
  if (!nombre) return null;
  return { nombre, activo: typeof value === 'object' ? value.activo !== false : true };
}

async function discoveredFunctions(organizacionId) {
  const [users, entries, manuals, cycles] = await Promise.all([
    Usuario.findAll({ where: { organizacionId }, attributes: ['funciones'], raw: true }),
    KnowledgeEntry.findAll({ where: { organizacionId }, attributes: [[db.fn('DISTINCT', db.col('funcion')), 'funcion']], raw: true }),
    Manual.findAll({ where: { organizacionId }, attributes: [[db.fn('DISTINCT', db.col('funcion')), 'funcion']], raw: true }),
    ManualCycle.findAll({ where: { organizacionId }, attributes: [[db.fn('DISTINCT', db.col('funcion')), 'funcion']], raw: true })
  ]);
  return [...new Set([
    ...users.flatMap(user => user.funciones || []),
    ...entries.map(row => row.funcion),
    ...manuals.map(row => row.funcion),
    ...cycles.map(row => row.funcion)
  ].map(cleanName).filter(Boolean))];
}

export async function getFunctionCatalog(organizacionId, { includeInactive = false } = {}) {
  const org = await Organizacion.findByPk(organizacionId);
  if (!org) return [];
  const configured = Array.isArray(org.config?.funcionesCatalogo)
    ? org.config.funcionesCatalogo.map(normalizeEntry).filter(Boolean)
    : [];
  const discovered = await discoveredFunctions(organizacionId);
  const initial = configured.length ? configured : DEFAULT_FUNCTIONS.map(nombre => ({ nombre, activo: true }));
  const byName = new Map(initial.map(entry => [entry.nombre.toLocaleLowerCase('es'), entry]));
  for (const nombre of discovered) {
    const key = nombre.toLocaleLowerCase('es');
    if (!byName.has(key)) byName.set(key, { nombre, activo: true });
  }
  const catalog = [...byName.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  if (JSON.stringify(configured) !== JSON.stringify(catalog)) {
    await org.update({ config: { ...(org.config || {}), funcionesCatalogo: catalog } });
  }
  return includeInactive ? catalog : catalog.filter(entry => entry.activo);
}

export async function addCatalogFunction(organizacionId, rawName) {
  const nombre = cleanName(rawName);
  if (nombre.length < 2) {
    const error = new Error('El nombre del puesto debe tener al menos 2 caracteres');
    error.status = 400;
    throw error;
  }
  const org = await Organizacion.findByPk(organizacionId);
  const catalog = await getFunctionCatalog(organizacionId, { includeInactive: true });
  const existing = catalog.find(entry => entry.nombre.toLocaleLowerCase('es') === nombre.toLocaleLowerCase('es'));
  if (existing) {
    if (!existing.activo) existing.activo = true;
    else {
      const error = new Error('El puesto ya existe');
      error.status = 409;
      throw error;
    }
  } else catalog.push({ nombre, activo: true });
  await org.update({ config: { ...(org.config || {}), funcionesCatalogo: catalog } });
  return catalog.find(entry => entry.nombre.toLocaleLowerCase('es') === nombre.toLocaleLowerCase('es'));
}

export async function updateCatalogFunction(organizacionId, currentName, changes) {
  const actual = cleanName(currentName);
  const nuevo = changes.nombre === undefined ? actual : cleanName(changes.nombre);
  if (!actual || nuevo.length < 2) {
    const error = new Error('Nombre de puesto inválido');
    error.status = 400;
    throw error;
  }
  const currentCatalog = await getFunctionCatalog(organizacionId, { includeInactive: true });
  return db.transaction(async transaction => {
    const org = await Organizacion.findByPk(organizacionId, { transaction, lock: transaction.LOCK.UPDATE });
    const catalog = currentCatalog.map(entry => ({ ...entry }));
    const entry = catalog.find(item => item.nombre === actual);
    if (!entry) {
      const error = new Error('Puesto no encontrado');
      error.status = 404;
      throw error;
    }
    if (nuevo !== actual && catalog.some(item => item.nombre.toLocaleLowerCase('es') === nuevo.toLocaleLowerCase('es'))) {
      const error = new Error('Ya existe un puesto con ese nombre');
      error.status = 409;
      throw error;
    }
    if (nuevo !== actual) {
      const users = await Usuario.findAll({ where: { organizacionId }, transaction });
      for (const user of users) {
        if ((user.funciones || []).includes(actual)) {
          await user.update({ funciones: user.funciones.map(item => item === actual ? nuevo : item) }, { transaction });
        }
      }
      await Promise.all([
        KnowledgeEntry.update({ funcion: nuevo }, { where: { organizacionId, funcion: actual }, transaction }),
        Manual.update({ funcion: nuevo }, { where: { organizacionId, funcion: actual }, transaction }),
        ManualCycle.update({ funcion: nuevo }, { where: { organizacionId, funcion: actual }, transaction })
      ]);
      const primaryOccupants = { ...(org.config?.primaryOccupants || {}) };
      if (Object.hasOwn(primaryOccupants, actual)) {
        primaryOccupants[nuevo] = primaryOccupants[actual];
        delete primaryOccupants[actual];
      }
      entry.nombre = nuevo;
      org.set('config', { ...(org.config || {}), primaryOccupants, funcionesCatalogo: catalog });
    }
    if (typeof changes.activo === 'boolean') entry.activo = changes.activo;
    org.set('config', { ...(org.config || {}), funcionesCatalogo: catalog });
    await org.save({ transaction });
    return entry;
  });
}
