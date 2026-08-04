import { Router } from 'express';
import { Op } from 'sequelize';
import { verifyJWT, requireAdmin } from '../auth.js';
import { Manual, KnowledgeEntry, Usuario, Organizacion } from '../models/index.js';
import { generarManual } from '../services/manualService.js';
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

// GET pending manuals for review (admin/superadmin sees manuals of their supervisees)
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
  try {
    const { funcion } = req.params;

    const funciones = req.user.funciones || [];
    if (req.user.rol === 'operativo' && !funciones.includes(funcion)) {
      return res.status(403).json({ success: false, error: 'No tenés esa función asignada' });
    }

    // Only the primary occupant can generate the manual
    const genOrg = await Organizacion.findByPk(req.user.organizacionId, { attributes: ['config'] });
    const genOverrideId = genOrg?.config?.primaryOccupants?.[funcion];
    let genIsSecondary;
    if (genOverrideId) {
      genIsSecondary = genOverrideId !== req.user.id;
    } else {
      const earliestEntry = await KnowledgeEntry.findOne({
        where: { organizacionId: req.user.organizacionId, funcion, categoria: 'checkin' },
        order: [['createdAt', 'ASC']],
        attributes: ['usuarioId']
      });
      genIsSecondary = earliestEntry && earliestEntry.usuarioId !== req.user.id;
    }
    if (genIsSecondary) {
      return res.status(403).json({ success: false, error: 'Solo el ocupante principal puede generar el manual de este puesto.' });
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
          [Op.or]: [
            { createdAt: { [Op.gt]: current.generadoEn } },
            { updatedAt: { [Op.gt]: current.generadoEn } }
          ]
        }
      });
      if (changedCount === 0) {
        return res.status(400).json({
          success: false,
          error: 'No hay respuestas nuevas o editadas desde la última generación. Completá un check-in o editá una respuesta primero.'
        });
      }
    }

    const contenido = await generarManual(funcion, req.user.organizacionId, KnowledgeEntry, current);
    if (!Object.keys(contenido).length) {
      return res.status(400).json({
        success: false,
        error: 'No hay suficientes respuestas para generar el manual. Completá el check-in primero.'
      });
    }

    // Calculate version for new draft
    let newVersion;
    if (current?.estado === 'vigente') {
      const changedBlocks = Object.keys(contenido).filter(
        b => contenido[b] !== current.contenido?.[b]
      ).length;
      newVersion = nextVersion(current.version, changedBlocks >= 3);
    } else {
      newVersion = (current?.version && current.version !== 'Borrador')
        ? current.version
        : 'Borrador';
    }

    // Archive current borrador or vigente → obsoleto
    if (current) await current.update({ estado: 'obsoleto' });

    // Also archive any other stale borradores for this function
    await Manual.update(
      { estado: 'obsoleto' },
      { where: { organizacionId: req.user.organizacionId, funcion, estado: 'borrador' } }
    );

    const manual = await Manual.create({
      usuarioId: req.user.id,
      organizacionId: req.user.organizacionId,
      funcion,
      version: newVersion,
      estado: 'borrador',
      contenido,
      generadoEn: new Date()
    });

    res.json({ success: true, data: manual });
  } catch (err) {
    console.error('Error generando manual:', err.message);
    res.status(500).json({ success: false, error: 'Error interno al generar el manual' });
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
      where: { id: req.params.id, estado: 'en_revision' }
    });
    if (!manual) return res.status(404).json({ success: false, error: 'Manual no encontrado o no está en revisión' });

    // Verify the occupant reports to this reviewer
    const ocupante = await Usuario.findOne({
      where: { id: manual.usuarioId, supervisorId: req.user.id }
    });
    if (!ocupante && req.user.rol !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'No tenés permiso para aprobar este manual' });
    }

    const aprobador = await Usuario.findByPk(req.user.id);

    const bloquesEstadoAll = {};
    for (const bloque of Object.keys(manual.contenido || {})) {
      if (manual.contenido[bloque]) bloquesEstadoAll[bloque] = { estado: 'aprobado', observacion: null };
    }

    await manual.update({
      estado: 'vigente',
      aprobadoPor: req.user.id,
      aprobadoEn: new Date(),
      bloquesEstado: bloquesEstadoAll
    });

    // Email al ocupante
    try {
      if (ocupante) await sendManualAprobadoEmail(ocupante.email, manual.funcion, aprobador.nombre);
    } catch (emailErr) {
      console.error('Error enviando email de aprobación:', emailErr.message);
    }

    res.json({ success: true, data: manual });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// POST approve a single block
