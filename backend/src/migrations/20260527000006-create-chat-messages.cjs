'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      `CREATE TYPE "enum_ChatMessages_rol" AS ENUM ('user', 'assistant')`
    ).catch(() => {});

    await queryInterface.createTable('ChatMessages', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      chatSessionId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'ChatSessions', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE'
      },
      rol: { type: Sequelize.ENUM('user', 'assistant'), allowNull: false },
      contenido: { type: Sequelize.TEXT, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('ChatMessages', ['chatSessionId']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('ChatMessages');
  }
};
