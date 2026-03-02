export const SITE_PRODUCT_PRICE_CLP = 50;

export function normalizeCouponCode(raw?: string | null) {
  const value = (raw ?? "").trim().toUpperCase();
  return value.length > 0 ? value : null;
}

export function getCouponDiscountPercent(_couponCode?: string | null) {
  void _couponCode;
  return 0;
}

export function applyDiscount(baseAmountClp: number, discountPercent: number) {
  const safePercent = Math.max(0, Math.min(100, discountPercent));
  const discountAmountClp = Math.round((baseAmountClp * safePercent) / 100);
  const finalAmountClp = Math.max(baseAmountClp - discountAmountClp, 0);
  return { discountAmountClp, finalAmountClp };
}
