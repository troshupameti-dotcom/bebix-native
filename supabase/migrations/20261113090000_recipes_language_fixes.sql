-- Recetat 🥣: shqip standard dhe i njësuar te 18 receta.
-- "purè" → "pure" (drejtshkrimi shqip s'ka "è"), "zemër" → "vakt i lehtë", "muffina" → "mafina", "mbysin" → "mbytin",
-- "e kremtë" → "kremoze".
-- I sigurt për t'u ekzekutuar dy herë: çdo fushë ndryshon vetëm kur ka ende tekstin e vjetër, ndaj ndryshimet e adminit
-- te paneli s'preken dhe ekzekutimi i dytë s'bën asgjë. Nuk fshin asgjë.
-- Kërkon migrimet 20261110090100_recipes_library_1 dhe 20261112090100_recipes_library_2.
-- Kthimi, vetëm nëse e do: të njëjtat update, me tekstin e ri dhe të vjetër të ndërruar.

update public.recipes set summary = $s$Kungull dhe dardhë të pjekura bashkë në furrë: ëmbëlsi e natyrshme, pure për lugë ose shirita të butë për duart e vogla.$s$
  where slug = 'kungull-i-pjekur-me-dardhe' and summary = $s$Kungull dhe dardhë të pjekura bashkë në furrë: ëmbëlsi e natyrshme, purè për lugë ose shirita të butë për duart e vogla.$s$;

update public.recipes set steps = array[$s$Ngroh furrën në 200°C. Qëroje kungullin, hiqi farat dhe priteje në feta sa gishti, rreth 1,5 cm të trasha.$s$, $s$Qëroje dardhën, hiqi farat dhe priteje në katër.$s$, $s$Vendosi në tavë me letër pjekjeje, lyeji me pak vaj ulliri dhe piqi 30–35 minuta, derisa piruni të hyjë lehtë deri në fund.$s$, $s$Për pure: shtypi me pirun ose bluaji, duke shtuar pak ujë të zier, derisa të jetë e lëmuar.$s$, $s$Për BLW: lëri shiritat e kungullit të ftohen. Duhet të shtypen lehtë mes gishtit të madh dhe treguesit.$s$]::text[]
  where slug = 'kungull-i-pjekur-me-dardhe' and steps = array[$s$Ngroh furrën në 200°C. Qëroje kungullin, hiqi farat dhe priteje në feta sa gishti, rreth 1,5 cm të trasha.$s$, $s$Qëroje dardhën, hiqi farat dhe priteje në katër.$s$, $s$Vendosi në tavë me letër pjekjeje, lyeji me pak vaj ulliri dhe piqi 30–35 minuta, derisa piruni të hyjë lehtë deri në fund.$s$, $s$Për purè: shtypi me pirun ose bluaji, duke shtuar pak ujë të zier, derisa të jetë e lëmuar.$s$, $s$Për BLW: lëri shiritat e kungullit të ftohen. Duhet të shtypen lehtë mes gishtit të madh dhe treguesit.$s$]::text[];

update public.recipes set serve_by_age = $s${"6-8":"Pure e lëmuar me lugë, ose shirita të butë sa gishti i një të rrituri, pa lëkurë.","9-11":"Copa të vogla sa një kokërr fasule, që i kap me dy gishta, ose pure më e trashë.","12+":"Copa me pirun, ose si pjatë anësore për gjithë familjen."}$s$::jsonb
  where slug = 'kungull-i-pjekur-me-dardhe' and serve_by_age = $s${"6-8":"Purè e lëmuar me lugë, ose shirita të butë sa gishti i një të rrituri, pa lëkurë.","9-11":"Copa të vogla sa një kokërr fasule, që i kap me dy gishta, ose purè më e trashë.","12+":"Copa me pirun, ose si pjatë anësore për gjithë familjen."}$s$::jsonb;

update public.recipes set freezer_note = $s$Pureja ngrihet në kallëpe akulli deri në 3 muaj. Shiritat ngriji veç e veç në tabaka, pastaj fute në qese.$s$
  where slug = 'kungull-i-pjekur-me-dardhe' and freezer_note = $s$Purèja ngrihet në kallëpe akulli deri në 3 muaj. Shiritat ngriji veç e veç në tabaka, pastaj fute në qese.$s$;

update public.recipes set summary = $s$Pureja e parë klasike: e butë, e ëmbël dhe e lehtë për t'u bërë në sasi të madhe.$s$
  where slug = 'karote-dhe-patate-ne-avull' and summary = $s$Purèja e parë klasike: e butë, e ëmbël dhe e lehtë për t'u bërë në sasi të madhe.$s$;

update public.recipes set serve_by_age = $s${"6-8":"Pure e lëmuar, ose shirita karote të zier mirë sa gishti, që shtypen mes gishtave.","9-11":"E shtypur me pirun me copëza të vogla, ose kubikë të butë sa një bizele e madhe.","12+":"Copa të ziera me pak vaj ulliri, si pjatë anësore."}$s$::jsonb
  where slug = 'karote-dhe-patate-ne-avull' and serve_by_age = $s${"6-8":"Purè e lëmuar, ose shirita karote të zier mirë sa gishti, që shtypen mes gishtave.","9-11":"E shtypur me pirun me copëza të vogla, ose kubikë të butë sa një bizele e madhe.","12+":"Copa të ziera me pak vaj ulliri, si pjatë anësore."}$s$::jsonb;

update public.recipes set family_tip = $s$Ziej më shumë karota dhe patate: për të rriturit bëhen pure me kripë dhe gjalpë, ose sallatë me limon.$s$
  where slug = 'karote-dhe-patate-ne-avull' and family_tip = $s$Ziej më shumë karota dhe patate: për të rriturit bëhen purè me kripë dhe gjalpë, ose sallatë me limon.$s$;

update public.recipes set summary = $s$Pure e ngrohtë dhe e pasur me hekur. Thjerrëzat e kuqe ziejnë shpejt dhe s'kanë nevojë të lagen.$s$
  where slug = 'thjerreza-te-kuqe-me-karote' and summary = $s$Purè e ngrohtë dhe e pasur me hekur. Thjerrëzat e kuqe ziejnë shpejt dhe s'kanë nevojë të lagen.$s$;

update public.recipes set serve_by_age = $s${"6-8":"Pure e lëmuar me lugë, aq e hollë sa të rrjedhë ngadalë nga luga.","9-11":"Më e trashë, me oriz të zier, ose e lyer hollë mbi shirita buke të thekur.","12+":"Si supë e trashë, me një lugë kos sipër."}$s$::jsonb
  where slug = 'thjerreza-te-kuqe-me-karote' and serve_by_age = $s${"6-8":"Purè e lëmuar me lugë, aq e hollë sa të rrjedhë ngadalë nga luga.","9-11":"Më e trashë, me oriz të zier, ose e lyer hollë mbi shirita buke të thekur.","12+":"Si supë e trashë, me një lugë kos sipër."}$s$::jsonb;

update public.recipes set serve_by_age = $s${"6-8":"Pure e lëmuar me lugë. Për BLW: një copë kofshe pule e zier, sa gishti, që bebja ta thithë dhe ta kafshojë.","9-11":"E shtypur me pirun, me copëza të vogla pule të grira imët.","12+":"Copa të vogla pule me oriz dhe karota, si gjella e familjes."}$s$::jsonb
  where slug = 'pule-me-oriz-dhe-karote' and serve_by_age = $s${"6-8":"Purè e lëmuar me lugë. Për BLW: një copë kofshe pule e zier, sa gishti, që bebja ta thithë dhe ta kafshojë.","9-11":"E shtypur me pirun, me copëza të vogla pule të grira imët.","12+":"Copa të vogla pule me oriz dhe karota, si gjella e familjes."}$s$::jsonb;

update public.recipes set title = $s$Fasule të bardha pure$s$
  where slug = 'fasule-te-bardha-pure' and title = $s$Fasule të bardha purè$s$;

update public.recipes set steps = array[$s$Mbaji fasulet në ujë gjithë natën. Në mëngjes hidhe ujin dhe shpëlaji.$s$, $s$Zieji me ujë të freskët, me karotën dhe qepën, 50–60 minuta, derisa fasulet të shtypen lehtë mes dy gishtave.$s$, $s$Hiqi nga zjarri dhe kulloji, duke ruajtur pak nga uji i gatimit.$s$, $s$Bluaji me vajin e ullirit dhe me aq ujë gatimi sa të bëhen pure e lëmuar. Për bebet e vogla kaloje edhe nga sita, që të hiqen lëkurat.$s$]::text[]
  where slug = 'fasule-te-bardha-pure' and steps = array[$s$Mbaji fasulet në ujë gjithë natën. Në mëngjes hidhe ujin dhe shpëlaji.$s$, $s$Zieji me ujë të freskët, me karotën dhe qepën, 50–60 minuta, derisa fasulet të shtypen lehtë mes dy gishtave.$s$, $s$Hiqi nga zjarri dhe kulloji, duke ruajtur pak nga uji i gatimit.$s$, $s$Bluaji me vajin e ullirit dhe me aq ujë gatimi sa të bëhen purè e lëmuar. Për bebet e vogla kaloje edhe nga sita, që të hiqen lëkurat.$s$]::text[];

update public.recipes set serve_by_age = $s${"6-8":"Pure e lëmuar dhe e hollë, me lugë, pa lëkurat e fasuleve.","9-11":"Fasule të plota, shumë të buta, të shtypura pak me pirun, që i kap vetë.","12+":"Si fasulja e familjes, me perime dhe bukë."}$s$::jsonb
  where slug = 'fasule-te-bardha-pure' and serve_by_age = $s${"6-8":"Purè e lëmuar dhe e hollë, me lugë, pa lëkurat e fasuleve.","9-11":"Fasule të plota, shumë të buta, të shtypura pak me pirun, që i kap vetë.","12+":"Si fasulja e familjes, me perime dhe bukë."}$s$::jsonb;

update public.recipes set summary = $s$Mëngjes ose vakt i lehtë pa gatim: kos i plotë pa sheqer, me frutën e stinës të shtypur.$s$
  where slug = 'kos-me-fruta-te-stines' and summary = $s$Mëngjes ose zemër pa gatim: kos i plotë pa sheqer, me frutën e stinës të shtypur.$s$;

update public.recipes set serve_by_age = $s${"6-8":"Pure e lëmuar, ose feta të pjekura pa lëkurë që shtypen mes gishtave.","9-11":"Copa të buta sa një kokërr fasule, ose pure me kos.","12+":"Me kos të plotë ose me qull tërshëre."}$s$::jsonb
  where slug = 'molle-ose-ftua-i-pjekur-me-kanelle' and serve_by_age = $s${"6-8":"Purè e lëmuar, ose feta të pjekura pa lëkurë që shtypen mes gishtave.","9-11":"Copa të buta sa një kokërr fasule, ose purè me kos.","12+":"Me kos të plotë ose me qull tërshëre."}$s$::jsonb;

update public.recipes set freezer_note = $s$Pureja ngrihet deri në 3 muaj.$s$
  where slug = 'molle-ose-ftua-i-pjekur-me-kanelle' and freezer_note = $s$Purèja ngrihet deri në 3 muaj.$s$;

update public.recipes set summary = $s$Mish viçi i grirë, i zier me kungull të njomë dhe patate: pure e butë me shumë hekur.$s$
  where slug = 'vic-i-grire-me-kungull-te-njome' and summary = $s$Mish viçi i grirë, i zier me kungull të njomë dhe patate: purè e butë me shumë hekur.$s$;

update public.recipes set serve_by_age = $s${"6-8":"Pure e lëmuar me lugë.","9-11":"E shtypur me pirun, me mish të grirë imët, ose me makarona të vogla.","12+":"Si salcë mishi mbi makarona ose oriz."}$s$::jsonb
  where slug = 'vic-i-grire-me-kungull-te-njome' and serve_by_age = $s${"6-8":"Purè e lëmuar me lugë.","9-11":"E shtypur me pirun, me mish të grirë imët, ose me makarona të vogla.","12+":"Si salcë mishi mbi makarona ose oriz."}$s$::jsonb;

update public.recipes set serve_by_age = $s${"9-11":"Biskota të zgjatura e të buta, që i mban vetë.","12+":"Si vakt i lehtë, me kos ose fruta."}$s$::jsonb
  where slug = 'biskota-tershere-me-banane-dhe-kikirik' and serve_by_age = $s${"9-11":"Biskota të zgjatura e të buta, që i mban vetë.","12+":"Si zemër, me kos ose fruta."}$s$::jsonb;

update public.recipes set title = $s$Mafina me vezë dhe perime$s$
  where slug = 'muffina-veze-me-perime' and title = $s$Muffina veze me perime$s$;

update public.recipes set summary = $s$Vezë me perime të grira, të pjekura në kallëpe mafinash. Mëngjes i gatshëm për tri ditë, ose për çantën e kopshtit.$s$
  where slug = 'muffina-veze-me-perime' and summary = $s$Vezë me perime të grira, të pjekura në kallëpe muffinash. Mëngjes i gatshëm për tri ditë, ose për çantën e kopshtit.$s$;

update public.recipes set yield_note = $s$6 mafina$s$
  where slug = 'muffina-veze-me-perime' and yield_note = $s$6 muffina$s$;

update public.recipes set steps = array[$s$Ngroh furrën në 180°C dhe lyej me vaj 6 kallëpe mafinash.$s$, $s$Grii perimet shumë imët. Kungullin e njomë rrendë dhe shtrydhe nga uji.$s$, $s$Rrih vezët me qumështin dhe përziej perimet.$s$, $s$Mbushi kallëpet deri në tre të katërtat dhe piqi 18–20 minuta, derisa të fryhen dhe mesi të jetë gatuar plotësisht.$s$]::text[]
  where slug = 'muffina-veze-me-perime' and steps = array[$s$Ngroh furrën në 180°C dhe lyej me vaj 6 kallëpe muffinash.$s$, $s$Grii perimet shumë imët. Kungullin e njomë rrendë dhe shtrydhe nga uji.$s$, $s$Rrih vezët me qumështin dhe përziej perimet.$s$, $s$Mbushi kallëpet deri në tre të katërtat dhe piqi 18–20 minuta, derisa të fryhen dhe mesi të jetë gatuar plotësisht.$s$]::text[];

update public.recipes set serve_by_age = $s${"12+":"Mafina e prerë në katër, ose e plotë për ta mbajtur vetë."}$s$::jsonb
  where slug = 'muffina-veze-me-perime' and serve_by_age = $s${"12+":"Muffin i prerë në katër, ose i plotë për ta mbajtur vetë."}$s$::jsonb;

update public.recipes set summary = $s$Fruta të stinës të prera në masën e duhur, me kos të plotë pa sheqer. Vakti i lehtë më i shpejtë i ditës.$s$
  where slug = 'sallate-frutash-me-kos' and summary = $s$Fruta të stinës të prera në masën e duhur, me kos të plotë pa sheqer. Zemra më e shpejtë e ditës.$s$;

update public.recipes set choking_note = $s$Rrushi i plotë është ndër ushqimet që mbytin më shpesh fëmijët deri në 5 vjeç: prite gjithmonë për së gjati në katërsh.$s$
  where slug = 'sallate-frutash-me-kos' and choking_note = $s$Rrushi i plotë është ndër ushqimet që mbysin më shpesh fëmijët deri në 5 vjeç: prite gjithmonë për së gjati në katërsh.$s$;

update public.recipes set title = $s$Pure patate e ëmbël me mollë$s$
  where slug = 'pure-patate-e-embel-me-molle' and title = $s$Purè patate e ëmbël me mollë$s$;

update public.recipes set summary = $s$Patatja e ëmbël dhe molla e zier japin një pure të lëmuar, të ëmbël vetvetiu, pa sheqer.$s$
  where slug = 'pure-patate-e-embel-me-molle' and summary = $s$Patatja e ëmbël dhe molla e zier japin një purè të lëmuar, të ëmbël vetvetiu, pa sheqer.$s$;

update public.recipes set steps = array[$s$Qëroje pataten e ëmbël dhe mollën dhe prit në kubikë të vegjël.$s$, $s$Zieji në avull ose në pak ujë 20–25 minuta, derisa të shtypen lehtë me pirun.$s$, $s$Bluaji me pak nga uji i zierjes, derisa pureja të jetë e lëmuar. Shto kanellën nëse e do.$s$]::text[]
  where slug = 'pure-patate-e-embel-me-molle' and steps = array[$s$Qëroje pataten e ëmbël dhe mollën dhe prit në kubikë të vegjël.$s$, $s$Zieji në avull ose në pak ujë 20–25 minuta, derisa të shtypen lehtë me pirun.$s$, $s$Bluaji me pak nga uji i zierjes, derisa purèja të jetë e lëmuar. Shto kanellën nëse e do.$s$]::text[];

update public.recipes set title = $s$Pure lulelakre me thjerrëza të kuqe$s$
  where slug = 'pure-lulelakre-me-thjerreza-te-kuqe' and title = $s$Purè lulelakre me thjerrëza të kuqe$s$;

update public.recipes set summary = $s$Thjerrëzat e kuqe zihen shpejt dhe i japin hekur kësaj pureje të butë me lulelakër dhe patate.$s$
  where slug = 'pure-lulelakre-me-thjerreza-te-kuqe' and summary = $s$Thjerrëzat e kuqe zihen shpejt dhe i japin hekur kësaj purèje të butë me lulelakër dhe patate.$s$;

update public.recipes set title = $s$Pure panxhari me karotë dhe patate$s$
  where slug = 'pure-panxhari-me-karote-dhe-patate' and title = $s$Purè panxhari me karotë dhe patate$s$;

update public.recipes set summary = $s$Një pure me ngjyrë të fortë: panxhar, karotë dhe patate të ziera, me pak vaj ulliri.$s$
  where slug = 'pure-panxhari-me-karote-dhe-patate' and summary = $s$Një purè me ngjyrë të fortë: panxhar, karotë dhe patate të ziera, me pak vaj ulliri.$s$;

update public.recipes set title = $s$Pure gjeldeti me brokoli dhe patate$s$
  where slug = 'pure-gjeldeti-me-brokoli-dhe-patate' and title = $s$Purè gjeldeti me brokoli dhe patate$s$;

update public.recipes set summary = $s$Mish gjeldeti i zier plotësisht, me brokoli dhe patate: hekur dhe proteina në një pure të butë.$s$
  where slug = 'pure-gjeldeti-me-brokoli-dhe-patate' and summary = $s$Mish gjeldeti i zier plotësisht, me brokoli dhe patate: hekur dhe proteina në një purè të butë.$s$;

update public.recipes set serve_by_age = $s${"9-11":"Qofte e zgjatur sa gishti, e butë, që shtypet me gishta.","12+":"Qofte e prerë në copa të vogla, me oriz ose pure."}$s$::jsonb
  where slug = 'qofte-gjeldeti-me-spinaq' and serve_by_age = $s${"9-11":"Qofte e zgjatur sa gishti, e butë, që shtypet me gishta.","12+":"Qofte e prerë në copa të vogla, me oriz ose purè."}$s$::jsonb;

update public.recipes set steps = array[$s$Prite kungullin në kubikë, ziej 15 minuta derisa të jetë shumë i butë, kulloje dhe shtype.$s$, $s$Përziej purenë e kungullit me vezën, tërshërën dhe kanellën; lëre 5 minuta të trashet.$s$, $s$Ngroh një tigan që nuk ngjit, me pak vaj, në zjarr mesatar.$s$, $s$Hidh nga një lugë gjelle brumë dhe gatuaj 3 minuta nga çdo anë, derisa veza të jetë gatuar plotësisht edhe në mes.$s$]::text[]
  where slug = 'petulla-kungulli-me-tershere' and steps = array[$s$Prite kungullin në kubikë, ziej 15 minuta derisa të jetë shumë i butë, kulloje dhe shtype.$s$, $s$Përziej purènë e kungullit me vezën, tërshërën dhe kanellën; lëre 5 minuta të trashet.$s$, $s$Ngroh një tigan që nuk ngjit, me pak vaj, në zjarr mesatar.$s$, $s$Hidh nga një lugë gjelle brumë dhe gatuaj 3 minuta nga çdo anë, derisa veza të jetë gatuar plotësisht edhe në mes.$s$]::text[];

update public.recipes set summary = $s$Makarona të vogla me salcë të butë lulelakre dhe djathi: kremoze, të ngrohta dhe me kalcium.$s$
  where slug = 'makarona-me-lulelaker-dhe-djathe' and summary = $s$Makarona të vogla me salcë të butë lulelakre dhe djathi: e kremtë, e ngrohtë dhe me kalcium.$s$;
