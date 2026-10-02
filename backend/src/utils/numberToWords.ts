const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen'
];

const TENS = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'
];

const under100 = (n: number): string => {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return `${TENS[t]}${o ? ` ${ONES[o]}` : ''}`;
};

const under1000 = (n: number): string => {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} Hundred`);
  if (rest) parts.push(under100(rest));
  return parts.join(' and ');
};

/**
 * Integer to words in the Sri Lankan numbering system
 * (crore / lakh / thousand / hundred).
 */
export const integerToWords = (n: number): string => {
  if (n === 0) return 'Zero';
  if (n < 0 || !Number.isSafeInteger(n)) throw new Error(`Cannot spell: ${n}`);

  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1_000);
  n %= 1_000;

  if (crore) parts.push(`${integerToWords(crore)} Crore`);
  if (lakh) parts.push(`${under100(lakh)} Lakh`);
  if (thousand) parts.push(`${under100(thousand)} Thousand`);
  if (n) parts.push(under1000(n));
  return parts.join(' ');
};

/**
 * Gazette Annexure I 4.1.g.iv: total consideration expressed in words.
 * e.g. 450000 -> "Rupees Four Lakh Fifty Thousand Only"
 * e.g. 450120.50 -> "Rupees Four Lakh Fifty Thousand and One Hundred and Twenty and Fifty Cents Only"
 */
export const amountInWords = (amount: number): string => {
  if (!Number.isFinite(amount) || amount < 0) throw new Error(`Invalid amount: ${amount}`);
  const rupees = Math.floor(amount + 1e-9);
  const cents = Math.round((amount - rupees) * 100);
  let out = `Rupees ${integerToWords(rupees)}`;
  if (cents > 0) out += ` and ${integerToWords(cents)} Cents`;
  return `${out} Only`;
};
