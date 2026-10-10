-- =====================================================================
-- Kujdesi për prindin.
--
-- 1) "Si je sot?" — 1–5 + shënim. PRIVAT: e sheh vetëm ai që e shkroi
--    (jo partneri, jo gjyshërit, jo admini nga app-i).
-- 2) Kalendari i zhvillimit sipas javës së jetës: "Këtë javë bebi mëson
--    të kapë sende" + 3 ide loje. Përmbajtja rri këtu, që ta ndryshosh nga
--    paneli/Supabase pa përditësuar app-in. E lexojnë të gjithë; e ndryshon
--    vetëm admini (public.is_admin()).
--
-- PA EKZEKUTUAR: ekzekutoje te Supabase → SQL Editor.
-- =====================================================================

-- --- 1) Si je sot? -----------------------------------------------------
create table if not exists public.parent_checkins (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day        date not null,
  mood       smallint not null check (mood between 1 and 5),
  note       text check (note is null or char_length(note) <= 500),
  updated_at timestamptz not null default now(),
  primary key (user_id, day)
);

alter table public.parent_checkins enable row level security;

drop policy if exists "parent_checkins_own" on public.parent_checkins;
create policy "parent_checkins_own"
  on public.parent_checkins for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- --- 2) Kalendari i zhvillimit ----------------------------------------
create table if not exists public.development_weeks (
  id         uuid primary key default gen_random_uuid(),
  lang       text not null check (lang in ('sq', 'en')),
  week_from  smallint not null check (week_from >= 0),
  week_to    smallint not null,
  title      text not null check (char_length(trim(title)) between 1 and 80),
  body       text not null check (char_length(trim(body)) between 1 and 400),
  ideas      text[] not null check (array_length(ideas, 1) between 1 and 5),
  is_active  boolean not null default true,
  updated_at timestamptz not null default now(),
  constraint development_weeks_range check (week_to >= week_from),
  constraint development_weeks_unique unique (lang, week_from)
);

alter table public.development_weeks enable row level security;

drop policy if exists "development_weeks_read" on public.development_weeks;
create policy "development_weeks_read"
  on public.development_weeks for select to anon, authenticated
  using (is_active or public.is_admin());

drop policy if exists "development_weeks_admin" on public.development_weeks;
create policy "development_weeks_admin"
  on public.development_weeks for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Përmbajtja fillestare (0–24 muaj). Orientuese: çdo bebe ka ritmin e vet.
