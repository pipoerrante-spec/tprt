export function getRequestOrigin(req: Request) {
  const url = new URL(req.url);
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  if (forwardedProto && forwardedHost) return `${forwardedProto}://${forwardedHost}`;
  return url.origin;
}

