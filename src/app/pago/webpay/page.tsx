import { WebpayRedirectClient } from "@/components/payments/webpay-redirect-client";

export default function WebpayPagoPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const url = typeof searchParams.url === "string" ? searchParams.url : null;
  const token = typeof searchParams.token_ws === "string" ? searchParams.token_ws : null;
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <WebpayRedirectClient url={url} token={token} />
    </main>
  );
}

