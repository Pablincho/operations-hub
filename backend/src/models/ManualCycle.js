import { DataTypes } from 'sequelize';
import { CYCLE_STATES } from '../manualCyclePolicy.js';

export function ManualCycleModel(sequelize) {
  return sequelize.define('ManualCycle', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    organizacionId: { type: DataTypes.UUID, allowNull: false },
    funcion: { type: DataTypes.STRING, allowNull: false },
    numero: { type: DataTypes.INTEGER, allowNull: false },
    ocupanteId: { type: DataTypes.UUID, allowNull: false },
    supervisorId: { type: DataTypes.UUID, allowNull: false },
    estado: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'configuracion',
      validate: { isIn: [CYCLE_STATES] }
    },
    temas: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    orientacion: { type: DataTypes.TEXT, allowNull: true },
    proximosTemas: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    proximaOrientacion: { type: DataTypes.TEXT, allowNull: true },
    configProximoCiclo: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
    heredarOrientacion: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    preguntasPorEntrega: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    frecuencia: { type: DataTypes.STRING, allowNull: false, defaultValue: 'diaria' },
    intervaloDias: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    objetivoPreguntas: { type: DataTypes.INTEGER, allowNull: true },
    requiereAprobacionPreguntas: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    esLegacy: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    iniciadoEn: { type: DataTypes.DATE, allowNull: true },
    relevamientoCerradoEn: { type: DataTypes.DATE, allowNull: true },
    completadoEn: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'ManualCycles',
    indexes: [{ unique: true, fields: ['organizacionId', 'funcion', 'numero'] }]
  });
}
