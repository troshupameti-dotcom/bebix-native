-- Lista e dhuratave: prindi bën një listë me produkte dhe e ndan me një lidhje; të afërmit e shohin pa llogari
-- dhe rezervojnë një dhuratë (që dy vetë të mos blejnë të njëjtën), ose e shtojnë në shportë.
-- Të gjitha janë shtesa (tabela dhe funksione të reja); nuk ndryshojnë asnjë të dhënë ekzistuese.

begin;

-- 1) Lista: një për përdorues. `slug` është pjesa e lidhjes publike (e pamundur për t'u hamendësuar).
create table if not exists public.gift_lists (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users (id) on delete cascade,
  slug text not null unique default substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 10)
    check (slug ~ '^[a-z0-9]{8,12}$'),
  title text not null default 'Lista e dhuratave' check (char_length(title) between 2 and 80),
  message text check (char_length(message) <= 500),
  created_at timestamptz not null default now()
);

create table if not exists public.gift_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.gift_lists (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  qty int not null default 1 check (qty between 1 and 20),
  reserved_qty int not null default 0 check (reserved_qty >= 0),
  created_at timestamptz not null default now(),
  unique (list_id, product_id),
  check (reserved_qty <= qty)
);

create table if not exists public.gift_reservations (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.gift_list_items (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  qty int not null check (qty between 1 and 20),
  created_at timestamptz not null default now()
);

create index if not exists gift_list_items_list_idx on public.gift_list_items (list_id);
create index if not exists gift_reservations_item_idx on public.gift_reservations (item_id);

-- 2) RLS: vetëm pronari e prek listën e vet. Vizitorët kalojnë vetëm përmes funksioneve më poshtë.
alter table public.gift_lists enable row level security;
alter table public.gift_list_items enable row level security;
alter table public.gift_reservations enable row level security;

drop policy if exists gift_lists_owner on public.gift_lists;
create policy gift_lists_owner on public.gift_lists
  for all to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));

drop policy if exists gift_items_owner on public.gift_list_items;
create policy gift_items_owner on public.gift_list_items
  for all to authenticated
  using (exists (select 1 from public.gift_lists l where l.id = list_id and l.owner_id = (select auth.uid())))
  with check (exists (select 1 from public.gift_lists l where l.id = list_id and l.owner_id = (select auth.uid())));

-- Pronari i sheh rezervimet e listës së vet dhe mund t'i heqë (p.sh. kur dikush e pranon që nuk e bleu).
drop policy if exists gift_reservations_owner_read on public.gift_reservations;
create policy gift_reservations_owner_read on public.gift_reservations
  for select to authenticated
  using (exists (
    select 1 from public.gift_list_items i join public.gift_lists l on l.id = i.list_id
    where i.id = item_id and l.owner_id = (select auth.uid())));

drop policy if exists gift_reservations_owner_delete on public.gift_reservations;
create policy gift_reservations_owner_delete on public.gift_reservations
  for delete to authenticated
  using (exists (
    select 1 from public.gift_list_items i join public.gift_lists l on l.id = i.list_id
    where i.id = item_id and l.owner_id = (select auth.uid())));

-- Kur hiqet një rezervim, sasia e rezervuar zbret.
create or replace function public.gift_reservation_released()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.gift_list_items set reserved_qty = greatest(0, reserved_qty - old.qty) where id = old.item_id;
  return old;
end;
$$;
revoke all on function public.gift_reservation_released() from public, anon, authenticated;

drop trigger if exists gift_reservation_released on public.gift_reservations;
create trigger gift_reservation_released after delete on public.gift_reservations
  for each row execute function public.gift_reservation_released();

-- 3) Lista publike për një lidhje: vetëm çfarë duhet të shohin të afërmit (pa emra rezervuesish).
create or replace function public.gift_list_public(p_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'title', l.title,
    'message', l.message,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'product_id', p.id, 'name', p.name, 'price', p.price, 'image_url', p.image_url,
        'qty', i.qty, 'reserved_qty', i.reserved_qty, 'active', p.is_active and p.stock > 0
      ) order by i.created_at)
      from public.gift_list_items i join public.products p on p.id = i.product_id
      where i.list_id = l.id), '[]'::jsonb)
  )
  from public.gift_lists l
  where l.slug = lower(btrim(p_slug));
$$;

-- 4) Rezervimi nga një i afërm (pa llogari): emri + sasia; kontrollon që ka mbetur.
create or replace function public.gift_reserve(p_slug text, p_item_id uuid, p_name text, p_qty int default 1)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := regexp_replace(btrim(coalesce(p_name, '')), '\s+', ' ', 'g');
  v_item public.gift_list_items%rowtype;
  v_list_id uuid;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception 'Shkruaj emrin tënd (2 deri në 60 shenja).';
  end if;
  if p_qty is null or p_qty < 1 or p_qty > 20 then
    raise exception 'Sasi e pavlefshme.';
  end if;

  select l.id into v_list_id from public.gift_lists l where l.slug = lower(btrim(p_slug));
  if v_list_id is null then
    raise exception 'Lista nuk u gjet.';
  end if;

  -- Mbrojtje nga abuzimi: jo më shumë se 30 rezervime në orë për një listë.
  if (select count(*) from public.gift_reservations r join public.gift_list_items i on i.id = r.item_id
      where i.list_id = v_list_id and r.created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Shumë rezervime për momentin. Provo përsëri pas pak.';
  end if;

  select * into v_item from public.gift_list_items where id = p_item_id and list_id = v_list_id for update;
  if v_item.id is null then
    raise exception 'Dhurata nuk u gjet te kjo listë.';
  end if;
  if v_item.qty - v_item.reserved_qty < p_qty then
    raise exception 'Kjo dhuratë është rezervuar tashmë.';
  end if;

  insert into public.gift_reservations (item_id, name, qty) values (v_item.id, v_name, p_qty);
  update public.gift_list_items set reserved_qty = reserved_qty + p_qty where id = v_item.id;
end;
$$;

-- 5) Të drejtat: tabelat vetëm për të loguarit (RLS); funksionet publike edhe për vizitorët.
revoke all on public.gift_lists, public.gift_list_items, public.gift_reservations from anon;
revoke all on function public.gift_list_public(text) from public;
grant execute on function public.gift_list_public(text) to anon, authenticated;
revoke all on function public.gift_reserve(text, uuid, text, int) from public;
grant execute on function public.gift_reserve(text, uuid, text, int) to anon, authenticated;

commit;
