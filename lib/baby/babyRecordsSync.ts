import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "@/lib/supabase/client";
import { resolveDataOwnerId } from "@/lib/baby/household";
import type { BabyModuleState, Moment } from "@/lib/state/babyTypes";
import {
  AnyBabyRecord,
  BabyRecordPayloadMap,
  OCCURRED_AT_FIELD,
  RECORD_LIST_KEY,
  SYNCED_RECORD_KINDS,
  SyncedRecordKind,
} from "@/lib/baby/recordTypes";
import { isLocalFileUri, signedUrlForMoment, uploadMomentFile } from "@/lib/baby/momentPhotos";
import { toTimestamp } from "@/lib/baby/timestamps";

const TABLE = "baby_records";
const LAST_SYNC_KEY = "bebix_baby_records_last_sync";
const MIGRATED_KEY = "bebix_baby_records_migrated_v1";
/** Madhësia e një leximi; e barabartë me kufirin e Supabase (max rows). */
const PULL_BATCH = 1000;

/** Rreshti si vjen nga / shkon te Supabase. */
type BabyRecordRow = {
  user_id: string;
  id: string;
  baby_id: string | null;
  kind: SyncedRecordKind;
  payload: Record<string, unknown>;
  occurred_at: string | null;
  created_at: string;
  updated_at: string;
  edit_count: number;
  deleted_at: string | null;
  archived_at: string | null;
};

// Fushat që ruhen si kolona reale, pra hiqen nga `payload` për të mos
// dublikuar të njëjtën vlerë në dy vende.
const LIFECYCLE_FIELDS = ["id", "createdAt", "updatedAt", "editCount", "deletedAt", "archivedAt"] as const;

// ---------------------------------------------------------------------
// Adapteri: lokal <-> rresht. I vetmi vend që di për formën e tabelës.
// ---------------------------------------------------------------------

function toRow(userId: string, item: AnyBabyRecord): BabyRecordRow {
  const { kind, record } = item;

  const payload: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if ((LIFECYCLE_FIELDS as readonly string[]).includes(key)) continue;
    payload[key] = value;
  }

  const occurredField = OCCURRED_AT_FIELD[kind] as keyof typeof record;
  const occurredRaw = record[occurredField];

  return {
    user_id: userId,
    id: record.id,
    baby_id: null,
    kind,
    payload,
    occurred_at: toTimestamp(occurredRaw),
    created_at: record.createdAt,
    updated_at: record.updatedAt,
    edit_count: record.editCount,
    deleted_at: record.deletedAt,
    archived_at: record.archivedAt,
  };
}

function fromRow<K extends SyncedRecordKind>(row: BabyRecordRow): { kind: K; record: BabyRecordPayloadMap[K] } {
  const record = {
    ...row.payload,
    id: row.id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    editCount: row.edit_count,
    deletedAt: row.deleted_at,
    archivedAt: row.archived_at,
  } as BabyRecordPayloadMap[K];

  return { kind: row.kind as K, record };
}

// ---------------------------------------------------------------------
// Shkrirja e listave
// ---------------------------------------------------------------------

type AnyPayload = BabyRecordPayloadMap[SyncedRecordKind];

/**
 * Shkrin listën lokale me atë të serverit, regjistrim për regjistrim, duke
 * mbajtur atë me `updatedAt` më të vonë.
 *
 * PSE "last write wins" në nivel regjistrimi është i pranueshëm tani:
 * një regjistrim i baby tracking-ut shkruhet nga një prind, në një telefon,
 * në momentin që ndodh ushqyerja apo gjumi. Dy pajisje që redaktojnë TË
 * NJËJTIN regjistrim brenda të njëjtit interval sync-u është skenar që
 * praktikisht s'ndodh me numrin e tanishëm të përdoruesve (dy profile bebi
 * në bazë), dhe humbja maksimale është një redaktim i vetëm i një fushe,
 * jo i të dhënave historike. Shkrirja në nivel fushe (CRDT, ose `updatedAt`
 * për fushë) do shtonte kompleksitet të ndjeshëm pa mbrojtur nga një
 * problem real. Kur të shtohet ndarja e llogarisë me prindin e dytë ose me
 * mjekun — pra dy pajisje aktive mbi të njëjtat të dhëna — kjo strategji
 * duhet rishikuar. Fshirjet janë të sigurta pavarësisht kësaj, sepse
 * `deletedAt` është fushë e vetë regjistrimit dhe udhëton me të.
 */
