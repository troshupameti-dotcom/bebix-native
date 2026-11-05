-- Kategoria "Ushqyerja" bëhet "Ushqyerja & Qetësimi" (5 nëntor 2026).
--
-- Brenda saj ka edhe produkte që s'janë ushqim: biberonët qetësues, dhe më vonë kafshueset për daljen e dhëmbëve.
-- "Qetësimi" i mbulon këto (në anglisht "Feeding & Soothing", emër i zakonshëm te dyqanet e bebeve), dhe "&" ndjek
-- kategoritë e tjera ("Higjiena & Kujdesi", "Lodra & Zhvillim").
--
-- Ndryshon vetëm emri që shfaqet. Çelësi mbetet "Ushqyerje": e përdorin lidhjet (?cat=Ushqyerje), nënkategoritë dhe
-- renditja sipas moshës. Emri ndryshon vetëm nëse është ende njëri nga dy emrat e vjetër, që një emër i vendosur nga
-- admini te paneli të mos mbishkruhet. I sigurt për t'u ekzekutuar dy herë.

update public.categories
set label = 'Ushqyerja & Qetësimi',
    label_en = 'Feeding & Soothing'
where key = 'Ushqyerje'
  and label in ('Ushqyerje', 'Ushqyerja');
