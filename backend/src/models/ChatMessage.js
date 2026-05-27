import { DataTypes } from 'sequelize';

export function ChatMessageModel(sequelize) {
  return sequelize.define('ChatMessage', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    chatSessionId: {
      type: DataTypes.UUID,
      allowNull: false
    },
    rol: {
      type: DataTypes.ENUM('user', 'assistant'),
      allowNull: false
    },
    contenido: {
      type: DataTypes.TEXT,
      allowNull: false
    }
  });
}
