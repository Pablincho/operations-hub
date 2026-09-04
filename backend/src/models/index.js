import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Sequelize } from 'sequelize';
import { OrganizacionModel } from './Organizacion.js';
import { UsuarioModel } from './Usuario.js';
import { KnowledgeEntryModel } from './KnowledgeEntry.js';
import { CheckinSessionModel } from './CheckinSession.js';
import { ChatSessionModel } from './ChatSession.js';
import { ChatMessageModel } from './ChatMessage.js';
import { ManualModel } from './Manual.js';
import { BugReportModel } from './BugReport.js';
import { ManualCycleModel } from './ManualCycle.js';
import { ManualQuestionModel } from './ManualQuestion.js';
import { ManualAgentRunModel } from './ManualAgentRun.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const sslConfig = process.env.DATABASE_URL?.includes('railway') ||
  process.env.DATABASE_URL?.includes('render') ||
  process.env.NODE_ENV === 'production'
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {};

export const db = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    ...sslConfig,
    // Sin keepAlive el proxy corta las conexiones ociosas por su cuenta y la siguiente
    // consulta vuelve a pagar el handshake completo.
    keepAlive: true
  },
  // Abrir una conexión nueva cuesta cerca de 1,8 s de handshake TLS. Con los valores
  // por defecto (min: 0, idle: 10 s) el pool se vaciaba tras diez segundos sin tráfico,
  // así que en una app de poco uso casi toda visita lo pagaba de nuevo. Manteniendo un
  // piso de conexiones vivas, ese costo se paga una sola vez al arrancar.
  pool: { max: 10, min: 2, idle: 300000, acquire: 30000, evict: 30000 }
});

export const Organizacion = OrganizacionModel(db);
export const Usuario = UsuarioModel(db);
export const KnowledgeEntry = KnowledgeEntryModel(db);
export const CheckinSession = CheckinSessionModel(db);
export const ChatSession = ChatSessionModel(db);
export const ChatMessage = ChatMessageModel(db);
export const Manual = ManualModel(db);
export const BugReport = BugReportModel(db);
export const ManualCycle = ManualCycleModel(db);
export const ManualQuestion = ManualQuestionModel(db);
export const ManualAgentRun = ManualAgentRunModel(db);

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

Usuario.hasMany(Manual, { foreignKey: 'usuarioId' });
Manual.belongsTo(Usuario, { foreignKey: 'usuarioId' });

Organizacion.hasMany(Manual, { foreignKey: 'organizacionId' });
Manual.belongsTo(Organizacion, { foreignKey: 'organizacionId' });

Organizacion.hasMany(ManualCycle, { foreignKey: 'organizacionId' });
ManualCycle.belongsTo(Organizacion, { foreignKey: 'organizacionId' });
Usuario.hasMany(ManualCycle, { as: 'manualCyclesComoOcupante', foreignKey: 'ocupanteId' });
ManualCycle.belongsTo(Usuario, { as: 'ocupante', foreignKey: 'ocupanteId' });
Usuario.hasMany(ManualCycle, { as: 'manualCyclesComoSupervisor', foreignKey: 'supervisorId' });
ManualCycle.belongsTo(Usuario, { as: 'supervisorCiclo', foreignKey: 'supervisorId' });

ManualCycle.hasMany(ManualQuestion, { as: 'preguntasCiclo', foreignKey: 'cicloId' });
ManualQuestion.belongsTo(ManualCycle, { foreignKey: 'cicloId' });
ManualCycle.hasMany(ManualAgentRun, { as: 'ejecucionesAgentes', foreignKey: 'cicloId' });
ManualAgentRun.belongsTo(ManualCycle, { foreignKey: 'cicloId' });

ManualCycle.hasMany(Manual, { foreignKey: 'cicloId' });
Manual.belongsTo(ManualCycle, { foreignKey: 'cicloId' });
ManualCycle.hasMany(CheckinSession, { foreignKey: 'cicloId' });
CheckinSession.belongsTo(ManualCycle, { foreignKey: 'cicloId' });
ManualCycle.hasMany(KnowledgeEntry, { foreignKey: 'cicloId' });
KnowledgeEntry.belongsTo(ManualCycle, { foreignKey: 'cicloId' });

Usuario.belongsTo(Usuario, { as: 'supervisor', foreignKey: 'supervisorId' });
Usuario.hasMany(Usuario, { as: 'supervisees', foreignKey: 'supervisorId' });

Usuario.hasMany(BugReport, { foreignKey: 'usuarioId' });
BugReport.belongsTo(Usuario, { foreignKey: 'usuarioId' });
Organizacion.hasMany(BugReport, { foreignKey: 'organizacionId' });
BugReport.belongsTo(Organizacion, { foreignKey: 'organizacionId' });
