import { Router } from 'express';
import { Op, fn, col } from 'sequelize';
import { verifyJWT, canAccessFuncion } from '../auth.js';
import {
  Manual,
  KnowledgeEntry,
  ManualAgentRun,
  ManualCycle,
  ManualQuestion,
  Usuario
} from '../models/index.js';
import { getPrimaryOccupant, userCanManageCycle } from '../services/positionService.js';
import { planificarPreguntasCiclo, recuperarCicloAtascado } from '../services/manualAgentService.js';

const router = Router();
router.use(verifyJWT);

export const TOPIC_OPTIONS = [
  'Funciones y responsabilidades',
  'Procesos críticos',
  'Excepciones e imprevistos',
  'Controles y riesgos',
  'Relaciones con otras áreas',
  'Proveedores y organismos externos',
  'Herramientas y sistemas',
  'Conocimientos difíciles de transferir',
  'Estacionalidad y calendario',
  'Mejoras y oportunidades de automatización'
];

function intInRange(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function sanitizeConfig(body, base = {}) {
  const frecuencia = ['diaria', 'semanal', 'manual'].includes(body.frecuencia)
    ? body.frecuencia
    : (base.frecuencia || 'diaria');
  const temas = Array.isArray(body.temas)
    ? [...new Set(body.temas.map(value => String(value).trim()).filter(Boolean))].slice(0, 20)
    : (base.temas || []);
  const objetivoRaw = body.objetivoPreguntas === undefined
    ? base.objetivoPreguntas ?? null
    : (body.objetivoPreguntas === '' || body.objetivoPreguntas === null
      ? null
      : intInRange(body.objetivoPreguntas, base.objetivoPreguntas ?? null, 1, 1000));
  return {
    temas,
    orientacion: body.orientacion === undefined ? (base.orientacion || null) : String(body.orientacion).trim().slice(0, 5000) || null,
    heredarOrientacion: body.heredarOrientacion === undefined ? (base.heredarOrientacion ?? true) : !!body.heredarOrientacion,
    preguntasPorEntrega: intInRange(body.preguntasPorEntrega, base.preguntasPorEntrega || 3, 1, 10),
    frecuencia,
    intervaloDias: intInRange(body.intervaloDias, base.intervaloDias || 1, 1, 30),
    objetivoPreguntas: objetivoRaw,
    requiereAprobacionPreguntas: body.requiereAprobacionPreguntas === undefined
      ? (base.requiereAprobacionPreguntas ?? false)
      : !!body.requiereAprobacionPreguntas
  };
}

async function cycleSummary(cycle) {
  const [questionRows, answered, manual] = await Promise.all([
    ManualQuestion.findAll({
      where: { cicloId: cycle.id },
      attributes: ['estado', [fn('COUNT', col('id')), 'cantidad']],
      group: ['estado'], raw: true
    }),
    KnowledgeEntry.count({ where: { cicloId: cycle.id, categoria: 'checkin' } }),
    Manual.findOne({ where: { cicloId: cycle.id }, order: [['createdAt', 'DESC']], attributes: ['id', 'estado', 'version'] })
  ]);
  return {
    ...cycle.toJSON(),
    conteoPreguntas: Object.fromEntries(questionRows.map(row => [row.estado, Number(row.cantidad)])),
    respuestasCiclo: answered,
    manual: manual?.toJSON() || null
  };
}

async function managedCycle(req, res) {
  const cycle = await ManualCycle.findOne({ where: { id: req.params.id, organizacionId: req.user.organizacionId } });
  if (!cycle) {
    res.status(404).json({ success: false, error: 'Ciclo no encontrado' });
    return null;
  }
  await recuperarCicloAtascado(cycle);
  if (!userCanManageCycle(req.user, cycle)) {
    const occupant = await Usuario.findByPk(cycle.ocupanteId, { attributes: ['id', 'supervisorId', 'autoaprobarManual'] });
    const currentlyAssigned = occupant?.supervisorId === req.user.id ||
      (occupant?.id === req.user.id && occupant?.autoaprobarManual);
    if (currentlyAssigned) await cycle.update({ supervisorId: req.user.id });
  }
  if (!userCanManageCycle(req.user, cycle)) {
    res.status(403).json({ success: false, error: 'Solo el supervisor asignado puede gestionar este ciclo' });
    return null;
  }
  return cycle;
}

router.get('/temas', (_req, res) => res.json({ success: true, data: TOPIC_OPTIONS }));

router.get('/puestos', async (req, res) => {
  try {
    const occupants = await Usuario.findAll({
      where: {
        organizacionId: req.user.organizacionId,
        activo: true,
        [Op.or]: [{ supervisorId: req.user.id }, { id: req.user.id, autoaprobarManual: true }]
      },
      attributes: ['id', 'nombre', 'funciones', 'autoaprobarManual']
    });
    const positions = [];
    for (const occupant of occupants) {
      for (const funcion of occupant.funciones || []) {
        const primary = await getPrimaryOccupant(req.user.organizacionId, funcion);
        if (primary?.id !== occupant.id) continue;
        const current = await ManualCycle.findOne({
          where: { organizacionId: req.user.organizacionId, funcion },
          order: [['numero', 'DESC']]
        });
        positions.push({ funcion, ocupante: occupant.toJSON(), ciclo: current ? await cycleSummary(current) : null });
      }
    }
    res.json({ success: true, data: positions });
  } catch (error) {
    console.error('[manual-cycles] Error listando puestos:', error.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { funcion } = req.query;
    if (funcion && !canAccessFuncion(req.user, funcion)) {
      const managed = await ManualCycle.findOne({ where: { organizacionId: req.user.organizacionId, funcion, supervisorId: req.user.id } });
      if (!managed) return res.status(403).json({ success: false, error: 'No tenés acceso a esa función' });
    }
    const where = { organizacionId: req.user.organizacionId };
    if (funcion) where.funcion = funcion;
    else if (!['admin', 'superadmin'].includes(req.user.rol)) {
      where[Op.or] = [{ ocupanteId: req.user.id }, { supervisorId: req.user.id }];
    }
    const cycles = await ManualCycle.findAll({ where, order: [['funcion', 'ASC'], ['numero', 'DESC']] });
    res.json({ success: true, data: await Promise.all(cycles.map(cycleSummary)) });
  } catch (error) {
    console.error('[manual-cycles] Error listando ciclos:', error.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.get('/:id/preguntas', async (req, res) => {
  try {
    const cycle = await ManualCycle.findOne({ where: { id: req.params.id, organizacionId: req.user.organizacionId } });
    if (!cycle) return res.status(404).json({ success: false, error: 'Ciclo no encontrado' });
    if (![cycle.ocupanteId, cycle.supervisorId].includes(req.user.id)) {
      return res.status(403).json({ success: false, error: 'Sin acceso al ciclo' });
    }
    const questions = await ManualQuestion.findAll({ where: { cicloId: cycle.id }, order: [['orden', 'ASC'], ['createdAt', 'ASC']] });
    res.json({ success: true, data: questions });
  } catch (error) {
    console.error('[manual-cycles] Error listando preguntas:', error.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.get('/:id/ejecuciones', async (req, res) => {
  try {
    const cycle = await managedCycle(req, res);
    if (!cycle) return;
    const runs = await ManualAgentRun.findAll({ where: { cicloId: cycle.id }, order: [['createdAt', 'DESC']] });
    res.json({ success: true, data: runs });
  } catch (error) {
    console.error('[manual-cycles] Error listando ejecuciones:', error.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.post('/', async (req, res) => {
  try {
    const funcion = String(req.body.funcion || '').trim();
    if (!funcion) return res.status(400).json({ success: false, error: 'funcion requerida' });
    const occupant = await getPrimaryOccupant(req.user.organizacionId, funcion);
    if (!occupant) return res.status(400).json({ success: false, error: 'Configurá primero el ocupante principal del puesto' });
    const isSelfManaged = occupant.id === req.user.id && occupant.autoaprobarManual;
    if (occupant.supervisorId !== req.user.id && !isSelfManaged) {
      return res.status(403).json({ success: false, error: 'Solo el supervisor asignado puede iniciar un ciclo' });
    }

    const latest = await ManualCycle.findOne({
      where: { organizacionId: req.user.organizacionId, funcion }, order: [['numero', 'DESC']]
    });
    if (latest && latest.estado !== 'completado') {
      return res.status(409).json({ success: false, error: `El ciclo ${latest.numero} todavía está abierto` });
    }
    const inherited = latest?.heredarOrientacion ? {
      ...latest.toJSON(),
      ...(latest.configProximoCiclo || {}),
      temas: latest.proximosTemas?.length ? latest.proximosTemas : latest.temas,
      orientacion: latest.proximaOrientacion || latest.orientacion
    } : {};
    const config = sanitizeConfig(req.body, inherited);
    const cycle = await ManualCycle.create({
      organizacionId: req.user.organizacionId,
      funcion,
      numero: (latest?.numero || 0) + 1,
      ocupanteId: occupant.id,
      supervisorId: req.user.id,
      estado: 'configuracion',
      ...config
    });
    res.status(201).json({ success: true, data: await cycleSummary(cycle) });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ success: false, error: 'Ya existe un ciclo abierto para este puesto' });
    }
    console.error('[manual-cycles] Error creando ciclo:', error.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const cycle = await managedCycle(req, res);
    if (!cycle) return;
    if (!['configuracion', 'relevamiento', 'pausado'].includes(cycle.estado)) {
      return res.status(409).json({ success: false, error: 'La configuración ya no puede cambiarse en este estado' });
    }
    await cycle.update(sanitizeConfig(req.body, cycle.toJSON()));
    res.json({ success: true, data: await cycleSummary(cycle) });
  } catch (error) {
    console.error('[manual-cycles] Error configurando ciclo:', error.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.post('/:id/planificar', async (req, res) => {
  try {
    const cycle = await managedCycle(req, res);
    if (!cycle) return;
    const result = await planificarPreguntasCiclo(cycle, req.user.id);
    res.json({ success: true, data: { ciclo: await cycleSummary(cycle), ...result } });
  } catch (error) {
    console.error('[manual-cycles] Error planificando:', error.message);
    res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'No se pudo planificar el relevamiento' });
  }
});

router.post('/:id/preguntas', async (req, res) => {
  try {
    const cycle = await managedCycle(req, res);
    if (!cycle) return;
    const texto = String(req.body.texto || '').trim();
    if (!texto) return res.status(400).json({ success: false, error: 'La pregunta no puede estar vacía' });
    const count = await ManualQuestion.count({ where: { cicloId: cycle.id } });
    const question = await ManualQuestion.create({
      cicloId: cycle.id,
      organizacionId: cycle.organizacionId,
      texto,
      bloque: ['B2', 'B3', 'B4', 'B5', 'B6'].includes(req.body.bloque) ? req.body.bloque : 'B4',
      tema: String(req.body.tema || 'Indicación del supervisor').slice(0, 255),
      objetivo: String(req.body.objetivo || '').slice(0, 2000) || null,
      origen: 'supervisor',
      prioridad: ['normal', 'importante', 'critica'].includes(req.body.prioridad) ? req.body.prioridad : 'normal',
      estado: 'aprobada',
      orden: count,
      aprobadaPor: req.user.id,
      aprobadaEn: new Date()
    });
    if (cycle.estado === 'configuracion') await cycle.update({ estado: 'relevamiento', iniciadoEn: new Date() });
    res.status(201).json({ success: true, data: question });
  } catch (error) {
    console.error('[manual-cycles] Error agregando pregunta:', error.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.patch('/:id/preguntas/:questionId', async (req, res) => {
  try {
    const cycle = await managedCycle(req, res);
    if (!cycle) return;
    const question = await ManualQuestion.findOne({ where: { id: req.params.questionId, cicloId: cycle.id } });
    if (!question) return res.status(404).json({ success: false, error: 'Pregunta no encontrada' });
    if (['preguntada', 'respondida'].includes(question.estado)) {
      return res.status(409).json({ success: false, error: 'Una pregunta ya entregada no puede modificarse' });
    }
    const updates = {};
    if (req.body.texto !== undefined) {
      const texto = String(req.body.texto).trim();
      if (!texto) return res.status(400).json({ success: false, error: 'La pregunta no puede estar vacía' });
      updates.texto = texto;
    }
    if (req.body.estado !== undefined) {
      if (!['propuesta', 'aprobada', 'rechazada'].includes(req.body.estado)) {
        return res.status(400).json({ success: false, error: 'Estado de pregunta inválido' });
      }
      updates.estado = req.body.estado;
      updates.aprobadaPor = req.body.estado === 'aprobada' ? req.user.id : null;
      updates.aprobadaEn = req.body.estado === 'aprobada' ? new Date() : null;
    }
    await question.update(updates);
    res.json({ success: true, data: question });
  } catch (error) {
    console.error('[manual-cycles] Error actualizando pregunta:', error.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.post('/:id/aprobar-preguntas', async (req, res) => {
  try {
    const cycle = await managedCycle(req, res);
    if (!cycle) return;
    const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
    if (!ids.length) return res.status(400).json({ success: false, error: 'Seleccioná al menos una pregunta' });
    await ManualQuestion.update(
      { estado: 'aprobada', aprobadaPor: req.user.id, aprobadaEn: new Date() },
      { where: { cicloId: cycle.id, id: { [Op.in]: ids }, estado: 'propuesta' } }
    );
    if (req.body.rechazarResto) {
      await ManualQuestion.update(
        { estado: 'rechazada' },
        { where: { cicloId: cycle.id, estado: 'propuesta', id: { [Op.notIn]: ids } } }
      );
    }
    res.json({ success: true, data: await cycleSummary(cycle) });
  } catch (error) {
    console.error('[manual-cycles] Error aprobando preguntas:', error.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.post('/:id/cerrar-relevamiento', async (req, res) => {
  try {
    const cycle = await managedCycle(req, res);
    if (!cycle) return;
    if (!['relevamiento', 'pausado'].includes(cycle.estado)) {
      return res.status(409).json({ success: false, error: 'El relevamiento no está activo' });
    }
    await cycle.update({ estado: 'listo_para_generar', relevamientoCerradoEn: new Date() });
    res.json({ success: true, data: await cycleSummary(cycle) });
  } catch (error) {
    console.error('[manual-cycles] Error cerrando relevamiento:', error.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.post('/:id/pausar', async (req, res) => {
  try {
    const cycle = await managedCycle(req, res);
    if (!cycle) return;
    if (cycle.estado !== 'relevamiento') return res.status(409).json({ success: false, error: 'Solo se puede pausar un relevamiento activo' });
    await cycle.update({ estado: 'pausado' });
    res.json({ success: true, data: await cycleSummary(cycle) });
  } catch (error) {
    console.error('[manual-cycles] Error pausando:', error.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.post('/:id/reanudar', async (req, res) => {
  try {
    const cycle = await managedCycle(req, res);
    if (!cycle) return;
    if (cycle.estado !== 'pausado') return res.status(409).json({ success: false, error: 'El ciclo no está pausado' });
    await cycle.update({ estado: 'relevamiento' });
    res.json({ success: true, data: await cycleSummary(cycle) });
  } catch (error) {
    console.error('[manual-cycles] Error reanudando:', error.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

export default router;
