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

function nextVersion(v) {
  if (!v || v === 'Borrador') return '1.0';
  const [major, minor] = v.split('.').map(Number);
  return `${major}.${minor + 1}`;
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
    res.json({ success: true, data: manual || null });
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
      attributes: ['id', 'version', 'estado', 'generadoEn', 'createdAt']
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

    // Block if no new entries since last generation
    if (current?.generadoEn) {
      const newCount = await KnowledgeEntry.count({
        where: {
          funcion,
          organizacionId: req.user.organizacionId,
          usuarioId: req.user.id,
          categoria: 'checkin',
          createdAt: { [Op.gt]: current.generadoEn }
        }
      });
      if (newCount === 0) {
        return res.status(400).json({
          success: false,
          error: 'No hay respuestas nuevas desde la última generación. Completá un check-in primero.'
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
    // vigente → increment (1.0 → 1.1); devuelto borrador with real version → preserve it; no prior → Borrador
    const newVersion = current?.estado === 'vigente'
      ? nextVersion(current.version)
      : (current?.version && current.version !== 'Borrador')
        ? current.version
        : 'Borrador';

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

    await manual.update({
      estado: 'en_revision',
      version,
      notaEnvio: nota?.trim() || null,
      observaciones: null
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

    await manual.update({
      estado: 'vigente',
      aprobadoPor: req.user.id,
      aprobadoEn: new Date()
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
