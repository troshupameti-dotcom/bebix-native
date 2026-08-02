/**
 * Everything that lives under the Baby module.
 *
 * Every log record shares two lifecycle fields on top of its own data:
 *   - `deletedAt` — soft delete; powers the "Deleted · Undo" toast.
 *   - `archivedAt` — a separate, deliberate action (distinct from
 *     delete): archived records leave the active list but are never
 *     destroyed, and live in "Archived Records" with a Restore action.
 * ...and three audit fields:
 *   - `createdAt`, `updatedAt`, `editCount` — shown as "Created / Edited
 *     Nx / Last modified: …" under every record.
 * Field-level changes (old value -> new value) are additionally logged
 * to the shared `auditLog`, which is what the Audit Log screen reads.
 *
 * Preset items (weight, blood type, "first smile", …) carry a
 * translation key so their label follows the active language. Anything
 * a parent types themselves is stored as literal text — it's their
 * data, not app chrome.
 */

export type Lifecycle = {
  createdAt: string;
  updatedAt: string;
  editCount: number;
  deletedAt: string | null;
  archivedAt: string | null;
};

function lifecycle(createdAt?: string): Lifecycle {
  const at = createdAt ?? new Date().toISOString();
  return { createdAt: at, updatedAt: at, editCount: 0, deletedAt: null, archivedAt: null };
}

export type RecordKind =
  | "growthHistory"
  | "feeding"
  | "sleep"
  | "diaper"
  | "vaccine"
  | "moment"
  | "medical"
  | "timeline";

export type AuditEntry = {
  id: string;
  recordKind: RecordKind;
  recordId: string;
  recordLabel: string; // human label for the record, e.g. "Weight" or "Bottle feeding"
  field: string;
  fieldLabel: string;
  oldValue: string;
  newValue: string;
  at: string;
};

// ---------------------------------------------------------------------
// Growth summary cards + Quick actions + Medical info + Milestones
// (the editable "catalog" sections on the Profile tab)
// ---------------------------------------------------------------------

export type GrowthStat = {
  key: string; // preset key ("weight" | "height" | "head") or "custom:<id>"
  labelKey?: string;
  label?: string;
  value: string;
  subKey?: string;
  sub?: string;
  isCustom: boolean;
};

export type QuickActionKey =
  | "feeding"
  | "sleep"
  | "diaper"
  | "growth"
  | "vaccinations"
  | "medical"
  | "moments"
  | "bath"
  | "medicine"
  | "play";

export type MedicalInfoRow = {
  key: string;
  labelKey?: string;
  label?: string;
  value: string;
  isCustom: boolean;
};

export type MilestoneItem = {
  key: string;
  labelKey?: string;
  label?: string;
  done: boolean;
  isCustom: boolean;
};

export type TimelineEvent = Lifecycle & {
  id: string;
  title: string;
  date: string;
  color: "olive" | "orange";
  note: string;
};

// ---------------------------------------------------------------------
// Feeding
// ---------------------------------------------------------------------

export type FeedingType = "breast" | "bottle" | "formula" | "solid" | "water" | "medicine";
export type BreastSide = "left" | "right" | "both" | null;

export type FeedingEntry = Lifecycle & {
  id: string;
  type: FeedingType;
  amountMl: number | null;
  durationMin: number | null;
  side: BreastSide;
  foodCategory: string | null;
  at: string;
  note: string;
};

// ---------------------------------------------------------------------
// Sleep
// ---------------------------------------------------------------------

export type SleepQuality = "good" | "fair" | "restless" | null;

export type SleepEntry = Lifecycle & {
  id: string;
  startAt: string;
  endAt: string | null;
  pausedIntervalsMin: number;
  pausedAt: string | null;
  isNap: boolean;
  quality: SleepQuality;
  note: string;
};

// ---------------------------------------------------------------------
// Diaper
// ---------------------------------------------------------------------

export type DiaperType = "wet" | "dirty" | "both";

export type DiaperEntry = Lifecycle & {
  id: string;
  type: DiaperType;
  color: string | null;
  consistency: string | null;
  at: string;
  note: string;
};

