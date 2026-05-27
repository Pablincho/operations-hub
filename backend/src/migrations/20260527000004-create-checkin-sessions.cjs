'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('CheckinSessions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      usuarioId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'Usuarios', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE'
      },
      funcion: { type: Sequelize.STRING, allowNull: false },
      fecha: { type: Sequelize.DATEONLY, allowNull: false },
      preguntas: { type: Sequelize.JSONB, defaultValue: [] },
      completado: { type: Sequelize.BOOLEAN, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('CheckinSessions', ['usuarioId', 'funcion', 'fecha']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('CheckinSessions');
  }
};
