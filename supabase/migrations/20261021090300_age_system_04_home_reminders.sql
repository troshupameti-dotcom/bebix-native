-- =====================================================================
-- Sistemi i moshës, pjesa 4: kreu dhe kujtesat sipas fëmijës aktiv.
--
--  - "Ekipi sot" (household_day_summary): numëron vetëm shënimet e fëmijës
--    aktiv të personit, jo të të gjithë fëmijëve bashkë.
--  - Kujtesat e serverit (send-reminders): shënimi i fundit për çdo FËMIJË
--    (jo për familje), dhe marrësit janë vetëm ata që e kanë atë fëmijë aktiv,
--    bashkë me datat e tij që funksioni të vendosë fazën (pa ushqyerje/pelena
--    për 3–12 vjeç). Njoftimet mbeten të pauzuara: këto vetëm përgatiten.
--
-- Rendi: pas 20261021090000_age_system_01_children.sql. I sigurt për dy
-- ekzekutime; s'fshin asgjë.
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

create or replace function public.household_day_summary(p_from timestamptz, p_to timestamptz)
returns table (member_id uuid, kind text, n int)
language sql
stable
security definer
set search_path = public
as $$
  with act as (select public.active_child_id((select auth.uid())) as id)
  select r.created_by, r.kind::text, count(*)::int
  from public.baby_records r
  where r.user_id = public.my_data_owner()
    and public.can_access_baby_data(r.user_id)
    and r.created_by is not null
    and r.kind in ('feeding', 'sleep', 'diaper')
    and r.deleted_at is null and r.archived_at is null
    and r.occurred_at >= p_from and r.occurred_at < p_to
    and p_to - p_from <= interval '2 days'
    -- Vetëm fëmija aktiv (pa fëmijë te tabela e re: si më parë).
    and ((select id from act) is null or r.baby_id = (select id from act)::text)
  group by r.created_by, r.kind;
$$;

revoke execute on function public.household_day_summary(timestamptz, timestamptz) from public, anon;
grant execute on function public.household_day_summary(timestamptz, timestamptz) to authenticated;

-- Shënimi i fundit për çdo fëmijë (jo për familje). Vetëm send-reminders.
create or replace function public.latest_baby_record_per_child(p_kind text, p_since timestamptz)
returns table (user_id uuid, baby_id text, id text, payload jsonb, occurred_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (r.user_id, r.baby_id) r.user_id, r.baby_id, r.id, r.payload, r.occurred_at
  from public.baby_records r
  where r.kind = p_kind
    and r.deleted_at is null
    and r.occurred_at >= p_since
    and r.occurred_at <= now() + interval '5 minutes'
  order by r.user_id, r.baby_id, r.occurred_at desc;
$$;

revoke execute on function public.latest_baby_record_per_child(text, timestamptz) from public, anon, authenticated;

-- Marrësit e kujtesave: pronari dhe anëtarët e familjes, secili me fëmijën e
-- tij aktiv dhe datat e atij fëmije. Vetëm send-reminders.
create or replace function public.reminder_recipients(p_owner_ids uuid[])
returns table (owner_id uuid, user_id uuid, child_id uuid, birth_date date, due_date date)
language sql
stable
security definer
set search_path = public
as $$
  with people as (
    select o as owner_id, o as user_id from unnest(p_owner_ids) as o
    union
    select m.owner_id, m.member_id from public.baby_household_members m where m.owner_id = any(p_owner_ids)
  )
  select p.owner_id, p.user_id, c.id, c.birth_date, c.due_date
  from people p
  left join public.children c on c.id = public.active_child_id(p.user_id);
$$;

revoke execute on function public.reminder_recipients(uuid[]) from public, anon, authenticated;
