/**
 * Prova e mesazheve private dhe e ndjekjes mes prindërve (20261019090000_direct_messages.sql) në një Postgres
 * lokal (PGlite): kush mund të shkruajë, kush lexon çfarë (RLS), bllokimi, kufiri kundër spam-it, inbox-i.
 * Nisja:  node supabase/tests/direct-messages.test.mjs   (me @electric-sql/pglite të instaluar)
 */
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";

const MIGRATION = new URL("../migrations/20261019090000_direct_messages.sql", import.meta.url);
const db = new PGlite();
process.on("uncaughtException", (e) => { console.log("GABIM i papritur:", String(e.message).slice(0, 300)); process.exit(1); });

// Gjendja e prodhimit (sa i duhet testit): auth, bllokimet, ekspertët dhe ndjekja e tyre, emri i autorit
// (si community_author_name në prodhim), radha e njoftimeve.
await db.exec(`
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
create role anon; create role authenticated;
grant usage on schema public, auth to anon, authenticated;
alter default privileges in schema public grant all on tables to anon, authenticated;
create table public.community_blocks (blocker_id uuid not null, blocked_id uuid not null, created_at timestamptz default now());
alter table public.community_blocks enable row level security;
create policy blocks_own on public.community_blocks for all using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));
create table public.community_experts (id uuid primary key default gen_random_uuid(), user_id uuid unique, name text not null);
create table public.community_expert_follows (id uuid primary key default gen_random_uuid(), expert_id uuid not null, user_id uuid not null);
create function public.community_author_name(p_author uuid, p_requested text) returns text language plpgsql stable security definer set search_path = public as $$
declare v_expert text; v_name text := left(regexp_replace(btrim(coalesce(p_requested, '')), '\\s+', ' ', 'g'), 60);
begin
  select name into v_expert from public.community_experts where user_id = p_author;
  if v_expert is not null then return v_expert; end if;
  if v_name = '' then return 'Prind'; end if;
  if exists (select 1 from public.community_experts where lower(name) = lower(v_name)) then raise exception 'reserved_name'; end if;
  return v_name;
end $$;
create table public.notification_outbox (user_id uuid, key text, title text, body text, data jsonb, dedupe_key text, send_after timestamptz, expires_at timestamptz);
create function public.enqueue_notification(p_user uuid, p_key text, p_title text, p_body text, p_data jsonb default '{}'::jsonb,
  p_dedupe text default null, p_send_after timestamptz default now(), p_expires_at timestamptz default null)
returns void language plpgsql security definer set search_path = public as $$
begin insert into public.notification_outbox values (p_user, p_key, p_title, p_body, p_data, p_dedupe, p_send_after, p_expires_at); end $$;
`);
for (const i of [1, 2]) {
  try { await db.exec(fs.readFileSync(MIGRATION, "utf8")); console.log(`OK  migrimi u ekzekutua (${i})`); }
  catch (e) { console.log("GABIM te migrimi:", e.message); process.exit(1); }
}

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { (ok ? pass++ : fail++); console.log((ok ? "OK  " : "GABIM ") + name + (extra ? "  -> " + extra : "")); };
const one = async (q, p) => (await db.query(q, p)).rows[0];
const all = async (q, p) => (await db.query(q, p)).rows;
const as = async (uid) => { await db.exec(`reset role; select set_config('test.uid', '${uid ?? ""}', false); ${uid ? "set role authenticated;" : "set role anon;"}`); };
const fails = async (q, p) => { try { await db.query(q, p); return null; } catch (e) { return e.message; } };

await db.exec("reset role");
const mk = async (e) => (await one(`insert into auth.users (email) values ($1) returning id`, [e])).id;
const ana = await mk("ana@x"), ben = await mk("ben@x"), cia = await mk("cia@x"), drUser = await mk("dr@x");
const expertId = (await one(`insert into public.community_experts (user_id, name) values ($1, 'Dr. Arta') returning id`, [drUser])).id;

