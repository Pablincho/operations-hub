'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_Manuales_estado" ADD VALUE IF NOT EXISTS 'en_revision'`
    );
    await queryInterface.sequelize.query(
      `ALTER TYPE "enum_Manuales_estado" ADD VALUE IF NOT EXISTS 'obsoleto'`
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE "Manuales" ALTER COLUMN "version" SET DEFAULT 'Borrador'`
    );
  },
  async down(queryInterface) {
    // PostgreSQL doesn't support removing ENUM values; revert default only
    await queryInterface.sequelize.query(
      `ALTER TABLE "Manuales" ALTER COLUMN "version" SET DEFAULT '1.0'`
    );
  }
};
