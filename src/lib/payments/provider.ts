import { getEnv } from "@/lib/env";
import type { PaymentsProvider, PaymentProvider } from "@/lib/payments/types";
import { mockProvider } from "@/lib/payments/providers/mock";
import { transbankWebpayProvider } from "@/lib/payments/providers/transbank-webpay";
import { mercadopagoProvider } from "@/lib/payments/providers/mercadopago";

export function getActivePaymentsProvider(): PaymentsProvider {
  const env = getEnv();
  const active = env.TPRT_PAYMENTS_PROVIDER_ACTIVE;
  return getPaymentsProvider(active);
}

export function getPaymentsProvider(id: PaymentProvider): PaymentsProvider {
  switch (id) {
    case "mock":
      return mockProvider;
    case "transbank_webpay":
      return transbankWebpayProvider;
    case "flow":
      return {
        id,
        async createCheckoutSession() {
          throw new Error(`${id}_not_implemented`);
        },
      };
    case "mercadopago":
      return mercadopagoProvider;
    default: {
      const _exhaustive: never = id;
      return _exhaustive;
    }
  }
}
