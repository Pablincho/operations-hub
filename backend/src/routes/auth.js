import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomInt } from 'crypto';
import { Usuario } from '../models/index.js';
import { verifyJWT } from '../auth.js';

const router = Router();

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

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email y contraseña requeridos' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Email inválido' });
    }

    const usuario = await Usuario.findOne({
      where: { email: email.toLowerCase().trim(), activo: true }
    });
    if (!usuario) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const valid = await bcrypt.compare(password, usuario.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    if (usuario.mustChangePassword) {
      const setupToken = jwt.sign(
        { uid: usuario.id, purpose: 'first_password' },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );

      return res.json({
        success: true,
        data: {
          requiresPasswordSetup: true,
          setupToken,
          email: usuario.email
        }
      });
    }

    const payload = {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      funciones: usuario.funciones,
      organizacionId: usuario.organizacionId
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    res.json({
      success: true,
      data: { token, usuario: payload }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.post('/first-password', async (req, res) => {
  try {
    const { setupToken, password } = req.body;
    if (!setupToken || !password) {
      return res.status(400).json({ success: false, error: 'Token y contraseña requeridos' });
    }

    const pwError = validatePassword(password);
    if (pwError) {
      return res.status(400).json({ success: false, error: pwError });
    }

    let decoded;
    try {
      decoded = jwt.verify(setupToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ success: false, error: 'Token inválido o vencido' });
    }

    if (decoded.purpose !== 'first_password' || !decoded.uid) {
      return res.status(401).json({ success: false, error: 'Token inválido' });
    }

    const usuario = await Usuario.findOne({ where: { id: decoded.uid, activo: true } });
    if (!usuario) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await usuario.update({ passwordHash, mustChangePassword: false });

    const payload = {
      id: usuario.id,
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol,
      funciones: usuario.funciones,
      organizacionId: usuario.organizacionId
    };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });

    res.json({ success: true, data: { token, usuario: payload } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.post('/recover/request', async (req, res) => {
  try {
    const email = (req.body?.email || '').toLowerCase().trim();
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Email inválido' });
    }

    const usuario = await Usuario.findOne({ where: { email, activo: true } });

    let recoveryCode;
    if (usuario) {
      recoveryCode = String(randomInt(100000, 999999));
      const resetTokenHash = await bcrypt.hash(recoveryCode, 10);
      const resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
      await usuario.update({ resetTokenHash, resetTokenExpiresAt });
      console.log(`[RECOVERY] Codigo para ${email}: ${recoveryCode}`);
    }

    res.json({
      success: true,
      data: {
        message: 'Si el email existe, se generó un código de recuperación válido por 15 minutos.',
        recoveryCode: process.env.NODE_ENV !== 'production' ? recoveryCode : undefined
      }
    });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.post('/recover/reset', async (req, res) => {
  try {
    const email = (req.body?.email || '').toLowerCase().trim();
    const code = (req.body?.code || '').trim();
    const password = req.body?.password || '';

    if (!email || !code || !password) {
      return res.status(400).json({ success: false, error: 'Email, código y contraseña requeridos' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ success: false, error: 'Email inválido' });
    }

    const pwError = validatePassword(password);
    if (pwError) {
      return res.status(400).json({ success: false, error: pwError });
    }

    const usuario = await Usuario.findOne({ where: { email, activo: true } });
    if (!usuario || !usuario.resetTokenHash || !usuario.resetTokenExpiresAt) {
      return res.status(400).json({ success: false, error: 'Código inválido o vencido' });
    }

    if (new Date(usuario.resetTokenExpiresAt).getTime() < Date.now()) {
      return res.status(400).json({ success: false, error: 'Código inválido o vencido' });
    }

    const validCode = await bcrypt.compare(code, usuario.resetTokenHash);
    if (!validCode) {
      return res.status(400).json({ success: false, error: 'Código inválido o vencido' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await usuario.update({
      passwordHash,
      mustChangePassword: false,
      resetTokenHash: null,
      resetTokenExpiresAt: null
    });

    res.json({ success: true, data: { message: 'Contraseña actualizada. Ya podés iniciar sesión.' } });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

// GET current user (fresh from DB — used to refresh funciones after admin changes)
router.get('/me', verifyJWT, async (req, res) => {
  try {
    const usuario = await Usuario.findByPk(req.user.id, {
      attributes: { exclude: ['passwordHash'] }
    });
    if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    res.json({ success: true, data: usuario });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

export default router;
