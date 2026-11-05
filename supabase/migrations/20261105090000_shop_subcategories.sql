-- Nënkategoritë e dyqanit (p.sh. Ushqyerja → Biberonët, Thithkat, Gjidhënia…), për webin dhe app-in.
--
-- Si funksionon:
--   * Tabela e re `subcategories`: çdo nënkategori i përket një kategorie, ka emër shqip/anglisht dhe
--     "fjalë të tjera" (synonyms) që prindërit shkruajnë te kërkimi (cucla, duda, flashë…).
--   * `products.subcategory_id` (kolonë e re, mund të jetë bosh). `category_id` mbetet si ishte: app-et e vjetra
--     dhe çdo filtër i sotëm sipas kategorisë vazhdojnë njësoj. Një trigger e mban kategorinë në një mendje me
--     nënkategorinë (zgjedh nënkategorinë → kategoria vendoset vetë; ndryshon kategorinë → nënkategoria e huaj hiqet).
--   * `shop_subcategories(kategoria)`: nënkategoritë që KANË produkte aktive, me numrin dhe një foto produkti për
--     çipin. Nënkategoritë bosh s'dalin kurrë te dyqani (një filtër që kthen "0 produkte" e lodh blerësin).
--   * `shop_product_order` merr `p_subcategory` (në fund, me vlerë bosh: thirrjet e vjetra punojnë) dhe kërkimi gjen
--     edhe sipas nënkategorisë dhe fjalëve të saj, pa dallim ë/e dhe ç/c ("thithese" gjen "Thithëse").
--   * `products.search_text`: emri pa shkronja të mëdha dhe pa ë/ç, që edhe webi të kërkojë pa dallim ë/e.
--
-- I sigurt për t'u ekzekutuar dy herë. Nuk fshin kolona, tabela ose të dhëna. Kërkon migrimin
-- 20261021090100_age_system_02_shop.sql (funksioni `shop_age_rank`).

-- ---------------------------------------------------------------------------
-- 1. Tabela e nënkategorive
-- ---------------------------------------------------------------------------
create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  key text not null,
  label text not null,
  label_en text,
  icon text not null default '',
  synonyms text[] not null default '{}',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint subcategories_key_format check (key ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint subcategories_label_len check (char_length(trim(label)) between 1 and 60),
  constraint subcategories_category_key unique (category_id, key)
);

create index if not exists subcategories_category_sort_idx on public.subcategories (category_id, sort_order);

alter table public.subcategories enable row level security;

drop policy if exists subcategories_public_read on public.subcategories;
create policy subcategories_public_read on public.subcategories for select using (true);
drop policy if exists subcategories_admin_insert on public.subcategories;
create policy subcategories_admin_insert on public.subcategories for insert with check ((select public.is_admin()));
drop policy if exists subcategories_admin_update on public.subcategories;
create policy subcategories_admin_update on public.subcategories for update using ((select public.is_admin())) with check ((select public.is_admin()));
drop policy if exists subcategories_admin_delete on public.subcategories;
create policy subcategories_admin_delete on public.subcategories for delete using ((select public.is_admin()));

-- Nga 30 tetori 2026 tabelat e reja s'marrin më leje vetë (RLS-ja më lart vendos kush shkruan).
grant select on public.subcategories to anon, authenticated;
grant insert, update, delete on public.subcategories to authenticated;
grant all on public.subcategories to service_role;

-- ---------------------------------------------------------------------------
-- 2. Produktet: nënkategoria dhe teksti i kërkimit
-- ---------------------------------------------------------------------------
alter table public.products add column if not exists subcategory_id uuid references public.subcategories(id) on delete set null;
create index if not exists products_subcategory_idx on public.products (subcategory_id) where subcategory_id is not null;

-- Emri pa shkronja të mëdha dhe pa ë/ç: "Thithëse" → "thithese". Prindërit shpesh shkruajnë pa ë dhe ç.
alter table public.products add column if not exists search_text text
  generated always as (translate(lower(name), 'ëçËÇ', 'ecec')) stored;

-- Kategoria dhe nënkategoria s'mund të bien ndesh.
create or replace function public.products_subcategory_sync()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and new.category_id is distinct from old.category_id
     and new.subcategory_id is not distinct from old.subcategory_id then
    -- U ndërrua vetëm kategoria: nënkategoria e vjetër, nëse s'i përket kategorisë së re, hiqet.
    if new.subcategory_id is not null and not exists (
      select 1 from public.subcategories s where s.id = new.subcategory_id and s.category_id is not distinct from new.category_id
    ) then
      new.subcategory_id := null;
    end if;
  elsif new.subcategory_id is not null then
    -- U zgjodh nënkategoria: kategoria merret prej saj.
    select s.category_id into new.category_id from public.subcategories s where s.id = new.subcategory_id;
  end if;
  return new;
