'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE TYPE "enum_Manuales_estado" AS ENUM ('borrador', 'vigente')`
    ).catch(() => {});

    await queryInterface.createTable('Manuales', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      usuarioId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Usuarios', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      organizacionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Organizaciones', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      funcion: { type: Sequelize.STRING, allowNull: false },
      version: { type: Sequelize.STRING, defaultValue: '1.0' },
      estado: {
        type: Sequelize.ENUM('borrador', 'vigente'),
        defaultValue: 'borrador'
      },
      contenido: { type: Sequelize.JSONB, defaultValue: {} },
      generadoEn: { type: Sequelize.DATE, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Manuales');
    await queryInterface.sequelize.query(
      `DROP TYPE IF EXISTS "enum_Manuales_estado"`
    ).catch(() => {});
  }
};
