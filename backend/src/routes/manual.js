import { Router } from 'express';
import { Op } from 'sequelize';
import { verifyJWT, requireAdmin, canAccessFuncion } from '../auth.js';
import { db, Manual, ManualCycle, ManualQuestion, KnowledgeEntry, Usuario, Organizacion } from '../models/index.js';
import { generarManualConAgentes, recuperarCicloAtascado } from '../services/manualAgentService.js';
import { userIsPrimaryOccupant } from '../services/positionService.js';
import { cycleAllowsGeneration } from '../manualCyclePolicy.js';
import {
  sendManualEnviadoEmail,
  sendManualAprobadoEmail,
  sendManualDevueltoEmail
} from '../services/emailService.js';

const router = Router();
router.use(verifyJWT);

function nextVersion(v, isMajor = false) {
  if (!v || v === 'Borrador') return '1.0';
  const [major, minor] = v.split('.').map(Number);
  return isMajor ? `${major + 1}.0` : `${major}.${minor + 1}`;
}

// Baseline para diffs: contenido de la última versión APROBADA (vigente o ya archivada),
// no el obsoleto más reciente. Así el diff queda anclado a la última aprobación y no
// "deriva" con cada Actualizar (que archiva borradores intermedios como obsoletos).
async function getContenidoUltimaVigente(organizacionId, funcion, excludeId = null) {
  const where = { organizacionId, funcion, aprobadoEn: { [Op.ne]: null } };
  if (excludeId) where.id = { [Op.ne]: excludeId };
  const m = await Manual.findOne({
    where,
    order: [['aprobadoEn', 'DESC']],
    attributes: ['contenido']
  });
  return m?.contenido || null;
}

