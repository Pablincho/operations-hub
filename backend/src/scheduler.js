import cron from 'node-cron';
import { Op } from 'sequelize';
import { Usuario, CheckinSession, Organizacion, ManualCycle } from './models/index.js';
import { sendRecordatorioEmail, sendRecordatorioSupervisorEmail, sendCicloPendienteEmail } from './services/emailService.js';

const DIAS_USUARIO = 5;
const DIAS_SUPERVISOR = 10;
const DIAS_CICLO_CERRADO = 10;

function daysSince(value) {
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
}

async function checkOrganization(org, now) {
  const previousRun = org.config?.schedulerLastRunAt
    ? new Date(org.config.schedulerLastRunAt).getTime()
    : now - 86400000;
  const missedDays = Math.max(1, Math.round((now - previousRun) / 86400000));
  const cycles = await ManualCycle.findAll({
    where: { organizacionId: org.id, estado: 'relevamiento' }
  });

  for (const cycle of cycles) {
    const occupant = await Usuario.findOne({
      where: { id: cycle.ocupanteId, organizacionId: org.id, activo: true, enVacaciones: false }
    });
    if (!occupant) continue;

    const lastSession = await CheckinSession.findOne({
      where: { usuarioId: occupant.id, cicloId: cycle.id, completado: true },
      order: [['fecha', 'DESC']],
      attributes: ['fecha']
    });
    const inactiveDays = lastSession ? daysSince(lastSession.fecha) : daysSince(cycle.iniciadoEn || cycle.createdAt);
    const configuredWait = cycle.frecuencia === 'semanal'
      ? cycle.intervaloDias * 7
      : cycle.frecuencia === 'diaria' ? cycle.intervaloDias : 0;
    const userThreshold = Math.max(DIAS_USUARIO, configuredWait);
    if (inactiveDays < userThreshold) continue;

    if ((inactiveDays - userThreshold) % DIAS_USUARIO < missedDays) {
      try {
        await sendRecordatorioEmail(occupant.email, occupant.nombre, cycle.funcion, inactiveDays);
      } catch (error) {
        console.error(`[Scheduler] Error enviando recordatorio a ${occupant.email}:`, error.message);
      }
    }
    if (inactiveDays >= DIAS_SUPERVISOR &&
        (inactiveDays - DIAS_SUPERVISOR) % DIAS_SUPERVISOR < missedDays &&
        cycle.supervisorId !== occupant.id) {
      try {
        const supervisor = await Usuario.findOne({
          where: { id: cycle.supervisorId, organizacionId: org.id, activo: true },
          attributes: ['email', 'nombre']
        });
        if (supervisor) {
          await sendRecordatorioSupervisorEmail(supervisor.email, supervisor.nombre, occupant.nombre, cycle.funcion, inactiveDays);
        }
      } catch (error) {
        console.error('[Scheduler] Error enviando recordatorio supervisor:', error.message);
      }
    }
  }

  // Un puesto cuyo último ciclo quedó cerrado no genera ningún recordatorio: el ocupante
  // no recibe preguntas y nadie avisa que falta abrir el siguiente. Se le recuerda al
  // supervisor con la misma cadencia tolerante a corridas perdidas.
  const cerrados = await ManualCycle.findAll({
    where: { organizacionId: org.id, estado: 'completado' },
    order: [['numero', 'DESC']]
  });
  const yaAvisados = new Set();
  for (const cycle of cerrados) {
    if (yaAvisados.has(cycle.funcion)) continue;
    yaAvisados.add(cycle.funcion);
    const abierto = await ManualCycle.count({
      where: { organizacionId: org.id, funcion: cycle.funcion, estado: { [Op.ne]: 'completado' } }
    });
    if (abierto) continue;

    const diasCerrado = daysSince(cycle.completadoEn || cycle.updatedAt);
    if (diasCerrado < DIAS_CICLO_CERRADO) continue;
    if ((diasCerrado - DIAS_CICLO_CERRADO) % DIAS_CICLO_CERRADO >= missedDays) continue;

    const occupant = await Usuario.findOne({
      where: { id: cycle.ocupanteId, organizacionId: org.id, activo: true, enVacaciones: false }
    });
    if (!occupant) continue;
    const supervisor = await Usuario.findOne({
      where: { id: cycle.supervisorId, organizacionId: org.id, activo: true },
      attributes: ['email', 'nombre']
    });
    if (!supervisor) continue;
    try {
      await sendCicloPendienteEmail(supervisor.email, supervisor.nombre, cycle.funcion, diasCerrado);
    } catch (error) {
      console.error('[Scheduler] Error enviando aviso de ciclo pendiente:', error.message);
    }
  }

  await org.update({ config: { ...(org.config || {}), schedulerLastRunAt: new Date(now).toISOString() } });
}

async function checkInactivos() {
  const organizations = await Organizacion.findAll();
  const now = Date.now();
  for (const organization of organizations) await checkOrganization(organization, now);
}

export function initScheduler() {
  cron.schedule('0 12 * * *', async () => {
    console.log('[Scheduler] Verificando inactividad...');
    try {
      await checkInactivos();
      console.log('[Scheduler] Verificación completada.');
    } catch (error) {
      console.error('[Scheduler] Error:', error.message);
    }
  }, { timezone: 'UTC' });
  console.log('[Scheduler] Recordatorios de inactividad activados (9am Buenos Aires).');
}