// --- Emri publik
await as(ana);
check("emri publik ruhet", (await one(`select public.set_my_community_name('  Ana   K ') as n`)).n === "Ana K");
check("emri i një eksperti s'merret dot", !!(await fails(`select public.set_my_community_name('dr. arta')`)));
await as(drUser);
check("eksperti merr emrin e vet", (await one(`select public.set_my_community_name('dikush') as n`)).n === "Dr. Arta");

// --- Pa ndjekje: s'ka bisedë
await as(ana);
check("pa ndjekje: s'nis bisedë", (await fails(`select public.start_conversation($1)`, [ben]))?.includes("dm_not_allowed"));
check("me veten: s'nis bisedë", (await fails(`select public.start_conversation($1)`, [ana]))?.includes("dm_not_allowed"));
check("s'ndjek në emër të dikujt tjetër", !!(await fails(`insert into public.community_user_follows (follower_id, followee_id) values ($1, $2)`, [ben, cia])));

// --- Ana ndjek Benin: mjafton njëra palë
await db.query(`insert into public.community_user_follows (follower_id, followee_id) values ($1, $2)`, [ana, ben]);
const conv = (await one(`select public.start_conversation($1) as id`, [ben])).id;
check("Ana ndjek Benin: Ana nis bisedën", !!conv);
await as(ben);
check("edhe Beni (që s'e ndjek Anën) e hap të njëjtën bisedë", (await one(`select public.start_conversation($1) as id`, [ana])).id === conv);
let prof = await one(`select * from public.community_public_profile($1)`, [ana]);
check("profili: Ana e ndjek Benin, mund të shkruajnë", prof.follows_me === true && prof.i_follow === false && prof.can_message === true && prof.display_name === "Ana K", JSON.stringify(prof));

// --- Mesazhet
await as(ana);
await db.query(`insert into public.dm_messages (conversation_id, sender_id, body) values ($1, $2, '  Përshëndetje!  ')`, [conv, ana]);
check("dërguesi s'mund të shtiret si tjetri", !!(await fails(`insert into public.dm_messages (conversation_id, sender_id, body) values ($1, $2, 'unë jam Beni')`, [conv, ben])));
check("mesazh bosh refuzohet", !!(await fails(`insert into public.dm_messages (conversation_id, sender_id, body) values ($1, $2, '   ')`, [conv, ana])));
check("screenshot me tekst refuzohet", !!(await fails(`insert into public.dm_messages (conversation_id, sender_id, kind, body) values ($1, $2, 'screenshot', 'x')`, [conv, ana])));
await as(ben);
let msgs = await all(`select body, sender_id from public.dm_messages where conversation_id = $1`, [conv]);
check("Beni e lexon mesazhin (i pastruar)", msgs.length === 1 && msgs[0].body === "Përshëndetje!");
let inbox = await all(`select * from public.dm_inbox()`);
check("inbox-i i Benit: emri i Anës, i palexuar", inbox.length === 1 && inbox[0].other_name === "Ana K" && inbox[0].unread === true && inbox[0].last_from_me === false, JSON.stringify(inbox[0]));
await db.query(`select public.mark_conversation_read($1)`, [conv]);
check("pas hapjes: e lexuar", (await one(`select unread from public.dm_inbox()`)).unread === false);
await db.query(`insert into public.dm_messages (conversation_id, sender_id, body) values ($1, $2, 'Faleminderit')`, [conv, ben]);
await db.exec("reset role");
const notif = await all(`select * from public.notification_outbox where key = 'community_message'`);
check("njoftimi shkon te tjetri, me emrin e dërguesit dhe bisedën", notif.length === 2 && notif[1].user_id === ana && notif[1].data.conversationId === conv && notif[1].data.type === "message");

