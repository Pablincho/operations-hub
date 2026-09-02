import { Router } from 'express';
import { verifyJWT, requireAdmin } from '../auth.js';
import { BugReport, Usuario } from '../models/index.js';

const router = Router();
router.use(verifyJWT);

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

// El frontend deja adjuntar cualquier image/* (selector de archivo y pegado desde
// portapapeles), sin reconversión de formato: la validación acá tiene que aceptar
// lo mismo, no una lista fija de formatos, para no rechazar capturas legítimas
// (GIF, HEIC de celulares, etc).
function imageBytes(dataUrl) {
  const match = /^data:image\/[a-zA-Z0-9.+-]+;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!match) return null;
  return Buffer.from(match[1], 'base64').byteLength;
}

// POST report a bug: all authenticated users
router.post('/', async (req, res) => {
  try {
    const { texto, pagina, imagen, tipo } = req.body;
    if (!texto?.trim()) {
      return res.status(400).json({ success: false, error: 'El texto es requerido' });
    }
    const bytes = imagen ? imageBytes(imagen) : 0;
    if (imagen && bytes === null) {
      return res.status(400).json({ success: false, error: 'Formato de imagen inválido' });
    }
    if (bytes > MAX_IMAGE_BYTES) {
      return res.status(400).json({ success: false, error: 'La imagen es demasiado grande (máx. 5 MB)' });
    }
    const bug = await BugReport.create({
      usuarioId: req.user.id,
      organizacionId: req.user.organizacionId,
      tipo: ['bug', 'mejora'].includes(tipo) ? tipo : 'bug',
      texto: texto.trim(),
      pagina: pagina || null,
      imagen: imagen || null
    });
    res.status(201).json({ success: true, data: bug });
  } catch (err) {
    console.error('[bugs] POST error:', err.message, err.stack);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// GET all bug reports: admin+
router.get('/', requireAdmin, async (req, res) => {
  try {
    const bugs = await BugReport.findAll({
      where: { organizacionId: req.user.organizacionId },
      order: [['createdAt', 'DESC']],
      include: [{ model: Usuario, attributes: ['nombre', 'email'] }]
    });
    res.json({ success: true, data: bugs });
  } catch (err) {
    console.error('GET /bugs error:', err.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// PATCH toggle resolved: admin+
router.patch('/:id/resolver', requireAdmin, async (req, res) => {
  try {
    const bug = await BugReport.findOne({
      where: { id: req.params.id, organizacionId: req.user.organizacionId }
    });
    if (!bug) return res.status(404).json({ success: false, error: 'Reporte no encontrado' });
    await bug.update({ resuelto: !bug.resuelto });
    res.json({ success: true, data: { resuelto: bug.resuelto } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// DELETE bug report: admin+
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const bug = await BugReport.findOne({
      where: { id: req.params.id, organizacionId: req.user.organizacionId }
    });
    if (!bug) return res.status(404).json({ success: false, error: 'Reporte no encontrado' });
    await bug.destroy();
    res.json({ success: true });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

export default router;
