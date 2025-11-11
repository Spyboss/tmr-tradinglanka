# 📚 TMR Trading Lanka Documentation

**Comprehensive documentation for the TMR Trading Lanka Business Management System**

## 🗂️ Documentation Structure

### 🏗️ **Development**
Complete guides for developers working on the system.

| Document | Description |
|----------|-------------|
| [Setup Guide](./development/setup.md) | Development environment setup |
| [Workflow](./development/workflow.md) | Development processes and standards |
| [New Features](./development/new-features.md) | Feature development guidelines |

### 🗄️ **Data Models**
Detailed documentation of all database schemas and relationships.

| Document | Description |
|----------|-------------|
| [Models Overview](./models/README.md) | Complete model documentation index |
| [Bill Schema](./models/bill-schema.md) | Sales transaction data structure |
| [Inventory Schema](./models/inventory-schema.md) | Bike inventory management |
| [Bike Models](./models/bike-models.md) | Available motorcycle models |

### 🔄 **Business Workflows**
Documentation of business processes and operational procedures.

| Document | Description |
|----------|-------------|
| [Workflow Overview](./workflow/README.md) | Business process documentation |
| [Bill Generation](./workflow/bill-generation.md) | Sales transaction workflow |
| [Inventory Management](./workflow/inventory-management.md) | Stock management processes |
| [Payment Types](./workflow/payment-types.md) | Payment processing workflows |

## 🚀 Quick Navigation

### For Developers
- **Getting Started**: [Development Setup](./development/setup.md)
- **API Reference**: [Backend README](../backend/README.md)
- **Frontend Guide**: [Frontend README](../frontend/README.md)

### For Business Users
- **User Manual**: [Business Workflows](./workflow/README.md)
- **Feature Guide**: [System Overview](../README.md#-core-features)

### For System Administrators
- **Deployment**: [Production Setup](../README.md#-production-deployment)
- **Security**: [Data Models](./models/README.md#-security-features)

## 📋 System Overview

The TMR Trading Lanka Business Management System powers end-to-end dealership operations in production. The platform combines:

- **Sales Management** – Orchestrates bill creation, approval, and settlement with guardrails that enforce payment rules and downstream notifications.
- **Inventory Control** – Synchronizes live stock counts from floor entries, inbound shipments, and sales deductions, keeping data consistent across devices.
- **Quotation System** – Generates and tracks insurance quotations that can be converted into finalized sales records while preserving audit history.
- **User Management** – Applies role-based access and session controls tied to Redis, ensuring staff access aligns with dealership policies.
- **Reporting** – Produces PDF summaries and dashboards highlighting KPIs such as daily sales, outstanding balances, and vehicle turnover.
- **Security & Compliance** – Protects sensitive customer information through encrypted storage, multi-factor authentication, and tamper-proof audit logs.

## 🔧 Technical Architecture

```
┌───────────────────────────────────────┐
│            Cloudflare Pages           │
│ React SPA + CDN + Zero-Trust previews │
└──────────────▲────────────────────────┘
               │ HTTPS
┌──────────────┴──────────────┐
│ Railway (Node.js + Express) │◄───┐  Background workers (BullMQ)
│ Autoscaling API containers  │    │
└──────────────▲──────────────┘    │
               │                    │ Redis Cloud (queues, sessions)
               │                    │
┌──────────────┴──────────────┐    │
│      MongoDB Atlas (M10)    │────┘
│ Encrypted operational data  │
└──────────────────────────────┘
```

This architecture favors stateless application servers backed by managed services. Cloudflare handles static asset delivery and shields the API with WAF rules, while Railway manages container lifecycle, health checks, and environment secrets. MongoDB Atlas runs as a multi-region replica set; Redis Cloud offers low-latency caching and queues with auto-failover.

### Production Data Flow
1. **Client interaction** – Users authenticate through the SPA, which stores only short-lived access tokens. Every request includes a correlation ID for tracing.
2. **API processing** – Express controllers validate payloads, consult Redis for session/permission data, then execute domain logic against MongoDB collections. Bill mutations emit domain events onto Redis queues.
3. **Async workloads** – Worker processes consume those events to render PDFs, reconcile inventory, and dispatch email/SMS notifications. Outcomes are written back to MongoDB and surfaced to the frontend through polling endpoints.
4. **Observability** – Pino logs with context metadata stream to Railway log drains, while Prometheus metrics power dashboards tracking throughput, latency, and queue depth.

### Operational Considerations
- **Scaling** – Railway auto-scales API containers when sustained CPU > 70%. Redis-backed sessions keep new instances stateless. Worker concurrency is tuned to ensure queue latency stays under 15 seconds during peak sales hours.
- **Resilience** – MongoDB replica failover is tolerated through retry logic with jitter. Redis outages trigger a feature flag that restricts new bill creation while allowing read operations.
- **Deployments** – GitHub Actions builds both frontend and backend. Successful staging deployments promote to production via manual approval after smoke tests verify bill creation, inventory sync, and PDF rendering.
- **Monitoring & Alerts** – Better Stack monitors `/healthz` endpoints and queue depth. PagerDuty alerts on elevated 5xx rates, job retries, or MongoDB lag > 45s. Runbooks in this documentation describe recovery steps.
- **Security Posture** – Cloudflare Access enforces SSO on admin routes. Secrets are rotated quarterly via Railway's environment manager, and database encryption keys are held in AWS KMS.

### Dependencies
- **External**: Cloudflare Pages, Railway, MongoDB Atlas, Redis Cloud, Cloudflare R2 (artifact storage), Better Stack (monitoring), PagerDuty (alerts), AWS KMS (encryption keys).
- **Internal**: Shared validation library in `/backend/src/shared`, domain events in `/backend/src/modules`, and PDF templates stored alongside frontend assets.

Understanding these components and their interactions is essential for diagnosing production issues and evaluating future enhancements.

## 📞 Support

For technical support or questions:

- **Developer**: [Uminda Herath](https://github.com/Spyboss)
- **Email**: contact@uhadev.com
- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](../LICENSE) file for details.