// --- Një i tretë s'sheh asgjë
await as(cia);
check("Cia s'e sheh bisedën", (await one(`select count(*)::int c from public.dm_conversations`)).c === 0);
check("Cia s'i lexon mesazhet", (await one(`select count(*)::int c from public.dm_messages`)).c === 0);
check("Cia s'shkruan dot në bisedën e tyre", !!(await fails(`insert into public.dm_messages (conversation_id, sender_id, body) values ($1, $2, 'hyrje')`, [conv, cia])));
check("Cia s'ka inbox me ta", (await all(`select * from public.dm_inbox()`)).length === 0);
check("Cia s'e sheh kush ndjek kë", (await one(`select count(*)::int c from public.community_user_follows`)).c === 0);

// --- Fshirja
await as(ben);
const anaMsg = (await one(`select id from public.dm_messages where sender_id = $1 limit 1`, [ana])).id;
check("Beni s'e fshin dot mesazhin e Anës", (await all(`delete from public.dm_messages where id = $1 returning id`, [anaMsg])).length === 0);
await as(ana);
check("Ana e fshin mesazhin e vet", (await all(`delete from public.dm_messages where id = $1 returning id`, [anaMsg])).length === 1);

// --- Bllokimi
await as(ben);
await db.query(`insert into public.community_blocks (blocker_id, blocked_id) values ($1, $2)`, [ben, ana]);
check("pas bllokimit: inbox-i i Benit s'e tregon Anën", (await all(`select * from public.dm_inbox()`)).length === 0);
await as(ana);
check("pas bllokimit: Ana s'shkruan dot", !!(await fails(`insert into public.dm_messages (conversation_id, sender_id, body) values ($1, $2, 'a je?')`, [conv, ana])));
check("pas bllokimit: s'nis bisedë", (await fails(`select public.start_conversation($1)`, [ben]))?.includes("dm_not_allowed"));
await db.query(`delete from public.community_user_follows where follower_id = $1`, [ana]);
check("pas bllokimit: Ana s'e ndjek dot sërish Benin", !!(await fails(`insert into public.community_user_follows (follower_id, followee_id) values ($1, $2)`, [ana, ben])));
await as(ben);
await db.query(`delete from public.community_blocks where blocker_id = $1`, [ben]);

// --- Pa ndjekje më: s'shkruajnë
await as(ana);
await db.query(`delete from public.community_user_follows where follower_id = $1`, [ana]);
check("pas heqjes së ndjekjes: dm_can_send = false", (await one(`select public.dm_can_send($1) as ok`, [conv])).ok === false);
check("…dhe mesazhi refuzohet", !!(await fails(`insert into public.dm_messages (conversation_id, sender_id, body) values ($1, $2, 'sërish')`, [conv, ana])));
check("mesazhet e vjetra mbeten të lexueshme", (await one(`select count(*)::int c from public.dm_messages where conversation_id = $1`, [conv])).c === 1);

// --- Ndjekja e një eksperti mjafton
await as(cia);
await db.query(`insert into public.community_expert_follows (expert_id, user_id) values ($1, $2)`, [expertId, cia]);
const convDr = (await one(`select public.start_conversation($1) as id`, [drUser])).id;
check("prindi që ndjek ekspertin i shkruan atij", !!convDr);

// --- Kufiri kundër spam-it
for (let i = 0; i < 30; i++) await db.query(`insert into public.dm_messages (conversation_id, sender_id, body) values ($1, $2, $3)`, [convDr, cia, `m${i}`]);
check("mesazhi i 31-të brenda një minute refuzohet", (await fails(`insert into public.dm_messages (conversation_id, sender_id, body) values ($1, $2, 'shumë')`, [convDr, cia]))?.includes("dm_rate_limit"));

// --- Pa llogari
await as(null);
check("pa llogari: s'lexon asgjë", !!(await fails(`select * from public.dm_inbox()`)));

console.log(`\n${pass} OK, ${fail} gabime`);
process.exit(fail ? 1 : 0);
