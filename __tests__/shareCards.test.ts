import { availableTemplates, buildCardContent, defaultTemplate, parseCardParams, pickDefaultPhoto, selectablePhotos } from "@/lib/share/cards";
import { translations, type TranslationKey } from "@/lib/i18n/translations";
import type { Moment } from "@/lib/state/babyTypes";

const t = (key: TranslationKey, params?: Record<string, string | number>) => {
  let s: string = translations.sq[key] ?? key;
  for (const [k, v] of Object.entries(params ?? {})) s = s.replace(`{${k}}`, String(v));
  return s;
};

let n = 0;
const moment = (over: Partial<Moment> = {}): Moment =>
  ({
    id: `m${n++}`, type: "photo", uri: "file:///a.jpg", storagePath: null, title: "", description: "", date: "2026-10-01T10:00:00Z",
    tags: [], favorite: false, createdAt: "", updatedAt: "", editCount: 0, deletedAt: null, archivedAt: null, ...over,
  }) as Moment;

describe("kartat për t'u ndarë", () => {
  it("parametrat: vetëm llojet e njohura, muaji/viti kërkojnë numër", () => {
    expect(parseCardParams({ kind: "month", n: "3" })).toEqual({ kind: "month", n: 3, momentId: null });
    expect(parseCardParams({ kind: "month" })).toBeNull();
    expect(parseCardParams({ kind: "hack" })).toBeNull();
    expect(parseCardParams({ kind: "milestone", momentId: "abc-1" })).toEqual({ kind: "milestone", n: null, momentId: "abc-1" });
    expect(parseCardParams({ kind: "moment", momentId: "../x" })?.momentId).toBeNull();
  });

  it("përmbajtja sipas llojit", () => {
    const base = { babyName: "Ana", moment: null, dateLabel: "10 tetor 2026", t };
    expect(buildCardContent({ ...base, kind: "day100", n: null })).toMatchObject({ big: "100", unit: "ditë", title: "Ana mbush 100 ditë" });
    expect(buildCardContent({ ...base, kind: "month", n: 3 })).toMatchObject({ big: "3", unit: "muaj", title: "Ana mbush 3 muaj" });
    expect(buildCardContent({ ...base, kind: "year", n: 1 })).toMatchObject({ big: "1", unit: "vjeç", title: "Gëzuar ditëlindjen, Ana!" });
    const ms = buildCardContent({ ...base, kind: "milestone", n: null, moment: moment({ type: "milestone", title: "Hapi i parë" }) });
    expect(ms).toMatchObject({ big: null, emoji: "⭐", title: "Hapi i parë", subtitle: "Ana · 10 tetor 2026" });
    expect(buildCardContent({ ...base, kind: "milestone", n: null }).title).toBe("Arritje e re");
  });

  it("fotoja e parazgjedhur: e momentit, pastaj e preferuara, pastaj më e reja", () => {
    const old = moment({ date: "2026-08-01T10:00:00Z" });
    const fav = moment({ date: "2026-09-01T10:00:00Z", favorite: true });
    const latest = moment({ date: "2026-10-05T10:00:00Z" });
    const note = moment({ type: "note", uri: null, date: "2026-10-09T10:00:00Z" });
    const deleted = moment({ date: "2026-10-08T10:00:00Z", deletedAt: "x" });
    const list = [old, fav, latest, note, deleted];
    expect(pickDefaultPhoto(list, old.id)?.id).toBe(old.id);
    expect(pickDefaultPhoto(list, null)?.id).toBe(fav.id);
    expect(pickDefaultPhoto([old, latest], null)?.id).toBe(latest.id);
    expect(pickDefaultPhoto([note], note.id)).toBeNull();
    expect(selectablePhotos(list).map((m) => m.id)).toEqual([latest.id, fav.id, old.id]);
  });

  it("shablloni 'Foto' vetëm kur ka foto", () => {
    expect(availableTemplates(false).map((x) => x.key)).toEqual(["cream", "pastel", "night"]);
    expect(availableTemplates(true)).toHaveLength(4);
    expect(defaultTemplate(true)).toBe("photo");
    expect(defaultTemplate(false)).toBe("cream");
  });
});
