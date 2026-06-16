import { DataTypes } from 'sequelize';

export function BugReportModel(sequelize) {
  return sequelize.define('BugReport', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    organizacionId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    texto: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    pagina: {
      type: DataTypes.STRING,
      allowNull: true
    },
    imagen: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    tipo: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'bug'
    },
    resuelto: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'BugReports'
  });
}
