# CotizApp

Monorepo con:
- Backend: Node.js + TypeScript + Express + PostgreSQL
- Frontend: React + Vite

## Requisitos

- Node.js (recomendado: LTS)
- npm
- PostgreSQL (local o Docker)

## Instalación

Desde la raíz del repo:

```bash
npm install
```

## Configuración

### Backend (.env)

El backend carga el archivo `.env` desde la raíz del repo.

Archivo: `.env`

Variables mínimas:
- `PORT` (default 3001)
- `FRONTEND_ORIGIN` (ej: `http://localhost:5173`)
- Base de datos:
  - O bien `DATABASE_URL` (si usás URL completa)
  - O bien `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
  - `DB_SSL` (`true` / `false`)
- Auth:
  - `JWT_SECRET`
  - `JWT_EXPIRES_IN` (ej: `8h`)

### Frontend (Vite env)

El frontend usa `VITE_API_BASE_URL` para apuntar al backend.

- Default: `http://localhost:3001`
- Opcional: crear `apps/frontend/.env` con:

```bash
VITE_API_BASE_URL=http://localhost:3001
```

## Base de datos

1) Crear la base de datos (ejemplo):
- DB: `cotizapp`
- Usuario: `postgres` (o el que uses)

2) Ejecutar migración (crea/actualiza tablas)

La migración corre el SQL idempotente de `db/schema.sql` (usa `CREATE TABLE IF NOT EXISTS` y `ALTER TABLE ... IF NOT EXISTS`).

Desde la raíz:

```bash
npm run migrate -w @cotizapp/backend
```

## Seed de admin

Crea/actualiza el usuario admin en la tabla `usuarios` (upsert por `email`).

Variables opcionales en `.env`:
- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Ejecutar:

```bash
npm run seed:admin -w @cotizapp/backend
```

## Iniciar la aplicación

### Backend

```bash
npm run dev:backend
```

Endpoints útiles:
- `GET /health`
- `GET /health/db`

### Frontend

```bash
npm run dev:frontend
```

Por defecto Vite usa el puerto `5173`. Si está ocupado, Vite puede levantar en otro puerto (ej: `5174`); en ese caso actualizá `FRONTEND_ORIGIN` en el `.env` del backend para que coincida con el `Origin` del navegador.

## Problemas comunes

### CORS bloqueado en /login

Si el navegador muestra un error de CORS, asegurate de que:
- `FRONTEND_ORIGIN` en `.env` coincide con el origen real del frontend (ej: `http://localhost:5173` o `http://localhost:5174`)

### Seed/migrate falla con ECONNREFUSED

Significa que el backend no puede conectarse a PostgreSQL:
- PostgreSQL no está levantado
- `DB_HOST/DB_PORT` no coinciden
- credenciales/DB incorrectas
