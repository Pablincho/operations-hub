import { Router } from 'express';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { verifyJWT, requireAdmin } from '../auth.js';
import { Usuario, Organizacion } from '../models/index.js';
import { sendBienvenidaEmail } from '../services/emailService.js';

const router = Router();
router.use(verifyJWT);

function isValidEmail(email = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(password = '') {
  if (typeof password !== 'string') return 'Contraseña inválida';
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe incluir al menos 1 mayúscula';
  if (!/[a-z]/.test(password)) return 'La contraseña debe incluir al menos 1 minúscula';
  if (!/[0-9]/.test(password)) return 'La contraseña debe incluir al menos 1 número';
  return null;
}

function getDefaultUserPassword() {
  const fromEnv = (process.env.DEFAULT_USER_PASSWORD || '').trim();
  if (fromEnv) return fromEnv;

  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const envPath = path.resolve(__dirname, '../../../.env');
    const envText = fs.readFileSync(envPath, 'utf8');

    const lines = envText.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = (rawLine || '').trim();
      if (!line || line.startsWith('#') || !line.includes('=')) continue;

      const eqIndex = line.indexOf('=');
      const rawKey = line.slice(0, eqIndex);
      const key = rawKey.replace(/[^A-Za-z0-9_]/g, '');
      if (key !== 'DEFAULT_USER_PASSWORD') continue;

      const value = line.slice(eqIndex + 1).trim();
      if (value) return value;
    }
  } catch {
    // ignore and return fallback
  }

  return 'Bienvenido123';
}

