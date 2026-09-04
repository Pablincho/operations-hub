import { Router } from 'express';
import { Sequelize, Op } from 'sequelize';
import { verifyJWT, requireAdmin } from '../auth.js';
import { db, CheckinSession, KnowledgeEntry, Manual, ManualCycle, ManualQuestion } from '../models/index.js';
import { generarPreguntas, INITIAL_QUESTIONS } from '../services/checkinService.js';
import { planificarPreguntasCiclo, recuperarCicloAtascado } from '../services/manualAgentService.js';
import { generarYEnviarRevisionAutomatica } from '../services/autoReviewService.js';
import { userIsPrimaryOccupant, getPrimaryOccupantsByFuncion } from '../services/positionService.js';
import { detectSensitive } from '../utils/detectSensitive.js';
import { cycleAllowsCheckin, nextCheckinDate } from '../manualCyclePolicy.js';

const router = Router();
router.use(verifyJWT);

function todayBA() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
}

async function latestCyclesByFunction(organizacionId, funciones) {
  const cycles = await ManualCycle.findAll({
    where: { organizacionId, ...(funciones.length ? { funcion: { [Op.in]: funciones } } : {}) },
    order: [['numero', 'DESC']]
  });
  const result = {};
  for (const cycle of cycles) if (!result[cycle.funcion]) result[cycle.funcion] = cycle;
  return result;
}

