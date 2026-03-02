import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const OPS_USERNAME = "jorge";
export const OPS_PASSWORD = "jorge2026";
export const OPS_AUTH_COOKIE = "gvrt_ops_session";
const OPS_AUTH_COOKIE_VALUE = "jorge-authenticated";

export function isValidOpsCredentials(username: string, password: string) {
  return username === OPS_USERNAME && password === OPS_PASSWORD;
}

export async function isOpsAuthenticated() {
  const store = await cookies();
  return store.get(OPS_AUTH_COOKIE)?.value === OPS_AUTH_COOKIE_VALUE;
}

export async function setOpsAuthCookie() {
  const store = await cookies();
  store.set(OPS_AUTH_COOKIE, OPS_AUTH_COOKIE_VALUE, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearOpsAuthCookie() {
  const store = await cookies();
  store.delete(OPS_AUTH_COOKIE);
}

export async function assertOpsAuthorized() {
  if (await isOpsAuthenticated()) return null;
  return NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
