import type { VaccineStatus } from "@/lib/state/babyTypes";

/**
 * Statusi i një vaksine sipas datës. I përbashkët për ekranin e vaksinave dhe
 * për njoftimet, që të dyja të tregojnë të njëjtën gjë.
 */
export function computeVaccineStatus(
  v: { dueDate: string; givenDate: string | null },
  now: Date = new Date()
): VaccineStatus {
  if (v.givenDate) return "done";
  const due = new Date(v.dueDate);
  if (due.toDateString() === now.toDateString()) return "due_today";
  return due.getTime() < now.getTime() ? "overdue" : "upcoming";
}
