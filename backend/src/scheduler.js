import cron from 'node-cron';
import { Op } from 'sequelize';
import { Usuario, CheckinSession } from './models/index.js';
import { sendRecordatorioEmail, sendRecordatorioSupervisorEmail } from './services/emailService.js';

const DIAS_USUARIO = 5;
const DIAS_SUPERVISOR = 10;
const MAX_DIARIOS = 20;

async function checkInactivos() {
  const usuarios = await Usuario.findAll({
    where: { activo: true, rol: 'operativo' }
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

      try {
        await sendRecordatorioEmail(usuario.email, usuario.nombre, funcion, diasSinActividad);
      } catch (err) {
        console.error(`[Scheduler] Error enviando recordatorio a ${usuario.email}:`, err.message);
      }

      if (diasSinActividad >= DIAS_SUPERVISOR && usuario.supervisorId) {
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
