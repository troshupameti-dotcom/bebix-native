-- Bebix punon vetëm me distributorë (1 nëntor 2026): askush s'mund të hapë më dyqan te Bebix.
--
-- Portali i tregtarit dhe faqja "Shit në Bebix" u hoqën nga webi dhe app-i. Këtu mbyllet edhe dera te baza:
-- funksionet me të cilat një llogari aplikonte si shitës ose menaxhonte produktet, stokun dhe shitjet e veta
-- s'mund të thirren më nga app-i apo webi (anon / authenticated). Tabelat e partnerëve i mbron RLS-ja: pa
-- këto funksione një llogari e zakonshme s'krijon dot partner, produkt apo ofertë.
--
-- Çfarë NUK ndryshon:
-- - Asnjë tabelë, kolonë apo rresht s'fshihet: partnerët ekzistues dhe historiku i tyre mbeten në bazë.
-- - current_partner_id / current_active_partner_id / current_partner_role mbeten: i përdorin politikat RLS.
-- - update_order_item_status, checkout-i dhe pagesat s'preken.
-- - Adminët vazhdojnë t'i shohin dhe t'i ndryshojnë tabelat e partnerëve përmes politikave të adminit.
--
-- E sigurt për t'u ekzekutuar dy herë: REVOKE mbi një të drejtë që s'ekziston më s'bën asgjë, dhe funksionet që
-- mungojnë anashkalohen (kërkohen sipas emrit te pg_proc, me çdo nënshkrim që kanë).

do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'submit_partner_application',
        'partner_create_product',
        'partner_update_product',
        'partner_set_offer_active',
        'update_partner_stock',
        'partner_dashboard',
        'partner_order_lines',
        'partner_customers',
        'partner_balance'
      )
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', fn.sig);
  end loop;
end
$$;
