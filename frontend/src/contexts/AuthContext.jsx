import React, { createContext, useState, useEffect, useContext, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../config/apiClient';
import { toast } from 'react-hot-toast';
// Single source of truth for permissions: the browser evaluates the EXACT
// same rules the API enforces (backend/src/permissions/shared.ts).
import { defineAbilitiesFor, can as canWithAbility } from '../permissions';

// Create the auth context
const AuthContext = createContext(null);

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Check if user is already logged in on initial load
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const token = localStorage.getItem('accessToken');

        if (token) {
          // Set axios authorization header
          apiClient.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;

          // Fetch current user profile
          const response = await apiClient.get('/api/auth/me');

          if (response.user) {
            setUser(response.user);
            setIsAuthenticated(true);
          } else {
            // Clear invalid data
            handleLogout(false);
          }
        }
      } catch (error) {
        console.error('Error checking auth status:', error);
        // If token is invalid or expired, clear it
        handleLogout(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuthStatus();
  }, []);

  // Setup axios interceptor for token refresh
  useEffect(() => {
    const interceptor = apiClient.axiosInstance.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If error is 401 and not a retry and not from auth endpoints
        if (
          error.response?.status === 401 &&
          !originalRequest._retry &&
          !originalRequest.url.includes('/auth/login') &&
          !originalRequest.url.includes('/auth/refresh')
        ) {
          originalRequest._retry = true;

          try {
            // Try to refresh the token
            const response = await apiClient.post('/api/auth/refresh');

            if (response.accessToken) {
              // Update localStorage and axios header
              localStorage.setItem('accessToken', response.accessToken);
              apiClient.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${response.accessToken}`;

              // Retry the original request
              return apiClient.axiosInstance(originalRequest);
            }
          } catch (refreshError) {
            // If refresh failed, logout the user
            handleLogout(true);
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );

    return () => {
      // Clean up interceptor on unmount
      apiClient.axiosInstance.interceptors.response.eject(interceptor);
    };
  }, [navigate]);

  const handleLogin = async (email, password) => {
    try {
      setLoading(true);

      const response = await apiClient.post('/api/auth/login', { email, password });

      if (response.accessToken) {
        // Store token in localStorage
        localStorage.setItem('accessToken', response.accessToken);

        // Set axios authorization header
        apiClient.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${response.accessToken}`;

        // Update state
        setUser(response.user);
        setIsAuthenticated(true);

        // Show success message
        toast.success('Logged in successfully');

        // Redirect to intended page or dashboard
        const redirectTo = location.state?.from?.pathname || '/';
        navigate(redirectTo);

        return true;
      }

      return false;
    } catch (error) {
      console.error('Login error:', error);

      // Show appropriate error message
      const errorMessage = error.message || 'Failed to login. Please try again.';

      // Show specific messages for different errors
      if (error.response?.status === 401) {
        toast.error('Invalid email or password');
      } else if (error.response?.status === 429) {
        toast.error('Too many login attempts. Please try again later.');
      } else {
        toast.error(errorMessage);
      }

      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (userData) => {
    try {
      setLoading(true);

      const response = await apiClient.post('/api/auth/register', userData);

      if (response.accessToken) {
        // Store token in localStorage
        localStorage.setItem('accessToken', response.accessToken);

        // Set axios authorization header
        apiClient.axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${response.accessToken}`;

        // Update state
        setUser(response.user);
        setIsAuthenticated(true);

        // Show success message
        toast.success('Account created successfully');

        // Redirect to dashboard
        navigate('/');

        return true;
      }

      return false;
    } catch (error) {
      console.error('Registration error:', error);

      // Show appropriate error message
      const errorMessage = error.message || 'Failed to register. Please try again.';

      if (error.response?.status === 409) {
        toast.error('Email already in use. Please try a different email or login.');
      } else if (error.response?.status === 429) {
        toast.error('Too many registration attempts. Please try again later.');
      } else {
        toast.error(errorMessage);
      }

      return false;
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async (showMessage = true) => {
    try {
      // Call logout API to invalidate token on server
      if (isAuthenticated) {
        await apiClient.post('/api/auth/logout');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Clear auth state regardless of API success
      localStorage.removeItem('accessToken');
      delete apiClient.axiosInstance.defaults.headers.common['Authorization'];

      setUser(null);
      setIsAuthenticated(false);

      if (showMessage) {
        toast.success('Logged out successfully');
      }

      // Redirect to login page
      navigate('/login');
    }
  };

  // Check if user has admin role
  const isAdmin = () => {
    return user?.role === 'admin';
  };

  // Permission ability built from the shared rules module (ABAC):
  // rules combine role + resource attributes (owner, addedBy, userId, ...).
  const ability = useMemo(
    () =>
      defineAbilitiesFor(
        user ? { id: user.id ?? user._id, role: user.role } : null
      ),
    [user]
  );

  // Type-level or attribute-level check, e.g. can('update', 'Bill', bill).
  // UI hiding only — the API re-checks every request server-side.
  const can = useCallback(
    (action, subject, resource) =>
      canWithAbility(ability, action, subject, resource),
    [ability]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        loading,
        isAuthenticated,
        isAdmin,
        can,
        ability,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};