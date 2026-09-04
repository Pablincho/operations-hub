'use strict';

// Una sesión completada no debe impedir que un operativo continúe respondiendo
// preguntas ya aprobadas del mismo ciclo el mismo día. Conservamos un índice de
// consultas para sesiones abiertas sin convertir registros previos incompletos en
// un bloqueo de migración.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS "checkin_sessions_user_function_date_unique"');
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS "checkin_sessions_user_function_date_cycle_unique"');
    await queryInterface.sequelize.query(`
      CREATE INDEX IF NOT EXISTS "checkin_sessions_open_per_cycle_idx"
      ON "CheckinSessions" ("usuarioId", "funcion", "cicloId")
      WHERE completado = false
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query('DROP INDEX IF EXISTS "checkin_sessions_open_per_cycle_idx"');
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "checkin_sessions_user_function_date_unique"
      ON "CheckinSessions" ("usuarioId", "funcion", "fecha")
    `);
  }
};
