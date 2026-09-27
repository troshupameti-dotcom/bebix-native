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
  /** URI lokale e pajisjes, ose URL e nenshkruar kur vjen nga serveri. */
  uri: string | null;
  /** Rruga ne bucket-in privat baby-moments (sync me Supabase Storage). */
  storagePath?: string | null;
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

// Katalogët janë "vendet" e profilit (pesha, grupi i gjakut, buzëqeshja e
// parë...), jo të dhëna: nisin bosh. Deri në shtator 2026 nisnin me vlera
// demo (0+, "Dr. Arta Elezi", 7.8 kg...) që çdo prind i ri i shihte si të
// bebit të vet — shih lib/state/seedCleanup.ts.
export const growthCatalog: GrowthStat[] = [
  { key: "weight", labelKey: "growth_weight", value: "", isCustom: false },
  { key: "height", labelKey: "growth_height", value: "", isCustom: false },
  { key: "head", labelKey: "growth_head", value: "", isCustom: false },
];

export const medicalCatalog: MedicalInfoRow[] = [
  { key: "blood", labelKey: "baby_blood_type", value: "", isCustom: false },
  { key: "allergies", labelKey: "baby_allergies", value: "", isCustom: false },
  { key: "doctor", labelKey: "baby_doctor", value: "", isCustom: false },
  { key: "diaper_size", labelKey: "baby_diaper_size", value: "", isCustom: false },
  { key: "birth_weight", labelKey: "info_birth_weight", value: "", isCustom: false },
  { key: "rh", labelKey: "info_rh", value: "", isCustom: false },
];

export const milestoneCatalog: MilestoneItem[] = [
  { key: "smile", labelKey: "ms_smile", done: false, isCustom: false },
  { key: "rolling", labelKey: "ms_rolling", done: false, isCustom: false },
  { key: "sitting", labelKey: "ms_sitting", done: false, isCustom: false },
  { key: "steps", labelKey: "ms_steps", done: false, isCustom: false },
  { key: "crawling", labelKey: "ms_crawling", done: false, isCustom: false },
  { key: "first_words", labelKey: "ms_first_words", done: false, isCustom: false },
  { key: "standing", labelKey: "ms_standing", done: false, isCustom: false },
  { key: "waving", labelKey: "ms_waving", done: false, isCustom: false },
];

/** Një prind i ri nis me historik bosh. */
export const initialBabyState: BabyModuleState = {
  growthStats: growthCatalog.filter((s) => s.key !== "head"),
  growthActiveKeys: ["weight", "height"],
  growthHistory: [],
  quickActionKeys: ["feeding", "sleep", "diaper", "growth"],
  medicalInfo: medicalCatalog,
  medicalActiveKeys: ["blood", "doctor"],
  milestones: milestoneCatalog,
  milestoneActiveKeys: ["smile", "rolling", "sitting", "steps"],
  timeline: [],
  feedingLog: [],
  sleepLog: [],
  diaperLog: [],
  vaccines: [],
  moments: [],
  medicalRecords: [],
  emergencyContacts: [],
  auditLog: [],
};
