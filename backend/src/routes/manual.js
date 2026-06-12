import { Router } from 'express';
import { Op } from 'sequelize';
import { verifyJWT, requireAdmin } from '../auth.js';
import { Manual, KnowledgeEntry, Usuario } from '../models/index.js';
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

    // Fetch the most recent obsoleto version for each pending manual (for diff view)
    const data = await Promise.all(manuales.map(async m => {
      const anterior = await Manual.findOne({
        where: { usuarioId: m.usuarioId, funcion: m.funcion, estado: 'obsoleto' },
        order: [['createdAt', 'DESC']],
        attributes: ['id', 'version', 'contenido']
      });
      return {
        ...m.toJSON(),
        ocupante: supervisees.find(u => u.id === m.usuarioId),
        contenidoAnterior: anterior?.contenido || null
      };
    }));

    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// GET current manual (latest non-obsoleto)
router.get('/:funcion', async (req, res) => {
  try {
    const { funcion } = req.params;
    const manual = await Manual.findOne({
      where: { usuarioId: req.user.id, funcion, estado: { [Op.ne]: 'obsoleto' } },
      order: [['createdAt', 'DESC']]
    });
    if (!manual) return res.json({ success: true, data: null });

    const data = manual.toJSON();
    data.ocupanteNombre = req.user.nombre;
    if (manual.aprobadoPor) {
      const aprobador = await Usuario.findByPk(manual.aprobadoPor, { attributes: ['nombre'] });
      data.aprobadoPorNombre = aprobador?.nombre || null;
    }
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// GET version history
router.get('/:funcion/historial', async (req, res) => {
  try {
    const { funcion } = req.params;
    const historial = await Manual.findAll({
      where: { usuarioId: req.user.id, funcion },
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'version', 'estado', 'generadoEn', 'aprobadoEn', 'createdAt']
    });
    res.json({ success: true, data: historial });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// POST generate/regenerate — archives previous and creates new version
router.post('/:funcion/generar', async (req, res) => {
  try {
    const { funcion } = req.params;

    const funciones = req.user.funciones || [];
    if (req.user.rol === 'operativo' && !funciones.includes(funcion)) {
      return res.status(403).json({ success: false, error: 'No tenés esa función asignada' });
    }

    // Find current active (non-obsoleto) manual to determine next version and for incremental generation
    const current = await Manual.findOne({
      where: { usuarioId: req.user.id, funcion, estado: { [Op.ne]: 'obsoleto' } },
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
          usuarioId: req.user.id,
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

    const contenido = await generarManual(funcion, req.user.organizacionId, req.user.id, KnowledgeEntry, current);
    if (!Object.keys(contenido).length) {
      return res.status(400).json({
        success: false,
        error: 'No hay suficientes respuestas para generar el manual. Completá el check-in primero.'
      });
    }

    // Calculate version for new draft
    // vigente → increment (minor if <3 blocks changed, major if ≥3); devuelto borrador → preserve version; no prior → Borrador
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

    // Also archive any other stale borradores
    await Manual.update(
      { estado: 'obsoleto' },
      { where: { usuarioId: req.user.id, funcion, estado: 'borrador' } }
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
      where: { usuarioId: req.user.id, funcion, estado: 'borrador' }
    });
    if (!manual) {
      return res.status(404).json({ success: false, error: 'No hay borrador para enviar. Generá el manual primero.' });
    }

    const usuario = await Usuario.findByPk(req.user.id);
    if (!usuario?.supervisorId) {
      return res.status(400).json({ success: false, error: 'No tenés supervisor asignado. Pedile al administrador que te asigne uno.' });
    }

    const supervisor = await Usuario.findByPk(usuario.supervisorId);
    if (!supervisor) {
      return res.status(400).json({ success: false, error: 'Supervisor no encontrado.' });
    }

    // Assign version 1.0 on first send; keep existing version on subsequent sends
    const version = manual.version === 'Borrador' ? '1.0' : manual.version;

    const bloquesEstado = {};
    for (const bloque of Object.keys(manual.contenido || {})) {
      if (manual.contenido[bloque]) bloquesEstado[bloque] = { estado: 'en_revision', observacion: null };
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

    await manual.update({ bloquesEstado });

    res.json({ success: true, data: manual });
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
