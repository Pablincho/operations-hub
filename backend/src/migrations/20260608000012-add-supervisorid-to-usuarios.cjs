'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('Usuarios');
    if (!tableDesc.supervisorId) {
      await queryInterface.addColumn('Usuarios', 'supervisorId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Usuarios', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE'
      });
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Usuarios', 'supervisorId');
  }
};
