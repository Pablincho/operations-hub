'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ChatSessions', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      usuarioId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'Usuarios', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE'
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ChatSessions');
  }
};
