import type { BabyModuleState, Moment } from "@/lib/state/babyTypes";
import type { BabyProfile } from "@/lib/state/types";
import { addMonths } from "@/lib/baby/celebrations";
import { escapeHtml, type Lang } from "@/lib/healthReport";

/**
 * "Libri i vitit të parë": një faqe për çdo muaj (fotot më të bukura dhe
 * arritjet), rritja nga lindja te matja e fundit. Të dhënat ndahen nga
 * HTML-ja: e njëjta `FirstYearBook` mund të dërgohet më vonë te shtypshkronja
 * (libër i shtypur në dyqan) pa e rindërtuar.
 */

export const PHOTOS_PER_MONTH = 3;

export type BookMonth = {
  /** 1–12: muaji i jetës. */
  index: number;
  start: string;
  photos: Moment[];
  milestones: string[];
};

export type FirstYearBook = {
  name: string;
  dob: string | null;
  months: BookMonth[];
  growth: { first: { date: string; weightKg: number | null; heightCm: number | null } | null; last: { date: string; weightKg: number | null; heightCm: number | null } | null };
  totalPhotos: number;
};

const visible = <T extends { deletedAt: string | null; archivedAt: string | null }>(list: T[]) =>
  list.filter((e) => !e.deletedAt && !e.archivedAt);

function birth(dob: string | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dob ?? "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}

export function buildFirstYearBook(profile: BabyProfile, baby: BabyModuleState, now: Date = new Date(), fallbackName = "Bebix"): FirstYearBook {
  const born = birth(profile.babyDob);
  // Pa datëlindje: 12 muajt e fundit.
  const start = born ?? addMonths(new Date(now.getFullYear(), now.getMonth(), 1), -11);
  const moments = visible(baby.moments);
  const timeline = visible(baby.timeline);

  const months: BookMonth[] = [];
  for (let i = 0; i < 12; i++) {
    const from = addMonths(start, i);
    if (from > now) break;
    const to = addMonths(start, i + 1);
    const inRange = (iso: string) => {
      const t = new Date(iso).getTime();
      return !Number.isNaN(t) && t >= from.getTime() && t < to.getTime();
    };
    const photos = moments
      .filter((m) => m.type === "photo" && (m.uri || m.storagePath) && inRange(m.date))
      .sort((a, b) => Number(b.favorite) - Number(a.favorite) || new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, PHOTOS_PER_MONTH);
    const milestones = [
      ...moments.filter((m) => m.type === "milestone" && inRange(m.date)).map((m) => ({ title: m.title, date: m.date })),
      ...timeline.filter((e) => inRange(e.date)).map((e) => ({ title: e.title, date: e.date })),
    ]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .map((x) => x.title.trim())
      .filter(Boolean);
    months.push({ index: i + 1, start: from.toISOString(), photos, milestones });
  }

  const end = addMonths(start, 12);
  const growth = visible(baby.growthHistory)
    .filter((g) => new Date(g.date) < end && (g.weightKg || g.heightCm))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const pick = (g: (typeof growth)[number] | undefined) => (g ? { date: g.date, weightKg: g.weightKg, heightCm: g.heightCm } : null);

  return {
    name: profile.babyName?.trim() || fallbackName,
    dob: profile.babyDob,
    months,
    growth: { first: pick(growth[0]), last: growth.length > 1 ? pick(growth[growth.length - 1]) : null },
    totalPhotos: months.reduce((n, m) => n + m.photos.length, 0),
  };
}

const TX = {
  sq: {
    title: "Viti i parë",
    month: (n: number) => (n === 1 ? "Muaji i parë" : `Muaji ${n}`),
    born: "Lindur më",
    milestones: "Arritjet",
    noPhotos: "Asnjë foto këtë muaj — kujtimet janë në zemër.",
    growth: "Si u rrite",
    from: "Nga",
    to: "në",
    footer: "Bërë me dashuri në Bebix",
  },
  en: {
    title: "The first year",
    month: (n: number) => (n === 1 ? "The first month" : `Month ${n}`),
    born: "Born on",
    milestones: "Milestones",
    noPhotos: "No photos this month — the memories live in our hearts.",
    growth: "How you grew",
    from: "From",
    to: "to",
    footer: "Made with love in Bebix",
  },
} as const;

function fmtDate(iso: string, lang: Lang, withDay = true): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(lang === "en" ? "en-GB" : "sq-AL", withDay ? { day: "numeric", month: "long", year: "numeric" } : { month: "long", year: "numeric" });
}

