import { bumpPhotos, bumpTags, bumpWeek } from "@/lib/baby/bump";
import type { Moment } from "@/lib/state/babyTypes";

let n = 0;
const m = (over: Partial<Moment> = {}): Moment =>
  ({
    id: `m${n++}`, type: "photo", uri: "file:///a.jpg", storagePath: null, title: "", description: "", date: "2026-10-01T10:00:00Z",
    tags: [], favorite: false, createdAt: "", updatedAt: "", editCount: 0, deletedAt: null, archivedAt: null, ...over,
  }) as Moment;

describe("barku javë pas jave", () => {
  it("etiketat mbajnë javën; pa 'bump' s'është foto barku", () => {
    expect(bumpTags(24)).toEqual(["bump", "week:24"]);
    expect(bumpWeek({ tags: ["bump", "week:24"] })).toBe(24);
    expect(bumpWeek({ tags: ["week:24"] })).toBeNull();
    expect(bumpWeek({ tags: ["bump", "week:60"] })).toBeNull();
  });

  it("vetëm fotot e barkut, pa të fshirat, java më e re e para", () => {
    const list = bumpPhotos([
      m({ tags: bumpTags(20) }),
      m({ tags: bumpTags(24) }),
      m({ tags: bumpTags(22), deletedAt: "2026-10-02" }),
      m({ tags: [] }),
      m({ type: "note", tags: bumpTags(25) }),
    ]);
    expect(list.map((x) => x.week)).toEqual([24, 20]);
  });
});
