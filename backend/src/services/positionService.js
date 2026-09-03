import { Op } from 'sequelize';
import { KnowledgeEntry, Organizacion, Usuario } from '../models/index.js';

export async function getPrimaryOccupant(organizacionId, funcion) {
  const org = await Organizacion.findByPk(organizacionId, { attributes: ['config'] });
  const configuredId = org?.config?.primaryOccupants?.[funcion];
  if (configuredId) {
    return Usuario.findOne({ where: { id: configuredId, organizacionId, activo: true } });
  }

  const earliest = await KnowledgeEntry.findOne({
    where: { organizacionId, funcion, categoria: 'checkin' },
    order: [['createdAt', 'ASC']],
    attributes: ['usuarioId']
  });
  if (earliest) {
    const occupant = await Usuario.findOne({
      where: { id: earliest.usuarioId, organizacionId, activo: true }
    });
    if (occupant) return occupant;
  }

  return Usuario.findOne({
    where: { organizacionId, activo: true, funciones: { [Op.contains]: [funcion] } },
    order: [['createdAt', 'ASC']]
  });
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
