/**
 * Prova e "Planit të javës" (PGlite), Faza C e Recetave:
 * - `meal_plan_slots`: e lexojnë dhe e shkruajnë prindërit e familjes; gjyshërit (viewer) vetëm e lexojnë; një familje
 *   tjetër dhe anon s'shohin asgjë; vakti pa fëmijë shkon te fëmija falas, ndërsa një fëmijë i një familjeje tjetër
 *   refuzohet; "upsert" me fëmijën bosh ndryshon të njëjtin vakt (s'e dyfishon).
 * - Migrimi ekzekutohet dy herë pa gabim.
 * Nisja:  node supabase/tests/meal-plan.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

// Si Supabase pas 30 tetorit 2026: tabelat e reja s'marrin më leje vetë.
const AFTER_OCT_30 = "create role service_role bypassrls; alter default privileges in schema public revoke all on tables from anon, authenticated;";

const TABLE = new URL("../migrations/20261112090000_meal_plans.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

// Gjendja e prodhimit para migrimit (sa i duhet testit): adminët, familja me role, fëmijët.
await db.exec(`
create schema auth;
create table auth.users (id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create role anon; create role authenticated;
grant usage on schema public, auth to anon, authenticated;
create table public.admins (user_id uuid primary key);
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
grant execute on function public.is_admin() to authenticated;

create table public.baby_household_members (owner_id uuid not null, member_id uuid not null, role text not null default 'parent', primary key (owner_id, member_id));
create function public.can_access_baby_data(p_owner uuid) returns boolean language sql stable security definer set search_path = public as $$
  select p_owner = (select auth.uid()) or exists (select 1 from public.baby_household_members m where m.owner_id = p_owner and m.member_id = (select auth.uid()) and m.role = 'parent');
$$;
create function public.can_view_baby_data(p_owner uuid) returns boolean language sql stable security definer set search_path = public as $$
  select p_owner = (select auth.uid()) or exists (select 1 from public.baby_household_members m where m.owner_id = p_owner and m.member_id = (select auth.uid()));
$$;
create table public.household_settings (owner_id uuid primary key, share_care_with_viewers boolean not null default false);
create function public.viewers_see_care(p_owner uuid) returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select share_care_with_viewers from public.household_settings where owner_id = p_owner), false);
$$;
grant execute on function public.can_access_baby_data(uuid), public.can_view_baby_data(uuid), public.viewers_see_care(uuid) to authenticated;

create table public.children (id uuid primary key default gen_random_uuid(), owner_id uuid not null, is_free boolean not null default false, created_at timestamptz not null default now());
create function public.ensure_free_child(p_owner uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  select id into v_id from public.children where owner_id = p_owner and is_free limit 1;
  if v_id is not null then return v_id; end if;
  insert into public.children (owner_id, is_free) values (p_owner, true) returning id into v_id;
  return v_id;
end; $$;
create function public.baby_records_fill_child() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.baby_id is null and tg_op = 'UPDATE' then new.baby_id := old.baby_id; end if;
  if new.baby_id is null then
    new.baby_id := public.ensure_free_child(new.user_id)::text;
  elsif not exists (select 1 from public.children c where c.id::text = new.baby_id and c.owner_id = new.user_id) then
    raise exception 'CHILD_NOT_FOUND';
  end if;
  return new;
end; $$;
`);
await db.exec(AFTER_OCT_30);
await db.exec("grant usage on schema public, auth to service_role;");
for (const name of ["i pari", "i dyti"]) {
  try { await db.exec(fs.readFileSync(TABLE, "utf8")); console.log(`OK  migrimi i planit (${name})`); }
  catch (e) { console.log("GABIM te migrimi i planit:", e.message); process.exit(1); }
}

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const fails = async (q, p = []) => { try { await db.query(q, p); return false; } catch { return true; } };
const n = async (q, p = []) => (await db.query(q, p)).rows[0].n;

const mom = "22222222-2222-2222-2222-222222222222", dad = "33333333-3333-3333-3333-333333333333";
const grandma = "44444444-4444-4444-4444-444444444444", stranger = "55555555-5555-5555-5555-555555555555";
await db.query(`insert into auth.users values ($1), ($2), ($3), ($4)`, [mom, dad, grandma, stranger]);
await db.query(`insert into public.baby_household_members (owner_id, member_id, role) values ($1, $2, 'parent'), ($1, $3, 'viewer')`, [mom, dad, grandma]);
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };

const momChild = (await db.query(`insert into public.children (owner_id, is_free) values ($1, false) returning id`, [mom])).rows[0].id;
const strangerChild = (await db.query(`insert into public.children (owner_id, is_free) values ($1, true) returning id`, [stranger])).rows[0].id;
// Si PostgREST me onConflict "user_id,baby_id,plan_date,meal".
const upsert = (owner, baby, date, meal, slug) => db.query(
  `insert into public.meal_plan_slots (user_id, baby_id, plan_date, meal, recipe_slug, updated_at) values ($1, $2, $3, $4, $5, now())
   on conflict (user_id, baby_id, plan_date, meal) do update set recipe_slug = excluded.recipe_slug, updated_at = excluded.updated_at`,
  [owner, baby, date, meal, slug]
);

await as(mom);
await upsert(mom, momChild, "2026-11-16", "lunch", "pure-karote");
await upsert(mom, momChild, "2026-11-16", "breakfast", "qull-misri-molle");
check("mami shton receta në plan për fëmijën e vet", (await n(`select count(*)::int n from public.meal_plan_slots`)) === 2);
await upsert(mom, null, "2026-11-17", "dinner", "supe-thjerrze");
await upsert(mom, null, "2026-11-17", "dinner", "qofte-pule");
check("vakti pa fëmijë shkon te fëmija falas dhe upsert-i s'e dyfishon", (await n(`select count(*)::int n from public.meal_plan_slots where plan_date = '2026-11-17'`)) === 1
  && (await db.query(`select recipe_slug from public.meal_plan_slots where plan_date = '2026-11-17'`)).rows[0]?.recipe_slug === "qofte-pule");
check("vakti për fëmijën e një familjeje tjetër refuzohet", await fails(`insert into public.meal_plan_slots (user_id, baby_id, plan_date, meal, recipe_slug) values ($1, $2, '2026-11-18', 'lunch', 'x')`, [mom, strangerChild]));
check("baza refuzon vakt të panjohur", await fails(`insert into public.meal_plan_slots (user_id, baby_id, plan_date, meal) values ($1, $2, '2026-11-18', 'brunch')`, [mom, momChild]));

await as(dad);
check("babi (prind në familje) e sheh planin", (await n(`select count(*)::int n from public.meal_plan_slots`)) === 3);
await upsert(mom, momChild, "2026-11-16", "lunch", "brokoli-patate");
await upsert(mom, momChild, "2026-11-16", "breakfast", null);
check("babi e ndërron dhe e heq një vakt (vakti bosh mbetet si rresht)", (await db.query(`select recipe_slug from public.meal_plan_slots where plan_date = '2026-11-16' and meal = 'lunch'`)).rows[0]?.recipe_slug === "brokoli-patate"
  && (await n(`select count(*)::int n from public.meal_plan_slots where recipe_slug is null`)) === 1);

await as(grandma);
check("gjyshja (familja) e lexon planin", (await n(`select count(*)::int n from public.meal_plan_slots`)) === 3);
check("gjyshja s'shton në plan", await fails(`insert into public.meal_plan_slots (user_id, baby_id, plan_date, meal, recipe_slug) values ($1, $2, '2026-11-19', 'lunch', 'x')`, [mom, momChild]));
await db.query(`update public.meal_plan_slots set recipe_slug = 'gjyshja' where plan_date = '2026-11-16' and meal = 'lunch'`);
await db.query(`delete from public.meal_plan_slots`);
check("gjyshja s'e ndryshon e s'e fshin", (await db.query(`select recipe_slug from public.meal_plan_slots where plan_date = '2026-11-16' and meal = 'lunch'`)).rows[0]?.recipe_slug === "brokoli-patate"
  && (await n(`select count(*)::int n from public.meal_plan_slots`)) === 3);

await as(stranger);
check("një familje tjetër s'e sheh planin", (await n(`select count(*)::int n from public.meal_plan_slots`)) === 0);
check("një familje tjetër s'shkruan te ky plan", await fails(`insert into public.meal_plan_slots (user_id, baby_id, plan_date, meal, recipe_slug) values ($1, null, '2026-11-20', 'lunch', 'x')`, [mom]));
await db.query(`update public.meal_plan_slots set recipe_slug = 'huaj'`);
await as(null);
check("anon s'e sheh planin", await fails(`select count(*) from public.meal_plan_slots`) || (await n(`select count(*)::int n from public.meal_plan_slots`)) === 0);
check("anon s'shkruan në plan", await fails(`insert into public.meal_plan_slots (user_id, baby_id, plan_date, meal) values ($1, null, '2026-11-20', 'lunch')`, [mom]));
await as(mom);
check("ndryshimi i të huajit s'preku asgjë", (await n(`select count(*)::int n from public.meal_plan_slots where recipe_slug = 'huaj'`)) === 0);

await db.exec(`reset role;`);
await db.query(`delete from auth.users where id = $1`, [mom]);
check("kur fshihet llogaria, fshihet edhe plani", (await n(`select count(*)::int n from public.meal_plan_slots`)) === 0);

console.log(`\n${pass} kaluan, ${fail} dështuan`);
process.exit(fail ? 1 : 0);
