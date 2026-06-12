'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Manuales', 'bloquesEstado', {
      type: Sequelize.JSONB,
      allowNull: true
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Manuales', 'bloquesEstado');
  }
};
