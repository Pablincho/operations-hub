# REMI — Registro de Experiencia y Memoria Institucional

Sistema de captura y documentación de conocimiento de puesto para Don Emilio (agropecuaria).
Proyecto piloto: documentar los puestos operativos a través de check-ins adaptativos y generar manuales automáticamente con IA.

---

## 1. Stack Tecnológico

### Frontend
- React 19 + Vite
- React Router 7
- Tailwind CSS v4
- shadcn/ui (componentes manuales en `frontend/src/components/ui/`)
- Axios
- `@react-pdf/renderer` — exportación PDF del manual

### Backend
- Node.js + Express (ESM)
- Sequelize ORM + PostgreSQL
- JWT (8h) para autenticación
- bcryptjs para hash de contraseñas
- OpenAI SDK (GPT-4o)
- Resend SDK — emails transaccionales

### Deploy
- Railway (frontend y backend separados)

---

## 2. Arquitectura General

- `frontend/`: app React (UI, rutas, auth client, páginas).
- `backend/`: API REST, modelos, reglas de negocio, IA.
- `.env` en la raíz del repo, consumido por frontend (via Vite) y backend (via `backend/loadEnv.js`).
- `backend/src/config/database.cjs`: config de Sequelize CLI con dotenv path correcto (`../../../.env`).

---

## 3. Modelos de Datos

### Usuario
- `id`, `email`, `passwordHash`, `nombre`, `rol` (superadmin/admin/operativo)
- `funciones` (array de strings)
- `organizacionId`, `activo`
- `mustChangePassword`, `resetTokenHash`, `resetTokenExpiresAt`
- `supervisorId` (FK nullable a Usuario — N+1 para flujo de aprobación)

### KnowledgeEntry
- `id`, `organizacionId`, `funcion`, `categoria`, `titulo`, `contenido`
- `bloque` (nullable: B2/B3/B4/B5/B6 — bloque del manual al que pertenece)
- `esSensible`, `usuarioId`

### CheckinSession
- `id`, `usuarioId`, `funcion`, `fecha` (DATEONLY)
- `preguntas` (JSONB: `[{pregunta, bloque, respuesta, respondida}]`)
- `completado`

### Manual
- `id`, `usuarioId`, `organizacionId`, `funcion`
- `version` (string: 'Borrador', '1.0', '1.1', etc.)
- `estado` (ENUM: borrador / en_revision / vigente / obsoleto)
- `contenido` (JSONB: `{B2: "texto...", B4: "texto...", ...}`)
- `generadoEn`, `notaEnvio`, `observaciones`, `aprobadoPor`, `aprobadoEn`

### Organizacion
- `id`, `nombre`, `slug`, `config`
- Tabla: `Organizaciones` (tableName explícito en el modelo para evitar conflicto con Sequelize auto-plural)

### ChatSession / ChatMessage
- Sesiones de chat del asistente IA por usuario

---

## 4. Módulos Implementados (REMI)

### Módulo 1 — Captura de Conocimiento ✅
- 10 preguntas iniciales de onboarding por función, etiquetadas por bloque (B2-B6)
- 3 preguntas diarias adaptativas generadas por IA, enfocadas en el bloque con menos cobertura
- Límite de 20 días de check-in diario por función
- Indicador de progreso % visible al ocupante (meta: 60 entradas = 100%)
- Preguntas organizadas por bloques del manual:
  - B2: Funciones y responsabilidades
  - B3: Perfil del puesto
  - B4: Procesos y procedimientos
  - B5: Relaciones e interfaces
  - B6: Herramientas y sistemas

### Módulo 2 — Generación del Manual ✅
- Generación automática con GPT-4o por bloque
- Vista previa integrada en el check-in (bloques colapsables)
- Exportación PDF con logo de Don Emilio, metadata, texto justificado, número de página
- Pie de página: "Registro de Experiencia y Memoria Institucional (REMI) · Don Emilio"

### Módulo 3 — Control de Versiones ✅
- Versionado automático: 'Borrador' → '1.0' en primer envío → '1.1' en ediciones post-aprobación
- Estados: borrador / en_revision / vigente / obsoleto
- Al regenerar: versión anterior archivada como 'obsoleto', nunca eliminada
- Historial de versiones visible al ocupante

### Módulo 4 — Aprobación ✅
- Asignación de N+1 (supervisor) por usuario desde el panel Admin
- Ocupante envía el manual con nota opcional → estado cambia a 'en_revision', versión asignada '1.0'
- Página "Revisiones" para admins/superadmins: lista de manuales pendientes con bloques expandibles
- Supervisor puede Aprobar (→ vigente) o Devolver con observaciones (→ borrador)
- Emails transaccionales: envío, aprobación, devolución
- Bloqueo de edición mientras el manual está 'en_revision'
- Observaciones del revisor visibles al ocupante en el check-in

---

## 5. Autenticación y Seguridad

### Flujo de contraseña
- Primer login: `mustChangePassword = true` → obligado a cambiar contraseña
- Checklist en tiempo real de requisitos (8 chars, mayúscula, minúscula, número)
- Indicador de coincidencia de contraseñas en tiempo real
- Toggle de visibilidad en todos los campos de contraseña

### Recuperación de contraseña
- Código de 6 dígitos (solo numérico en el input), válido 15 minutos
- Enviado por email via Resend desde `donemilio@email.tropabot.com`
- Siempre devuelve mensaje genérico (no revela si el email existe)
- En dev: código visible en la consola del backend

### Roles y permisos
- `superadmin`: acceso total, puede crear admins, ver entradas sensibles
- `admin`: gestión de usuarios, puede asignar supervisores, revisar manuales
- `operativo`: solo sus funciones asignadas, no puede ver entradas sensibles de otras funciones
- Entradas sensibles (`esSensible: true`): solo editables/eliminables por superadmin

