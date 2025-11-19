import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { ConfigProvider, theme as antdTheme } from 'antd'; // Import antd ConfigProvider and theme
import Navbar from './components/Navbar';
import BillForm from './pages/BillForm';
import BillList from './pages/BillList';
import BillView from './pages/BillView';
import Dashboard from './pages/Dashboard';
import BillGenerator from './components/BillGenerator';
import BillGeneratorWithInventory from './components/BillGeneratorWithInventory';
import BillGeneratorUnified from './components/BillGeneratorUnified';
import BillConversion from './components/BillConversion';
import BillEdit from './pages/BillEdit';
import Login from './pages/auth/Login';
import QuotationGenerator from './components/QuotationGenerator';
import QuotationList from './pages/QuotationList';
import QuotationView from './pages/QuotationView';
import QuotationEdit from './pages/QuotationEdit';
import Register from './pages/auth/Register';
import Verify from './pages/Verify';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext'; // Import ThemeProvider and useTheme
import ProtectedRoute from './components/ProtectedRoute';

// Inventory pages
import InventoryList from './pages/Inventory/InventoryList';
import AddInventoryItem from './pages/Inventory/AddInventoryItem';
import BatchAddInventory from './pages/Inventory/BatchAddInventory';
import EditInventoryItem from './pages/Inventory/EditInventoryItem';
import InventoryReport from './pages/Inventory/InventoryReport';

// Admin pages for Bike Models
import BikeModelList from './pages/Admin/BikeModelList';
import BikeModelForm from './pages/Admin/BikeModelForm';

// User Management pages
import ProfilePage from './pages/user/ProfilePage';

// Protected Route Wrappers
const ProtectedBillList = () => <ProtectedRoute><BillList /></ProtectedRoute>;
const ProtectedBillForm = () => <ProtectedRoute><BillForm /></ProtectedRoute>;
const ProtectedBillView = () => <ProtectedRoute><BillView /></ProtectedRoute>;
const ProtectedBillGenerator = () => <ProtectedRoute><BillGenerator /></ProtectedRoute>;
const ProtectedBillConversion = () => <ProtectedRoute><BillConversion /></ProtectedRoute>;
const ProtectedBillEdit = () => <ProtectedRoute><BillEdit /></ProtectedRoute>;
const ProtectedDashboard = () => <ProtectedRoute><Dashboard /></ProtectedRoute>;
const ProtectedInventoryList = () => <ProtectedRoute><InventoryList /></ProtectedRoute>;
const ProtectedAddInventoryItem = () => <ProtectedRoute><AddInventoryItem /></ProtectedRoute>;
const ProtectedBatchAddInventory = () => <ProtectedRoute><BatchAddInventory /></ProtectedRoute>;
const ProtectedEditInventoryItem = () => <ProtectedRoute><EditInventoryItem /></ProtectedRoute>;
const ProtectedInventoryReport = () => <ProtectedRoute><InventoryReport /></ProtectedRoute>;
const ProtectedBillGeneratorWithInventory = () => <ProtectedRoute><BillGeneratorWithInventory /></ProtectedRoute>;
const ProtectedBillGeneratorUnified = () => <ProtectedRoute><BillGeneratorUnified /></ProtectedRoute>;
const ProtectedBikeModelList = () => <ProtectedRoute><BikeModelList /></ProtectedRoute>;
const ProtectedBikeModelForm = () => <ProtectedRoute><BikeModelForm /></ProtectedRoute>;
const ProtectedQuotationGenerator = () => <ProtectedRoute><QuotationGenerator /></ProtectedRoute>;
const ProtectedQuotationList = () => <ProtectedRoute><QuotationList /></ProtectedRoute>;
const ProtectedQuotationView = () => <ProtectedRoute><QuotationView /></ProtectedRoute>;
const ProtectedQuotationEdit = () => <ProtectedRoute><QuotationEdit /></ProtectedRoute>;
const ProtectedProfilePage = () => <ProtectedRoute><ProfilePage /></ProtectedRoute>;

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
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/verify" element={<Verify />} />

            {/* Protected routes */}
            <Route path="/" element={<ProtectedDashboard />} />
            <Route path="/bills" element={<ProtectedBillList />} />
            <Route path="/bills/new" element={<ProtectedBillGeneratorUnified />} />
            <Route path="/bills/new-with-inventory" element={<ProtectedBillGeneratorUnified />} />
            <Route path="/bills/:id" element={<ProtectedBillView />} />
            <Route path="/bills/:id/convert" element={<ProtectedBillConversion />} />
            <Route path="/bills/:id/edit" element={<ProtectedBillEdit />} />
            <Route path="/inventory" element={<ProtectedInventoryList />} />
            <Route path="/inventory/add" element={<ProtectedAddInventoryItem />} />
            <Route path="/inventory/batch" element={<ProtectedBatchAddInventory />} />
            <Route path="/inventory/edit/:id" element={<ProtectedEditInventoryItem />} />
            <Route path="/inventory/report" element={<ProtectedInventoryReport />} />
            <Route path="/admin/bike-models" element={<ProtectedBikeModelList />} />
            <Route path="/admin/bike-models/new" element={<ProtectedBikeModelForm />} />
            <Route path="/admin/bike-models/edit/:id" element={<ProtectedBikeModelForm />} />
            <Route path="/quotations" element={<ProtectedQuotationList />} />
            <Route path="/quotations/new" element={<ProtectedQuotationGenerator />} />
            <Route path="/quotations/:id" element={<ProtectedQuotationView />} />
            <Route path="/quotations/:id/edit" element={<ProtectedQuotationEdit />} />

            {/* User Management routes */}
            <Route path="/profile" element={<ProtectedProfilePage />} />
            <Route path="/settings" element={<ProtectedProfilePage />} />
          </Routes>
        </main>
        <footer className="bg-gray-100 dark:bg-gray-800 py-4 text-center text-gray-600 dark:text-gray-400 text-sm mt-auto border-t border-gray-200 dark:border-gray-700">
          <p>Made with ❤️ by Uminda <a href="https://uminda.dev" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300">@uhadev</a></p>
        </footer>
        <Toaster position="top-right" />
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
