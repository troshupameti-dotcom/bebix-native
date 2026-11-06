-- Kthimi mbrapa i 20261105160000_feeding_subcategories_restructure.sql.
--
-- Ky skedar rri jashtë `supabase/migrations`, që të mos ekzekutohet vetë. Hapet te SQL Editor vetëm nëse duhet.
--
-- Çfarë bën:
--   * Nëntë nënkategoritë marrin emrat, çelësat, fjalët e kërkimit dhe renditjen e vjetër.
--   * Produktet kthehen te nënkategoria që kishin para migrimit.
--   * Produktet e reja, të krijuara pasi u ekzekutua migrimi, mbeten te kategoria por pa nënkategori.
--   * "Shishet" dhe "Të tjera" hiqen, sepse i krijoi migrimi dhe s'kanë ekzistuar më parë.
--
-- Mbeten pa u prekur: kolonat `slug` dhe `image_url`, funksioni `shop_category_tree` dhe tabelat rezervë. S'pengojnë
-- asgjë, dhe tabelat rezervë lejojnë ta riekzekutosh migrimin më vonë. Webi vazhdon të punojë: nënkategoritë pa
-- produkte i tregon si "Së shpejti".
--
-- I sigurt për t'u ekzekutuar dy herë.

begin;

do $$
begin
  if not exists (select 1 from public.subcategories_backup_20261105) then
    raise exception 'Rezerva është bosh: migrimi s''është ekzekutuar, s''ka çfarë të kthehet.';
  end if;
end;
$$;

-- Së pari produktet: ato të krijuara më vonë mbeten pa nënkategori, që të mos humbasin kur hiqen dy rreshtat e rinj.
update public.products p
set subcategory_id = null
from public.subcategories s
join public.categories c on c.id = s.category_id
where p.subcategory_id = s.id
  and c.key = 'Ushqyerje'
  and s.key in ('shishet', 'te-tjera');

update public.products p
set subcategory_id = b.subcategory_id
from public.products_subcategory_backup_20261105 b
where p.id = b.product_id
  and p.subcategory_id is distinct from b.subcategory_id;

delete from public.subcategories s
using public.categories c
where c.id = s.category_id
  and c.key = 'Ushqyerje'
  and s.key in ('shishet', 'te-tjera')
  and not exists (select 1 from public.subcategories_backup_20261105 b where b.id = s.id);

update public.subcategories s
set key = b.key,
    label = b.label,
    label_en = b.label_en,
    icon = b.icon,
    synonyms = b.synonyms,
    sort_order = b.sort_order
from public.subcategories_backup_20261105 b
where s.id = b.id;

commit;