// ---------------------------------------------------------------------
// Growth history
// ---------------------------------------------------------------------

export type GrowthHistoryEntry = Lifecycle & {
  id: string;
  date: string;
  weightKg: number | null;
  heightCm: number | null;
  headCm: number | null;
  note: string;
};

// ---------------------------------------------------------------------
// Vaccinations
// ---------------------------------------------------------------------

export type VaccineStatus = "done" | "upcoming" | "due_today" | "overdue";

export type VaccineEntry = Lifecycle & {
  id: string;
  name: string;
  description: string;
  dueDate: string;
  givenDate: string | null;
  doctor: string;
  clinic: string;
  batchNumber: string;
  note: string;
  reminderEnabled: boolean;
};

// ---------------------------------------------------------------------
// Moments (photos / videos / notes / milestones / favourites)
// ---------------------------------------------------------------------

export type MomentType = "photo" | "video" | "note" | "milestone";

export type Moment = Lifecycle & {
  id: string;
  type: MomentType;
  uri: string | null;
  title: string;
  description: string;
  date: string;
  tags: string[];
  favorite: boolean;
};

// ---------------------------------------------------------------------
// Medical records (symptoms, temperature, medication, visits, docs)
// ---------------------------------------------------------------------

export type MedicalRecordType =
  | "symptom"
  | "temperature"
  | "medication"
  | "doctor_visit"
  | "prescription"
  | "document";

export type MedicalRecord = Lifecycle & {
  id: string;
  type: MedicalRecordType;
  title: string;
  value: string;
  doctor: string;
  at: string;
  note: string;
  attachmentUri: string | null;
  pinned: boolean;
};

// ---------------------------------------------------------------------
// Emergency contacts (part of the expanded Baby Profile)
// ---------------------------------------------------------------------

export type EmergencyContact = {
  id: string;
  name: string;
  relation: string;
  phone: string;
};

export type BloodType = "0+" | "0-" | "A+" | "A-" | "B+" | "B-" | "AB+" | "AB-" | null;

export type BabyModuleState = {
  growthStats: GrowthStat[];
  growthActiveKeys: string[];
  growthHistory: GrowthHistoryEntry[];
  quickActionKeys: QuickActionKey[];
  medicalInfo: MedicalInfoRow[];
  medicalActiveKeys: string[];
  milestones: MilestoneItem[];
  milestoneActiveKeys: string[];
  timeline: TimelineEvent[];
  feedingLog: FeedingEntry[];
  sleepLog: SleepEntry[];
  diaperLog: DiaperEntry[];
  vaccines: VaccineEntry[];
  moments: Moment[];
  medicalRecords: MedicalRecord[];
  emergencyContacts: EmergencyContact[];
  auditLog: AuditEntry[];
};

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString();
const daysFromNow = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

export const growthCatalog: GrowthStat[] = [
  { key: "weight", labelKey: "growth_weight", value: "7.8 kg", subKey: "pct_50", isCustom: false },
  { key: "height", labelKey: "growth_height", value: "66 cm", subKey: "pct_45", isCustom: false },
  { key: "head", labelKey: "growth_head", value: "43 cm", subKey: "pct_40", isCustom: false },
];

export const medicalCatalog: MedicalInfoRow[] = [
  { key: "blood", labelKey: "baby_blood_type", value: "0+", isCustom: false },
  { key: "allergies", labelKey: "baby_allergies", value: "", isCustom: false },
  { key: "doctor", labelKey: "baby_doctor", value: "Dr. Arta Elezi", isCustom: false },
  { key: "diaper_size", labelKey: "baby_diaper_size", value: "", isCustom: false },
  { key: "birth_weight", labelKey: "info_birth_weight", value: "3.4 kg", isCustom: false },
  { key: "rh", labelKey: "info_rh", value: "Rh+", isCustom: false },
];

