# Local Development Guide

This guide walks through setting up the monorepo on a new machine.

## Prerequisites

- Node.js **18.x** (LTS)
- npm **9.x** or later
- MongoDB (local) or MongoDB Atlas connection string
- Redis (optional for development; in-memory mock is used when `NODE_ENV=development`)

## Repository Bootstrap

```bash
# Clone
git clone https://github.com/Spyboss/tmr-tradinglanka.git
cd tmr-tradinglanka

# Install workspace dependencies
npm install
npm install --prefix backend
npm install --prefix frontend

# Copy environment templates
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Update the `.env` files with values from [Environment Configuration](./environment.md).

## Running Backend & Frontend Together

From repository root:

```bash
npm run dev
```

This runs `npm run dev --prefix backend` and `npm run dev --prefix frontend` concurrently.

- API listens on `http://localhost:8080`
- SPA listens on `http://localhost:5173`

### Running Services Individually

```bash
# Backend only
cd backend
npm run dev

# Frontend only
cd frontend
npm run dev
```

### Backend TypeScript Build

```bash
cd backend
npm run build
npm start
```

### Frontend Production Build Preview

```bash
cd frontend
npm run build
npm run preview
```

## Database Helpers

- MongoDB collections are created automatically on first write.
- Use the admin bootstrap endpoint to create an admin:

```bash
curl -X POST http://localhost:8080/api/auth/create-admin \
  -H "Content-Type: application/json" \
  -d '{
        "setupKey": "<ADMIN_SETUP_KEY>",
        "email": "admin@example.com",
        "password": "ChangeMe123!",
        "name": "System Admin"
      }'
```

## Seeding Bike Models

Sample script available at `backend/src/scripts/createAdmin.ts` (for admin) and `backend/src/scripts/addTricycleModel.mjs` for quick bike model inserts. Run with `node --loader ts-node/esm <script>` for TypeScript scripts.

## Testing & Linting

```bash
# Backend tests
cd backend
npm run test

# Backend lint
npm run lint
```

The frontend currently relies on manual QA. Cypress/Playwright integration is planned (see [Roadmap](../product/roadmap.md)).

## Troubleshooting

| Issue | Fix |
| --- | --- |
| `ENCRYPTION_KEY` length error | Ensure `.env` contains a 32+ character key. |
| `MongoDB connection error` | Confirm `MONGODB_URI` is correct and accessible. |
| `Redis connection failed` in dev | Backend falls back to in-memory mock automatically. |
| CORS blocked when calling API | Update `CORS_ORIGINS` in backend `.env` to include frontend origin. |
| PDF font errors on Windows | Install fonts referenced in `backend/templates` or run inside Docker. |