router.get('/hoy', async (req, res) => {
  try {
    const today = todayBA();
    const userFunciones = req.user.funciones || [];
    // Los ocupantes principales se resuelven en bloque: preguntarlos de a una función
    // repetía la misma consulta de organización y de usuarios una vez por función.
    const [currentCycles, principales] = await Promise.all([
      latestCyclesByFunction(req.user.organizacionId, userFunciones),
      getPrimaryOccupantsByFuncion(req.user.organizacionId, userFunciones)
    ]);
    const cycleIds = Object.values(currentCycles).map(cycle => cycle.id);
    const primaryStatusMap = Object.fromEntries(userFunciones.map(funcion => {
      const principal = principales.get(funcion);
      // Sin ocupante inferible cualquiera con la función puede inaugurar el historial.
      return [funcion, !principal || principal.id === req.user.id];
    }));

    const [todaySessions, completedRows, entryRows, questionRows] = await Promise.all([
      cycleIds.length
        ? CheckinSession.findAll({ where: { usuarioId: req.user.id, fecha: today, completado: false, cicloId: { [Op.in]: cycleIds } } })
        : [],
      // Los completados solo se usan para contar y saber la última fecha, así que se
      // agregan en SQL: traerlos enteros arrastraba todo el JSONB de preguntas y
      // respuestas, que crece sin techo a medida que se usa el sistema.
      cycleIds.length
        ? db.query(
          `SELECT "cicloId", funcion,
                  COUNT(*) FILTER (WHERE es_onboarding) AS onboarding,
                  COUNT(*) FILTER (WHERE NOT es_onboarding) AS tandas,
                  MAX(fecha)::text AS ultima_fecha
             FROM (
               SELECT s."cicloId", s.funcion, s.fecha,
                      jsonb_array_length(COALESCE(s.preguntas, '[]'::jsonb)) = 10
                      AND NOT EXISTS (
                        SELECT 1 FROM jsonb_array_elements(COALESCE(s.preguntas, '[]'::jsonb)) AS p
                         WHERE COALESCE(p->>'questionId', '') <> ''
                      ) AS es_onboarding
                 FROM "CheckinSessions" s
                WHERE s."usuarioId" = :usuarioId
                  AND s.completado = true
                  AND s."cicloId" IN (:cycleIds)
             ) resumen
            GROUP BY "cicloId", funcion`,
          { replacements: { usuarioId: req.user.id, cycleIds }, type: Sequelize.QueryTypes.SELECT }
        )
        : [],
      cycleIds.length
        ? KnowledgeEntry.findAll({
          where: { organizacionId: req.user.organizacionId, categoria: 'checkin', cicloId: { [Op.in]: cycleIds } },
          attributes: ['funcion', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
          group: ['funcion'], raw: true
        })
        : [],
      cycleIds.length
        ? ManualQuestion.findAll({
          where: { cicloId: { [Op.in]: cycleIds } },
          attributes: ['cicloId', 'estado', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
          group: ['cicloId', 'estado'], raw: true
        })
        : []
    ]);

    // El onboarding histórico son 10 preguntas fijas sin questionId. Las tandas del agente
    // siempre traen questionId, así que una tanda de 10 preguntas no se confunde con él.
    const onboardingStatus = {};
    const dailyCounts = {};
    const ultimaFechaPorCiclo = {};
    for (const row of completedRows) {
      if (Number(row.onboarding) > 0) onboardingStatus[row.funcion] = true;
      dailyCounts[row.funcion] = (dailyCounts[row.funcion] || 0) + Number(row.tandas);
      ultimaFechaPorCiclo[row.cicloId] = row.ultima_fecha;
    }
    const entryCounts = Object.fromEntries(entryRows.map(row => [row.funcion, Number(row.count)]));
    // Además del conteo del ciclo actual se envía el acumulado histórico: al abrir un ciclo
    // nuevo el contador del ciclo arranca de cero y sin esto parecería que se perdió trabajo.
    const totalRows = userFunciones.length
      ? await KnowledgeEntry.findAll({
        where: { organizacionId: req.user.organizacionId, categoria: 'checkin', funcion: { [Op.in]: userFunciones } },
        attributes: ['funcion', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
        group: ['funcion'], raw: true
      })
      : [];
    const entryTotals = Object.fromEntries(totalRows.map(row => [row.funcion, Number(row.count)]));
    const cycleStatusMap = {};
    const questionsByCycle = {};
    for (const row of questionRows) {
      questionsByCycle[row.cicloId] ||= {};
      questionsByCycle[row.cicloId][row.estado] = Number(row.count);
    }
    const checkinAvailabilityMap = {};
    for (const [funcion, cycle] of Object.entries(currentCycles)) {
      cycleStatusMap[funcion] = {
        id: cycle.id,
        numero: cycle.numero,
        estado: cycle.estado,
        objetivoPreguntas: cycle.objetivoPreguntas,
        preguntasPorEntrega: cycle.preguntasPorEntrega,
        frecuencia: cycle.frecuencia,
        intervaloDias: cycle.intervaloDias,
        esLegacy: cycle.esLegacy
      };
      const todaySession = todaySessions.find(session => session.cicloId === cycle.id);
      const nextDate = nextCheckinDate(ultimaFechaPorCiclo[cycle.id], cycle.frecuencia, cycle.intervaloDias);
      const counts = questionsByCycle[cycle.id] || {};
      const totalQuestions = Object.values(counts).reduce((total, count) => total + count, 0);
      const limitReached = cycle.objetivoPreguntas !== null && totalQuestions >= cycle.objetivoPreguntas;
      const hasAgentPlan = !cycle.esLegacy || Object.values(counts).some(Boolean);
      let estado = 'no_disponible';
      if (todaySession && !todaySession.completado) estado = 'disponible';
      else if (!cycleAllowsCheckin(cycle)) estado = 'no_disponible';
      else if (nextDate && today < nextDate) estado = 'esperando_frecuencia';
      else if (counts.aprobada > 0 || (!hasAgentPlan && !limitReached) || (!cycle.requiereAprobacionPreguntas && !limitReached)) estado = 'disponible';
      else if (counts.propuesta > 0) estado = 'esperando_aprobacion';
      else if (limitReached) estado = 'limite_alcanzado';
      else estado = 'sin_preguntas';
      checkinAvailabilityMap[funcion] = {
        estado,
        proximaFecha: nextDate || null,
        preguntasPendientes: counts.aprobada || 0,
        permiteResponderTodas: cycle.permitirResponderTodas,
        limiteAlcanzado: limitReached
      };
    }
    res.json({ success: true, data: todaySessions, onboardingStatus, dailyCounts, entryCounts, entryTotals, primaryStatusMap, cycleStatusMap, checkinAvailabilityMap });
  } catch (error) {
    console.error('[checkin] Error cargando estado:', error.message);
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

async function takeAgentQuestions(cycle, allPending = false) {
  let questions = await ManualQuestion.findAll({
    where: { cicloId: cycle.id, estado: 'aprobada' },
    order: [['orden', 'ASC'], ['createdAt', 'ASC']],
    ...(allPending ? {} : { limit: cycle.preguntasPorEntrega })
  });
  if (!questions.length && !cycle.requiereAprobacionPreguntas) {
    await planificarPreguntasCiclo(cycle, cycle.supervisorId);
    questions = await ManualQuestion.findAll({
      where: { cicloId: cycle.id, estado: 'aprobada' },
      order: [['orden', 'ASC'], ['createdAt', 'ASC']],
      ...(allPending ? {} : { limit: cycle.preguntasPorEntrega })
    });
  }
  return questions;
}

router.post('/iniciar', async (req, res) => {
  try {
    const funcion = String(req.body.funcion || '').trim();
    const allPending = req.body.todasPendientes === true;
    if (!funcion) return res.status(400).json({ success: false, error: 'funcion requerida' });
    if (!(req.user.funciones || []).includes(funcion)) {
      return res.status(403).json({ success: false, error: 'No tenés esa función asignada' });
    }
    if (!(await userIsPrimaryOccupant(req.user.id, req.user.organizacionId, funcion))) {
      return res.status(403).json({ success: false, error: 'Solo el operativo principal puede completar el check-in de este puesto.', isReadOnly: true });
    }

    const cycle = await ManualCycle.findOne({
      where: { organizacionId: req.user.organizacionId, funcion }, order: [['numero', 'DESC']]
    });
    if (!cycle || cycle.estado === 'completado') {
      return res.status(409).json({ success: false, error: 'No hay un ciclo abierto. El supervisor debe iniciar el próximo ciclo.' });
    }
    if (cycle.estado === 'pausado') {
      return res.status(409).json({ success: false, error: 'El supervisor pausó este ciclo de relevamiento.' });
    }
    // Un ciclo abandonado en una fase de agente no debe esperar a que entre el supervisor
    // para destrabarse: el propio ocupante lo recupera al intentar responder.
    await recuperarCicloAtascado(cycle);
    if (!cycleAllowsCheckin(cycle)) {
      return res.status(409).json({ success: false, error: 'El ciclo no está habilitado para responder preguntas.' });
    }
    if (allPending && !cycle.permitirResponderTodas) {
      return res.status(403).json({
        success: false,
        error: 'El supervisor configuró este ciclo para responder solo la cantidad de preguntas por entrega.'
      });
    }

    const today = todayBA();
    const existing = await CheckinSession.findOne({
      where: { usuarioId: req.user.id, funcion, cicloId: cycle.id, completado: false }
    });
    if (existing) return res.json({ success: true, data: existing });

    const lastCompleted = await CheckinSession.findOne({
      where: { usuarioId: req.user.id, funcion, cicloId: cycle.id, completado: true }, order: [['fecha', 'DESC']]
    });
    const nextDate = nextCheckinDate(lastCompleted?.fecha, cycle.frecuencia, cycle.intervaloDias);
    if (nextDate && today < nextDate) {
      return res.status(409).json({
        success: false,
        error: `El próximo check-in estará disponible el ${new Date(`${nextDate}T12:00:00Z`).toLocaleDateString('es-AR', { timeZone: 'UTC' })}`
      });
    }

    const [totalQuestions, approvedQuestions] = await Promise.all([
      ManualQuestion.count({ where: { cicloId: cycle.id } }),
      ManualQuestion.count({ where: { cicloId: cycle.id, estado: 'aprobada' } })
    ]);
    if (cycle.objetivoPreguntas !== null && totalQuestions >= cycle.objetivoPreguntas && !approvedQuestions) {
      return res.status(409).json({
        success: false,
        error: 'Ya se alcanzó el límite de preguntas de este ciclo. El supervisor debe ampliar el límite o finalizar el relevamiento.'
      });
    }

    const previousSessions = await CheckinSession.findAll({
      where: { usuarioId: req.user.id, funcion, cicloId: cycle.id, completado: true }, order: [['fecha', 'ASC']]
    });
    let queuedQuestions = [];
    let preguntas;
    const hasAgentPlan = !cycle.esLegacy || await ManualQuestion.count({ where: { cicloId: cycle.id } }) > 0;
    if (hasAgentPlan) {
      queuedQuestions = await takeAgentQuestions(cycle, allPending);
      if (!queuedQuestions.length) {
        const proposed = await ManualQuestion.count({ where: { cicloId: cycle.id, estado: 'propuesta' } });
        return res.status(409).json({
          success: false,
          error: proposed ? 'Las próximas preguntas esperan la aprobación del supervisor.' : 'No hay preguntas disponibles. El supervisor debe generar una nueva tanda.'
        });
      }
      preguntas = queuedQuestions.map(question => ({
        questionId: question.id, pregunta: question.texto, bloque: question.bloque, respuesta: '', respondida: false
      }));
    } else {
      const onboardingDone = previousSessions.some(session => session.preguntas.length === 10);
      if (!onboardingDone) {
        preguntas = (INITIAL_QUESTIONS[funcion] || []).map(question => ({
          pregunta: question.pregunta, bloque: question.bloque, respuesta: '', respondida: false
        }));
      } else {
        const previousAnswers = previousSessions.flatMap(session => session.preguntas.filter(question => question.respondida));
        const crossAreaRefs = await KnowledgeEntry.findAll({
          where: {
            organizacionId: req.user.organizacionId,
            funcion: { [Op.ne]: funcion },
            categoria: 'checkin',
            esSensible: false,
            [Op.or]: [{ titulo: { [Op.iLike]: `%${funcion}%` } }, { contenido: { [Op.iLike]: `%${funcion}%` } }]
          },
          attributes: ['funcion', 'titulo', 'contenido'], limit: 10
        });
        const generated = await generarPreguntas(funcion, previousAnswers, crossAreaRefs.map(entry => entry.toJSON()));
        preguntas = generated.map(question => ({
          pregunta: question.pregunta || question, bloque: question.bloque || null, respuesta: '', respondida: false
        }));
      }
    }

    const session = await db.transaction(async transaction => {
      const created = await CheckinSession.create({
        usuarioId: req.user.id, cicloId: cycle.id, funcion, fecha: today, preguntas
      }, { transaction });
      if (queuedQuestions.length) {
        const [updated] = await ManualQuestion.update(
          { estado: 'preguntada', checkinSessionId: created.id },
          { where: { id: { [Op.in]: queuedQuestions.map(question => question.id) }, estado: 'aprobada' }, transaction }
        );
        if (updated !== queuedQuestions.length) {
          const conflict = new Error('La tanda de preguntas cambió. Volvé a intentar.');
          conflict.status = 409;
          throw conflict;
        }
      }
      if (cycle.estado === 'configuracion') {
        await cycle.update({ estado: 'relevamiento', iniciadoEn: new Date() }, { transaction });
      }
      return created;
    });
    res.status(201).json({ success: true, data: session });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      const existing = await CheckinSession.findOne({
        where: { usuarioId: req.user.id, funcion: req.body.funcion, completado: false }, order: [['createdAt', 'DESC']]
      });
      if (existing) return res.json({ success: true, data: existing });
    }
    console.error('[checkin] Error iniciando:', error.message);
    res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Error interno' });
  }
});

router.post('/:id/responder', async (req, res) => {
  try {
    const { respuestas } = req.body;
    if (!Array.isArray(respuestas)) return res.status(400).json({ success: false, error: 'respuestas debe ser un array' });
    const session = await CheckinSession.findOne({ where: { id: req.params.id, usuarioId: req.user.id } });
    if (!session) return res.status(404).json({ success: false, error: 'Sesión no encontrada' });
    if (session.completado) return res.status(400).json({ success: false, error: 'Este check-in ya fue completado' });

    const updatedQuestions = session.preguntas.map((question, index) => ({
      ...question,
      respuesta: respuestas[index]?.trim() || question.respuesta,
      respondida: !!respuestas[index]?.trim()
    }));
    const answered = updatedQuestions.filter(question => question.respondida);
    if (!answered.length) return res.status(400).json({ success: false, error: 'Respondé al menos una pregunta' });

    let sensitivities;
    try {
      sensitivities = await Promise.all(answered.map(question => detectSensitive(question.pregunta, question.respuesta)));
    } catch (error) {
      console.error('[checkin] Error verificando contenido sensible:', error.message);
      return res.status(503).json({ success: false, error: 'No se pudo verificar el contenido en este momento. Intentá guardar de nuevo en unos segundos.' });
    }

    let cicloListoParaRevision = null;
    await db.transaction(async transaction => {
      const lockedSession = await CheckinSession.findOne({
        where: { id: session.id, usuarioId: req.user.id }, transaction, lock: transaction.LOCK.UPDATE
      });
      if (!lockedSession || lockedSession.completado) {
        const conflict = new Error('Este check-in ya fue completado');
        conflict.status = 409;
        throw conflict;
      }
      await KnowledgeEntry.bulkCreate(answered.map((question, index) => ({
        organizacionId: req.user.organizacionId,
        cicloId: lockedSession.cicloId,
        funcion: lockedSession.funcion,
        categoria: 'checkin',
        bloque: question.bloque || null,
        titulo: question.pregunta,
        contenido: question.respuesta,
        esSensible: sensitivities[index],
        usuarioId: req.user.id
      })), { transaction, individualHooks: true });
      await lockedSession.update({ preguntas: updatedQuestions, completado: true }, { transaction });

      const answeredIds = answered.map(question => question.questionId).filter(Boolean);
      const unansweredIds = updatedQuestions.filter(question => !question.respondida && question.questionId).map(question => question.questionId);
      if (answeredIds.length) {
        await ManualQuestion.update({ estado: 'respondida' }, {
          where: { cicloId: lockedSession.cicloId, id: { [Op.in]: answeredIds } }, transaction
        });
      }
      if (unansweredIds.length) {
        await ManualQuestion.update({ estado: 'aprobada', checkinSessionId: null }, {
          where: { cicloId: lockedSession.cicloId, id: { [Op.in]: unansweredIds } }, transaction
        });
      }
      const cycle = await ManualCycle.findByPk(lockedSession.cicloId, { transaction, lock: transaction.LOCK.UPDATE });
      if (cycle) {
        const [totalQuestions, pendingQuestions, seguimientosRespondidos] = await Promise.all([
          ManualQuestion.count({ where: { cicloId: cycle.id }, transaction }),
          ManualQuestion.count({
            where: { cicloId: cycle.id, estado: { [Op.in]: ['propuesta', 'aprobada', 'preguntada'] } },
            transaction
          }),
          answeredIds.length
            ? ManualQuestion.count({
                where: {
                  cicloId: cycle.id,
                  id: { [Op.in]: answeredIds },
                  origen: { [Op.in]: ['agente_seguimiento', 'supervisor_revision'] }
                },
                transaction
              })
            : 0
        ]);
        const respondioSeguimiento = seguimientosRespondidos > 0;
        const limiteAlcanzado = cycle.objetivoPreguntas !== null && totalQuestions >= cycle.objetivoPreguntas;
        if (pendingQuestions === 0 && cycle.estado === 'relevamiento' && (limiteAlcanzado || respondioSeguimiento)) {
          // El seguimiento reemplaza la evidencia del bloque devuelto. Si el manual
          // anterior seguía en revisión, lo liberamos justo antes de generar la nueva
          // versión para que el proceso automático pueda recrearlo en revisión.
          if (respondioSeguimiento) {
            await Manual.update({ estado: 'borrador' }, {
              where: { cicloId: cycle.id, estado: 'en_revision' }, transaction
            });
          }
          await cycle.update({ estado: 'listo_para_generar', relevamientoCerradoEn: new Date() }, { transaction });
          cicloListoParaRevision = cycle.id;
        }
      }
    });
    await session.reload();
    let autoReview = null;
    if (cicloListoParaRevision) {
      try {
        autoReview = await generarYEnviarRevisionAutomatica(cicloListoParaRevision);
      } catch (autoReviewError) {
        console.error('[checkin] No se pudo enviar el manual automáticamente a revisión:', autoReviewError.message);
        autoReview = { estado: 'pendiente', error: 'Las respuestas se guardaron, pero no se pudo generar el manual automáticamente.' };
      }
    }
    res.json({ success: true, data: session, autoReview });
  } catch (error) {
    console.error('[checkin] Error guardando respuestas:', error.message);
    res.status(error.status || 500).json({ success: false, error: error.status ? error.message : 'Error interno' });
  }
});

router.get('/progreso', requireAdmin, async (req, res) => {
  try {
    const cyclesByFunction = await latestCyclesByFunction(req.user.organizacionId, []);
    const cycles = Object.values(cyclesByFunction);
    const rows = cycles.length ? await KnowledgeEntry.findAll({
      where: {
        organizacionId: req.user.organizacionId,
        categoria: 'checkin',
        cicloId: { [Op.in]: cycles.map(cycle => cycle.id) }
      },
      attributes: ['funcion', [Sequelize.fn('COUNT', Sequelize.col('id')), 'count']],
      group: ['funcion'],
      raw: true
    }) : [];
    const progress = Object.fromEntries(rows.map(row => [row.funcion, Number(row.count)]));
    const cycleStatusMap = Object.fromEntries(cycles.map(cycle => [cycle.funcion, {
      id: cycle.id,
      numero: cycle.numero,
      estado: cycle.estado,
      objetivoPreguntas: cycle.objetivoPreguntas
    }]));
    res.json({ success: true, data: progress, cycleStatusMap });
  } catch {
    res.status(500).json({ success: false, error: 'Error interno' });
  }
});

export default router;
