import { Sequelize } from 'sequelize';
import { OrganizacionModel } from './Organizacion.js';
import { UsuarioModel } from './Usuario.js';
import { KnowledgeEntryModel } from './KnowledgeEntry.js';
import { CheckinSessionModel } from './CheckinSession.js';
import { ChatSessionModel } from './ChatSession.js';
import { ChatMessageModel } from './ChatMessage.js';

const sslConfig = process.env.DATABASE_URL?.includes('railway') ||
  process.env.DATABASE_URL?.includes('render') ||
  process.env.NODE_ENV === 'production'
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {};

export const db = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: sslConfig
});

export const Organizacion = OrganizacionModel(db);
export const Usuario = UsuarioModel(db);
export const KnowledgeEntry = KnowledgeEntryModel(db);
export const CheckinSession = CheckinSessionModel(db);
export const ChatSession = ChatSessionModel(db);
export const ChatMessage = ChatMessageModel(db);

// Associations
Organizacion.hasMany(Usuario, { foreignKey: 'organizacionId' });
Usuario.belongsTo(Organizacion, { foreignKey: 'organizacionId' });

Organizacion.hasMany(KnowledgeEntry, { foreignKey: 'organizacionId' });
KnowledgeEntry.belongsTo(Organizacion, { foreignKey: 'organizacionId' });

Usuario.hasMany(KnowledgeEntry, { foreignKey: 'usuarioId' });
KnowledgeEntry.belongsTo(Usuario, { foreignKey: 'usuarioId' });

Usuario.hasMany(CheckinSession, { foreignKey: 'usuarioId' });
CheckinSession.belongsTo(Usuario, { foreignKey: 'usuarioId' });

Usuario.hasMany(ChatSession, { foreignKey: 'usuarioId' });
ChatSession.belongsTo(Usuario, { foreignKey: 'usuarioId' });

ChatSession.hasMany(ChatMessage, { foreignKey: 'chatSessionId' });
ChatMessage.belongsTo(ChatSession, { foreignKey: 'chatSessionId' });
