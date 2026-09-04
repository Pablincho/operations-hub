import { QueryTypes } from 'sequelize';
import { db, Organizacion, Usuario } from '../models/index.js';

// Resuelve el ocupante principal de varias funciones con 3 consultas fijas, en lugar de
// las 2 o 3 por función que costaba resolverlas de a una. Mantiene la misma precedencia:
// el configurado a mano, si no el primero que respondió, y si no el usuario más antiguo
// con la función asignada.
export async function getPrimaryOccupantsByFuncion(organizacionId, funciones) {
  const unicas = [...new Set((funciones || []).filter(Boolean))];
  const resultado = new Map(unicas.map(funcion => [funcion, null]));
  if (!unicas.length) return resultado;

  const [org, primerasRespuestas, activos] = await Promise.all([
    Organizacion.findByPk(organizacionId, { attributes: ['config'] }),
    // DISTINCT ON evita traer todas las entradas para quedarse solo con la más vieja de cada función.
    db.query(
      `SELECT DISTINCT ON (funcion) funcion, "usuarioId"
         FROM "KnowledgeEntries"
        WHERE "organizacionId" = :organizacionId
          AND categoria = 'checkin'
          AND funcion IN (:funciones)
        ORDER BY funcion, "createdAt" ASC`,
      { replacements: { organizacionId, funciones: unicas }, type: QueryTypes.SELECT }
    ),
    Usuario.findAll({
      where: { organizacionId, activo: true },
      attributes: { exclude: ['passwordHash', 'resetTokenHash', 'resetTokenExpiresAt'] },
      order: [['createdAt', 'ASC']]
    })
  ]);

  const porId = new Map(activos.map(usuario => [usuario.id, usuario]));
  const primeroPorFuncion = new Map(primerasRespuestas.map(fila => [fila.funcion, fila.usuarioId]));
  const configurados = org?.config?.primaryOccupants || {};

  for (const funcion of unicas) {
    // Si hay un ocupante configurado y quedó inactivo, el puesto queda sin principal:
    // no se infiere otro por atrás, igual que antes.
    if (configurados[funcion]) {
      resultado.set(funcion, porId.get(configurados[funcion]) || null);
      continue;
    }
    const primero = porId.get(primeroPorFuncion.get(funcion));
    if (primero) {
      resultado.set(funcion, primero);
      continue;
    }
    resultado.set(funcion, activos.find(usuario => (usuario.funciones || []).includes(funcion)) || null);
  }
  return resultado;
}

export async function getPrimaryOccupant(organizacionId, funcion) {
  const porFuncion = await getPrimaryOccupantsByFuncion(organizacionId, [funcion]);
  return porFuncion.get(funcion) || null;
}

export async function userIsPrimaryOccupant(userId, organizacionId, funcion) {
  const occupant = await getPrimaryOccupant(organizacionId, funcion);
  // Antes de la primera respuesta puede no haber ocupante inferible. En ese caso, cualquier
  // usuario con la función asignada puede inaugurar el historial, igual que en el flujo previo.
  return !occupant || occupant.id === userId;
}

export function userCanManageCycle(user, cycle) {
  return user.organizacionId === cycle.organizacionId && user.id === cycle.supervisorId;
}
