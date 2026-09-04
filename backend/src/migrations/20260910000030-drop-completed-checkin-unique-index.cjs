'use strict';

// La migración 26 reemplazó el índice original por éste, que también impedía
// más de una tanda completada por día. La migración 28 sólo conocía el nombre
// previo, por lo que en instalaciones existentes el bloqueo sobrevivía.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'DROP INDEX IF EXISTS "checkin_sessions_user_function_date_cycle_unique"'
    );
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "checkin_sessions_user_function_date_cycle_unique"
      ON "CheckinSessions" ("usuarioId", funcion, fecha, COALESCE("cicloId", '00000000-0000-0000-0000-000000000000'::uuid))
    `);
  }
};
