/**
 * Kërkesa për ndërrimin e fëmijës aktiv. Ndërrimi bëhet brenda radhës së sync-ut (useBabyRecordsSync), që të mos
 * bjerë mes një sync-u: së pari dërgohet çdo gjë e fëmijës aktual, pastaj kalohet te tjetri.
 */
type Pending = { childId: string; resolve: () => void; reject: (e: unknown) => void };

let pending: Pending | null = null;
let runner: (() => void) | null = null;

/** useBabyRecordsSync e regjistron kur është gati; null kur s'është (pa hyrje). */
export function registerChildSwitchRunner(run: (() => void) | null): void {
  runner = run;
}

export function requestChildSwitch(childId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!runner) {
      reject(new Error("SYNC_NOT_READY"));
      return;
    }
    // Një kërkesë e re zëvendëson atë që s'ka nisur ende.
    pending?.reject(new Error("SUPERSEDED"));
    pending = { childId, resolve, reject };
    runner();
  });
}

export function takeChildSwitch(): Pending | null {
  const p = pending;
  pending = null;
  return p;
}

export function hasPendingChildSwitch(): boolean {
  return pending !== null;
}
