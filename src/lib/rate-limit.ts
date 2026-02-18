type RateLimitConfig = {
  windowMs: number;
  max: number;
};

type Counter = { resetAt: number; count: number };

const buckets = new Map<string, Counter>();

export function rateLimit(key: string, config: RateLimitConfig) {
  const now = Date.now();
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { resetAt: now + config.windowMs, count: 1 });
    return { ok: true as const, remaining: config.max - 1, resetAt: now + config.windowMs };
  }

  if (existing.count >= config.max) {
    return { ok: false as const, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  buckets.set(key, existing);
  return { ok: true as const, remaining: config.max - existing.count, resetAt: existing.resetAt };
}

export function getRequestIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return headers.get("x-real-ip") || "unknown";
}

