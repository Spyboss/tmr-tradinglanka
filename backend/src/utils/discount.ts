export function calculateDiscount(
  subtotal: number,
  discountType: 'none' | 'percentage' | 'fixed',
  discountValue: number
): number {
  if (discountType === 'percentage' && discountValue > 0) {
    return Math.round(subtotal * (discountValue / 100) * 100) / 100;
  }
  if (discountType === 'fixed' && discountValue > 0) {
    return Math.min(discountValue, subtotal);
  }
  return 0;
}
