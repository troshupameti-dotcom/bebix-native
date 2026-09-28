-- Auditimi (28 shtator 2026): politikat RLS me te shpejta dhe me te ngushta.
--
-- 1. Nenkerkesa e adminit `auth.uid() IN (SELECT user_id FROM admins)`, qe
--    perseritej ne 40+ politika dhe llogaritej per CDO rresht, behet thirrje
--    e `is_admin()` e mbeshtjellur ne `(select ...)` (advisor: auth_rls_initplan).
-- 2. `auth.uid()` dhe `current_partner_id()` mbeshtjellen ne `(select ...)`,
--    qe Postgres-i t'i llogarise nje here per kerkese, jo per rresht.
-- 3. Politikat e adminit dhe te partnerit vlejne vetem per `authenticated`:
--    anon-i s'ka pse t'i vleresoje, dhe keshtu `current_partner_id()` s'ka pse
--    t'i jepet anon-it.
-- 4. Dy politika te dyfishta te porosive hiqen (advisor: multiple_permissive):
--    `orders_select_own` dhe `order_items_select_own` bejne te njejten gje.
--
-- Funksionet ndihmese dhe indekset e celesave te huaj jane aplikuar me pare
-- (20260928090000_audit_helpers_and_indexes).

drop policy if exists users_read_own_orders on public.orders;
drop policy if exists order_items_customer_read on public.order_items;

do $$
declare
  r record;
  nq text;
  nc text;
  admin_in constant text := E'(auth.uid() IN ( SELECT admins.user_id\n   FROM admins))';
  admin_exists constant text := E'(EXISTS ( SELECT 1\n   FROM admins\n  WHERE (admins.user_id = auth.uid())))';
  admin_call constant text := '( SELECT public.is_admin() AS is_admin)';
  uid_wrapped constant text := '( SELECT auth.uid() AS uid)';
  partner_wrapped constant text := '( SELECT public.current_partner_id() AS current_partner_id)';
  touches_private boolean;
  stmt text;
begin
  for r in
    select pol.polname, cls.relname, pol.polcmd, pol.polroles,
           pg_get_expr(pol.polqual, pol.polrelid) as qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) as chk
    from pg_policy pol
    join pg_class cls on cls.oid = pol.polrelid
    join pg_namespace n on n.oid = cls.relnamespace
    where n.nspname = 'public'
  loop
    nq := r.qual;
    nc := r.chk;

    if nq is not null then
      nq := replace(nq, admin_in, admin_call);
      nq := replace(nq, admin_exists, admin_call);
      nq := replace(nq, uid_wrapped, '§UID§');
      nq := replace(nq, 'auth.uid()', uid_wrapped);
      nq := replace(nq, '§UID§', uid_wrapped);
      nq := replace(nq, '( SELECT current_partner_id() AS current_partner_id)', '§CP§');
      nq := replace(nq, 'current_partner_id()', '§CP§');
      nq := replace(nq, '§CP§', partner_wrapped);
    end if;
    if nc is not null then
      nc := replace(nc, admin_in, admin_call);
      nc := replace(nc, admin_exists, admin_call);
      nc := replace(nc, uid_wrapped, '§UID§');
      nc := replace(nc, 'auth.uid()', uid_wrapped);
      nc := replace(nc, '§UID§', uid_wrapped);
      nc := replace(nc, '( SELECT current_partner_id() AS current_partner_id)', '§CP§');
      nc := replace(nc, 'current_partner_id()', '§CP§');
      nc := replace(nc, '§CP§', partner_wrapped);
    end if;

    if nq is distinct from r.qual or nc is distinct from r.chk then
      stmt := format('alter policy %I on public.%I', r.polname, r.relname);
      if nq is not null then stmt := stmt || format(' using (%s)', nq); end if;
      if nc is not null then stmt := stmt || format(' with check (%s)', nc); end if;
      execute stmt;
    end if;

    -- Politikat qe varen nga admini ose partneri: vetem per te kycurit.
    touches_private := coalesce(nq, '') like '%is_admin()%' or coalesce(nc, '') like '%is_admin()%'
                    or coalesce(nq, '') like '%current_partner_id()%' or coalesce(nc, '') like '%current_partner_id()%';
    if touches_private and r.polroles = array[0::oid] then
      execute format('alter policy %I on public.%I to authenticated', r.polname, r.relname);
    end if;
  end loop;
end $$;

-- Anon-i s'vlereson me asnje politike partneri.
revoke execute on function public.current_partner_id() from public, anon;
grant execute on function public.current_partner_id() to authenticated;
