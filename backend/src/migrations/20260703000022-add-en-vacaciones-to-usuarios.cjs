'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Usuarios', 'enVacaciones', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Usuarios', 'enVacaciones');
  }
};
