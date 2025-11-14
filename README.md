# TMR Trading Lanka Business Management System

End-to-end ERP for Sri Lankan motorcycle dealerships. The platform runs in production at TMR Trading Lanka, covering sales, inventory, quotations, and compliance workflows with a TypeScript stack.
<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-18.2.0-blue.svg)

**A comprehensive business management solution for motorcycle dealerships**

[🚀 Live Demo](https://tmr-tradinglanka.pages.dev) • [📖 Documentation](./docs) • [🐛 Report Bug](https://github.com/your-repo/issues)

</div>
<p align="center">
  <a href="https://tmr-tradinglanka.pages.dev">🌐 Production SPA</a> ·
  <a href="./docs">📚 Documentation</a> ·
  <a href="https://github.com/Spyboss/tmr-tradinglanka/issues">🐛 Issue Tracker</a>
</p>

---

## Table of Contents

1. [Why It Exists](#why-it-exists)
2. [Who Uses It](#who-uses-it)
3. [Tech Stack](#tech-stack)
4. [Key Features](#key-features)
5. [Architecture](#architecture)
6. [Screenshots](#screenshots)
7. [Getting Started](#getting-started)
8. [Environment Variables](#environment-variables)
9. [Running Locally](#running-locally)
10. [Testing](#testing)
11. [Folder Structure](#folder-structure)
12. [Database Model Snapshot](#database-model-snapshot)
13. [API Overview](#api-overview)
14. [Security & Compliance](#security--compliance)
15. [Roadmap](#roadmap)
16. [Maintainer](#maintainer)

## Why It Exists

TMR needed to replace spreadsheet-driven processes for billing electric motorcycles, tracking stock, and handling insurance quotations. The system centralises customer data, enforces permission boundaries, and produces compliant PDFs that align with Sri Lankan regulatory expectations.

## Who Uses It

| Persona | Responsibilities |
| --- | --- |
| Dealer principal | Reviews daily sales, outstanding balances, and stock positions. |
| Sales executives | Create bills, manage advance payments, and deliver invoices to customers. |
| Inventory coordinators | Register incoming bikes, update status, and reconcile sold stock. |
| Insurance liaisons | Prepare quotations, convert to invoices, and send branded PDFs to insurers. |
| Operations admins | Manage branding, user access, and system preferences. |

Further business context lives in [`docs/overview/business-context.md`](./docs/overview/business-context.md).

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, Ant Design, TailwindCSS |
| Backend | Node.js 18, Express, TypeScript, Mongoose |
| Data | MongoDB Atlas, Redis Cloud |
| Infrastructure | Cloudflare Pages, Railway |
| PDFs | PDFKit templates with dynamic branding |

## Key Features

- **Billing** – End-to-end bill lifecycle with encrypted NIC/address storage, RMV/advance tracking, and PDF exports.
- **Inventory** – Model catalogue, single-unit inventory with status tracking, analytics endpoints, and PDF reporting.
- **Quotations & Invoices** – Multi-line quotations, conversion to invoices, insurance metadata, and branded PDF downloads.
- **Branding Control** – Admin-managed logo, colour, and address metadata powering SPA chrome and documents.
- **User Preferences & Activity** – Personalised themes/language plus structured audit logs for major actions.
- **Compliance Toolkit** – GDPR export/delete flows, rate limiting, and optional email verification enforcement.

## Architecture

```
┌──────────────────────────────────────────────────┐
│                 Cloudflare Pages                  │
│ React SPA • Auth cookie storage • CDN edge cache  │
└──────────────▲───────────────────────────────────┘
               │ HTTPS (browser)
┌──────────────┴──────────────┐
│   Railway (Express API)     │◄─────┐ BullMQ-ready workers share Redis
│   Autoscaled containers     │      │
└──────────────▲──────────────┘      │
               │                     │
               │ HTTPS (private)     │
┌──────────────┴──────────────┐      │
│    MongoDB Atlas (M10)      │◄─────┘ Redis Cloud (sessions, rate limits, verification)
│  Customer data encrypted    │
└──────────────────────────────┘
```

Detailed design notes live in [`docs/architecture/README.md`](./docs/architecture/README.md).

## Screenshots

> Screenshots are captured during release reviews and stored in the project wiki. Replace this block with updated imagery when publishing externally.

- Dashboard overview – _pending update_
- Bill creation form – _pending update_
- Inventory analytics – _pending update_

## Getting Started

```bash
git clone https://github.com/Spyboss/tmr-tradinglanka.git
cd tmr-tradinglanka
npm install
npm install --prefix backend
npm install --prefix frontend
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Refer to [`docs/setup/local-development.md`](./docs/setup/local-development.md) for a full walkthrough.

## Environment Variables

Backend and frontend environment keys are documented in [`docs/setup/environment.md`](./docs/setup/environment.md). Sample `.env` files live alongside each application.

## Running Locally

```bash
# Run API + SPA together
npm run dev

# Backend only
npm run dev --prefix backend

# Frontend only
npm run dev --prefix frontend
```

- API: `http://localhost:8080`
- SPA: `http://localhost:5173`

Use the admin bootstrap endpoint to create an initial admin:

```bash
curl -X POST http://localhost:8080/api/auth/create-admin \
  -H "Content-Type: application/json" \
  -d '{"setupKey":"local-admin-setup-key","email":"admin@example.com","password":"ChangeMe123!"}'
```

## Testing

```bash
cd backend
npm run lint
npm run test
```

Frontend automated tests are on the roadmap; manual QA covers core journeys today.

## Folder Structure

```
.
├── backend/        # Express API (TypeScript)
├── frontend/       # React SPA (Vite)
├── docs/           # Comprehensive documentation set
├── CHANGELOG.md    # Release log (Keep a Changelog)
├── docker-compose.yml
└── package.json    # Workspace scripts
```

## Database Model Snapshot

| Collection | Key Fields |
| --- | --- |
| `users` | email, role, hashed password, loginAttempts, accountLocked |
| `bills` | billNumber, status, encrypted NIC/address, inventoryItemId, owner |
| `bike_inventory` | bikeModelId, motorNumber, status, addedBy, billId |
| `bike_models` | name, price, leasing flags |
| `quotations` | quotationNumber, type, encrypted customer info, items[], owner |
| `branding` | dealerName, primaryColor, logoUrl |
| `userpreferences` | theme, language, notification + dashboard preferences |
| `useractivities` | activity type, metadata, timestamp |

Full ERD available in [`docs/architecture/data-model.md`](./docs/architecture/data-model.md).

## API Overview

The REST API is described in [`docs/architecture/api-reference.md`](./docs/architecture/api-reference.md). Highlights:

- `/api/auth/*` – authentication, profile, verification.
- `/api/bills` – CRUD + PDF endpoints.
- `/api/inventory` – item management, analytics, report PDFs.
- `/api/quotations` – quotations, invoice conversion, customer suggestions.
- `/api/branding` – dealer branding config (admin-only mutating operations).
- `/api/user/*` – preferences and activity history.
- `/api/gdpr/*` – data export/delete flows.

## Security & Compliance

- AES encryption for NIC, address, and phone fields (`ENCRYPTION_KEY`).
- JWT access tokens + Redis-backed refresh tokens with revocation on logout/password change.
- Ownership enforcement ensures staff only see their own bills/quotations unless admin.
- Optional email verification enforcement with rate-limited resend endpoints.
- GDPR export (encrypted ZIP) and delete flows to satisfy customer data requests.
- Rate limiting on login/registration/verification endpoints; suspicious IP monitoring with optional webhook alerts.

More detail lives in [`docs/operations/security.md`](./docs/operations/security.md).

## Roadmap

Active roadmap and future expansion plans:

- [`docs/product/roadmap.md`](./docs/product/roadmap.md)
- [`docs/product/future-expansion.md`](./docs/product/future-expansion.md)

## Maintainer

**Uminda H. Aberathne** – Full-stack developer from Sri Lanka.

- Portfolio: [uminda.dev](https://uminda.dev)
- Email: `hello@uminda.dev`
- GitHub: [@Spyboss](https://github.com/Spyboss)
