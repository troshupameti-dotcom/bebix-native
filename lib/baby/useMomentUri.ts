import { useEffect, useState } from "react";
import { isLocalFileUri, signedUrlForMoment } from "@/lib/baby/momentPhotos";

/**
 * Adresa për të shfaqur foton/videon e një momenti.
 *
 * Momentet që vijnë nga serveri kishin te `uri` një lidhje të nënshkruar që
 * skadon pas 24 orësh, dhe ajo ruhej në telefon: të nesërmen fotot dilnin
 * bosh. Tani lidhja merret kur shfaqet, ruhet vetëm në kujtesë dhe rinovohet
 * para se të skadojë. Skedari lokal (në telefonin që e bëri foton) përdoret
 * drejtpërdrejt.
 */

type Cached = { url: string; expiresAt: number };
const cache = new Map<string, Cached>();
/** Lidhja vlen 24 orë; rinovohet pas 20, me rezervë. */
const REUSE_MS = 20 * 60 * 60 * 1000;

export function useMomentUri(moment: { uri: string | null; storagePath?: string | null }): string | null {
  const local = isLocalFileUri(moment.uri) ? moment.uri : null;
  const path = moment.storagePath ?? null;
  const [fetched, setFetched] = useState<{ path: string; url: string } | null>(null);

  useEffect(() => {
    if (local || !path) return;
    const hit = cache.get(path);
    if (hit && hit.expiresAt > Date.now()) return;
    let alive = true;
    void signedUrlForMoment(path).then((url) => {
      if (!url) return;
      cache.set(path, { url, expiresAt: Date.now() + REUSE_MS });
      if (alive) setFetched({ path, url });
    });
    return () => {
      alive = false;
    };
  }, [local, path]);

  if (local) return local;
  if (path) return (fetched?.path === path ? fetched.url : null) ?? cache.get(path)?.url ?? null;
  // Momentet e vjetra pa `storagePath` mbajnë ende adresën e tyre.
  return moment.uri;
}
