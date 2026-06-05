import { DataTypes } from 'sequelize';

export function KnowledgeEntryModel(sequelize) {
  return sequelize.define('KnowledgeEntry', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    organizacionId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    funcion: {
      type: DataTypes.STRING,
      allowNull: false
    },
    categoria: {
      type: DataTypes.STRING,
      defaultValue: 'general'
    },
    titulo: {
      type: DataTypes.STRING,
      allowNull: false
    },
    contenido: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    bloque: {
      type: DataTypes.STRING,
      allowNull: true
    },
    esSensible: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false
    }
  });
}
