/**
 * Prova e ushqimeve të para dhe e provave të fëmijës (PGlite), Faza B e Recetave:
 * - `foods`: të gjithë lexojnë, vetëm adminët shkruajnë; 80 ushqimet në bazë janë të njëjta me content/recipes/foods.json
 *   dhe çdo `food_key` i recetave ekziston te `foods`.
 * - `food_tries`: prindërit e familjes lexojnë dhe shkruajnë; një familje tjetër s'sheh asgjë; gjyshërit (viewer) s'i
 *   shohin provat derisa prindërit ndezin "Gjyshërit shohin edhe kujdesin", dhe s'shkruajnë kurrë; prova pa fëmijë shkon
 *   te fëmija falas, ndërsa një fëmijë i një familjeje tjetër refuzohet.
 * - Të dy migrimet ekzekutohen dy herë pa gabim dhe pa dyfishuar asgjë.
 * Nisja:  node supabase/tests/foods.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

// Si Supabase pas 30 tetorit 2026: tabelat e reja s'marrin më leje vetë.
const AFTER_OCT_30 = "create role service_role bypassrls; alter default privileges in schema public revoke all on tables from anon, authenticated;";

const TABLE = new URL("../migrations/20261111090000_foods.sql", import.meta.url);
const LIBRARY = new URL("../migrations/20261111090100_foods_library_1.sql", import.meta.url);
const FOODS = JSON.parse(fs.readFileSync(new URL("../../content/recipes/foods.json", import.meta.url), "utf8"));
const RECIPES = JSON.parse(fs.readFileSync(new URL("../../content/recipes/sq.json", import.meta.url), "utf8"));
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
for (const [file, label] of [[TABLE, "tabelave"], [LIBRARY, "ushqimeve"]]) {
  for (const name of ["i pari", "i dyti"]) {
    try { await db.exec(fs.readFileSync(file, "utf8")); console.log(`OK  migrimi i ${label} (${name})`); }
    catch (e) { console.log(`GABIM te migrimi i ${label}:`, e.message); process.exit(1); }
  }
}

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const fails = async (q, p = []) => { try { await db.query(q, p); return false; } catch { return true; } };
const n = async (q, p = []) => (await db.query(q, p)).rows[0].n;

const admin = "11111111-1111-1111-1111-111111111111", mom = "22222222-2222-2222-2222-222222222222", dad = "33333333-3333-3333-3333-333333333333";
const grandma = "44444444-4444-4444-4444-444444444444", stranger = "55555555-5555-5555-5555-555555555555";
await db.query(`insert into auth.users values ($1), ($2), ($3), ($4), ($5)`, [admin, mom, dad, grandma, stranger]);
await db.query(`insert into public.admins values ($1)`, [admin]);
await db.query(`insert into public.baby_household_members (owner_id, member_id, role) values ($1, $2, 'parent'), ($1, $3, 'viewer')`, [mom, dad, grandma]);
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };

// --- Ushqimet = kopja e app-it ---------------------------------------------------
check(`ushqimet fillestare: ${FOODS.length} (80), pa dyfishim pas dy ekzekutimeve`, FOODS.length === 80 && (await n(`select count(*)::int n from public.foods`)) === FOODS.length);
const rows = new Map((await db.query(`select * from public.foods`)).rows.map((r) => [r.food_key, r]));
const canon = (v) => (Array.isArray(v) ? v.map(canon) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v);
const diffs = [];
for (const f of FOODS) {
  const r = rows.get(f.foodKey);
  if (!r) { diffs.push(`${f.foodKey}: mungon`); continue; }
  const pairs = [["name", r.name, f.name], ["category", r.category, f.category], ["age", r.age_from_months, f.ageFromMonths], ["risk", r.choking_risk, f.chokingRisk],
    ["allergen", r.allergen, f.allergen], ["serve", canon(r.serve_by_age), canon(f.serveByAge)], ["nutrients", r.nutrients, f.nutrients], ["tip", r.tip, f.tip]];
  for (const [field, a, b] of pairs) if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`${f.foodKey}.${field}`);
}
check("çdo ushqim në bazë është i njëjtë me kopjen e app-it", diffs.length === 0, diffs.slice(0, 5).join(", "));
const missing = [...new Set(RECIPES.flatMap((r) => r.ingredients.map((i) => i.foodKey)).filter((k) => k && !rows.has(k)))];
check("çdo food_key i recetave ekziston te foods", missing.length === 0, missing.join(", "));
check("baza refuzon kategori të panjohur", await fails(`insert into public.foods (food_key, name, category) values ('x_test', 'X', 'candy')`));
check("baza refuzon alergjen të panjohur", await fails(`insert into public.foods (food_key, name, category, allergen) values ('x_test', 'X', 'fruit', 'mango')`));
check("baza refuzon rrezik mbytjeje të panjohur", await fails(`insert into public.foods (food_key, name, category, choking_risk) values ('x_test', 'X', 'fruit', 'none')`));

// --- RLS e ushqimeve -------------------------------------------------------------
await as(null);
check("anon lexon ushqimet", (await n(`select count(*)::int n from public.foods`)) === 80);
check("anon s'shton ushqim", await fails(`insert into public.foods (food_key, name, category) values ('x_anon', 'X', 'fruit')`));
await as(mom);
check("prindi lexon ushqimet", (await n(`select count(*)::int n from public.foods`)) === 80);
check("prindi s'shton ushqim", await fails(`insert into public.foods (food_key, name, category) values ('x_mom', 'X', 'fruit')`));
await db.query(`update public.foods set tip = 'ndryshuar' where food_key = 'apple'`);
await db.query(`delete from public.foods where food_key = 'apple'`);
await as(null);
check("prindi s'ndryshon dhe s'fshin ushqim", (await db.query(`select tip from public.foods where food_key = 'apple'`)).rows[0]?.tip === FOODS.find((f) => f.foodKey === "apple").tip);
await as(admin);
await db.query(`insert into public.foods (food_key, name, category, age_from_months) values ('x_admin', 'Ushqim prove', 'fruit', 6)`);
await db.query(`update public.foods set tip = 'këshillë e re' where food_key = 'x_admin'`);
check("admini shton dhe ndryshon ushqim (updated_at lëviz)", (await db.query(`select tip, updated_at >= created_at as ok from public.foods where food_key = 'x_admin'`)).rows[0]?.tip === "këshillë e re");
await db.query(`delete from public.foods where food_key = 'x_admin'`);

// --- Provat e fëmijës --------------------------------------------------------------
await as(null); // pa rol: sa për të krijuar fëmijët e familjes
await db.exec(`reset role;`);
const momChild = (await db.query(`insert into public.children (owner_id, is_free) values ($1, false) returning id`, [mom])).rows[0].id;
const strangerChild = (await db.query(`insert into public.children (owner_id, is_free) values ($1, true) returning id`, [stranger])).rows[0].id;
const tryRow = (id, extra = "") => `insert into public.food_tries (user_id, id, baby_id, food_key, tried_at, liking, reaction${extra ? ", symptoms" : ""})
  values ('${mom}', '${id}', '${momChild}', 'egg', now(), 'all', ${extra ? "true, array['rash']" : "false"})`;

await as(mom);
await db.query(tryRow("t1"));
await db.query(tryRow("t2", "reaction"));
check("mami shënon prova për fëmijën e vet", (await n(`select count(*)::int n from public.food_tries`)) === 2);
await db.query(`insert into public.food_tries (user_id, id, food_key, tried_at) values ($1, 't3', 'banana', now())`, [mom]);
check("prova pa fëmijë shkon te fëmija falas", !!(await db.query(`select baby_id from public.food_tries where id = 't3'`)).rows[0]?.baby_id);
check("prova për fëmijën e një familjeje tjetër refuzohet", await fails(`insert into public.food_tries (user_id, id, baby_id, food_key, tried_at) values ($1, 't4', $2, 'egg', now())`, [mom, strangerChild]));
check("baza refuzon shenjë reagimi të panjohur", await fails(`insert into public.food_tries (user_id, id, food_key, tried_at, symptoms) values ($1, 't5', 'egg', now(), array['fever'])`, [mom]));
check("baza refuzon pëlqim të panjohur", await fails(`insert into public.food_tries (user_id, id, food_key, tried_at, liking) values ($1, 't6', 'egg', now(), 'meh')`, [mom]));

await as(dad);
check("babi (prind në familje) i sheh provat", (await n(`select count(*)::int n from public.food_tries`)) === 3);
await db.query(`update public.food_tries set liking = 'some', updated_at = now() where id = 't1'`);
await db.query(`insert into public.food_tries (user_id, id, baby_id, food_key, tried_at) values ($1, 'd1', $2, 'yogurt', now())`, [mom, momChild]);
check("babi ndryshon dhe shton prova", (await n(`select count(*)::int n from public.food_tries where liking = 'some' or id = 'd1'`)) === 2);

await as(grandma);
check("gjyshja s'i sheh provat pa lejen e prindërve", (await n(`select count(*)::int n from public.food_tries`)) === 0);
check("gjyshja s'shënon prova", await fails(`insert into public.food_tries (user_id, id, food_key, tried_at) values ($1, 'g1', 'egg', now())`, [mom]));
await db.exec(`reset role;`);
await db.query(`insert into public.household_settings (owner_id, share_care_with_viewers) values ($1, true)`, [mom]);
await as(grandma);
check("me \"Gjyshërit shohin edhe kujdesin\" gjyshja i sheh provat dhe reagimet", (await n(`select count(*)::int n from public.food_tries where reaction`)) === 1 && (await n(`select count(*)::int n from public.food_tries`)) === 4);
await db.query(`update public.food_tries set note = 'gjyshja' where id = 't1'`);
await db.query(`delete from public.food_tries where id = 't1'`);
check("edhe me leje, gjyshja s'ndryshon e s'fshin", (await db.query(`select note from public.food_tries where id = 't1'`)).rows[0]?.note === "");
check("gjyshja s'shënon prova as me leje", await fails(`insert into public.food_tries (user_id, id, food_key, tried_at) values ($1, 'g2', 'egg', now())`, [mom]));

await as(stranger);
check("një familje tjetër s'sheh asgjë", (await n(`select count(*)::int n from public.food_tries`)) === 0);
check("një familje tjetër s'shkruan te kjo familje", await fails(`insert into public.food_tries (user_id, id, food_key, tried_at) values ($1, 's1', 'egg', now())`, [mom]));
await as(null);
check("anon s'sheh prova", await fails(`select count(*) from public.food_tries`) || (await n(`select count(*)::int n from public.food_tries`)) === 0);

await db.exec(`reset role;`);
await db.query(`delete from auth.users where id = $1`, [mom]);
check("kur fshihet llogaria, fshihen edhe provat", (await n(`select count(*)::int n from public.food_tries`)) === 0);

console.log(`\n${pass} kaluan, ${fail} dështuan`);
process.exit(fail ? 1 : 0);
