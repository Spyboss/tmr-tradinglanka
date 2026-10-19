import React from 'react';
import { Link } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';

const NotFound = () => {
  usePageTitle('Page not found');

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4 py-16">
      <p className="text-7xl font-extrabold text-blue-600 dark:text-blue-400">404</p>
      <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">Page not found</h1>
      <p className="mt-2 max-w-md text-gray-600 dark:text-gray-400">
        The page you are looking for does not exist, or it may have been moved.
      </p>
      <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="w-full sm:w-auto px-4 py-2 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Go back
        </button>
        <Link
          to="/"
          className="w-full sm:w-auto px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 text-center"
        >
          Back to dashboard
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
