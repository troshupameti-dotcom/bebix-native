import type {
  BabyModuleState,
  DiaperEntry,
  FeedingEntry,
  GrowthHistoryEntry,
  Lifecycle,
  MedicalRecord,
  Moment,
  SleepEntry,
  TimelineEvent,
  VaccineEntry,
} from "@/lib/state/babyTypes";

/**
 * Llojet e regjistrimeve që sinkronizohen te tabela `baby_records`.
 *
 * Seksionet e katalogut te `BabyModuleState` (growthStats, medicalInfo,
 * milestones, quickActions, emergencyContacts) NUK janë regjistrime me
 * Lifecycle — janë cilësime të profilit dhe rrinë jashtë kësaj tabele.
 * `auditLog` po ashtu mbetet jashtë: është ditar i ndryshimeve, me formë
 * tjetër, dhe do të ketë tabelën e vet nëse kërkohet në server.
 */
export type SyncedRecordKind =
  | "feeding"
  | "sleep"
  | "diaper"
  | "growth"
  | "vaccine"
  | "moment"
  | "medical"
  | "timeline";

/**
 * Lidhja `kind` -> forma e saktë e payload-it. Ky është kontrati i vetëm
 * mbi të cilin ngrihet adapteri i mapping-ut: nëse shtohet një lloj i ri,
 * TypeScript-i detyron plotësimin e `RECORD_LIST_KEY` dhe `OCCURRED_AT_FIELD`
 * më poshtë, sepse të dyja janë mapped types mbi këtë të njëjtin union.
 */
export type BabyRecordPayloadMap = {
  feeding: FeedingEntry;
  sleep: SleepEntry;
  diaper: DiaperEntry;
  growth: GrowthHistoryEntry;
  vaccine: VaccineEntry;
  moment: Moment;
  medical: MedicalRecord;
  timeline: TimelineEvent;
};

export type BabyRecordPayload<K extends SyncedRecordKind = SyncedRecordKind> = BabyRecordPayloadMap[K];

/** Një regjistrim bashkë me llojin e vet — discriminated union mbi `kind`. */
export type BabyRecord<K extends SyncedRecordKind = SyncedRecordKind> = {
  kind: K;
  record: BabyRecordPayloadMap[K];
};

/** Union i shpërndarë: `{kind:"feeding", record: FeedingEntry} | {kind:"sleep", ...} | ...` */
export type AnyBabyRecord = { [K in SyncedRecordKind]: BabyRecord<K> }[SyncedRecordKind];

/**
 * Cila listë e `BabyModuleState` i mban regjistrimet e secilit lloj.
 * Tipi e detyron që çelësi të tregojë vërtet nga një listë e atij tipi.
 */
type ListKeyFor<K extends SyncedRecordKind> = {
  [P in keyof BabyModuleState]: BabyModuleState[P] extends BabyRecordPayloadMap[K][] ? P : never;
}[keyof BabyModuleState];

export const RECORD_LIST_KEY: { [K in SyncedRecordKind]: ListKeyFor<K> } = {
  feeding: "feedingLog",
  sleep: "sleepLog",
  diaper: "diaperLog",
  growth: "growthHistory",
  vaccine: "vaccines",
  moment: "moments",
  medical: "medicalRecords",
  timeline: "timeline",
};

/**
 * Fusha që mban kohën e vërtetë të ngjarjes për secilin lloj — shkon te
 * kolona `occurred_at`, që renditja dhe filtrimi sipas datës të bëhen në
 * server pa e hapur `payload`.
 */
export const OCCURRED_AT_FIELD: { [K in SyncedRecordKind]: keyof BabyRecordPayloadMap[K] } = {
  feeding: "at",
  sleep: "startAt",
  diaper: "at",
  growth: "date",
  vaccine: "dueDate",
  moment: "date",
  medical: "at",
  timeline: "date",
};

export const SYNCED_RECORD_KINDS = Object.keys(RECORD_LIST_KEY) as SyncedRecordKind[];

/** Çdo payload i sinkronizueshëm ka id dhe Lifecycle — kjo e dokumenton atë. */
export type IdentifiableLifecycle = Lifecycle & { id: string };
