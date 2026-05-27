'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('KnowledgeEntries', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      organizacionId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'Organizaciones', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'CASCADE'
      },
      funcion: { type: Sequelize.STRING, allowNull: false },
      categoria: { type: Sequelize.STRING, defaultValue: 'general' },
      titulo: { type: Sequelize.STRING, allowNull: false },
      contenido: { type: Sequelize.TEXT, allowNull: false },
      esSensible: { type: Sequelize.BOOLEAN, defaultValue: false },
      usuarioId: {
        type: Sequelize.UUID, allowNull: false,
        references: { model: 'Usuarios', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'SET NULL'
      },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false }
    });
    await queryInterface.addIndex('KnowledgeEntries', ['organizacionId', 'funcion']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('KnowledgeEntries');
  }
};
