-- =====================================================================
-- Klienti sheh porositë e veta
--
-- Deri tani statusi i porosisë (pending -> confirmed -> shipped ->
-- delivered) shkruhej nga paneli i adminit dhe nuk e lexonte askush:
-- app-i s'kishte asnjë ekran porosish. Ky migrim hap vetëm leximin e
-- porosive TË VETA për përdoruesin e kyçur. Asgjë s'shkruhet nga app-i
-- përveç rrugës ekzistuese `place_order()`.
--
-- Aplikohet te Supabase -> SQL Editor. Është i sigurt të ekzekutohet
-- disa herë (idempotent).
-- =====================================================================

-- --- Kontroll paraprak: pa `user_id` te orders, asgjë nga kjo s'ka kuptim.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'orders' and column_name = 'user_id'
  ) then
    raise exception 'Tabela public.orders s''ka kolonën user_id. Ndalo këtu dhe trego skemën e orders para se të vazhdosh.';
  end if;
end $$;

alter table public.orders enable row level security;

-- Leximi i porosive të veta. Adminët kanë politikat e tyre veç kësaj.
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own"
  on public.orders
  for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Artikujt për-partner: i njëjti rregull, përmes porosisë amë.
-- (Ekrani i app-it lexon `orders.items`, por kjo politikë e bën të
-- mundur edhe gjurmimin për-artikull më vonë, pa hapur asgjë tjetër.)
do $$
begin
  if exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'order_items'
  ) then
    execute 'alter table public.order_items enable row level security';
    execute 'drop policy if exists "order_items_select_own" on public.order_items';
    execute $p$
      create policy "order_items_select_own"
        on public.order_items
        for select
        to authenticated
        using (exists (
          select 1 from public.orders o
          where o.id = order_items.order_id
            and o.user_id = (select auth.uid())
        ))
    $p$;
  end if;
end $$;

-- Lista e porosive të një klienti renditet gjithmonë nga e fundit.
create index if not exists orders_user_created_idx
  on public.orders (user_id, created_at desc);
