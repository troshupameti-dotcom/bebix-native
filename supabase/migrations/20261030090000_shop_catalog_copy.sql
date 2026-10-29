-- Katalogu i Dyqanit: emra të saktë, përshkrime të plota dhe çmime sipas tregut (30 tetor 2026).
--
-- Emrat e mëparshëm ishin të gabuar disa herë: thithëset NUK quheshin "Biberon", pompa elektrike
-- "Pomp gjiri mekanike", ngrohësja Kidwell ishte lidhur me Philips Avent, shishja NUK Mini-Me (9+ muaj)
-- kishte moshën 0–2 muaj. Çmimet u krahasuan me dyqanet në BE (tetor 2026) dhe u rrumbullakuan për Kosovën.
--
-- Vetëm UPDATE sipas id-së: ekzekutimi i dytë jep të njëjtin rezultat, asgjë s'fshihet, stoku s'preket.
-- Nëse një produkt mungon (p.sh. bazë e re), rreshti s'ndryshon asgjë.

begin;

-- Philips Avent: enë për qumështin e gjirit (SCF618/10)
update public.products set
  name = 'Enë për qumështin e gjirit, 10 × 180 ml',
  brand_id = (select id from public.brands where name = 'Philips Avent' limit 1),
  description = 'Dhjetë enë 180 ml me kapak që mbyllet mirë, për ta ruajtur qumështin e gjirit në frigorifer ose në ngrirës. Me përshtatësin që vjen në paketim, qumështi nxirret drejt në enë me pompat Philips Avent, pa e derdhur nga një enë në tjetrën. Enët shënohen me datë, vendosen njëra mbi tjetrën dhe zënë pak vend. Kur bebja nis ushqimin e ngurtë, shërbejnë edhe për pure. Pa BPA.',
  price = 18.90,
  compare_at_price = null
where id = '86859dd3-d6a4-49cc-a3b9-f515cfd40480';

-- NUK Mini-Me Sip 300 ml (9+ muaj)
update public.products set
  name = 'Shishe uji Mini-Me Sip, 300 ml',
  description = 'Shishja e parë e ujit për fëmijët nga 9 muaj, me grykë të butë që nuk derdhet edhe kur shishja përmbyset. Kapaku mbrojtës e mban grykën të pastër në çantë. Është e lehtë dhe e hollë, që duart e vogla ta mbajnë vetë. Me material eko, pa BPA.',
  price = 9.90,
  compare_at_price = 12.90,
  min_age_months = '9'::jsonb,
  max_age_months = '36'::jsonb
where id = 'c1420c1f-0066-4d3c-8143-920863e0ece4';

-- Philips Avent: qese sterilizimi për mikrovalë (SCF297/05)
update public.products set
  name = 'Qese sterilizimi për mikrovalë, 5 copë',
  description = 'Pesë qese të ripërdorshme që sterilizojnë me avull biberonat, thithkat, thithëset dhe pjesët e pompës në furrën me mikrovalë. Shtoni pak ujë, mbyllni qesen dhe ngroheni sipas udhëzimeve: avulli eliminon 99,9% të mikrobeve. Secila qese përdoret deri në 20 herë (100 sterilizime gjithsej). Të holla dhe të lehta, të përshtatshme për udhëtime.',
  price = 12.90,
  compare_at_price = null
where id = '713d6083-e8c4-427e-9ff4-d327d6aed9ee';

-- Philips Avent: pompë elektrike e gjirit (SCF395/31)
update public.products set
  name = 'Pompë elektrike gjiri Natural Motion',
  description = 'Pompë elektrike me teknologjinë Natural Motion, që imiton ritmin e thithjes së bebes dhe ndihmon që qumështi të rrjedhë më shpejt. Jastëku i butë prej silikoni përshtatet me madhësi të ndryshme të gjirit dhe lejon pompimin ulur drejt, pa u përkulur përpara. Motori është i qetë dhe nivelet e stimulimit e të nxjerrjes rregullohen me një prekje. Në paketim: pompa, shishe Natural 125 ml dhe mbulesa gjiri. Ka pak pjesë, ndaj pastrohet shpejt.',
  price = 129.00,
  compare_at_price = null
where id = '4bc4dd08-fe29-4cb2-bb03-0b42d3025019';

-- Kidwell: ngrohëse shishesh 4 në 1 (nuk është Philips Avent; Kidwell s'ka ende markë në katalog)
update public.products set
  name = 'Ngrohëse shishesh Kidwell 4 në 1',
  brand_id = null,
  description = 'Ngrohëse me ekran dixhital dhe komanda me prekje, që e ngroh qumështin në temperaturën e duhur. Katër funksione në një pajisje: ngrohje e qumështit, ngrohje e ushqimit për bebe, shkrirje e qumështit të ngrirë dhe sterilizim me avull. Përshtatet me shumicën e shisheve, edhe me ato me grykë të gjerë. Natën qumështi bëhet gati pa pritur.',
  price = 39.90,
  compare_at_price = null
where id = '978c1aeb-9af7-4e00-8392-be431f4213f5';

-- NUK: thithëse silikoni 0–6 muaj
update public.products set
  name = 'Thithëse silikoni, 0–6 muaj',
  description = 'Thithëse NUK me formë ortodontike, e rrafshët poshtë dhe e lakuar sipër, e projektuar për zhvillimin e natyrshëm të gojës dhe të nofullës. Silikon i butë, pa shije dhe pa erë. Mburoja ka vrima ajrimi, që lëkura rreth gojës të mos mbetet e lagur. Për bebet 0–6 muaj; pa BPA. Ndërrojeni çdo 1–2 muaj.',
  price = 4.90,
  compare_at_price = null,
  min_age_months = '0'::jsonb,
  max_age_months = '6'::jsonb
where id = '132e83b3-1396-41a1-b49c-1c6ff9edb0d0';

-- NUK Signature Night 6–18 muaj, 2 copë
update public.products set
  name = 'Thithëse nate Signature, 2 copë',
  description = 'Dy thithëse nate me dorezë që shkëlqen në errësirë, që t''i gjeni shpejt natën pa ndezur dritën. Formë ortodontike NUK prej silikoni të butë, me mburojë të lakuar dhe vrima ajrimi. Për bebet 6–18 muaj; pa BPA. Lahen me ujë të nxehtë dhe mund të sterilizohen. Ndërrojini çdo 1–2 muaj.',
  price = 7.90,
  compare_at_price = null,
  min_age_months = '6'::jsonb,
  max_age_months = '18'::jsonb
where id = '4f1b956d-0bd7-484a-8ab6-ff1eb6e57ce4';

-- Philips Avent: thithka anti-kolike, rrjedhje 3 (SCY763/02)
update public.products set
  name = 'Thithka anti-kolike, rrjedhje 3, 2 copë',
  description = 'Dy thithka për shishet Philips Avent Anti-colic, me rrjedhje 3 për bebet nga 3 muaj. Valvula anti-kolike e çon ajrin në shishe dhe jo në barkun e bebes, gjë që ndihmon kundër kolikave dhe shqetësimeve të barkut. Silikon i butë, pa BPA. Ndërrojini çdo 3 muaj ose më herët nëse dëmtohen.',
  price = 6.90,
  compare_at_price = null,
  min_age_months = '3'::jsonb,
  max_age_months = '6'::jsonb
where id = '94ab0f18-91ee-419d-a87f-a8a95776a0c9';

commit;
