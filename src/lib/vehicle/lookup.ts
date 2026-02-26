import { getEnv } from "@/lib/env";
import { isLikelyChilePlate, normalizePlate } from "@/lib/vehicle/plate";

export type VehicleLookupResult = {
  plate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  source: "none" | "http" | "getapi_patente";
};

function readString(v: unknown) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function readYear(v: unknown) {
  if (typeof v === "number" && v >= 1900 && v <= 2100) return v;
  if (typeof v === "string" && /^\d{4}$/.test(v.trim())) return Number(v.trim());
  return null;
}

function walkObject(root: unknown, visit: (obj: Record<string, unknown>) => void) {
  if (!root || typeof root !== "object") return;
  const stack: unknown[] = [root];
  const seen = new Set<unknown>();
  while (stack.length) {
    const node = stack.pop();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) stack.push(item);
      continue;
    }
    const obj = node as Record<string, unknown>;
    visit(obj);
    for (const value of Object.values(obj)) stack.push(value);
  }
}

function parseProviderJson(json: unknown) {
  if (!json || typeof json !== "object") return null;

  let make: string | null = null;
  let model: string | null = null;
  let year: number | null = null;

  walkObject(json, (r) => {
    if (!make) make = readString(r.make ?? r.marca ?? r.brand ?? r.fabricante);
    if (!model) model = readString(r.model ?? r.modelo ?? r.version ?? r.versión);
    if (!year) year = readYear(r.year ?? r.anio ?? r.año ?? r.vehicle_year);
  });

  return { make, model, year };
}

export async function lookupVehicleByPlate(inputPlate: string): Promise<VehicleLookupResult> {
  const env = getEnv();
  const plate = normalizePlate(inputPlate);
  if (!isLikelyChilePlate(plate)) {
    return { plate, make: null, model: null, year: null, source: env.VEHICLE_LOOKUP_PROVIDER };
  }

  if (env.VEHICLE_LOOKUP_PROVIDER === "none") {
    return { plate, make: null, model: null, year: null, source: "none" };
  }

  if (env.VEHICLE_LOOKUP_PROVIDER === "http") {
    if (!env.VEHICLE_LOOKUP_HTTP_URL) {
      return { plate, make: null, model: null, year: null, source: "http" };
    }

    const url = new URL(env.VEHICLE_LOOKUP_HTTP_URL);
    url.searchParams.set("plate", plate);

    const res = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(env.VEHICLE_LOOKUP_HTTP_TOKEN ? { Authorization: `Bearer ${env.VEHICLE_LOOKUP_HTTP_TOKEN}` } : null),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return { plate, make: null, model: null, year: null, source: "http" };
    }
    const json = await res.json().catch(() => null);
    const parsed = parseProviderJson(json);
    return { plate, make: parsed?.make ?? null, model: parsed?.model ?? null, year: parsed?.year ?? null, source: "http" };
  }

  if (env.VEHICLE_LOOKUP_PROVIDER === "getapi_patente") {
    const url = `https://chile.getapi.cl/v1/vehicles/plate/${encodeURIComponent(plate)}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        ...(env.GETAPI_PATENTE_API_KEY ? { "x-api-key": env.GETAPI_PATENTE_API_KEY } : null),
      },
      cache: "no-store",
    });
    if (!res.ok) {
      return { plate, make: null, model: null, year: null, source: "getapi_patente" };
    }
    const json = await res.json().catch(() => null);
    const parsed = parseProviderJson(json);
    return {
      plate,
      make: parsed?.make ?? null,
      model: parsed?.model ?? null,
      year: parsed?.year ?? null,
      source: "getapi_patente",
    };
  }

  return { plate, make: null, model: null, year: null, source: "none" };
}
