import type { PaymentsProvider } from "@/lib/payments/types";
import { getEnv } from "@/lib/env";
import { MercadoPagoConfig, Preference } from "mercadopago";

export const mercadopagoProvider: PaymentsProvider = {
  id: "mercadopago",
  async createCheckoutSession(input) {
    const env = getEnv();
    if (!env.MERCADOPAGO_ACCESS_TOKEN) throw new Error("mercadopago_not_configured");

    const origin = new URL(input.returnUrl).origin;
    const notificationUrl = new URL("/api/webhooks/mercadopago", origin).toString();

    const client = new MercadoPagoConfig({ accessToken: env.MERCADOPAGO_ACCESS_TOKEN });
    const preference = new Preference(client);

    const created = await preference.create({
      body: {
        external_reference: input.paymentId,
        notification_url: notificationUrl,
        items: [
          {
            id: input.bookingId,
            title: "Gestión Revisión Técnica",
            quantity: 1,
            currency_id: "CLP",
            unit_price: input.amountClp,
          },
        ],
        payer: { email: input.customerEmail },
        back_urls: {
          success: input.returnUrl,
          pending: input.returnUrl,
          failure: input.returnUrl,
        },
        auto_return: "approved",
      },
    });

    const redirectUrl = created.init_point || created.sandbox_init_point;
    if (!redirectUrl) throw new Error("mercadopago_no_init_point");

    return { redirectUrl, externalRef: created.id ?? null };
  },
};

