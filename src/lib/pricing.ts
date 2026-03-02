export const SITE_PRODUCT_PRICE_CLP = 85_000;

function getConfiguredCoupon() {
  const code = (process.env.NEXT_PUBLIC_ACTIVE_COUPON_CODE ?? "").trim().toUpperCase();
  const discountPercent = Number(process.env.NEXT_PUBLIC_ACTIVE_COUPON_DISCOUNT_PERCENT ?? 0);

  if (!code || !Number.isFinite(discountPercent)) return null;

  const safePercent = Math.max(0, Math.min(100, Math.trunc(discountPercent)));
  if (safePercent <= 0) return null;

  return { code, discountPercent: safePercent };
}

export function normalizeCouponCode(raw?: string | null) {
  const value = (raw ?? "").trim().toUpperCase();
  return value.length > 0 ? value : null;
}

export function hasActiveCouponConfigured() {
  return getConfiguredCoupon() !== null;
}

export function getCouponDiscountPercent(couponCode?: string | null) {
  const configured = getConfiguredCoupon();
  if (!configured) return 0;
  return couponCode === configured.code ? configured.discountPercent : 0;
}

export function applyDiscount(baseAmountClp: number, discountPercent: number) {
  const safePercent = Math.max(0, Math.min(100, discountPercent));
  const discountAmountClp = Math.round((baseAmountClp * safePercent) / 100);
  const finalAmountClp = Math.max(baseAmountClp - discountAmountClp, 0);
  return { discountAmountClp, finalAmountClp };
}
