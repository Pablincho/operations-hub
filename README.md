# REMI: Registro de Experiencia y Memoria Institucional

Aplicación para capturar conocimiento operativo mediante check-ins, generar manuales de puesto con IA y gestionar su revisión y versionado.

## Estructura

- `frontend/`: React 19, Vite y Tailwind CSS.
- `backend/`: Express, Sequelize y PostgreSQL.
- `CLAUDE.md`: descripción funcional y arquitectura detallada.

## Desarrollo local

Requisitos: Node.js 20.19 o superior y PostgreSQL.

1. Configurar `.env` en la raíz usando las variables documentadas en `CLAUDE.md`.
2. Instalar dependencias con `npm install` dentro de `backend/` y `frontend/`.
3. Ejecutar migraciones con `npm run migrate` dentro de `backend/`.
4. Iniciar backend y frontend con `npm run dev` en cada directorio.

## Validaciones

Backend: `npm run lint`, `npm test` y `npm audit --omit=dev`.

Frontend: `npm run lint`, `npm run build` y `npm audit --omit=dev`.

## Reglas de seguridad relevantes

- Los usuarios operativos solo acceden a sus funciones asignadas.
- Los permisos y el estado activo se validan contra la base en cada petición autenticada.
- Las entradas sensibles se cifran en PostgreSQL y nunca se envían al proveedor de IA.
- El borrado de usuarios es lógico: se desactivan y se conserva su conocimiento e historial.
- Los cambios de esquema se realizan mediante migraciones; `db.sync()` no reemplaza ese proceso.
