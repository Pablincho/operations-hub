import { DataTypes } from 'sequelize';

export function UsuarioModel(sequelize) {
  return sequelize.define('Usuario', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      // La unicidad ya no es una constraint de columna: se aplica con un índice único
      // parcial (solo entre usuarios activos) en la migración 20260905000025, para que
      // desactivar a alguien libere su email para un usuario nuevo.
      type: DataTypes.STRING,
      allowNull: false,
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
