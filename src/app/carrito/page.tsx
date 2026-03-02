import { CartClient } from "@/components/cart/cart-client";

type SearchParamsInput =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

export default async function CartPage({
  searchParams,
}: {
  searchParams: SearchParamsInput;
}) {
  const resolved = await Promise.resolve(searchParams);
  const holdId = typeof resolved.holdId === "string" ? resolved.holdId : null;
  const couponCode = typeof resolved.coupon === "string" ? resolved.coupon : null;
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <CartClient holdId={holdId} couponCode={couponCode} />
    </main>
  );
}
