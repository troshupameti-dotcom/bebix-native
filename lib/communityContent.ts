/**
 * Fixture data — vetëm "stories" mbetën lokale (funksion vizual pa
 * ndërveprim database-i). Krejt tjetra (groups, experts, topics, tips,
 * posts, comments) tash vijnë prej Supabase — shih lib/communityData.ts.
 */

export type Story = {
  id: string;
  authorName: string;
  authorInitial: string;
  accent: "olive" | "orange";
  seen: boolean;
  isOwn?: boolean;
};

export const storyCatalog: Story[] = [
  { id: "s0", authorName: "Ti", authorInitial: "T", accent: "olive", seen: false, isOwn: true },
  { id: "s1", authorName: "Elira", authorInitial: "E", accent: "orange", seen: false },
  { id: "s2", authorName: "Blerim", authorInitial: "B", accent: "olive", seen: false },
  { id: "s3", authorName: "Vjosa", authorInitial: "V", accent: "orange", seen: true },
  { id: "s4", authorName: "Driton", authorInitial: "D", accent: "olive", seen: true },
  { id: "s5", authorName: "Arta", authorInitial: "A", accent: "orange", seen: true },
];