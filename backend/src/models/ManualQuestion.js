import { DataTypes } from 'sequelize';

export function ManualQuestionModel(sequelize) {
  return sequelize.define('ManualQuestion', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    cicloId: { type: DataTypes.UUID, allowNull: false },
    organizacionId: { type: DataTypes.UUID, allowNull: false },
    texto: { type: DataTypes.TEXT, allowNull: false },
    bloque: { type: DataTypes.STRING, allowNull: false, defaultValue: 'B4' },
    tema: { type: DataTypes.STRING, allowNull: true },
    objetivo: { type: DataTypes.TEXT, allowNull: true },
    origen: { type: DataTypes.STRING, allowNull: false, defaultValue: 'agente' },
    prioridad: { type: DataTypes.STRING, allowNull: false, defaultValue: 'normal' },
    estado: { type: DataTypes.STRING, allowNull: false, defaultValue: 'propuesta' },
    orden: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    fuentes: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    aprobadaPor: { type: DataTypes.UUID, allowNull: true },
    aprobadaEn: { type: DataTypes.DATE, allowNull: true },
    checkinSessionId: { type: DataTypes.UUID, allowNull: true }
  }, { tableName: 'ManualQuestions' });
}
