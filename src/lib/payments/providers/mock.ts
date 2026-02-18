import type { PaymentsProvider } from "@/lib/payments/types";

export const mockProvider: PaymentsProvider = {
  id: "mock",
  async createCheckoutSession({ paymentId }) {
    return {
      redirectUrl: `/pago/mock?paymentId=${encodeURIComponent(paymentId)}`,
      externalRef: paymentId,
    };
  },
};

