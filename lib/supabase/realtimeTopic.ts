/**
 * Emri i një kanali Realtime, i ri për çdo abonim.
 *
 * Pse: `supabase.channel(emri)` kthen kanalin EKZISTUES kur një me të njëjtin emër është ende në listë. Kur një
 * ekran ose sync-u rinis (p.sh. ndryshon pronari i të dhënave), kanali i vjetër hiqet në mënyrë asinkrone; nëse
 * i riu krijohet para se heqja të mbarojë, merret i vjetri, tashmë i abonuar, dhe `.on(...)` rrëzohet me
 * "cannot add postgres_changes callbacks ... after subscribe()" (Sentry REACT-NATIVE-1). Emri s'ndikon te
 * njoftimet që vijnë: ato i zgjedh filtri.
 */
let seq = 0;

export function realtimeTopic(base: string): string {
  seq += 1;
  return `${base}:${seq}`;
}
