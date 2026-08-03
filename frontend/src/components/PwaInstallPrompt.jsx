import React, { useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'pwa_install_dismissed_at';
const DISMISS_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const ANDROID_DELAY_MS = 3000; // show popup shortly after beforeinstallprompt fires
const IOS_DELAY_MS = 6000; // iOS has no event; show manual instructions after a pause

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches ||
  window.matchMedia('(display-mode: minimal-ui)').matches ||
  window.navigator.standalone === true;

const isIosSafari = () => {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const iOS = /iPad|iPhone|iPod/.test(ua);
  const safari =
    /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|wv|UCBrowser/i.test(ua);
  return iOS && safari;
};

const getDismissedAt = () => {
  try {
    return parseInt(localStorage.getItem(STORAGE_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
};

const rememberDismissal = () => {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()));
  } catch {
    // ignore storage errors
  }
};

export default function PwaInstallPrompt() {
  const [show, setShow] = useState(false);
  const [iosMode, setIosMode] = useState(false);
  const deferredPrompt = useRef(null);
  const timers = useRef([]);

  useEffect(() => {
    if (isStandalone()) return;
    if (getDismissedAt() + DISMISS_MS > Date.now()) return;

    const showAfter = (ms) => {
      const t = setTimeout(() => setShow(true), ms);
      timers.current.push(t);
    };

    const onBeforeInstallPrompt = (e) => {
      e.preventDefault(); // suppress the browser's own mini-infobar
      deferredPrompt.current = e;
      setIosMode(false);
      showAfter(ANDROID_DELAY_MS);
    };

    const onAppInstalled = () => {
      setShow(false);
      deferredPrompt.current = null;
      rememberDismissal();
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    if (isIosSafari()) {
      setIosMode(true);
      showAfter(IOS_DELAY_MS);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
      timers.current.forEach(clearTimeout);
    };
  }, []);

  const handleInstall = async () => {
    const prompt = deferredPrompt.current;
    if (!prompt) return;
    setShow(false);
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') rememberDismissal();
    deferredPrompt.current = null;
  };

  const handleDismiss = () => {
    setShow(false);
    rememberDismissal();
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={handleDismiss}
        aria-hidden="true"
      />
      <div className="relative w-full sm:max-w-sm bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 animate-[slideUp_0.25s_ease-out] p-5">
        <div className="flex items-start gap-4">
          <img
            src="/android-chrome-192x192.png"
            alt="TMR Trading Lanka"
            className="h-14 w-14 rounded-xl shadow flex-shrink-0"
          />
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Install TMR Trading
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {iosMode
                ? 'Install this app on your iPhone for quick access, just like an app from the App Store.'
                : 'Add to your device for quick access to sales, inventory and reports.'}
            </p>
          </div>
        </div>

        {iosMode ? (
          <div className="mt-4 rounded-lg bg-gray-50 dark:bg-gray-700 p-4 text-sm text-gray-700 dark:text-gray-200">
            <p>1. Tap the <b>Share</b> button <span className="inline-block align-middle mx-0.5">(square with arrow)</span> in the Safari toolbar.</p>
            <p className="mt-2">2. Scroll down and tap <b>Add to Home Screen</b>.</p>
            <p className="mt-2">3. Tap <b>Add</b> in the top-right corner.</p>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-gray-500 dark:text-gray-400">
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-2">
              <div className="text-lg">📲</div>
              <p className="mt-1">One-tap access from your home screen</p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-2">
              <div className="text-lg">⚡</div>
              <p className="mt-1">Faster loading &amp; updates</p>
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-gray-700 p-2">
              <div className="text-lg">🔒</div>
              <p className="mt-1">Your login stays secure</p>
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={handleDismiss}
            className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            Not now
          </button>
          {iosMode ? (
            <a
              href="https://support.apple.com/guide/iphone/install-web-apps-iph56b314ef0/ios"
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white text-center hover:bg-blue-700"
            >
              How it works
            </a>
          ) : (
            <button
              type="button"
              onClick={handleInstall}
              className="flex-1 px-4 py-2 rounded-lg bg-blue-600 text-sm font-medium text-white hover:bg-blue-700"
            >
              Install
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
