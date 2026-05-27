import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { verifyJWT, requireAdmin, requireSuperAdmin } from '../auth.js';
import { Usuario } from '../models/index.js';

const router = Router();
router.use(verifyJWT);

// GET all users of the org
router.get('/', requireAdmin, async (req, res) => {
  try {
    const usuarios = await Usuario.findAll({
      where: { organizacionId: req.user.organizacionId },
      attributes: { exclude: ['passwordHash'] },
      order: [['createdAt', 'ASC']]
    });
    res.json({ success: true, data: usuarios });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// POST create user (admin+ only; only superadmin can assign admin/superadmin roles)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { email, password, nombre, rol, funciones } = req.body;

    if (!email || !password || !nombre) {
      return res.status(400).json({ success: false, error: 'Campos requeridos: email, password, nombre' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const targetRol = rol || 'operativo';
    if (['superadmin', 'admin'].includes(targetRol) && req.user.rol !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Solo el superadmin puede crear roles elevados' });
    }

    const existing = await Usuario.findOne({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Ya existe un usuario con ese email' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const usuario = await Usuario.create({
      email: email.toLowerCase().trim(),
      passwordHash,
      nombre,
      rol: targetRol,
      funciones: funciones || [],
      organizacionId: req.user.organizacionId
    });

    const { passwordHash: _, ...data } = usuario.toJSON();
    res.status(201).json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// PATCH update functions of a user
router.patch('/:id/funciones', requireAdmin, async (req, res) => {
  try {
    const { funciones } = req.body;
    if (!Array.isArray(funciones)) {
      return res.status(400).json({ success: false, error: 'funciones debe ser un array' });
    }

    const usuario = await Usuario.findOne({
      where: { id: req.params.id, organizacionId: req.user.organizacionId }
    });
    if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

    // Only superadmin can modify admin/superadmin users
    if (['admin', 'superadmin'].includes(usuario.rol) && req.user.rol !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'No podés modificar usuarios con rol elevado' });
    }

    await usuario.update({ funciones });
    const { passwordHash: _, ...data } = usuario.toJSON();
    res.json({ success: true, data });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// PATCH toggle active
router.patch('/:id/activo', requireAdmin, async (req, res) => {
  try {
    const { activo } = req.body;

    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, error: 'No podés desactivarte a vos mismo' });
    }

    const usuario = await Usuario.findOne({
      where: { id: req.params.id, organizacionId: req.user.organizacionId }
    });
    if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

    if (['admin', 'superadmin'].includes(usuario.rol) && req.user.rol !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'No podés modificar usuarios con rol elevado' });
    }

    await usuario.update({ activo });
    res.json({ success: true, data: { activo } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// PATCH change password
router.patch('/:id/password', requireAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, error: 'Contraseña mínima 6 caracteres' });
    }

    const usuario = await Usuario.findOne({
      where: { id: req.params.id, organizacionId: req.user.organizacionId }
    });
    if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

    if (['admin', 'superadmin'].includes(usuario.rol) && req.user.rol !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'No podés modificar usuarios con rol elevado' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await usuario.update({ passwordHash });
    res.json({ success: true, data: { message: 'Contraseña actualizada' } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// DELETE user
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, error: 'No podés eliminarte a vos mismo' });
    }

    const usuario = await Usuario.findOne({
      where: { id: req.params.id, organizacionId: req.user.organizacionId }
    });
    if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

    if (usuario.rol === 'superadmin') {
      return res.status(403).json({ success: false, error: 'No se puede eliminar al superadmin' });
    }
    if (usuario.rol === 'admin' && req.user.rol !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Solo el superadmin puede eliminar admins' });
    }

    await usuario.destroy();
    res.json({ success: true, data: { message: 'Usuario eliminado' } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

export default router;
