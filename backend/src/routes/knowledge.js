import { Router } from 'express';
import { Op } from 'sequelize';
import { verifyJWT } from '../auth.js';
import { KnowledgeEntry } from '../models/index.js';
import { detectSensitive } from '../utils/detectSensitive.js';

const router = Router();
router.use(verifyJWT);

// Regla de visibilidad de entradas sensibles:
// superadmin → ve todo
// admin → nunca ve sensibles
// operativo → solo ve sensibles de sus funciones asignadas
function canSeeSensitive(user, funcion) {
  if (user.rol === 'superadmin') return true;
  if (user.rol === 'admin') return false;
  return user.funciones?.includes(funcion);
}

// GET entries
router.get('/', async (req, res) => {
  try {
    const { funcion, categoria } = req.query;
    const where = { organizacionId: req.user.organizacionId };

    if (funcion) {
      where.funcion = funcion;
    } else if (req.user.rol === 'operativo') {
      // operativo sees only their assigned functions
      const fns = req.user.funciones || [];
      where.funcion = fns.length > 0 ? { [Op.in]: fns } : { [Op.in]: ['__none__'] };
    }
    // admin and superadmin see all functions

    if (categoria) where.categoria = categoria;

    const entries = await KnowledgeEntry.findAll({ where, order: [['createdAt', 'DESC']] });

    const filtered = entries.map(e => {
      const entry = e.toJSON();
      if (entry.esSensible && !canSeeSensitive(req.user, entry.funcion)) {
        entry.contenido = '[Contenido sensible — no tenés acceso a esta función]';
        entry._bloqueado = true;
      }
      return entry;
    });

    res.json({ success: true, data: filtered });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// POST create entry
router.post('/', async (req, res) => {
  try {
    const { funcion, categoria, titulo, contenido, esSensible } = req.body;
    if (!funcion || !titulo || !contenido) {
      return res.status(400).json({ success: false, error: 'funcion, titulo y contenido son requeridos' });
    }

    // Operativo only creates entries for their assigned functions
    if (req.user.rol === 'operativo' && !req.user.funciones?.includes(funcion)) {
      return res.status(403).json({ success: false, error: 'No tenés acceso a esa función' });
    }

    // Solo superadmin puede marcar manualmente como sensible
    const manualSensible = esSensible === true;
    if (manualSensible && req.user.rol !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Solo el superadmin puede marcar entradas como sensibles' });
    }

    // Auto-detect sensitive content (keyword + AI)
    const autoDetectado = !manualSensible ? await detectSensitive(titulo, contenido) : false;
    const sensible = manualSensible || autoDetectado;

    const entry = await KnowledgeEntry.create({
      organizacionId: req.user.organizacionId,
      funcion,
      categoria: categoria || 'general',
      titulo,
      contenido,
      esSensible: sensible,
      usuarioId: req.user.id
    });

    res.status(201).json({ success: true, data: entry, sensibleAutoDetectado: autoDetectado });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// PUT update entry
router.put('/:id', async (req, res) => {
  try {
    const entry = await KnowledgeEntry.findOne({
      where: { id: req.params.id, organizacionId: req.user.organizacionId }
    });
    if (!entry) return res.status(404).json({ success: false, error: 'Entrada no encontrada' });

    if (req.user.rol === 'operativo' && !req.user.funciones?.includes(entry.funcion)) {
      return res.status(403).json({ success: false, error: 'No tenés acceso a esa función' });
    }

    if (entry.esSensible && req.user.rol !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Solo superadmin puede modificar entradas sensibles' });
    }

    const { titulo, contenido, categoria, esSensible } = req.body;

    // Solo superadmin puede cambiar esSensible manualmente
    const manualSensible = esSensible !== undefined
      ? (req.user.rol === 'superadmin' ? esSensible : entry.esSensible)
      : entry.esSensible;

    // Auto-detect on updated content if not already sensitive
    const wasAlreadySensible = entry.esSensible;
    const tituloFinal = titulo ?? entry.titulo;
    const contenidoFinal = contenido ?? entry.contenido;
    const autoDetectado = !manualSensible ? await detectSensitive(tituloFinal, contenidoFinal) : false;
    const finalSensible = manualSensible || autoDetectado;

    await entry.update({ titulo, contenido, categoria, esSensible: finalSensible });

    // Re-fetch so afterFind hook decrypts the content before responding
    const refreshed = await KnowledgeEntry.findByPk(entry.id);
    const responseData = refreshed.toJSON();
    if (responseData.esSensible && !canSeeSensitive(req.user, responseData.funcion)) {
      responseData.contenido = '[Contenido sensible — no tenés acceso a esta función]';
      responseData._bloqueado = true;
    }

    res.json({ success: true, data: responseData, sensibleAutoDetectado: autoDetectado && !wasAlreadySensible });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// DELETE entry
router.delete('/:id', async (req, res) => {
  try {
    const entry = await KnowledgeEntry.findOne({
      where: { id: req.params.id, organizacionId: req.user.organizacionId }
    });
    if (!entry) return res.status(404).json({ success: false, error: 'Entrada no encontrada' });

    if (req.user.rol === 'operativo' && !req.user.funciones?.includes(entry.funcion)) {
      return res.status(403).json({ success: false, error: 'No tenés acceso a esa función' });
    }

    if (entry.esSensible && req.user.rol !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Solo superadmin puede eliminar entradas sensibles' });
    }

    await entry.destroy();
    res.json({ success: true, data: { message: 'Entrada eliminada' } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

export default router;