/** HTML për expo-print. `images`: momentId → data URI (fotot pa adresë dalin si vend bosh). */
export function buildFirstYearBookHtml(book: FirstYearBook, lang: Lang, images: Record<string, string>): string {
  const t = TX[lang];
  const pages = book.months
    .map((m) => {
      const photos = m.photos
        .filter((p) => images[p.id])
        .map((p) => `<figure><img src="${images[p.id]}"/>${p.title.trim() ? `<figcaption>${escapeHtml(p.title.trim())}</figcaption>` : ""}</figure>`)
        .join("");
      const ms = m.milestones.length
        ? `<h3>${t.milestones}</h3><ul>${m.milestones.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`
        : "";
      return `<section class="page"><h2>${t.month(m.index)}</h2><p class="when">${escapeHtml(fmtDate(m.start, lang, false))}</p>${
        photos ? `<div class="photos n${Math.min(3, m.photos.filter((p) => images[p.id]).length)}">${photos}</div>` : `<p class="muted">${t.noPhotos}</p>`
      }${ms}</section>`;
    })
    .join("");

  const g = book.growth;
  const growth =
    g.first && g.last
      ? `<section class="page"><h2>${t.growth}</h2><p class="big">${[
          g.first.weightKg && g.last.weightKg ? `${t.from} ${g.first.weightKg} kg ${t.to} ${g.last.weightKg} kg` : null,
          g.first.heightCm && g.last.heightCm ? `${t.from} ${g.first.heightCm} cm ${t.to} ${g.last.heightCm} cm` : null,
        ]
          .filter(Boolean)
          .join("<br/>")}</p></section>`
      : "";

  return `<!doctype html><html><head><meta charset="utf-8"/><style>
  @page { margin: 18mm; }
  body { font-family: -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif; color: #17212B; }
  .cover { text-align: center; padding-top: 70mm; page-break-after: always; }
  .cover h1 { font-size: 40px; margin: 0; letter-spacing: -0.5px; }
  .cover .name { font-size: 28px; color: #B8336A; margin-top: 10px; }
  .cover .born { color: #5C6670; margin-top: 8px; }
  .page { page-break-after: always; }
  h2 { font-size: 26px; margin: 0; color: #7A3596; }
  h3 { font-size: 15px; margin: 18px 0 6px; color: #2E6FA8; }
  .when { color: #5C6670; margin: 2px 0 14px; }
  .photos { display: flex; flex-wrap: wrap; gap: 10px; }
  .photos figure { margin: 0; flex: 1 1 45%; }
  .photos.n1 figure { flex-basis: 100%; }
  .photos img { width: 100%; max-height: 95mm; object-fit: cover; border-radius: 10px; }
  figcaption { font-size: 12px; color: #5C6670; margin-top: 4px; }
  ul { margin: 0; padding-left: 18px; } li { margin: 3px 0; }
  .muted { color: #8A929A; font-style: italic; }
  .big { font-size: 20px; line-height: 1.6; }
  .footer { text-align: center; color: #8A929A; font-size: 12px; margin-top: 60mm; }
  </style></head><body>
  <section class="cover"><h1>${t.title}</h1><div class="name">${escapeHtml(book.name)}</div>${
    book.dob ? `<div class="born">${t.born} ${escapeHtml(fmtDate(book.dob, lang))}</div>` : ""
  }</section>
  ${pages}${growth}
  <p class="footer">${t.footer} 💛</p>
  </body></html>`;
}
