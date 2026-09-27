-- Kujtesat e ushqyerjes dhe pelenave: prindi zgjedh pas sa oresh (1-12),
-- ne vend te 4 oreve te fiksuara per te gjithe.
alter table public.notification_settings
  add column if not exists feeding_gap_h smallint not null default 4 check (feeding_gap_h between 1 and 12),
  add column if not exists diaper_gap_h smallint not null default 4 check (diaper_gap_h between 1 and 12);

-- Regjistrimi i fundit per cdo perdorues, per nje lloj. Me pare send-reminders
-- lexonte 3000 rreshtat me te rinj te te GJITHE perdoruesve dhe zgjidhte ne
-- JavaScript: me shume perdorues, kujtesat e disave thjesht nuk dilnin.
-- Ketu dritarja kohore e mban te vogel (indeksi user_id, kind, occurred_at).
create or replace function public.latest_baby_record_per_user(p_kind text, p_since timestamptz)
returns table (user_id uuid, id text, payload jsonb, occurred_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (r.user_id) r.user_id, r.id, r.payload, r.occurred_at
  from public.baby_records r
  where r.kind = p_kind
    and r.deleted_at is null
    and r.occurred_at >= p_since
    and r.occurred_at <= now() + interval '5 minutes'
  order by r.user_id, r.occurred_at desc;
$$;

-- Vetem send-reminders (service_role) e perdor.
revoke execute on function public.latest_baby_record_per_user(text, timestamptz) from public, anon, authenticated;
