-- Nënkategoritë e "Ushqyerja & Qetësimi" bëhen 11, me emrat dhe renditjen e kërkuar (5 nëntor 2026), dhe të dhënat
-- plotësohen që webi të tregojë të gjitha nënkategoritë, edhe ato ende pa produkte.
--
-- Si funksionon:
--   * Asnjë rresht s'fshihet. Nëntë nënkategoritë ekzistuese riemërtohen (id-ja mbetet, ndaj produktet që s'ndërrojnë
--     grup s'preken fare), dhe shtohen vetëm dy të reja: "Shishet" dhe "Të tjera".
--   * Para çdo ndryshimi, nënkategoritë dhe lidhjet e produkteve kopjohen te dy tabela rezervë. Kthimi mbrapa është te
--     supabase/rollbacks/20261105160000_feeding_subcategories_restructure_rollback.sql.
--   * `subcategories.image_url`: foto e zgjedhur për nënkategorinë (bosh = fotoja e produktit më të ri, si deri tani).
--   * `categories.slug`: adresa e kategorisë pa ë dhe ç (`?cat=ushqyerja-qetesimi`). Çelësi `key` mbetet si është: e
--     përdorin app-et e instaluara, nënkategoritë dhe renditja sipas moshës.
--   * `shop_category_tree()`: i ri, vetëm për webin: të gjitha kategoritë me totalin dhe nënkategoritë e tyre, edhe ato
--     pa produkte. `shop_subcategories` s'ndryshon: app-i vazhdon të shohë vetëm ato me produkte.
--
-- Vendosja e produkteve:
--   * "Biberonë qetësues"        -> "Biberon qetësues"
--   * "Shishe dhe thithka"       -> thithkat te "Biberonët (thithkat)", shishet te "Shishet"
--   * "Gjidhënia"                -> "Kujdesi gjatë gjidhënie"
--   * "Gota dhe enë"             -> gotat te "Gotat", enët te "Ushqyerja"
--   * "Sterilizues dhe ngrohës"  -> "Ushqyerja"
--   * Çdo produkt që s'përshtatet qartë, ose që s'ka nënkategori -> "Të tjera"
--     (sot vetëm "Shishe uji Mini-Me Sip": është shishe uji, as gotë as enë).
--   Rregullat lexojnë emrin e produktit, që edhe produktet e shtuara para ekzekutimit të shkojnë në vendin e duhur.
--
-- Fjalët e kërkimit (cucla, duda, flashë…) kalojnë te nënkategoria e re, që kërkimi të mos humbasë asgjë. Ato të
-- përparëseve, karrigeve dhe përgatitjes së ushqimit kalojnë te "Ushqyerja".
--
-- Lidhjet e vjetra (`?sub=gota-ene`) çojnë te e gjithë kategoria, jo te një faqe bosh.
--
-- I sigurt për t'u ekzekutuar dy herë: rezervat s'mbishkruhen dhe çdo riemërtim kërkon çelësin e vjetër.
-- Në fund del lista e produkteve te "Të tjera". Nëse një produkt humbet, gjithçka anulohet.

begin;

-- Sa produkte ka kategoria para ndryshimit: kontrolli në fund e krahason me këtë.
create temporary table feeding_products_before on commit drop as
select count(*) as total
from public.products p
join public.categories c on c.id = p.category_id
where c.key = 'Ushqyerje';

-- ---------------------------------------------------------------------------
-- 1. Kolonat e reja
-- ---------------------------------------------------------------------------
alter table public.subcategories add column if not exists image_url text;
alter table public.categories add column if not exists slug text;

update public.categories c
set slug = v.slug
from (values
  ('Ushqyerje', 'ushqyerja-qetesimi'),
  ('veshje', 'veshje-per-bebe'),
  ('gjumi', 'gjumi'),
  ('Higjiena & Kujdesi', 'higjiena-kujdesi'),
  ('Karroca & Transport', 'karroca-transport'),
  ('Lodra & Zhvillim', 'lodra-zhvillim'),
  ('Dhoma e bebit', 'dhoma-e-bebit'),
  ('Për nënën', 'per-nenen'),
  ('Dhurata për bebe', 'dhurata-per-bebe'),
  ('shkolla', 'shkolla'),
  ('lodra-edukative', 'lodra-edukative'),
  ('veshje-femije', 'veshje-per-femije')
) as v(key, slug)
where c.key = v.key
  and c.slug is null;