---

## 6. Endpoints

### Auth
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/first-password`
- `POST /api/auth/recover/request`
- `POST /api/auth/recover/reset`

### Usuarios
- `GET /api/usuarios`
- `POST /api/usuarios`
- `GET /api/usuarios/default-password`
- `PATCH /api/usuarios/:id/funciones`
- `PATCH /api/usuarios/:id/activo`
- `PATCH /api/usuarios/:id/password`
- `PATCH /api/usuarios/:id/supervisor`
- `DELETE /api/usuarios/:id`

### Check-in
- `GET /api/checkin/hoy` — sesiones de hoy + onboardingStatus + dailyCounts + entryCounts
- `POST /api/checkin/iniciar`
- `POST /api/checkin/:id/responder`
- `GET /api/checkin/progreso` (admin+)

### Knowledge
- `GET /api/knowledge`
- `POST /api/knowledge`
- `PUT /api/knowledge/:id`
- `DELETE /api/knowledge/:id`

### Manual
- `GET /api/manual/pendientes` (admin+)
- `GET /api/manual/:funcion`
- `GET /api/manual/:funcion/historial`
- `POST /api/manual/:funcion/generar`
- `POST /api/manual/:funcion/enviar`
- `POST /api/manual/:id/aprobar` (admin+)
- `POST /api/manual/:id/devolver` (admin+)

### Chat
- `GET /api/chat/session`
- `POST /api/chat/session`
- `POST /api/chat/mensaje`

---

## 7. Migraciones (en orden)

```
20260527000001-create-organizaciones.cjs
20260527000002-create-usuarios.cjs
20260527000003-create-knowledge-entries.cjs
20260527000004-create-checkin-sessions.cjs
20260527000005-create-chat-sessions.cjs
20260527000006-create-chat-messages.cjs
20260602000007-add-password-flow-fields-to-usuarios.cjs
20260604000008-drop-organizacions-table.cjs        ← elimina tabla duplicada Organizacions
20260605000009-add-bloque-to-knowledge-entries.cjs
20260605000010-create-manuales.cjs
20260608000011-update-manuales-estado-enum.cjs     ← agrega en_revision y obsoleto
20260608000012-add-supervisorid-to-usuarios.cjs
20260608000013-add-approval-fields-to-manuales.cjs
```

Para correr: `cd backend && npm run migrate`

---

## 8. Variables de Entorno

### Backend
- `DATABASE_URL`
- `JWT_SECRET`
- `OPENAI_API_KEY`
- `RESEND_API_KEY` — SDK de Resend para emails
- `PORT` (default 3001)
- `NODE_ENV`
- `FRONTEND_URL`, `FRONTEND_URL_ALT`
- `DEFAULT_USER_PASSWORD` — contraseña temporal para nuevos usuarios

### Frontend
- `VITE_API_URL`

---

## 9. Seed de Usuarios (backend/index.js)

Se ejecuta en cada arranque. Crea la org "Don Emilio" y los usuarios seed si no existen.
Si un usuario seed existe y tiene `mustChangePassword = true`, sincroniza el hash al `DEFAULT_USER_PASSWORD` actual.
Si tiene `mustChangePassword = false`, lo fuerza a cambiar en el próximo login.

Usuarios seed:
- `danilomarchisone@gmail.com` — superadmin
- `arielzsilavecz@gmail.com` — admin
- `pablodo@gmail.com` — admin

---

## 10. Email (Resend)

From: `Don Emilio <donemilio@email.tropabot.com>`
Dominio: `email.tropabot.com`

Emails implementados:
- Recuperación de contraseña (código 6 dígitos)
- Manual enviado a revisión (al supervisor)
- Manual aprobado (al ocupante)
- Manual devuelto con observaciones (al ocupante)

---

## 11. Páginas del Frontend

- `/login` — autenticación, primer ingreso, recuperación de contraseña
- `/dashboard` — bienvenida, accesos rápidos, progreso por función
- `/checkin` — check-in por función, vista del manual, envío a aprobación
- `/asistente` — chat IA con base de conocimiento
- `/mi-area` — base de conocimiento manual (CRUD)
- `/admin` — gestión de usuarios, asignación de funciones y supervisores (admin+)
- `/revisiones` — manuales pendientes de aprobación (admin+)

---

## 12. Puestos Don Emilio (Piloto)

- N+1: Danilo Marchisone (Gerente General / superadmin)
- N: Agustín Paolini (Tesorería)
- N: Jorgelina Scantamburlo (Coordinadora Administración y Finanzas)
- N: Antonella Pacetti (Coordinadora Operaciones Agropecuarias)
- N: Christian Bianqui (Impositivo)
- N: Santiago Rudy (Administrativo Junior)
- N: Melina Vironi (RRHH)
- N: Matías Barboza (Administrativo El Coro)

Funciones disponibles en el sistema: Tesorería, Impuestos, Sueldos, Autorizaciones.

---

## 13. Notas Técnicas

- `db.sync()` sin `alter` — nunca altera tablas existentes. Usar migraciones para cambios de esquema.
- El modelo `Organizacion` tiene `tableName: 'Organizaciones'` explícito para evitar conflicto con auto-plural de Sequelize.
- `backend/src/config/database.cjs` usa `require('path').resolve(__dirname, '../../../.env')` para encontrar el .env desde el CLI de Sequelize.
- Entradas sensibles en knowledge: el backend devuelve `_bloqueado: true` (no `redactado`) cuando el contenido está restringido.
- PDF generado client-side con `@react-pdf/renderer`. Logo via Cloudinary con `f_png` para compatibilidad.
