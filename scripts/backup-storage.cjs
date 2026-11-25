// Kopjon të gjithë skedarët e Supabase Storage (fotot e bebeve, produktet, logot...) në një dosje.
// Backup-i i bazës s'i përfshin: baza mban vetëm emrat e tyre. Përdoret nga .github/workflows/db-backup.yml.
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup-storage.cjs <dosja>
//
// Shkruan <dosja>/<kova>/<rruga e skedarit> dhe <dosja>/buckets.json (cilësimet e kovave, për rikthim).
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

const outDir = path.resolve(process.argv[2] ?? "");
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!process.argv[2] || !url || !key) {
  console.error("Përdorimi: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backup-storage.cjs <dosja>");
  process.exit(1);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const PAGE = 1000;

/** Të gjitha rrugët e skedarëve në një kovë; dosjet (id === null) hapen një nga një. */
async function listAll(bucket, prefix = "") {
  const files = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: PAGE, offset });
    if (error) throw new Error(`Lista ${bucket}/${prefix}: ${error.message}`);
    for (const item of data) {
      const p = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.id === null) files.push(...(await listAll(bucket, p)));
      else files.push(p);
    }
    if (data.length < PAGE) return files;
  }
}

/** Rruga në disk; emri i skedarit s'lejohet të dalë jashtë dosjes së kovës. */
function target(bucket, name) {
  const base = path.join(outDir, bucket);
  const dest = path.resolve(base, name);
  if (!dest.startsWith(base + path.sep)) throw new Error(`Emër i pasigurt: ${bucket}/${name}`);
  return dest;
}

(async () => {
  const { data: buckets, error } = await sb.storage.listBuckets();
  if (error) throw new Error(`Kovat: ${error.message}`);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "buckets.json"), JSON.stringify(buckets, null, 2));

  let count = 0;
  let bytes = 0;
  for (const b of buckets) {
    for (const name of await listAll(b.id)) {
      const dest = target(b.id, name);
      const { data, error: dlError } = await sb.storage.from(b.id).download(name);
      if (dlError) throw new Error(`Shkarkimi ${b.id}/${name}: ${dlError.message}`);
      const buf = Buffer.from(await data.arrayBuffer());
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      count++;
      bytes += buf.length;
    }
  }
  console.log(`Storage: ${buckets.length} kova, ${count} skedarë, ${(bytes / 1048576).toFixed(1)} MB`);
})().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
