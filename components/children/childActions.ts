import { ChildError, addChildRemote, type Child } from "@/lib/children/api";
import { resolveChildren } from "@/lib/children/resolve";
import { requestChildSwitch } from "@/lib/children/switchRequest";
import type { TranslationKey } from "@/lib/i18n/translations";

/** Teksti për prindin sipas gabimit; "premium" = hap dritaren e Premium-it në vend të mesazhit. */
export function childErrorMessage(e: unknown): TranslationKey | "premium" {
  const code = e instanceof ChildError ? e.code : e instanceof Error ? e.message : "";
  if (code === "PREMIUM_REQUIRED") return "premium";
  if (code === "FREE_CHANGE_COOLDOWN") return "children_err_cooldown";
  if (code === "NOT_ALLOWED") return "children_err_not_allowed";
  if (code === "DATE_REQUIRED" || code === "INVALID_DATE") return "children_err_date";
  if (code === "OFFLINE" || code === "SYNC_NOT_READY" || /network|fetch/i.test(String(code))) return "children_err_offline";
  return "children_err_generic";
}

/** Shton fëmijën dhe kalon te ai. */
export async function addChildAndSwitch(input: { name: string; birthDate: string | null; dueDate?: string | null }): Promise<string> {
  const id = await addChildRemote(input);
  await resolveChildren({ force: true });
  await requestChildSwitch(id);
  return id;
}

export function childLabel(child: Pick<Child, "name">, unnamed: string): string {
  return child.name?.trim() || unnamed;
}
