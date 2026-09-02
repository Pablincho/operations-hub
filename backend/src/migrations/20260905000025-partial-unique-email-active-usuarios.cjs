'use strict';

// El delete de usuarios ahora es lógico (activo:false, ver PATCH/DELETE en usuarios.js).
// La constraint unique original sobre "email" impedía reusar el email de alguien
// desactivado para dar de alta a otra persona. La reemplazamos por un índice único
// parcial que solo exige unicidad entre usuarios activos.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "Usuarios" DROP CONSTRAINT IF EXISTS "Usuarios_email_key"
    `);
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "usuarios_email_active_unique"
      ON "Usuarios" ("email")
      WHERE "activo" = true
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP INDEX IF EXISTS "usuarios_email_active_unique"
    `);
    await queryInterface.sequelize.query(`
      ALTER TABLE "Usuarios" ADD CONSTRAINT "Usuarios_email_key" UNIQUE ("email")
    `);
  }
};