// GET pending manuals for review (only manuals of currently assigned supervisees)
router.get('/pendientes', requireAdmin, async (req, res) => {
  try {
    const supervisees = await Usuario.findAll({
      where: { supervisorId: req.user.id, organizacionId: req.user.organizacionId },
      attributes: ['id', 'nombre', 'email', 'funciones']
    });

    if (!supervisees.length) return res.json({ success: true, data: [] });

    const superviseeIds = supervisees.map(u => u.id);
    const manuales = await Manual.findAll({
      where: { usuarioId: { [Op.in]: superviseeIds }, estado: 'en_revision' },
      order: [['updatedAt', 'DESC']]
    });

    // Diff contra la última versión aprobada (no el obsoleto más reciente)
    const data = await Promise.all(manuales.map(async m => {
      const contenidoAnterior = await getContenidoUltimaVigente(req.user.organizacionId, m.funcion, m.id);
      return {
        ...m.toJSON(),
        ocupante: supervisees.find(u => u.id === m.usuarioId),
        contenidoAnterior
      };
    }));

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// GET current manual (latest non-obsoleto): manual is per function (org-wide)
router.get('/:funcion', async (req, res) => {
  try {
    const { funcion } = req.params;
    if (!canAccessFuncion(req.user, funcion)) {
      return res.status(403).json({ success: false, error: 'No tenés acceso a esa función' });
    }
    const manual = await Manual.findOne({
      where: { organizacionId: req.user.organizacionId, funcion, estado: { [Op.ne]: 'obsoleto' } },
      order: [['createdAt', 'DESC']]
    });

    // Determine if current user is the primary occupant for this function
    const org = await Organizacion.findByPk(req.user.organizacionId, { attributes: ['config'] });
    const overrideId = org?.config?.primaryOccupants?.[funcion];
    let isPrimary;
    if (overrideId) {
      isPrimary = overrideId === req.user.id;
    } else {
      const earliestEntry = await KnowledgeEntry.findOne({
        where: { organizacionId: req.user.organizacionId, funcion, categoria: 'checkin' },
        order: [['createdAt', 'ASC']],
        attributes: ['usuarioId']
      });
      isPrimary = !earliestEntry || earliestEntry.usuarioId === req.user.id;
    }

    if (!manual) return res.json({ success: true, data: null, isPrimary });

    const data = manual.toJSON();
    const [ocupante, contenidoAnterior] = await Promise.all([
      Usuario.findByPk(manual.usuarioId, { attributes: ['nombre'] }),
      getContenidoUltimaVigente(req.user.organizacionId, funcion, manual.id)
    ]);
    data.ocupanteNombre = ocupante?.nombre || req.user.nombre;
    data.contenidoAnterior = contenidoAnterior;
    if (manual.aprobadoPor) {
      const aprobador = await Usuario.findByPk(manual.aprobadoPor, { attributes: ['nombre'] });
      data.aprobadoPorNombre = aprobador?.nombre || null;
    }
    res.json({ success: true, data, isPrimary });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// GET version history: per function (org-wide)
router.get('/:funcion/historial', async (req, res) => {
  try {
    const { funcion } = req.params;
    if (!canAccessFuncion(req.user, funcion)) {
      return res.status(403).json({ success: false, error: 'No tenés acceso a esa función' });
    }
    const historial = await Manual.findAll({
      where: { organizacionId: req.user.organizacionId, funcion },
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'version', 'estado', 'generadoEn', 'aprobadoEn', 'createdAt']
    });
    res.json({ success: true, data: historial });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// POST generate/regenerate: archives previous and creates new version
router.post('/:funcion/generar', async (req, res) => {
  let cycle = null;
  try {
    const { funcion } = req.params;

    const funciones = req.user.funciones || [];
    if (req.user.rol === 'operativo' && !funciones.includes(funcion)) {
      return res.status(403).json({ success: false, error: 'No tenés esa función asignada' });
    }

    if (!(await userIsPrimaryOccupant(req.user.id, req.user.organizacionId, funcion))) {
      return res.status(403).json({ success: false, error: 'Solo el ocupante principal puede generar el manual de este puesto.' });
    }

    cycle = await ManualCycle.findOne({
      where: { organizacionId: req.user.organizacionId, funcion },
      order: [['numero', 'DESC']]
    });
    if (!cycle) return res.status(409).json({ success: false, error: 'El supervisor debe crear el ciclo del manual antes de generarlo.' });
    await recuperarCicloAtascado(cycle);
    if (!cycleAllowsGeneration(cycle)) {
      return res.status(409).json({ success: false, error: 'El supervisor debe cerrar el relevamiento antes de generar el manual.' });
    }

    // Find current active (non-obsoleto) manual: per function (org-wide)
    const current = await Manual.findOne({
      where: { organizacionId: req.user.organizacionId, funcion, estado: { [Op.ne]: 'obsoleto' } },
      order: [['createdAt', 'DESC']]
    });

    // Block if in review
    if (current?.estado === 'en_revision') {
      return res.status(400).json({ success: false, error: 'El manual está en revisión. Esperá la respuesta del revisor.' });
    }

    // Block if no new or edited entries since last generation
    if (current?.generadoEn) {
      const changedCount = await KnowledgeEntry.count({
        where: {
          funcion,
          organizacionId: req.user.organizacionId,
          categoria: 'checkin',
          esSensible: false,
          [Op.or]: [
            { createdAt: { [Op.gt]: current.generadoEn } },
            { updatedAt: { [Op.gt]: current.generadoEn } }
          ]
        }
      });
      const hasReviewFeedback = !!current.observaciones || Object.values(current.bloquesEstado || {}).some(block => block.estado === 'devuelto');
      if (changedCount === 0 && !hasReviewFeedback) {
        return res.status(400).json({
          success: false,
          error: 'No hay respuestas nuevas o editadas desde la última generación. Completá un check-in o editá una respuesta primero.'
        });
      }
    }

    const previousCycleState = cycle.estado;
    const [claimedCycle] = await ManualCycle.update(
      { estado: 'generando' },
      { where: { id: cycle.id, estado: previousCycleState } }
    );
    if (claimedCycle !== 1) {
      return res.status(409).json({ success: false, error: 'Ya hay una generación en curso para este ciclo.' });
    }
    await cycle.reload();
    let agentResult;
    try {
      agentResult = await generarManualConAgentes(cycle, current);
    } catch (error) {
      await cycle.update({ estado: previousCycleState });
      throw error;
    }
    if (agentResult.requiereMasConocimiento) {
      await cycle.update({ estado: 'relevamiento', relevamientoCerradoEn: null, esLegacy: false });
      return res.status(409).json({
        success: false,
        code: 'REQUIERE_MAS_CONOCIMIENTO',
        error: 'El verificador detectó información faltante. Se generaron preguntas de seguimiento antes de redactar el manual.',
        data: { preguntas: agentResult.preguntas, verificacion: agentResult.verificacion }
      });
    }
    const contenido = agentResult.contenido;
    if (!Object.keys(contenido).length) {
      await cycle.update({ estado: previousCycleState });
      return res.status(400).json({
        success: false,
        error: 'No hay suficientes respuestas para generar el manual. Completá el check-in primero.'
      });
    }

    // Calculate version for new draft
    const manual = await db.transaction(async transaction => {
      const lockedCurrent = await Manual.findOne({
        where: { organizacionId: req.user.organizacionId, funcion, estado: { [Op.ne]: 'obsoleto' } },
        order: [['createdAt', 'DESC']],
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if ((current?.id || null) !== (lockedCurrent?.id || null)) {
        const error = new Error('El manual cambió mientras se generaba. Volvé a intentar.');
        error.status = 409;
        throw error;
      }
      // La comparación de arriba solo detecta un cambio de fila; si es la MISMA fila pero
      // alguien la mandó a revisión mientras se generaba (llamada a OpenAI de varios segundos),
      // hay que frenar acá también para no archivar un manual que un supervisor ya está revisando.
      if (lockedCurrent?.estado === 'en_revision') {
        const error = new Error('El manual está en revisión. Esperá la respuesta del revisor.');
        error.status = 400;
        throw error;
      }

      let newVersion;
      if (lockedCurrent?.estado === 'vigente') {
        const changedBlocks = Object.keys(contenido).filter(
          b => contenido[b] !== lockedCurrent.contenido?.[b]
        ).length;
        newVersion = nextVersion(lockedCurrent.version, changedBlocks >= 3);
      } else {
        newVersion = (lockedCurrent?.version && lockedCurrent.version !== 'Borrador')
          ? lockedCurrent.version
          : 'Borrador';
      }

    // Archive current borrador or vigente → obsoleto
      if (lockedCurrent) await lockedCurrent.update({ estado: 'obsoleto' }, { transaction });

    // Also archive any other stale borradores for this function
      await Manual.update(
        { estado: 'obsoleto' },
        { where: { organizacionId: req.user.organizacionId, funcion, estado: 'borrador' }, transaction }
      );

      return Manual.create({
        usuarioId: req.user.id,
        organizacionId: req.user.organizacionId,
        cicloId: cycle.id,
        funcion,
        version: newVersion,
        estado: 'borrador',
        contenido,
        generadoEn: new Date()
      }, { transaction });
    });

    await cycle.update({ estado: 'borrador' });

    res.json({ success: true, data: manual, verificacion: agentResult.verificacion });
  } catch (err) {
    if (cycle?.estado === 'generando') await cycle.update({ estado: 'listo_para_generar' }).catch(() => {});
    // Primera generación de la función: dos clicks/pestañas simultáneas pueden pasar el
    // chequeo de id (ambos ven null) y chocar contra el índice único al crear. En ese caso
    // devolvemos el manual que ganó la carrera en vez de un 500 genérico.
    if (err.name === 'SequelizeUniqueConstraintError') {
      const winner = await Manual.findOne({
        where: { organizacionId: req.user.organizacionId, funcion: req.params.funcion, estado: { [Op.ne]: 'obsoleto' } },
        order: [['createdAt', 'DESC']]
      });
      if (winner) return res.json({ success: true, data: winner });
    }
    console.error('Error generando manual:', err.message);
    res.status(err.status || 500).json({ success: false, error: err.status ? err.message : 'Error interno al generar el manual' });
  }
});

// POST send manual for approval
router.post('/:funcion/enviar', async (req, res) => {
  try {
    const { funcion } = req.params;
    const { nota } = req.body;

    const manual = await Manual.findOne({
      where: { organizacionId: req.user.organizacionId, funcion, estado: 'borrador' }
    });
    if (!manual) {
      return res.status(404).json({ success: false, error: 'No hay borrador para enviar. Generá el manual primero.' });
    }

    // Only the primary occupant can send
    const sendOrg = await Organizacion.findByPk(req.user.organizacionId, { attributes: ['config'] });
    const sendOverrideId = sendOrg?.config?.primaryOccupants?.[funcion];
    const sendIsSecondary = sendOverrideId
      ? sendOverrideId !== req.user.id
      : manual.usuarioId !== req.user.id;
    if (sendIsSecondary) {
      return res.status(403).json({ success: false, error: 'Solo el ocupante principal puede enviar este manual.' });
    }

    const usuario = await Usuario.findByPk(req.user.id);
    if (!usuario?.autoaprobarManual && !usuario?.supervisorId) {
      return res.status(400).json({ success: false, error: 'No tenés supervisor asignado. Pedile al administrador que te asigne uno o active la autoaprobación.' });
    }

    // Block re-send if the manual was returned and not yet regenerated
    const tieneDevueltos = manual.bloquesEstado &&
      Object.values(manual.bloquesEstado).some(b => b.estado === 'devuelto');
    if (tieneDevueltos) {
      return res.status(400).json({
        success: false,
        error: 'El manual tiene bloques devueltos. Actualizá el manual antes de reenviar.'
      });
    }

    // Assign version 1.0 on first send; keep existing version on subsequent sends
    const version = manual.version === 'Borrador' ? '1.0' : manual.version;

    // Comparar contra la última versión aprobada para auto-aprobar bloques sin cambios
    const contenidoAnterior = await getContenidoUltimaVigente(req.user.organizacionId, funcion, manual.id);

    const bloquesEstado = {};
    for (const bloque of Object.keys(manual.contenido || {})) {
      if (!manual.contenido[bloque]) continue;
      const prevTexto = contenidoAnterior?.[bloque];
      const modificado = !prevTexto || prevTexto.trim() !== manual.contenido[bloque].trim();
      bloquesEstado[bloque] = { estado: modificado ? 'en_revision' : 'aprobado', observacion: null };
    }

    // Sin revisor asignado (ej: Gerente General): publica directo, sin pasar por en_revision.
    if (usuario.autoaprobarManual) {
      const bloquesEstadoAprobados = {};
      for (const bloque of Object.keys(bloquesEstado)) {
        bloquesEstadoAprobados[bloque] = { estado: 'aprobado', observacion: null };
      }
      await manual.update({
        estado: 'vigente',
        version,
        notaEnvio: nota?.trim() || null,
        observaciones: null,
        bloquesEstado: bloquesEstadoAprobados,
        aprobadoPor: req.user.id,
        aprobadoEn: new Date()
      });
      if (manual.cicloId) {
        await ManualCycle.update(
          { estado: 'completado', completadoEn: new Date() },
          { where: { id: manual.cicloId, organizacionId: req.user.organizacionId } }
        );
      }
      return res.json({ success: true, data: manual });
    }

    const supervisor = await Usuario.findByPk(usuario.supervisorId);
    if (!supervisor) {
      return res.status(400).json({ success: false, error: 'Supervisor no encontrado.' });
    }

    await manual.update({
      estado: 'en_revision',
      version,
      notaEnvio: nota?.trim() || null,
      observaciones: null,
      bloquesEstado
    });
    if (manual.cicloId) await ManualCycle.update({ estado: 'en_revision' }, { where: { id: manual.cicloId } });

    // Email al supervisor
    try {
      await sendManualEnviadoEmail(supervisor.email, req.user.nombre, funcion, nota?.trim());
    } catch (emailErr) {
      console.error('Error enviando email al supervisor:', emailErr.message);
    }

    res.json({ success: true, data: manual });
  } catch (err) {
    console.error('Error enviando manual:', err.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// POST approve manual
router.post('/:id/aprobar', requireAdmin, async (req, res) => {
  try {
    const manual = await Manual.findOne({
      where: { id: req.params.id, organizacionId: req.user.organizacionId, estado: 'en_revision' }
    });
    if (!manual) return res.status(404).json({ success: false, error: 'Manual no encontrado o no está en revisión' });

    const ocupante = await Usuario.findOne({
      where: { id: manual.usuarioId, supervisorId: req.user.id, organizacionId: req.user.organizacionId }
    });
    if (!ocupante) {
      return res.status(403).json({ success: false, error: 'No tenés permiso para aprobar este manual' });
    }

    const aprobador = await Usuario.findByPk(req.user.id);

    const bloquesEstadoAll = {};
    for (const bloque of Object.keys(manual.contenido || {})) {
      if (manual.contenido[bloque]) bloquesEstadoAll[bloque] = { estado: 'aprobado', observacion: null };
    }

    let nextCycle = null;
    const direction = req.body.proximoCiclo || {};
    const nextTopics = Array.isArray(direction.temas)
      ? [...new Set(direction.temas.map(value => String(value).trim()).filter(Boolean))].slice(0, 20)
      : [];
    const nextOrientation = String(direction.orientacion || '').trim().slice(0, 5000) || null;
    await db.transaction(async transaction => {
      const lockedManual = await Manual.findOne({
        where: { id: manual.id, estado: 'en_revision' }, transaction, lock: transaction.LOCK.UPDATE
      });
      if (!lockedManual) {
        const error = new Error('El manual ya fue resuelto por otra operación');
        error.status = 409;
        throw error;
      }
      await lockedManual.update({
        estado: 'vigente',
        aprobadoPor: req.user.id,
        aprobadoEn: new Date(),
        bloquesEstado: bloquesEstadoAll
      }, { transaction });
      if (lockedManual.cicloId) {
        const cycle = await ManualCycle.findByPk(lockedManual.cicloId, { transaction, lock: transaction.LOCK.UPDATE });
        if (!cycle) return;
        await cycle.update({
          estado: 'completado',
          completadoEn: new Date(),
          proximosTemas: nextTopics,
          proximaOrientacion: nextOrientation,
          configProximoCiclo: {
            preguntasPorEntrega: cycle.preguntasPorEntrega,
            frecuencia: cycle.frecuencia,
            intervaloDias: cycle.intervaloDias,
            objetivoPreguntas: cycle.objetivoPreguntas,
            requiereAprobacionPreguntas: cycle.requiereAprobacionPreguntas
          }
        }, { transaction });
        if (direction.iniciarAhora) {
          nextCycle = await ManualCycle.create({
            organizacionId: cycle.organizacionId,
            funcion: cycle.funcion,
            numero: cycle.numero + 1,
            ocupanteId: cycle.ocupanteId,
            supervisorId: req.user.id,
            estado: 'configuracion',
            temas: nextTopics.length ? nextTopics : (cycle.heredarOrientacion ? cycle.temas : []),
            orientacion: nextOrientation || (cycle.heredarOrientacion ? cycle.orientacion : null),
            heredarOrientacion: cycle.heredarOrientacion,
            preguntasPorEntrega: cycle.preguntasPorEntrega,
            frecuencia: cycle.frecuencia,
            intervaloDias: cycle.intervaloDias,
            objetivoPreguntas: cycle.objetivoPreguntas,
            requiereAprobacionPreguntas: cycle.requiereAprobacionPreguntas
          }, { transaction });
        }
      }
    });
    await manual.reload();

    // Email al ocupante
    try {
      if (ocupante) await sendManualAprobadoEmail(ocupante.email, manual.funcion, aprobador.nombre);
    } catch (emailErr) {
      console.error('Error enviando email de aprobación:', emailErr.message);
    }

    res.json({ success: true, data: manual, nextCycle });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Error interno' });
  }
});

// POST approve a single block
router.post('/:id/aprobar-bloque', requireAdmin, async (req, res) => {
  try {
    const { bloque } = req.body;
    if (!bloque) return res.status(400).json({ success: false, error: 'Bloque requerido' });

    const manual = await Manual.findOne({ where: { id: req.params.id, organizacionId: req.user.organizacionId, estado: 'en_revision' } });
    if (!manual) return res.status(404).json({ success: false, error: 'Manual no encontrado' });
    if (!Object.prototype.hasOwnProperty.call(manual.contenido || {}, bloque)) {
      return res.status(400).json({ success: false, error: 'Bloque inválido para este manual' });
    }

    const ocupante = await Usuario.findOne({ where: { id: manual.usuarioId, supervisorId: req.user.id, organizacionId: req.user.organizacionId } });
    if (!ocupante) {
      return res.status(403).json({ success: false, error: 'Sin permiso' });
    }

    const bloquesEstado = { ...(manual.bloquesEstado || {}) };
    bloquesEstado[bloque] = { estado: 'aprobado', observacion: null };

    const allAprobados = Object.keys(bloquesEstado).length > 0 &&
      Object.values(bloquesEstado).every(b => b.estado === 'aprobado');

    await manual.update({ bloquesEstado });

    res.json({ success: true, data: { ...manual.toJSON(), allAprobados: false, requiereCierre: allAprobados } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// POST return a single block with observation
router.post('/:id/devolver-bloque', requireAdmin, async (req, res) => {
  try {
    const { bloque, observacion } = req.body;
    if (!bloque) return res.status(400).json({ success: false, error: 'Bloque requerido' });

    const manual = await Manual.findOne({ where: { id: req.params.id, organizacionId: req.user.organizacionId, estado: 'en_revision' } });
    if (!manual) return res.status(404).json({ success: false, error: 'Manual no encontrado' });
    if (!Object.prototype.hasOwnProperty.call(manual.contenido || {}, bloque)) {
      return res.status(400).json({ success: false, error: 'Bloque inválido para este manual' });
    }

    const ocupante = await Usuario.findOne({ where: { id: manual.usuarioId, supervisorId: req.user.id, organizacionId: req.user.organizacionId } });
    if (!ocupante) {
      return res.status(403).json({ success: false, error: 'Sin permiso' });
    }

    const bloquesEstado = { ...(manual.bloquesEstado || {}) };
    bloquesEstado[bloque] = { estado: 'devuelto', observacion: observacion?.trim() || null };

    const allResolved = Object.values(bloquesEstado).every(b => b.estado !== 'en_revision');
    const updates = { bloquesEstado };
    if (allResolved) updates.estado = 'borrador';

    await manual.update(updates);
    if (allResolved && manual.cicloId) {
      await ManualCycle.update({ estado: 'borrador' }, { where: { id: manual.cicloId } });
    }

    if (allResolved && ocupante) {
      const obs = Object.values(bloquesEstado)
        .filter(b => b.estado === 'devuelto' && b.observacion)
        .map(b => b.observacion)
        .join('\n');
      try {
        await sendManualDevueltoEmail(ocupante.email, manual.funcion, obs || 'Ver observaciones en el sistema.');
      } catch (emailErr) {
        console.error('Error enviando email de devolución:', emailErr.message);
      }
    }

    res.json({ success: true, data: { ...manual.toJSON(), allResolved } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// POST return manual with observations
router.post('/:id/devolver', requireAdmin, async (req, res) => {
  try {
    const { observaciones, tipo = 'redaccion', preguntaSeguimiento } = req.body;
    if (!observaciones?.trim()) {
      return res.status(400).json({ success: false, error: 'Las observaciones son requeridas' });
    }
    if (!['redaccion', 'falta_conocimiento'].includes(tipo)) {
      return res.status(400).json({ success: false, error: 'Tipo de devolución inválido' });
    }
    if (tipo === 'falta_conocimiento' && !String(preguntaSeguimiento || '').trim()) {
      return res.status(400).json({ success: false, error: 'Indicá la pregunta de seguimiento necesaria' });
    }

    const manual = await Manual.findOne({
      where: { id: req.params.id, organizacionId: req.user.organizacionId, estado: 'en_revision' }
    });
    if (!manual) return res.status(404).json({ success: false, error: 'Manual no encontrado o no está en revisión' });

    const ocupante = await Usuario.findOne({
      where: { id: manual.usuarioId, supervisorId: req.user.id, organizacionId: req.user.organizacionId }
    });
    if (!ocupante) {
      return res.status(403).json({ success: false, error: 'No tenés permiso para devolver este manual' });
    }

    await db.transaction(async transaction => {
      const lockedManual = await Manual.findOne({
        where: { id: manual.id, estado: 'en_revision' }, transaction, lock: transaction.LOCK.UPDATE
      });
      if (!lockedManual) {
        const error = new Error('El manual ya fue resuelto por otra operación');
        error.status = 409;
        throw error;
      }
      await lockedManual.update({ estado: 'borrador', observaciones: observaciones.trim() }, { transaction });
      if (!lockedManual.cicloId) return;
      const cycle = await ManualCycle.findByPk(lockedManual.cicloId, { transaction, lock: transaction.LOCK.UPDATE });
      if (cycle && tipo === 'falta_conocimiento') {
        const order = await ManualQuestion.count({ where: { cicloId: cycle.id }, transaction });
        await ManualQuestion.create({
          cicloId: cycle.id,
          organizacionId: cycle.organizacionId,
          texto: String(preguntaSeguimiento).trim(),
          bloque: 'B4',
          tema: 'Faltante indicado por el supervisor',
          objetivo: observaciones.trim(),
          origen: 'supervisor_revision',
          prioridad: 'importante',
          estado: 'aprobada',
          orden: order,
          aprobadaPor: req.user.id,
          aprobadaEn: new Date()
        }, { transaction });
        await cycle.update({ estado: 'relevamiento', relevamientoCerradoEn: null, esLegacy: false }, { transaction });
      } else if (cycle) {
        await cycle.update({ estado: 'borrador' }, { transaction });
      }
    });
    await manual.reload();

    // Email al ocupante
    try {
      if (ocupante) await sendManualDevueltoEmail(ocupante.email, manual.funcion, observaciones.trim());
    } catch (emailErr) {
      console.error('Error enviando email de devolución:', emailErr.message);
    }

    res.json({ success: true, data: manual });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Error interno' });
  }
});

export default router;
