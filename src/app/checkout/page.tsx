import { CheckoutClient } from "@/components/checkout/checkout-client";

export default function CheckoutPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const holdId = typeof searchParams.holdId === "string" ? searchParams.holdId : null;
  const initialCouponCode = typeof searchParams.coupon === "string" ? searchParams.coupon : null;
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <CheckoutClient holdId={holdId} initialCouponCode={initialCouponCode} />
    </main>
  );
}
