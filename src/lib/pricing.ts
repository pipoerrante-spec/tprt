export const QA_SERVICE_PRICE_CLP = 85_000;
export const DEMO_COUPON_CODE = "DEMO2026";
export const DEMO_COUPON_DISCOUNT_PERCENT = 99;

export function normalizeCouponCode(raw?: string | null) {
  const value = (raw ?? "").trim().toUpperCase();
  return value.length > 0 ? value : null;
}

export function getCouponDiscountPercent(couponCode?: string | null) {
  return couponCode === DEMO_COUPON_CODE ? DEMO_COUPON_DISCOUNT_PERCENT : 0;
}

export function applyDiscount(baseAmountClp: number, discountPercent: number) {
  const safePercent = Math.max(0, Math.min(100, discountPercent));
  const discountAmountClp = Math.round((baseAmountClp * safePercent) / 100);
  const finalAmountClp = Math.max(baseAmountClp - discountAmountClp, 0);
  return { discountAmountClp, finalAmountClp };
}
