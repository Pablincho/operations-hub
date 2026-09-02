import cron from 'node-cron';
import { Usuario, CheckinSession, Organizacion } from './models/index.js';
import { sendRecordatorioEmail, sendRecordatorioSupervisorEmail } from './services/emailService.js';

const DIAS_USUARIO = 5;
const DIAS_SUPERVISOR = 10;
const MAX_DIARIOS = 20;

// El cron corre una vez al día; si ese proceso no llegó a correr (redeploy, reinicio de
// Railway a esa hora), diasSinActividad salta de largo el múltiplo exacto y el recordatorio
// de esa racha nunca se manda. Para eso guardamos cuándo fue la última corrida exitosa (en
// Organizacion.config, el mismo JSON que ya se usa para otras configuraciones de la org) y
// medimos el hueco real: en un día normal da 1 (comportamiento idéntico al de antes), y si
// se saltó un día, el hueco cubre también el múltiplo que se hubiera perdido.
async function checkInactivos() {
  const org = await Organizacion.findOne();
  const now = Date.now();
  const prevRunAt = org?.config?.schedulerLastRunAt
    ? new Date(org.config.schedulerLastRunAt).getTime()
    : now - 86400000;
  const huecoDias = Math.max(1, Math.round((now - prevRunAt) / 86400000));

  const usuarios = await Usuario.findAll({
    where: { activo: true, rol: 'operativo', enVacaciones: false }
  });

  const activos = usuarios.filter(u => u.funciones?.length > 0);

  for (const usuario of activos) {
    for (const funcion of usuario.funciones) {
      const sessions = await CheckinSession.findAll({
        where: { usuarioId: usuario.id, funcion, completado: true },
        order: [['fecha', 'DESC']],
        attributes: ['fecha', 'preguntas']
      });

      const diasDiarios = sessions.filter(s => s.preguntas?.length === 3).length;
      if (diasDiarios >= MAX_DIARIOS) continue;

      let diasSinActividad;
      if (sessions.length === 0) {
        const diasDesdeCreacion = Math.floor((Date.now() - new Date(usuario.createdAt)) / 86400000);
        if (diasDesdeCreacion < DIAS_USUARIO) continue;
        diasSinActividad = diasDesdeCreacion;
      } else {
        diasSinActividad = Math.floor((Date.now() - new Date(sessions[0].fecha)) / 86400000);
      }

      if (diasSinActividad < DIAS_USUARIO) continue;

      if (diasSinActividad % DIAS_USUARIO < huecoDias) {
        try {
          await sendRecordatorioEmail(usuario.email, usuario.nombre, funcion, diasSinActividad);
        } catch (err) {
          console.error(`[Scheduler] Error enviando recordatorio a ${usuario.email}:`, err.message);
        }
      }

      if (diasSinActividad >= DIAS_SUPERVISOR && diasSinActividad % DIAS_SUPERVISOR < huecoDias && usuario.supervisorId) {
        try {
          const supervisor = await Usuario.findByPk(usuario.supervisorId, { attributes: ['email', 'nombre'] });
          if (supervisor) {
            await sendRecordatorioSupervisorEmail(supervisor.email, supervisor.nombre, usuario.nombre, funcion, diasSinActividad);
          }
        } catch (err) {
          console.error(`[Scheduler] Error enviando recordatorio supervisor:`, err.message);
        }
      }
    }
  }

  // Solo se llega acá si el barrido completo no tiró ningún error de infraestructura
  // (los fallos de envío de un email puntual ya se atrapan arriba y no cortan el loop).
  // Si esto no llega a guardarse, la próxima corrida va a ver un hueco más grande y
  // recuperar el aviso que se hubiera perdido.
  if (org) {
    await org.update({ config: { ...(org.config || {}), schedulerLastRunAt: new Date(now).toISOString() } });
  }
}

// 9am Buenos Aires (UTC-3) = 12:00 UTC
export function initScheduler() {
  cron.schedule('0 12 * * *', async () => {
    console.log('[Scheduler] Verificando inactividad...');
    try {
      await checkInactivos();
      console.log('[Scheduler] Verificación completada.');
    } catch (err) {
      console.error('[Scheduler] Error:', err.message);
    }
  }, { timezone: 'UTC' });

  console.log('[Scheduler] Recordatorios de inactividad activados (9am Buenos Aires).');
}