function mergeById(local: AnyPayload[], remote: AnyPayload[]): { merged: AnyPayload[]; changed: boolean } {
  const byId = new Map<string, AnyPayload>();
  for (const item of local) byId.set(item.id, item);

  let changed = false;
  for (const item of remote) {
    const mine = byId.get(item.id);
    if (!mine) {
      byId.set(item.id, item);
      changed = true;
      continue;
    }
    if (item.updatedAt > mine.updatedAt) {
      byId.set(item.id, item);
      changed = true;
    }
  }

  return { merged: [...byId.values()], changed };
}

const SYNCED_LIST_KEYS = new Set<string>(Object.values(RECORD_LIST_KEY));

/**
 * Zbaton rezultatin e një sync-u mbi gjendjen e TANISHME, jo mbi atë nga e
 * cila nisi sync-u. Sync-u zgjat (rrjet), dhe ndërkohë prindi mund të ketë
 * shtuar ose ndryshuar diçka në të njëjtën listë; zëvendësimi i drejtpërdrejtë
 * i listës do ta fshinte atë ndryshim nga telefoni.
 *
 * Rregulli është i njëjti "më i riu fiton" si te `mergeById`. Përjashtim i
 * vetëm: `storagePath` i momentit të sapongarkuar vjen me të njëjtin
 * `updatedAt`, prandaj kopjohet kur versioni lokal s'e ka.
 */
export function mergeRecordsPatch(current: BabyModuleState, patch: Partial<BabyModuleState>): Partial<BabyModuleState> {
  const out: Partial<BabyModuleState> = {};
  for (const [key, incoming] of Object.entries(patch)) {
    if (!SYNCED_LIST_KEYS.has(key) || !Array.isArray(incoming)) {
      (out as Record<string, unknown>)[key] = incoming;
      continue;
    }
    const byId = new Map<string, AnyPayload>();
    for (const item of current[key as keyof BabyModuleState] as AnyPayload[]) byId.set(item.id, item);
    for (const item of incoming as AnyPayload[]) {
      const mine = byId.get(item.id);
      if (!mine || item.updatedAt > mine.updatedAt) {
        byId.set(item.id, item);
      } else if (item.updatedAt === mine.updatedAt && "storagePath" in item && item.storagePath && !(mine as Moment).storagePath) {
        byId.set(item.id, { ...mine, storagePath: item.storagePath } as AnyPayload);
      }
    }
    const merged = [...byId.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    (out as Record<string, unknown>)[key] = merged;
  }
  return out;
}

/** Të gjitha regjistrimet lokale, si union i sheshtë. */
function collectLocal(baby: BabyModuleState): AnyBabyRecord[] {
  const out: AnyBabyRecord[] = [];
  for (const kind of SYNCED_RECORD_KINDS) {
    const list = baby[RECORD_LIST_KEY[kind]] as AnyPayload[];
    for (const record of list) {
      out.push({ kind, record } as AnyBabyRecord);
    }
  }
  return out;
}

async function pushRows(rows: BabyRecordRow[]): Promise<void> {
  if (!rows.length) return;

  // Në grupe, që një histori e gjatë të mos shkojë në një kërkesë të vetme.
  const CHUNK = 200;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from(TABLE)
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "user_id,id" });
    if (error) throw new Error(`Ngarkimi i baby_records dështoi: ${error.message}`);
  }
}

