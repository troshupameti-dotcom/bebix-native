// SDK 54 made the new object-oriented File/Directory API the default
// export of `expo-file-system`. This file was written against the
// older functional API (cacheDirectory + writeAsStringAsync), which
// still exists and is fully supported — just moved to the `/legacy`
// subpath. Importing from there keeps this file's behavior byte-for-byte
// identical to before the SDK bump.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Print from "expo-print";
import { BabyModuleState } from "@/lib/state/types";
import type { BabyProfile } from "@/lib/state/types";
import { active } from "@/lib/state/AppStateContext";
import { buildHealthReportHtml } from "@/lib/healthReport";

type ExportRow = { kind: string; date: string; title: string; details: string };

/** Flattens every active (non-deleted, non-archived) record into one common shape. */
export function buildExportRows(b: BabyModuleState): ExportRow[] {
  const rows: ExportRow[] = [];

  active(b.feedingLog).forEach((e) =>
    rows.push({
      kind: "Feeding",
      date: e.at,
      title: e.type,
      details: [e.amountMl ? `${e.amountMl}ml` : null, e.durationMin ? `${e.durationMin}min` : null, e.side, e.foodCategory, e.note]
        .filter(Boolean)
        .join(" | "),
    })
  );
  active(b.sleepLog).forEach((e) =>
    rows.push({
      kind: "Sleep",
      date: e.startAt,
      title: e.isNap ? "Nap" : "Night sleep",
      details: [e.endAt ? `until ${e.endAt}` : "ongoing", e.quality, e.note].filter(Boolean).join(" | "),
    })
  );
  active(b.diaperLog).forEach((e) =>
    rows.push({ kind: "Diaper", date: e.at, title: e.type, details: [e.color, e.consistency, e.note].filter(Boolean).join(" | ") })
  );
  active(b.growthHistory).forEach((e) =>
    rows.push({
      kind: "Growth",
      date: e.date,
      title: "Measurement",
      details: [e.weightKg ? `${e.weightKg}kg` : null, e.heightCm ? `${e.heightCm}cm` : null, e.headCm ? `${e.headCm}cm head` : null, e.note]
        .filter(Boolean)
        .join(" | "),
    })
  );
  active(b.vaccines).forEach((e) =>
    rows.push({ kind: "Vaccine", date: e.givenDate ?? e.dueDate, title: e.name, details: [e.doctor, e.clinic, e.note].filter(Boolean).join(" | ") })
  );
  active(b.medicalRecords).forEach((e) =>
    rows.push({ kind: "Medical", date: e.at, title: `${e.type}: ${e.title}`, details: [e.value, e.doctor, e.note].filter(Boolean).join(" | ") })
  );
  active(b.moments).forEach((e) =>
    rows.push({ kind: "Moment", date: e.date, title: e.title || e.type, details: [e.description, e.tags.join(", ")].filter(Boolean).join(" | ") })
  );
  active(b.timeline).forEach((e) => rows.push({ kind: "Event", date: e.date, title: e.title, details: e.note }));

  return rows.sort((a, c) => new Date(c.date).getTime() - new Date(a.date).getTime());
}

function csvEscape(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

async function shareFile(uri: string, mimeType: string) {
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: "Bebix" });
  }
}

export async function exportAsCSV(b: BabyModuleState, babyName: string) {
  const rows = buildExportRows(b);
  const header = "Kind,Date,Title,Details";
  const lines = rows.map((r) => [r.kind, r.date, r.title, r.details].map(csvEscape).join(","));
  const csv = [header, ...lines].join("\n");
  const uri = FileSystem.cacheDirectory + `bebix-${babyName.replace(/\s+/g, "-").toLowerCase()}.csv`;
  await FileSystem.writeAsStringAsync(uri, csv);
  await shareFile(uri, "text/csv");
}

/**
 * PDF-ja është raporti shëndetësor (shih lib/healthReport.ts): profili, alergjitë, rritja, vaksinat, kartela mjekësore
 * dhe kontaktet e emergjencës, me datën e gjenerimit të çastit. Pa ushqyerje, pelena apo gjumë.
 */
export async function exportAsPDF(profile: BabyProfile, b: BabyModuleState, lang: "sq" | "en", babyLabel: string) {
  const html = buildHealthReportHtml(profile, b, lang, new Date(), babyLabel);
  const { uri } = await Print.printToFileAsync({ html });
  await shareFile(uri, "application/pdf");
}
