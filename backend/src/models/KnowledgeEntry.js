import { DataTypes } from 'sequelize';
import { encrypt, decrypt, isEncrypted } from '../utils/crypto.js';

export function KnowledgeEntryModel(sequelize) {
  const KnowledgeEntry = sequelize.define('KnowledgeEntry', {
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

  KnowledgeEntry.addHook('beforeCreate', (inst) => {
    if (inst.esSensible && inst.contenido && !isEncrypted(inst.contenido)) {
      inst.contenido = encrypt(inst.contenido)
    }
  });

  KnowledgeEntry.addHook('beforeUpdate', (inst) => {
    if (inst.esSensible && inst.contenido && !isEncrypted(inst.contenido)) {
      inst.contenido = encrypt(inst.contenido)
    }
  });

  KnowledgeEntry.addHook('afterFind', (result) => {
    const items = Array.isArray(result) ? result : result ? [result] : []
    for (const item of items) {
      if (item.contenido && isEncrypted(item.contenido)) {
        item.contenido = decrypt(item.contenido)
      }
    }
  });

  return KnowledgeEntry;
}
