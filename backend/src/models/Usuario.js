import { DataTypes } from 'sequelize';

export function UsuarioModel(sequelize) {
  return sequelize.define('Usuario', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: { isEmail: true }
    },
    passwordHash: {
      type: DataTypes.STRING,
      allowNull: false
    },
    mustChangePassword: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false
    },
    resetTokenHash: {
      type: DataTypes.STRING,
      allowNull: true
    },
    resetTokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false
    },
    rol: {
      type: DataTypes.ENUM('superadmin', 'admin', 'operativo'),
      allowNull: false,
      defaultValue: 'operativo'
    },
    funciones: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: []
    },
    organizacionId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    activo: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    supervisorId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    enVacaciones: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    autoaprobarManual: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    }
  });
}
