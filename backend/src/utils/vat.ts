export const DEFAULT_VAT_RATE = 18;

export interface VatBreakdown {
  /** Net value of supply, exclusive of VAT (LKR, 2dp) */
  taxableValue: number;
  /** VAT charged (LKR, 2dp) */
  vatAmount: number;
  /** Total consideration inclusive of VAT (LKR, 2dp) */
  total: number;
}

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

const assertAmount = (n: number): void => {
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) {
    throw new Error(`Invalid amount: ${n}`);
  }
};

/**
 * Split a gross (VAT-inclusive) amount into net + VAT.
 * Retail price tags are gross: output VAT = gross * rate / (100 + rate).
 */
export function vatFromGross(gross: number, rate: number = DEFAULT_VAT_RATE): VatBreakdown {
  assertAmount(gross);
  const total = round2(gross);
  const taxableValue = round2(gross / (1 + rate / 100));
  const vatAmount = round2(total - taxableValue);
  return { taxableValue, vatAmount, total };
}

/**
 * Add VAT on top of a net (VAT-exclusive) amount.
 */
export function vatFromNet(net: number, rate: number = DEFAULT_VAT_RATE): VatBreakdown {
  assertAmount(net);
  const taxableValue = round2(net);
  const vatAmount = round2((taxableValue * rate) / 100);
  const total = round2(taxableValue + vatAmount);
  return { taxableValue, vatAmount, total };
}

/**
 * Single entry point driven by the tax profile's "prices include VAT" mode.
 */
export function computeVat(
  amount: number,
  pricesIncludeVat: boolean,
  rate: number = DEFAULT_VAT_RATE
): VatBreakdown {
  return pricesIncludeVat ? vatFromGross(amount, rate) : vatFromNet(amount, rate);
}
