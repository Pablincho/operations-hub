import { Router } from 'express';
import { Op } from 'sequelize';
import { verifyJWT } from '../auth.js';
import { ChatSession, ChatMessage, KnowledgeEntry, Manual } from '../models/index.js';
import { llamarAsistente } from '../services/openaiService.js';

const router = Router();
router.use(verifyJWT);

// GET all sessions for the user (for history list)
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await ChatSession.findAll({
      where: { usuarioId: req.user.id },
      order: [['updatedAt', 'DESC']],
      limit: 30
    });

    const counts = await ChatMessage.findAll({
      where: { chatSessionId: sessions.map(s => s.id) },
      attributes: ['chatSessionId', [ChatMessage.sequelize.fn('COUNT', ChatMessage.sequelize.col('id')), 'count']],
      group: ['chatSessionId'],
      raw: true
    });

    const countMap = {};
    for (const c of counts) countMap[c.chatSessionId] = parseInt(c.count, 10);

    const data = sessions.map(s => ({ ...s.toJSON(), messageCount: countMap[s.id] || 0 }));
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// GET current session + last 20 messages
router.get('/session', async (req, res) => {
  try {
    let session = await ChatSession.findOne({
      where: { usuarioId: req.user.id },
      order: [['createdAt', 'DESC']]
    });
    if (!session) {
      session = await ChatSession.create({ usuarioId: req.user.id });
    }

    const messages = await ChatMessage.findAll({
      where: { chatSessionId: session.id },
      order: [['createdAt', 'ASC']],
      limit: 20
    });

    res.json({ success: true, data: { session, messages } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// GET a specific session by id
router.get('/session/:id', async (req, res) => {
  try {
    const session = await ChatSession.findOne({ where: { id: req.params.id, usuarioId: req.user.id } });
    if (!session) return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
    const messages = await ChatMessage.findAll({
      where: { chatSessionId: session.id },
      order: [['createdAt', 'ASC']],
      limit: 20
    });
    res.json({ success: true, data: { session, messages } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// PATCH rename session
router.patch('/session/:id', async (req, res) => {
  try {
    const { nombre } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ success: false, error: 'Nombre requerido' });
    const session = await ChatSession.findOne({ where: { id: req.params.id, usuarioId: req.user.id } });
    if (!session) return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
    await session.update({ nombre: nombre.trim().slice(0, 100) });
    res.json({ success: true, data: session });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// POST create new session (clear chat)
router.post('/session', async (req, res) => {
  try {
    const session = await ChatSession.create({ usuarioId: req.user.id });
    res.json({ success: true, data: { session, messages: [] } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// PATCH feedback on a message (up/down)
router.patch('/mensaje/:id/feedback', async (req, res) => {
  try {
    const { feedback } = req.body;
    if (!['up', 'down', null].includes(feedback)) {
      return res.status(400).json({ success: false, error: 'feedback debe ser up, down o null' });
    }
    const mensaje = await ChatMessage.findByPk(req.params.id);
    if (!mensaje) return res.status(404).json({ success: false, error: 'Mensaje no encontrado' });

    const session = await ChatSession.findOne({ where: { id: mensaje.chatSessionId, usuarioId: req.user.id } });
    if (!session) return res.status(403).json({ success: false, error: 'Sin permiso' });

    await mensaje.update({ feedback });
    res.json({ success: true, data: mensaje });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// POST send message
router.post('/mensaje', async (req, res) => {
  try {
    const { mensaje, sessionId } = req.body;
    if (!mensaje?.trim()) {
      return res.status(400).json({ success: false, error: 'Mensaje vacío' });
    }

    // Resolve session
    let session = null;
    if (sessionId) {
      session = await ChatSession.findOne({
        where: { id: sessionId, usuarioId: req.user.id }
      });
    }
    if (!session) {
      session = await ChatSession.create({ usuarioId: req.user.id });
    }

    // Save user message
    await ChatMessage.create({ chatSessionId: session.id, rol: 'user', contenido: mensaje.trim() });

    // Fetch last 20 messages for context (includes the just-saved one)
    const history = await ChatMessage.findAll({
      where: { chatSessionId: session.id },
      order: [['createdAt', 'ASC']],
      limit: 20
    });

    // Fetch vigente manuals as primary context
    // Manual is per function (org-wide), filtered by user's assigned functions if any
    const userFunciones = req.user.funciones || [];
    const manualesWhere = userFunciones.length > 0
      ? { organizacionId: req.user.organizacionId, funcion: { [Op.in]: userFunciones }, estado: 'vigente' }
      : { organizacionId: req.user.organizacionId, estado: 'vigente' };

    const manuales = await Manual.findAll({
      where: manualesWhere,
      attributes: ['funcion', 'version', 'contenido']
    });

    // Fallback entries: all org entries for assigned functions without a vigente manual
    const funcionesConManual = new Set(manuales.map(m => m.funcion));
    const fnsParaEntries = userFunciones.filter(f => !funcionesConManual.has(f));

    let fallbackEntries = [];
    if (fnsParaEntries.length > 0) {
      fallbackEntries = await KnowledgeEntry.findAll({
        where: {
          organizacionId: req.user.organizacionId,
          funcion: { [Op.in]: fnsParaEntries },
          categoria: 'checkin',
          esSensible: false
        }
      });
    }

    // Sensitive entries: superadmin sees all; operativo sees their own functions; admin sees none
    let sensibleEntries = [];
    if (req.user.rol === 'superadmin') {
      sensibleEntries = await KnowledgeEntry.findAll({
        where: { organizacionId: req.user.organizacionId, esSensible: true }
      });
    } else if (req.user.rol === 'operativo' && userFunciones.length > 0) {
      sensibleEntries = await KnowledgeEntry.findAll({
        where: {
          organizacionId: req.user.organizacionId,
          funcion: { [Op.in]: userFunciones },
          esSensible: true
        }
      });
    }

    const { reply, usedSensitive } = await llamarAsistente(req.user, manuales, fallbackEntries, sensibleEntries, history, mensaje.trim());

    let assistantMsg = null;
    if (!usedSensitive) {
      assistantMsg = await ChatMessage.create({
        chatSessionId: session.id,
        rol: 'assistant',
        contenido: reply
      });
    }

    res.json({ success: true, data: { sessionId: session.id, mensaje: assistantMsg, reply, efimero: usedSensitive } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

export default router;