router.post('/:id/aprobar-bloque', requireAdmin, async (req, res) => {
  try {
    const { bloque } = req.body;
    if (!bloque) return res.status(400).json({ success: false, error: 'Bloque requerido' });

    const manual = await Manual.findOne({ where: { id: req.params.id, estado: 'en_revision' } });
    if (!manual) return res.status(404).json({ success: false, error: 'Manual no encontrado' });

    const ocupante = await Usuario.findOne({ where: { id: manual.usuarioId, supervisorId: req.user.id } });
    if (!ocupante && req.user.rol !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Sin permiso' });
    }

    const bloquesEstado = { ...(manual.bloquesEstado || {}) };
    bloquesEstado[bloque] = { estado: 'aprobado', observacion: null };

    const allAprobados = Object.keys(bloquesEstado).length > 0 &&
      Object.values(bloquesEstado).every(b => b.estado === 'aprobado');

    const updates = { bloquesEstado };
    if (allAprobados) {
      updates.estado = 'vigente';
      updates.aprobadoPor = req.user.id;
      updates.aprobadoEn = new Date();
    }

    await manual.update(updates);

    if (allAprobados && ocupante) {
      try {
        await sendManualAprobadoEmail(ocupante.email, manual.funcion, req.user.nombre);
      } catch (emailErr) {
        console.error('Error enviando email de aprobación:', emailErr.message);
      }
    }

    res.json({ success: true, data: { ...manual.toJSON(), allAprobados } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// POST return a single block with observation
router.post('/:id/devolver-bloque', requireAdmin, async (req, res) => {
  try {
    const { bloque, observacion } = req.body;
    if (!bloque) return res.status(400).json({ success: false, error: 'Bloque requerido' });

    const manual = await Manual.findOne({ where: { id: req.params.id, estado: 'en_revision' } });
    if (!manual) return res.status(404).json({ success: false, error: 'Manual no encontrado' });

    const ocupante = await Usuario.findOne({ where: { id: manual.usuarioId, supervisorId: req.user.id } });
    if (!ocupante && req.user.rol !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Sin permiso' });
    }

    const bloquesEstado = { ...(manual.bloquesEstado || {}) };
    bloquesEstado[bloque] = { estado: 'devuelto', observacion: observacion?.trim() || null };

    const allResolved = Object.values(bloquesEstado).every(b => b.estado !== 'en_revision');
    const updates = { bloquesEstado };
    if (allResolved) updates.estado = 'borrador';

    await manual.update(updates);

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
    const { observaciones } = req.body;
    if (!observaciones?.trim()) {
      return res.status(400).json({ success: false, error: 'Las observaciones son requeridas' });
    }

    const manual = await Manual.findOne({
      where: { id: req.params.id, estado: 'en_revision' }
    });
    if (!manual) return res.status(404).json({ success: false, error: 'Manual no encontrado o no está en revisión' });

    const ocupante = await Usuario.findOne({
      where: { id: manual.usuarioId, supervisorId: req.user.id }
    });
    if (!ocupante && req.user.rol !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'No tenés permiso para devolver este manual' });
    }

    await manual.update({ estado: 'borrador', observaciones: observaciones.trim() });

    // Email al ocupante
    try {
      if (ocupante) await sendManualDevueltoEmail(ocupante.email, manual.funcion, observaciones.trim());
    } catch (emailErr) {
      console.error('Error enviando email de devolución:', emailErr.message);
    }

    res.json({ success: true, data: manual });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

export default router;
