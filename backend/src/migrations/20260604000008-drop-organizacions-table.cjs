'use strict';

module.exports = {
  async up(queryInterface) {
    // Migrate any data from the Sequelize-generated table to the migration-created one
    await queryInterface.sequelize.query(`
      INSERT INTO "Organizaciones" (id, nombre, slug, config, "createdAt", "updatedAt")
      SELECT id, nombre, slug, config, "createdAt", "updatedAt"
      FROM "Organizacions"
      WHERE id NOT IN (SELECT id FROM "Organizaciones")
    `).catch(() => {}); // Organizacions may not exist in all environments

    await queryInterface.sequelize.query(
      `DROP TABLE IF EXISTS "Organizacions" CASCADE`
    );
  },
  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('Organizacions', {
      id: { type: Sequelize.UUID, primaryKey: true },
      nombre: { type: Sequelize.STRING, allowNull: false },
      slug: { type: Sequelize.STRING, allowNull: false, unique: true },
      config: { type: Sequelize.JSONB, defaultValue: {} },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  }
};
