import jwt from 'jsonwebtoken';
import { Usuario } from './models/index.js';

export * from './authHelpers.js';

export async function verifyJWT(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token requerido' });
  }

  let payload;
  try {
    payload = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
  }

  try {
    const usuario = await Usuario.findOne({
      where: { id: payload.id, activo: true },
      // Se traen todas las columnas no sensibles: es el mismo viaje a la base y le
      // permite a /auth/me responder con req.user en lugar de repetir la consulta.
      attributes: { exclude: ['passwordHash', 'resetTokenHash', 'resetTokenExpiresAt'] }
    });
    if (!usuario) {
      return res.status(401).json({ success: false, error: 'Usuario inactivo o inexistente' });
    }
    req.user = usuario.toJSON();
    next();
  } catch (err) {
    console.error('[verifyJWT] Error consultando usuario:', err.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
}