export const milestoneCatalog: MilestoneItem[] = [
  { key: "smile", labelKey: "ms_smile", done: true, isCustom: false },
  { key: "rolling", labelKey: "ms_rolling", done: true, isCustom: false },
  { key: "sitting", labelKey: "ms_sitting", done: false, isCustom: false },
  { key: "steps", labelKey: "ms_steps", done: false, isCustom: false },
  { key: "crawling", labelKey: "ms_crawling", done: false, isCustom: false },
  { key: "first_words", labelKey: "ms_first_words", done: false, isCustom: false },
  { key: "standing", labelKey: "ms_standing", done: false, isCustom: false },
  { key: "waving", labelKey: "ms_waving", done: false, isCustom: false },
];

export const initialBabyState: BabyModuleState = {
  growthStats: growthCatalog.filter((s) => s.key !== "head"),
  growthActiveKeys: ["weight", "height"],
  growthHistory: [
    { id: "g1", date: daysAgo(150), weightKg: 4.1, heightCm: 53, headCm: null, note: "", ...lifecycle(daysAgo(150)) },
    { id: "g2", date: daysAgo(90), weightKg: 6.0, heightCm: 60, headCm: null, note: "", ...lifecycle(daysAgo(90)) },
    { id: "g3", date: daysAgo(30), weightKg: 7.2, heightCm: 64, headCm: null, note: "", ...lifecycle(daysAgo(30)) },
    { id: "g4", date: daysAgo(2), weightKg: 7.8, heightCm: 66, headCm: 43, note: "", ...lifecycle(daysAgo(2)) },
  ],
  quickActionKeys: ["feeding", "sleep", "diaper", "growth"],
  medicalInfo: medicalCatalog,
  medicalActiveKeys: ["blood", "doctor"],
  milestones: milestoneCatalog,
  milestoneActiveKeys: ["smile", "rolling", "sitting", "steps"],
  timeline: [
    { id: "t1", title: "Lindja", date: "5 Maj, 2024", color: "olive", note: "", ...lifecycle(daysAgo(150)) },
    { id: "t2", title: "Buzëqeshja e parë", date: "18 Qershor, 2024", color: "olive", note: "", ...lifecycle(daysAgo(120)) },
    { id: "t3", title: "Rrotullimi i parë", date: "2 Shtator, 2024", color: "olive", note: "", ...lifecycle(daysAgo(60)) },
    { id: "t4", title: "Dhëmbi i parë", date: "Pritet së shpejti", color: "orange", note: "", ...lifecycle() },
  ],
  feedingLog: [
    {
      id: "f1", type: "bottle", amountMl: 120, durationMin: null, side: null, foodCategory: null,
      at: daysAgo(0), note: "", ...lifecycle(daysAgo(0)),
    },
    {
      id: "f2", type: "breast", amountMl: null, durationMin: 15, side: "left", foodCategory: null,
      at: daysAgo(0), note: "", ...lifecycle(daysAgo(0)),
    },
  ],
  sleepLog: [
    {
      id: "s1", startAt: daysAgo(0), endAt: new Date().toISOString(), pausedIntervalsMin: 0, pausedAt: null,
      isNap: true, quality: "good", note: "", ...lifecycle(daysAgo(0)),
    },
  ],
  diaperLog: [
    { id: "d1", type: "wet", color: null, consistency: null, at: daysAgo(0), note: "", ...lifecycle(daysAgo(0)) },
  ],
  vaccines: [
    {
      id: "v1", name: "Hepatit B (doza 1)", description: "", dueDate: daysAgo(150), givenDate: daysAgo(148),
      doctor: "Dr. Arta Elezi", clinic: "", batchNumber: "", note: "", reminderEnabled: true, ...lifecycle(daysAgo(150)),
    },
    {
      id: "v2", name: "DTaP (doza 2)", description: "", dueDate: daysFromNow(10), givenDate: null,
      doctor: "", clinic: "", batchNumber: "", note: "", reminderEnabled: true, ...lifecycle(daysAgo(30)),
    },
    {
      id: "v3", name: "Polio (doza 2)", description: "", dueDate: daysAgo(3), givenDate: null,
      doctor: "", clinic: "", batchNumber: "", note: "", reminderEnabled: true, ...lifecycle(daysAgo(30)),
    },
  ],
  moments: [],
  medicalRecords: [],
  emergencyContacts: [],
  auditLog: [],
};
