'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('KnowledgeEntries');
    if (!tableDesc.bloque) {
      await queryInterface.addColumn('KnowledgeEntries', 'bloque', {
        type: Sequelize.STRING(10),
        allowNull: true
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('KnowledgeEntries', 'bloque');
  }
};
