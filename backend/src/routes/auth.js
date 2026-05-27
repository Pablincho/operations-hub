import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Usuario, Organizacion } from '../models/index.js';
import { verifyJWT } from '../auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email y contraseña requeridos' });
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
