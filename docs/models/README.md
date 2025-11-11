# 🗄️ Data Models Documentation

This directory contains comprehensive documentation for all data models used in the TMR Trading Lanka Business Management System.

## 📋 Available Models

| Model | Description | File |
|-------|-------------|------|
| **Bills** | Sales transaction records | [`bill-schema.md`](./bill-schema.md) |
| **Inventory** | Bike inventory management | [`inventory-schema.md`](./inventory-schema.md) |
| **Bike Models** | Available motorcycle models | [`bike-models.md`](./bike-models.md) |
| **Quotations** | Insurance claims and estimates | [`quotation-schema.md`](./quotation-schema.md) |
| **Users** | User accounts and authentication | [`user-schema.md`](./user-schema.md) |

## 📖 Documentation Structure

Each model document includes:

- **Schema Definition** - Complete field specifications
- **Data Types** - Field types and constraints
- **Relationships** - Connections to other models
- **Business Logic** - Associated rules and validations
- **Security** - Encryption and access controls
- **Examples** - Sample data and usage patterns

## 🔗 Model Relationships

```
Users ──┐
        ├── Bills ──── Inventory
        ├── Quotations
        └── UserActivity

BikeModels ──── Inventory ──── Bills
```

## 🔐 Security Features

- **Field Encryption** - Sensitive data protection
- **Access Controls** - Role-based data access
- **Audit Trails** - Change tracking and logging
- **Data Validation** - Input sanitization and validation