-- Recetat e dimrit, 20 (të njëjtat si content/recipes/sq.json në app): 6 për 6–8 muaj, 6 për 9–11 muaj,
-- 5 për 12–24 muaj dhe 3 për 2–5 vjeç. Supa, qulla dhe tava të ngrohta me perime të stinës.
-- Pa kripë, pa sheqer e pa mjaltë; mishi, peshku dhe vezët të gatuar plotësisht.
-- I sigurt për t'u ekzekutuar dy herë: recetat që ekzistojnë (sipas slug) nuk preken, as ndryshimet e adminit.
-- Nuk fshin asgjë. Kërkon migrimin 20261110090000_recipes.sql.

insert into public.recipes (slug, language, title, summary, age_min_months, age_max_months, stage, feeding_style, meal_types, prep_minutes, cook_minutes, yield_note, family_factor, ingredients, steps, serve_by_age, allergens, diet_tags, nutrients, freezer_friendly, storage_note, freezer_note, reheat_note, choking_note, family_tip, season, is_albanian, cover_key, status, featured, sort_order, source)
values
(
  $s$pure-patate-e-embel-me-molle$s$, 'sq', $s$Purè patate e ëmbël me mollë$s$,
  $s$Patatja e ëmbël dhe molla e zier japin një purè të lëmuar, të ëmbël vetvetiu, pa sheqer.$s$,
  6, 24, 'pure', array['puree']::text[], array['breakfast', 'lunch']::text[], 10, 25,
  $s$4 porcione bebe$s$, 3,
  $s$[{"name":"patate e ëmbël","amount":1,"unit":"copë","food_key":"sweet_potato"},{"name":"mollë","amount":1,"unit":"copë","food_key":"apple"},{"name":"ujë","amount":60,"unit":"ml","food_key":null},{"name":"kanellë","amount":0.25,"unit":"lugë çaji","food_key":null,"optional":true}]$s$::jsonb,
  array[
    $s$Qëroje pataten e ëmbël dhe mollën dhe prit në kubikë të vegjël.$s$,
    $s$Zieji në avull ose në pak ujë 20–25 minuta, derisa të shtypen lehtë me pirun.$s$,
    $s$Bluaji me pak nga uji i zierjes, derisa purèja të jetë e lëmuar. Shto kanellën nëse e do.$s$
  ]::text[],
  $s${"6-8":"E lëmuar dhe e trashë, me lugë.","9-11":"E shtypur me pirun, me copëza të buta.","12+":"Si pjatë anësore, ose e përzier me kos për mëngjes."}$s$::jsonb,
  array[]::text[], array['vegetarian', 'dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['vitamin_c', 'fiber']::text[], true,
  $s$Në frigorifer deri në 3 ditë, në enë të mbyllur.$s$,
  $s$Në kallëpe akulli ose gota të vogla, deri në 3 muaj.$s$,
  $s$Ngroje mirë, përzieje dhe lëre të ftohet derisa të jetë e vakët.$s$,
  $s$Molla para 12 muajsh jepet gjithmonë e gatuar; bluaje mirë, që të mos mbeten copa të forta.$s$,
  $s$Piq më shumë patate të ëmbla: të rriturit i hanë me vaj ulliri dhe erëza.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-orange', 'published', false, 410, 'editor'
),
(
  $s$pure-lulelakre-me-thjerreza-te-kuqe$s$, 'sq', $s$Purè lulelakre me thjerrëza të kuqe$s$,
  $s$Thjerrëzat e kuqe zihen shpejt dhe i japin hekur kësaj purèje të butë me lulelakër dhe patate.$s$,
  6, 24, 'pure', array['puree']::text[], array['lunch', 'dinner']::text[], 10, 25,
  $s$5 porcione bebe$s$, 3,
  $s$[{"name":"thjerrëza të kuqe","amount":50,"unit":"g","food_key":"red_lentils"},{"name":"lulelakër","amount":150,"unit":"g","food_key":"cauliflower"},{"name":"patate","amount":1,"unit":"copë","food_key":"potato"},{"name":"vaj ulliri","amount":1,"unit":"lugë çaji","food_key":null},{"name":"ujë","amount":400,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Laji thjerrëzat derisa uji të dalë i pastër.$s$,
    $s$Hidhi në tenxhere me lulelakrën, pataten e prerë në kubikë dhe ujin. Zieji 20–25 minuta, derisa të gjitha të jenë shumë të buta.$s$,
    $s$Bluaji me vajin e ullirit. Shto pak ujë të ngrohtë nëse del shumë e trashë.$s$
  ]::text[],
  $s${"6-8":"E lëmuar, me lugë.","9-11":"E shtypur, me copëza të buta lulelakre.","12+":"Si supë e trashë, me bukë anash."}$s$::jsonb,
  array[]::text[], array['vegetarian', 'dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['iron', 'protein', 'fiber', 'vitamin_c']::text[], true,
  $s$Në frigorifer deri në 3 ditë.$s$,
  $s$Në porcione të vogla, deri në 3 muaj.$s$,
  $s$Ngroje derisa të avullojë, përzieje mirë dhe lëre të ftohet derisa të jetë e vakët.$s$,
  $s$Bluaje mirë: lulelakra e gatuar përgjysmë mund të mbetet e fortë.$s$,
  $s$Me hudhër, qimnon dhe limon, e njëjta tenxhere bëhet supë për të gjithë.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-yellow', 'published', false, 420, 'editor'
),
(
  $s$pure-panxhari-me-karote-dhe-patate$s$, 'sq', $s$Purè panxhari me karotë dhe patate$s$,
  $s$Një purè me ngjyrë të fortë: panxhar, karotë dhe patate të ziera, me pak vaj ulliri.$s$,
  6, 24, 'pure', array['puree']::text[], array['lunch', 'dinner']::text[], 10, 35,
  $s$4 porcione bebe$s$, 3,
  $s$[{"name":"panxhar","amount":1,"unit":"copë","food_key":"beetroot"},{"name":"karotë","amount":1,"unit":"copë","food_key":"carrot"},{"name":"patate","amount":1,"unit":"copë","food_key":"potato"},{"name":"vaj ulliri","amount":1,"unit":"lugë çaji","food_key":null},{"name":"ujë","amount":400,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Qëroji perimet dhe prit në kubikë të vegjël. Panxhari ngjyros: vish doreza nëse do.$s$,
    $s$Zieji 30–35 minuta, derisa panxhari të shtypet lehtë me pirun.$s$,
    $s$Bluaji me vajin e ullirit dhe pak ujë nga zierja.$s$
  ]::text[],
  $s${"6-8":"E lëmuar, me lugë.","9-11":"E shtypur, ose kubikë të butë sa maja e gishtit.","12+":"Kubikë të butë, si pjatë anësore."}$s$::jsonb,
  array[]::text[], array['vegetarian', 'dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['fiber', 'vitamin_c']::text[], true,
  $s$Në frigorifer deri në 3 ditë.$s$,
  $s$Në kallëpe akulli, deri në 3 muaj.$s$,
  $s$Ngroje mirë dhe lëre të ftohet derisa të jetë e vakët.$s$,
  $s$Karota dhe panxhari jepen të gatuar mirë, kurrë të papjekur.$s$,
  $s$Panxharin e tepërt e hanë të rriturit me kos dhe hudhër. Panxhari mund ta ngjyrosë rozë jashtëqitjen e bebit: kjo ndodh shpesh dhe kalon vetë.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-pink', 'published', false, 430, 'editor'
),
(
  $s$qull-tershere-me-dardhe$s$, 'sq', $s$Qull tërshëre me dardhë$s$,
  $s$Mëngjes i ngrohtë dimri: tërshërë e zier butë me dardhë të gatuar, pa sheqer.$s$,
  6, 36, 'pure', array['puree']::text[], array['breakfast']::text[], 5, 10,
  $s$2 porcione bebe$s$, 3,
  $s$[{"name":"tërshërë e bluar imët","amount":30,"unit":"g","food_key":"oats"},{"name":"ujë","amount":200,"unit":"ml","food_key":null},{"name":"dardhë","amount":1,"unit":"copë","food_key":"pear"},{"name":"qumësht gjiri, formulë ose ujë","amount":2,"unit":"lugë gjelle","food_key":null,"optional":true},{"name":"kanellë","amount":0.25,"unit":"lugë çaji","food_key":null,"optional":true}]$s$::jsonb,
  array[
    $s$Qëroje dardhën, prite në kubikë të vegjël dhe ziej 5 minuta me ujin.$s$,
    $s$Shto tërshërën dhe ziej edhe 5 minuta, duke e përzier, derisa të trashet.$s$,
    $s$Bluaje ose shtype dhe holloje me qumësht gjiri ose formulë. Lëre të ftohet derisa të jetë i vakët.$s$
  ]::text[],
  $s${"6-8":"I lëmuar, me lugë.","9-11":"Më i trashë, me copëza dardhe të buta.","12+":"Me copa dardhe dhe pak kos sipër."}$s$::jsonb,
  array[]::text[], array['vegetarian', 'dairy_free', 'egg_free', 'nut_free']::text[], array['fiber']::text[], false,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Nuk ngrihet mirë: tërshëra bëhet e ujshme. Gatuaje të freskët, zgjat vetëm 10 minuta.$s$,
  $s$Ngroje me pak ujë, përzieje mirë dhe provoje që të jetë i vakët.$s$,
  $s$Dardha e fortë jepet e gatuar; dardha e pjekur e butë mund të jepet e shtypur.$s$,
  $s$I njëjti qull është mëngjes edhe për të rriturit, me fruta dhe arra të grira në pjatën e tyre.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-white', 'published', false, 440, 'editor'
),
(
  $s$pure-gjeldeti-me-brokoli-dhe-patate$s$, 'sq', $s$Purè gjeldeti me brokoli dhe patate$s$,
  $s$Mish gjeldeti i zier plotësisht, me brokoli dhe patate: hekur dhe proteina në një purè të butë.$s$,
  6, 24, 'pure', array['puree']::text[], array['lunch', 'dinner']::text[], 10, 25,
  $s$5 porcione bebe$s$, 3,
  $s$[{"name":"mish gjeldeti pa lëkurë","amount":100,"unit":"g","food_key":"turkey"},{"name":"brokoli","amount":100,"unit":"g","food_key":"broccoli"},{"name":"patate","amount":1,"unit":"copë","food_key":"potato"},{"name":"qepë","amount":0.25,"unit":"copë","food_key":"onion"},{"name":"vaj ulliri","amount":1,"unit":"lugë çaji","food_key":null},{"name":"ujë","amount":400,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Prite mishin në kubikë të vegjël dhe ziej me qepën dhe ujin 15 minuta.$s$,
    $s$Shto pataten e prerë dhe brokolin dhe ziej edhe 10 minuta, derisa mishi të jetë gatuar plotësisht dhe perimet shumë të buta.$s$,
    $s$Bluaje me vajin e ullirit dhe pak lëng nga zierja, derisa të jetë e lëmuar.$s$
  ]::text[],
  $s${"6-8":"E lëmuar, me lugë.","9-11":"E shtypur, me mishin e grirë imët.","12+":"Copa të vogla mishi me perime, si pjatë e familjes."}$s$::jsonb,
  array[]::text[], array['dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['iron', 'protein', 'vitamin_c']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Në porcione të vogla, deri në 2 muaj.$s$,
  $s$Ngroje derisa të avullojë edhe në mes, përzieje dhe lëre të ftohet derisa të jetë e vakët.$s$,
  $s$Bluaje mirë: copat e mishit janë rrezik para se bebja të mësojë të përtypë.$s$,
  $s$Gjeldeti i zier me perime bëhet supë për të gjithë; të rriturit shtojnë erëza në pjatën e tyre.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-green', 'published', false, 450, 'editor'
),
(
  $s$merluc-me-patate-te-embel$s$, 'sq', $s$Merluc me patate të ëmbël$s$,
  $s$Peshk i bardhë i butë, i gatuar plotësisht në avull, me patate të ëmbël dhe pak limon.$s$,
  6, 24, 'pure', array['puree']::text[], array['lunch', 'dinner']::text[], 10, 25,
  $s$4 porcione bebe$s$, 3,
  $s$[{"name":"fileto merluci pa kocka","amount":100,"unit":"g","food_key":"cod"},{"name":"patate e ëmbël","amount":1,"unit":"copë","food_key":"sweet_potato"},{"name":"vaj ulliri","amount":1,"unit":"lugë çaji","food_key":null},{"name":"lëng limoni","amount":0.5,"unit":"lugë çaji","food_key":"lemon","optional":true},{"name":"ujë","amount":50,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Gatuaj pataten e ëmbël të prerë në kubikë 15 minuta në avull.$s$,
    $s$Vendos peshkun sipër dhe gatuaje në avull 8–10 minuta, derisa të jetë gatuar plotësisht dhe të ndahet lehtë me pirun.$s$,
    $s$Kontrolloje me gishta që të mos ketë asnjë kockë, pastaj bluaje me pataten, vajin dhe ujin. Shto limonin nëse e do.$s$
  ]::text[],
  $s${"6-8":"E lëmuar, me lugë.","9-11":"E shtypur, me peshkun e thërrmuar.","12+":"Peshk i thërrmuar dhe patate në copa, me pirun."}$s$::jsonb,
  array['fish']::text[], array['dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['protein', 'vitamin_c']::text[], true,
  $s$Në frigorifer deri në 1 ditë.$s$,
  $s$Në porcione të vogla, deri në 1 muaj.$s$,
  $s$Ngroje mirë derisa të avullojë, pastaj lëre të ftohet derisa të jetë e vakët. Mos e ringroh më shumë se një herë.$s$,
  $s$Peshku ka kocka të holla: kontrolloje me kujdes me gishta para se ta bluash.$s$,
  $s$Merluci në avull me patate të ëmbël është darkë e lehtë edhe për të rriturit, me limon dhe piper.$s$,
  array['winter']::text[], false, 'bowl-white', 'published', false, 460, 'editor'
),
(
  $s$supe-thjerrezash-me-kungull$s$, 'sq', $s$Supë thjerrëzash me kungull$s$,
  $s$Supa e thjerrëzave si në shtëpi, me kungull dhe karotë: e trashë, e ngrohtë dhe me hekur, pa kripë.$s$,
  9, 60, 'mashed', array['puree']::text[], array['lunch', 'dinner']::text[], 10, 40,
  $s$6 porcione bebe$s$, 3,
  $s$[{"name":"thjerrëza","amount":100,"unit":"g","food_key":"lentils"},{"name":"kungull","amount":200,"unit":"g","food_key":"pumpkin"},{"name":"karotë","amount":1,"unit":"copë","food_key":"carrot"},{"name":"qepë","amount":0.5,"unit":"copë","food_key":"onion"},{"name":"hudhër","amount":1,"unit":"copë","food_key":"garlic"},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null},{"name":"ujë","amount":900,"unit":"ml","food_key":null},{"name":"qimnon","amount":0.25,"unit":"lugë çaji","food_key":null,"optional":true}]$s$::jsonb,
  array[
    $s$Laji thjerrëzat; qëroji dhe prit kungullin, karotën dhe qepën në kubikë.$s$,
    $s$Kaurdis qepën dhe hudhrën në vaj 2 minuta, pastaj shto perimet, thjerrëzat dhe ujin.$s$,
    $s$Ziej 35–40 minuta, derisa thjerrëzat të shpërbëhen.$s$,
    $s$Shtype me pirun ose bluaje pak, që të mbeten copëza të buta.$s$
  ]::text[],
  $s${"9-11":"E trashë dhe e shtypur, me copëza të buta.","12+":"Si supa e familjes, me bukë të thekur për ta zhytur."}$s$::jsonb,
  array[]::text[], array['vegetarian', 'dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['iron', 'protein', 'fiber']::text[], true,
  $s$Në frigorifer deri në 3 ditë.$s$,
  $s$Në porcione, deri në 3 muaj.$s$,
  $s$Ngroje derisa të avullojë, shto pak ujë nëse është trashur dhe lëre të ftohet derisa të jetë e vakët.$s$,
  $s$Shtypi mirë thjerrëzat dhe perimet; copat e forta të karotës nuk jepen.$s$,
  $s$Ndaje pjesën e bebit, pastaj të rriturit shtojnë limon dhe piper djegës në pjatat e tyre.$s$,
  array['autumn', 'winter']::text[], true, 'bowl-orange', 'published', false, 470, 'editor'
),
(
  $s$qofte-gjeldeti-me-spinaq$s$, 'sq', $s$Qofte gjeldeti me spinaq$s$,
  $s$Qofte të buta në furrë, me gjeldeti, spinaq dhe tërshërë: mbahen lehtë me dorë dhe s'kanë vezë.$s$,
  9, 60, 'finger', array['blw']::text[], array['lunch', 'dinner', 'snack']::text[], 15, 20,
  $s$12 qofte të vogla$s$, 2,
  $s$[{"name":"mish gjeldeti i grirë","amount":250,"unit":"g","food_key":"turkey"},{"name":"spinaq i freskët","amount":50,"unit":"g","food_key":"spinach"},{"name":"tërshërë e bluar","amount":3,"unit":"lugë gjelle","food_key":"oats"},{"name":"qepë e rrendur","amount":0.25,"unit":"copë","food_key":"onion"},{"name":"hudhër e grirë","amount":1,"unit":"copë","food_key":"garlic"},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null}]$s$::jsonb,
  array[
    $s$Ndize furrën në 190°C dhe shtro letër pjekjeje në tavë.$s$,
    $s$Zbardhe spinaqin 1 minutë në ujë që vlon, shtrydhe mirë dhe grije imët.$s$,
    $s$Përzieji të gjitha dhe formo qofte të zgjatura, sa gishti i një të rrituri.$s$,
    $s$Piqi 18–20 minuta, duke i kthyer një herë, derisa të jenë gatuar plotësisht përbrenda, pa asnjë pjesë rozë.$s$
  ]::text[],
  $s${"9-11":"Qofte e zgjatur sa gishti, e butë, që shtypet me gishta.","12+":"Qofte e prerë në copa të vogla, me oriz ose purè."}$s$::jsonb,
  array[]::text[], array['dairy_free', 'egg_free', 'nut_free']::text[], array['iron', 'protein']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Të pjekura, deri në 2 muaj, të ndara me letër.$s$,
  $s$Ngrohi në furrë ose në tigan me kapak derisa të nxehen mirë në mes; lëri të ftohen para se t'i japësh.$s$,
  $s$Forma e zgjatur mbahet më lehtë dhe është më e sigurt se topat e vegjël. Rri pranë fëmijës kur ha.$s$,
  $s$Me salcë domateje dhe makarona, të njëjtat qofte janë darkë për të gjithë.$s$,
  array['winter', 'spring']::text[], false, 'plate-green', 'published', false, 480, 'editor'
),
(
  $s$shirita-patate-te-embel-ne-furre$s$, 'sq', $s$Shirita patate të ëmbël në furrë$s$,
  $s$Patate të ëmbla të pjekura butë, në shirita sa gishti: ushqim i mirë për t'u ngrënë me dorë.$s$,
  9, 60, 'finger', array['blw']::text[], array['lunch', 'snack']::text[], 10, 30,
  $s$4 porcione bebe$s$, 3,
  $s$[{"name":"patate e ëmbël","amount":2,"unit":"copë","food_key":"sweet_potato"},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null},{"name":"paprika e ëmbël","amount":0.25,"unit":"lugë çaji","food_key":null,"optional":true}]$s$::jsonb,
  array[
    $s$Ndize furrën në 200°C.$s$,
    $s$Qëroji patatet dhe prit në shirita sa gishti i një të rrituri.$s$,
    $s$Përzieji me vajin dhe paprikën, shtroji në tavë pa i mbivendosur dhe piqi 25–30 minuta, derisa të shtypen lehtë mes dy gishtave.$s$
  ]::text[],
  $s${"9-11":"Shirita të butë sa gishti, që shtypen me gishta.","12+":"Copa ose kubikë, si pjatë anësore."}$s$::jsonb,
  array[]::text[], array['vegetarian', 'dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['fiber', 'vitamin_c']::text[], false,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Nuk ngrihen mirë: zbuten shumë dhe humbin formën.$s$,
  $s$Ngrohi në furrë 5 minuta dhe provoji që të mos jenë shumë të nxehta përbrenda.$s$,
  $s$Duhet të shtypen lehtë mes gishtave; kur skajet janë të forta, piqi më gjatë me letër sipër.$s$,
  $s$Bëj një tavë të madhe: patatet e ëmbla në furrë shkojnë me çdo darkë.$s$,
  array['autumn', 'winter']::text[], false, 'plate-orange', 'published', false, 490, 'editor'
),
(
  $s$oriz-me-presh-dhe-karote$s$, 'sq', $s$Oriz me presh dhe karotë$s$,
  $s$Preshi me oriz i shtëpisë, i butë dhe pa kripë: preshi i gatuar ngadalë i jep shije të ëmbël.$s$,
  9, 60, 'mashed', array['puree']::text[], array['lunch', 'dinner']::text[], 10, 35,
  $s$5 porcione bebe$s$, 3,
  $s$[{"name":"presh","amount":1,"unit":"copë","food_key":"leek"},{"name":"karotë","amount":1,"unit":"copë","food_key":"carrot"},{"name":"oriz","amount":60,"unit":"g","food_key":"rice"},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null},{"name":"ujë","amount":500,"unit":"ml","food_key":null},{"name":"majdanoz i grirë","amount":1,"unit":"lugë çaji","food_key":null,"optional":true}]$s$::jsonb,
  array[
    $s$Laje mirë preshin, prite në rrathë të hollë dhe karotën në kubikë të vegjël.$s$,
    $s$Kaurdisi në vaj 5 minuta në zjarr të ulët, pa i skuqur.$s$,
    $s$Shto orizin dhe ujin dhe ziej 25–30 minuta, derisa orizi të jetë shumë i butë dhe uji të jetë thithur.$s$,
    $s$Shtype pak me pirun për bebet më të vogla.$s$
  ]::text[],
  $s${"9-11":"I butë dhe pak i shtypur, me lugë.","12+":"Si gjellë e familjes, me kos anash."}$s$::jsonb,
  array[]::text[], array['vegetarian', 'dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['fiber', 'vitamin_c']::text[], true,
  $s$Në frigorifer deri në 2 ditë; ftohe shpejt pas gatimit.$s$,
  $s$Në porcione, deri në 1 muaj.$s$,
  $s$Ngroje me një lugë ujë derisa të avullojë mirë; orizin mos e ringroh më shumë se një herë.$s$,
  $s$Karota duhet të jetë shumë e butë; rrathët e preshit priti imët.$s$,
  $s$Të rriturit e hanë me limon dhe piper; me pak kos sipër bëhet edhe më e mirë.$s$,
  array['autumn', 'winter']::text[], true, 'bowl-green', 'published', false, 500, 'editor'
),
(
  $s$molle-dhe-dardhe-te-pjekura-me-tershere$s$, 'sq', $s$Mollë dhe dardhë të pjekura me tërshërë$s$,
  $s$Fruta të pjekura në furrë me një shtresë tërshëre dhe gjalpi: ëmbëlsirë dimri pa sheqer.$s$,
  9, 60, 'mashed', array['puree', 'blw']::text[], array['breakfast', 'snack']::text[], 10, 30,
  $s$4 porcione bebe$s$, 2,
  $s$[{"name":"mollë","amount":2,"unit":"copë","food_key":"apple"},{"name":"dardhë","amount":1,"unit":"copë","food_key":"pear"},{"name":"ujë","amount":30,"unit":"ml","food_key":null},{"name":"tërshërë","amount":40,"unit":"g","food_key":"oats"},{"name":"gjalpë","amount":15,"unit":"g","food_key":"butter"},{"name":"kanellë","amount":0.5,"unit":"lugë çaji","food_key":null}]$s$::jsonb,
  array[
    $s$Ndize furrën në 180°C.$s$,
    $s$Qëroji frutat, prit në kubikë të vegjël dhe vendosi në një enë të vogël furre me ujin.$s$,
    $s$Fërkoje tërshërën me gjalpin e butë dhe kanellën dhe hidhe sipër frutave.$s$,
    $s$Piqe 25–30 minuta, derisa frutat të jenë shumë të buta.$s$
  ]::text[],
  $s${"9-11":"E shtypur me pirun, frutat dhe tërshëra bashkë.","12+":"Me lugë, e vakët, me pak kos."}$s$::jsonb,
  array['milk']::text[], array['vegetarian', 'egg_free', 'nut_free']::text[], array['fiber', 'vitamin_c']::text[], true,
  $s$Në frigorifer deri në 3 ditë.$s$,
  $s$Në porcione, deri në 2 muaj.$s$,
  $s$Ngroje pak dhe provoje: frutat mbajnë nxehtësinë më gjatë se tërshëra.$s$,
  $s$Molla para 12 muajsh jepet vetëm e gatuar mirë, aq sa të shtypet me gishta.$s$,
  $s$Për të rriturit, sipër me arra të grira dhe kos.$s$,
  array['autumn', 'winter']::text[], false, 'plate-yellow', 'published', false, 510, 'editor'
),
(
  $s$petulla-kungulli-me-tershere$s$, 'sq', $s$Petulla kungulli me tërshërë$s$,
  $s$Petulla të buta me kungull, tërshërë dhe vezë, pa sheqer: mëngjes që hahet me dorë.$s$,
  9, 60, 'finger', array['blw']::text[], array['breakfast', 'snack']::text[], 10, 30,
  $s$10 petulla të vogla$s$, 2,
  $s$[{"name":"kungull","amount":200,"unit":"g","food_key":"pumpkin"},{"name":"vezë","amount":1,"unit":"copë","food_key":"egg"},{"name":"tërshërë e bluar","amount":60,"unit":"g","food_key":"oats"},{"name":"kanellë","amount":0.25,"unit":"lugë çaji","food_key":null,"optional":true},{"name":"vaj ulliri","amount":1,"unit":"lugë çaji","food_key":null}]$s$::jsonb,
  array[
    $s$Prite kungullin në kubikë, ziej 15 minuta derisa të jetë shumë i butë, kulloje dhe shtype.$s$,
    $s$Përziej purènë e kungullit me vezën, tërshërën dhe kanellën; lëre 5 minuta të trashet.$s$,
    $s$Ngroh një tigan që nuk ngjit, me pak vaj, në zjarr mesatar.$s$,
    $s$Hidh nga një lugë gjelle brumë dhe gatuaj 3 minuta nga çdo anë, derisa veza të jetë gatuar plotësisht edhe në mes.$s$
  ]::text[],
  $s${"9-11":"Petull e prerë në shirita, e butë.","12+":"Petull e plotë, me kos ose fruta të shtypura."}$s$::jsonb,
  array['egg']::text[], array['vegetarian', 'dairy_free', 'nut_free']::text[], array['protein', 'fiber']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Të ndara me letër, deri në 2 muaj.$s$,
  $s$Ngrohi në tigan ose në furrë derisa të nxehen mirë; lëri të ftohen para se t'i japësh.$s$,
  $s$Shiritat e butë mbahen lehtë; kungulli duhet të jetë i zier mirë, pa copa të forta.$s$,
  $s$Dyfisho sasinë: të rriturit i hanë me kos dhe fruta.$s$,
  array['autumn', 'winter']::text[], false, 'plate-orange', 'published', false, 520, 'editor'
),
(
  $s$laker-me-oriz-dhe-mish-vici$s$, 'sq', $s$Lakër me oriz dhe mish viçi$s$,
  $s$Gjella e dimrit si e gjyshes, e përshtatur për fëmijë: lakër e zier butë me mish viçi dhe oriz.$s$,
  12, 60, 'family', array['puree', 'blw']::text[], array['lunch', 'dinner']::text[], 15, 60,
  $s$1 fëmijë + 2 të rritur$s$, 1,
  $s$[{"name":"mish viçi i grirë","amount":250,"unit":"g","food_key":"beef"},{"name":"lakër e bardhë","amount":400,"unit":"g","food_key":"cabbage"},{"name":"oriz","amount":60,"unit":"g","food_key":"rice"},{"name":"qepë","amount":1,"unit":"copë","food_key":"onion"},{"name":"domate e grirë","amount":200,"unit":"g","food_key":"tomato"},{"name":"vaj ulliri","amount":2,"unit":"lugë gjelle","food_key":null},{"name":"paprika e ëmbël","amount":0.5,"unit":"lugë çaji","food_key":null},{"name":"ujë","amount":500,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Kaurdis qepën e grirë në vaj, shto mishin dhe gatuaje 8–10 minuta duke e thërrmuar, derisa të jetë gatuar plotësisht.$s$,
    $s$Shto lakrën e prerë hollë, domaten, paprikën dhe ujin dhe ziej me kapak 30 minuta.$s$,
    $s$Shto orizin dhe ziej edhe 20 minuta, derisa orizi dhe lakra të jenë shumë të butë.$s$,
    $s$Ndaje pjesën e fëmijës para se të rriturit ta kripin gjellën në pjatat e tyre.$s$
  ]::text[],
  $s${"12+":"Copa të vogla lakre dhe mishi me oriz, me pirun ose me lugë."}$s$::jsonb,
  array[]::text[], array['dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['iron', 'protein', 'vitamin_c', 'fiber']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Në porcione, deri në 2 muaj.$s$,
  $s$Ngroje derisa të avullojë mirë në mes dhe lëre të ftohet pak para se ta japësh.$s$,
  $s$Lakrën priti hollë dhe ziej derisa të jetë shumë e butë; fijet e gjata priti me thikë.$s$,
  $s$Gatuhet për të gjithë: pjesa e fëmijës ndahet para kripës.$s$,
  array['winter']::text[], true, 'plate-green', 'published', false, 530, 'editor'
),
(
  $s$supe-me-qiqra-dhe-spinaq$s$, 'sq', $s$Supë me qiqra dhe spinaq$s$,
  $s$Supë e trashë me qiqra, spinaq dhe domate, me pak qimnon: e ngrohtë dhe me hekur.$s$,
  12, 60, 'family', array['puree']::text[], array['lunch', 'dinner']::text[], 10, 30,
  $s$6 porcione fëmije$s$, 2,
  $s$[{"name":"qiqra të ziera","amount":250,"unit":"g","food_key":"chickpeas"},{"name":"spinaq","amount":100,"unit":"g","food_key":"spinach"},{"name":"domate e grirë","amount":200,"unit":"g","food_key":"tomato"},{"name":"qepë","amount":1,"unit":"copë","food_key":"onion"},{"name":"hudhër","amount":1,"unit":"copë","food_key":"garlic"},{"name":"karotë","amount":1,"unit":"copë","food_key":"carrot"},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null},{"name":"ujë","amount":700,"unit":"ml","food_key":null},{"name":"qimnon","amount":0.5,"unit":"lugë çaji","food_key":null,"optional":true}]$s$::jsonb,
  array[
    $s$Kaurdis qepën, hudhrën dhe karotën e grirë në vaj 5 minuta.$s$,
    $s$Shto qiqrat, domaten, qimnonin dhe ujin dhe ziej 20 minuta.$s$,
    $s$Shto spinaqin e prerë dhe ziej edhe 3 minuta.$s$,
    $s$Bluaje pjesërisht, që qiqrat e plota të mos mbeten në pjatën e fëmijës.$s$
  ]::text[],
  $s${"12+":"E bluar pjesërisht, me qiqra të shtypura dhe bukë anash."}$s$::jsonb,
  array[]::text[], array['vegetarian', 'dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['iron', 'protein', 'fiber', 'vitamin_c']::text[], true,
  $s$Në frigorifer deri në 3 ditë.$s$,
  $s$Në porcione, deri në 3 muaj.$s$,
  $s$Ngroje derisa të avullojë dhe lëre të ftohet derisa të jetë e vakët.$s$,
  $s$Qiqrat e plota janë rrezik mbytjeje: shtypi ose bluaji gjithmonë për fëmijët e vegjël.$s$,
  $s$Të rriturit e hanë me limon, piper djegës dhe bukë të thekur.$s$,
  array['winter', 'spring']::text[], false, 'bowl-red', 'published', false, 540, 'editor'
),
(
  $s$tave-qengji-me-patate$s$, 'sq', $s$Tavë qengji me patate$s$,
  $s$Tava e festave, e butë për fëmijët: mish qengji i pjekur ngadalë me patate dhe rozmarinë.$s$,
  12, 60, 'family', array['blw']::text[], array['lunch', 'dinner']::text[], 15, 90,
  $s$1 fëmijë + 2 të rritur$s$, 1,
  $s$[{"name":"mish qengji pa kocka","amount":400,"unit":"g","food_key":"lamb"},{"name":"patate","amount":4,"unit":"copë","food_key":"potato"},{"name":"qepë","amount":1,"unit":"copë","food_key":"onion"},{"name":"hudhër","amount":2,"unit":"copë","food_key":"garlic"},{"name":"vaj ulliri","amount":2,"unit":"lugë gjelle","food_key":null},{"name":"rozmarinë e thatë","amount":0.5,"unit":"lugë çaji","food_key":null},{"name":"ujë","amount":250,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Ndize furrën në 180°C.$s$,
    $s$Prite mishin në kubikë, patatet në copa dhe qepën në rrathë; përzieji në tavë me vajin, hudhrën dhe rozmarinën.$s$,
    $s$Shto ujin, mbuloje me letër alumini dhe piqe 60 minuta.$s$,
    $s$Zbuloje dhe piqe edhe 30 minuta, derisa mishi të jetë gatuar plotësisht dhe të ndahet me pirun.$s$
  ]::text[],
  $s${"12+":"Mish i grirë në fije të vogla, me patate të shtypura."}$s$::jsonb,
  array[]::text[], array['dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['iron', 'protein']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Mishi me lëngun e vet, deri në 2 muaj.$s$,
  $s$Ngroje me pak ujë, të mbuluar, derisa të nxehet mirë në mes.$s$,
  $s$Hiq çdo kockë, dhjamë dhe fije të forta; prite mishin në copa shumë të vogla.$s$,
  $s$Pjesa e fëmijës ndahet para se të rriturit të shtojnë kripë; tava shkon me sallatë lakre.$s$,
  array['winter', 'spring']::text[], true, 'plate-brown', 'published', false, 550, 'editor'
),
(
  $s$salmon-me-brokoli-dhe-oriz$s$, 'sq', $s$Salmon me brokoli dhe oriz$s$,
  $s$Salmon i pjekur plotësisht në furrë, me brokoli në avull dhe oriz të butë: omega-3 në një pjatë.$s$,
  12, 60, 'family', array['blw']::text[], array['lunch', 'dinner']::text[], 10, 25,
  $s$1 fëmijë + 2 të rritur$s$, 1,
  $s$[{"name":"fileto salmoni pa kocka","amount":300,"unit":"g","food_key":"salmon"},{"name":"brokoli","amount":300,"unit":"g","food_key":"broccoli"},{"name":"oriz","amount":150,"unit":"g","food_key":"rice"},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null},{"name":"lëng limoni","amount":1,"unit":"lugë gjelle","food_key":"lemon"},{"name":"kopër e grirë","amount":1,"unit":"lugë gjelle","food_key":null,"optional":true},{"name":"ujë","amount":400,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Ziej orizin me ujin 18–20 minuta, derisa të jetë i butë.$s$,
    $s$Vendos salmonin në tavë, lyeje me vaj dhe limon dhe piqe në 200°C 15 minuta, derisa të jetë gatuar plotësisht dhe të ndahet me pirun.$s$,
    $s$Gatuaj brokolin në avull 6–8 minuta, derisa të jetë i butë.$s$,
    $s$Kontrolloje peshkun me gishta për kocka dhe thërrmoje për fëmijën.$s$
  ]::text[],
  $s${"12+":"Peshk i thërrmuar, lule brokoli të buta dhe oriz, me dorë ose me pirun."}$s$::jsonb,
  array['fish']::text[], array['dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['omega3', 'protein', 'vitamin_c']::text[], false,
  $s$Në frigorifer deri në 1 ditë.$s$,
  $s$Më mirë i freskët: peshku i pjekur nuk ngrihet mirë.$s$,
  $s$Ngroje mirë një herë të vetme dhe lëre të ftohet pak para se ta japësh.$s$,
  $s$Kontrollo me kujdes kockat e holla të salmonit; lulet e brokolit jepen të buta.$s$,
  $s$E njëjta tavë për të gjithë; të rriturit shtojnë kripë dhe piper në pjatë.$s$,
  array['winter']::text[], false, 'plate-pink', 'published', false, 560, 'editor'
),
(
  $s$makarona-me-lulelaker-dhe-djathe$s$, 'sq', $s$Makarona me lulelakër dhe djathë$s$,
  $s$Makarona të vogla me salcë të butë lulelakre dhe djathi: e kremtë, e ngrohtë dhe me kalcium.$s$,
  12, 60, 'family', array['puree', 'blw']::text[], array['lunch', 'dinner']::text[], 10, 25,
  $s$4 porcione fëmije$s$, 2,
  $s$[{"name":"makarona të vogla","amount":150,"unit":"g","food_key":"pasta"},{"name":"lulelakër","amount":250,"unit":"g","food_key":"cauliflower"},{"name":"qumësht","amount":200,"unit":"ml","food_key":"milk"},{"name":"djathë i butë me pak kripë","amount":50,"unit":"g","food_key":"cheese"},{"name":"gjalpë","amount":10,"unit":"g","food_key":"butter"},{"name":"miell gruri","amount":1,"unit":"lugë gjelle","food_key":"wheat_flour"}]$s$::jsonb,
  array[
    $s$Ziej makaronat sipas paketimit, derisa të jenë shumë të buta; në 5 minutat e fundit shto lulelakrën e prerë imët.$s$,
    $s$Në një tenxhere tjetër shkrij gjalpin, shto miellin dhe pastaj qumështin pak nga pak, duke e përzier derisa të trashet.$s$,
    $s$Hiqe nga zjarri dhe shto djathin e grirë.$s$,
    $s$Kulloji makaronat dhe lulelakrën dhe përzieji me salcën.$s$
  ]::text[],
  $s${"12+":"Makarona të vogla e të buta, me lugë ose me dorë; lulelakra e shtypur në salcë."}$s$::jsonb,
  array['wheat', 'milk']::text[], array['vegetarian', 'egg_free', 'nut_free']::text[], array['calcium', 'protein', 'vitamin_c']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Në porcione, deri në 1 muaj.$s$,
  $s$Ngroje me pak qumësht, duke e përzier, derisa të nxehet mirë.$s$,
  $s$Zgjidh makarona të vogla dhe gatuaji më gjatë se zakonisht, që të shtypen lehtë.$s$,
  $s$Për të rriturit, sipër me piper të zi dhe pak djathë të fortë, të gratinuar në furrë.$s$,
  array['autumn', 'winter']::text[], false, 'plate-yellow', 'published', false, 570, 'editor'
),
(
  $s$byrek-me-kungull-dhe-arra-te-bluara$s$, 'sq', $s$Byrek me kungull dhe arra të bluara$s$,
  $s$Byreku i ëmbël i dimrit, pa sheqer: kungull i rrendur, arra të bluara dhe kanellë mes petëve.$s$,
  24, 60, 'family', array['blw']::text[], array['breakfast', 'snack']::text[], 25, 40,
  $s$1 tavë e vogël, 8 copa$s$, 1,
  $s$[{"name":"petë byreku","amount":6,"unit":"copë","food_key":"filo"},{"name":"kungull i rrendur","amount":400,"unit":"g","food_key":"pumpkin"},{"name":"arra të bluara imët","amount":40,"unit":"g","food_key":"ground_walnuts"},{"name":"kanellë","amount":1,"unit":"lugë çaji","food_key":null},{"name":"vaj ulliri","amount":4,"unit":"lugë gjelle","food_key":null}]$s$::jsonb,
  array[
    $s$Ndize furrën në 180°C dhe lyej me vaj një tavë të vogël.$s$,
    $s$Përziej kungullin e rrendur me arrat e bluara dhe kanellën.$s$,
    $s$Shtro petët një nga një, duke e lyer secilën me vaj, dhe shpërndaje mbushjen mes tyre.$s$,
    $s$Prije në copa para pjekjes dhe piqe 35–40 minuta, derisa të marrë ngjyrë dhe kungulli të jetë i butë.$s$
  ]::text[],
  $s${"12+":"Copa të vogla, pasi të jenë ftohur pak; skajet e forta të petës hiqi për fëmijët më të vegjël."}$s$::jsonb,
  array['wheat', 'tree_nut']::text[], array['vegetarian', 'dairy_free', 'egg_free']::text[], array['fiber']::text[], true,
  $s$Në temperaturë dhome 1 ditë, në frigorifer deri në 3 ditë.$s$,
  $s$Copat e pjekura, deri në 2 muaj.$s$,
  $s$Ngrohe në furrë 10 minuta, që peta të bëhet sërish krokante; lëre të ftohet pak.$s$,
  $s$Arrat jepen vetëm të bluara imët. Petët e forta të skajeve thërrmohen në gojë: rri pranë fëmijës kur ha.$s$,
  $s$Është byreku i së dielës për gjithë familjen; të rriturit e hanë me kos ose çaj.$s$,
  array['autumn', 'winter']::text[], true, 'plate-orange', 'published', false, 580, 'editor'
),
(
  $s$supe-elbi-me-vic-dhe-perime$s$, 'sq', $s$Supë elbi me viç dhe perime$s$,
  $s$Supë e ngrohtë dimri me elb, mish viçi dhe perime: ushqim i plotë në një tenxhere.$s$,
  24, 60, 'family', array['puree']::text[], array['lunch', 'dinner']::text[], 15, 75,
  $s$6 porcione fëmije$s$, 2,
  $s$[{"name":"mish viçi pa kocka","amount":250,"unit":"g","food_key":"beef"},{"name":"elb","amount":80,"unit":"g","food_key":"barley"},{"name":"karotë","amount":2,"unit":"copë","food_key":"carrot"},{"name":"patate","amount":1,"unit":"copë","food_key":"potato"},{"name":"kërcell selinoje","amount":1,"unit":"copë","food_key":"celery"},{"name":"qepë","amount":1,"unit":"copë","food_key":"onion"},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null},{"name":"ujë","amount":1200,"unit":"ml","food_key":null},{"name":"majdanoz i grirë","amount":1,"unit":"lugë gjelle","food_key":null,"optional":true}]$s$::jsonb,
  array[
    $s$Prite mishin në kubikë të vegjël dhe kaurdise me qepën në vaj 5 minuta.$s$,
    $s$Shto elbin e larë dhe ujin; ziej me kapak 45 minuta.$s$,
    $s$Shto perimet e prera në kubikë dhe ziej edhe 25–30 minuta, derisa mishi të jetë gatuar plotësisht dhe elbi të jetë i butë.$s$,
    $s$Për fëmijën, grije mishin imët dhe shtype pak supën.$s$
  ]::text[],
  $s${"12+":"Me copa të vogla mishi të grirë dhe perime të buta, me lugë."}$s$::jsonb,
  array[]::text[], array['dairy_free', 'egg_free', 'nut_free']::text[], array['iron', 'protein', 'fiber']::text[], true,
  $s$Në frigorifer deri në 3 ditë.$s$,
  $s$Në porcione, deri në 3 muaj.$s$,
  $s$Ngroje derisa të avullojë; shto ujë nëse elbi e ka trashur.$s$,
  $s$Elbi duhet të jetë shumë i butë; mishin grije imët ose shtype me pirun.$s$,
  $s$Të rriturit e kripin në pjatë dhe e hanë me bukë të thekur.$s$,
  array['winter']::text[], false, 'bowl-brown', 'published', false, 590, 'editor'
),
(
  $s$pule-me-portokall-dhe-patate-te-embel$s$, 'sq', $s$Pulë me portokall dhe patate të ëmbël$s$,
  $s$Kofsha pule të pjekura plotësisht me lëng portokalli dhe patate të ëmbël: shije dimri, pa sheqer.$s$,
  24, 60, 'family', array['blw']::text[], array['lunch', 'dinner']::text[], 15, 45,
  $s$1 fëmijë + 2 të rritur$s$, 1,
  $s$[{"name":"kofsha pule pa lëkurë dhe pa kocka","amount":500,"unit":"g","food_key":"chicken"},{"name":"patate e ëmbël","amount":2,"unit":"copë","food_key":"sweet_potato"},{"name":"lëng portokalli i shtrydhur","amount":100,"unit":"ml","food_key":"orange"},{"name":"qepë","amount":1,"unit":"copë","food_key":"onion"},{"name":"hudhër","amount":2,"unit":"copë","food_key":"garlic"},{"name":"vaj ulliri","amount":2,"unit":"lugë gjelle","food_key":null},{"name":"rigon i thatë","amount":0.5,"unit":"lugë çaji","food_key":null}]$s$::jsonb,
  array[
    $s$Ndize furrën në 200°C.$s$,
    $s$Prit patatet e ëmbla në kubikë dhe qepën në rrathë; vendosi në tavë me pulën.$s$,
    $s$Përziej lëngun e portokallit me vajin, hudhrën e grirë dhe rigonin dhe hidhe sipër.$s$,
    $s$Piqe 40–45 minuta, duke e përzier një herë, derisa pula të jetë gatuar plotësisht dhe të mos ketë lëng rozë në mes.$s$
  ]::text[],
  $s${"12+":"Pulë e grirë në fije të vogla dhe patate e ëmbël e shtypur ose në kubikë të butë."}$s$::jsonb,
  array[]::text[], array['dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['protein', 'vitamin_c']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Në porcione me lëngun, deri në 2 muaj.$s$,
  $s$Ngroje mirë derisa të nxehet në mes; lëre të ftohet pak para se ta japësh.$s$,
  $s$Prite pulën në fije të vogla dhe hiq çdo kockë ose kërc.$s$,
  $s$Të rriturit e hanë me oriz ose me sallatë jeshile.$s$,
  array['winter']::text[], false, 'plate-yellow', 'published', false, 600, 'editor'
)
on conflict (slug) do nothing;
