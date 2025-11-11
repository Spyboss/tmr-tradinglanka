# 📋 API Reference

**Complete API documentation for the TMR Trading Lanka Business Management System**

## 🌐 Base URL

- **Production**: `https://tmr-production.up.railway.app`
- **Development**: `http://localhost:8080`

## 🔐 Authentication

All API endpoints (except health check and auth endpoints) require authentication using JWT tokens.

### Headers
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Token Refresh
Access tokens expire after 15 minutes. Use the refresh token to get new access tokens.

## 📚 API Endpoints

### 🔑 Authentication

#### POST `/api/auth/login`
User login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "role": "USER"
  },
  "accessToken": "jwt_access_token",
  "refreshToken": "jwt_refresh_token"
}
```

#### POST `/api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "nic": "123456789V",
  "address": "123 Main St",
  "phoneNumber": "+94771234567"
}
```

#### POST `/api/auth/refresh`
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refreshToken": "jwt_refresh_token"
}
```

#### POST `/api/auth/logout`
Logout and invalidate tokens.

### 🧾 Bills Management

#### GET `/api/bills`
Get all bills with optional filtering.

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `status` - Filter by status (pending, completed, cancelled)
- `billType` - Filter by type (cash, leasing)
- `search` - Search in customer name or bill number

**Response:**
```json
{
  "bills": [...],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "pages": 10
  }
}
```

#### GET `/api/bills/:id`
Get a specific bill by ID.

#### POST `/api/bills`
Create a new bill.

**Request Body:**
```json
{
  "customerName": "John Doe",
  "customerNIC": "123456789V",
  "customerAddress": "123 Main St",
  "bikeModel": "Honda CB150R",
  "motorNumber": "CB150R123456",
  "chassisNumber": "CHASSIS123456",
  "bikePrice": 450000,
  "billType": "cash",
  "isEbicycle": false,
  "isTricycle": false,
  "inventoryItemId": "inventory_item_id"
}
```

#### PUT `/api/bills/:id`
Update an existing bill.

#### DELETE `/api/bills/:id`
Delete a bill (soft delete).

#### GET `/api/bills/:id/pdf`
Generate and download PDF for a bill.

### 📦 Inventory Management

#### GET `/api/inventory`
Get inventory items with filtering.

**Query Parameters:**
- `page`, `limit` - Pagination
- `status` - Filter by status (available, reserved, sold, damaged)
- `model` - Filter by bike model
- `search` - Search in model, motor number, or chassis number

#### GET `/api/inventory/summary`
Get inventory summary by model.

**Response:**
```json
{
  "summary": [
    {
      "model": "Honda CB150R",
      "available": 5,
      "reserved": 2,
      "sold": 10,
      "damaged": 1,
      "total": 18
    }
  ]
}
```

#### GET `/api/inventory/analytics`
Get inventory analytics and insights.

#### POST `/api/inventory`
Add a new inventory item.

**Request Body:**
```json
{
  "model": "Honda CB150R",
  "motorNumber": "CB150R123456",
  "chassisNumber": "CHASSIS123456",
  "color": "Red",
  "purchasePrice": 400000,
  "sellingPrice": 450000,
  "status": "available",
  "notes": "Additional notes"
}
```

#### POST `/api/inventory/batch`
Add multiple inventory items in batch.

**Request Body:**
```json
{
  "items": [
    {
      "model": "Honda CB150R",
      "motorNumber": "CB150R123456",
      "chassisNumber": "CHASSIS123456",
      "color": "Red",
      "purchasePrice": 400000,
      "sellingPrice": 450000
    }
  ]
}
```

#### PUT `/api/inventory/:id`
Update an inventory item.

#### DELETE `/api/inventory/:id`
Delete an inventory item.

#### GET `/api/inventory/report/pdf`
Generate inventory report PDF.

### 💼 Quotations

#### GET `/api/quotations`
Get all quotations with filtering.

#### GET `/api/quotations/:id`
Get a specific quotation.

#### POST `/api/quotations`
Create a new quotation.

**Request Body:**
```json
{
  "customerName": "John Doe",
  "customerAddress": "123 Main St",
  "customerPhone": "+94771234567",
  "bikeRegNo": "ABC-1234",
  "items": [
    {
      "description": "Engine repair",
      "quantity": 1,
      "unitPrice": 15000,
      "total": 15000
    }
  ],
  "remarks": "Payment within 7 days",
  "validUntil": "2024-12-31",
  "accidentDate": "2024-01-15",
  "claimNumber": "CLAIM123",
  "insuranceCompany": "ABC Insurance"
}
```

#### PUT `/api/quotations/:id`
Update a quotation.

#### DELETE `/api/quotations/:id`
Delete a quotation.

#### GET `/api/quotations/:id/pdf`
Generate quotation PDF.

### 👥 User Management

#### GET `/api/user/profile`
Get current user profile.

#### PUT `/api/user/profile`
Update user profile.

#### GET `/api/user/activity`
Get user activity log.

### 🏍️ Bike Models

#### GET `/api/bike-models`
Get all available bike models.

#### POST `/api/bike-models`
Create a new bike model (Admin only).

#### PUT `/api/bike-models/:id`
Update a bike model (Admin only).

#### DELETE `/api/bike-models/:id`
Delete a bike model (Admin only).

### 🔒 GDPR Compliance

#### GET `/api/gdpr/data-export`
Export user data.

#### DELETE `/api/gdpr/delete-account`
Delete user account and all associated data.

## 📊 Response Formats

### Success Response
```json
{
  "success": true,
  "data": {...},
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": {...}
  }
}
```

## 🚨 Error Codes

| Code | Description |
|------|-------------|
| `UNAUTHORIZED` | Invalid or missing authentication |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `VALIDATION_ERROR` | Invalid request data |
| `RATE_LIMIT_EXCEEDED` | Too many requests |
| `INTERNAL_ERROR` | Server error |

## 🔄 Rate Limiting

- **General API**: 100 requests per 15 minutes per IP
- **Authentication**: 5 login attempts per 15 minutes per IP
- **PDF Generation**: 10 requests per minute per user
