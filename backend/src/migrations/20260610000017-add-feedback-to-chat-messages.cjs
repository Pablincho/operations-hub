'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('ChatMessages', 'feedback', {
      type: Sequelize.ENUM('up', 'down'),
      allowNull: true,
      defaultValue: null
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('ChatMessages', 'feedback');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_ChatMessages_feedback";');
  }
};
