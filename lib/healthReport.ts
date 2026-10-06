import type { BabyModuleState } from "@/lib/state/babyTypes";
import type { BabyProfile } from "@/lib/state/types";

/**
 * Raporti shëndetësor i bebit (PDF për mjekun): vetëm shëndeti.
 * Profili (gjinia, mosha, grupi i gjakut), alergjitë, rritja, vaksinat, kartela mjekësore dhe kontaktet e emergjencës.
 * NUK përmban ushqyerjen, pelenat, gjumin apo momentet.
 *
 * Çdo seksion tregon datën e përditësimit të fundit të të dhënave të tij, dhe raporti tregon kur u gjenerua:
 * i hapur nesër, del me të dhënat e sotme dhe me datën e re (nuk ruhet asgjë e vjetër).
 */
export type Lang = "sq" | "en";

const TX = {
  sq: {
    title: "Raporti shëndetësor",
    generated: "Gjeneruar më",
    profile: "Të dhënat e bebit", name: "Emri", gender: "Gjinia", dob: "Data e lindjes", age: "Mosha", blood: "Grupi i gjakut",
    allergies: "Alergjitë", doctor: "Pediatri", notes: "Shënime mjekësore", none: "Nuk është shënuar",
    girl: "Vajzë", boy: "Djalë", other: "Tjetër",
    growth: "Rritja", date: "Data", weight: "Pesha", height: "Gjatësia", head: "Perimetri i kokës",
    latest: "Matja e fundit", vaccines: "Vaksinat", vaccine: "Vaksina", given: "Dhënë", due: "Afati", pending: "Pa dhënë", clinic: "Klinika",
    records: "Kartela mjekësore", type: "Lloji", detail: "Detaje", other_info: "Të tjera",
    contacts: "Kontaktet e emergjencës", phone: "Telefoni", relation: "Lidhja",
    updated: "Përditësuar", empty: "Asnjë e dhënë.",
    years: "vjeç", months: "muajsh", days: "ditësh", and: "dhe",
    types: { symptom: "Simptomë", temperature: "Temperaturë", medication: "Ilaç", doctor_visit: "Vizitë te mjeku", prescription: "Recetë", document: "Dokument" } as Record<string, string>,
    footer: "Ky raport është përpiluar nga të dhënat që ka shkruar prindi te Bebix. Nuk zëvendëson vlerësimin e mjekut.",
  },
  en: {
    title: "Health report",
    generated: "Generated on",
    profile: "Baby details", name: "Name", gender: "Gender", dob: "Date of birth", age: "Age", blood: "Blood type",
    allergies: "Allergies", doctor: "Pediatrician", notes: "Medical notes", none: "Not recorded",
    girl: "Girl", boy: "Boy", other: "Other",
    growth: "Growth", date: "Date", weight: "Weight", height: "Height", head: "Head circumference",
    latest: "Latest measurement", vaccines: "Vaccinations", vaccine: "Vaccine", given: "Given", due: "Due", pending: "Not given", clinic: "Clinic",
    records: "Medical records", type: "Type", detail: "Details", other_info: "Other",
    contacts: "Emergency contacts", phone: "Phone", relation: "Relation",
    updated: "Updated", empty: "No entries.",
    years: "years old", months: "months old", days: "days old", and: "and",
    types: { symptom: "Symptom", temperature: "Temperature", medication: "Medication", doctor_visit: "Doctor visit", prescription: "Prescription", document: "Document" } as Record<string, string>,
    footer: "This report is compiled from what the parent entered in Bebix. It does not replace a doctor's assessment.",
  },
} as const;

/** Kolonat e katalogut mjekësor që s'janë shëndet (madhësia e pelenës). */
const NOT_HEALTH_KEYS = new Set(["diaper_size"]);

type Live = { deletedAt: string | null; archivedAt: string | null; updatedAt: string };
const live = <T extends Live>(items: T[]): T[] => items.filter((i) => !i.deletedAt && !i.archivedAt);