end;
$$;

drop trigger if exists products_subcategory_sync on public.products;
create trigger products_subcategory_sync
  before insert or update of category_id, subcategory_id on public.products
  for each row execute function public.products_subcategory_sync();

-- ---------------------------------------------------------------------------
-- 3. Nënkategoritë e një kategorie, vetëm ato me produkte, me numrin dhe një foto
-- ---------------------------------------------------------------------------
create or replace function public.shop_subcategories(p_category text)
returns table (id uuid, key text, label text, label_en text, icon text, sort_order integer, product_count bigint, cover_url text)
language sql
stable
set search_path = public
as $$
  select s.id, s.key, s.label, s.label_en, s.icon, s.sort_order,
         count(p.id) as product_count,
         -- Fotoja e çipit: një produkt në stok, më i riu; pa foto, emoji-ja e nënkategorisë.
         (array_agg(p.image_url order by (p.stock > 0) desc, p.created_at desc) filter (where p.image_url is not null))[1] as cover_url
  from public.subcategories s
  join public.categories c on c.id = s.category_id
  left join public.products p on p.subcategory_id = s.id and p.is_active = true
  where c.key = p_category
  group by s.id
  having count(p.id) > 0
  order by s.sort_order, s.label;
$$;

revoke execute on function public.shop_subcategories(text) from public;
grant execute on function public.shop_subcategories(text) to anon, authenticated, service_role;

-- Nënkategoritë që i përgjigjen një fjale kërkimi (emri ose fjalët e tjera), pa dallim ë/e, ç/c.
-- Webi e përdor për ta shtuar te kërkimi i vet; `shop_product_order` bën të njëjtën gjë brenda.
create or replace function public.shop_subcategory_match(p_search text)
returns setof uuid
language sql
stable
set search_path = public
as $$
  with term as (select translate(lower(trim(coalesce(p_search, ''))), 'ëçËÇ', 'ecec') as t)
  select s.id
  from public.subcategories s, term
  where char_length(term.t) >= 3
    and (translate(lower(s.label), 'ëçËÇ', 'ecec') like '%' || term.t || '%'
         or exists (
           select 1 from unnest(s.synonyms) syn
           where translate(lower(syn), 'ëçËÇ', 'ecec') like '%' || term.t || '%'
              or (char_length(syn) >= 4 and term.t like '%' || translate(lower(syn), 'ëçËÇ', 'ecec') || '%')
         ));
$$;

