import jwt from 'jsonwebtoken';

export function verifyJWT(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Token requerido' });
  }
  try {
    req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
  }
}

export function requireAdmin(req, res, next) {
  if (!['admin', 'superadmin'].includes(req.user.rol)) {
    return res.status(403).json({ success: false, error: 'Se requiere rol admin' });
  }
  next();
}

export function requireSuperAdmin(req, res, next) {
  if (req.user.rol !== 'superadmin') {
    return res.status(403).json({ success: false, error: 'Acción reservada para superadmin' });
  }
  next();
}

export function requireFuncion(funcion) {
  return (req, res, next) => {
    if (req.user.rol === 'superadmin') return next();
    if (!req.user.funciones?.includes(funcion)) {
      return res.status(403).json({ success: false, error: `No tenés acceso a la función ${funcion}` });
    }
    next();
  };
}