export function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "sq-AL", { day: "numeric", month: "long", year: "numeric" });
}

/** Mosha nga data e lindjes, e llogaritur në çastin e gjenerimit ("1 vjeç dhe 3 muajsh", "5 muajsh", "12 ditësh"). */
export function ageText(dob: string | null | undefined, now: Date, lang: Lang): string | null {
  if (!dob) return null;
  const b = new Date(dob);
  if (Number.isNaN(b.getTime()) || b > now) return null;
  let months = (now.getFullYear() - b.getFullYear()) * 12 + (now.getMonth() - b.getMonth());
  if (now.getDate() < b.getDate()) months -= 1;
  const t = TX[lang];
  if (months < 1) {
    const days = Math.max(0, Math.floor((now.getTime() - b.getTime()) / 86_400_000));
    return `${days} ${t.days}`;
  }
  if (months < 24) return `${months} ${t.months}`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years} ${t.years} ${t.and} ${rest} ${lang === "en" ? "months" : "muajsh"}` : `${years} ${t.years}`;
}

/** Data e përditësimit të fundit të një liste (ISO), ose null kur është bosh. */
function lastUpdate(items: { updatedAt: string }[]): string | null {
  if (items.length === 0) return null;
  return items.reduce((max, i) => (i.updatedAt > max ? i.updatedAt : max), items[0].updatedAt);
}

const val = (v: string | null | undefined, none: string) => (v && v.trim() ? escapeHtml(v.trim()) : `<span class="muted">${none}</span>`);

export function buildHealthReportHtml(profile: BabyProfile, baby: BabyModuleState, lang: Lang, now: Date = new Date(), babyLabel = ""): string {
  const t = TX[lang];
  const name = profile.babyName?.trim() || babyLabel || "Bebix";
  const gender = profile.babyGender === "girl" ? t.girl : profile.babyGender === "boy" ? t.boy : profile.babyGender === "other" ? t.other : null;

  const growth = live(baby.growthHistory).sort((a, b) => b.date.localeCompare(a.date));
  const vaccines = live(baby.vaccines).sort((a, b) => (a.givenDate ?? a.dueDate).localeCompare(b.givenDate ?? b.dueDate));
  const records = live(baby.medicalRecords).sort((a, b) => b.at.localeCompare(a.at));
  const infoRows = baby.medicalInfo.filter((m) => baby.medicalActiveKeys.includes(m.key) && !NOT_HEALTH_KEYS.has(m.key) && m.value.trim());
  const contacts = baby.emergencyContacts;

  const section = (title: string, updated: string | null, body: string) =>
    `<section><h2>${escapeHtml(title)}${updated ? `<span class="upd">${t.updated}: ${escapeHtml(fmtDate(updated, lang))}</span>` : ""}</h2>${body}</section>`;
  const table = (head: string[], rows: string[][]) =>
    `<table><thead><tr>${head.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`)
      .join("")}</tbody></table>`;
  const empty = `<p class="muted">${t.empty}</p>`;

  const profileRows: [string, string][] = [
    [t.name, val(name, t.none)],
    [t.gender, val(gender, t.none)],
    [t.dob, val(profile.babyDob ? fmtDate(profile.babyDob, lang) : null, t.none)],
    [t.age, val(ageText(profile.babyDob, now, lang), t.none)],
    [t.blood, val(profile.bloodType, t.none)],
    [t.allergies, val(profile.allergies, t.none)],
    [t.doctor, val(profile.pediatrician, t.none)],
    [t.notes, val(profile.medicalNotes, t.none)],
  ];
  const extra = infoRows.map((m) => [m.isCustom ? escapeHtml(m.label ?? "") : escapeHtml(m.label ?? m.key), escapeHtml(m.value.trim())] as [string, string]);

  const latest = growth[0];
  const sections = [
    section(
      t.profile,
      null,
      `<dl>${[...profileRows, ...extra].map(([k, v]) => `<div><dt>${escapeHtml(k)}</dt><dd>${v}</dd></div>`).join("")}</dl>`
    ),
    section(
      t.growth,
      lastUpdate(growth),
      growth.length === 0
        ? empty
        : `<p class="lead">${t.latest}: <b>${escapeHtml(fmtDate(latest.date, lang))}</b>${latest.weightKg ? ` · ${latest.weightKg} kg` : ""}${latest.heightCm ? ` · ${latest.heightCm} cm` : ""}${latest.headCm ? ` · ${latest.headCm} cm` : ""}</p>` +
          table(
            [t.date, t.weight, t.height, t.head],
            growth.map((g) => [escapeHtml(fmtDate(g.date, lang)), g.weightKg ? `${g.weightKg} kg` : "—", g.heightCm ? `${g.heightCm} cm` : "—", g.headCm ? `${g.headCm} cm` : "—"])
          )
    ),
    section(
      t.vaccines,
      lastUpdate(vaccines),
      vaccines.length === 0
        ? empty
        : table(
            [t.vaccine, t.given, t.due, t.clinic],
            vaccines.map((v) => [
              escapeHtml(v.name),
              v.givenDate ? escapeHtml(fmtDate(v.givenDate, lang)) : `<span class="muted">${t.pending}</span>`,
              escapeHtml(fmtDate(v.dueDate, lang)),
              escapeHtml([v.clinic, v.doctor].filter((x) => x && x.trim()).join(" · ")) || "—",
            ])
          )
    ),
    section(
      t.records,
      lastUpdate(records),
      records.length === 0
        ? empty
        : table(
            [t.date, t.type, t.detail],
            records.map((r) => [
              escapeHtml(fmtDate(r.at, lang)),
              escapeHtml(t.types[r.type] ?? t.other_info),
              escapeHtml([r.title, r.value, r.doctor, r.note].filter((x) => x && x.trim()).join(" · ")) || "—",
            ])
          )
    ),
    section(
      t.contacts,
      null,
      contacts.length === 0
        ? empty
        : table(
            [t.name, t.relation, t.phone],
            contacts.map((c) => [escapeHtml(c.name), escapeHtml(c.relation) || "—", escapeHtml(c.phone)])
          )
    ),
  ];

  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8" />
<style>
  @page { margin: 18mm 14mm; }
  body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #17212B; font-size: 12px; line-height: 1.45; }
  header { border-bottom: 3px solid #17212B; padding-bottom: 10px; margin-bottom: 14px; }
  header .brand { font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #8A929A; font-weight: 700; }
  h1 { font-size: 22px; margin: 2px 0 2px; }
  .gen { color: #5B6670; font-size: 11px; }
  section { margin-top: 16px; page-break-inside: avoid; }
  h2 { font-size: 14px; margin: 0 0 6px; padding-bottom: 4px; border-bottom: 1px solid #DDE2E7; display: flex; justify-content: space-between; align-items: baseline; }
  .upd { font-size: 10px; font-weight: 400; color: #8A929A; }
  dl { margin: 0; display: block; }
  dl div { display: flex; padding: 5px 0; border-bottom: 1px solid #EEF1F4; }
  dt { width: 38%; color: #5B6670; }
  dd { margin: 0; flex: 1; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 6px 6px; border-bottom: 1px solid #EEF1F4; font-size: 11px; vertical-align: top; }
  th { color: #5B6670; font-weight: 600; background: #F5F7F9; }
  .lead { margin: 0 0 6px; }
  .muted { color: #8A929A; font-weight: 400; }
  footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #DDE2E7; color: #8A929A; font-size: 10px; }
</style></head><body>
<header><div class="brand">Bebix</div><h1>${escapeHtml(t.title)} · ${escapeHtml(name)}</h1><div class="gen">${t.generated} ${escapeHtml(fmtDate(now.toISOString(), lang))}</div></header>
${sections.join("\n")}
<footer>${escapeHtml(t.footer)}</footer>
</body></html>`;
}
