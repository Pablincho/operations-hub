// Funciones puras de autorización, sin dependencias de modelos/DB, para que
// puedan importarse (y testearse) sin necesitar DATABASE_URL configurado.

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

export function canAccessFuncion(user, funcion) {
  if (['admin', 'superadmin'].includes(user.rol)) return true;
  return user.funciones?.includes(funcion) ?? false;
}
