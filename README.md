# 🏍️ TMR Trading Lanka Business Management System

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-18.2.0-blue.svg)

**A comprehensive business management solution for motorcycle dealerships**

[🚀 Live Demo](https://tmr-tradinglanka.pages.dev) • [📖 Documentation](./docs) • [🐛 Report Bug](https://github.com/your-repo/issues)

</div>

---

## 🌟 Overview

What started as a simple bill generator has evolved into a **full-featured business management system** specifically designed for motorcycle dealerships. This enterprise-grade solution handles everything from sales and inventory to quotations and comprehensive reporting.

## 🏗️ Architecture

```
┌───────────────────────────────────────────────────────────────────────┐
│                           Cloudflare Pages                             │
│ React + Vite SPA │ Build hooks from main │ Edge caching + image proxy │
└────────────▲───────────────────────────────────────────────────────────┘
             │ HTTPS (public)
             │
┌────────────┴─────────────┐      ┌──────────────────────────────────────┐
│  Cloudflare Zero Trust   │─────►│   Railway (Node.js + Express API)    │
│  Origin rules + WAF      │      │   Horizontal scaling via autoscaler  │
└────────────▲─────────────┘      │   Background jobs (bullmq + Redis)   │
             │                    └────────────▲─────────────────────────┘
             │ HTTPS (private)
             │
┌────────────┴─────────────┐      ┌──────────────────────────────────────┐
│      MongoDB Atlas       │◄────►│    Redis Cloud (session cache)       │
│  Global cluster (M10)    │      │  Ephemeral queues + rate limiting    │
└──────────────────────────┘      └──────────────────────────────────────┘
```

- **Frontend**: Modern React SPA with TypeScript, TailwindCSS, and Ant Design. Built on every merge to `main` and pushed to Cloudflare Pages, which serves static assets through its global CDN while enforcing Zero-Trust access for preview environments.
- **Backend**: Node.js + TypeScript API deployed to Railway using rolling deployments. Railway manages container restarts on crash and auto-scales between 0–3 instances based on CPU and memory. Express routes use layered middleware for auth, rate limiting, and validation.
- **Data Layer**: MongoDB Atlas hosts the operational database with regional failover; encryption-at-rest and field-level encryption protect customer identity numbers and payment metadata. Redis Cloud provides ephemeral storage for sessions, job queues, and throttle counters; it is treated as a disposable cache with automatic rehydration logic in the API.
- **Deployment Flow**: GitHub Actions packages the backend and frontend. Successful test runs trigger Railway/Cloudflare deploy hooks; production promotes only after smoke checks succeed on staging URLs.
- **Operational Guardrails**: All services emit structured logs to Railway's log drains; Cloudflare analytics provide edge performance metrics. A status dashboard (Better Stack) monitors HTTP 5xx rates, queue depth, and MongoDB primary health.

## ✨ Core Features

### 🧾 **Sales Management**
- **Smart Bill Generation** - Automated calculations for different vehicle types
- **Payment Processing** - Support for cash, leasing, and advance payments
- **Status Tracking** - Real-time bill status management (pending, completed, cancelled)
- **PDF Generation** - Professional, branded invoices and receipts
- **Customer Management** - Secure customer data with encryption

### 📦 **Inventory Management**
- **Real-time Tracking** - Live inventory status across all locations
- **Batch Operations** - Efficient bulk inventory additions and updates
- **Lifecycle Management** - Track bikes from arrival to sale
- **Smart Analytics** - Inventory insights, stock alerts, and trend analysis
- **Integration** - Seamless connection with sales processes

### 💼 **Quotation System**
- **Insurance Claims** - Specialized quotations for insurance work
- **Estimate Management** - Professional estimates with conversion to invoices
- **Template System** - Standardized quotation formats
- **Client Communication** - Streamlined quotation approval workflow

### 👥 **User Management**
- **Role-based Access** - Admin, Manager, and User permission levels
- **Activity Tracking** - Comprehensive audit logs for all user actions
- **Profile Management** - User preferences and account settings
- **Security Features** - Multi-factor authentication and session management

### 📊 **Advanced Reporting**
- **Professional PDFs** - LaTeX-quality reports with company branding
- **Business Intelligence** - KPI dashboards and performance metrics
- **Inventory Reports** - Stock analysis with actionable insights
- **Financial Summaries** - Revenue tracking and payment analysis

### 🔒 **Enterprise Security**
- **Data Encryption** - Field-level encryption for sensitive information
- **GDPR Compliance** - Complete data protection and user rights
- **Rate Limiting** - API protection against abuse
- **Audit Trails** - Comprehensive activity logging

### 🎨 **Modern UI/UX**
- **Dark/Light Themes** - Consistent theming across all components
- **Responsive Design** - Optimized for desktop, tablet, and mobile
- **Accessibility** - WCAG compliant interface design
- **Real-time Updates** - Live data synchronization

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+
- **npm** or **yarn**
- **MongoDB** (Atlas recommended)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/gunawardhana-motors.git
   cd gunawardhana-motors
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   cp .env.example .env  # Configure your environment variables
   npm run dev
   ```

3. **Frontend Setup**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Access the application**
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:8080`

## 🌐 Production Deployment

### Current Infrastructure
- **Frontend**: [Cloudflare Pages](https://tmr-tradinglanka.pages.dev)
- **Backend**: [Railway](https://tmr-production.up.railway.app)
- **Database**: MongoDB Atlas with global clusters
- **CDN**: Cloudflare for optimal performance

### Runtime Topology & Data Flow
- **Request path**: The SPA calls the Railway API over HTTPS. Requests first pass through Cloudflare's WAF/Zero-Trust rules, then reach the active Railway instance. Authenticated calls validate the JWT against Redis, query MongoDB for the primary document, and publish events back to Redis queues for downstream jobs (PDF generation, email notifications).
- **Asynchronous jobs**: Long-running tasks (PDF rendering, stock reconciliation) run as BullMQ workers within the same Railway project. They consume queue messages from Redis and write results (signed URLs, inventory deltas) back into MongoDB. Failures retry with exponential backoff up to 5 attempts before surfacing alerts.
- **File storage**: Generated PDFs are persisted to Cloudflare R2 via signed upload URLs, with references stored in MongoDB. Expired artifacts are purged nightly by a scheduled worker.

### Environment Configuration

<details>
<summary><strong>Backend Environment Variables</strong></summary>

```env
# Database
MONGODB_URI=mongodb+srv://...
REDIS_URL=redis://...

# Authentication
JWT_SECRET=your-super-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Security
ENCRYPTION_KEY=your-encryption-key
CORS_ORIGINS=https://tmr-tradinglanka.pages.dev

# Application
NODE_ENV=production
PORT=8080
```
</details>

### Scalability & Resilience
- **Horizontal scaling**: Railway's autoscaler spins up additional API containers when CPU exceeds 70% for 3 minutes. The application is stateless; session data and cache layers live in Redis, so new instances can join immediately.
- **Cold starts**: Idle scaling may pause all instances overnight. Cloudflare health checks send synthetic traffic every 5 minutes to keep the API warm during business hours.
- **Failure modes**: Redis outages degrade to read-only operations—billing actions requiring queues are blocked, and the frontend surfaces maintenance banners. MongoDB failover typically completes within 30s; the API retries connections with jittered backoff.
- **Disaster recovery**: Nightly backups from MongoDB Atlas and weekly configuration exports from Cloudflare/Railway are stored in S3 with 30-day retention. Runbooks in `docs/workflow/` describe manual recovery.

### Observability & Operations
- **Logging**: Application logs use pino JSON format and ship to Railway's log drains; Cloudflare produces edge logs for cache misses. Critical actions include correlation IDs propagated via the `x-request-id` header.
- **Metrics**: Prometheus-compatible metrics are exposed at `/api/metrics` (auth-protected) and scraped by Better Stack every 60s. Key indicators include bill creation latency (p95 < 1.2s) and queue delay (< 15s).
- **Alerts**: PagerDuty incidents trigger when HTTP 5xx > 3% for 5 minutes or queue depth exceeds 200 jobs. MongoDB sends emails for replica set elections or storage pressure.
- **Debugging**: For production issues, tail logs via Railway CLI, inspect queue states with `bull-board` (behind VPN), and replay failed jobs by re-enqueueing documents via the admin console.

<details>
<summary><strong>Frontend Environment Variables</strong></summary>

```env
VITE_API_URL=https://tmr-production.up.railway.app
VITE_APP_NAME=TMR Trading Lanka
```
</details>

## 📚 Documentation

| Section | Description |
|---------|-------------|
| [📋 API Reference](./docs/api) | Complete API documentation |
| [🗄️ Database Schema](./docs/models) | Data models and relationships |
| [🔄 Workflows](./docs/workflow) | Business process documentation |
| [🛠️ Development](./docs/development) | Setup and contribution guide |

## 🔐 Cross-Origin Auth & CSRF Protection
- Cookies: In production, the `refreshToken` cookie uses `SameSite=None; Secure; HttpOnly; Path=/` to support cross-origin auth from Cloudflare Pages.
- CORS allowlist: Set `CORS_ORIGINS` (comma-separated) to control allowed origins. If unset, the backend falls back to a safe default allowlist.
- CSRF checks: The `/api/auth/refresh` and `/api/auth/logout` endpoints require an `Origin` or `Referer` header that matches the allowlist in production. Mismatches or missing headers return `403 Forbidden` and are logged with `warn`.
- No-Origin requests: Controlled by `ALLOW_NO_ORIGIN`. When `false`, requests without an `Origin` header are rejected. When unset or `true`, legacy behavior is preserved (allowed for CLI/internal tools).
- Safe fallbacks: Development behavior remains unchanged; if `CORS_ORIGINS` is not set, the existing hardcoded allowlist is used.

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./docs/development/README.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 👨‍💻 Author

**Uminda H. Aberathne** ([@Spyboss](https://github.com/Spyboss))
- 🌐 Website: [uminda.dev](https://uminda-portfolio.pages.dev)
- 📧 Email: contact@uhadev.com

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with ❤️ for TMR Trading Lanka
- Special thanks to the open-source community
- Powered by modern web technologies

---

<div align="center">
<strong>Made with ❤️ by <a href="https://github.com/Spyboss">@uhadev</a></strong>
</div>