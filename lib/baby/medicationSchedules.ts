import { supabase } from "@/lib/supabase/client";
import { resolveDataOwnerId } from "@/lib/baby/household";

/**
 * Oraret e ilaçeve.
 *
 * Të dhënat mjekësore ishin vetëm regjistrime të asaj që u dha — pa orar,
 * pa përsëritje. Pra "kujtomë për ilaçin" nuk kishte ku të mbështetej.
 *
 * I përkasin pronarit të të dhënave, jo llogarisë: kështu e sheh edhe
 * prindi tjetër, si gjithçka e bebit.
 */

export type MedicationSchedule = {
  id: string;
  name: string;
  dose: string | null;
  intervalHours: number;
  startAt: string;
  endAt: string | null;
  lastSentAt: string | null;
  active: boolean;
};

function mapRow(row: any): MedicationSchedule {
  return {
    id: row.id,
    name: row.name,
    dose: row.dose ?? null,
    intervalHours: row.interval_hours,
    startAt: row.start_at,
    endAt: row.end_at ?? null,
    lastSentAt: row.last_sent_at ?? null,
    active: row.active,
  };
}

export async function fetchMedicationSchedules(): Promise<MedicationSchedule[]> {
  const ownerId = await resolveDataOwnerId();
  if (!ownerId) return [];

  const { data, error } = await supabase
    .from("medication_schedules")
    .select("*")
    .eq("user_id", ownerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map(mapRow);
}

export async function createMedicationSchedule(input: {
  name: string;
  dose: string;
  intervalHours: number;
  days: number;
}): Promise<void> {
  const ownerId = await resolveDataOwnerId();
  if (!ownerId) throw new Error("Duhet të jesh i kyçur.");

  const endAt = input.days > 0
    ? new Date(Date.now() + input.days * 86400000).toISOString()
    : null;

  const { error } = await supabase.from("medication_schedules").insert({
    user_id: ownerId,
    name: input.name.trim(),
    dose: input.dose.trim() || null,
    interval_hours: input.intervalHours,
    // Doza e parë kujtohet pas një intervali, jo menjëherë: ilaçi sapo u dha.
    start_at: new Date(Date.now() + input.intervalHours * 3600000).toISOString(),
    end_at: endAt,
  });

  if (error) throw new Error(error.message);
}

/**
 * Doza u dha tani: kujtesa e radhes shtyhet me nje interval.
 * Pa kete, prindi qe e jep dozen para kohe do te merrte kujtesen gjithsesi.
 */
export async function markDoseGiven(id: string): Promise<void> {
  const { error } = await supabase
    .from("medication_schedules")
    .update({ last_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export async function stopMedicationSchedule(id: string): Promise<void> {
  const { error } = await supabase
    .from("medication_schedules")
    .update({ active: false, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}
