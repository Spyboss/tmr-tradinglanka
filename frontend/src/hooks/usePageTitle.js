import { useEffect } from 'react';

const BASE_TITLE = 'TMR Trading Lanka (Pvt) Ltd';

/**
 * Sets document.title for the current page.
 * Pass no argument (or empty string) to fall back to the base title.
 *
 *   usePageTitle();                    // "TMR Trading Lanka (Pvt) Ltd"
 *   usePageTitle(`Bill ${billNumber}`); // "Bill INV-0042 · TMR Trading Lanka (Pvt) Ltd"
 */
export default function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · ${BASE_TITLE}` : BASE_TITLE;
  }, [title]);
}
