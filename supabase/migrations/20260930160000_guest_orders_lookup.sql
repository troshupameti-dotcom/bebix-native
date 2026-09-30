-- Mysafiri e shikon porosinë edhe pasi del dhe kthehet.
--
-- Mysafiri s'ka llogari, prandaj RLS s'ia lejon leximin e porosive. Në vend
-- të kësaj, pas porosisë telefoni (ose shfletuesi) ruan numrat e porosive.
-- Numri është uuid i krijuar nga serveri (gen_random_uuid), pra s'hamendësohet:
-- kush e ka, është ai që e bëri porosinë. Funksioni kthen VETËM porosi pa
-- llogari (user_id është null), kurrë të atyre që kanë llogari.

create or replace function public.get_guest_orders(p_ids uuid[])
returns table (
  id uuid,
  created_at timestamptz,
  status text,
  total_price numeric,
  full_name text,
  phone text,
  address text,
  city text,
  items jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.created_at, o.status::text, o.total_price, o.full_name, o.phone, o.address, o.city, o.items
  from public.orders o
  where o.user_id is null
    and o.id = any (p_ids[1:50])
  order by o.created_at desc
  limit 50;
$$;

revoke execute on function public.get_guest_orders(uuid[]) from public;
grant execute on function public.get_guest_orders(uuid[]) to anon, authenticated, service_role;
