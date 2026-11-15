-- 20 receta të reja (14 nëntor 2026), shumica me ushqimet e reja: 5 për 6 muaj, 5 për 9 muaj, 6 për 12 muaj, 4 për 2 vjeç e lart.
-- I sigurt për t'u ekzekutuar dy herë: recetat që ekzistojnë (sipas slug) nuk preken, as ndryshimet e adminit.
-- Nuk fshin asgjë. Kërkon migrimin 20261110090000_recipes.sql.

insert into public.recipes (slug, language, title, summary, age_min_months, age_max_months, stage, feeding_style, meal_types, prep_minutes, cook_minutes, yield_note, family_factor, ingredients, steps, serve_by_age, allergens, diet_tags, nutrients, freezer_friendly, storage_note, freezer_note, reheat_note, choking_note, family_tip, season, is_albanian, cover_key, status, featured, sort_order, source)
values
(
  $s$qull-meli-me-dardhe$s$, 'sq', $s$Qull meli me dardhë$s$,
  $s$Qull i butë meli, pa gluten, i ëmbëlsuar vetëm me dardhë të zier.$s$,
  6, 36, 'pure', array['puree']::text[], array['breakfast']::text[], 5, 20,
  $s$3 porcione bebe$s$, 3,
  $s$[{"name":"mel","amount":40,"unit":"g","food_key":"millet"},{"name":"ujë","amount":300,"unit":"ml","food_key":null},{"name":"dardhë e pjekur","amount":1,"unit":"copë","food_key":"pear"}]$s$::jsonb,
  array[
    $s$Shpëlaje melin në sitë nën ujë të rrjedhshëm.$s$,
    $s$Vëre të ziejë me ujin, në zjarr të ulët, rreth 15 minuta, duke e përzier herë pas here.$s$,
    $s$Qëroje dardhën, prite në kubikë dhe shtoje 5 minutat e fundit.$s$,
    $s$Bluaje me blender deri sa të bëhet e lëmuar; holloje me pak ujë nëse duhet.$s$
  ]::text[],
  $s${"6-8":"I lëmuar dhe i vakët, me lugë.","9-11":"Më i trashë, me dardhën e shtypur me pirun.","12+":"Si qull mëngjesi, me fruta të prera."}$s$::jsonb,
  array[]::text[], array['vegetarian', 'dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['fiber']::text[], true,
  $s$Në frigorifer deri në 2 ditë, në enë të mbyllur.$s$,
  $s$Në kallëpe akulli, deri në 1 muaj.$s$,
  $s$Ngroje dhe përzieje mirë; holloje me pak ujë.$s$,
  $s$Qulli duhet të jetë i lëmuar, pa kokrra të forta.$s$,
  $s$Të rriturit e hanë me kos dhe arra sipër.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-yellow', 'published', false, 610, 'editor'
),
(
  $s$pure-pastinake-me-molle$s$, 'sq', $s$Pure pastinake me mollë$s$,
  $s$Pastinakë dhe mollë të ziera bashkë: pure e ëmbël natyrshëm, e butë si kremi.$s$,
  6, 24, 'pure', array['puree']::text[], array['lunch', 'dinner']::text[], 10, 18,
  $s$4 porcione bebe$s$, 3,
  $s$[{"name":"pastinakë","amount":2,"unit":"copë","food_key":"parsnip"},{"name":"mollë","amount":1,"unit":"copë","food_key":"apple"},{"name":"ujë","amount":200,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Qëroji pastinakët dhe mollën dhe prit në kubikë të vegjël.$s$,
    $s$Ziej pastinakët 10 minuta, pastaj shto mollën dhe ziej edhe 8 minuta, deri sa të butësohen krejt.$s$,
    $s$Bluaji me pak nga uji i zierjes deri sa të bëhet pure e lëmuar.$s$
  ]::text[],
  $s${"6-8":"Pure e lëmuar, me lugë.","9-11":"E shtypur me pirun, ose me qull.","12+":"Si garniturë pranë mishit ose peshkut."}$s$::jsonb,
  array[]::text[], array['vegetarian', 'dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['fiber']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Në kallëpe akulli, deri në 2 muaj.$s$,
  $s$Ngroje butë dhe përzieje; provoje para se ta japësh.$s$,
  $s$Pastinaka dhe molla jepen gjithmonë të gatuara, kurrë të papjekura.$s$,
  $s$Për të rriturit, shto piper të zi dhe pak gjalpë.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-white', 'published', false, 620, 'editor'
),
(
  $s$pure-pazie-me-patate$s$, 'sq', $s$Pure pazie me patate$s$,
  $s$Pazi e zier me patate dhe pak limon: pure jeshile me hekur nga kopshti.$s$,
  6, 24, 'pure', array['puree']::text[], array['lunch', 'dinner']::text[], 10, 20,
  $s$4 porcione bebe$s$, 3,
  $s$[{"name":"gjethe pazie","amount":150,"unit":"g","food_key":"chard"},{"name":"patate","amount":2,"unit":"copë","food_key":"potato"},{"name":"lëng limoni","amount":1,"unit":"lugë çaji","food_key":"lemon"},{"name":"vaj ulliri","amount":1,"unit":"lugë çaji","food_key":null}]$s$::jsonb,
  array[
    $s$Laje mirë pazinë, hiq kërcejtë e trashë dhe grije.$s$,
    $s$Qëroji patatet, prit në kubikë dhe ziej 12 minuta.$s$,
    $s$Shto pazinë dhe ziej edhe 6–8 minuta, deri sa patatet të shpërbëhen.$s$,
    $s$Kulloji dhe bluaji me vajin dhe limonin, me pak nga uji i zierjes.$s$
  ]::text[],
  $s${"6-8":"Pure e lëmuar, me lugë.","9-11":"E shtypur me pirun, me pak kos.","12+":"Si garniturë, ose e përzier me oriz."}$s$::jsonb,
  array[]::text[], array['vegetarian', 'dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['iron', 'vitamin_c']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Në kallëpe akulli, deri në 1 muaj.$s$,
  $s$Ngroje butë dhe përzieje mirë.$s$,
  $s$Bluaji mirë gjethet, që të mos mbeten fije të gjata.$s$,
  $s$Të rriturit e hanë me vezë të ziera dhe hudhër.$s$,
  array['spring', 'autumn']::text[], false, 'bowl-green', 'published', false, 630, 'editor'
),
(
  $s$trofte-me-patate-dhe-kungull-te-njome$s$, 'sq', $s$Troftë me patate dhe kungull të njomë$s$,
  $s$Troftë e zier në avull, pa kocka, e shtypur me patate dhe kungull: peshku i parë i butë.$s$,
  6, 24, 'mashed', array['puree', 'blw']::text[], array['lunch', 'dinner']::text[], 10, 20,
  $s$4 porcione bebe$s$, 2,
  $s$[{"name":"fileto trofte pa lëkurë","amount":150,"unit":"g","food_key":"trout"},{"name":"patate","amount":2,"unit":"copë","food_key":"potato"},{"name":"kungull i njomë","amount":1,"unit":"copë","food_key":"zucchini"},{"name":"vaj ulliri","amount":1,"unit":"lugë çaji","food_key":null}]$s$::jsonb,
  array[
    $s$Qëroji patatet dhe prit në kubikë; prite kungullin në rrathë të trashë.$s$,
    $s$Ziej patatet 10 minuta, pastaj vendos kungullin dhe troftën në avull sipër tyre, me kapak.$s$,
    $s$Gatuaje 8–10 minuta, deri sa peshku të jetë gatuar plotësisht dhe të ndahet lehtë me pirun.$s$,
    $s$Kontrollo peshkun me gishta për kocka, pastaj shtype gjithçka bashkë me vajin.$s$
  ]::text[],
  $s${"6-8":"E shtypur imët ose e bluar, me lugë.","9-11":"E shtypur me pirun, me copa të vogla peshku.","12+":"Copa peshku pa kocka me patate dhe kungull."}$s$::jsonb,
  array['fish']::text[], array['dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['omega3', 'protein']::text[], true,
  $s$Në frigorifer deri në 1 ditë.$s$,
  $s$Në porcione, deri në 1 muaj.$s$,
  $s$Ngroje mirë derisa të nxehet në mes, pastaj lëre të ftohet pak.$s$,
  $s$Kontrollo gjithmonë peshkun me gishta për kocka të vogla.$s$,
  $s$Të rriturit e hanë troftën me limon dhe sallatë.$s$,
  array['spring', 'summer']::text[], false, 'bowl-green', 'published', false, 640, 'editor'
),
(
  $s$kos-me-pure-kumbullash-te-thata$s$, 'sq', $s$Kos me pure kumbullash të thata$s$,
  $s$Kos i plotë me pure kumbullash të thata: mëngjes i ëmbël pa sheqer.$s$,
  6, 60, 'pure', array['puree']::text[], array['breakfast', 'snack']::text[], 15, 5,
  $s$4 porcione bebe$s$, 3,
  $s$[{"name":"kumbulla të thata pa bërthamë","amount":8,"unit":"copë","food_key":"prunes"},{"name":"ujë","amount":100,"unit":"ml","food_key":null},{"name":"kos i plotë pa sheqer","amount":200,"unit":"g","food_key":"yogurt"}]$s$::jsonb,
  array[
    $s$Vëri kumbullat me ujin në një tenxhere të vogël dhe ziej 5 minuta, deri sa të fryhen dhe të zbuten.$s$,
    $s$Bluaji me ujin e mbetur deri sa të bëhet pure e lëmuar; lëre të ftohet.$s$,
    $s$Për çdo porcion, përziej 2 lugë gjelle kos me 1 lugë çaji pure.$s$
  ]::text[],
  $s${"6-8":"Me lugë, me pak pure në fillim.","9-11":"Me lugë, ose si salcë mbi petulla.","12+":"Si mëngjes ose vakt i lehtë, me tërshërë sipër."}$s$::jsonb,
  array['milk']::text[], array['vegetarian', 'gluten_free', 'egg_free', 'nut_free']::text[], array['calcium', 'fiber']::text[], true,
  $s$Pureja në frigorifer deri në 5 ditë; kosin përzieje në çast.$s$,
  $s$Vetëm pureja, në kallëpe akulli, deri në 3 muaj.$s$,
  $s$Shërbehet e ftohtë; pureja e ngrirë shkrihet në frigorifer.$s$,
  $s$Kumbullat e thata jepen vetëm të bluara: të plota ngjiten dhe janë rrezik mbytjeje.$s$,
  $s$Pureja shkon edhe te qulli i të rriturve, në vend të reçelit.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-pink', 'published', false, 650, 'editor'
),
(
  $s$fasule-te-kuqe-me-oriz-dhe-karote$s$, 'sq', $s$Fasule të kuqe me oriz dhe karotë$s$,
  $s$Fasule të kuqe të ziera plotësisht, me oriz dhe karotë: gjellë e butë me hekur dhe proteinë.$s$,
  9, 60, 'mashed', array['puree', 'blw']::text[], array['lunch', 'dinner']::text[], 10, 30,
  $s$6 porcione fëmije$s$, 2,
  $s$[{"name":"fasule të kuqe të konservuara, të shpëlara","amount":200,"unit":"g","food_key":"kidney_beans"},{"name":"oriz","amount":80,"unit":"g","food_key":"rice"},{"name":"karotë","amount":2,"unit":"copë","food_key":"carrot"},{"name":"qepë","amount":1,"unit":"copë","food_key":"onion"},{"name":"domate e grirë","amount":200,"unit":"g","food_key":"tomato"},{"name":"ujë","amount":500,"unit":"ml","food_key":null},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null}]$s$::jsonb,
  array[
    $s$Kaurdis qepën e grirë imët në vaj 3 minuta, pastaj shto karotat të grira.$s$,
    $s$Shto domaten, orizin e shpëlarë dhe ujin; ziej 15 minuta në zjarr të ulët.$s$,
    $s$Shto fasulet e shpëlara mirë dhe ziej edhe 10 minuta, deri sa orizi të jetë shumë i butë.$s$,
    $s$Për bebet, shtypi fasulet me pirun ose bluaje pak gjellën.$s$
  ]::text[],
  $s${"9-11":"E shtypur me pirun, me fasulet të shtypura krejt.","12+":"Si gjellë me lugë; fasulet të shtypura lehtë deri rreth 2 vjeç."}$s$::jsonb,
  array[]::text[], array['vegetarian', 'dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['iron', 'protein', 'fiber']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Në porcione, deri në 2 muaj.$s$,
  $s$Ngroje mirë me pak ujë, derisa të nxehet në mes.$s$,
  $s$Shtypi fasulet: kokrrat e plota janë rrezik mbytjeje. Fasulet e thata ziej plotësisht pasi i lag gjatë natës.$s$,
  $s$Për të rriturit, shto spec djegës dhe piper.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-red', 'published', false, 660, 'editor'
),
(
  $s$hikerror-me-perime-dhe-kos$s$, 'sq', $s$Hikërror me perime dhe kos$s$,
  $s$Hikërror i zier butë me kungull të njomë dhe karotë, me një lugë kos sipër.$s$,
  9, 60, 'mashed', array['puree', 'blw']::text[], array['lunch', 'dinner']::text[], 10, 20,
  $s$4 porcione fëmije$s$, 2,
  $s$[{"name":"hikërror","amount":80,"unit":"g","food_key":"buckwheat"},{"name":"kungull i njomë","amount":1,"unit":"copë","food_key":"zucchini"},{"name":"karotë","amount":1,"unit":"copë","food_key":"carrot"},{"name":"ujë","amount":300,"unit":"ml","food_key":null},{"name":"kos i plotë pa sheqer","amount":4,"unit":"lugë gjelle","food_key":"yogurt"}]$s$::jsonb,
  array[
    $s$Shpëlaje hikërrorin; grij karotën dhe kungullin në rende.$s$,
    $s$Vëri të gjitha me ujin të ziejnë, me kapak, rreth 18–20 minuta, deri sa hikërrori të jetë shumë i butë.$s$,
    $s$Shtype pak me pirun dhe shërbeje i vakët, me kos sipër.$s$
  ]::text[],
  $s${"9-11":"I shtypur me pirun, me kos të përzier brenda.","12+":"Si gjellë me lugë, ose në topa të butë."}$s$::jsonb,
  array['milk']::text[], array['vegetarian', 'gluten_free', 'egg_free', 'nut_free']::text[], array['fiber']::text[], true,
  $s$Në frigorifer deri në 2 ditë, pa kosin.$s$,
  $s$Pa kosin, në porcione, deri në 2 muaj.$s$,
  $s$Ngroje me pak ujë; kosin shtoje pasi ftohet pak.$s$,
  $s$Hikërrori duhet të jetë i zier shumë butë, pa kokrra të forta.$s$,
  $s$Të rriturit e hanë si pilaf, me kërpudha dhe qepë të skuqur.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-brown', 'published', false, 670, 'editor'
),
(
  $s$kuskus-me-pule-dhe-perime$s$, 'sq', $s$Kuskus me pulë dhe perime$s$,
  $s$Kuskus i butë me pulë të grirë dhe perime, gati për 20 minuta.$s$,
  9, 60, 'mashed', array['puree', 'blw']::text[], array['lunch', 'dinner']::text[], 10, 20,
  $s$1 fëmijë + 2 të rritur$s$, 1,
  $s$[{"name":"kuskus","amount":150,"unit":"g","food_key":"couscous"},{"name":"gjoks pule","amount":200,"unit":"g","food_key":"chicken"},{"name":"kungull i njomë","amount":1,"unit":"copë","food_key":"zucchini"},{"name":"bizele","amount":80,"unit":"g","food_key":"peas"},{"name":"ujë i nxehtë","amount":250,"unit":"ml","food_key":null},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null}]$s$::jsonb,
  array[
    $s$Prit pulën në kubikë të vegjël dhe kaurdise në vaj, duke e përzier, deri sa të jetë gatuar plotësisht dhe të mos ketë rozë në mes.$s$,
    $s$Shto kungullin në kubikë dhe bizelet; gatuaji me pak ujë 8 minuta, deri sa të butësohen.$s$,
    $s$Hidh ujin e nxehtë mbi kuskusin, mbuloje dhe lëre 5 minuta; pastaj shkriftoje me pirun.$s$,
    $s$Përziej kuskusin me pulën dhe perimet; për bebet, grije pulën imët dhe shtyp bizelet.$s$
  ]::text[],
  $s${"9-11":"Pula e grirë imët dhe bizelet të shtypura, me lugë.","12+":"Si te familja, me pulën në copa të vogla."}$s$::jsonb,
  array['wheat']::text[], array['dairy_free', 'egg_free', 'nut_free']::text[], array['protein']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Në porcione, deri në 1 muaj.$s$,
  $s$Ngroje mirë me një lugë ujë derisa të nxehet në mes.$s$,
  $s$Bizelet shtypi deri rreth 2 vjeç; pulën prite në fije të vogla.$s$,
  $s$Të rriturit e hanë me limon, majdanoz dhe pak piper.$s$,
  array['spring', 'summer']::text[], false, 'plate-yellow', 'published', false, 680, 'editor'
),
(
  $s$petulla-me-rikote-dhe-manaferra$s$, 'sq', $s$Petulla me rikotë dhe manaferra$s$,
  $s$Petulla të buta me rikotë, pa sheqer: manaferrat e shtypura i japin ngjyrë dhe ëmbëlsi.$s$,
  9, 60, 'finger', array['blw']::text[], array['breakfast', 'snack']::text[], 10, 15,
  $s$10 petulla të vogla$s$, 1,
  $s$[{"name":"rikotë","amount":150,"unit":"g","food_key":"ricotta"},{"name":"vezë","amount":1,"unit":"copë","food_key":"egg"},{"name":"miell gruri","amount":60,"unit":"g","food_key":"wheat_flour"},{"name":"banane e pjekur","amount":1,"unit":"copë","food_key":"banana"},{"name":"manaferra","amount":80,"unit":"g","food_key":"blackberries"},{"name":"vaj ulliri","amount":1,"unit":"lugë çaji","food_key":null}]$s$::jsonb,
  array[
    $s$Shtype bananen dhe përzieje me rikotën dhe vezën.$s$,
    $s$Shto miellin dhe përziej deri sa të bëhet brumë i trashë.$s$,
    $s$Ngroh tiganin me pak vaj dhe hidh nga një lugë gjelle brumë; piqi 2–3 minuta nga secila anë, deri sa veza të jetë gatuar plotësisht në mes.$s$,
    $s$Shtypi manaferrat me pirun dhe shërbeji sipër petullave.$s$
  ]::text[],
  $s${"9-11":"Shirita petulle me manaferra të shtypura.","12+":"Petulla të plota, me manaferra të prera në gjysmë."}$s$::jsonb,
  array['egg', 'milk', 'wheat']::text[], array['vegetarian', 'nut_free']::text[], array['calcium', 'protein', 'vitamin_c']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Petullat pa fruta, të ndara me letër, deri në 2 muaj.$s$,
  $s$Ngrohi në tigan ose në furrë të vogël, deri sa të nxehen në mes.$s$,
  $s$Manaferrat shtypi ose prit në gjysmë; petullat në shirita sa gishti.$s$,
  $s$Të rriturit i hanë me kos dhe arra të thekura.$s$,
  array['summer']::text[], false, 'plate-pink', 'published', false, 690, 'editor'
),
(
  $s$omelete-ne-furre-me-shpargull$s$, 'sq', $s$Omëletë në furrë me shpargull$s$,
  $s$Omëletë e pjekur në furrë me shpargull dhe mocarelë, e prerë në shirita për duar të vogla.$s$,
  9, 60, 'finger', array['blw']::text[], array['breakfast', 'lunch']::text[], 10, 20,
  $s$1 tavë e vogël, 8 shirita$s$, 1,
  $s$[{"name":"vezë","amount":4,"unit":"copë","food_key":"egg"},{"name":"shpargull","amount":6,"unit":"copë","food_key":"asparagus"},{"name":"mocarelë e freskët","amount":50,"unit":"g","food_key":"mozzarella"},{"name":"qumësht","amount":50,"unit":"ml","food_key":"milk"},{"name":"vaj ulliri","amount":1,"unit":"lugë çaji","food_key":null}]$s$::jsonb,
  array[
    $s$Ngroh furrën në 180°C dhe lyej një tavë të vogël me vaj.$s$,
    $s$Hiq pjesën e fortë të fundit të shpargujve, prit në copa të vogla dhe ziej 4 minuta.$s$,
    $s$Rrih vezët me qumështin, shto shpargujt dhe mocarelën e grirë, dhe hidhe në tavë.$s$,
    $s$Piqe 18–20 minuta, deri sa omëleta të jetë gatuar plotësisht në mes dhe të mos lëvizë kur e tund.$s$
  ]::text[],
  $s${"9-11":"Shirita të butë sa gishti.","12+":"Katrorë të vegjël, me bukë."}$s$::jsonb,
  array['egg', 'milk']::text[], array['vegetarian', 'gluten_free', 'nut_free']::text[], array['protein', 'calcium']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Shiritat e ndarë me letër, deri në 1 muaj.$s$,
  $s$Ngrohi në furrë deri sa të nxehen në mes.$s$,
  $s$Shpargujt prit në copa të vogla dhe ziej butë para pjekjes.$s$,
  $s$Të rriturit e hanë me sallatë domatesh dhe bukë.$s$,
  array['spring']::text[], false, 'plate-yellow', 'published', false, 700, 'editor'
),
(
  $s$byrek-me-pazi$s$, 'sq', $s$Byrek me pazi$s$,
  $s$Byreku klasik me pazi dhe gjizë, i përshtatur për të vegjlit: pa kripë të shtuar, i pjekur mirë.$s$,
  12, 60, 'family', array['blw']::text[], array['breakfast', 'lunch', 'snack']::text[], 25, 40,
  $s$1 tavë e vogël, 8 copa$s$, 1,
  $s$[{"name":"petë byreku të gatshme","amount":6,"unit":"copë","food_key":"filo"},{"name":"pazi","amount":400,"unit":"g","food_key":"chard"},{"name":"gjizë e freskët pa kripë","amount":200,"unit":"g","food_key":"gjize"},{"name":"qepë e njomë","amount":2,"unit":"copë","food_key":"onion"},{"name":"vezë","amount":2,"unit":"copë","food_key":"egg"},{"name":"kos i plotë","amount":100,"unit":"g","food_key":"yogurt"},{"name":"vaj ulliri","amount":3,"unit":"lugë gjelle","food_key":null}]$s$::jsonb,
  array[
    $s$Ngroh furrën në 190°C. Laje pazinë, hiq kërcejtë e trashë, grije imët dhe shtrydhe mirë nga uji.$s$,
    $s$Përziej pazinë me qepën e grirë, gjizën dhe një vezë.$s$,
    $s$Rrih vezën tjetër me kosin dhe vajin: me këtë lyhen petët.$s$,
    $s$Shtro 3 petë në tavë, duke lyer secilën; shtro mbushjen dhe mbuloje me 3 petët e tjera, të lyera edhe ato.$s$,
    $s$Prite në copa para pjekjes dhe piqe 35–40 minuta, deri sa të marrë ngjyrë dhe mbushja të jetë gatuar plotësisht.$s$
  ]::text[],
  $s${"12+":"Copa të vogla nga mesi, të vakëta; skajet e forta e të thata hiqi."}$s$::jsonb,
  array['egg', 'milk', 'wheat']::text[], array['vegetarian', 'nut_free']::text[], array['iron', 'calcium', 'protein']::text[], true,
  $s$Në frigorifer deri në 3 ditë.$s$,
  $s$Copat e pjekura, deri në 2 muaj.$s$,
  $s$Ngroje në furrë deri sa të nxehet në mes.$s$,
  $s$Skajet e thata të petës janë të forta: jepi copat e buta nga mesi.$s$,
  $s$Të rriturit e hanë me kos ose dhallë.$s$,
  array['spring', 'autumn']::text[], true, 'plate-green', 'published', false, 710, 'editor'
),
(
  $s$trofte-ne-tave-me-perime$s$, 'sq', $s$Troftë në tavë me perime$s$,
  $s$Troftë e pjekur në tavë me patate, speca dhe limon: darka e peshkut për gjithë familjen.$s$,
  12, 60, 'family', array['blw']::text[], array['lunch', 'dinner']::text[], 15, 35,
  $s$1 fëmijë + 2 të rritur$s$, 1,
  $s$[{"name":"fileto trofte","amount":400,"unit":"g","food_key":"trout"},{"name":"patate","amount":4,"unit":"copë","food_key":"potato"},{"name":"spec i kuq","amount":1,"unit":"copë","food_key":"pepper"},{"name":"lëng limoni","amount":2,"unit":"lugë gjelle","food_key":"lemon"},{"name":"hudhër","amount":1,"unit":"copë","food_key":"garlic"},{"name":"vaj ulliri","amount":2,"unit":"lugë gjelle","food_key":null}]$s$::jsonb,
  array[
    $s$Ngroh furrën në 200°C. Prit patatet në feta të holla dhe specin në shirita; piqi me gjysmën e vajit 20 minuta.$s$,
    $s$Vendos troftën sipër, lyeje me vajin tjetër, hudhrën e grirë dhe limonin.$s$,
    $s$Piqe edhe 12–15 minuta, deri sa peshku të jetë gatuar plotësisht dhe të ndahet lehtë me pirun.$s$,
    $s$Para se t'ia japësh fëmijës, ndaje peshkun me gishta dhe hiq çdo kockë.$s$
  ]::text[],
  $s${"12+":"Copa peshku pa kocka, me patate dhe speca të butë."}$s$::jsonb,
  array['fish']::text[], array['dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['omega3', 'protein', 'vitamin_c']::text[], false,
  $s$Në frigorifer deri në 1 ditë.$s$,
  $s$Nuk këshillohet: peshku i pjekur thahet pas ngrirjes.$s$,
  $s$Ngroje mirë në furrë derisa të nxehet në mes.$s$,
  $s$Kontrollo peshkun me gishta për kocka të vogla.$s$,
  $s$Të rriturit shtojnë kripë dhe ullinj në pjatë.$s$,
  array['spring', 'summer', 'autumn']::text[], true, 'plate-pink', 'published', false, 720, 'editor'
),
(
  $s$supe-me-rrepe-patate-dhe-presh$s$, 'sq', $s$Supë me rrepë, patate dhe presh$s$,
  $s$Supë e ngrohtë kremoze me rrepë të ëmbël, patate dhe presh, pa kripë të shtuar.$s$,
  12, 60, 'family', array['puree']::text[], array['lunch', 'dinner']::text[], 10, 25,
  $s$6 porcione fëmije$s$, 2,
  $s$[{"name":"rrepë","amount":2,"unit":"copë","food_key":"turnip"},{"name":"patate","amount":2,"unit":"copë","food_key":"potato"},{"name":"presh","amount":1,"unit":"copë","food_key":"leek"},{"name":"ujë","amount":800,"unit":"ml","food_key":null},{"name":"gjalpë","amount":1,"unit":"lugë gjelle","food_key":"butter"}]$s$::jsonb,
  array[
    $s$Laje preshin mirë dhe prite në rrathë; qëroji rrepat dhe patatet dhe prit në kubikë.$s$,
    $s$Kaurdise preshin në gjalpë 4 minuta, pastaj shto rrepat, patatet dhe ujin.$s$,
    $s$Ziej 20 minuta, deri sa perimet të butësohen krejt, dhe bluaje në supë kremoze.$s$
  ]::text[],
  $s${"12+":"E vakët, me lugë ose në filxhan me dy doreza, me bukë të thekur."}$s$::jsonb,
  array['milk']::text[], array['vegetarian', 'gluten_free', 'egg_free', 'nut_free']::text[], array['vitamin_c', 'fiber']::text[], true,
  $s$Në frigorifer deri në 3 ditë.$s$,
  $s$Në porcione, deri në 3 muaj.$s$,
  $s$Ngroje mirë dhe përzieje; provoje para se ta japësh.$s$,
  $s$Supa e bluar s'ka copa; buka jepet në shirita të butë.$s$,
  $s$Të rriturit e hanë me kripë, piper dhe pak djathë të grirë.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-white', 'published', false, 730, 'editor'
),
(
  $s$kefir-me-nektarine-dhe-banane$s$, 'sq', $s$Kefir me nektarinë dhe banane$s$,
  $s$Pije e trashë me kefir, nektarinë dhe banane, në gotë të hapur: vakt i lehtë pa sheqer.$s$,
  12, 60, 'family', array['puree']::text[], array['breakfast', 'snack']::text[], 5, 0,
  $s$2 gota të vogla$s$, 2,
  $s$[{"name":"kefir i plotë pa sheqer","amount":200,"unit":"ml","food_key":"kefir"},{"name":"nektarinë e pjekur","amount":1,"unit":"copë","food_key":"nectarine"},{"name":"banane","amount":1,"unit":"copë","food_key":"banana"}]$s$::jsonb,
  array[
    $s$Qëroje nektarinën, hiq bërthamën dhe prite në copa.$s$,
    $s$Bluaj nektarinën, bananen dhe kefirin deri sa të bëhet e lëmuar.$s$,
    $s$Shërbeje menjëherë në gotë të hapur.$s$
  ]::text[],
  $s${"12+":"Në gotë të hapur, pak nga pak, ose me lugë."}$s$::jsonb,
  array['milk']::text[], array['vegetarian', 'gluten_free', 'egg_free', 'nut_free']::text[], array['calcium', 'vitamin_c']::text[], true,
  $s$Pihet menjëherë; në frigorifer deri në 1 ditë.$s$,
  $s$Në kallëpe akulloreje, deri në 1 muaj.$s$,
  $s$S'ngrohet: shërbehet e freskët ose si akullore.$s$,
  $s$Bluaje mirë, pa copa frutash.$s$,
  $s$Të rriturit shtojnë tërshërë dhe pak kanellë.$s$,
  array['summer']::text[], false, 'bowl-orange', 'published', false, 740, 'editor'
),
(
  $s$laker-brukseli-me-patate-dhe-qiqra$s$, 'sq', $s$Lakër Brukseli me patate dhe qiqra$s$,
  $s$Lakër Brukseli, patate dhe qiqra të pjekura në furrë, me pak limon: pjatë me fibra e proteinë.$s$,
  12, 60, 'family', array['blw']::text[], array['lunch', 'dinner']::text[], 15, 30,
  $s$1 fëmijë + 2 të rritur$s$, 1,
  $s$[{"name":"lakër Brukseli","amount":300,"unit":"g","food_key":"brussels_sprouts"},{"name":"patate","amount":3,"unit":"copë","food_key":"potato"},{"name":"qiqra të ziera","amount":200,"unit":"g","food_key":"chickpeas"},{"name":"lëng limoni","amount":1,"unit":"lugë gjelle","food_key":"lemon"},{"name":"vaj ulliri","amount":2,"unit":"lugë gjelle","food_key":null}]$s$::jsonb,
  array[
    $s$Ngroh furrën në 200°C. Ziej lakrën Brukseli 6 minuta dhe prite në katërsh.$s$,
    $s$Prit patatet në kubikë dhe përziej me lakrën, qiqrat dhe vajin.$s$,
    $s$Piqi 25–30 minuta, duke i përzier një herë, deri sa patatet të jenë të buta brenda.$s$,
    $s$Hidh limonin sipër; për fëmijën, shtypi qiqrat dhe lakrën me pirun.$s$
  ]::text[],
  $s${"12+":"Qiqrat të shtypura lehtë dhe lakra në katërsh, e butë."}$s$::jsonb,
  array[]::text[], array['vegetarian', 'dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['vitamin_c', 'fiber', 'protein']::text[], false,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Nuk këshillohet: perimet e pjekura zbuten shumë.$s$,
  $s$Ngrohi në furrë deri sa të nxehen në mes.$s$,
  $s$Qiqrat shtypi deri rreth 2 vjeç; lakrën prite në katërsh dhe piqe butë.$s$,
  $s$Të rriturit e hanë me kos me hudhër dhe paprikë.$s$,
  array['autumn', 'winter']::text[], false, 'plate-green', 'published', false, 750, 'editor'
),
(
  $s$makarona-me-domate-dhe-mocarele$s$, 'sq', $s$Makarona me domate dhe mocarelë$s$,
  $s$Makarona me salcë domatesh të freskëta dhe mocarelë të shkrirë: e thjeshtë dhe e dashur.$s$,
  12, 60, 'family', array['blw']::text[], array['lunch', 'dinner']::text[], 10, 20,
  $s$1 fëmijë + 2 të rritur$s$, 1,
  $s$[{"name":"makarona të shkurtra","amount":250,"unit":"g","food_key":"pasta"},{"name":"domate të grira","amount":400,"unit":"g","food_key":"tomato"},{"name":"mocarelë e freskët","amount":100,"unit":"g","food_key":"mozzarella"},{"name":"hudhër","amount":1,"unit":"copë","food_key":"garlic"},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null},{"name":"borzilok i freskët","amount":4,"unit":"copë","food_key":null}]$s$::jsonb,
  array[
    $s$Ziej makaronat në ujë pa kripë sipas paketimit, pak më shumë për fëmijën, që të jenë të buta.$s$,
    $s$Kaurdis hudhrën e grirë në vaj 1 minutë, shto domatet dhe ziej 15 minuta në zjarr të ulët.$s$,
    $s$Përziej makaronat me salcën, shto mocarelën në copa të vogla dhe borzilokun e grirë; përziej deri sa të shkrihet.$s$
  ]::text[],
  $s${"12+":"Makarona të buta me mocarelë të shkrirë, të prera në copa të vogla."}$s$::jsonb,
  array['milk', 'wheat']::text[], array['vegetarian', 'egg_free', 'nut_free']::text[], array['calcium', 'vitamin_c']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Vetëm salca, deri në 3 muaj.$s$,
  $s$Ngroje me një lugë ujë derisa të nxehet në mes.$s$,
  $s$Mocarela e shkrirë zgjatet si fije: prite në copa të vogla para se ta japësh.$s$,
  $s$Të rriturit shtojnë djathë parmixhano dhe piper djegës.$s$,
  array['summer', 'autumn']::text[], false, 'plate-red', 'published', false, 760, 'editor'
),
(
  $s$gjelle-fasulesh-te-kuqe-me-mish-vici$s$, 'sq', $s$Gjellë fasulesh të kuqe me mish viçi$s$,
  $s$Gjellë e trashë me mish viçi të grirë, fasule të kuqe dhe perime: hekur për gjithë javën.$s$,
  24, 60, 'family', array['blw']::text[], array['lunch', 'dinner']::text[], 15, 40,
  $s$1 fëmijë + 3 të rritur$s$, 1,
  $s$[{"name":"mish viçi i grirë","amount":400,"unit":"g","food_key":"beef"},{"name":"fasule të kuqe të konservuara, të shpëlara","amount":400,"unit":"g","food_key":"kidney_beans"},{"name":"qepë","amount":1,"unit":"copë","food_key":"onion"},{"name":"spec i kuq","amount":1,"unit":"copë","food_key":"pepper"},{"name":"domate të grira","amount":400,"unit":"g","food_key":"tomato"},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null},{"name":"paprikë e ëmbël","amount":1,"unit":"lugë çaji","food_key":null}]$s$::jsonb,
  array[
    $s$Kaurdis qepën dhe specin e grirë në vaj 5 minuta.$s$,
    $s$Shto mishin dhe përzieje, duke e shkërmoqur, deri sa të jetë gatuar plotësisht dhe të mos ketë rozë.$s$,
    $s$Shto domatet, paprikën dhe fasulet; ziej me kapak 25–30 minuta në zjarr të ulët.$s$,
    $s$Për fëmijën, shtypi fasulet lehtë me pirun.$s$
  ]::text[],
  $s${"12+":"Me lugë, me oriz ose bukë; fasulet të shtypura lehtë."}$s$::jsonb,
  array[]::text[], array['dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['iron', 'protein', 'fiber']::text[], true,
  $s$Në frigorifer deri në 3 ditë.$s$,
  $s$Në porcione, deri në 3 muaj.$s$,
  $s$Ngroje mirë derisa të nxehet në mes.$s$,
  $s$Shtypi fasulet lehtë deri sa fëmija përtyp mirë.$s$,
  $s$Të rriturit shtojnë spec djegës, kripë dhe kos sipër.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-red', 'published', false, 770, 'editor'
),
(
  $s$kos-me-hurme-kaki-dhe-lajthi-te-bluara$s$, 'sq', $s$Kos me hurmë kaki dhe lajthi të bluara$s$,
  $s$Kos i plotë me hurmë kaki të butë dhe lajthi të bluara: ëmbëlsirë vjeshte pa sheqer.$s$,
  24, 60, 'family', array['puree']::text[], array['breakfast', 'snack']::text[], 5, 0,
  $s$2 tasa të vegjël$s$, 2,
  $s$[{"name":"kos i plotë pa sheqer","amount":200,"unit":"g","food_key":"yogurt"},{"name":"hurmë kaki shumë e butë","amount":1,"unit":"copë","food_key":"persimmon"},{"name":"lajthi të bluara imët","amount":1,"unit":"lugë gjelle","food_key":"ground_hazelnuts"}]$s$::jsonb,
  array[
    $s$Prite hurmën në gjysmë, hiq lëkurën dhe farat dhe shtype tulin me pirun.$s$,
    $s$Ndaj kosin në dy tasa, hidh hurmën sipër dhe spërkat lajthitë e bluara.$s$
  ]::text[],
  $s${"12+":"Me lugë; lajthitë vetëm të bluara imët."}$s$::jsonb,
  array['milk', 'tree_nut']::text[], array['vegetarian', 'gluten_free', 'egg_free']::text[], array['calcium', 'protein', 'fiber']::text[], false,
  $s$Hahet menjëherë.$s$,
  $s$Nuk ngrihet.$s$,
  $s$S'ngrohet: shërbehet e freskët.$s$,
  $s$Lajthitë vetëm të bluara imët: të plota jo para 5 vjeç.$s$,
  $s$Të rriturit shtojnë kanellë dhe lajthi të thekura.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-orange', 'published', false, 780, 'editor'
),
(
  $s$tershere-e-pjekur-me-vishnje-dhe-banane$s$, 'sq', $s$Tërshërë e pjekur me vishnje dhe banane$s$,
  $s$Tërshërë e pjekur në furrë me vishnje dhe banane: mëngjes i ngrohtë, i ëmbël vetëm nga frutat.$s$,
  24, 60, 'family', array['blw']::text[], array['breakfast', 'snack']::text[], 10, 25,
  $s$1 tavë e vogël, 6 katrorë$s$, 1,
  $s$[{"name":"tërshërë","amount":120,"unit":"g","food_key":"oats"},{"name":"banane të pjekura","amount":2,"unit":"copë","food_key":"banana"},{"name":"vishnje pa bërthamë","amount":150,"unit":"g","food_key":"sour_cherries"},{"name":"qumësht","amount":200,"unit":"ml","food_key":"milk"},{"name":"vezë","amount":1,"unit":"copë","food_key":"egg"}]$s$::jsonb,
  array[
    $s$Ngroh furrën në 180°C. Hiq bërthamat e vishnjeve dhe prit në katërsh.$s$,
    $s$Shtyp bananet dhe përziej me vezën, qumështin dhe tërshërën.$s$,
    $s$Hidhe në tavë, shpërnda vishnjet sipër dhe piqe 25 minuta, deri sa veza të jetë gatuar plotësisht në mes.$s$,
    $s$Lëre të ftohet 10 minuta dhe prite në katrorë.$s$
  ]::text[],
  $s${"12+":"Katrorë të vegjël, të vakët."}$s$::jsonb,
  array['egg', 'milk']::text[], array['vegetarian', 'nut_free']::text[], array['fiber', 'calcium']::text[], true,
  $s$Në frigorifer deri në 3 ditë.$s$,
  $s$Katrorët të ndarë me letër, deri në 2 muaj.$s$,
  $s$Ngrohi pak në furrë, deri sa të nxehen në mes.$s$,
  $s$Hiq gjithmonë bërthamat e vishnjeve dhe prit në katërsh.$s$,
  $s$Të rriturit e hanë me kos dhe arra.$s$,
  array['summer']::text[], false, 'plate-red', 'published', false, 790, 'editor'
),
(
  $s$pule-me-ananas-dhe-oriz$s$, 'sq', $s$Pulë me ananas dhe oriz$s$,
  $s$Pulë e gatuar me ananas, spec dhe oriz: shije e ëmbël dhe e thartë pa sheqer të shtuar.$s$,
  24, 60, 'family', array['blw']::text[], array['lunch', 'dinner']::text[], 15, 25,
  $s$1 fëmijë + 2 të rritur$s$, 1,
  $s$[{"name":"gjoks pule","amount":400,"unit":"g","food_key":"chicken"},{"name":"ananas i freskët","amount":200,"unit":"g","food_key":"pineapple"},{"name":"spec i kuq","amount":1,"unit":"copë","food_key":"pepper"},{"name":"oriz","amount":200,"unit":"g","food_key":"rice"},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null},{"name":"ujë","amount":100,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Ziej orizin sipas paketimit, pa kripë.$s$,
    $s$Prit pulën në kubikë dhe kaurdise në vaj deri sa të jetë gatuar plotësisht dhe të mos ketë rozë në mes.$s$,
    $s$Shto specin në shirita, ananasin në kubikë dhe ujin; gatuaje 8–10 minuta deri sa speci të butësohet.$s$,
    $s$Shërbeje mbi oriz; për fëmijën, pulën dhe ananasin prit në copa të vogla.$s$
  ]::text[],
  $s${"12+":"Pulë dhe ananas në copa të vogla, me oriz."}$s$::jsonb,
  array[]::text[], array['dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['protein', 'vitamin_c']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Pa orizin, në porcione, deri në 2 muaj.$s$,
  $s$Ngroje mirë derisa të nxehet në mes.$s$,
  $s$Pjesa e fortë e mesit të ananasit hiqet; pula në fije të vogla.$s$,
  $s$Të rriturit shtojnë salcë soje dhe xhenxhefil.$s$,
  array['summer']::text[], false, 'plate-yellow', 'published', false, 800, 'editor'
)
on conflict (slug) do nothing;
