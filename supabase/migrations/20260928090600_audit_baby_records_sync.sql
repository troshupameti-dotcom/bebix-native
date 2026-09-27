-- Auditimi (28 shtator 2026): sinkronizimi i historikut te bebit.
--
-- 1. `server_updated_at`: ora e SERVERIT kur rreshti u shkrua. Sync-u i
--    telefonit merrte "cka ka ndryshuar pas sync-ut tim" sipas `updated_at`,
--    qe vjen nga ora e pajisjes. Nese telefoni i partnerit ishte 5 minuta
--    mbrapa, shenimet e tij kishin `updated_at` me te vjeter se kujtesa e
--    sync-ut tim dhe nuk vinin kurre. Ora e serverit eshte nje per te gjithe.
-- 2. "Me i riu fiton" edhe ne server: nje telefon qe kishte qene offline
--    mund te mbishkruante me nje version me te vjeter nje ndryshim me te ri
--    te webit ose te partnerit. Tani nje UPDATE me `updated_at` me te vjeter
--    se ai qe ka rreshti injorohet.
-- 3. Kufi per madhesine e `payload` (256 KB), qe nje klient i prishur ose
--    keqdashes te mos mbushe bazen.

alter table public.baby_records
  add column if not exists server_updated_at timestamptz not null default now();

create index if not exists baby_records_user_server_updated_idx
  on public.baby_records (user_id, server_updated_at);

create or replace function public.baby_records_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    -- Version me i vjeter se ai qe ka serveri: mbahet ai i serverit.
    return old;
  end if;
  new.server_updated_at := clock_timestamp();
  return new;
end;
$$;

drop trigger if exists baby_records_before_write on public.baby_records;
create trigger baby_records_before_write before insert or update on public.baby_records
  for each row execute function public.baby_records_before_write();

alter table public.baby_records drop constraint if exists baby_records_payload_size;
alter table public.baby_records add constraint baby_records_payload_size
  check (pg_column_size(payload) <= 262144);
