import { getEnv } from "@/lib/env";
import { isLikelyChilePlate, normalizePlate } from "@/lib/vehicle/plate";

export type VehicleLookupResult = {
  plate: string;
  make: string | null;
  model: string | null;
  year: number | null;
  version: string | null;
  color: string | null;
  vinNumber: string | null;
  engineNumber: string | null;
  engine: string | null;
  fuel: string | null;
  transmission: string | null;
  doors: number | null;
  vehicleType: string | null;
  monthRT: string | null;
  source: "none" | "http" | "getapi_patente";
};

type VehicleLookupDetails = Omit<VehicleLookupResult, "plate" | "source">;

function readString(v: unknown) {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function readYear(v: unknown) {
  if (typeof v === "number" && v >= 1900 && v <= 2100) return v;
  if (typeof v === "string" && /^\d{4}$/.test(v.trim())) return Number(v.trim());
  return null;
}

function readInt(v: unknown) {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && /^\d+$/.test(v.trim())) return Number(v.trim());
  return null;
}

function readNestedString(root: unknown, path: string[]) {
  let node: unknown = root;
  for (const key of path) {
    if (!node || typeof node !== "object") return null;
    node = (node as Record<string, unknown>)[key];
  }
  return readString(node);
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
    if (!make) {
      make =
        readString(r.make ?? r.marca ?? r.fabricante ?? r.brand_name ?? r.brandName) ??
        readNestedString(r.brand, ["name"]) ??
        readNestedString(r, ["model", "brand", "name"]);
    }
    if (!model) {
      model =
        readString(r.model ?? r.modelo ?? r.model_name ?? r.modelName) ??
        readNestedString(r.model, ["name"]) ??
        readString(r.version ?? r.versión);
    }
    if (!year) year = readYear(r.year ?? r.anio ?? r.año ?? r.vehicle_year ?? r.model_year ?? r.modelYear);
  });

  return { make, model, year };
}

const EMPTY_DETAILS: VehicleLookupDetails = {
  make: null,
  model: null,
  year: null,
  version: null,
  color: null,
  vinNumber: null,
  engineNumber: null,
  engine: null,
  fuel: null,
  transmission: null,
  doors: null,
  vehicleType: null,
  monthRT: null,
};

function parseGetapiDetails(json: unknown): VehicleLookupDetails {
  if (!json || typeof json !== "object") return { ...EMPTY_DETAILS };
  const root = json as Record<string, unknown>;
  const data = (root.data && typeof root.data === "object" ? root.data : root) as Record<string, unknown>;

  const fallback = parseProviderJson(json);

  return {
    make: readNestedString(data, ["model", "brand", "name"]) ?? fallback?.make ?? null,
    model: readNestedString(data, ["model", "name"]) ?? fallback?.model ?? null,
    year: readYear(data.year) ?? fallback?.year ?? null,
    version: readString(data.version),
    color: readString(data.color),
    vinNumber: readString(data.vinNumber),
    engineNumber: readString(data.engineNumber),
    engine: readString(data.engine),
    fuel: readString(data.fuel),
    transmission: readString(data.transmission),
    doors: readInt(data.doors),
    vehicleType: readNestedString(data, ["model", "typeVehicle", "name"]),
    monthRT: readString(data.monthRT),
  };
}

function mapLetterToDigit(input: string) {
  const map: Record<string, string> = {
    I: "1",
    L: "1",
    O: "0",
    Q: "0",
    S: "5",
    B: "8",
    Z: "2",
    G: "6",
  };
  return map[input] ?? input;
}

function buildGetapiFallbackCandidates(plate: string) {
  const candidates = new Set<string>();
  const addCandidate = (prefixLen: number) => {
    if (plate.length <= prefixLen) return;
    const prefix = plate.slice(0, prefixLen);
    const suffix = plate.slice(prefixLen);
    if (!/[A-Z]/.test(suffix)) return;
    const normalizedSuffix = suffix
      .split("")
      .map((ch) => mapLetterToDigit(ch))
      .join("");
    if (normalizedSuffix !== suffix) candidates.add(prefix + normalizedSuffix);
  };

  // Common Chile formats.
  addCandidate(4); // ABCD12
  addCandidate(2); // AB1234

  return [...candidates];
}

async function fetchGetapiPlate(plate: string, apiKey?: string) {
  const url = `https://chile.getapi.cl/v1/vehicles/plate/${encodeURIComponent(plate)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(apiKey ? { "x-api-key": apiKey } : null),
    },
    cache: "no-store",
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, json };
}

export async function lookupVehicleByPlate(inputPlate: string): Promise<VehicleLookupResult> {
  const env = getEnv();
  const plate = normalizePlate(inputPlate);
  if (!isLikelyChilePlate(plate)) {
    return { plate, ...EMPTY_DETAILS, source: env.VEHICLE_LOOKUP_PROVIDER };
  }

  if (env.VEHICLE_LOOKUP_PROVIDER === "none") {
    return { plate, ...EMPTY_DETAILS, source: "none" };
  }

  if (env.VEHICLE_LOOKUP_PROVIDER === "http") {
    if (!env.VEHICLE_LOOKUP_HTTP_URL) {
      return { plate, ...EMPTY_DETAILS, source: "http" };
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
      return { plate, ...EMPTY_DETAILS, source: "http" };
    }
    const json = await res.json().catch(() => null);
    const parsed = parseProviderJson(json);
    return {
      plate,
      ...EMPTY_DETAILS,
      make: parsed?.make ?? null,
      model: parsed?.model ?? null,
      year: parsed?.year ?? null,
      source: "http",
    };
  }

  if (env.VEHICLE_LOOKUP_PROVIDER === "getapi_patente") {
    const primary = await fetchGetapiPlate(plate, env.GETAPI_PATENTE_API_KEY);
    if (primary.ok) {
      const parsed = parseGetapiDetails(primary.json);
      return {
        plate,
        ...parsed,
        source: "getapi_patente",
      };
    }

    // If provider rejects format (e.g. SBGY6I vs SBGY61), retry with common visual substitutions.
    if (primary.status === 422 || primary.status === 404) {
      for (const candidate of buildGetapiFallbackCandidates(plate)) {
        const retry = await fetchGetapiPlate(candidate, env.GETAPI_PATENTE_API_KEY);
        if (!retry.ok) continue;
        const parsed = parseGetapiDetails(retry.json);
        return {
          plate: candidate,
          ...parsed,
          source: "getapi_patente",
        };
      }
    }

    return { plate, ...EMPTY_DETAILS, source: "getapi_patente" };
  }

  return { plate, ...EMPTY_DETAILS, source: "none" };
}
