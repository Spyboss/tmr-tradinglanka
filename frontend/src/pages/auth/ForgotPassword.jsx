import React from 'react';
import { Link } from 'react-router-dom';
import usePageTitle from '../../hooks/usePageTitle';

/**
 * Password resets are issued by the administrator, never self-service.
 * This is deliberate: keeping recovery off the public surface means there is
 * no "send me a reset email" endpoint to abuse for account enumeration or
 * mail-quota abuse. The page is informational only — it sends nothing.
 */
const ForgotPassword = () => {
  usePageTitle('Reset password');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 p-8 bg-white dark:bg-slate-800 shadow-xl rounded-xl">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-gray-100">Reset your password</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Passwords are reset by the administrator, not automatically.
          </p>
        </div>

        <div className="rounded-md bg-blue-50 dark:bg-blue-900/30 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400 dark:text-blue-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                For your security, a new password is only issued after the administrator confirms who is asking.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100">How to get a new password</h3>
          <ol className="list-decimal pl-5 space-y-2">
            <li>Contact the office during business hours and tell them you need a password reset.</li>
            <li>The administrator will confirm it is you before issuing a new password.</li>
            <li>Sign in with the new password, then change it to something of your own from your profile.</li>
          </ol>

          <h3 className="font-semibold text-gray-900 dark:text-gray-100 pt-2">Can you still sign in?</h3>
          <p>
            If you can sign in but just want a different password, you do not need a reset — change it directly from your profile page.
          </p>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/login"
            className="w-full sm:w-auto px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center"
          >
            Back to sign in
          </Link>
          <Link
            to="/register"
            className="w-full sm:w-auto px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-center"
          >
            Create an account
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
