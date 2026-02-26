import { MockPaymentClient } from "@/components/payments/mock-payment-client";

type SearchParamsInput =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

export default async function MockPagoPage({
  searchParams,
}: {
  searchParams: SearchParamsInput;
}) {
  const resolved = await Promise.resolve(searchParams);
  const paymentId = typeof resolved.paymentId === "string" ? resolved.paymentId : null;
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <MockPaymentClient paymentId={paymentId} />
    </main>
  );
}
