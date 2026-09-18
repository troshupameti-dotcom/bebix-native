-- =====================================================================
-- Vleresimet e produkteve.
--
-- Kolonat `rating` dhe `review_count` ekzistonin te `products` dhe nuk i
-- shkruante asgje — prandaj cdo produkt dukej "5.0 (0 vleresime)", qe
-- duket e sajuar dhe u fsheh ne app. Ketu behen te vertete.
--
-- APLIKUAR TASHME ne projekt (version 20260918192027).
-- =====================================================================

create table if not exists public.product_reviews (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  rating     smallint not null check (rating between 1 and 5),
  body       text check (body is null or char_length(body) <= 1000),
  author_name text,
  -- A e ka blere vertet: llogaritet nje here, kur shkruhet vleresimi.
  verified_purchase boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Nje vleresim per person per produkt; ndryshimi behet me update.
  unique (product_id, user_id)
);

create index if not exists product_reviews_product_idx
  on public.product_reviews (product_id, created_at desc);

alter table public.product_reviews enable row level security;

-- Lexohen nga te gjithe: pa kete, vleresimet s'kane kuptim.
drop policy if exists "product_reviews_read" on public.product_reviews;
create policy "product_reviews_read"
  on public.product_reviews for select to anon, authenticated
  using (true);

drop policy if exists "product_reviews_write_own" on public.product_reviews;
create policy "product_reviews_write_own"
  on public.product_reviews for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "product_reviews_update_own" on public.product_reviews;
create policy "product_reviews_update_own"
  on public.product_reviews for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "product_reviews_delete_own" on public.product_reviews;
create policy "product_reviews_delete_own"
  on public.product_reviews for delete to authenticated
  using (user_id = (select auth.uid()));

-- --- "Bleres i verifikuar" -------------------------------------------
-- Vendoset nga serveri, jo nga klienti: perndryshe cilido do ta dergonte
-- si true.
create or replace function public.product_review_mark_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
begin
  new.verified_purchase := exists (
    select 1
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.user_id = new.user_id
      and oi.product_id = new.product_id
  );
  new.updated_at := now();
  return new;
end
$fn$;

drop trigger if exists product_reviews_verify on public.product_reviews;
create trigger product_reviews_verify
  before insert or update on public.product_reviews
  for each row execute function public.product_review_mark_verified();

-- --- Mesatarja mbahet te `products` ----------------------------------
-- Keshtu lista dhe kartelat nuk kane nevoje te numerojne cdo here.
create or replace function public.product_reviews_refresh_aggregate()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  target uuid := coalesce(new.product_id, old.product_id);
begin
  update public.products p
  set rating = coalesce((select round(avg(r.rating)::numeric, 1) from public.product_reviews r where r.product_id = target), 0),
      review_count = (select count(*) from public.product_reviews r where r.product_id = target)
  where p.id = target;
  return null;
end
$fn$;

drop trigger if exists product_reviews_aggregate on public.product_reviews;
create trigger product_reviews_aggregate
  after insert or update or delete on public.product_reviews
  for each row execute function public.product_reviews_refresh_aggregate();
