# 🚀 TMR Trading Lanka Backend API

**Enterprise-grade backend API for the TMR Trading Lanka Business Management System**

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/typescript-5.8.3-blue.svg)](https://www.typescriptlang.org/)
[![Express](https://img.shields.io/badge/express-4.18.2-lightgrey.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/mongodb-6.3.0-green.svg)](https://www.mongodb.com/)

## 🌟 Overview

This is the backend API that powers the TMR Trading Lanka Business Management System. Built with modern technologies and enterprise-grade security, it provides a robust foundation for managing sales, inventory, quotations, and user operations.

## ✨ Key Features

### 🏢 **Business Operations**
- **Sales Management** - Complete bill lifecycle management
- **Inventory Control** - Real-time stock tracking and analytics
- **Quotation System** - Insurance claims and estimate management
- **Customer Management** - Secure customer data handling

### 🔐 **Security & Compliance**
- **Field-level Encryption** - Sensitive data protection
- **JWT Authentication** - Secure token-based auth with refresh tokens
- **Rate Limiting** - API abuse prevention
- **GDPR Compliance** - Complete data protection framework
- **Activity Logging** - Comprehensive audit trails

### 📊 **Advanced Features**
- **PDF Generation** - Professional document creation
- **Real-time Analytics** - Business intelligence and reporting
- **Batch Operations** - Efficient bulk data processing
- **Role-based Access** - Granular permission system

## 🛠️ Technology Stack

- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with comprehensive middleware
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with refresh token rotation
- **Security**: Helmet, CORS, Rate limiting, Data encryption
- **Logging**: Winston with structured logging
- **Testing**: Vitest for unit and integration tests
- **Deployment**: Railway with Docker containerization

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **MongoDB** (Atlas recommended)
- **Git**

### Local Development

1. **Clone and navigate**
   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start development server**
  ```bash
  npm run dev
  ```

The API will be available at `http://localhost:8080`

## 🔧 Environment Variables

The backend requires the following environment variables. Copy `backend/.env.example` to `.env` and fill in values.

| Name | Required | Description |
|------|----------|-------------|
| `NODE_ENV` | Yes | Set to `development` locally and `production` in Railway/Cloud. |
| `PORT` | No | API port, defaults to `8080`. |
| `MONGODB_URI` | Yes | MongoDB connection string. Backend fails fast in production if missing. |
| `MONGODB_DB_NAME` | No | Database name. Defaults to `tmr` if unset. |
| `JWT_SECRET` | Yes | At least 32 characters. Backend warns in dev and fails fast in prod if shorter. |
| `ENCRYPTION_KEY` | Yes | At least 32 characters. Backend fails fast if shorter. |
| `REDIS_URL` | Yes (prod) | Redis connection string for token revocation and rate limiting. Optional in dev (uses mock). |
| `CORS_ORIGINS` | No | Comma-separated allowed origins. Defaults to safe list if unset. |
| `COOKIE_SECRET` | No | Secret for signing cookies where applicable. |
| `LOG_LEVEL` | No | `error`, `warn`, `info`, `http`, `verbose`, `debug`, `silly`. Defaults to `info`. |
| `LEGACY_REFRESH_ACCEPT` | No | `true`/`false`. Default `true`. Accept legacy refresh tokens stored as raw keys in Redis; sessions migrate on first use. |
| `EMAIL_VERIFICATION_ENABLED` | No | Feature flag. Default `false`. When `true`, enables email verification endpoints. |
| `VERIFICATION_TOKEN_TTL_MINUTES` | No | Token expiration in minutes. Default `30`. |
| `PUBLIC_BASE_URL` | No | Frontend base URL used to build verification links. Default `https://tmr-tradinglanka.pages.dev`. |
| `EMAIL_PROVIDER` | No | Mailer provider: `resend` or `console`. Default `console`. |
| `EMAIL_FROM` | No | From address for emails. Default `TMR Trading Lanka <no-reply@gunawardanamotors.lk>`. |
| `RESEND_API_KEY` | No | API key for Resend provider. |

### Quick Start Recap

1. `cp .env.example .env`
2. Edit `.env` with your values (ensure `MONGODB_URI`, `JWT_SECRET`, `ENCRYPTION_KEY` are set)
3. `npm install`
4. `npm run dev`

### Docker Development

```bash
docker-compose up
```

This starts both the API and MongoDB services in containers.

## 📋 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/login` | User login |
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | User logout |
| POST | `/api/auth/verify/request` | Request email verification (no-op if disabled) |
| POST | `/api/auth/verify/confirm` | Confirm email verification (no-op if disabled) |

### Bills Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/bills` | Get all bills with filtering |
| GET | `/api/bills/:id` | Get bill by ID |
| POST | `/api/bills` | Create new bill |
| PUT | `/api/bills/:id` | Update bill |
| DELETE | `/api/bills/:id` | Delete bill |
| GET | `/api/bills/:id/pdf` | Generate PDF |

### Inventory Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inventory` | Get inventory with filters |
| GET | `/api/inventory/summary` | Get inventory summary |
| GET | `/api/inventory/analytics` | Get inventory analytics |
| POST | `/api/inventory` | Add inventory item |
| POST | `/api/inventory/batch` | Batch add items |
| PUT | `/api/inventory/:id` | Update inventory item |
| DELETE | `/api/inventory/:id` | Delete inventory item |

### Quotations
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/quotations` | Get all quotations |
| GET | `/api/quotations/:id` | Get quotation by ID |
| POST | `/api/quotations` | Create quotation |
| PUT | `/api/quotations/:id` | Update quotation |
| DELETE | `/api/quotations/:id` | Delete quotation |

### User Management
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/user/profile` | Get user profile |
| PUT | `/api/user/profile` | Update profile |
| GET | `/api/user/activity` | Get user activity |
| DELETE | `/api/gdpr/delete-account` | Delete user account |

## 🌐 Production Deployment

### Railway Deployment

1. **Connect Repository**
   - Link your GitHub repository to Railway
   - Configure automatic deployments

2. **Environment Variables**
   ```env
   MONGODB_URI=mongodb+srv://...
   JWT_SECRET=your-jwt-secret
   ENCRYPTION_KEY=your-encryption-key
   REDIS_URL=redis://<user>:<password>@<host>:<port>
   NODE_ENV=production
   ```

   Notes:
   - Access tokens are signed JWTs using `JWT_SECRET`.
   - Refresh tokens are random opaque strings stored in Redis and do not use `JWT_REFRESH_SECRET`.
   - Ensure `REDIS_URL` is set for refresh token storage and rate limiting.

3. **Build Configuration**
   - Railway automatically detects the Node.js app
   - Uses the `npm run build:prod` script
   - Serves from the `dist` directory

### Health Monitoring

- **Health Check**: `GET /api/health`
- **Metrics**: Built-in performance monitoring
- **Logging**: Structured logs with Winston

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage
```

## 📄 License

MIT - see [LICENSE](../LICENSE) for details.
## 🔐 Crypto & Tokens

- Access tokens: signed JWT (`HS256`) using `JWT_SECRET`.
- Token IDs and random values: `node:crypto` `randomBytes(32)` hex.
- Refresh tokens: opaque strings, rotated on refresh; stored in Redis.
- Hashing: `sha256(secret + value)` where `secret = JWT_SECRET`.
- Compatibility: When `LEGACY_REFRESH_ACCEPT=true` (default), refresh verification accepts either the new salted-hash key or the legacy raw token key in Redis. If a legacy token is used, the API revokes the old key, issues a new refresh token hashed the new way, and sets it in the cookie.