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
      defaultValue: 'Borrador'
    },
    estado: {
      type: DataTypes.ENUM('borrador', 'en_revision', 'vigente', 'obsoleto'),
      defaultValue: 'borrador'
    },
    contenido: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    generadoEn: {
      type: DataTypes.DATE,
      allowNull: true
    },
    notaEnvio: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    aprobadoPor: {
      type: DataTypes.UUID,
      allowNull: true
    },
    aprobadoEn: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'Manuales'
  });
}
