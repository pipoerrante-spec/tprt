import type { PaymentsProvider } from "@/lib/payments/types";
import { getEnv } from "@/lib/env";

export const transbankWebpayProvider: PaymentsProvider = {
  id: "transbank_webpay",
  async createCheckoutSession() {
    const env = getEnv();
    if (!env.TRANSBANK_COMMERCE_CODE || !env.TRANSBANK_API_KEY || !env.TRANSBANK_ENV) {
      throw new Error("transbank_not_configured");
    }

    // Prepared provider interface:
    // - create transaction server-side
    // - return redirect URL
    // NOTE: Do not implement integration calls without official SDK + keys.
    throw new Error("transbank_not_implemented");
  },
};

