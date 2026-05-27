import { DataTypes } from 'sequelize';

export function ChatSessionModel(sequelize) {
  return sequelize.define('ChatSession', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    usuarioId: {
      type: DataTypes.UUID,
      allowNull: false
    }
  });
}