-- `on conflict do nothing`: ndryshimet e tua nga paneli s'mbishkruhen kur
-- ky skedar ekzekutohet sërish.
insert into public.development_weeks (lang, week_from, week_to, title, body, ideas) values
  ('sq', 0, 1, $$Njohja me botën$$, $$Bebi sheh më mirë fytyrat nga afër, rreth 20–30 cm, dhe e njeh zërin tënd.$$,
    array[$$Mbaje afër fytyrës dhe fol me zë të butë$$, $$Kontakt lëkurë me lëkurë pas ushqimit$$, $$Këndo të njëjtën këngë çdo mbrëmje$$]),
  ('en', 0, 1, $$Getting to know the world$$, $$Your baby sees faces best up close, about 20–30 cm away, and knows your voice.$$,
    array[$$Hold them close to your face and talk softly$$, $$Skin-to-skin contact after feeds$$, $$Sing the same song every evening$$]),

  ('sq', 2, 3, $$Sytë fillojnë të ndjekin$$, $$Bebi fillon të ndjekë me sy një fytyrë ose një lodër që lëviz ngadalë.$$,
    array[$$Lëviz ngadalë një lodër me ngjyra të forta para syve$$, $$Pak minuta në bark kur është zgjuar, gjithmonë pranë teje$$, $$Trego me zë çfarë po bën$$]),
  ('en', 2, 3, $$Eyes start to follow$$, $$Your baby starts to follow a face or a slowly moving toy with their eyes.$$,
    array[$$Slowly move a high-contrast toy in front of their eyes$$, $$A few minutes of tummy time while awake, always with you$$, $$Describe out loud what you're doing$$]),

  ('sq', 4, 5, $$Buzëqeshja e parë$$, $$Shumë bebe buzëqeshin për herë të parë si përgjigje ndaj fytyrës dhe zërit tënd.$$,
    array[$$Buzëqesh dhe prit që të të përgjigjet$$, $$Imito tingujt e vegjël që bën$$, $$Në bark: vendos para tij një pasqyrë të sigurt për bebe$$]),
  ('en', 4, 5, $$The first smile$$, $$Many babies smile for the first time in response to your face and voice.$$,
    array[$$Smile and wait for a smile back$$, $$Copy the little sounds they make$$, $$Tummy time: place a baby-safe mirror in front$$]),

  ('sq', 6, 7, $$Tingujt dhe "bisedat"$$, $$Bebi nxjerr tinguj si "aaa" dhe "ooo" dhe pret përgjigjen tënde.$$,
    array[$$Bëj "bisedë": fol, ndalo, prit tingullin e tij$$, $$Lexo me zë një libër me figura të mëdha$$, $$Lëre të të shohë nga afër gjatë ndërrimit të pelenës$$]),
  ('en', 6, 7, $$Coos and "conversations"$$, $$Your baby makes sounds like "aaa" and "ooo" and waits for your reply.$$,
    array[$$Have a "chat": talk, pause, wait for their sound$$, $$Read aloud from a big-picture book$$, $$Let them see your face up close during changes$$]),

  ('sq', 8, 9, $$Duart zbulohen$$, $$Bebi i sheh duart e veta dhe i fut në gojë: kështu njeh trupin.$$,
    array[$$Jepi një lodër të lehtë për ta prekur$$, $$Një harkë loje me lodra të buta për t'i goditur me duar$$, $$Masazh i butë i duarve dhe këmbëve$$]),
  ('en', 8, 9, $$Discovering hands$$, $$Your baby looks at their hands and puts them in their mouth: that's how they learn their body.$$,
    array[$$Offer a light toy to touch$$, $$A play gym with soft toys to bat at$$, $$Gentle hand and foot massage$$]),

  ('sq', 10, 11, $$Qafa më e fortë$$, $$Në bark, bebi e ngre kokën më gjatë dhe shikon përreth.$$,
    array[$$Koha në bark disa herë në ditë, pak minuta çdo herë$$, $$Shtrihu para tij në dysheme, fytyrë me fytyrë$$, $$Ndërro vendin në dhomë për pamje të reja$$]),
  ('en', 10, 11, $$A stronger neck$$, $$On their tummy, your baby holds their head up longer and looks around.$$,
    array[$$Tummy time a few times a day, a few minutes each$$, $$Lie down facing them on the floor$$, $$Change their spot in the room for new views$$]),

  ('sq', 12, 15, $$Kap sende$$, $$Në këto javë shumë bebe mësojnë të zgjatin dorën dhe të kapin sende.$$,
    array[$$Mbaje një lodër pak larg që të zgjatë dorën$$, $$Rrathë ose kube të buta për t'i kapur$$, $$Një pëlhurë që shushurin kur e prek$$]),
  ('en', 12, 15, $$Reaching and grabbing$$, $$In these weeks many babies learn to reach out and grab things.$$,
    array[$$Hold a toy just out of reach so they stretch for it$$, $$Soft rings or blocks to grab$$, $$A crinkly cloth to explore$$]),

  ('sq', 16, 19, $$Rrotullimet e para$$, $$Shumë bebe fillojnë të rrotullohen. Mos e lër vetëm në krevat ose në divan.$$,
    array[$$Kohë në dysheme mbi një batanije të sigurt$$, $$Vendos lodrën anash që të kthehet drejt saj$$, $$Këndo dhe lëviz butësisht krahët e tij në ritëm$$]),
  ('en', 16, 19, $$First rolls$$, $$Many babies start to roll. Never leave them alone on a bed or sofa.$$,
    array[$$Floor time on a safe blanket$$, $$Place a toy to the side so they turn toward it$$, $$Sing and gently move their arms to the rhythm$$]),

  ('sq', 20, 25, $$Ulur me mbështetje$$, $$Me mbështetje, bebi rri ulur pak dhe shikon gjithçka me kureshtje.$$,
    array[$$Ulu me të në prehër dhe luani me lodra$$, $$Jastëkë rreth tij kur rri ulur, gjithmonë pranë teje$$, $$Lojë "ku është? ja ku është!" me një shami$$]),
  ('en', 20, 25, $$Sitting with support$$, $$With support, your baby sits for a little while and looks at everything with curiosity.$$,
    array[$$Sit with them on your lap and play with toys$$, $$Cushions around them while sitting, always with you$$, $$Peek-a-boo with a scarf$$]),

  ('sq', 26, 30, $$Shijet e para$$, $$Rreth 6 muajsh shumë bebe nisin ushqimet e para. Pyet pediatrin kur dhe si për bebin tënd.$$,
    array[$$Lëre të prekë dhe të shijojë ushqime të buta$$, $$Uluni bashkë në tryezë që t'ju shohë kur hani$$, $$Emërto ushqimet me zë: "karotë", "mollë"$$]),
  ('en', 26, 30, $$First tastes$$, $$Around 6 months many babies start first foods. Ask your pediatrician when and how for your baby.$$,
    array[$$Let them touch and taste soft foods$$, $$Sit together at the table so they watch you eat$$, $$Name foods out loud: "carrot", "apple"$$]),

  ('sq', 31, 35, $$Rrokjet e para$$, $$Dëgjohen "ba-ba", "ma-ma", "da-da": bebi po luan me tingujt.$$,
    array[$$Përsërit rrokjet e tij dhe shto një të re$$, $$Libra me kafshë dhe zërat e tyre$$, $$Lojë me duartrokitje$$]),
  ('en', 31, 35, $$First syllables$$, $$You hear "ba-ba", "ma-ma", "da-da": your baby is playing with sounds.$$,
    array[$$Repeat their syllables and add a new one$$, $$Animal books with animal sounds$$, $$Clapping games$$]),

  ('sq', 36, 43, $$Zvarritje dhe eksplorim$$, $$Shumë bebe zvarriten ose lëvizin nëpër dhomë. Kontrollo që shtëpia të jetë e sigurt.$$,
    array[$$Një tunel me jastëkë për t'u zvarritur$$, $$Vendos lodrën pak më larg që të shkojë drejt saj$$, $$Një kuti me sende të sigurta për t'i nxjerrë e futur$$]),
  ('en', 36, 43, $$Crawling and exploring$$, $$Many babies crawl or scoot around the room. Check that your home is baby-safe.$$,
    array[$$A cushion tunnel to crawl through$$, $$Put a toy a bit farther so they move toward it$$, $$A box of safe objects to take out and put back$$]),

  ('sq', 44, 52, $$Në këmbë$$, $$Bebi kapet pas mobiljeve dhe ngrihet; disa bëjnë hapat e parë me ndihmë.$$,
    array[$$Mbaje nga duart dhe ecni ngadalë bashkë$$, $$Një lodër për ta shtyrë gjatë ecjes$$, $$Rrokullisni një top të butë mes jush$$]),
  ('en', 44, 52, $$Pulling up to stand$$, $$Your baby holds on to furniture and pulls up; some take first steps with help.$$,
    array[$$Hold their hands and walk slowly together$$, $$A push toy for walking$$, $$Roll a soft ball back and forth$$]),

  ('sq', 53, 65, $$Fjalët e para$$, $$Rreth vitit të parë dalin shpesh fjalët dhe hapat e parë. Çdo fëmijë ka ritmin e vet.$$,
    array[$$Emërto gjërat që tregon me gisht$$, $$Kube për t'i vënë njëri mbi tjetrin$$, $$Këngë me gjeste: "koka, supet, gjunjët"$$]),
  ('en', 53, 65, $$First words$$, $$Around the first year, first words and steps often appear. Every child has their own pace.$$,
    array[$$Name the things they point at$$, $$Blocks to stack$$, $$Songs with gestures: "head, shoulders, knees"$$]),

  ('sq', 66, 78, $$Imiton çdo gjë$$, $$Fëmija imiton atë që bën ti: fshin, flet në telefon, ushqen kukullën.$$,
    array[$$Lojë me role: gatim me enë plastike$$, $$Lëre të ndihmojë në punë të thjeshta$$, $$Libra me figura: pyet "ku është qeni?"$$]),
  ('en', 66, 78, $$Copying you$$, $$Your child copies what you do: sweeping, talking on the phone, feeding a doll.$$,
    array[$$Pretend play: cooking with plastic dishes$$, $$Let them help with simple chores$$, $$Picture books: ask "where's the dog?"$$]),

  ('sq', 79, 104, $$Shumë fjalë të reja$$, $$Fjalori rritet shpejt dhe fillon të bashkojë dy fjalë. Lojërat me lëvizje ndihmojnë shumë.$$,
    array[$$Fol për atë që po bëni gjatë ditës$$, $$Vizatim me lapsa të trashë$$, $$Kërcim dhe vrapim në park$$]),
  ('en', 79, 104, $$Lots of new words$$, $$Vocabulary grows fast and they start joining two words. Active play helps a lot.$$,
    array[$$Talk about what you're doing during the day$$, $$Drawing with chunky crayons$$, $$Dancing and running in the park$$])
on conflict (lang, week_from) do nothing;
