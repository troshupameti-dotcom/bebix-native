/**
 * Prova e "disa fëmijë + plani + fëmija aktiv" në një Postgres lokal (PGlite).
 * Nisja:  node supabase/tests/children.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

// Si Supabase pas 30 tetorit 2026: tabelat e reja s'marrin më leje vetë (tabelat bazë më lart i kanë, si në prodhim).
// Kështu testi kap çdo tabelë të re pa GRANT, që në prodhim do të jepte "permission denied".
const AFTER_OCT_30 = "create role service_role; alter default privileges in schema public revoke all on tables from anon, authenticated;";

const MIGRATION = new URL("../migrations/20261021090000_age_system_01_children.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

// Gjendja e prodhimit para migrimit (sa i duhet testit).
await db.exec(`
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create role anon; create role authenticated;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;

create table public.baby_household_members (
  owner_id uuid not null, member_id uuid not null, role text not null default 'parent', created_at timestamptz not null default now(),
  primary key (owner_id, member_id));
create unique index baby_household_one_per_member on public.baby_household_members (member_id);

create function public.can_access_baby_data(p_owner uuid) returns boolean language sql stable security definer set search_path = public as $$
  select p_owner = (select auth.uid()) or exists (select 1 from public.baby_household_members m
    where m.owner_id = p_owner and m.member_id = (select auth.uid()) and m.role = 'parent');
$$;
create function public.can_view_baby_data(p_owner uuid) returns boolean language sql stable security definer set search_path = public as $$
  select p_owner = (select auth.uid()) or exists (select 1 from public.baby_household_members m
    where m.owner_id = p_owner and m.member_id = (select auth.uid()));
$$;
create function public.my_data_owner() returns uuid language sql stable security definer set search_path = public as $$
  select coalesce((select owner_id from public.baby_household_members where member_id = (select auth.uid()) limit 1), (select auth.uid()));
$$;
grant execute on function public.can_access_baby_data(uuid), public.can_view_baby_data(uuid), public.my_data_owner() to authenticated;

create table public.baby_profiles (user_id uuid primary key, baby_name text, baby_dob date, updated_at timestamptz,
  parent_name text, baby_photo_path text, parent_photo_path text, details jsonb not null default '{}'::jsonb);
alter table public.baby_profiles enable row level security;
create policy "baby_profiles_household" on public.baby_profiles for all to authenticated
  using (public.can_access_baby_data(user_id)) with check (public.can_access_baby_data(user_id));

create table public.baby_records (user_id uuid not null, id text not null, baby_id text, kind text not null, payload jsonb not null default '{}',
  occurred_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  edit_count int not null default 0, deleted_at timestamptz, archived_at timestamptz,
  server_updated_at timestamptz not null default now(), primary key (user_id, id));
alter table public.baby_records enable row level security;
create policy "baby_records_household" on public.baby_records for all to authenticated
  using (public.can_access_baby_data(user_id)) with check (public.can_access_baby_data(user_id));
create function public.baby_records_before_write() returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then return old; end if;
  new.server_updated_at := clock_timestamp();
  return new;
end; $$;
create trigger baby_records_before_write before insert or update on public.baby_records
  for each row execute function public.baby_records_before_write();
`);

await db.exec("reset role");
const one = async (q, p) => (await db.query(q, p)).rows[0];
const all = async (q, p) => (await db.query(q, p)).rows;
const mk = async (e) => (await one(`insert into auth.users (email) values ($1) returning id`, [e])).id;

// Para migrimit: mami me bebin dhe 2 shënime; babi anëtar (rreshti i tij mban vetëm emrin e prindit);
// një përdorues me shënime pa profil; një me profil bosh (vetëm emri i prindit).
const mom = await mk("mami@x"), dad = await mk("babi@x"), gran = await mk("gjyshja@x");
const noProfile = await mk("pa-profil@x"), emptyProfile = await mk("bosh@x"), stranger = await mk("tjeter@x");
await db.query(`insert into public.baby_household_members (owner_id, member_id, role) values ($1, $2, 'parent'), ($1, $3, 'viewer')`, [mom, dad, gran]);
await db.query(`insert into public.baby_profiles (user_id, baby_name, baby_dob, details) values ($1, 'Ana', '2025-09-20', '{"babyGender":"girl"}')`, [mom]);
await db.query(`insert into public.baby_profiles (user_id, parent_name) values ($1, 'Babi'), ($2, 'Dikush')`, [dad, emptyProfile]);
await db.query(`insert into public.baby_records (user_id, id, kind) values ($1, 'r1', 'feeding'), ($1, 'r2', 'diaper'), ($2, 'x1', 'sleep')`, [mom, noProfile]);

await db.exec(AFTER_OCT_30);
const source = fs.readFileSync(MIGRATION, "utf8");
try { await db.exec(source); console.log("OK  migrimi u ekzekutua pa gabime"); }
catch (e) { console.log("GABIM te migrimi:", e.message); process.exit(1); }
try { await db.exec(source); console.log("OK  migrimi i dytë (i njëjti skedar) pa gabime"); }
catch (e) { console.log("GABIM te ekzekutimi i dytë:", e.message); process.exit(1); }

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };
const fails = async (q, p) => { try { await db.query(q, p); return null; } catch (e) { return e.message; } };

// --- Migrimi i të dhënave --------------------------------------------------
await db.exec("reset role");
const momKids = await all(`select * from public.children where owner_id = $1`, [mom]);
check("bebi ekzistues → një fëmijë falas, me emrin, datën dhe detajet", momKids.length === 1 && momKids[0].is_free && momKids[0].name === "Ana"
  && String(momKids[0].birth_date).length > 0 && momKids[0].details.babyGender === "girl");
const ana = momKids[0].id;
check("pas dy ekzekutimeve s'ka dublikata", (await one(`select count(*)::int n from public.children`)).n === 2, String((await one(`select count(*)::int n from public.children`)).n));
check("anëtari i familjes s'merr fëmijë të vetin", (await one(`select count(*)::int n from public.children where owner_id = $1`, [dad])).n === 0);
check("profili bosh (vetëm emri i prindit) s'krijon fëmijë", (await one(`select count(*)::int n from public.children where owner_id = $1`, [emptyProfile])).n === 0);
check("kush ka shënime pa profil merr një fëmijë falas", (await one(`select count(*)::int n from public.children where owner_id = $1 and is_free`, [noProfile])).n === 1);
check("shënimet ekzistuese i përkasin fëmijës falas", (await one(`select count(*)::int n from public.baby_records where user_id = $1 and baby_id = $2`, [mom, ana])).n === 2);
check("baby_profiles s'u prek nga migrimi", (await one(`select baby_name, parent_name from public.baby_profiles where user_id = $1`, [dad])).parent_name === "Babi");

// --- App-i i vjetër ---------------------------------------------------------
await as(dad);
await db.query(`insert into public.baby_records (user_id, id, kind) values ($1, 'r3', 'sleep')`, [mom]);
check("shënim pa baby_id (app i vjetër / web) → fëmija falas", (await one(`select baby_id from public.baby_records where id = 'r3'`)).baby_id === ana);
await db.query(`insert into public.baby_records (user_id, id, kind, baby_id, updated_at) values ($1, 'r3', 'sleep', null, now() + interval '1 minute')
  on conflict (user_id, id) do update set baby_id = excluded.baby_id, updated_at = excluded.updated_at`, [mom]);
check("përditësimi pa baby_id e ruan fëmijën", (await one(`select baby_id from public.baby_records where id = 'r3'`)).baby_id === ana);
await db.exec("reset role");
const strangerKid = (await one(`select public.ensure_free_child($1) id`, [stranger])).id;
await as(mom);
check("baby_id i një familjeje tjetër refuzohet", /CHILD_NOT_FOUND/.test(await fails(`insert into public.baby_records (user_id, id, kind, baby_id) values ($1, 'bad', 'sleep', $2)`, [mom, strangerKid]) ?? ""));
await db.query(`update public.baby_profiles set baby_name = 'Ana Maria' where user_id = $1`, [mom]);
check("emri nga app-i i vjetër kalon te fëmija falas", (await one(`select name from public.children where id = $1`, [ana])).name === "Ana Maria");
await db.query(`update public.children set name = 'Ana M.', birth_date = '2025-09-21' where id = $1`, [ana]);
const mirrored = await one(`select baby_name, baby_dob::text d from public.baby_profiles where user_id = $1`, [mom]);
check("emri dhe data nga app-i i ri kalojnë te baby_profiles", mirrored.baby_name === "Ana M." && mirrored.d === "2025-09-21", JSON.stringify(mirrored));

// --- Shtimi i fëmijëve dhe Premium -----------------------------------------
await as(mom);
check("fëmija i dytë pa Premium: PREMIUM_REQUIRED", /PREMIUM_REQUIRED/.test(await fails(`select public.add_child('Ben', '2026-05-01')`) ?? ""));
check("pa datë: DATE_REQUIRED", /DATE_REQUIRED/.test(await fails(`select public.add_child('Ben')`) ?? ""));
check("klienti s'shton dot fëmijë direkt", !!(await fails(`insert into public.children (owner_id, name) values ($1, 'X')`, [mom])));
check("klienti s'e ndryshon dot is_free", !!(await fails(`update public.children set is_free = false where id = $1`, [ana])));
check("pa Premium: my_plan = free", (await one(`select * from public.my_plan()`)).is_premium === false);

await db.exec("reset role");
await db.query(`insert into public.user_plans (user_id, plan, premium_until) values ($1, 'premium', now() + interval '30 days')`, [mom]);
await as(dad);
const ben = (await one(`select public.add_child('Ben', '2026-05-01') id`)).id;
check("me Premium (të pronarit) babi shton fëmijën e dytë", !!ben);
const benRow = await one(`select is_free, owner_id from public.children where id = $1`, [ben]);
check("fëmija i dytë s'është falas dhe i përket pronarit", benRow.is_free === false && benRow.owner_id === mom);
await db.query(`select public.set_active_child($1)`, [ben]);
const dadKids = await all(`select * from public.my_children()`);
check("babi i sheh të dy, me Benin aktiv", dadKids.length === 2 && dadKids.find((k) => k.id === ben).is_active && !dadKids.find((k) => k.id === ana).is_active);
await as(mom);
check("zgjedhja e babit s'e ndryshon fëmijën aktiv të mamit", (await all(`select * from public.my_children()`)).find((k) => k.id === ana).is_active);
await as(gran);
check("gjyshja i sheh fëmijët", (await all(`select * from public.my_children()`)).length === 2);
check("gjyshja s'shton dot fëmijë", /NOT_ALLOWED/.test(await fails(`select public.add_child('C', '2026-01-01')`) ?? ""));
check("gjyshja s'i ndryshon dot të dhënat e fëmijës", (await db.query(`update public.children set name = 'X' where id = $1`, [ana])).affectedRows === 0);
await as(stranger);
check("plani i një të huaji është i veti (falas), jo i familjes", (await one(`select * from public.my_plan()`)).is_premium === false);
check("një i huaj s'sheh fëmijët e familjes", (await all(`select * from public.children where owner_id = $1`, [mom])).length === 0);
check("një i huaj s'zgjedh dot fëmijën e tjetrit", /NOT_ALLOWED/.test(await fails(`select public.set_active_child($1)`, [ben]) ?? ""));

// --- Skadimi i Premium-it: kyçja, pa fshirje --------------------------------
await db.exec("reset role");
await db.query(`update public.user_plans set premium_until = now() - interval '1 day' where user_id = $1`, [mom]);
await as(dad);
const afterExpiry = await all(`select * from public.my_children()`);
check("pas skadimit Beni është i kyçur, por ekziston", afterExpiry.find((k) => k.id === ben).is_locked && afterExpiry.length === 2);
check("pas skadimit fëmija aktiv i babit bie te fëmija falas", afterExpiry.find((k) => k.id === ana).is_active);
check("i kyçuri s'zgjidhet: PREMIUM_REQUIRED", /PREMIUM_REQUIRED/.test(await fails(`select public.set_active_child($1)`, [ben]) ?? ""));
await db.exec("reset role");
check("të dhënat e Benit mbeten", (await one(`select count(*)::int n from public.children where id = $1`, [ben])).n === 1);

// --- Ndërrimi i fëmijës falas -----------------------------------------------
await as(dad);
check("anëtari s'e ndërron dot fëmijën falas", /NOT_ALLOWED/.test(await fails(`select public.set_free_child($1)`, [ben]) ?? ""));
await as(mom);
await db.query(`select public.set_free_child($1)`, [ben]);
const swapped = await all(`select id, is_free from public.children where owner_id = $1`, [mom]);
check("herën e parë ndërrimi lejohet menjëherë", swapped.find((k) => k.id === ben).is_free && !swapped.find((k) => k.id === ana).is_free);
check("baby_profiles pasqyron fëmijën e ri falas", (await one(`select baby_name from public.baby_profiles where user_id = $1`, [mom])).baby_name === "Ben");
check("ndërrimi i dytë brenda 30 ditëve: FREE_CHANGE_COOLDOWN", /FREE_CHANGE_COOLDOWN/.test(await fails(`select public.set_free_child($1)`, [ana]) ?? ""));
const momNow = await all(`select * from public.my_children()`);
check("tani Ana është e kyçur dhe Beni i hapur", momNow.find((k) => k.id === ana).is_locked && !momNow.find((k) => k.id === ben).is_locked);
await db.exec("reset role");
await db.query(`insert into public.baby_records (user_id, id, kind) values ($1, 'r4', 'sleep')`, [mom]);
check("shënimi pa baby_id tani shkon te fëmija i ri falas", (await one(`select baby_id from public.baby_records where id = 'r4'`)).baby_id === ben);

// --- Përdorues i ri me app-in e vjetër ---------------------------------------
const fresh = await mk("i-ri@x");
await as(fresh);
await db.query(`insert into public.baby_profiles (user_id, baby_name, baby_dob) values ($1, 'Lea', '2026-08-01')`, [fresh]);
const freshKids = await all(`select * from public.my_children()`);
check("onboarding-u i vjetër krijon fëmijën falas", freshKids.length === 1 && freshKids[0].name === "Lea" && freshKids[0].is_free && freshKids[0].is_active);
await db.exec("reset role");
const pregnant = await mk("shtatzene@x");
await as(pregnant);
const due = (await one(`select public.add_child('Bebi', null, current_date + 90) id`)).id;
const dueRow = (await all(`select * from public.my_children()`))[0];
check("shtatzënia: fëmija i parë vetëm me datë të pritur, falas", dueRow.id === due && dueRow.is_free && dueRow.birth_date === null && dueRow.due_date !== null);

// Lejet e API-së (pas 30 tetorit Supabase s'i jep vetë): i kyçuri lexon planin dhe zgjedhjen e vet; mysafiri asgjë.
await as(mom);
check("API: i kyçuri lexon user_plans dhe child_selection", (await fails(`select * from public.user_plans`)) === null && (await fails(`select * from public.child_selection`)) === null);
await as(null);
check("API: mysafiri s'lexon fëmijët, planet as zgjedhjet", !!(await fails(`select * from public.children`)) && !!(await fails(`select * from public.user_plans`)) && !!(await fails(`select * from public.child_selection`)));

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
