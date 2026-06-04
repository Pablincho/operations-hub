'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('Usuarios');

    if (!table.mustChangePassword) {
      await queryInterface.addColumn('Usuarios', 'mustChangePassword', {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
      });
    }

    if (!table.resetTokenHash) {
      await queryInterface.addColumn('Usuarios', 'resetTokenHash', {
        type: Sequelize.STRING,
        allowNull: true
      });
    }

    if (!table.resetTokenExpiresAt) {
      await queryInterface.addColumn('Usuarios', 'resetTokenExpiresAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('Usuarios');

    if (table.resetTokenExpiresAt) {
      await queryInterface.removeColumn('Usuarios', 'resetTokenExpiresAt');
    }
    if (table.resetTokenHash) {
      await queryInterface.removeColumn('Usuarios', 'resetTokenHash');
    }
    if (table.mustChangePassword) {
      await queryInterface.removeColumn('Usuarios', 'mustChangePassword');
    }
  }
};
