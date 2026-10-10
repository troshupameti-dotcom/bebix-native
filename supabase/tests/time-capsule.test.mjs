/**
 * Prova e kapsulës së kohës në një Postgres lokal (PGlite), pa prekur bazën e vërtetë.
 * Nisja:  node supabase/tests/time-capsule.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIGRATION = new URL("../migrations/20261010090000_time_capsule.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

// Si në prodhim: auth.uid() nga sesioni, roli "authenticated", dhe funksionet e familjes.
await db.exec(`
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create role anon; create role authenticated;
grant usage on schema public, auth to anon, authenticated;
create table public.baby_household_members (owner_id uuid, member_id uuid);
grant select on public.baby_household_members to authenticated;
create function public.can_access_baby_data(p_owner uuid) returns boolean language sql stable security definer set search_path = public as $$
  select p_owner = (select auth.uid()) or exists (select 1 from public.baby_household_members m where m.owner_id = p_owner and m.member_id = (select auth.uid()));
$$;
create function public.my_data_owner() returns uuid language sql stable security definer set search_path = public as $$
  select coalesce((select owner_id from public.baby_household_members where member_id = (select auth.uid()) limit 1), (select auth.uid()));
$$;
grant execute on function public.can_access_baby_data(uuid), public.my_data_owner() to authenticated;
`);
try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); console.log("OK  migrimi u ekzekutua pa gabime"); }
catch (e) { console.log("GABIM te migrimi:", e.message); process.exit(1); }

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const one = async (q, p) => (await db.query(q, p)).rows[0];
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };
const fails = async (q, p) => { try { await db.query(q, p); return null; } catch (e) { return e.message; } };

await db.exec("reset role");
const mom = (await one(`insert into auth.users (email) values ('mami@example.com') returning id`)).id;
const dad = (await one(`insert into auth.users (email) values ('babi@example.com') returning id`)).id;
const stranger = (await one(`insert into auth.users (email) values ('tjeter@example.com') returning id`)).id;
await db.query(`insert into public.baby_household_members values ($1, $2)`, [mom, dad]);

// Mami shkruan një letër për 18 vjeç
await as(mom);
const id = (await one(`select public.seal_capsule_letter('Për ty, Ana', 'Të duam pa fund.', current_date + 6570) as id`)).id;
check("letra vuloset", !!id);
check("data në të kaluarën refuzohet", (await fails(`select public.seal_capsule_letter('x', 'y', current_date)`))?.includes("unlock_date_must_be_future"));
check("titulli bosh refuzohet", !!(await fails(`select public.seal_capsule_letter('  ', 'y', current_date + 5)`)));

// Titulli dhe data shihen; teksti jo
const meta = await one(`select id, title, unlock_on, author_id from public.time_capsule_letters where id = $1`, [id]);
check("titulli dhe data lexohen", meta?.title === "Për ty, Ana" && meta.author_id === mom);
check("teksti s'lexohet me SELECT", (await fails(`select body from public.time_capsule_letters`))?.includes("permission denied"));
check("select * s'e zbulon tekstin", (await fails(`select * from public.time_capsule_letters`))?.includes("permission denied"));
check("hapja para kohe s'kthen asgjë", (await one(`select public.open_capsule_letter($1) as b`, [id])).b === null);
check("letra s'ndryshohet pas vulosjes", (await fails(`update public.time_capsule_letters set title = 'x' where id = $1`, [id]))?.includes("permission denied"));
check("s'shtohet pa funksionin", (await fails(`insert into public.time_capsule_letters (owner_id, title, body, unlock_on) values ($1, 'a', 'b', current_date + 9)`, [mom]))?.includes("permission denied"));

// Babi (familja) e sheh në listë dhe shkruan te e njëjta kapsulë
await as(dad);
check("prindi tjetër e sheh letrën", (await one(`select count(*)::int c from public.time_capsule_letters`)).c === 1);
const dadLetter = (await one(`select public.seal_capsule_letter('Nga babi', 'Krenar për ty.', current_date + 30) as id`)).id;
check("letra e babit shkon te kapsula e familjes", (await one(`select owner_id from public.time_capsule_letters where id = $1`, [dadLetter])).owner_id === mom);
await db.query(`delete from public.time_capsule_letters where id = $1`, [id]);
await as(mom);
check("vetëm autori e fshin letrën", (await one(`select count(*)::int c from public.time_capsule_letters where id = $1`, [id])).c === 1);

// I huaji s'sheh asgjë
await as(stranger);
check("i huaji s'sheh letrat", (await one(`select count(*)::int c from public.time_capsule_letters`)).c === 0);

// Kur vjen data: hapet (simulojmë duke e afruar datën si administrator)
await db.exec("reset role");
await db.query(`update public.time_capsule_letters set unlock_on = current_date where id = $1`, [id]);
await as(stranger);
check("i huaji s'e hap as pas datës", (await one(`select public.open_capsule_letter($1) as b`, [id])).b === null);
await as(dad);
check("pas datës hapet për familjen", (await one(`select public.open_capsule_letter($1) as b`, [id])).b === "Të duam pa fund.");
await as(mom);
await db.query(`delete from public.time_capsule_letters where id = $1`, [id]);
check("autori e fshin letrën e vet", (await one(`select count(*)::int c from public.time_capsule_letters where id = $1`, [id])).c === 0);
await as(null);
check("pa llogari s'shihet asgjë", !!(await fails(`select id from public.time_capsule_letters`)));

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
