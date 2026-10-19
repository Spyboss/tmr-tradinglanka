import React from 'react';
import { Link } from 'react-router-dom';
import usePageTitle from '../hooks/usePageTitle';

const Terms = () => {
  usePageTitle('Terms of Use');

  const section = 'text-lg font-semibold text-gray-900 dark:text-gray-100 mt-6 mb-2';
  const body = 'text-sm text-gray-700 dark:text-gray-300 space-y-2';

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Terms of Use</h1>
      <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
        These terms govern your use of the TMR Trading Lanka business management system.
      </p>

      <div className="mt-6 bg-white dark:bg-slate-800 shadow rounded-xl p-6 sm:p-8">
        <h2 className={section}>1. Who may use this system</h2>
        <div className={body}>
          <p>
            This system is for authorised staff of TMR Trading Lanka (Pvt) Ltd. Access is granted
            individually and may not be shared. You are responsible for everything done under your
            account, so keep your password to yourself.
          </p>
        </div>

        <h2 className={section}>2. Your account</h2>
        <div className={body}>
          <p>
            Provide accurate information when your account is created. Tell the administrator promptly
            if you believe someone else has accessed your account, or if your role has changed and you
            no longer need access.
          </p>
        </div>

        <h2 className={section}>3. Acceptable use</h2>
        <div className={body}>
          <p>Use the system only for genuine business work. Do not:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>attempt to access records, accounts or reports outside your role;</li>
            <li>interfere with the system or try to bypass its security;</li>
            <li>enter customer or business information you are not authorised to handle;</li>
            <li>use the system for anything unlawful in Sri Lanka.</li>
          </ul>
        </div>

        <h2 className={section}>4. Records you enter</h2>
        <div className={body}>
          <p>
            Bills, quotations, inventory entries and warranty claims created through this system are
            business records. Check what you enter before saving. Correcting a record is the
            responsibility of the person who entered it, together with the administrator.
          </p>
        </div>

        <h2 className={section}>5. Availability</h2>
        <div className={body}>
          <p>
            We work to keep the system available, but it may be unavailable for maintenance, repairs
            or issues beyond our control. Keep your own copies of critical records where the business
            requires it.
          </p>
        </div>

        <h2 className={section}>6. Changes to these terms</h2>
        <div className={body}>
          <p>
            These terms may be updated as the system changes. Continued use after an update means you
            accept the revised terms. The administrator will tell you about material changes.
          </p>
        </div>

        <h2 className={section}>7. Contact</h2>
        <div className={body}>
          <p>
            Questions about these terms go to the administrator at TMR Trading Lanka (Pvt) Ltd.
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

export default Terms;
