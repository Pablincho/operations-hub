'use strict';

module.exports = {
  async up(queryInterface) {
    // Drop FK constraints added by db.sync() — not needed at DB level
    await queryInterface.sequelize.query(`
      ALTER TABLE "BugReports"
        DROP CONSTRAINT IF EXISTS "BugReports_organizacionId_fkey",
        DROP CONSTRAINT IF EXISTS "BugReports_usuarioId_fkey";
    `);
  },
  async down() {}
};
