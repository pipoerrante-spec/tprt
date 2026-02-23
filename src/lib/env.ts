import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  TPRT_HOLD_TTL_MINUTES: z.coerce.number().int().min(1).max(15).default(7),

  TPRT_PAYMENTS_PROVIDER_ACTIVE: z
    .enum(["mock", "transbank_webpay", "flow", "mercadopago"])
    .default("mock"),
  TPRT_MOCK_WEBHOOK_SECRET: z.string().optional(),

  // Webpay (prepared; do not expose)
  TRANSBANK_COMMERCE_CODE: z.string().optional(),
  TRANSBANK_API_KEY: z.string().optional(),
  TRANSBANK_ENV: z.enum(["integration", "production"]).optional(),
  TRANSBANK_RETURN_SECRET: z.string().optional(),

  // Email (optional; default console)
  EMAIL_PROVIDER: z.enum(["console", "resend", "smtp"]).default("console"),
  EMAIL_FROM: z.string().optional(),
  OPERATIONS_EMAILS: z.string().optional(),
  TPRT_SUPPORT_WHATSAPP: z.string().optional(),
  TPRT_SUPPORT_EMAIL: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  SMTP_URL: z.string().optional(),

  // Reminders / cron
  TPRT_REMINDER_WINDOW_MINUTES: z.coerce.number().int().min(15).max(12 * 60).default(120),
  TPRT_CRON_SECRET: z.string().optional(),

  // Planilla (optional webhook for Zapier/Make/Sheets)
  TPRT_PLANILLA_WEBHOOK_URL: z.string().url().optional(),
  TPRT_PLANILLA_WEBHOOK_SECRET: z.string().optional(),

  // Vehicle lookup (optional)
  VEHICLE_LOOKUP_PROVIDER: z.enum(["none", "http"]).default("none"),
  VEHICLE_LOOKUP_HTTP_URL: z.string().url().optional(),
  VEHICLE_LOOKUP_HTTP_TOKEN: z.string().optional(),

  // MercadoPago (server-only)
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional(),

  // Admin (optional)
  ADMIN_EMAILS: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function getEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const formatted = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid environment variables: ${JSON.stringify(formatted)}`);
  }
  return parsed.data;
}
