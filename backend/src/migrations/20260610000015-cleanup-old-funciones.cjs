'use strict';

module.exports = {
  async up(queryInterface) {
    // Remove old function names from users' funciones arrays (varchar[] column)
    await queryInterface.sequelize.query(`
      UPDATE "Usuarios"
      SET funciones = ARRAY(
        SELECT unnest(funciones)
        EXCEPT
        SELECT unnest(ARRAY['Impuestos', 'Sueldos', 'Autorizaciones']::varchar[])
      )
      WHERE funciones && ARRAY['Impuestos', 'Sueldos', 'Autorizaciones']::varchar[];
    `);

    // Delete knowledge entries for old functions
    await queryInterface.sequelize.query(`
      DELETE FROM "KnowledgeEntries"
      WHERE funcion IN ('Impuestos', 'Sueldos', 'Autorizaciones');
    `);

    // Delete checkin sessions for old functions
    await queryInterface.sequelize.query(`
      DELETE FROM "CheckinSessions"
      WHERE funcion IN ('Impuestos', 'Sueldos', 'Autorizaciones');
    `);

    // Delete manuals for old functions
    await queryInterface.sequelize.query(`
      DELETE FROM "Manuales"
      WHERE funcion IN ('Impuestos', 'Sueldos', 'Autorizaciones');
    `);
  },

  async down(queryInterface) {
    // No rollback — deleted data cannot be recovered
  }
};
