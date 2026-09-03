import { Router } from 'express';
import { verifyJWT, requireAdmin } from '../auth.js';
import { addCatalogFunction, getFunctionCatalog, updateCatalogFunction } from '../services/functionCatalogService.js';

const router = Router();
router.use(verifyJWT);

router.get('/funciones', async (req, res) => {
  try {
    const catalog = await getFunctionCatalog(req.user.organizacionId, {
      includeInactive: ['admin', 'superadmin'].includes(req.user.rol)
    });
    res.json({ success: true, data: catalog });
  } catch (error) {
    console.error('[organizacion] Error cargando catálogo:', error.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.post('/funciones', requireAdmin, async (req, res) => {
  try {
    const entry = await addCatalogFunction(req.user.organizacionId, req.body.nombre);
    res.status(201).json({ success: true, data: entry });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Error interno' });
  }
});

router.patch('/funciones/:nombre', requireAdmin, async (req, res) => {
  try {
    const entry = await updateCatalogFunction(req.user.organizacionId, req.params.nombre, req.body);
    res.json({ success: true, data: entry });
  } catch (error) {
    console.error('[organizacion] Error actualizando puesto:', error.message);
    res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Error interno' });
  }
});

export default router;
