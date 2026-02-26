import type { PaymentsProvider } from "@/lib/payments/types";
import { getEnv } from "@/lib/env";
import { Environment, Options, WebpayPlus } from "transbank-sdk";

function toTransbankBuyOrder(paymentId: string) {
  // Webpay Plus accepts max 26 chars for buy_order.
  return `P${paymentId.replace(/-/g, "").slice(0, 25)}`;
}

export const transbankWebpayProvider: PaymentsProvider = {
  id: "transbank_webpay",
  async createCheckoutSession(input) {
    const env = getEnv();
    if (!env.TRANSBANK_COMMERCE_CODE || !env.TRANSBANK_API_KEY || !env.TRANSBANK_ENV) {
      throw new Error("transbank_not_configured");
    }

    const origin = new URL(input.returnUrl).origin;
    const envMode = env.TRANSBANK_ENV === "production" ? Environment.Production : Environment.Integration;
    const options = new Options(env.TRANSBANK_COMMERCE_CODE, env.TRANSBANK_API_KEY, envMode);

    const returnUrl = new URL("/api/webhooks/transbank", origin);
    if (env.TRANSBANK_RETURN_SECRET) returnUrl.searchParams.set("secret", env.TRANSBANK_RETURN_SECRET);

    const tx = new WebpayPlus.Transaction(options);
    const buyOrder = toTransbankBuyOrder(input.paymentId);
    const created = await tx.create(buyOrder, input.paymentId, input.amountClp, returnUrl.toString());

    const redirect = new URL("/pago/webpay", origin);
    redirect.searchParams.set("token_ws", created.token);
    redirect.searchParams.set("url", created.url);

    return { redirectUrl: redirect.pathname + "?" + redirect.searchParams.toString(), externalRef: created.token };
  },
};
