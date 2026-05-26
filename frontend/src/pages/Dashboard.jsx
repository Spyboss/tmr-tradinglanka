import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { FileTextOutlined, FileSearchOutlined, ShoppingCartOutlined, BarChartOutlined, SafetyCertificateOutlined, SettingOutlined } from '@ant-design/icons'

export default function Dashboard() {
  const { isAdmin } = useAuth();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Overview</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FileTextOutlined /> Bills
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">View and manage all bills</p>
          <div className="flex flex-col space-y-2">
            <Link
              to="/bills"
              className="inline-block px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 dark:hover:bg-green-500 text-center"
            >
              View Bills
            </Link>
            <Link
              to="/bills/new"
              className="inline-block px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 dark:hover:bg-green-400 text-center"
            >
              Create Bill
            </Link>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <FileSearchOutlined /> Quotations
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">Manage quotations and invoices</p>
          <div className="flex flex-col space-y-2">
            <Link
              to="/quotations"
              className="inline-block px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 dark:hover:bg-orange-500 text-center"
            >
              View Quotations
            </Link>
            <Link
              to="/quotations/new"
              className="inline-block px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600 dark:hover:bg-orange-400 text-center"
            >
              New Quotation
            </Link>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <ShoppingCartOutlined /> Inventory
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">Manage your bike inventory</p>
          <div className="flex flex-col space-y-2">
            <Link
              to="/inventory"
              className="inline-block px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 dark:hover:bg-purple-500 text-center"
            >
              View Inventory
            </Link>
            <Link
              to="/inventory/add"
              className="inline-block px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 dark:hover:bg-purple-400 text-center"
            >
              Add to Inventory
            </Link>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <BarChartOutlined /> Reports
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">View sales and inventory reports</p>
          <div className="flex flex-col space-y-2">
            <Link
              to="/inventory/report"
              className="inline-block px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 dark:hover:bg-indigo-500 text-center"
            >
              Inventory Report
            </Link>
            <Link
              to="/reports/finance-company-sales"
              className="inline-block px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 dark:hover:bg-indigo-400 text-center"
            >
              Finance Company Sales
            </Link>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <SafetyCertificateOutlined /> Warranty Claims
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">Manage warranty claims</p>
          <div className="flex flex-col space-y-2">
            <Link
              to="/warranty-claims"
              className="inline-block px-4 py-2 bg-cyan-600 text-white rounded hover:bg-cyan-700 dark:hover:bg-cyan-500 text-center"
            >
              View Claims
            </Link>
            <Link
              to="/warranty-claims/new"
              className="inline-block px-4 py-2 bg-cyan-500 text-white rounded hover:bg-cyan-600 dark:hover:bg-cyan-400 text-center"
            >
              New Claim
            </Link>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4 text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <SettingOutlined /> Settings
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">Configure system settings</p>
          <div className="flex flex-col space-y-2">
            <Link
              to="/settings"
              className="inline-block px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 dark:hover:bg-gray-500 text-center"
            >
              View Settings
            </Link>
            {isAdmin() && (
              <>
                <Link
                  to="/admin/finance-companies"
                  className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 dark:hover:bg-blue-500 text-center"
                >
                  Finance Companies
                </Link>
                <Link
                  to="/admin/bike-models"
                  className="inline-block px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700 dark:hover:bg-teal-500 text-center"
                >
                  Bike Models
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
