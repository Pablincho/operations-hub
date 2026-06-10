'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ChatSessions', 'nombre', {
      type: Sequelize.STRING(100),
      allowNull: true
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ChatSessions', 'nombre');
  }
};