// ---------------------------------------------------------------------
// Fotot/videot e momenteve (Supabase Storage)
// ---------------------------------------------------------------------

/**
 * Ngarkon file-t e momenteve që ekzistojnë ende vetëm në telefon dhe kthen
 * `momentId -> storagePath`. Dështimi i një file-i s'e ndal sync-un: momenti
 * ruhet pa file dhe riprovohet herën tjetër.
 */
async function uploadPendingMomentFiles(
  userId: string,
  records: AnyBabyRecord[]
): Promise<Map<string, string>> {
  const uploaded = new Map<string, string>();

  for (const item of records) {
    if (item.kind !== "moment") continue;
    const moment = item.record;
    if (moment.storagePath || !isLocalFileUri(moment.uri)) continue;

    const path = await uploadMomentFile(userId, moment.id, moment.uri);
    if (path) uploaded.set(moment.id, path);
  }

  return uploaded;
}

/**
 * Momentet që vijnë nga serveri s'e kanë file-in në këtë pajisje, prandaj
 * `uri` zëvendësohet me një URL të nënshkruar. Nëse i njëjti moment ekziston
 * lokalisht me file në pajisje, URI-ja lokale mbetet: është më e shpejtë dhe
 * punon edhe pa internet.
 */
async function resolveRemoteMomentUris(remote: Moment[], local: Moment[]): Promise<void> {
  const localById = new Map(local.map((m) => [m.id, m]));

  for (const moment of remote) {
    const mine = localById.get(moment.id);
    if (mine && isLocalFileUri(mine.uri)) {
      moment.uri = mine.uri;
      continue;
    }
    if (!moment.storagePath) continue;

    const url = await signedUrlForMoment(moment.storagePath);
    if (url) moment.uri = url;
  }
}

// ---------------------------------------------------------------------
// Sync-u
// ---------------------------------------------------------------------

/**
 * Sinkronizon historikun e baby-t me Supabase dhe kthen VETËM listat që
 * ndryshuan, gati për `setBaby()`. Kthen null nëse s'ka çfarë të përditësohet
 * (ose s'ka përdorues të kyçur).
 *
 * AsyncStorage mbetet burimi për UI-n: shkrimet vazhdojnë të jenë lokale dhe
 * të menjëhershme, dhe ky funksion thirret në sfond. Pra app-i punon offline
 * dhe sinkronizohet kur ka rrjet.
 */
