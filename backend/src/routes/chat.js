import { Router } from 'express';
import { Op } from 'sequelize';
import { verifyJWT } from '../auth.js';
import { ChatSession, ChatMessage, KnowledgeEntry } from '../models/index.js';
import { llamarAsistente } from '../services/openaiService.js';

const router = Router();
router.use(verifyJWT);

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

// POST create new session (clear chat)
router.post('/session', async (req, res) => {
  try {
    const session = await ChatSession.create({ usuarioId: req.user.id });
    res.json({ success: true, data: { session, messages: [] } });
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

    // Build knowledge base context filtered by role
    const where = { organizacionId: req.user.organizacionId };

    if (req.user.rol === 'superadmin') {
      // sees all entries including sensitive
    } else if (req.user.rol === 'admin') {
      where.esSensible = false;
    } else {
      // operativo: only their functions
      const fns = req.user.funciones || [];
      where.funcion = fns.length > 0 ? { [Op.in]: fns } : { [Op.in]: ['__none__'] };
      // sensitive entries are included since they're filtered to their functions
    }

    const knowledgeEntries = await KnowledgeEntry.findAll({ where });

    const reply = await llamarAsistente(req.user, knowledgeEntries, history, mensaje.trim());

    const assistantMsg = await ChatMessage.create({
      chatSessionId: session.id,
      rol: 'assistant',
      contenido: reply
    });

    res.json({ success: true, data: { sessionId: session.id, mensaje: assistantMsg } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

export default router;
