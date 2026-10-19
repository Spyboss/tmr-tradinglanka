import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { ConfigProvider, theme as antdTheme } from 'antd'; // Import antd ConfigProvider and theme
import { Spin } from 'antd';
import Navbar from './components/Navbar';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext'; // Import ThemeProvider and useTheme
import ProtectedRoute from './components/ProtectedRoute';
import PwaInstallPrompt from './components/PwaInstallPrompt';

// Public entry pages stay eager: they are the first thing a logged-out
// visitor touches, so they must not wait on a chunk fetch.
import Login from './pages/auth/Login';
import NotFound from './pages/NotFound';

// Everything else is code-split per route, so opening /login no longer
// downloads the bill editor, warranty form and report pages.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const BillList = lazy(() => import('./pages/BillList'));
const BillView = lazy(() => import('./pages/BillView'));
const BillEdit = lazy(() => import('./pages/BillEdit'));
const BillGeneratorUnified = lazy(() => import('./components/BillGeneratorUnified'));

const Register = lazy(() => import('./pages/auth/Register'));
const Verify = lazy(() => import('./pages/Verify'));
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));

const QuotationGenerator = lazy(() => import('./components/QuotationGenerator'));
const QuotationList = lazy(() => import('./pages/QuotationList'));
const QuotationView = lazy(() => import('./pages/QuotationView'));
const QuotationEdit = lazy(() => import('./pages/QuotationEdit'));

// Inventory pages
const InventoryList = lazy(() => import('./pages/Inventory/InventoryList'));
const AddInventoryItem = lazy(() => import('./pages/Inventory/AddInventoryItem'));
const BatchAddInventory = lazy(() => import('./pages/Inventory/BatchAddInventory'));
const EditInventoryItem = lazy(() => import('./pages/Inventory/EditInventoryItem'));
const InventoryReport = lazy(() => import('./pages/Inventory/InventoryReport'));

// Warranty Claim pages
const WarrantyClaimList = lazy(() => import('./pages/WarrantyClaim/WarrantyClaimList'));
const WarrantyClaimForm = lazy(() => import('./pages/WarrantyClaim/WarrantyClaimForm'));
const WarrantyClaimView = lazy(() => import('./pages/WarrantyClaim/WarrantyClaimView'));

// Admin pages for Bike Models
const BikeModelList = lazy(() => import('./pages/Admin/BikeModelList'));
const BikeModelForm = lazy(() => import('./pages/Admin/BikeModelForm'));

// Admin pages for Finance Companies
const FinanceCompanyList = lazy(() => import('./pages/Admin/FinanceCompanyList'));

// Report pages
const FinanceCompanySales = lazy(() => import('./pages/Reports/FinanceCompanySales'));

// User Management pages
const ProfilePage = lazy(() => import('./pages/user/ProfilePage'));

// Protected Route Wrappers
const ProtectedDashboard = () => <ProtectedRoute><Dashboard /></ProtectedRoute>;
const ProtectedBillList = () => <ProtectedRoute><BillList /></ProtectedRoute>;
const ProtectedBillView = () => <ProtectedRoute><BillView /></ProtectedRoute>;
const ProtectedBillEdit = () => <ProtectedRoute><BillEdit /></ProtectedRoute>;
const ProtectedBillGeneratorUnified = () => <ProtectedRoute><BillGeneratorUnified /></ProtectedRoute>;
const ProtectedInventoryList = () => <ProtectedRoute><InventoryList /></ProtectedRoute>;
const ProtectedAddInventoryItem = () => <ProtectedRoute><AddInventoryItem /></ProtectedRoute>;
const ProtectedBatchAddInventory = () => <ProtectedRoute><BatchAddInventory /></ProtectedRoute>;
const ProtectedEditInventoryItem = () => <ProtectedRoute><EditInventoryItem /></ProtectedRoute>;
const ProtectedInventoryReport = () => <ProtectedRoute><InventoryReport /></ProtectedRoute>;
const ProtectedBikeModelList = () => <ProtectedRoute><BikeModelList /></ProtectedRoute>;
const ProtectedBikeModelForm = () => <ProtectedRoute><BikeModelForm /></ProtectedRoute>;
const ProtectedFinanceCompanyList = () => <ProtectedRoute><FinanceCompanyList /></ProtectedRoute>;
const ProtectedQuotationGenerator = () => <ProtectedRoute><QuotationGenerator /></ProtectedRoute>;
const ProtectedQuotationList = () => <ProtectedRoute><QuotationList /></ProtectedRoute>;
const ProtectedQuotationView = () => <ProtectedRoute><QuotationView /></ProtectedRoute>;
const ProtectedQuotationEdit = () => <ProtectedRoute><QuotationEdit /></ProtectedRoute>;
const ProtectedProfilePage = () => <ProtectedRoute><ProfilePage /></ProtectedRoute>;
const ProtectedFinanceCompanySales = () => <ProtectedRoute><FinanceCompanySales /></ProtectedRoute>;
const ProtectedWarrantyClaimList = () => <ProtectedRoute><WarrantyClaimList /></ProtectedRoute>;
const ProtectedWarrantyClaimForm = () => <ProtectedRoute><WarrantyClaimForm /></ProtectedRoute>;
const ProtectedWarrantyClaimView = () => <ProtectedRoute><WarrantyClaimView /></ProtectedRoute>;

