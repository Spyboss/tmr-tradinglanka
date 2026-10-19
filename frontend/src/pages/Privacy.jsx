import React from 'react';
import { Link } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';

/**
 * This notice is written to match what the system actually collects, based on
 * the data models: User (email, name, NIC, address, phone, role, last login),
 * UserActivity (action type, description, IP address, user agent, timestamp,
 * and old/new values of changed fields), and the business records themselves
 * (customer names, phone numbers, addresses on bills, quotations, warranty
 * claims). Update this page if the data models change.
 */
const Privacy = () => {
  usePageTitle('Privacy Notice');

  const section = 'text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2';
  const body = 'text-sm text-gray-700 dark:text-gray-300 space-y-2';

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Privacy Notice</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        What this system stores, why it is stored, and who can see it.
      </p>

      <div className="mt-6 bg-white dark:bg-slate-800 shadow rounded-xl p-6 sm:p-8">
        <h2 className={section}>1. Who holds your data</h2>
        <div className={body}>
          <p>
            TMR Trading Lanka (Pvt) Ltd holds the information entered into this system. Staff data is
            held by the business as your employer. Customer data is held because it is part of a sale,
            quotation, service or warranty record the business must keep.
          </p>
        </div>

        <h2 className={section}>2. What is stored about staff</h2>
        <div className={body}>
          <p>Your account may hold:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>your email address and a protected (hashed) password;</li>
            <li>your name, national identity card number, address and phone number, if provided;</li>
            <li>your role, which decides what you can see and do;</li>
            <li>the date and time of your last sign-in.</li>
          </ul>
          <p>Passwords are stored only as a one-way hash. Nobody, including the administrator, can read your password.</p>
        </div>

        <h2 className={section}>3. Activity records</h2>
        <div className={body}>
          <p>
            The system keeps a record of significant actions: signing in and out, creating, editing or
            deleting bills, quotations, inventory and warranty claims, and changing your profile or
            settings. Each record stores the action, a description, the time, your internet address and
            the type of browser you used. Where a record is changed, the previous and new values may be
            kept.
          </p>
          <p>
            This exists so that changes to business records can be traced back to who made them. It is
            a normal business control, not surveillance of your day.
          </p>
        </div>

        <h2 className={section}>4. Customer information</h2>
        <div className={body}>
          <p>
            Bills, quotations and warranty claims store customer details such as name, phone number and
            address. This is collected so the business can complete the transaction, contact the
            customer, and meet its record-keeping obligations. It is used for that purpose only.
          </p>
        </div>

        <h2 className={section}>5. What is not done with your data</h2>
        <div className={body}>
          <ul className="list-disc pl-5 space-y-1">
            <li>Information in this system is not sold.</li>
            <li>It is not shared with advertisers or data brokers.</li>
            <li>It is not used for marketing you did not agree to.</li>
          </ul>
        </div>

        <h2 className={section}>6. Where it is kept and for how long</h2>
        <div className={body}>
          <p>
            Records are kept on the system's own servers and are retained for as long as the business
            needs them for accounting, warranty and legal purposes, after which they are deleted or
            anonymised. Account data is removed when your account is deleted, apart from records the
            business must keep by law.
          </p>
        </div>

        <h2 className={section}>7. Your choices</h2>
        <div className={body}>
          <p>You can:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>see and correct the personal details on your profile page at any time;</li>
            <li>change your password yourself, without asking anyone;</li>
            <li>ask the administrator what activity records are held under your account;</li>
            <li>ask for correction of anything inaccurate about you.</li>
          </ul>
        </div>

        <h2 className={section}>8. Security</h2>
        <div className={body}>
          <p>
            Access is by individual account, passwords are protected, and what you can see is limited
            by your role. No system is completely secure, so tell the administrator at once if you
            think your account has been reached by someone else.
          </p>
        </div>

        <h2 className={section}>9. Questions</h2>
        <div className={body}>
          <p>
            Ask the administrator at TMR Trading Lanka (Pvt) Ltd about anything in this notice or about
            the information held about you.
          </p>
        </div>
      </div>

      <div className="mt-6 text-sm">
        <Link to="/login" className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
          Back to sign in
        </Link>
      </div>
    </div>
  );
};

export default Privacy;
