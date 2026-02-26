import { WebpayRedirectClient } from "@/components/payments/webpay-redirect-client";

type SearchParamsInput =
  | Record<string, string | string[] | undefined>
  | Promise<Record<string, string | string[] | undefined>>;

export default async function WebpayPagoPage({
  searchParams,
}: {
  searchParams: SearchParamsInput;
}) {
  const resolved = await Promise.resolve(searchParams);
  const url = typeof resolved.url === "string" ? resolved.url : null;
  const token = typeof resolved.token_ws === "string" ? resolved.token_ws : null;
  return (
    <main className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <WebpayRedirectClient url={url} token={token} />
    </main>
  );
}