// Fallback shown while a route's chunk downloads
const RouteFallback = () => (
  <div className="flex justify-center items-center min-h-[50vh]">
    <Spin size="large" />
  </div>
);

// Inner component to access ThemeContext and apply Ant Design theme
const AppContent = () => {
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();

  // Listen for friendly 403 events and route to /verify
  useEffect(() => {
    const handler = (e) => {
      const url = e?.detail?.url || '/verify';
      toast((t) => (
        <span>
          Please verify your email to access this feature.{' '}
          <button
            onClick={() => {
              toast.dismiss(t.id);
              navigate(url);
            }}
            className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
          >
            Verify now
          </button>
        </span>
      ));
    };
    window.addEventListener('email-verification-required', handler);
    return () => window.removeEventListener('email-verification-required', handler);
  }, [navigate]);

  return (
    <ConfigProvider
      theme={{
        algorithm: isDarkMode ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        // You can add component-specific customizations here if needed
        // token: { colorPrimary: '#00b96b' }, // Example: Custom primary color
      }}
    >
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex flex-col">
        <Navbar />
        <main className="container mx-auto px-4 py-8 flex-grow">
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/verify" element={<Verify />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/privacy" element={<Privacy />} />

              {/* Protected routes */}
              <Route path="/" element={<ProtectedDashboard />} />
              <Route path="/bills" element={<ProtectedBillList />} />
              <Route path="/bills/new" element={<ProtectedBillGeneratorUnified />} />
              <Route path="/bills/:id" element={<ProtectedBillView />} />
              <Route path="/bills/:id/edit" element={<ProtectedBillEdit />} />
              <Route path="/inventory" element={<ProtectedInventoryList />} />
              <Route path="/inventory/add" element={<ProtectedAddInventoryItem />} />
              <Route path="/inventory/batch" element={<ProtectedBatchAddInventory />} />
              <Route path="/inventory/edit/:id" element={<ProtectedEditInventoryItem />} />
              <Route path="/inventory/report" element={<ProtectedInventoryReport />} />
              <Route path="/admin/bike-models" element={<ProtectedBikeModelList />} />
              <Route path="/admin/bike-models/new" element={<ProtectedBikeModelForm />} />
              <Route path="/admin/bike-models/edit/:id" element={<ProtectedBikeModelForm />} />
              <Route path="/admin/finance-companies" element={<ProtectedFinanceCompanyList />} />
              <Route path="/quotations" element={<ProtectedQuotationList />} />
              <Route path="/quotations/new" element={<ProtectedQuotationGenerator />} />
              <Route path="/quotations/:id" element={<ProtectedQuotationView />} />
              <Route path="/quotations/:id/edit" element={<ProtectedQuotationEdit />} />

              {/* Warranty Claim routes */}
              <Route path="/warranty-claims" element={<ProtectedWarrantyClaimList />} />
              <Route path="/warranty-claims/new" element={<ProtectedWarrantyClaimForm />} />
              <Route path="/warranty-claims/:id/edit" element={<ProtectedWarrantyClaimForm />} />
              <Route path="/warranty-claims/:id" element={<ProtectedWarrantyClaimView />} />

              {/* Report routes */}
              <Route path="/reports/finance-company-sales" element={<ProtectedFinanceCompanySales />} />

              {/* User Management routes */}
              <Route path="/profile" element={<ProtectedProfilePage />} />
              <Route path="/settings" element={<ProtectedProfilePage />} />

              {/* Catch-all 404 — must stay last */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </main>
        <footer className="bg-gray-100 dark:bg-gray-800 py-4 text-center text-gray-600 dark:text-gray-400 text-sm mt-auto border-t border-gray-200 dark:border-gray-700">
          <p>Made with ❤️ by Uminda <a href="https://uminda.dev" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">@uhadev</a></p>
        </footer>
        <Toaster position="top-right" />
        <PwaInstallPrompt />
      </div>
    </ConfigProvider>
  );
};

const App = () => {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
};

export default App;
