import { Router } from 'express';
import { Sequelize } from 'sequelize';
import { verifyJWT, requireAdmin } from '../auth.js';
import { CheckinSession, KnowledgeEntry } from '../models/index.js';
import { generarPreguntas, INITIAL_QUESTIONS } from '../services/checkinService.js';

const router = Router();
router.use(verifyJWT);

// GET today's check-in sessions + onboarding status per function
router.get('/hoy', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const [todaySessions, allCompleted, entryRows] = await Promise.all([
      CheckinSession.findAll({ where: { usuarioId: req.user.id, fecha: today } }),
      CheckinSession.findAll({ where: { usuarioId: req.user.id, completado: true } }),
      KnowledgeEntry.findAll({
        where: { usuarioId: req.user.id, organizacionId: req.user.organizacionId, categoria: 'checkin' },
        attributes: ['funcion', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
        group: ['funcion'],
        raw: true
      })
    ]);

    // Build onboarding status: a function has onboarding complete if it has ≥1 completed session with 10 questions
    const onboardingStatus = {};
    const dailyCounts = {};
    for (const s of allCompleted) {
      if (s.preguntas.length === 10) {
        onboardingStatus[s.funcion] = true;
      } else if (s.preguntas.length === 3) {
        dailyCounts[s.funcion] = (dailyCounts[s.funcion] || 0) + 1;
      }
    }

    const entryCounts = {};
    for (const row of entryRows) {
      entryCounts[row.funcion] = parseInt(row.count, 10);
    }

    res.json({ success: true, data: todaySessions, onboardingStatus, dailyCounts, entryCounts });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// POST start a check-in for a specific function
// Phase 1 (onboarding): 10 fixed initial questions — asked once per function
// Phase 2 (daily): 3 AI-adapted questions per day, up to 20 days
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

    // Find all completed sessions for this function
    const prevSessions = await CheckinSession.findAll({
      where: { usuarioId: req.user.id, funcion, completado: true }
    });

    // Check if onboarding (10 questions) was already completed
    const onboardingDone = prevSessions.some(s => s.preguntas.length === 10);

    let preguntas;
    if (!onboardingDone) {
      // Phase 1: return 10 fixed initial questions tagged by bloque
      const initialQs = INITIAL_QUESTIONS[funcion] || [];
      preguntas = initialQs.map(q => ({ pregunta: q.pregunta, bloque: q.bloque, respuesta: '', respondida: false }));
    } else {
      // Phase 2: max 20 daily check-ins per function
      const dailyCompleted = prevSessions.filter(s => s.preguntas.length === 3).length;
      if (dailyCompleted >= 20) {
        return res.status(400).json({ success: false, error: 'Ya completaste los 20 días de check-in para esta función' });
      }
      // Generate 3 AI-adapted questions tagged by bloque
      const prevAnswers = prevSessions.flatMap(s => s.preguntas.filter(p => p.respondida));
      const questionObjs = await generarPreguntas(funcion, prevAnswers);
      preguntas = questionObjs.map(q => ({
        pregunta: q.pregunta || q,
        bloque: q.bloque || null,
        respuesta: '',
        respondida: false
      }));
    }

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
          bloque: p.bloque || null,
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
