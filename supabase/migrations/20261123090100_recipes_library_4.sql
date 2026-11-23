-- 20 receta të reja dimri (23 nëntor 2026): 5 për 6 muaj, 5 për 9 muaj, 6 për 12 muaj, 4 për 2 vjeç e lart.
-- Vetëm me ushqimet që janë tashmë në bazë (s'kërkon ushqime të reja). Fotot janë në app (assets/recipes/photos).
-- I sigurt për t'u ekzekutuar dy herë: recetat që ekzistojnë (sipas slug) nuk preken, as ndryshimet e adminit.
-- Nuk fshin asgjë. Kërkon migrimin 20261110090000_recipes.sql.

insert into public.recipes (slug, language, title, summary, age_min_months, age_max_months, stage, feeding_style, meal_types, prep_minutes, cook_minutes, yield_note, family_factor, ingredients, steps, serve_by_age, allergens, diet_tags, nutrients, freezer_friendly, storage_note, freezer_note, reheat_note, choking_note, family_tip, season, is_albanian, cover_key, status, featured, sort_order, source)
values
(
  $s$pure-me-presh-patate-dhe-kungull$s$, 'sq', $s$Pure me presh, patate dhe kungull$s$,
  $s$Presh i butë, patate dhe kungull: pure e ngrohtë dimri, e ëmbël natyrshëm.$s$,
  6, 24, 'pure', array['puree']::text[], array['lunch', 'dinner']::text[], 10, 20,
  $s$4 porcione bebe$s$, 3,
  $s$[{"name":"presh (pjesa e bardhë)","amount":1,"unit":"copë","food_key":"leek"},{"name":"patate","amount":1,"unit":"copë","food_key":"potato"},{"name":"kungull","amount":200,"unit":"g","food_key":"pumpkin"},{"name":"ujë","amount":300,"unit":"ml","food_key":null},{"name":"vaj ulliri","amount":1,"unit":"lugë çaji","food_key":null}]$s$::jsonb,
  array[
    $s$Laje mirë preshin, prit vetëm pjesën e bardhë në rrathë.$s$,
    $s$Qëroji patatet dhe kungullin dhe prit në kubikë.$s$,
    $s$Ziej gjithçka në ujë rreth 20 minuta, deri sa të butësohen krejt.$s$,
    $s$Bluaje me vajin dhe pak nga uji i zierjes deri sa të bëhet e lëmuar.$s$
  ]::text[],
  $s${"6-8":"Pure e lëmuar, me lugë.","9-11":"E shtypur me pirun, më e trashë.","12+":"Si supë e trashë me bukë."}$s$::jsonb,
  array[]::text[], array['vegetarian', 'dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['fiber', 'vitamin_c']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Në kallëpe akulli, deri në 2 muaj.$s$,
  $s$Ngroje butë dhe përzieje mirë.$s$,
  $s$Preshi duhet të jetë i zier krejt, pa fije të forta.$s$,
  $s$Për të rriturit bëhet supë me pak kripë dhe piper.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-yellow', 'published', false, 810, 'editor'
),
(
  $s$pure-brokoli-me-dardhe$s$, 'sq', $s$Pure brokoli me dardhë$s$,
  $s$Brokoli në avull me dardhë të pjekur: jeshile, e butë dhe pak e ëmbël.$s$,
  6, 24, 'pure', array['puree']::text[], array['lunch', 'dinner']::text[], 10, 12,
  $s$3 porcione bebe$s$, 3,
  $s$[{"name":"brokoli","amount":150,"unit":"g","food_key":"broccoli"},{"name":"dardhë e pjekur","amount":1,"unit":"copë","food_key":"pear"},{"name":"ujë","amount":100,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Ndaje brokolin në lule të vogla dhe qëroje dardhën.$s$,
    $s$Gatuaji në avull rreth 10–12 minuta, deri sa brokoli të shtypet lehtë me pirun.$s$,
    $s$Bluaji me pak ujë deri sa pureja të jetë e lëmuar.$s$
  ]::text[],
  $s${"6-8":"Pure e lëmuar, me lugë.","9-11":"E shtypur, ose lule brokoli të buta për t'i mbajtur në dorë.","12+":"Lule brokoli në avull dhe dardhë në feta."}$s$::jsonb,
  array[]::text[], array['vegetarian', 'dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['vitamin_c', 'fiber']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Në kallëpe akulli, deri në 1 muaj.$s$,
  $s$Ngroje butë; mos e ziej përsëri.$s$,
  $s$Brokoli duhet të jetë aq i butë sa të shtypet mes gishtave.$s$,
  $s$Të rriturit e hanë brokolin me limon dhe vaj ulliri.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-green', 'published', false, 820, 'editor'
),
(
  $s$qull-orizi-me-ftua$s$, 'sq', $s$Qull orizi me ftua$s$,
  $s$Oriz i zier butë me ftua të gatuar: qull mëngjesi me aromë dimri.$s$,
  6, 36, 'pure', array['puree']::text[], array['breakfast']::text[], 10, 30,
  $s$3 porcione bebe$s$, 3,
  $s$[{"name":"oriz","amount":40,"unit":"g","food_key":"rice"},{"name":"ftua","amount":1,"unit":"copë","food_key":"quince"},{"name":"ujë","amount":400,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Qëroje ftuan, hiq farat dhe prite në kubikë të vegjël.$s$,
    $s$Ziej orizin dhe ftuan në ujë rreth 30 minuta, deri sa të dyja të jenë shumë të buta.$s$,
    $s$Bluaje deri sa të bëhet qull i lëmuar; holloje me pak ujë nëse duhet.$s$
  ]::text[],
  $s${"6-8":"I lëmuar dhe i vakët, me lugë.","9-11":"Më i trashë, me ftuan të shtypur.","12+":"Si qull mëngjesi me kos."}$s$::jsonb,
  array[]::text[], array['vegetarian', 'dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['fiber', 'vitamin_c']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Në kallëpe akulli, deri në 1 muaj.$s$,
  $s$Ngroje me pak ujë dhe përzieje.$s$,
  $s$Ftoi jepet gjithmonë i gatuar, kurrë i papjekur.$s$,
  $s$Të rriturit e hanë me kanellë dhe arra të grira.$s$,
  array['autumn', 'winter']::text[], true, 'bowl-white', 'published', false, 830, 'editor'
),
(
  $s$pure-kungull-me-qiqra$s$, 'sq', $s$Pure kungull me qiqra$s$,
  $s$Kungull i pjekur dhe qiqra të ziera: pure e butë me hekur dhe proteina.$s$,
  6, 24, 'pure', array['puree']::text[], array['lunch', 'dinner']::text[], 10, 30,
  $s$4 porcione bebe$s$, 3,
  $s$[{"name":"kungull","amount":300,"unit":"g","food_key":"pumpkin"},{"name":"qiqra të ziera","amount":100,"unit":"g","food_key":"chickpeas"},{"name":"vaj ulliri","amount":1,"unit":"lugë çaji","food_key":null},{"name":"ujë","amount":100,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Prit kungullin në kubikë dhe piqe në furrë në 200 °C rreth 25–30 minuta, deri sa të butësohet.$s$,
    $s$Shpëlaji qiqrat dhe hiqu lëvozhgat sa të mundesh.$s$,
    $s$Bluaji kungullin dhe qiqrat me vajin dhe ujin deri sa pureja të jetë e lëmuar.$s$
  ]::text[],
  $s${"6-8":"Pure e lëmuar, me lugë.","9-11":"E shtypur me pirun, me qiqra të shtypura.","12+":"Si humus i butë me bukë ose perime."}$s$::jsonb,
  array[]::text[], array['vegetarian', 'dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['iron', 'protein', 'fiber']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Në kallëpe akulli, deri në 2 muaj.$s$,
  $s$Ngroje butë dhe përzieje.$s$,
  $s$Qiqrat duhet të jenë të shtypura krejt; kurrë kokrra të plota para 3 vjeç.$s$,
  $s$Të rriturit e shtojnë me tahini dhe limon si salcë.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-orange', 'published', false, 840, 'editor'
),
(
  $s$pure-trofte-me-patate-te-embel$s$, 'sq', $s$Pure troftë me patate të ëmbël$s$,
  $s$Troftë e butë me patate të ëmbël: pure e lëmuar me omega-3.$s$,
  6, 24, 'pure', array['puree']::text[], array['lunch', 'dinner']::text[], 10, 20,
  $s$3 porcione bebe$s$, 3,
  $s$[{"name":"fileto trofte pa kocka","amount":100,"unit":"g","food_key":"trout"},{"name":"patate të ëmbël","amount":1,"unit":"copë","food_key":"sweet_potato"},{"name":"ujë","amount":300,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Qëroje pataten e ëmbël, prite në kubikë dhe ziej 12 minuta.$s$,
    $s$Shto troftën sipër dhe gatuaje edhe 6–8 minuta, deri sa të jetë gatuar plotësisht dhe të ndahet lehtë.$s$,
    $s$Kontrollo me gishta që s'ka mbetur asnjë kockë.$s$,
    $s$Bluaji me pak nga uji i zierjes deri sa të bëhet pure e lëmuar.$s$
  ]::text[],
  $s${"6-8":"Pure e lëmuar, me lugë.","9-11":"E shtypur me pirun.","12+":"Troftë në copa me patate të ëmbël të pjekur."}$s$::jsonb,
  array['fish']::text[], array['dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['omega3', 'protein']::text[], true,
  $s$Në frigorifer deri në 1 ditë.$s$,
  $s$Në kallëpe akulli, deri në 1 muaj.$s$,
  $s$Ngroje mirë derisa të nxehet në mes.$s$,
  $s$Kontrollo dy herë për kocka; peshku jepet gjithmonë i gatuar plotësisht.$s$,
  $s$Të rriturit e hanë troftën me limon dhe sallatë.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-orange', 'published', false, 850, 'editor'
),
(
  $s$petulla-me-brokoli-dhe-djathe$s$, 'sq', $s$Petulla me brokoli dhe djathë$s$,
  $s$Petulla të vogla e të buta me brokoli dhe djathë, për t'i mbajtur vetë në dorë.$s$,
  9, 60, 'finger', array['blw']::text[], array['lunch', 'snack']::text[], 10, 15,
  $s$12 petulla të vogla$s$, 2,
  $s$[{"name":"brokoli","amount":120,"unit":"g","food_key":"broccoli"},{"name":"vezë","amount":1,"unit":"copë","food_key":"egg"},{"name":"miell gruri","amount":3,"unit":"lugë gjelle","food_key":"wheat_flour"},{"name":"djathë i bardhë i shpëlarë","amount":30,"unit":"g","food_key":"cheese"},{"name":"vaj ulliri","amount":1,"unit":"lugë çaji","food_key":null}]$s$::jsonb,
  array[
    $s$Gatuaje brokolin në avull 8 minuta dhe grije shumë imët.$s$,
    $s$Rrihe vezën, shto brokolin, miellin dhe djathin e grirë.$s$,
    $s$Vendos lugë të vogla brumi në tigan me pak vaj dhe piqi 3 minuta nga çdo anë, deri sa veza të jetë gatuar plotësisht.$s$
  ]::text[],
  $s${"9-11":"Petulla të vogla, të prera në shirita.","12+":"Petulla të plota, me kos."}$s$::jsonb,
  array['egg', 'milk', 'wheat']::text[], array['vegetarian', 'nut_free']::text[], array['calcium', 'protein', 'vitamin_c']::text[], true,
  $s$Në frigorifer deri në 2 ditë, në enë të mbyllur.$s$,
  $s$Të ftohura, me letër mes tyre, deri në 1 muaj.$s$,
  $s$Ngrohi në tigan ose furrë, jo shumë të forta.$s$,
  $s$Petullat duhet të jenë të buta brenda; prit në shirita sa një gisht.$s$,
  $s$Të rriturit i hanë me salcë kosi dhe hudhre.$s$,
  array['autumn', 'winter', 'spring']::text[], false, 'plate-green', 'published', false, 860, 'editor'
),
(
  $s$rizoto-e-bute-me-kungull-dhe-pule$s$, 'sq', $s$Rizoto e butë me kungull dhe pulë$s$,
  $s$Oriz kremoz me kungull dhe pulë të grirë: gjellë e plotë dimri.$s$,
  9, 60, 'mashed', array['puree', 'blw']::text[], array['lunch', 'dinner']::text[], 10, 30,
  $s$1 fëmijë + 2 të rritur$s$, 1,
  $s$[{"name":"oriz","amount":150,"unit":"g","food_key":"rice"},{"name":"kungull","amount":250,"unit":"g","food_key":"pumpkin"},{"name":"gjoks pule","amount":200,"unit":"g","food_key":"chicken"},{"name":"qepë","amount":1,"unit":"copë","food_key":"onion"},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null},{"name":"ujë i nxehtë","amount":700,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Grije qepën imët dhe kaurdise butë në vaj.$s$,
    $s$Shto pulën në kubikë të vegjël dhe gatuaje deri sa të jetë gatuar plotësisht.$s$,
    $s$Shto orizin dhe kungullin në kubikë, pastaj ujin pak nga pak, duke e përzier, rreth 20 minuta.$s$,
    $s$Kur orizi të jetë i butë dhe kremoz, ndaje porcionin e fëmijës para se të shtosh erëza.$s$
  ]::text[],
  $s${"9-11":"E shtypur lehtë me pirun, pula e grirë imët.","12+":"Siç është, me pulën në copa të vogla."}$s$::jsonb,
  array[]::text[], array['dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['protein', 'vitamin_c']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Në porcione, deri në 1 muaj.$s$,
  $s$Ngroje me pak ujë derisa të nxehet në mes.$s$,
  $s$Pula në fije të holla ose e grirë; orizi i butë, jo kokrra të forta.$s$,
  $s$Të rriturit shtojnë djathë parmixhano dhe piper.$s$,
  array['autumn', 'winter']::text[], false, 'plate-yellow', 'published', false, 870, 'editor'
),
(
  $s$makarona-te-vogla-me-salce-panxhari$s$, 'sq', $s$Makarona të vogla me salcë panxhari$s$,
  $s$Salcë rozë nga panxhari dhe rikota: makarona që fëmijët i duan për ngjyrën.$s$,
  9, 60, 'mashed', array['blw']::text[], array['lunch', 'dinner']::text[], 10, 15,
  $s$1 fëmijë + 2 të rritur$s$, 1,
  $s$[{"name":"makarona të vogla","amount":200,"unit":"g","food_key":"pasta"},{"name":"panxhar i zier","amount":1,"unit":"copë","food_key":"beetroot"},{"name":"rikotë","amount":100,"unit":"g","food_key":"ricotta"},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null}]$s$::jsonb,
  array[
    $s$Ziej makaronat derisa të jenë më të buta se zakonisht.$s$,
    $s$Bluaje panxharin e zier me rikotën dhe vajin deri sa salca të jetë e lëmuar.$s$,
    $s$Përzieji makaronat e kulluara me salcën, në zjarr të ulët, 1–2 minuta.$s$
  ]::text[],
  $s${"9-11":"Makarona të vogla e të buta, të përziera mirë.","12+":"Me pak djathë të grirë sipër."}$s$::jsonb,
  array['milk', 'wheat']::text[], array['vegetarian', 'egg_free', 'nut_free']::text[], array['calcium', 'fiber']::text[], false,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Salca ngrihet veçmas, deri në 1 muaj; makaronat jo.$s$,
  $s$Ngroje me pak ujë dhe përzieje.$s$,
  $s$Makaronat të buta; për më të vegjlit, prit në copa më të vogla.$s$,
  $s$Të rriturit e shtojnë me arra të thekura dhe borzilok.$s$,
  array['autumn', 'winter']::text[], false, 'plate-pink', 'published', false, 880, 'editor'
),
(
  $s$tershere-me-molle-te-pjekur-dhe-kanelle$s$, 'sq', $s$Tërshërë me mollë të pjekur dhe kanellë$s$,
  $s$Qull tërshëre me qumësht të gatuar dhe mollë të pjekur, me pak kanellë.$s$,
  9, 60, 'mashed', array['puree']::text[], array['breakfast']::text[], 5, 10,
  $s$2 porcione fëmije$s$, 2,
  $s$[{"name":"tërshërë e imët","amount":40,"unit":"g","food_key":"oats"},{"name":"qumësht","amount":250,"unit":"ml","food_key":"milk"},{"name":"mollë","amount":1,"unit":"copë","food_key":"apple"},{"name":"kanellë","amount":1,"unit":"lugë çaji","food_key":null}]$s$::jsonb,
  array[
    $s$Qëroje mollën, prite në kubikë të vegjël dhe gatuaje me pak ujë 5 minuta, deri sa të butësohet.$s$,
    $s$Ziej tërshërën në qumësht rreth 5 minuta, duke e përzier.$s$,
    $s$Shto mollën dhe një majë kanelle; shtype mollën me pirun.$s$
  ]::text[],
  $s${"9-11":"I vakët, me mollën e shtypur.","12+":"Me mollë në kubikë të butë."}$s$::jsonb,
  array['milk']::text[], array['vegetarian', 'egg_free', 'nut_free']::text[], array['fiber', 'calcium']::text[], false,
  $s$Në frigorifer deri në 1 ditë.$s$,
  $s$S'ngrihet mirë; bëje të freskët.$s$,
  $s$Ngroje me pak qumësht dhe përzieje.$s$,
  $s$Molla gjithmonë e gatuar para 12 muajsh; qumështi i lopës vetëm i gatuar.$s$,
  $s$Të rriturit shtojnë arra të grira dhe pak shurup panje.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-brown', 'published', false, 890, 'editor'
),
(
  $s$shkopinj-polente-me-spinaq$s$, 'sq', $s$Shkopinj polente me spinaq$s$,
  $s$Polentë me spinaq dhe djathë, e ftohur dhe e prerë në shkopinj për dorë.$s$,
  9, 60, 'finger', array['blw']::text[], array['lunch', 'snack']::text[], 10, 20,
  $s$16 shkopinj$s$, 2,
  $s$[{"name":"miell misri","amount":100,"unit":"g","food_key":"cornmeal"},{"name":"ujë","amount":500,"unit":"ml","food_key":null},{"name":"spinaq","amount":80,"unit":"g","food_key":"spinach"},{"name":"djathë i bardhë i shpëlarë","amount":40,"unit":"g","food_key":"cheese"},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null}]$s$::jsonb,
  array[
    $s$Ziej spinaqin 2 minuta, kulloje dhe grije shumë imët.$s$,
    $s$Vlo ujin, hidh miellin e misrit pak nga pak dhe përzieje 10–12 minuta deri sa të trashet.$s$,
    $s$Shto spinaqin dhe djathin, hidhe në tavë 2 cm të trashë dhe lëre të ftohet.$s$,
    $s$Prit në shkopinj dhe piqi në furrë në 200 °C rreth 8 minuta, me pak vaj.$s$
  ]::text[],
  $s${"9-11":"Shkopinj të butë sa një gisht.","12+":"Shkopinj me kos ose salcë domateje."}$s$::jsonb,
  array['milk']::text[], array['vegetarian', 'gluten_free', 'egg_free', 'nut_free']::text[], array['iron', 'calcium']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Të prera, deri në 1 muaj.$s$,
  $s$Ngrohi në furrë që të mos zbuten.$s$,
  $s$Shkopinjtë duhet të jenë të butë brenda; jo kore e fortë.$s$,
  $s$Të rriturit i hanë si garniturë pranë mishit.$s$,
  array['autumn', 'winter']::text[], true, 'plate-yellow', 'published', false, 900, 'editor'
),
(
  $s$supe-me-qofte-te-vogla-gjeldeti$s$, 'sq', $s$Supë me qofte të vogla gjeldeti$s$,
  $s$Supë e ngrohtë me qofte të vogla gjeldeti, oriz dhe perime.$s$,
  12, 60, 'family', array['blw']::text[], array['lunch', 'dinner']::text[], 20, 25,
  $s$1 fëmijë + 2 të rritur$s$, 1,
  $s$[{"name":"mish gjeldeti i grirë","amount":300,"unit":"g","food_key":"turkey"},{"name":"oriz","amount":50,"unit":"g","food_key":"rice"},{"name":"karotë","amount":2,"unit":"copë","food_key":"carrot"},{"name":"selino","amount":1,"unit":"copë","food_key":"celery"},{"name":"qepë","amount":1,"unit":"copë","food_key":"onion"},{"name":"ujë","amount":1200,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Përziej mishin e grirë me qepën e grirë shumë imët dhe bëji qofte sa një arrë e vogël.$s$,
    $s$Ziej karotat dhe selinon në kubikë në ujë 10 minuta.$s$,
    $s$Shto orizin dhe qoftet dhe ziej edhe 15 minuta, deri sa qoftet të jenë gatuar plotësisht.$s$,
    $s$Ndaje porcionin e fëmijës para se të shtosh kripë.$s$
  ]::text[],
  $s${"12+":"Qoftet të prera në katërsh, me perime dhe pak lëng."}$s$::jsonb,
  array[]::text[], array['dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['protein', 'iron']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Në porcione, deri në 2 muaj.$s$,
  $s$Ngroje mirë derisa të vlojë.$s$,
  $s$Qoftet priten në katërsh; karotat të buta krejt.$s$,
  $s$Të rriturit shtojnë limon dhe majdanoz.$s$,
  array['autumn', 'winter']::text[], true, 'bowl-orange', 'published', false, 910, 'editor'
),
(
  $s$tave-me-presh-dhe-pule$s$, 'sq', $s$Tavë me presh dhe pulë$s$,
  $s$Pulë dhe presh në furrë me patate: gjellë shtëpie e butë dimri.$s$,
  12, 60, 'family', array['blw']::text[], array['lunch', 'dinner']::text[], 15, 45,
  $s$1 fëmijë + 2 të rritur$s$, 1,
  $s$[{"name":"kofshë pule pa kocka","amount":400,"unit":"g","food_key":"chicken"},{"name":"presh","amount":2,"unit":"copë","food_key":"leek"},{"name":"patate","amount":3,"unit":"copë","food_key":"potato"},{"name":"vaj ulliri","amount":2,"unit":"lugë gjelle","food_key":null},{"name":"ujë","amount":200,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Prit preshin në rrathë dhe patatet në kubikë.$s$,
    $s$Vendosi në tavë me pulën në copa, vajin dhe ujin.$s$,
    $s$Piqe në 190 °C rreth 45 minuta, deri sa pula të jetë gatuar plotësisht dhe patatet të butësohen.$s$,
    $s$Për fëmijën, prit pulën në fije të vogla dhe shtyp patatet lehtë.$s$
  ]::text[],
  $s${"12+":"Pulë në fije, patate dhe presh të butë."}$s$::jsonb,
  array[]::text[], array['dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['protein', 'vitamin_c']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Në porcione, deri në 2 muaj.$s$,
  $s$Ngroje mirë derisa të nxehet në mes.$s$,
  $s$Pula pa kocka dhe në fije; preshi i pjekur deri sa të jetë i butë.$s$,
  $s$Të rriturit shtojnë kripë, piper dhe pak trumzë.$s$,
  array['autumn', 'winter']::text[], true, 'plate-brown', 'published', false, 920, 'editor'
),
(
  $s$makarona-me-salmon-dhe-bizele$s$, 'sq', $s$Makarona me salmon dhe bizele$s$,
  $s$Makarona me salmon, bizele dhe kos: darkë e shpejtë me omega-3.$s$,
  12, 60, 'family', array['blw']::text[], array['lunch', 'dinner']::text[], 10, 15,
  $s$1 fëmijë + 2 të rritur$s$, 1,
  $s$[{"name":"makarona","amount":200,"unit":"g","food_key":"pasta"},{"name":"fileto salmoni pa lëkurë","amount":200,"unit":"g","food_key":"salmon"},{"name":"bizele","amount":100,"unit":"g","food_key":"peas"},{"name":"kos","amount":100,"unit":"g","food_key":"yogurt"},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null}]$s$::jsonb,
  array[
    $s$Ziej makaronat; 4 minutat e fundit shto bizelet.$s$,
    $s$Gatuaje salmonin në tigan me vaj 4 minuta nga çdo anë, deri sa të jetë gatuar plotësisht, dhe ndaje në copa.$s$,
    $s$Kontrollo për kocka dhe përzieji të gjitha me kosin, jashtë zjarrit.$s$
  ]::text[],
  $s${"12+":"Makarona të buta, salmon në copa, bizele të shtypura lehtë."}$s$::jsonb,
  array['fish', 'milk', 'wheat']::text[], array['egg_free', 'nut_free']::text[], array['omega3', 'protein', 'calcium']::text[], false,
  $s$Në frigorifer deri në 1 ditë.$s$,
  $s$S'ngrihet mirë.$s$,
  $s$Ngroje butë, pa e vluar kosin.$s$,
  $s$Bizelet shtypen lehtë për fëmijët nën 3 vjeç; peshku pa kocka.$s$,
  $s$Të rriturit shtojnë limon, kopër dhe piper.$s$,
  array['winter', 'spring']::text[], false, 'plate-pink', 'published', false, 930, 'editor'
),
(
  $s$qengj-me-fasule-te-bardha$s$, 'sq', $s$Qengj me fasule të bardha$s$,
  $s$Mish qengji i zier ngadalë me fasule të bardha dhe domate.$s$,
  12, 60, 'family', array['blw']::text[], array['lunch', 'dinner']::text[], 15, 90,
  $s$1 fëmijë + 3 të rritur$s$, 1,
  $s$[{"name":"mish qengji pa kocka","amount":400,"unit":"g","food_key":"lamb"},{"name":"fasule të bardha të ziera","amount":250,"unit":"g","food_key":"white_beans"},{"name":"domate të grira","amount":200,"unit":"g","food_key":"tomato"},{"name":"qepë","amount":1,"unit":"copë","food_key":"onion"},{"name":"karotë","amount":1,"unit":"copë","food_key":"carrot"},{"name":"ujë","amount":600,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Prit mishin në kubikë të vegjël dhe hiq yndyrën e tepërt.$s$,
    $s$Kaurdis qepën dhe karotën, shto mishin dhe ujin dhe ziej ngadalë 60 minuta.$s$,
    $s$Shto domatet dhe fasulet dhe ziej edhe 30 minuta, deri sa mishi të jetë gatuar plotësisht dhe të shpërbëhet.$s$,
    $s$Për fëmijën, shtype mishin dhe fasulet lehtë.$s$
  ]::text[],
  $s${"12+":"Mish i shpërbërë dhe fasule të shtypura lehtë."}$s$::jsonb,
  array[]::text[], array['dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['iron', 'protein', 'fiber']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Në porcione, deri në 3 muaj.$s$,
  $s$Ngroje mirë derisa të vlojë.$s$,
  $s$Mishi duhet të shpërbëhet me pirun; fasulet të shtypura.$s$,
  $s$Të rriturit shtojnë speca djegës dhe nenexhik të thatë.$s$,
  array['winter']::text[], true, 'plate-red', 'published', false, 940, 'editor'
),
(
  $s$bulgur-me-perime$s$, 'sq', $s$Bulgur me perime$s$,
  $s$Pilaf bulguri me karotë, bizele dhe kungull të njomë.$s$,
  12, 60, 'family', array['blw']::text[], array['lunch', 'dinner']::text[], 10, 20,
  $s$1 fëmijë + 2 të rritur$s$, 1,
  $s$[{"name":"bulgur","amount":150,"unit":"g","food_key":"bulgur"},{"name":"karotë","amount":1,"unit":"copë","food_key":"carrot"},{"name":"bizele","amount":80,"unit":"g","food_key":"peas"},{"name":"kungull i njomë","amount":1,"unit":"copë","food_key":"zucchini"},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null},{"name":"ujë","amount":350,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Prit karotën dhe kungullin e njomë në kubikë të vegjël dhe kaurdisi në vaj 5 minuta.$s$,
    $s$Shto bulgurin, bizelet dhe ujin dhe ziej me kapak 15 minuta, deri sa uji të thithet.$s$,
    $s$Lëre 5 minuta me kapak dhe përzieje me pirun.$s$
  ]::text[],
  $s${"12+":"I butë, me perimet të shtypura lehtë."}$s$::jsonb,
  array['wheat']::text[], array['vegetarian', 'dairy_free', 'egg_free', 'nut_free']::text[], array['fiber', 'iron']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Në porcione, deri në 2 muaj.$s$,
  $s$Ngroje me pak ujë.$s$,
  $s$Bizelet të buta; për më të vegjlit, shtypi lehtë.$s$,
  $s$Të rriturit e hanë me kos me hudhër.$s$,
  array['autumn', 'winter', 'spring']::text[], true, 'plate-orange', 'published', false, 950, 'editor'
),
(
  $s$kos-me-kungull-te-pjekur-dhe-kanelle$s$, 'sq', $s$Kos me kungull të pjekur dhe kanellë$s$,
  $s$Kos i trashë me pure kungulli të pjekur dhe pak kanellë: vakt i lehtë dimri.$s$,
  12, 60, 'family', array['puree', 'blw']::text[], array['breakfast', 'snack']::text[], 5, 30,
  $s$2 porcione fëmije$s$, 2,
  $s$[{"name":"kungull","amount":200,"unit":"g","food_key":"pumpkin"},{"name":"kos","amount":200,"unit":"g","food_key":"yogurt"},{"name":"kanellë","amount":1,"unit":"lugë çaji","food_key":null},{"name":"arra të bluara","amount":1,"unit":"lugë gjelle","food_key":"ground_walnuts"}]$s$::jsonb,
  array[
    $s$Piqe kungullin në kubikë në 200 °C rreth 30 minuta dhe shtype në pure.$s$,
    $s$Përziej purenë me kosin dhe një majë kanelle.$s$,
    $s$Hidh sipër arrat e bluara.$s$
  ]::text[],
  $s${"12+":"Me lugë, ose me bukë të thekur për ta ngjyer."}$s$::jsonb,
  array['milk', 'tree_nut']::text[], array['vegetarian', 'gluten_free', 'egg_free']::text[], array['calcium', 'vitamin_c']::text[], false,
  $s$Pureja në frigorifer deri në 3 ditë; përzieje me kos kur ta shërbesh.$s$,
  $s$Pureja e kungullit ngrihet deri në 2 muaj.$s$,
  $s$Hahet e ftohtë ose e vakët.$s$,
  $s$Arrat vetëm të bluara, kurrë të plota.$s$,
  $s$Të rriturit shtojnë granola dhe pak shurup panje.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-orange', 'published', false, 960, 'editor'
),
(
  $s$fasule-te-zeza-me-oriz-dhe-miser$s$, 'sq', $s$Fasule të zeza me oriz dhe misër$s$,
  $s$Fasule të zeza, oriz, misër dhe spec: pjatë plot ngjyra dhe hekur.$s$,
  24, 60, 'family', array['blw']::text[], array['lunch', 'dinner']::text[], 10, 25,
  $s$1 fëmijë + 2 të rritur$s$, 1,
  $s$[{"name":"fasule të zeza të ziera","amount":250,"unit":"g","food_key":"black_beans"},{"name":"oriz","amount":150,"unit":"g","food_key":"rice"},{"name":"misër","amount":100,"unit":"g","food_key":"corn"},{"name":"spec i kuq","amount":1,"unit":"copë","food_key":"pepper"},{"name":"qepë","amount":1,"unit":"copë","food_key":"onion"},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null}]$s$::jsonb,
  array[
    $s$Ziej orizin sipas paketimit.$s$,
    $s$Kaurdis qepën dhe specin të grirë imët në vaj 6–8 minuta.$s$,
    $s$Shto fasulet dhe misrin dhe gatuaji 5 minuta, duke shtypur pak fasule që salca të trashet.$s$,
    $s$Shërbeji pranë orizit.$s$
  ]::text[],
  $s${"12+":"Fasule të shtypura lehtë, misri i shtypur, me oriz."}$s$::jsonb,
  array[]::text[], array['vegetarian', 'dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['iron', 'fiber', 'protein']::text[], true,
  $s$Në frigorifer deri në 2 ditë.$s$,
  $s$Fasulet pa orizin, deri në 3 muaj.$s$,
  $s$Ngroje me pak ujë.$s$,
  $s$Kokrrat e misrit shtypen lehtë për fëmijët nën 4 vjeç.$s$,
  $s$Të rriturit shtojnë avokado, limon dhe djegës.$s$,
  array['autumn', 'winter']::text[], false, 'plate-brown', 'published', false, 970, 'editor'
),
(
  $s$pule-me-salce-tahini-dhe-brokoli$s$, 'sq', $s$Pulë me salcë tahini dhe brokoli$s$,
  $s$Pulë e pjekur dhe brokoli me salcë të butë tahini e limoni.$s$,
  24, 60, 'family', array['blw']::text[], array['lunch', 'dinner']::text[], 10, 25,
  $s$1 fëmijë + 2 të rritur$s$, 1,
  $s$[{"name":"gjoks pule","amount":400,"unit":"g","food_key":"chicken"},{"name":"brokoli","amount":250,"unit":"g","food_key":"broccoli"},{"name":"tahini","amount":2,"unit":"lugë gjelle","food_key":"tahini"},{"name":"lëng limoni","amount":1,"unit":"lugë gjelle","food_key":"lemon"},{"name":"ujë","amount":3,"unit":"lugë gjelle","food_key":null},{"name":"vaj ulliri","amount":1,"unit":"lugë gjelle","food_key":null}]$s$::jsonb,
  array[
    $s$Prit pulën në copa, lyeje me vaj dhe piqe në 200 °C rreth 20–25 minuta, deri sa të jetë gatuar plotësisht.$s$,
    $s$Gatuaje brokolin në avull 8 minuta.$s$,
    $s$Përziej tahinin me limonin dhe ujin deri sa salca të jetë e lëmuar.$s$,
    $s$Hidh salcën sipër pulës dhe brokolit.$s$
  ]::text[],
  $s${"12+":"Pulë në copa të vogla, brokoli i butë, salca sipër."}$s$::jsonb,
  array['sesame']::text[], array['dairy_free', 'gluten_free', 'egg_free', 'nut_free']::text[], array['protein', 'calcium', 'vitamin_c']::text[], false,
  $s$Në frigorifer deri në 2 ditë; salca veçmas.$s$,
  $s$Pula ngrihet pa salcë, deri në 2 muaj.$s$,
  $s$Ngroje mirë derisa të nxehet në mes.$s$,
  $s$Pula në copa të vogla; tahini i holluar në salcë, jo me lugë të plotë.$s$,
  $s$Të rriturit shtojnë hudhër dhe susam të thekur.$s$,
  array['autumn', 'winter', 'spring']::text[], false, 'plate-green', 'published', false, 980, 'editor'
),
(
  $s$supe-domateje-me-oriz$s$, 'sq', $s$Supë domateje me oriz$s$,
  $s$Supë e trashë domateje me oriz dhe pak djathë: e ngrohtë për mbrëmjet e ftohta.$s$,
  24, 60, 'family', array['puree']::text[], array['lunch', 'dinner']::text[], 10, 30,
  $s$1 fëmijë + 2 të rritur$s$, 1,
  $s$[{"name":"domate të grira","amount":400,"unit":"g","food_key":"tomato"},{"name":"oriz","amount":60,"unit":"g","food_key":"rice"},{"name":"qepë","amount":1,"unit":"copë","food_key":"onion"},{"name":"karotë","amount":1,"unit":"copë","food_key":"carrot"},{"name":"djathë i bardhë i shpëlarë","amount":30,"unit":"g","food_key":"cheese"},{"name":"ujë","amount":700,"unit":"ml","food_key":null}]$s$::jsonb,
  array[
    $s$Kaurdis qepën dhe karotën të grirë në pak ujë ose vaj 5 minuta.$s$,
    $s$Shto domatet dhe ujin dhe ziej 15 minuta; bluaje me blender.$s$,
    $s$Shto orizin dhe ziej edhe 15 minuta, deri sa të butësohet.$s$,
    $s$Shërbeje me pak djathë të grirë sipër.$s$
  ]::text[],
  $s${"12+":"E vakët, me djathë të grirë sipër."}$s$::jsonb,
  array['milk']::text[], array['vegetarian', 'gluten_free', 'egg_free', 'nut_free']::text[], array['vitamin_c', 'calcium']::text[], true,
  $s$Në frigorifer deri në 3 ditë.$s$,
  $s$Pa djathin, deri në 2 muaj.$s$,
  $s$Ngroje mirë dhe holloje me pak ujë.$s$,
  $s$Orizi i butë; supa e vakët, jo e nxehtë.$s$,
  $s$Të rriturit shtojnë borzilok dhe bukë të thekur.$s$,
  array['autumn', 'winter']::text[], false, 'bowl-red', 'published', false, 990, 'editor'
),
(
  $s$smoothie-kefiri-me-banane-dhe-hurma$s$, 'sq', $s$Smoothie kefiri me banane dhe hurma$s$,
  $s$Kefir, banane dhe hurma të bluara: pije e ëmbël natyrshëm, pa sheqer të shtuar.$s$,
  24, 60, 'family', array['puree']::text[], array['breakfast', 'snack']::text[], 5, 0,
  $s$2 gota fëmije$s$, 2,
  $s$[{"name":"kefir","amount":250,"unit":"ml","food_key":"kefir"},{"name":"banane e pjekur","amount":1,"unit":"copë","food_key":"banana"},{"name":"hurma pa bërthamë","amount":2,"unit":"copë","food_key":"dates"},{"name":"tërshërë e imët","amount":1,"unit":"lugë gjelle","food_key":"oats"}]$s$::jsonb,
  array[
    $s$Njomi hurmat në ujë të ngrohtë 10 minuta dhe hiqu bërthamën nëse ka mbetur.$s$,
    $s$Bluaji të gjitha deri sa pija të jetë krejt e lëmuar, pa copa hurme.$s$
  ]::text[],
  $s${"12+":"Në gotë të hapur, ndërsa fëmija rri ulur."}$s$::jsonb,
  array['milk']::text[], array['vegetarian', 'egg_free', 'nut_free']::text[], array['calcium', 'fiber']::text[], false,
  $s$Pihet e freskët; në frigorifer deri në 1 ditë.$s$,
  $s$Në kallëpe akulloreje, deri në 1 muaj.$s$,
  $s$S'ngrohet; përzieje para se ta pish.$s$,
  $s$Hurmat bluhen krejt; asnjë copë e plotë.$s$,
  $s$Të rriturit shtojnë kakao dhe pak gjalpë kikiriku.$s$,
  array['autumn', 'winter', 'spring', 'summer']::text[], false, 'bowl-white', 'published', false, 1000, 'editor'
)
on conflict (slug) do nothing;
