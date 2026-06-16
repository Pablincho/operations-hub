'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('BugReports', 'tipo', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'bug'
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('BugReports', 'tipo');
  }
};
