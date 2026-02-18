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

  // Email (optional; default console)
  EMAIL_PROVIDER: z.enum(["console", "resend", "smtp"]).default("console"),
  RESEND_API_KEY: z.string().optional(),
  SMTP_URL: z.string().optional(),

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
