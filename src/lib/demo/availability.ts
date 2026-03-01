import type { SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_RULES = [
  { weekday: 1, start_time: "07:30:00", end_time: "17:30:00", slot_minutes: 120, capacity: 3 },
  { weekday: 2, start_time: "07:30:00", end_time: "17:30:00", slot_minutes: 120, capacity: 3 },
  { weekday: 3, start_time: "07:30:00", end_time: "17:30:00", slot_minutes: 120, capacity: 3 },
  { weekday: 4, start_time: "07:30:00", end_time: "17:30:00", slot_minutes: 120, capacity: 3 },
  { weekday: 5, start_time: "07:30:00", end_time: "17:30:00", slot_minutes: 120, capacity: 3 },
  { weekday: 6, start_time: "07:30:00", end_time: "17:30:00", slot_minutes: 120, capacity: 3 },
];

const DEMO_SLOT_TIMES = ["07:30:00", "09:30:00", "11:30:00", "13:30:00", "15:30:00"];
const DEFAULT_SLOT_CAPACITY = 3;

export async function ensureDemoCoverageAndRules(
  supabase: SupabaseClient,
  serviceId: string,
  communeId: string,
) {
  const coverageResult = await supabase
    .from("service_coverage")
    .upsert({ service_id: serviceId, commune_id: communeId, active: true }, { onConflict: "service_id,commune_id" });
  if (coverageResult.error) throw coverageResult.error;

  const rules = DEFAULT_RULES.map((r) => ({
    commune_id: communeId,
    service_id: serviceId,
    ...r,
  }));
  const rulesResult = await supabase
    .from("availability_rules")
    .upsert(rules, { onConflict: "commune_id,service_id,weekday,start_time,end_time" });
  if (rulesResult.error) throw rulesResult.error;
}

export async function ensureDemoCoverageAndRulesForCommunes(
  supabase: SupabaseClient,
  serviceId: string,
  communeIds: string[],
) {
  const uniqueCommuneIds = [...new Set(communeIds)].filter(Boolean);
  if (uniqueCommuneIds.length === 0) return;

  const coverageResult = await supabase.from("service_coverage").upsert(
    uniqueCommuneIds.map((communeId) => ({
      service_id: serviceId,
      commune_id: communeId,
      active: true,
    })),
    { onConflict: "service_id,commune_id" },
  );
  if (coverageResult.error) throw coverageResult.error;

  const rules = uniqueCommuneIds.flatMap((communeId) =>
    DEFAULT_RULES.map((r) => ({
      commune_id: communeId,
      service_id: serviceId,
      ...r,
    })),
  );
  const rulesResult = await supabase
    .from("availability_rules")
    .upsert(rules, { onConflict: "commune_id,service_id,weekday,start_time,end_time" });
  if (rulesResult.error) throw rulesResult.error;
}

type DemoSlot = {
  date: string;
  time: string;
  capacity: number;
  reserved: number;
  remaining: number;
  demand: "sold_out" | "high" | "medium" | "low";
  available: boolean;
};

export function buildDemoSlots(dateFromIso: string, dateToIso: string): DemoSlot[] {
  const slots: DemoSlot[] = [];
  const current = new Date(`${dateFromIso}T12:00:00Z`);
  const end = new Date(`${dateToIso}T12:00:00Z`);

  while (current <= end) {
    const isoDate = current.toISOString().slice(0, 10);
    const dow = current.getUTCDay();
    const isWeekday = dow >= 1 && dow <= 5;
    const isSaturday = dow === 6;

    if (isWeekday || isSaturday) {
      for (const time of DEMO_SLOT_TIMES) {
        slots.push({
          date: isoDate,
          time,
          capacity: DEFAULT_SLOT_CAPACITY,
          reserved: 0,
          remaining: DEFAULT_SLOT_CAPACITY,
          demand: "low",
          available: true,
        });
      }
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return slots;
}
