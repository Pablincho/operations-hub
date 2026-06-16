'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('BugReports', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.literal('gen_random_uuid()'), primaryKey: true },
      usuarioId: { type: Sequelize.UUID, allowNull: true, references: { model: 'Usuarios', key: 'id' }, onDelete: 'SET NULL' },
      organizacionId: { type: Sequelize.UUID, allowNull: false },
      texto: { type: Sequelize.TEXT, allowNull: false },
      pagina: { type: Sequelize.STRING, allowNull: true },
      imagen: { type: Sequelize.TEXT, allowNull: true },
      resuelto: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('BugReports');
  }
};
