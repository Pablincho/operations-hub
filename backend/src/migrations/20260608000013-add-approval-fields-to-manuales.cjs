'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDesc = await queryInterface.describeTable('Manuales');
    const cols = [
      ['notaEnvio',    { type: Sequelize.TEXT, allowNull: true }],
      ['observaciones',{ type: Sequelize.TEXT, allowNull: true }],
      ['aprobadoPor',  { type: Sequelize.UUID, allowNull: true }],
      ['aprobadoEn',   { type: Sequelize.DATE, allowNull: true }]
    ];
    for (const [name, def] of cols) {
      if (!tableDesc[name]) {
        await queryInterface.addColumn('Manuales', name, def);
      }
    }
  },
  async down(queryInterface) {
    for (const col of ['notaEnvio', 'observaciones', 'aprobadoPor', 'aprobadoEn']) {
      await queryInterface.removeColumn('Manuales', col);
    }
  }
};
