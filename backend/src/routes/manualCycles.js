import { Router } from 'express';
import { Op, fn, col } from 'sequelize';
import { verifyJWT, canAccessFuncion } from '../auth.js';
import {
  db,
  Manual,
  KnowledgeEntry,
  ManualAgentRun,
  ManualCycle,
  ManualQuestion,
  Usuario,
  Organizacion
} from '../models/index.js';
import { getPrimaryOccupant, getPrimaryOccupantsByFuncion, userCanManageCycle } from '../services/positionService.js';
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
      : !!body.requiereAprobacionPreguntas,
    permitirResponderTodas: body.permitirResponderTodas === undefined
      ? (base.permitirResponderTodas ?? false)
      : !!body.permitirResponderTodas
  };
}

const GENERAL_CONFIG_DEFAULTS = {
  preguntasPorEntrega: 3,
  frecuencia: 'diaria',
  intervaloDias: 1,
  objetivoPreguntas: null,
  requiereAprobacionPreguntas: false,
  permitirResponderTodas: false
};

function sanitizeGeneralConfig(body, base = GENERAL_CONFIG_DEFAULTS) {
  const sanitized = sanitizeConfig(body, { ...GENERAL_CONFIG_DEFAULTS, ...base });
  return {
    preguntasPorEntrega: sanitized.preguntasPorEntrega,
    frecuencia: sanitized.frecuencia,
    intervaloDias: sanitized.intervaloDias,
    objetivoPreguntas: sanitized.objetivoPreguntas,
    requiereAprobacionPreguntas: sanitized.requiereAprobacionPreguntas,
    permitirResponderTodas: sanitized.permitirResponderTodas
  };
}

function generalConfigFor(org, supervisorId) {
  return sanitizeGeneralConfig(org?.config?.manualCycleDefaultsBySupervisor?.[supervisorId] || {});
}

// Resume varios ciclos con 3 consultas en total. Resumirlos de a uno multiplicaba esas
// 3 por la cantidad de ciclos, que es lo que hacía lento el listado de puestos.
async function cycleSummaries(cycles) {
  if (!cycles.length) return [];
  const ids = cycles.map(cycle => cycle.id);
  const [questionRows, answerRows, manuales] = await Promise.all([
    ManualQuestion.findAll({
      where: { cicloId: { [Op.in]: ids } },
      attributes: ['cicloId', 'estado', [fn('COUNT', col('id')), 'cantidad']],
      group: ['cicloId', 'estado'], raw: true
    }),
    KnowledgeEntry.findAll({
      where: { cicloId: { [Op.in]: ids }, categoria: 'checkin' },
      attributes: ['cicloId', [fn('COUNT', col('id')), 'cantidad']],
      group: ['cicloId'], raw: true
    }),
    Manual.findAll({
      where: { cicloId: { [Op.in]: ids } },
      order: [['createdAt', 'DESC']],
      attributes: ['id', 'estado', 'version', 'cicloId']
    })
  ]);

  const preguntasPorCiclo = new Map();
  for (const row of questionRows) {
    if (!preguntasPorCiclo.has(row.cicloId)) preguntasPorCiclo.set(row.cicloId, {});
    preguntasPorCiclo.get(row.cicloId)[row.estado] = Number(row.cantidad);
  }
  const respuestasPorCiclo = new Map(answerRows.map(row => [row.cicloId, Number(row.cantidad)]));
  // Vienen ordenados por fecha descendente, así que el primero de cada ciclo es el vigente.
  const manualPorCiclo = new Map();
  for (const manual of manuales) if (!manualPorCiclo.has(manual.cicloId)) manualPorCiclo.set(manual.cicloId, manual);

  return cycles.map(cycle => ({
    ...cycle.toJSON(),
    conteoPreguntas: preguntasPorCiclo.get(cycle.id) || {},
    respuestasCiclo: respuestasPorCiclo.get(cycle.id) || 0,
    manual: manualPorCiclo.get(cycle.id)?.toJSON() || null
  }));
}

