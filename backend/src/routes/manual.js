import { Router } from 'express';
import { Op } from 'sequelize';
import { verifyJWT } from '../auth.js';
import { Manual, KnowledgeEntry } from '../models/index.js';
import { generarManual } from '../services/manualService.js';

const router = Router();
router.use(verifyJWT);

// GET current manual (latest non-obsoleto)
router.get('/:funcion', async (req, res) => {
  try {
    const { funcion } = req.params;
    const manual = await Manual.findOne({
      where: {
        usuarioId: req.user.id,
        funcion,
        estado: { [Op.ne]: 'obsoleto' }
      },
      order: [['createdAt', 'DESC']]
    });
    res.json({ success: true, data: manual || null });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// GET version history for a function
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

// POST generate/regenerate — archives previous borrador and creates new version
router.post('/:funcion/generar', async (req, res) => {
  try {
    const { funcion } = req.params;

    const funciones = req.user.funciones || [];
    if (req.user.rol === 'operativo' && !funciones.includes(funcion)) {
      return res.status(403).json({ success: false, error: 'No tenés esa función asignada' });
    }

    const contenido = await generarManual(
      funcion,
      req.user.organizacionId,
      req.user.id,
      KnowledgeEntry
    );

    if (!Object.keys(contenido).length) {
      return res.status(400).json({
        success: false,
        error: 'No hay suficientes respuestas para generar el manual. Completá el check-in primero.'
      });
    }

    // Archive any existing borrador → obsoleto
    await Manual.update(
      { estado: 'obsoleto' },
      { where: { usuarioId: req.user.id, funcion, estado: 'borrador' } }
    );

    // Create new borrador version
    const manual = await Manual.create({
      usuarioId: req.user.id,
      organizacionId: req.user.organizacionId,
      funcion,
      version: 'Borrador',
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

export default router;
