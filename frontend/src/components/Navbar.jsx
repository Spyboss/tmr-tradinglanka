import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext'; // Import useTheme
import VerificationBadge from './VerificationBadge';
import { getVerificationStatus } from '../services/verification';
import apiClient from '../config/apiClient';

export default function Navbar() {
  const location = useLocation();
  const { user, isAuthenticated, logout, loading } = useAuth();
  const { isDarkMode, toggleTheme } = useTheme(); // Use theme context
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dealerName, setDealerName] = useState('TMR Trading Lanka (Pvt) Ltd');
  const menuButtonRef = useRef(null);
  const [verification, setVerification] = useState(null);

  const toggleUserMenu = () => {
    setMenuOpen(false);
    setUserMenuOpen(!userMenuOpen);
  };

  const togglePrimaryMenu = () => {
    setUserMenuOpen(false);
    setMenuOpen((prev) => !prev);
  };

  useEffect(() => {
    // Only fetch branding after authentication to avoid pre-login 401 noise
    if (!isAuthenticated) {
      // Ensure fallback title before login
      setDealerName('TMR Trading Lanka (Pvt) Ltd');
      return;
    }

    (async () => {
      try {
        const branding = await apiClient.get('/api/branding');
        if (branding && branding.dealerName) {
          setDealerName(branding.dealerName);
        }
        const v = await getVerificationStatus();
        setVerification(v);
      } catch (_) {
        // Ignore errors; keep default dealer name
      }
    })();
  }, [isAuthenticated]);

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setUserMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  const handleLogout = async (e) => {
    e.preventDefault();
    await logout();
    setUserMenuOpen(false);
  };

  const isActive = (path) => {
    return location.pathname === path;
  };

  return (
    <nav className="bg-white dark:bg-gray-800 shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex justify-between h-16">
          <div className="flex">
            <div className="flex-shrink-0 flex items-center min-w-0">
                <button
                  ref={menuButtonRef}
                  type="button"
                  onClick={togglePrimaryMenu}
                  aria-controls="primary-navigation"
                  aria-expanded={menuOpen}
                  aria-label={menuOpen ? 'Close navigation' : 'Open navigation'}
                  className="sm:hidden mr-2 p-2 rounded-md text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                <Link to="/" className="text-xl font-bold text-blue-600 dark:text-blue-400 truncate max-w-[60vw] sm:max-w-none">
                  {dealerName}
                </Link>
            </div>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              <Link
                to="/"
                className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                  isActive('/')
                    ? 'border-blue-500 text-gray-900 dark:text-white'
                    : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white dark:hover:border-gray-700'
                }`}
              >
                Dashboard
              </Link>

              {isAuthenticated && (
                <>
                  <Link
                    to="/bills"
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive('/bills')
                        ? 'border-blue-500 text-gray-900 dark:text-white'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white dark:hover:border-gray-700'
                    }`}
                  >
                    Bills
                  </Link>

                  <Link
                    to="/bills/new"
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      isActive('/bills/new')
                        ? 'border-blue-500 text-gray-900 dark:text-white'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white dark:hover:border-gray-700'
                    }`}
                  >
                    Create Bill
                  </Link>

                  <Link
                    to="/inventory"
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      location.pathname.startsWith('/inventory')
                        ? 'border-blue-500 text-gray-900 dark:text-white'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white dark:hover:border-gray-700'
                    }`}
                  >
                    Inventory
                  </Link>

                  {/* Link to Bike Models Management */}
                  <Link
                    to="/quotations"
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      location.pathname.startsWith('/quotations')
                        ? 'border-blue-500 text-gray-900 dark:text-white'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white dark:hover:border-gray-700'
                    }`}
                  >
                    Quotations
                  </Link>

                  <Link
                    to="/admin/bike-models"
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                      location.pathname.startsWith('/admin/bike-models')
                        ? 'border-blue-500 text-gray-900 dark:text-white'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-300 dark:hover:text-white dark:hover:border-gray-700'
                    }`}
                  >
                    Manage Models
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="hidden sm:ml-6 sm:flex sm:items-center">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="mr-4 p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 focus:outline-none"
              aria-label="Toggle theme"
            >
              {isDarkMode ? (
                // Moon icon for dark mode
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                // Sun icon for light mode
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>

            {/* Removed top-level verification badge for subtle UX */}

            {isAuthenticated ? (
              <div className="ml-3 relative">
                <div>
                  <button
                    type="button"
                    className="bg-white dark:bg-gray-700 rounded-full flex text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                    onClick={toggleUserMenu}
                  >
                    <span className="sr-only">Open user menu</span>
                    <div className="h-8 w-8 rounded-full bg-blue-200 dark:bg-blue-600 flex items-center justify-center">
                      {user?.email ? (
                        <span className="text-blue-800 dark:text-blue-100 font-medium uppercase">
                          {user.email.charAt(0)}
                        </span>
                      ) : (
                        <svg
                          className="h-5 w-5 text-blue-600 dark:text-blue-300"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      )}
                    </div>
                  </button>
                </div>

                {/* User dropdown menu */}
                {userMenuOpen && (
                  <div className="origin-top-right absolute right-0 mt-2 min-w-[14rem] max-w-xs rounded-md shadow-lg py-1 bg-white dark:bg-gray-700 ring-1 ring-black ring-opacity-5 z-50">
                    <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600">
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Signed in as</p>
                      <p className="font-semibold break-all">{user?.email}</p>
                    </div>

                    {verification?.verified && (
                      <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">
                        <span className="inline-flex items-center gap-1 text-emerald-500">
                          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 011.414-1.414l2.793 2.793 6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                          Verified
                        </span>
                      </div>
                    )}

                    <Link
                      to="/profile"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Your Profile
                    </Link>

                    <Link
                      to="/settings"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      Settings
                    </Link>

                    {verification?.enabled && !verification?.verified && (
                      <Link
                        to="/verify"
                        className="block px-4 py-2 text-sm text-yellow-800 hover:bg-yellow-50 dark:text-yellow-300 dark:hover:bg-yellow-700"
                        onClick={() => setUserMenuOpen(false)}
                      >
                        Verify Email
                      </Link>
                    )}

                    <button
                      className="w-full text-left block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-600"
                      onClick={handleLogout}
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex space-x-4">
                <Link
                  to="/login"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive('/login')
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-700 dark:text-white'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700'
                  }`}
                >
                  Login
                </Link>

                <Link
                  to="/register"
                  className={`px-3 py-2 rounded-md text-sm font-medium ${
                    isActive('/register')
                      ? 'bg-blue-600 text-white dark:bg-blue-500'
                      : 'bg-blue-600 text-white hover:bg-blue-700 dark:hover:bg-blue-500'
                  }`}
                >
                  Register
                </Link>
              </div>
            )}
          </div>

          {/* Mobile controls */}
          <div className="sm:hidden flex items-center flex-shrink-0">
            {/* Mobile Theme Toggle Button */}
            <button
             onClick={toggleTheme}
             className="mr-2 p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-700 focus:outline-none"
             aria-label="Toggle theme"
            >
              {isDarkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              )}
            </button>
            {isAuthenticated ? (
              <button
                type="button"
                className="bg-white dark:bg-gray-800 rounded-full flex text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 dark:focus:ring-offset-gray-800"
                onClick={toggleUserMenu}
                aria-haspopup="menu"
                aria-expanded={userMenuOpen}
                aria-label={userMenuOpen ? 'Close user menu' : 'Open user menu'}
              >
                <span className="sr-only">Open menu</span>
                <div className="h-8 w-8 rounded-full bg-blue-200 dark:bg-blue-700 flex items-center justify-center">
                  {user?.email ? (
                    <span className="text-blue-800 dark:text-blue-100 font-medium uppercase">
                      {user.email.charAt(0)}
                    </span>
                  ) : (
                    <svg
                      className="h-5 w-5 text-blue-600 dark:text-blue-300"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  )}
                </div>
              </button>
            ) : (
              <div className="flex">
                <Link
                  to="/login"
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                >
                  Login
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile user menu - profile only */}
      {userMenuOpen && (
        <div className="sm:hidden border-t border-gray-200 dark:border-gray-700 pt-4 pb-3 px-4 bg-white dark:bg-gray-800">
          <div className="flex items-center px-4">
            <div className="flex-shrink-0">
              <div className="h-10 w-10 rounded-full bg-blue-200 dark:bg-blue-700 flex items-center justify-center">
                <span className="text-blue-800 dark:text-blue-100 font-medium uppercase">
                  {user?.email?.charAt(0) || 'U'}
                </span>
              </div>
            </div>
            <div className="ml-3">
              <div className="text-base font-medium text-gray-800 dark:text-gray-200">{user?.email}</div>
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">{user?.role}</div>
            </div>
          </div>
          {verification?.verified && (
            <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200">
              <span className="inline-flex items-center gap-1 text-emerald-500">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 011.414-1.414l2.793 2.793 6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                Verified
              </span>
            </div>
          )}
          <div className="mt-3 space-y-1">
            <Link
              to="/profile"
              className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700"
              onClick={() => setUserMenuOpen(false)}
            >
              Your Profile
            </Link>
            <Link
              to="/settings"
              className="block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700"
              onClick={() => setUserMenuOpen(false)}
            >
              Settings
            </Link>
            {verification?.enabled && !verification?.verified && (
              <Link
                to="/verify"
                className="block px-4 py-2 text-base font-medium text-yellow-800 hover:text-yellow-900 hover:bg-yellow-50 dark:text-yellow-300 dark:hover:text-yellow-200 dark:hover:bg-yellow-700"
                onClick={() => setUserMenuOpen(false)}
              >
                Verify Email
              </Link>
            )}
            <button
              className="w-full text-left block px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700"
              onClick={handleLogout}
            >
              Sign out
            </button>
          </div>
        </div>
      )}

      {/* Mobile primary navigation */}
      {menuOpen && (
        <div className="sm:hidden border-t border-gray-200 dark:border-gray-700 pt-2 pb-3 bg-white dark:bg-gray-800" id="primary-navigation">
          <div className="px-4 space-y-1">
            <Link
              to="/"
              className="block px-4 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 focus:outline-none"
              onClick={() => setMenuOpen(false)}
            >
              Dashboard
            </Link>
            {isAuthenticated && (
              <>
                <Link
                  to="/bills"
                  className="block px-4 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 focus:outline-none"
                  onClick={() => setMenuOpen(false)}
                >
                  Bills
                </Link>
                <Link
                  to="/bills/new"
                  className="block px-4 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 focus:outline-none"
                  onClick={() => setMenuOpen(false)}
                >
                  Create Bill
                </Link>
                <Link
                  to="/inventory"
                  className="block px-4 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 focus:outline-none"
                  onClick={() => setMenuOpen(false)}
                >
                  Inventory
                </Link>
                <Link
                  to="/quotations"
                  className="block px-4 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 focus:outline-none"
                  onClick={() => setMenuOpen(false)}
                >
                  Quotations
                </Link>
                <Link
                  to="/admin/bike-models"
                  className="block px-4 py-2 text-base font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-700 focus:outline-none"
                  onClick={() => setMenuOpen(false)}
                >
                  Manage Models
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
