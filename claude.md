# Operations Hub - Documento de Proyecto

## 1. Objetivo

Operations Hub es una plataforma interna para Don Emilio (agropecuaria) orientada a:

- Capturar y organizar conocimiento operativo por funcion.
- Permitir consultas con IA sobre procedimientos internos.
- Facilitar transferencia de roles y continuidad operativa.
- Ejecutar un sistema de check-in de conocimiento por etapas.

## 2. Stack Tecnologico

### Frontend

- React + Vite
- React Router
- Tailwind CSS v4
- shadcn/ui (componentes manuales)
- Axios

### Backend

- Node.js + Express (ESM)
- Sequelize ORM
- PostgreSQL
- JWT para autenticacion
- bcryptjs para hash de contrasenas
- OpenAI SDK

### Deploy

- Railway (frontend y backend separados)

## 3. Arquitectura General

- `frontend/`: app React (UI, rutas, auth client, paginas).
- `backend/`: API REST, modelos, reglas de negocio, IA.
- `.env` en la raiz del repo, consumido por frontend (via Vite) y backend (via `backend/loadEnv.js`).

## 4. Funcionalidades Implementadas

### 4.1 Autenticacion y Usuarios

- Login por email + contrasena.
- JWT con expiracion de 8 horas.
- Roles: `superadmin`, `admin`, `operativo`.
- Restricciones por rol en endpoints administrativos.
- Alta de usuarios desde Admin.
- Activacion/desactivacion de usuarios.
- Asignacion de funciones por usuario.
- Cambio de contrasena desde panel admin.

### 4.2 Primer Ingreso y Seguridad de Contrasena

Se incorporo flujo de contrasena temporal + contrasena definitiva:

- Usuario nuevo se crea con contrasena temporal.
- En primer login, se obliga cambio de contrasena (`mustChangePassword`).
- Validacion de contrasena robusta:
  - minimo 8 caracteres
  - al menos 1 mayuscula
  - al menos 1 minuscula
  - al menos 1 numero

Endpoints agregados en auth:

- `POST /api/auth/first-password`
- `POST /api/auth/recover/request`
- `POST /api/auth/recover/reset`

### 4.3 Recuperacion de Contrasena

- Solicitud de recuperacion por email.
- Generacion de codigo temporal (15 min).
- Guardado de hash del codigo y vencimiento en DB.
- Reset de contrasena con codigo + nueva contrasena.

Nota: en desarrollo se expone el codigo en respuesta para testing; en produccion no.

### 4.4 Check-in Operativo (2 Fases)

Se adapto el flujo para el requerimiento de onboarding + diario:

- Fase inicial: 10 preguntas base (una sola vez por funcion).
- Fase diaria: 3 preguntas por dia adaptativas.
- Preguntas diarias se generan considerando respuestas previas.
- UI actualizada para distinguir estado de onboarding y avance diario.

## 5. Cambios de UI/UX Implementados

- Logo Cloudinary en header principal.
- Logo Cloudinary en login.
- Favicon Cloudinary en pestana del navegador.
- Cursor tipo mano en elementos clickeables de forma global.
- Pagina de Asistente expandida al ancho disponible.

## 6. Endpoints Relevantes

### Auth

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/first-password`
- `POST /api/auth/recover/request`
- `POST /api/auth/recover/reset`

### Usuarios

- `GET /api/usuarios`
- `POST /api/usuarios`
- `PATCH /api/usuarios/:id/funciones`
- `PATCH /api/usuarios/:id/activo`
- `PATCH /api/usuarios/:id/password`
- `DELETE /api/usuarios/:id`
- `GET /api/usuarios/default-password`

### Check-in

- `GET /api/checkin/hoy`
- `POST /api/checkin/iniciar`
- `POST /api/checkin/:id/responder`
- `GET /api/checkin/progreso`

## 7. Modelo de Datos - Extensiones Recientes

Tabla `Usuarios` ahora contempla:

- `mustChangePassword` (bool)
- `resetTokenHash` (string nullable)
- `resetTokenExpiresAt` (date nullable)

## 8. Migraciones

Se creo migracion para los campos de flujo de contrasena:

- `backend/src/migrations/20260602000007-add-password-flow-fields-to-usuarios.cjs`

Esta migracion fue ajustada para ser idempotente (no rompe si columna ya existe).

## 9. Variables de Entorno Importantes

### Backend

- `DATABASE_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `PORT`
- `FRONTEND_URL`
- `DEFAULT_USER_PASSWORD`

### Frontend

- `VITE_API_URL`

Nota de seguridad: nunca versionar claves reales en git.

## 10. Problemas Detectados y Resoluciones

### CORS en local

- Error por origen `localhost:5174` no permitido.
- Se ajusto backend para permitir localhost con cualquier puerto en desarrollo.

### Conexion rechazada a `localhost:3001`

- Causa: backend caido o puerto ocupado.
- Solucion: reiniciar backend y liberar puerto cuando hubo `EADDRINUSE`.

### DEFAULT_USER_PASSWORD mostrando fallback

- Se implemento lectura robusta desde backend con fallback por prioridad.
- Endpoint dedicado para frontend admin: `GET /api/usuarios/default-password`.

## 11. Estado Actual del Proyecto

- Frontend compila correctamente.
- Backend arranca y responde health.
- Migracion de seguridad aplicada.
- Flujo de autenticacion avanzado implementado.
- Check-in 2 fases implementado.
- Branding visual incorporado (logo + favicon).

## 12. Siguientes Recomendaciones

- Integrar envio real de email para recuperacion en produccion.
- Agregar tests de integracion para auth/check-in.
- Revisar bundle del frontend (warning por tamano de chunk).
- Endurecer politicas de secretos y rotacion de claves.
