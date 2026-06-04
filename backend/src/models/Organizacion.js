import { DataTypes } from 'sequelize';

export function OrganizacionModel(sequelize) {
  return sequelize.define('Organizacion', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING,
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true
    },
    config: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'Organizaciones'
  });
}