alter table public.categories drop constraint if exists categories_slug_format;
alter table public.categories add constraint categories_slug_format check (slug is null or slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$');
create unique index if not exists categories_slug_key on public.categories (slug) where slug is not null;

-- ---------------------------------------------------------------------------
-- 2. Rezervat për kthimin mbrapa (vetëm herën e parë: një ekzekutim i dytë s'i prek)
-- ---------------------------------------------------------------------------
create table if not exists public.subcategories_backup_20261105 (
  id uuid primary key,
  category_id uuid not null,
  key text not null,
  label text not null,
  label_en text,
  icon text not null,
  synonyms text[] not null,
  sort_order integer not null,
  backed_up_at timestamptz not null default now()
);

create table if not exists public.products_subcategory_backup_20261105 (
  product_id uuid primary key,
  subcategory_id uuid,
  backed_up_at timestamptz not null default now()
);

-- Tabela të brendshme: pa politika RLS, ndaj as anon as authenticated s'i lexojnë.
alter table public.subcategories_backup_20261105 enable row level security;
alter table public.products_subcategory_backup_20261105 enable row level security;
grant all on public.subcategories_backup_20261105 to service_role;
grant all on public.products_subcategory_backup_20261105 to service_role;

insert into public.subcategories_backup_20261105 (id, category_id, key, label, label_en, icon, synonyms, sort_order)
select s.id, s.category_id, s.key, s.label, s.label_en, s.icon, s.synonyms, s.sort_order
from public.subcategories s
join public.categories c on c.id = s.category_id
where c.key = 'Ushqyerje'
  and not exists (select 1 from public.subcategories_backup_20261105 b)
on conflict (id) do nothing;

insert into public.products_subcategory_backup_20261105 (product_id, subcategory_id)
select p.id, p.subcategory_id
from public.products p
join public.categories c on c.id = p.category_id
where c.key = 'Ushqyerje'
  and not exists (select 1 from public.products_subcategory_backup_20261105 b)
on conflict (product_id) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Nënkategoritë: riemërtimi dhe dy të rejat
-- ---------------------------------------------------------------------------
-- Dy nënkategoritë e reja hyjnë të parat: produktet e "Shishe dhe thithka" dhe "Gota dhe enë" kanë nevojë për to.
insert into public.subcategories (category_id, key, label, label_en, icon, synonyms, sort_order)
select c.id, v.key, v.label, v.label_en, v.icon, v.synonyms, v.sort_order
from public.categories c
cross join (values
  ('shishet', 'Shishet', 'Bottles', '🍼',
    array['biberon', 'biberona', 'biberonë', 'shishe', 'shishja', 'shishe qumështi', 'flashë', 'anti-kolike', 'bottle'], 30),
  ('te-tjera', 'Të tjera', 'Other', '🧺', array[]::text[], 110)
) as v(key, label, label_en, icon, synonyms, sort_order)
where c.key = 'Ushqyerje'
on conflict (category_id, key) do nothing;

-- Produktet që s'u takojnë grupit të ri, para se të ndërrojë emri (rregullat lexojnë `search_text`: pa ë/ç).
update public.products p
set subcategory_id = target.id
from public.subcategories old, public.subcategories target, public.categories c
where p.subcategory_id = old.id
  and old.category_id = c.id
  and target.category_id = c.id
  and c.key = 'Ushqyerje'
  and old.key = 'shishe-thithka'
  and p.search_text !~ 'thithk'
  and target.key = case when p.search_text ~ '\m(shishe|shishja|biberon)' then 'shishet' else 'te-tjera' end;

update public.products p
set subcategory_id = target.id
from public.subcategories old, public.subcategories target, public.categories c
where p.subcategory_id = old.id
  and old.category_id = c.id
  and target.category_id = c.id
  and c.key = 'Ushqyerje'
  and old.key = 'gota-ene'
  and p.search_text !~ '\mgot[aeë]'
  and target.key = case
    when p.search_text ~ '\m(pjate|pjata|tas|tasi|luge|luga|pirun|ene|enet)\M' then 'sterilizues-ngrohes'
    else 'te-tjera'
  end;

-- Një produkt pa nënkategori s'duhet të humbasë nga rrjeti.
update public.products p
set subcategory_id = target.id
from public.subcategories target, public.categories c
where p.category_id = c.id
  and target.category_id = c.id
  and c.key = 'Ushqyerje'
  and target.key = 'te-tjera'
  and p.subcategory_id is null;

update public.subcategories s
set key = v.new_key,
    label = v.label,
    label_en = v.label_en,
    icon = v.icon,
    synonyms = v.synonyms,
    sort_order = v.sort_order
from public.categories c
cross join (values
  ('biberone-qetesues', 'biberon-qetesues', 'Biberon qetësues', 'Soothers', '👶',
    array['biberon', 'biberon qetësues', 'qetësues', 'cucëll', 'cuçell', 'cucla', 'cuca', 'çuça', 'cuco', 'memë',
          'mashtrues', 'rrens', 'gënjeshtar', 'dudë', 'duda', 'pacifier', 'soother', 'dummy'], 10),
  ('perparese', 'setet', 'Setet', 'Sets', '🎁',
    array['set', 'sete', 'set biberonësh', 'set për të porsalindur', 'set dhuratë', 'starter set', 'gift set'], 20),
  ('shishe-thithka', 'biberonet-thithkat', 'Biberonët (thithkat)', 'Teats', '🍼',
    array['biberonët', 'thithkë', 'thithka', 'kokë biberoni', 'gojëz', 'rrjedhje', 'anti-kolike', 'teat', 'nipple'], 40),
  ('gota-ene', 'gotat', 'Gotat', 'Cups', '🥤',
    array['gotë', 'gota', 'gotë me pipë', 'gotë stërvitëse', 'pipë', 'filxhan', 'shishe uji', 'sippy', 'cup'], 50),
  ('karrige-ushqimi', 'kapese-per-biberon', 'Kapëse për biberon', 'Soother clips', '🧷',
    array['kapëse biberoni', 'kapëse', 'zinxhir biberoni', 'mbajtëse biberoni', 'mbajtëse çuçi', 'pacifier clip'], 60),
  ('dalja-e-dhembeve', 'aksesore-per-dhembezim', 'Aksesorë për dhëmbëzim', 'Teething accessories', '🦷',
    array['dhëmbëzim', 'dhëmbët e parë', 'dalja e dhëmbëve', 'kafshuese', 'unazë dhëmbësh', 'lodër për dhëmbë',
          'xhel për mishrat', 'teether'], 70),
  ('pergatitja-e-ushqimit', 'higjiena-orale', 'Higjiena orale', 'Oral care', '🪥',
    array['higjiena orale', 'furçë dhëmbësh', 'furçë gishti', 'pastë dhëmbësh', 'pastrim goje', 'oral care'], 80),
  ('gjidhenia', 'kujdesi-gjate-gjidhenie', 'Kujdesi gjatë gjidhënie', 'Breastfeeding care', '🤱',
    array['gji', 'gjidhënie', 'gjidhënia', 'mëkim', 'ushqyerja me gji', 'pompë gjiri', 'pompa gjiri', 'pompë qumështi',
          'jastëkë gjiri', 'thithka gjiri', 'mbrojtëse thithkash', 'mburojë gjiri', 'qese qumështi',
          'ruajtja e qumështit', 'breast pump'], 90),
  ('sterilizues-ngrohes', 'ushqyerja', 'Ushqyerja', 'Feeding', '🥣',
    array['ushqyerja', 'ushqyerje', 'sterilizues', 'sterilizator', 'sterilizim', 'ngrohës', 'ngrohëse', 'ngrohës shishesh',
          'ngrohës biberoni', 'furçë shishesh', 'tharëse', 'pastrim shishesh', 'steriliser', 'warmer',
          'enë', 'pjatë', 'pjatë me ndarje', 'tas', 'lugë', 'pirun',
          'gushore', 'përparëse', 'jakë', 'karrige e lartë', 'karrige për ushqim', 'karrige ushqyerje', 'karrige bebeje',
          'high chair', 'booster', 'mikser ushqimi', 'blender', 'përgatitës ushqimi', 'avullues', 'pure', 'kavanoz',
          'enë ruajtjeje', 'ruajtja e ushqimit', 'food maker'], 100)
) as v(old_key, new_key, label, label_en, icon, synonyms, sort_order)
where c.key = 'Ushqyerje'
  and s.category_id = c.id
  and s.key = v.old_key;

-- ---------------------------------------------------------------------------
-- 4. Pema e kategorive për webin
-- ---------------------------------------------------------------------------
-- Një rresht për çdo nënkategori. Kategoria pa nënkategori del me një rresht ku `id` është bosh, që totali të arrijë
-- gjithsesi te dyqani. Numrat janë vetëm të produkteve të publikuara (`is_active`).
create or replace function public.shop_category_tree()
returns table (
  category_key text,
  category_total bigint,
  id uuid,
  key text,
  label text,
  label_en text,
  icon text,
  sort_order integer,
  product_count bigint,
  cover_url text
)
language sql
stable
set search_path = public
as $$
  with totals as (
    select p.category_id, count(*) as total
    from public.products p
    where p.is_active = true
    group by p.category_id
  ),
  subs as (
    select s.id, s.category_id, s.key, s.label, s.label_en, s.icon, s.sort_order, s.image_url,
           count(p.id) as product_count,
           -- Fotoja: së pari ajo e nënkategorisë; pastaj një produkt në stok, më i riu.
           (array_agg(p.image_url order by (p.stock > 0) desc, p.created_at desc) filter (where p.image_url is not null))[1] as product_image
    from public.subcategories s
    left join public.products p on p.subcategory_id = s.id and p.is_active = true
    group by s.id
  )
  select c.key, coalesce(t.total, 0), s.id, s.key, s.label, s.label_en, s.icon, s.sort_order,
         coalesce(s.product_count, 0), coalesce(s.image_url, s.product_image)
  from public.categories c
  left join totals t on t.category_id = c.id
  left join subs s on s.category_id = c.id
  order by c.sort_order, s.sort_order, s.label;
$$;

revoke execute on function public.shop_category_tree() from public;
grant execute on function public.shop_category_tree() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Kontrolli: asnjë produkt s'humbet
-- ---------------------------------------------------------------------------
do $$
declare
  missing integer;
  before_total bigint;
  after_total bigint;
begin
  select total into before_total from feeding_products_before;
  select count(*) into after_total
  from public.products p
  join public.categories c on c.id = p.category_id
  where c.key = 'Ushqyerje';

  if after_total <> before_total then
    raise exception 'Migrimi u ndal: kategoria kishte % produkte, tani ka %.', before_total, after_total;
  end if;

  -- Çdo produkt i kategorisë duhet të ketë një nënkategori të kategorisë së vet.
  select count(*) into missing
  from public.products p
  join public.categories c on c.id = p.category_id
  left join public.subcategories s on s.id = p.subcategory_id and s.category_id = p.category_id
  where c.key = 'Ushqyerje'
    and s.id is null;

  if missing > 0 then
    raise exception 'Migrimi u ndal: % produkte mbetën pa nënkategori të vlefshme.', missing;
  end if;

  select count(*) into missing
  from public.subcategories s
  join public.categories c on c.id = s.category_id
  where c.key = 'Ushqyerje';

  if missing <> 11 then
    raise exception 'Migrimi u ndal: Ushqyerja ka % nënkategori në vend të 11.', missing;
  end if;
end;
$$;

commit;

-- Produktet që shkuan te "Të tjera".
select p.id, p.name, p.is_active
from public.products p
join public.subcategories s on s.id = p.subcategory_id
join public.categories c on c.id = s.category_id
where c.key = 'Ushqyerje'
  and s.key = 'te-tjera'
order by p.name;
