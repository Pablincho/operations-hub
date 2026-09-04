import { Op } from 'sequelize';
import { db, Manual, ManualCycle, Usuario } from '../models/index.js';
import { generarManualConAgentes } from './manualAgentService.js';
import { sendManualEnviadoEmail } from './emailService.js';

function nextVersion(version, isMajor = false) {
  if (!version || version === 'Borrador') return '1.0';
  const [major, minor] = version.split('.').map(Number);
  return isMajor ? `${major + 1}.0` : `${major}.${minor + 1}`;
}

// Se ejecuta al completar la última pregunta prevista. La respuesta ya fue guardada
// antes de entrar acá: si OpenAI o el correo fallan, nunca se pierde evidencia y el
// ciclo queda listo_para_generar para poder recuperarlo.
export async function generarYEnviarRevisionAutomatica(cicloId) {
  const cycle = await ManualCycle.findByPk(cicloId);
  if (!cycle || cycle.estado !== 'listo_para_generar') return { estado: 'omitido' };

  const [claimed] = await ManualCycle.update(
    { estado: 'generando' },
    { where: { id: cycle.id, estado: 'listo_para_generar' } }
  );
  if (claimed !== 1) return { estado: 'omitido' };
  await cycle.reload();

  try {
    const operativo = await Usuario.findByPk(cycle.ocupanteId);
    if (!operativo) throw new Error('Operativo no encontrado para el ciclo');
    if (!operativo.autoaprobarManual && !operativo.supervisorId) {
      throw new Error('El operativo no tiene supervisor asignado para enviar el manual a revisión');
    }
    const supervisor = operativo.autoaprobarManual ? null : await Usuario.findByPk(operativo.supervisorId);
    if (!operativo.autoaprobarManual && !supervisor) {
      throw new Error('Supervisor no encontrado para el envío automático');
    }

    const current = await Manual.findOne({
      where: { organizacionId: cycle.organizacionId, funcion: cycle.funcion, estado: { [Op.ne]: 'obsoleto' } },
      order: [['createdAt', 'DESC']]
    });
    if (current?.estado === 'en_revision') {
      throw new Error('Ya hay un manual de este puesto en revisión');
    }

    const agentResult = await generarManualConAgentes(cycle, current);
    if (agentResult.requiereMasConocimiento) {
      await cycle.update({ estado: 'relevamiento', relevamientoCerradoEn: null, esLegacy: false });
      return { estado: 'requiere_mas_conocimiento', preguntas: agentResult.preguntas || [] };
    }
    if (!Object.keys(agentResult.contenido || {}).length) {
      throw new Error('No hay evidencia suficiente para generar el manual');
    }

    const manual = await db.transaction(async transaction => {
      const lockedCurrent = await Manual.findOne({
        where: { organizacionId: cycle.organizacionId, funcion: cycle.funcion, estado: { [Op.ne]: 'obsoleto' } },
        order: [['createdAt', 'DESC']], transaction, lock: transaction.LOCK.UPDATE
      });
      if ((current?.id || null) !== (lockedCurrent?.id || null) || lockedCurrent?.estado === 'en_revision') {
        throw new Error('El manual cambió mientras se generaba automáticamente');
      }
      const changedBlocks = Object.keys(agentResult.contenido).filter(
        block => agentResult.contenido[block] !== lockedCurrent?.contenido?.[block]
      ).length;
      const version = lockedCurrent?.estado === 'vigente'
        ? nextVersion(lockedCurrent.version, changedBlocks >= 3)
        : (lockedCurrent?.version && lockedCurrent.version !== 'Borrador' ? lockedCurrent.version : '1.0');

      if (lockedCurrent) await lockedCurrent.update({ estado: 'obsoleto' }, { transaction });
      await Manual.update(
        { estado: 'obsoleto' },
        { where: { organizacionId: cycle.organizacionId, funcion: cycle.funcion, estado: 'borrador' }, transaction }
      );

      const previousApproved = await Manual.findOne({
        where: { organizacionId: cycle.organizacionId, funcion: cycle.funcion, aprobadoEn: { [Op.ne]: null } },
        order: [['aprobadoEn', 'DESC']], transaction
      });
      // Cuando esta generación nace de una devolución, el manual anterior conserva
      // exactamente qué bloques pidió corregir el supervisor. No se debe reabrir el
      // resto por cambios de redacción del agente: solo vuelven a revisión aquellos
      // que estaban devueltos y cuya nueva evidencia acaba de responder el operativo.
      const bloquesDevueltos = new Set(
        Object.entries(lockedCurrent?.bloquesEstado || {})
          .filter(([, state]) => state?.estado === 'devuelto')
          .map(([block]) => block)
      );
      const esRegeneracionPorDevolucion = bloquesDevueltos.size > 0;
      const bloquesEstado = {};
      const suggestionsByBlock = new Map();
      for (const gap of agentResult.sugerenciasFaltantes || []) {
        const block = gap.bloque || 'B4';
        const message = String(gap.motivo || gap.pregunta || '').trim();
        if (!message) continue;
        suggestionsByBlock.set(block, [...(suggestionsByBlock.get(block) || []), message]);
      }
      for (const [block, text] of Object.entries(agentResult.contenido)) {
        if (!text) continue;
        const previousText = previousApproved?.contenido?.[block];
        bloquesEstado[block] = {
          estado: operativo.autoaprobarManual
            ? 'aprobado'
            : esRegeneracionPorDevolucion
              ? (bloquesDevueltos.has(block) ? 'en_revision' : 'aprobado')
              : (!previousText || previousText.trim() !== text.trim()) ? 'en_revision' : 'aprobado',
          observacion: null,
          sugerenciaVerificador: (suggestionsByBlock.get(block) || []).join(' ')
        };
      }
      if (operativo.autoaprobarManual) {
        for (const block of Object.keys(bloquesEstado)) bloquesEstado[block] = { estado: 'aprobado', observacion: null };
      }

      return Manual.create({
        usuarioId: operativo.id,
        organizacionId: cycle.organizacionId,
        cicloId: cycle.id,
        funcion: cycle.funcion,
        version,
        estado: operativo.autoaprobarManual ? 'vigente' : 'en_revision',
        contenido: agentResult.contenido,
        generadoEn: new Date(),
        bloquesEstado,
        ...(operativo.autoaprobarManual ? { aprobadoPor: operativo.id, aprobadoEn: new Date() } : {})
      }, { transaction });
    });

    if (operativo.autoaprobarManual) {
      await cycle.update({ estado: 'completado', completadoEn: new Date() });
    } else {
      await cycle.update({ estado: 'en_revision' });
      try {
        await sendManualEnviadoEmail(supervisor.email, operativo.nombre, cycle.funcion, null);
      } catch (emailError) {
        console.error('[auto-review] No se pudo enviar el correo:', emailError.message);
      }
    }
    return { estado: manual.estado, manual };
  } catch (error) {
    await ManualCycle.update({ estado: 'listo_para_generar' }, { where: { id: cycle.id, estado: 'generando' } });
    throw error;
  }
}
