import { MockPaymentClient } from "@/components/payments/mock-payment-client";

export default function MockPagoPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const paymentId = typeof searchParams.paymentId === "string" ? searchParams.paymentId : null;
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <MockPaymentClient paymentId={paymentId} />
    </main>
  );
}