export async function syncBabyRecords(baby: BabyModuleState): Promise<Partial<BabyModuleState> | null> {
  // Jo id-ja e llogarise, por e pronarit te te dhenave: nese ky prind
  // eshte ftuar te familja e tjetrit, te dyve u duhet i njejti histori.
  // Pa kete, secili do te shkruante te vetja dhe do te dukej sikur
  // sinkronizimi nuk punon.
  const userId = await resolveDataOwnerId();
  if (!userId) return null;

  // Ora e FILLIMIT, jo e mbarimit: çdo ndryshim që ndodh gjatë këtij sync-u
  // (në telefon ose te webi) ka `updatedAt` pas saj dhe merret herën tjetër.
  // Më parë ruhej ora e mbarimit, dhe një shënim i shtuar gjatë sync-ut
  // mbetej përgjithmonë vetëm në njërën anë.
  const startedAt = new Date().toISOString();
  const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);
  const migrated = await AsyncStorage.getItem(MIGRATED_KEY);
  const localRecords = collectLocal(baby);

  // 1) Fotot/videot e momenteve shkojnë te Storage para metadatave, që rreshti
  //    të ruhet bashkë me `storagePath`.
  const uploaded = await uploadPendingMomentFiles(userId, localRecords);
  const withStoragePath = (item: AnyBabyRecord): AnyBabyRecord => {
    if (item.kind !== "moment") return item;
    const path = uploaded.get(item.record.id);
    return path ? { kind: "moment", record: { ...item.record, storagePath: path } } : item;
  };

  // 2) Migrimi një-herësh: historiku që ekziston vetëm në telefon ngarkohet
  //    i plotë. Pas kësaj dërgohen vetëm regjistrimet e ndryshuara.
  if (!migrated) {
    await pushRows(localRecords.map((item) => toRow(userId, withStoragePath(item))));
    await AsyncStorage.setItem(MIGRATED_KEY, "true");
  }

  // 3) Tërheq nga serveri vetëm çka ka ndryshuar pas sync-ut të fundit.
  //    Në grupe: Supabase kthen më së shumti 1000 rreshta për kërkesë, dhe
  //    sync-u i parë në një telefon të ri (pa lastSync) do të merrte vetëm
  //    një pjesë të historikut të një prindi me mbi 1000 shënime.
  const rows: BabyRecordRow[] = [];
  for (let from = 0; ; from += PULL_BATCH) {
    let query = supabase.from(TABLE).select("*").eq("user_id", userId);
    if (lastSync) query = query.gt("updated_at", lastSync);
    const { data, error } = await query
      .order("updated_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PULL_BATCH - 1);
    if (error) throw new Error(`Leximi i baby_records dështoi: ${error.message}`);
    rows.push(...((data ?? []) as BabyRecordRow[]));
    if (!data || data.length < PULL_BATCH) break;
  }

  // 4) Dërgo regjistrimet lokale të ndryshuara pas sync-ut të fundit, plus ato
  //    që sapo morën `storagePath`.
  if (migrated) {
    const changedLocally = localRecords.filter(
      (item) => !lastSync || item.record.updatedAt > lastSync || uploaded.has(item.record.id)
    );
    await pushRows(changedLocally.map((item) => toRow(userId, withStoragePath(item))));
  }

  // Dy minuta rezervë për orët e pajisjeve që s'përputhen (telefoni dhe
  // kompjuteri i webit): një rresht i marrë dy herë shkrihet pa dëm.
  await AsyncStorage.setItem(LAST_SYNC_KEY, new Date(new Date(startedAt).getTime() - 2 * 60_000).toISOString());

  const patch: Partial<BabyModuleState> = {};

  // 5) Shkrij çka erdhi nga serveri te listat lokale.
  if (rows?.length) {
    const remoteByKind = new Map<SyncedRecordKind, AnyPayload[]>();
    for (const row of rows as BabyRecordRow[]) {
      const { kind, record } = fromRow(row);
      const list = remoteByKind.get(kind) ?? [];
      list.push(record);
      remoteByKind.set(kind, list);
    }

    const remoteMoments = remoteByKind.get("moment") as Moment[] | undefined;
    if (remoteMoments) {
      await resolveRemoteMomentUris(remoteMoments, baby.moments);
    }

    for (const [kind, remote] of remoteByKind) {
      const listKey = RECORD_LIST_KEY[kind];
      const local = baby[listKey] as AnyPayload[];
      const { merged, changed } = mergeById(local, remote);
      if (changed) {
        // Renditja: më i riu i pari, si te `withAdd` te AppStateContext.
        merged.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
        (patch as Record<string, unknown>)[listKey] = merged;
      }
    }
  }

  // 6) `storagePath` i ri duhet ruajtur edhe lokalisht, që file-i të mos
  //    ngarkohet përsëri në çdo sync.
  if (uploaded.size) {
    const base = (patch.moments ?? baby.moments) as Moment[];
    patch.moments = base.map((m) => {
      const path = uploaded.get(m.id);
      return path ? { ...m, storagePath: path } : m;
    });
  }

  return Object.keys(patch).length ? patch : null;
}

/** Për testim/rikthim: e detyron migrimin dhe tërheqjen e plotë herën tjetër. */
export async function resetBabyRecordsSyncState(): Promise<void> {
  await AsyncStorage.multiRemove([LAST_SYNC_KEY, MIGRATED_KEY]);
}
