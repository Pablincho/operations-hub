import './loadEnv.js';
import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { db, Organizacion, Usuario } from './src/models/index.js';
import authRoutes from './src/routes/auth.js';
import usuariosRoutes from './src/routes/usuarios.js';
import knowledgeRoutes from './src/routes/knowledge.js';
import checkinRoutes from './src/routes/checkin.js';
import chatRoutes from './src/routes/chat.js';

const app = express();
const PORT = process.env.PORT || 3001;

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
app.use(express.json({ limit: '1mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/chat', chatRoutes);

app.get('/api/health', (_req, res) => res.json({ success: true, data: 'OK' }));

// 404 handler
app.use((_req, res) => res.status(404).json({ success: false, error: 'Ruta no encontrada' }));

async function initOrganizacion() {
  const FUNCIONES = ['Tesorería', 'Impuestos', 'Sueldos', 'Autorizaciones'];
  const defaultSeedPassword = process.env.DEFAULT_USER_PASSWORD || 'Bienvenido123';

  let org = await Organizacion.findOne({ where: { slug: 'donemilio' } });
  if (!org) {
    org = await Organizacion.create({ nombre: 'Don Emilio', slug: 'donemilio' });
    console.log('Organización Don Emilio creada');
  }

  const seedUsers = [
    { email: 'danilomarchisone@gmail.com', nombre: 'Danilo', rol: 'superadmin' },
    { email: 'arielzsilavecz@gmail.com', nombre: 'Ariel', rol: 'admin' },
    { email: 'pablodo@gmail.com', nombre: 'Pablo', rol: 'admin' }
  ];

  const passwordHash = await bcrypt.hash(defaultSeedPassword, 12);

  for (const u of seedUsers) {
    const exists = await Usuario.findOne({ where: { email: u.email } });
    if (!exists) {
      await Usuario.create({
        ...u,
        passwordHash,
        mustChangePassword: true,
        funciones: FUNCIONES,
        organizacionId: org.id
      });
      console.log(`Usuario ${u.nombre} creado`);
    } else if (exists.mustChangePassword) {
      // Still on temp password — sync hash to current DEFAULT_USER_PASSWORD
      await exists.update({ passwordHash });
      console.log(`Usuario ${exists.nombre}: contraseña temporal sincronizada`);
    } else {
      // Already changed their password — only force re-change
      await exists.update({ mustChangePassword: true });
      console.log(`Usuario ${exists.nombre}: mustChangePassword activado`);
    }
  }
}

async function start() {
  try {
    await db.authenticate();
    console.log('DB conectada');

    await db.sync();
    console.log('Modelos sincronizados');

    await initOrganizacion();

    app.listen(PORT, () => console.log(`Servidor en puerto ${PORT}`));
  } catch (err) {
    console.error('Error al iniciar:', err.message);
    process.exit(1);
  }
}

start();
