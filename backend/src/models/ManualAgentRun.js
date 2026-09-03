import { DataTypes } from 'sequelize';

export function ManualAgentRunModel(sequelize) {
  return sequelize.define('ManualAgentRun', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    cicloId: { type: DataTypes.UUID, allowNull: false },
    organizacionId: { type: DataTypes.UUID, allowNull: false },
    fase: { type: DataTypes.STRING, allowNull: false },
    estado: { type: DataTypes.STRING, allowNull: false, defaultValue: 'ejecutando' },
    modelo: { type: DataTypes.STRING, allowNull: true },
    entrada: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    salida: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    error: { type: DataTypes.TEXT, allowNull: true },
    iniciadoEn: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    finalizadoEn: { type: DataTypes.DATE, allowNull: true }
  }, { tableName: 'ManualAgentRuns' });
}
