export type PaymentProvider = "mock" | "transbank_webpay" | "flow" | "mercadopago";

export type CreateCheckoutSessionInput = {
  paymentId: string;
  bookingId: string;
  amountClp: number;
  currency: "CLP";
  customerEmail: string;
  returnUrl: string;
};

export type CreateCheckoutSessionResult = {
  redirectUrl: string;
  externalRef?: string | null;
};

export interface PaymentsProvider {
  id: PaymentProvider;
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult>;
}