revoke execute on function public.shop_subcategory_match(text) from public;
grant execute on function public.shop_subcategory_match(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Renditja e dyqanit me nënkategorinë dhe kërkimin e ri
-- ---------------------------------------------------------------------------
-- Versioni i vjetër (10 parametra) hiqet që thirrjet me emra të mos kenë dy funksione për të zgjedhur; i riu ka
-- të njëjtët parametra me të njëjtat vlera bosh, plus `p_subcategory` në fund.
drop function if exists public.shop_product_order(text, uuid, boolean, text, text, numeric, numeric, boolean, integer, integer);

create or replace function public.shop_product_order(
  p_category text default null,
  p_brand uuid default null,
  p_on_sale boolean default false,
  p_search text default null,
  p_sort text default 'newest',
  p_age_from numeric default null,
  p_age_to numeric default null,
  p_pregnancy boolean default false,
  p_offset integer default 0,
  p_limit integer default 20,
  p_subcategory text default null
)
returns table (product_id uuid, pos integer, total_count bigint)
language sql
stable
set search_path = public
as $$
  with term as (
    select nullif(translate(lower(trim(coalesce(p_search, ''))), 'ëçËÇ', 'ecec'), '') as t
  ),
  matched_subs as (
    select sid from public.shop_subcategory_match(p_search) as m(sid)
  ),
  base as (
    select p.id, p.name, p.price, p.rating, p.created_at,
           public.shop_age_rank(p.min_age_months, p.max_age_months, c.key, p_age_from, p_age_to, coalesce(p_pregnancy, false)) as rnk,
           case
             when (select t from term) is null then 0
             when p.search_text like (select t from term) || '%' then 0
             when p.search_text like '%' || (select t from term) || '%' then 1
             when p.subcategory_id in (select sid from matched_subs) then 2
             else 3
           end as relevance
    from public.products p
    left join public.categories c on c.id = p.category_id
    left join public.subcategories s on s.id = p.subcategory_id
    left join public.brands b on b.id = p.brand_id
    where p.is_active = true
      and (p_category is null or p_category = 'all' or c.key = p_category)
      and (p_subcategory is null or s.key = p_subcategory)
      and (p_brand is null or p.brand_id = p_brand)
      and (not coalesce(p_on_sale, false) or p.compare_at_price is not null)
      and ((select t from term) is null
           or p.search_text like '%' || (select t from term) || '%'
           or translate(lower(b.name), 'ëçËÇ', 'ecec') like '%' || (select t from term) || '%'
           or p.subcategory_id in (select sid from matched_subs))
  ),
  ordered as (
    select id,
           row_number() over (
             order by
               relevance,
               rnk,
               case when p_sort = 'priceAsc' then price end asc nulls last,
               case when p_sort = 'priceDesc' then price end desc nulls last,
               case when p_sort = 'rating' then rating end desc nulls last,
               case when p_sort not in ('priceAsc', 'priceDesc', 'rating') or p_sort is null then created_at end desc nulls last,
               id
           )::int as pos,
           count(*) over () as total_count
    from base
  )
  select id, pos, total_count
  from ordered
  order by pos
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

revoke execute on function public.shop_product_order(text, uuid, boolean, text, text, numeric, numeric, boolean, integer, integer, text) from public;
grant execute on function public.shop_product_order(text, uuid, boolean, text, text, numeric, numeric, boolean, integer, integer, text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Ushqyerja: emri, nënkategoritë dhe produktet ekzistuese
-- ---------------------------------------------------------------------------
-- Emrat vijnë nga kërkimi i 5 nëntorit 2026 (dyqane në Kosovë, Shqipëri e Maqedoni, marka dhe dyqane të mëdha,
-- fjalorë dhe tekste shëndetësore):
--   * "Ushqyerja" (veprimtari, trajtë e shquar, si "Gjumi"). Çelësi "Ushqyerje" mbetet: e përdorin lidhjet e
--     dyqanit, app-et e instaluara dhe renditja sipas moshës.
--   * "Biberon" në Shqipëri është shishja, në Kosovë thithka ose qetësuesi; prandaj s'del vetëm si emër. "Shishe"
--     kuptohet njësoj kudo. Qetësuesi quhet "biberon qetësues" në të dyja vendet. "Thithëse" s'është fjalë për bebe.
--   * Fjalët e rrugës (cucëll, çuça, memë, mashtrues, rrens…) s'dalin te menyja, por gjenden te kërkimi.
--     Jashtë fjalëve: "thithëse" (në Prishtinë: aspirator hundësh) dhe "bibs" (markë qetësuesish, jo përparëse).
--   * Qetësuesit (bashkë me mbajtëset) rrinë te Ushqyerja, si te dyqanet me shumë marka në Kosovë, Shqipëri e
--     Maqedoni: me dy produkte, një kategori më vete do të ishte bosh. Kur qetësuesit, mbajtëset dhe kafshueset
--     arrijnë rreth 10 produkte, mund të dalin më vete pa ndryshuar asgjë te produktet.
--   * Emrat: veprimtaritë në trajtën e shquar (Ushqyerja, Gjidhënia, Dalja e dhëmbëve), grupet e produkteve në
--     shumës (Sterilizues dhe ngrohës, Gota dhe enë).
--   * Nëntë nënkategori (Baymard: mbi ~10 e humbasin blerësin). Ato pa produkte s'dalin te dyqani. Materiali,
--     rrjedhja e thithkës ose madhësia janë filtra të ardhshëm, jo nënkategori.
update public.categories set label = 'Ushqyerja' where key = 'Ushqyerje' and label = 'Ushqyerje';

insert into public.subcategories (category_id, key, label, label_en, icon, synonyms, sort_order)
select c.id, v.key, v.label, v.label_en, v.icon, v.synonyms, v.sort_order
from public.categories c
cross join (values
  ('shishe-thithka', 'Shishe dhe thithka', 'Bottles & teats', '🍼',
    array['biberon', 'biberona', 'biberonë', 'shishe', 'shishja', 'shishe qumështi', 'flashë', 'thithkë', 'thithka',
          'kokë biberoni', 'biberonët', 'gojëz', 'rrjedhje', 'anti-kolike', 'bottle', 'teat', 'nipple'], 10),
  ('gjidhenia', 'Gjidhënia', 'Breastfeeding', '🤱',
    array['gji', 'gjidhënie', 'mëkim', 'ushqyerja me gji', 'pompë gjiri', 'pompa gjiri', 'pompë qumështi', 'jastëkë gjiri',
          'thithka gjiri', 'mbrojtëse thithkash', 'mburojë gjiri', 'qese qumështi', 'ruajtja e qumështit', 'breast pump'], 20),
  ('sterilizues-ngrohes', 'Sterilizues dhe ngrohës', 'Sterilisers & warmers', '♨️',
    array['sterilizues', 'sterilizator', 'sterilizim', 'ngrohës', 'ngrohëse', 'ngrohës shishesh', 'ngrohës biberoni',
          'furçë shishesh', 'tharëse', 'pastrim shishesh', 'steriliser', 'warmer'], 30),
  ('biberone-qetesues', 'Biberonë qetësues', 'Pacifiers', '👶',
    array['biberon', 'biberon qetësues', 'qetësues', 'cucëll', 'cuçell', 'cucla', 'cuca', 'çuça', 'cuco', 'memë',
          'mashtrues', 'rrens', 'gënjeshtar', 'dudë', 'duda', 'kapëse biberoni', 'zinxhir biberoni', 'mbajtëse çuçi',
          'pacifier', 'soother', 'dummy'], 40),
  ('gota-ene', 'Gota dhe enë', 'Cups & tableware', '🥣',
    array['gotë', 'gotë me pipë', 'gotë stërvitëse', 'shishe uji', 'pipë', 'filxhan', 'pjatë', 'pjatë me ndarje', 'tas',
          'lugë', 'pirun', 'enë', 'sippy'], 50),
  ('dalja-e-dhembeve', 'Dalja e dhëmbëve', 'Teething', '🦷',
    array['dhëmbëzim', 'dhëmbët e parë', 'kafshuese', 'unazë dhëmbësh', 'lodër për dhëmbë', 'furçë dhëmbësh',
          'xhel për mishrat', 'higjiena orale', 'teether'], 60),
  ('perparese', 'Përparëse', 'Bibs', '🧣',
    array['gushore', 'përparëse', 'jakë'], 70),
  ('karrige-ushqimi', 'Karrige ushqimi', 'High chairs', '🪑',
    array['karrige e lartë', 'karrige për ushqim', 'karrige ushqyerje', 'karrige bebeje', 'high chair', 'booster'], 80),
  ('pergatitja-e-ushqimit', 'Përgatitja e ushqimit', 'Food preparation', '🥕',
    array['mikser ushqimi', 'blender', 'përgatitës ushqimi', 'avullues', 'pure', 'kavanoz', 'enë ruajtjeje',
          'ruajtja e ushqimit', 'food maker'], 90)
) as v(key, label, label_en, icon, synonyms, sort_order)
where c.key = 'Ushqyerje'
on conflict (category_id, key) do nothing;

-- Tetë produktet e sotme, secili te nënkategoria e vet (vetëm ato pa nënkategori: s'prek zgjedhjet e adminit).
update public.products p
set subcategory_id = s.id
from public.subcategories s
join public.categories c on c.id = s.category_id
where c.key = 'Ushqyerje'
  and p.subcategory_id is null
  and (p.id, s.key) in (values
    ('94ab0f18-91ee-419d-a87f-a8a95776a0c9'::uuid, 'shishe-thithka'),      -- Thithka anti-kolike, rrjedhje 3
    ('4bc4dd08-fe29-4cb2-bb03-0b42d3025019'::uuid, 'gjidhenia'),           -- Pompë elektrike gjiri Natural Motion
    ('86859dd3-d6a4-49cc-a3b9-f515cfd40480'::uuid, 'gjidhenia'),           -- Enë për qumështin e gjirit
    ('978c1aeb-9af7-4e00-8392-be431f4213f5'::uuid, 'sterilizues-ngrohes'), -- Ngrohëse shishesh Kidwell 4 në 1
    ('713d6083-e8c4-427e-9ff4-d327d6aed9ee'::uuid, 'sterilizues-ngrohes'), -- Qese sterilizimi për mikrovalë
    ('4f1b956d-0bd7-484a-8ab6-ff1eb6e57ce4'::uuid, 'biberone-qetesues'),   -- (Thithëse) nate Signature
    ('132e83b3-1396-41a1-b49c-1c6ff9edb0d0'::uuid, 'biberone-qetesues'),   -- (Thithëse) silikoni, 0–6 muaj
    ('c1420c1f-0066-4d3c-8143-920863e0ece4'::uuid, 'gota-ene')             -- Shishe uji Mini-Me Sip
  );

-- "Thithëse" s'është fjalë për bebe (në fjalor: letër thithëse, pompë; në Prishtinë: aspirator hundësh): dy
-- qetësuesit marrin emrin që kuptohet njësoj në Kosovë dhe Shqipëri.
-- Vetëm nëse emri është ende ai i vjetri (s'prek një emër që admini e ka ndryshuar vetë).
update public.products set name = 'Biberon qetësues nate Signature, 2 copë'
where id = '4f1b956d-0bd7-484a-8ab6-ff1eb6e57ce4' and name = 'Thithëse nate Signature, 2 copë';
update public.products set name = 'Biberon qetësues silikoni, 0–6 muaj'
where id = '132e83b3-1396-41a1-b49c-1c6ff9edb0d0' and name = 'Thithëse silikoni, 0–6 muaj';
