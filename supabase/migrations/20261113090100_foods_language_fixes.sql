-- Recetat 🥣: shqip standard dhe i njësuar te 31 ushqime të para.
-- "purè" → "pure" (drejtshkrimi shqip s'ka "è"), "zemër" → "vakt i lehtë", "muffina" → "mafina", "mbysin" → "mbytin",
-- "e kremtë" → "kremoze".
-- I sigurt për t'u ekzekutuar dy herë: çdo fushë ndryshon vetëm kur ka ende tekstin e vjetër, ndaj ndryshimet e adminit
-- te paneli s'preken dhe ekzekutimi i dytë s'bën asgjë. Nuk fshin asgjë.
-- Kërkon migrimin 20261111090100_foods_library_1.
-- Kthimi, vetëm nëse e do: të njëjtat update, me tekstin e ri dhe të vjetër të ndërruar.

update public.foods set serve_by_age = $s${"6-8":"E pjekur ose e zier derisa shtypet lehtë: pure ose feta të buta sa gishti. Jo e gjallë.","9-11":"E zier në copa të vogla të buta, ose e gjallë vetëm e grirë hollë.","12+":"E gjallë vetëm e grirë ose në feta shumë të holla; copat e forta mbeten rrezik."}$s$::jsonb
  where food_key = 'apple' and serve_by_age = $s${"6-8":"E pjekur ose e zier derisa shtypet lehtë: purè ose feta të buta sa gishti. Jo e gjallë.","9-11":"E zier në copa të vogla të buta, ose e gjallë vetëm e grirë hollë.","12+":"E gjallë vetëm e grirë ose në feta shumë të holla; copat e forta mbeten rrezik."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"Vetëm i pjekur ose i zier derisa shtypet: pure ose feta të buta.","9-11":"I pjekur me kanellë, në copa të vogla.","12+":"I pjekur ose komposto pa sheqer; i gjallë është shumë i fortë."}$s$::jsonb
  where food_key = 'quince' and serve_by_age = $s${"6-8":"Vetëm i pjekur ose i zier derisa shtypet: purè ose feta të buta.","9-11":"I pjekur me kanellë, në copa të vogla.","12+":"I pjekur ose komposto pa sheqer; i gjallë është shumë i fortë."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"I pjekur ose i zier: pure, ose feta të buta pa lëkurë.","9-11":"Kubikë të butë të pjekur.","12+":"I pjekur, në supë ose në byrek."}$s$::jsonb
  where food_key = 'pumpkin' and serve_by_age = $s${"6-8":"I pjekur ose i zier: purè, ose feta të buta pa lëkurë.","9-11":"Kubikë të butë të pjekur.","12+":"I pjekur, në supë ose në byrek."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"I zier në avull, në shkopinj të trashë me lëkurë që të mos shkërmoqet, ose pure.","9-11":"Copa të vogla të ziera, ose i grirë në qofte dhe petulla.","12+":"Si te familja: i pjekur, në tavë ose në petulla."}$s$::jsonb
  where food_key = 'zucchini' and serve_by_age = $s${"6-8":"I zier në avull, në shkopinj të trashë me lëkurë që të mos shkërmoqet, ose purè.","9-11":"Copa të vogla të ziera, ose i grirë në qofte dhe petulla.","12+":"Si te familja: i pjekur, në tavë ose në petulla."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"E zier ose e pjekur derisa shtypet: shkopinj të butë sa gishti ose pure. Asnjëherë e gjallë.","9-11":"E zier në copa të vogla, ose e gjallë vetëm e grirë hollë.","12+":"E zier në copa, ose e gjallë vetëm e grirë; shkopinjtë e gjallë mbeten rrezik."}$s$::jsonb
  where food_key = 'carrot' and serve_by_age = $s${"6-8":"E zier ose e pjekur derisa shtypet: shkopinj të butë sa gishti ose purè. Asnjëherë e gjallë.","9-11":"E zier në copa të vogla, ose e gjallë vetëm e grirë hollë.","12+":"E zier në copa, ose e gjallë vetëm e grirë; shkopinjtë e gjallë mbeten rrezik."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"E zier ose e pjekur: pure ose shkopinj të butë.","9-11":"Copa të vogla të ziera, ose pure me perime.","12+":"Si te familja: e zier, e pjekur ose në tavë."}$s$::jsonb
  where food_key = 'potato' and serve_by_age = $s${"6-8":"E zier ose e pjekur: purè ose shkopinj të butë.","9-11":"Copa të vogla të ziera, ose purè me perime.","12+":"Si te familja: e zier, e pjekur ose në tavë."}$s$::jsonb;

update public.foods set tip = $s$Patatja e bën purenë e perimeve më të butë për bebet e vogla.$s$
  where food_key = 'potato' and tip = $s$Patatja e bën purènë e perimeve më të butë për bebet e vogla.$s$;

update public.foods set serve_by_age = $s${"6-8":"E gatuar mirë në supë ose pure, për shije.","9-11":"E grirë imët dhe e zier në gatime.","12+":"Në gatime si te familja."}$s$::jsonb
  where food_key = 'onion' and serve_by_age = $s${"6-8":"E gatuar mirë në supë ose purè, për shije.","9-11":"E grirë imët dhe e zier në gatime.","12+":"Në gatime si te familja."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"I zier mirë dhe i bluar në supë ose pure.","9-11":"I grirë imët në supë, byrek ose qofte.","12+":"Në gatime si te familja; fijet e gjata prit imët."}$s$::jsonb
  where food_key = 'leek' and serve_by_age = $s${"6-8":"I zier mirë dhe i bluar në supë ose purè.","9-11":"I grirë imët në supë, byrek ose qofte.","12+":"Në gatime si te familja; fijet e gjata prit imët."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"I zier dhe i bluar në pure, qull ose petulla.","9-11":"I grirë imët në petulla, në omëletë të gatuar mirë ose në oriz.","12+":"Në byrek, në jani ose në petulla."}$s$::jsonb
  where food_key = 'spinach' and serve_by_age = $s${"6-8":"I zier dhe i bluar në purè, qull ose petulla.","9-11":"I grirë imët në petulla, në omëletë të gatuar mirë ose në oriz.","12+":"Në byrek, në jani ose në petulla."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"I pjekur, pa lëkurë, në shirita të butë ose i bluar në pure.","9-11":"I pjekur, në copa të vogla.","12+":"I pjekur, ose i gjallë në shirita të hollë."}$s$::jsonb
  where food_key = 'pepper' and serve_by_age = $s${"6-8":"I pjekur, pa lëkurë, në shirita të butë ose i bluar në purè.","9-11":"I pjekur, në copa të vogla.","12+":"I pjekur, ose i gjallë në shirita të hollë."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"I pjekur shumë i butë, pa lëkurë: pure ose shirita.","9-11":"I pjekur, në copa të vogla ose në tavë.","12+":"Si te familja: i pjekur ose në tavë."}$s$::jsonb
  where food_key = 'eggplant' and serve_by_age = $s${"6-8":"I pjekur shumë i butë, pa lëkurë: purè ose shirita.","9-11":"I pjekur, në copa të vogla ose në tavë.","12+":"Si te familja: i pjekur ose në tavë."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"Pak hudhër e gatuar në supë ose pure, për shije.","9-11":"E gatuar në gatime.","12+":"Në gatime si te familja."}$s$::jsonb
  where food_key = 'garlic' and serve_by_age = $s${"6-8":"Pak hudhër e gatuar në supë ose purè, për shije.","9-11":"E gatuar në gatime.","12+":"Në gatime si te familja."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"Të ziera derisa shkrihen: pure ose supë e trashë.","9-11":"Supë, qofte ose petulla me thjerrëza.","12+":"Supë ose gjellë si te familja."}$s$::jsonb
  where food_key = 'red_lentils' and serve_by_age = $s${"6-8":"Të ziera derisa shkrihen: purè ose supë e trashë.","9-11":"Supë, qofte ose petulla me thjerrëza.","12+":"Supë ose gjellë si te familja."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"Të ziera shumë të buta: të shtypura ose pure, jo kokrra të plota.","9-11":"Kokrra që shtypen lehtë me gisht, ose në gjellë të butë.","12+":"Fasule të ziera të buta, si te familja."}$s$::jsonb
  where food_key = 'white_beans' and serve_by_age = $s${"6-8":"Të ziera shumë të buta: të shtypura ose purè, jo kokrra të plota.","9-11":"Kokrra që shtypen lehtë me gisht, ose në gjellë të butë.","12+":"Fasule të ziera të buta, si te familja."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"Vetëm të bluara: humus pa kripë ose pure.","9-11":"Të shtypura me pirun ose humus; jo kokrra të plota.","12+":"Kokrra të ziera të buta, të shtypura pak, me fëmijën ulur."}$s$::jsonb
  where food_key = 'chickpeas' and serve_by_age = $s${"6-8":"Vetëm të bluara: humus pa kripë ose purè.","9-11":"Të shtypura me pirun ose humus; jo kokrra të plota.","12+":"Kokrra të ziera të buta, të shtypura pak, me fëmijën ulur."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"E gatuar plotësisht: shirita të butë nga kofsha, ose e grirë në qofte të buta dhe pure.","9-11":"E grirë ose në copa shumë të vogla e të buta.","12+":"Copa të vogla, pa lëkurë e pa kocka."}$s$::jsonb
  where food_key = 'chicken' and serve_by_age = $s${"6-8":"E gatuar plotësisht: shirita të butë nga kofsha, ose e grirë në qofte të buta dhe purè.","9-11":"E grirë ose në copa shumë të vogla e të buta.","12+":"Copa të vogla, pa lëkurë e pa kocka."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"Vetëm në gatim (qull, pure); jo si pije para 12 muajsh.","9-11":"Vetëm në gatim; jo si pije para 12 muajsh.","12+":"Si pije në gotë të hapur, dhe në gatim."}$s$::jsonb
  where food_key = 'milk' and serve_by_age = $s${"6-8":"Vetëm në gatim (qull, purè); jo si pije para 12 muajsh.","9-11":"Vetëm në gatim; jo si pije para 12 muajsh.","12+":"Si pije në gotë të hapur, dhe në gatim."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"Gjizë e freskët pa kripë, e lyer në bukë të thekur ose e përzier në pure.","9-11":"Në petulla, në byrek të butë ose me fruta.","12+":"Në byrek, në petulla ose në bukë."}$s$::jsonb
  where food_key = 'gjize' and serve_by_age = $s${"6-8":"Gjizë e freskët pa kripë, e lyer në bukë të thekur ose e përzier në purè.","9-11":"Në petulla, në byrek të butë ose me fruta.","12+":"Në byrek, në petulla ose në bukë."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"Pak në gatim, në pure ose qull.","9-11":"Pak në gatim, ose i lyer hollë.","12+":"Si te familja, me masë."}$s$::jsonb
  where food_key = 'butter' and serve_by_age = $s${"6-8":"Pak në gatim, në purè ose qull.","9-11":"Pak në gatim, ose i lyer hollë.","12+":"Si te familja, me masë."}$s$::jsonb;

update public.foods set tip = $s$Pak gjalpë ose vaj ulliri e bën purenë më të butë.$s$
  where food_key = 'butter' and tip = $s$Pak gjalpë ose vaj ulliri e bën purènë më të butë.$s$;

update public.foods set serve_by_age = $s${"6-8":"Gjalpë kikiriku i lëmuar, i holluar me ujë të ngrohtë ose me pure frutash; asnjëherë kikirikë të plotë.","9-11":"I lyer hollë në bukë të thekur, ose i përzier në qull.","12+":"I lyer hollë; kikirikët e plotë jo para 5 vjeç."}$s$::jsonb
  where food_key = 'peanut_butter' and serve_by_age = $s${"6-8":"Gjalpë kikiriku i lëmuar, i holluar me ujë të ngrohtë ose me purè frutash; asnjëherë kikirikë të plotë.","9-11":"I lyer hollë në bukë të thekur, ose i përzier në qull.","12+":"I lyer hollë; kikirikët e plotë jo para 5 vjeç."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"Pak tahini i përzier në pure ose në qull.","9-11":"I lyer hollë në bukë, ose në humus pa kripë.","12+":"Në humus, në salca ose i lyer hollë."}$s$::jsonb
  where food_key = 'tahini' and serve_by_age = $s${"6-8":"Pak tahini i përzier në purè ose në qull.","9-11":"I lyer hollë në bukë, ose në humus pa kripë.","12+":"Në humus, në salca ose i lyer hollë."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"E zier mirë dhe e përzier në pure, ose në topa të butë me perime.","9-11":"E zier, me perime ose në petulla.","12+":"Si orizi, në gjellë ose në sallata."}$s$::jsonb
  where food_key = 'quinoa' and serve_by_age = $s${"6-8":"E zier mirë dhe e përzier në purè, ose në topa të butë me perime.","9-11":"E zier, me perime ose në petulla.","12+":"Si orizi, në gjellë ose në sallata."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"I zier shumë i butë, i përzier në pure ose në qofte.","9-11":"I zier, në gjellë ose në qofte.","12+":"Si pilaf ose në sallata."}$s$::jsonb
  where food_key = 'bulgur' and serve_by_age = $s${"6-8":"I zier shumë i butë, i përzier në purè ose në qofte.","9-11":"I zier, në gjellë ose në qofte.","12+":"Si pilaf ose në sallata."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"E pjekur: pure, ose shkopinj të butë me lëkurë.","9-11":"Kubikë të butë të pjekur.","12+":"E pjekur ose në supë."}$s$::jsonb
  where food_key = 'sweet_potato' and serve_by_age = $s${"6-8":"E pjekur: purè, ose shkopinj të butë me lëkurë.","9-11":"Kubikë të butë të pjekur.","12+":"E pjekur ose në supë."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"Lule të mëdha të ziera derisa të buta, ose pure.","9-11":"Copa të vogla të buta.","12+":"E pjekur ose në tavë."}$s$::jsonb
  where food_key = 'cauliflower' and serve_by_age = $s${"6-8":"Lule të mëdha të ziera derisa të buta, ose purè.","9-11":"Copa të vogla të buta.","12+":"E pjekur ose në tavë."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"I zier ose i pjekur derisa të zbutet: pure ose feta të buta.","9-11":"Kubikë të vegjël të butë.","12+":"I zier në copa ose në sallatë."}$s$::jsonb
  where food_key = 'beetroot' and serve_by_age = $s${"6-8":"I zier ose i pjekur derisa të zbutet: purè ose feta të buta.","9-11":"Kubikë të vegjël të butë.","12+":"I zier në copa ose në sallatë."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"E zier mirë dhe e bluar në supë ose pure.","9-11":"E zier dhe e prerë imët.","12+":"E gatuar në gjellë; e gjallë vetëm e grirë hollë."}$s$::jsonb
  where food_key = 'cabbage' and serve_by_age = $s${"6-8":"E zier mirë dhe e bluar në supë ose purè.","9-11":"E zier dhe e prerë imët.","12+":"E gatuar në gjellë; e gjallë vetëm e grirë hollë."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"Kokrrat vetëm të bluara, në pure ose supë.","9-11":"Kokrra të ziera të shtypura pak, ose në petulla.","12+":"Kokrra të ziera, me fëmijën ulur."}$s$::jsonb
  where food_key = 'corn' and serve_by_age = $s${"6-8":"Kokrrat vetëm të bluara, në purè ose supë.","9-11":"Kokrra të ziera të shtypura pak, ose në petulla.","12+":"Kokrra të ziera, me fëmijën ulur."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"Bamje të plota të gatuara shumë të buta, ose pure.","9-11":"Copa të vogla të buta.","12+":"Në gjellë si te familja."}$s$::jsonb
  where food_key = 'okra' and serve_by_age = $s${"6-8":"Bamje të plota të gatuara shumë të buta, ose purè.","9-11":"Copa të vogla të buta.","12+":"Në gjellë si te familja."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"Vetëm të bluara imët, të përziera në qull ose pure; asnjëherë arra të plota.","9-11":"Të bluara imët, në qull ose në petulla.","12+":"Të bluara, ose krem i lyer hollë; arrat e plota jo para 5 vjeç."}$s$::jsonb
  where food_key = 'ground_walnuts' and serve_by_age = $s${"6-8":"Vetëm të bluara imët, të përziera në qull ose purè; asnjëherë arra të plota.","9-11":"Të bluara imët, në qull ose në petulla.","12+":"Të bluara, ose krem i lyer hollë; arrat e plota jo para 5 vjeç."}$s$::jsonb;

update public.foods set serve_by_age = $s${"6-8":"Vetëm të bluara imët (miell bajamesh), të përziera në qull ose pure; asnjëherë të plota.","9-11":"Bajame të bluara imët (miell bajamesh), në petulla ose në qull.","12+":"Të bluara, ose krem bajamesh i lyer hollë; të plota jo para 5 vjeç."}$s$::jsonb
  where food_key = 'ground_almonds' and serve_by_age = $s${"6-8":"Vetëm të bluara imët (miell bajamesh), të përziera në qull ose purè; asnjëherë të plota.","9-11":"Bajame të bluara imët (miell bajamesh), në petulla ose në qull.","12+":"Të bluara, ose krem bajamesh i lyer hollë; të plota jo para 5 vjeç."}$s$::jsonb;
