'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE TYPE "enum_Usuarios_rol" AS ENUM ('superadmin', 'admin', 'operativo')`
    ).catch(() => {}); // ignore if already exists

    await queryInterface.createTable('Usuarios', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      email: { type: Sequelize.STRING, allowNull: false, unique: true },
      passwordHash: { type: Sequelize.STRING, allowNull: false },
      nombre: { type: Sequelize.STRING, allowNull: false },
      rol: {
        type: Sequelize.ENUM('superadmin', 'admin', 'operativo'),
        allowNull: false,
        defaultValue: 'operativo'
      },
      funciones: { type: Sequelize.ARRAY(Sequelize.STRING), defaultValue: [] },
      organizacionId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Organizaciones', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      activo: { type: Sequelize.BOOLEAN, defaultValue: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('Usuarios');
  }
};
