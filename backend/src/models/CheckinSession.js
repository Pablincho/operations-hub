import { DataTypes } from 'sequelize';

export function CheckinSessionModel(sequelize) {
  return sequelize.define('CheckinSession', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    funcion: {
      type: DataTypes.STRING,
      allowNull: false
    },
    fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    preguntas: {
      type: DataTypes.JSONB,
      defaultValue: []
      // array of { pregunta: string, respuesta: string, respondida: boolean }
    },
    completado: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  });
}
