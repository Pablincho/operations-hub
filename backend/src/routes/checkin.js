import { Router } from 'express';
import { verifyJWT, requireAdmin } from '../auth.js';
import { CheckinSession, KnowledgeEntry } from '../models/index.js';
import { generarPreguntas } from '../services/checkinService.js';

const router = Router();
router.use(verifyJWT);

// GET today's check-in sessions for the current user
router.get('/hoy', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const sessions = await CheckinSession.findAll({
      where: { usuarioId: req.user.id, fecha: today }
    });
    res.json({ success: true, data: sessions });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// POST start a check-in for a specific function (generates questions via GPT)
router.post('/iniciar', async (req, res) => {
  try {
    const { funcion } = req.body;
    if (!funcion) {
      return res.status(400).json({ success: false, error: 'funcion requerida' });
    }

    const funciones = req.user.funciones || [];
    if (req.user.rol !== 'superadmin' && !funciones.includes(funcion)) {
      return res.status(403).json({ success: false, error: 'No tenés esa función asignada' });
    }

    const today = new Date().toISOString().split('T')[0];
    const existing = await CheckinSession.findOne({
      where: { usuarioId: req.user.id, funcion, fecha: today }
    });
    if (existing) return res.json({ success: true, data: existing });

    // Gather previous Q&A to avoid repetition
    const prevSessions = await CheckinSession.findAll({
      where: { usuarioId: req.user.id, funcion, completado: true }
    });
    const prevAnswers = prevSessions.flatMap(s =>
      s.preguntas.filter(p => p.respondida)
    );

    const questionTexts = await generarPreguntas(funcion, prevAnswers);
    const preguntas = questionTexts.map(q => ({ pregunta: q, respuesta: '', respondida: false }));

    const session = await CheckinSession.create({
      usuarioId: req.user.id,
      funcion,
      fecha: today,
      preguntas
    });

    res.status(201).json({ success: true, data: session });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// POST submit answers for a check-in session
router.post('/:id/responder', async (req, res) => {
  try {
    const { respuestas } = req.body; // string[]
    if (!Array.isArray(respuestas)) {
      return res.status(400).json({ success: false, error: 'respuestas debe ser un array' });
    }

    const session = await CheckinSession.findOne({
      where: { id: req.params.id, usuarioId: req.user.id }
    });
    if (!session) return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
    if (session.completado) {
      return res.status(400).json({ success: false, error: 'Este check-in ya fue completado' });
    }

    const updatedPreguntas = session.preguntas.map((p, i) => ({
      ...p,
      respuesta: respuestas[i]?.trim() || p.respuesta,
      respondida: !!(respuestas[i]?.trim())
    }));

    // Persist each answered Q&A as a KnowledgeEntry
    const knowledgeCreates = updatedPreguntas
      .filter(p => p.respondida)
      .map(p =>
        KnowledgeEntry.create({
          organizacionId: req.user.organizacionId,
          funcion: session.funcion,
          categoria: 'checkin',
          titulo: p.pregunta,
          contenido: p.respuesta,
          esSensible: false,
          usuarioId: req.user.id
        })
      );

    await Promise.all(knowledgeCreates);
    await session.update({ preguntas: updatedPreguntas, completado: true });

    res.json({ success: true, data: session });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// GET knowledge progress per function for the org (admin+ only)
router.get('/progreso', requireAdmin, async (req, res) => {
  try {
    const entries = await KnowledgeEntry.findAll({
      where: { organizacionId: req.user.organizacionId, categoria: 'checkin' },
      attributes: ['funcion']
    });

    const progress = {};
    for (const e of entries) {
      progress[e.funcion] = (progress[e.funcion] || 0) + 1;
    }

    res.json({ success: true, data: progress });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

export default router;