async function cycleSummary(cycle) {
  const [resumen] = await cycleSummaries([cycle]);
  return resumen;
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

// Plantilla operativa del supervisor. No incluye temas ni orientación porque esos
// campos describen el puesto y deben poder seguir ajustándose individualmente.
router.get('/configuracion-general', async (req, res) => {
  try {
    const org = await Organizacion.findByPk(req.user.organizacionId, { attributes: ['config'] });
    res.json({ success: true, data: generalConfigFor(org, req.user.id) });
  } catch (error) {
    console.error('[manual-cycles] Error obteniendo configuración general:', error.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

router.patch('/configuracion-general', async (req, res) => {
  try {
    const result = await db.transaction(async transaction => {
      const org = await Organizacion.findByPk(req.user.organizacionId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!org) {
        const error = new Error('Organización no encontrada');
        error.status = 404;
        throw error;
      }

      const current = generalConfigFor(org, req.user.id);
      const defaults = sanitizeGeneralConfig(req.body, current);
      const orgConfig = org.config || {};
      await org.update({
        config: {
          ...orgConfig,
          manualCycleDefaultsBySupervisor: {
            ...(orgConfig.manualCycleDefaultsBySupervisor || {}),
            [req.user.id]: defaults
          }
        }
      }, { transaction });

      let appliedCycles = 0;
      if (req.body.aplicarACiclos === true) {
        const occupants = await Usuario.findAll({
          where: {
            organizacionId: req.user.organizacionId,
            activo: true,
            [Op.or]: [
              { supervisorId: req.user.id },
              { id: req.user.id, autoaprobarManual: true }
            ]
          },
          attributes: ['id'],
          transaction
        });
        const occupantIds = occupants.map(occupant => occupant.id);
        if (occupantIds.length) {
          [appliedCycles] = await ManualCycle.update(defaults, {
            where: {
              organizacionId: req.user.organizacionId,
              ocupanteId: { [Op.in]: occupantIds },
              estado: { [Op.in]: ['configuracion', 'relevamiento', 'pausado'] }
            },
            transaction
          });
        }
      }

      return { defaults, appliedCycles };
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[manual-cycles] Error guardando configuración general:', error.message);
    res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Error interno' });
  }
});

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
    const funciones = [...new Set(occupants.flatMap(occupant => occupant.funciones || []))];
    if (!funciones.length) return res.json({ success: true, data: [] });

    // Antes esto era un N+1 anidado: por cada par ocupante-función salían 6 o 7 consultas
    // secuenciales. Ahora el ocupante principal y el último ciclo de todas las funciones
    // se resuelven de una sola vez, y los resúmenes en un único bloque al final.
    const [principales, cycles] = await Promise.all([
      getPrimaryOccupantsByFuncion(req.user.organizacionId, funciones),
      ManualCycle.findAll({
        where: { organizacionId: req.user.organizacionId, funcion: { [Op.in]: funciones } },
        order: [['numero', 'DESC']]
      })
    ]);
    const ultimoCiclo = new Map();
    for (const cycle of cycles) if (!ultimoCiclo.has(cycle.funcion)) ultimoCiclo.set(cycle.funcion, cycle);

    const positions = [];
    for (const occupant of occupants) {
      for (const funcion of occupant.funciones || []) {
        if (principales.get(funcion)?.id !== occupant.id) continue;
        positions.push({ funcion, ocupante: occupant.toJSON(), ciclo: ultimoCiclo.get(funcion) || null });
      }
    }
    const resumenes = await cycleSummaries(positions.map(position => position.ciclo).filter(Boolean));
    const resumenPorCiclo = new Map(resumenes.map(resumen => [resumen.id, resumen]));
    res.json({
      success: true,
      data: positions.map(position => ({
        ...position,
        ciclo: position.ciclo ? resumenPorCiclo.get(position.ciclo.id) : null
      }))
    });
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
    res.json({ success: true, data: await cycleSummaries(cycles) });
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
    if (!occupant) return res.status(400).json({ success: false, error: 'Configurá primero el operativo principal del puesto' });
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
    const org = await Organizacion.findByPk(req.user.organizacionId, { attributes: ['config'] });
    const storedGeneral = org?.config?.manualCycleDefaultsBySupervisor?.[req.user.id];
    const base = storedGeneral
      ? { ...inherited, ...sanitizeGeneralConfig(storedGeneral) }
      : inherited;
    const config = sanitizeConfig(req.body, base);
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
