import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { db, Organizacion } from './src/models/index.js';
import authRoutes from './src/routes/auth.js';
import usuariosRoutes from './src/routes/usuarios.js';
import knowledgeRoutes from './src/routes/knowledge.js';
import checkinRoutes from './src/routes/checkin.js';
import chatRoutes from './src/routes/chat.js';
import manualRoutes from './src/routes/manual.js';
import manualCycleRoutes from './src/routes/manualCycles.js';
import bugsRoutes from './src/routes/bugs.js';
import { initScheduler } from './src/scheduler.js';

const app = express();
const PORT = process.env.PORT || 3001;

// Railway hace de reverse proxy delante de la app: confiamos en un solo hop
// para que req.ip refleje al cliente real (X-Forwarded-For) y el rate limit
// se aplique por usuario, no compartido entre toda la organización.
app.set('trust proxy', 1);

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Demasiadas solicitudes. Intentá nuevamente más tarde.' }
});
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: 'Demasiados intentos. Intentá nuevamente en 15 minutos.' }
});

const allowedOrigins = new Set([
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_ALT,
  'https://operations-hub-frontend-production.up.railway.app'
].filter(Boolean).map((origin) => origin.replace(/\/$/, '')));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalizedOrigin = origin.replace(/\/$/, '');
    // Allow any localhost port for local development
    if (/^http:\/\/localhost(:\d+)?$/.test(normalizedOrigin)) return callback(null, true);
    if (allowedOrigins.has(normalizedOrigin)) return callback(null, true);
    callback(new Error('CORS no permitido'));
  },
  credentials: true
}));
app.use(helmet());
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/recover', authLimiter);
app.use('/api/bugs', express.json({ limit: '7mb' }));
app.use(express.json({ limit: '256kb' }));

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/manual', manualRoutes);
app.use('/api/manual-cycles', manualCycleRoutes);
app.use('/api/bugs', bugsRoutes);

app.get('/api/health', (_req, res) => res.json({ success: true, data: 'OK' }));

// 404 handler
app.use((_req, res) => res.status(404).json({ success: false, error: 'Ruta no encontrada' }));

async function initOrganizacion() {
  const org = await Organizacion.findOne({ where: { slug: 'donemilio' } });
  if (!org) {
    await Organizacion.create({ nombre: 'Don Emilio', slug: 'donemilio' });
    console.log('Organización Don Emilio creada');
  }
}

async function start() {
  try {
    await db.authenticate();
    console.log('DB conectada');

    await db.sync();
    console.log('Modelos sincronizados');

    await initOrganizacion();

    initScheduler();

    app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
  } catch (err) {
    console.error('Error al iniciar:', err.message);
    process.exit(1);
  }
}

start();
