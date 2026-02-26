import { CartClient } from "@/components/cart/cart-client";

export default async function CartPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const holdId = typeof searchParams.holdId === "string" ? searchParams.holdId : null;
  const couponCode = typeof searchParams.coupon === "string" ? searchParams.coupon : null;
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <CartClient holdId={holdId} couponCode={couponCode} />
    </main>
  );
}
