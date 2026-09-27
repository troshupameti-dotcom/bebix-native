-- Auditimi (28 shtator 2026): njoftimet shkojne te llogaria qe eshte e
-- kycur ne telefon, jo te ajo qe ishte me pare.
--
-- Token-i i njoftimeve eshte i pajisjes. Me pare:
--   - dalja nga llogaria nuk e hiqte token-in, pra telefoni vazhdonte te
--     merrte kujtesat e bebit dhe porosite e llogarise se meparshme;
--   - kur nje llogari tjeter kycej ne te njejtin telefon, upsert-i
--     deshtonte (rreshti i perkiste llogarise tjeter dhe RLS e ndalonte),
--     keshtu llogaria e re s'merrte asgje, kurse e vjetra vazhdonte.
-- Tani regjistrimi dhe heqja behen me dy funksione qe e zgjidhin kete.

create or replace function public.register_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'Duhet të jesh i kyçur.';
  end if;
  if p_token is null or p_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$' then
    raise exception 'Token i pavlefshëm.';
  end if;

  -- I njejti telefon, llogari tjeter: token-i kalon te llogaria e kycur tani.
  delete from public.push_tokens where expo_push_token = p_token and user_id <> v_user;

  insert into public.push_tokens (user_id, expo_push_token)
  values (v_user, p_token)
  on conflict (expo_push_token) do nothing;
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.push_tokens where expo_push_token = p_token and user_id = (select auth.uid());
$$;

revoke execute on function public.register_push_token(text) from public, anon;
revoke execute on function public.unregister_push_token(text) from public, anon;
grant execute on function public.register_push_token(text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
