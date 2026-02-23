import { getEnv } from "@/lib/env";
import { isLikelyChilePlate, normalizePlate } from "@/lib/vehicle/plate";

export type VehicleLookupResult = {
  plate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  source: "none" | "http";
};

function parseProviderJson(json: unknown) {
  if (!json || typeof json !== "object") return null;
  const r = json as Record<string, unknown>;

  const make = (r.make ?? r.marca) as unknown;
  const model = (r.model ?? r.modelo) as unknown;
  const year = (r.year ?? r.anio ?? r.año) as unknown;

  return {
    make: typeof make === "string" && make.trim() ? make.trim() : null,
    model: typeof model === "string" && model.trim() ? model.trim() : null,
    year:
      typeof year === "number"
        ? year
        : typeof year === "string" && year.trim() && /^\d{4}$/.test(year.trim())
          ? Number(year.trim())
          : null,
  };
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

  return { plate, make: null, model: null, year: null, source: "none" };
}

