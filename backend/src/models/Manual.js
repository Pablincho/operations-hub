import { DataTypes } from 'sequelize';

export function ManualModel(sequelize) {
  return sequelize.define('Manual', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    organizacionId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    funcion: {
      type: DataTypes.STRING,
      allowNull: false
    },
    version: {
      type: DataTypes.STRING,
      defaultValue: '1.0'
    },
    estado: {
      type: DataTypes.ENUM('borrador', 'vigente'),
      defaultValue: 'borrador'
    },
    contenido: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    generadoEn: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'Manuales'
  });
}
