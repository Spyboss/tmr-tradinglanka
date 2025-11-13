import React, { useEffect, useState } from 'react';
import { getVerificationStatus, type VerificationStatusResponse } from '../services/verification';
import { useAuth } from '../contexts/AuthContext';

interface VerificationBadgeProps {
  className?: string;
  hideWhenDisabled?: boolean;
}

const VerificationBadge: React.FC<VerificationBadgeProps> = ({ className = '', hideWhenDisabled = true }) => {
  const { isAuthenticated } = useAuth();
  const [status, setStatus] = useState<VerificationStatusResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const load = async () => {
      if (!isAuthenticated) return;
      setLoading(true);
      try {
        const s = await getVerificationStatus();
        setStatus(s);
      } catch {
        // fail silent
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isAuthenticated]);

  if (!isAuthenticated) return null;
  if (loading && !status) return null;
  if (!status) return null;
  if (hideWhenDisabled && status.enabled === false) return null;

  const { text, icon, styles } = status.verified
    ? {
        text: 'Email verified',
        icon: (
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3.5-3.5a1 1 0 011.414-1.414l2.793 2.793 6.543-6.543a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
        ),
        styles: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      }
    : {
        text: 'Verify your email',
        icon: (
          <svg
            className="h-3.5 w-3.5"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M10 2a6 6 0 00-3.674 10.74l-.764 2.676a.5.5 0 00.616.616l2.675-.765A6 6 0 1010 2zm1 6a1 1 0 00-2 0v2a1 1 0 002 0V8zm0 4a1 1 0 11-2 0 1 1 0 012 0z" />
          </svg>
        ),
        styles:
          'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100 focus-visible:outline-amber-500',
      };

  const handleClick = () => {
    if (!status.verified) {
      window.dispatchEvent(new CustomEvent('email-verification-required', { detail: { url: '/verify' } }));
    }
  };

  const baseClasses =
    'inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

  const Component = status.verified ? 'span' : 'button';

  return (
    <Component
      type={status.verified ? undefined : 'button'}
      className={`${baseClasses} ${styles} ${className}`.trim()}
      title={status.verified ? 'Your email is verified' : 'Click to verify your email'}
      onClick={status.verified ? undefined : handleClick}
    >
      {icon}
      <span>{text}</span>
    </Component>
  );
};

export default VerificationBadge;