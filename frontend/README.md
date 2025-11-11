# 🎨 TMR Trading Lanka Frontend

**Modern React frontend for the TMR Trading Lanka Business Management System**

[![React](https://img.shields.io/badge/react-18.2.0-blue.svg)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/vite-5.1.4-purple.svg)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/tailwindcss-3.4.1-blue.svg)](https://tailwindcss.com/)
[![Ant Design](https://img.shields.io/badge/antd-5.15.1-blue.svg)](https://ant.design/)

## 🌟 Overview

A modern, responsive React application that provides an intuitive interface for managing motorcycle dealership operations. Built with cutting-edge technologies and designed for optimal user experience across all devices.

## ✨ Key Features

### 🎯 **User Experience**
- **Responsive Design** - Optimized for desktop, tablet, and mobile
- **Dark/Light Themes** - Consistent theming with user preferences
- **Real-time Updates** - Live data synchronization
- **Accessibility** - WCAG compliant interface design

### 🏢 **Business Modules**
- **Dashboard** - Comprehensive overview with quick actions
- **Sales Management** - Bill creation, editing, and tracking
- **Inventory Control** - Real-time stock management
- **Quotation System** - Professional estimates and invoices
- **Reporting** - Advanced analytics and PDF generation

### 🔐 **Security & Auth**
- **JWT Authentication** - Secure token-based authentication
- **Role-based Access** - Granular permission controls
- **Session Management** - Automatic token refresh
- **Protected Routes** - Secure navigation system

## 🛠️ Technology Stack

- **Framework**: React 18 with functional components and hooks
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: TailwindCSS for utility-first styling
- **UI Components**: Ant Design for professional components
- **Routing**: React Router DOM for client-side navigation
- **State Management**: React Context API for global state
- **HTTP Client**: Axios for API communication
- **Notifications**: React Hot Toast for user feedback

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+
- **npm** or **yarn**

### Development Setup

1. **Navigate to frontend**
   ```bash
   cd frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment setup**
   ```bash
   # Create .env file
   echo "VITE_API_URL=http://localhost:8080" > .env
   ```

4. **Start development server**
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:5173`

## 📁 Project Structure

```
frontend/
├── public/                 # Static assets
│   ├── _headers           # Cloudflare headers
│   ├── _redirects         # Cloudflare redirects
│   └── robots.txt         # SEO configuration
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── Navbar.jsx     # Navigation component
│   │   ├── ProtectedRoute.jsx
│   │   └── ...
│   ├── pages/             # Page components
│   │   ├── Dashboard.jsx  # Main dashboard
│   │   ├── auth/          # Authentication pages
│   │   ├── Inventory/     # Inventory management
│   │   └── ...
│   ├── contexts/          # React contexts
│   │   ├── AuthContext.jsx
│   │   └── ThemeContext.jsx
│   ├── services/          # API services
│   │   └── api.js         # Axios configuration
│   ├── config/            # Configuration files
│   └── tests/             # Test files
├── tailwind.config.js     # TailwindCSS configuration
├── vite.config.js         # Vite configuration
└── package.json           # Dependencies and scripts
```

## 🌐 Production Deployment

### Cloudflare Pages

The frontend is deployed on Cloudflare Pages with automatic deployments from GitHub.

**Build Configuration:**
- **Build Command**: `npm run build`
- **Build Directory**: `dist`
- **Node Version**: 18

**Environment Variables:**
```env
VITE_API_URL=https://tmr-production.up.railway.app
VITE_APP_NAME=TMR Trading Lanka
```

### Performance Optimizations

- **Code Splitting** - Automatic route-based splitting
- **Tree Shaking** - Unused code elimination
- **Asset Optimization** - Compressed images and fonts
- **CDN Delivery** - Global content distribution

## 🎨 Theming & Styling

### TailwindCSS Configuration

The project uses a custom TailwindCSS configuration with:
- **Dark mode support** - Class-based theme switching
- **Custom color palette** - Brand-consistent colors
- **Responsive breakpoints** - Mobile-first design
- **Component utilities** - Reusable style patterns

### Ant Design Integration

- **Theme customization** - Consistent with brand colors
- **Dark mode support** - Automatic theme switching
- **Component overrides** - Custom styling for specific needs

## 🧪 Testing

```bash
# Run tests (when configured)
npm run test

# Lint code
npm run lint
```

## 📄 License

MIT - see [LICENSE](../LICENSE) for details.