// GET all users of the org + primaryOccupants config
router.get('/', requireAdmin, async (req, res) => {
  try {
    const [usuarios, org] = await Promise.all([
      Usuario.findAll({
        where: { organizacionId: req.user.organizacionId },
        attributes: { exclude: ['passwordHash', 'resetTokenHash', 'resetTokenExpiresAt'] },
        order: [['createdAt', 'ASC']]
      }),
      Organizacion.findByPk(req.user.organizacionId, { attributes: ['config'] })
    ]);
    res.json({
      success: true,
      data: usuarios,
      meta: { primaryOccupants: org?.config?.primaryOccupants || {} }
    });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// GET default temporary password configured in backend env
router.get('/default-password', requireAdmin, async (_req, res) => {
  try {
    res.json({
      success: true,
      data: { defaultPassword: getDefaultUserPassword() }
    });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// POST create user (admin+ only; only superadmin can assign admin/superadmin roles)
router.post('/', requireAdmin, async (req, res) => {
  try {
    const { email, password, nombre, rol, funciones } = req.body;
    const normalizedEmail = (email || '').toLowerCase().trim();
    const defaultPassword = getDefaultUserPassword();
    const tempPassword = (password && password.trim()) ? password.trim() : defaultPassword;

    if (!normalizedEmail || !nombre) {
      return res.status(400).json({ success: false, error: 'Campos requeridos: email, nombre' });
    }
    if (!isValidEmail(normalizedEmail)) {
      return res.status(400).json({ success: false, error: 'Email inválido' });
    }
    const pwError = validatePassword(tempPassword);
    if (pwError) {
      return res.status(400).json({ success: false, error: pwError });
    }

    const targetRol = rol || 'operativo';
    if (['superadmin', 'admin'].includes(targetRol) && req.user.rol !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'Solo el superadmin puede crear roles elevados' });
    }

    const existing = await Usuario.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Ya existe un usuario con ese email' });
    }

    const passwordHash = await bcrypt.hash(tempPassword, 12);
    const usuario = await Usuario.create({
      email: normalizedEmail,
      passwordHash,
      mustChangePassword: true,
      nombre,
      rol: targetRol,
      funciones: funciones || [],
      organizacionId: req.user.organizacionId
    });

    const { passwordHash: _, ...data } = usuario.toJSON();

    try {
      await sendBienvenidaEmail(normalizedEmail, nombre, tempPassword);
    } catch (emailErr) {
      console.error('Error enviando email de bienvenida:', emailErr.message);
    }

    res.status(201).json({
      success: true,
      data,
      meta: {
        temporaryPassword: tempPassword,
        mustChangePassword: true
      }
    });
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

// PATCH toggle vacaciones
router.patch('/:id/vacaciones', requireAdmin, async (req, res) => {
  try {
    const { enVacaciones } = req.body;
    if (typeof enVacaciones !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enVacaciones debe ser booleano' });
    }
    const usuario = await Usuario.findOne({
      where: { id: req.params.id, organizacionId: req.user.organizacionId }
    });
    if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    await usuario.update({ enVacaciones });
    res.json({ success: true, data: { enVacaciones } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// PATCH change password
router.patch('/:id/password', requireAdmin, async (req, res) => {
  try {
    const { password } = req.body;
    const normalizedPassword = (password || '').trim();
    const pwError = validatePassword(normalizedPassword);
    if (pwError) {
      return res.status(400).json({ success: false, error: pwError });
    }

    const usuario = await Usuario.findOne({
      where: { id: req.params.id, organizacionId: req.user.organizacionId }
    });
    if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

    if (['admin', 'superadmin'].includes(usuario.rol) && req.user.rol !== 'superadmin') {
      return res.status(403).json({ success: false, error: 'No podés modificar usuarios con rol elevado' });
    }

    const passwordHash = await bcrypt.hash(normalizedPassword, 12);
    await usuario.update({ passwordHash, mustChangePassword: true });
    res.json({
      success: true,
      data: { message: 'Contraseña temporal actualizada. El usuario deberá cambiarla al ingresar.' }
    });
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

// PATCH set primary occupant for a function (admin+)
router.patch('/funciones/:funcion/principal', requireAdmin, async (req, res) => {
  try {
    const { funcion } = req.params;
    const { usuarioId } = req.body;

    if (usuarioId) {
      const usuario = await Usuario.findOne({
        where: { id: usuarioId, organizacionId: req.user.organizacionId }
      });
      if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
      if (!(usuario.funciones || []).includes(funcion)) {
        return res.status(400).json({ success: false, error: 'El usuario no tiene esa función asignada' });
      }
    }

    const org = await Organizacion.findByPk(req.user.organizacionId);
    const config = org.config || {};
    const primaryOccupants = { ...(config.primaryOccupants || {}) };
    if (usuarioId) {
      primaryOccupants[funcion] = usuarioId;
    } else {
      delete primaryOccupants[funcion];
    }
    await org.update({ config: { ...config, primaryOccupants } });

    res.json({ success: true, data: { funcion, primaryOccupantId: usuarioId || null } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// PATCH assign supervisor (or mark self-approval for occupants with no reviewer, e.g. Gerente General)
router.patch('/:id/supervisor', requireAdmin, async (req, res) => {
  try {
    const { supervisorId, autoaprobarManual } = req.body;

    if (supervisorId === req.params.id) {
      return res.status(400).json({ success: false, error: 'Un usuario no puede ser su propio supervisor' });
    }

    const usuario = await Usuario.findOne({
      where: { id: req.params.id, organizacionId: req.user.organizacionId }
    });
    if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

    if (autoaprobarManual) {
      if (supervisorId) {
        return res.status(400).json({ success: false, error: 'No podés asignar supervisor y autoaprobación al mismo tiempo' });
      }
      await usuario.update({ supervisorId: null, autoaprobarManual: true });
      return res.json({ success: true, data: { supervisorId: null, autoaprobarManual: true } });
    }

    if (supervisorId) {
      const supervisor = await Usuario.findOne({
        where: { id: supervisorId, organizacionId: req.user.organizacionId }
      });
      if (!supervisor) return res.status(404).json({ success: false, error: 'Supervisor no encontrado' });
    }

    await usuario.update({ supervisorId: supervisorId || null, autoaprobarManual: false });
    res.json({ success: true, data: { supervisorId: usuario.supervisorId, autoaprobarManual: false } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

export default router;
