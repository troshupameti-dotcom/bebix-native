-- Asistenti AI: kufiri ditor i pyetjeve për çdo llogari (kontrolli i kostos). E numëron vetëm funksioni `ai-chat`
-- në server (service_role); klienti s'e lexon as e shkruan tabelën. Dita numërohet sipas orës së Kosovës.
-- I sigurt për t'u ekzekutuar dy herë.

create table if not exists public.ai_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null default ((now() at time zone 'Europe/Belgrade')::date),
  count   integer not null default 0,
  primary key (user_id, day)
);

alter table public.ai_usage enable row level security;
-- Pa asnjë politikë: anon dhe authenticated s'kanë qasje. Nga 30 tetori 2026 Supabase s'jep leje vetë, ndaj
-- leja për funksionin në server shkruhet shprehimisht.
revoke all on public.ai_usage from anon, authenticated;
grant all on public.ai_usage to service_role;

-- Merr një pyetje nga kufiri i ditës: true kur lejohet (dhe numërohet), false kur kufiri është arritur.
create or replace function public.ai_take_quota(p_user uuid, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_user is null or p_limit is null or p_limit < 1 then
    return false;
  end if;
  insert into public.ai_usage as u (user_id, day, count)
  values (p_user, (now() at time zone 'Europe/Belgrade')::date, 1)
  on conflict (user_id, day) do update set count = u.count + 1
    where u.count < p_limit
  returning u.count into v_count;
  return v_count is not null;
end;
$$;

revoke execute on function public.ai_take_quota(uuid, integer) from public, anon, authenticated;
grant execute on function public.ai_take_quota(uuid, integer) to service_role;
