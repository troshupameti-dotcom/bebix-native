-- Përrallat: biblioteka (e lexojnë të gjithë, e ndryshojnë vetëm adminët), të preferuarat dhe leximi i çdo prindi.
-- Përrallat e reja shtohen këtu (Table Editor ose SQL) dhe dalin në app pa përditësim: app-i lexon vetëm ato me
-- status 'published'. Kopertinat me foto shkojnë te bucket-i publik `story-covers` (cover_url); pa foto, app-i vizaton
-- skenën sipas `cover_key`. Kolonat e audios janë gati për leximin me zë, por app-i s'ka ende luajtës.
-- I sigurt për t'u ekzekutuar dy herë; s'fshin asgjë. Përrallat fillestare shtohen vetëm kur mungojnë.

create table if not exists public.stories (
  id                     uuid primary key default gen_random_uuid(),
  slug                   text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
  language               text not null default 'sq' check (char_length(language) between 2 and 5),
  title                  text not null check (char_length(title) between 1 and 120),
  summary                text not null default '' check (char_length(summary) <= 400),
  paragraphs             text[] not null check (cardinality(paragraphs) between 1 and 200),
  categories             text[] not null default '{}'
                           check (categories <@ array['sleep', 'nature', 'adventure', 'friendship', 'emotions', 'lessons', 'classic']::text[]),
  age_min_months         integer not null default 0 check (age_min_months between 0 and 216),
  age_max_months         integer not null default 72 check (age_max_months between 1 and 216),
  reading_minutes        integer not null default 3 check (reading_minutes between 1 and 60),
  cover_key              text check (cover_key is null or char_length(cover_key) <= 40),
  cover_url              text check (cover_url is null or cover_url ~ '^https://'),
  audio_url              text check (audio_url is null or audio_url ~ '^https://'),
  audio_duration_seconds integer check (audio_duration_seconds is null or audio_duration_seconds > 0),
  narrator               text check (narrator is null or char_length(narrator) <= 80),
  status                 text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  featured               boolean not null default false,
  sort_order             integer not null default 1000,
  published_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint stories_age_range check (age_max_months > age_min_months)
);

-- Lista e app-it: vetëm të publikuarat, sipas radhës.
create index if not exists stories_published_order_idx on public.stories (sort_order, slug) where status = 'published';
create index if not exists stories_categories_idx on public.stories using gin (categories);

-- updated_at ndryshon me çdo ndryshim (app-i e përdor për ta marrë tekstin sërish); published_at vendoset vetë.
create or replace function public.stories_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists stories_touch on public.stories;
create trigger stories_touch before insert or update on public.stories
  for each row execute function public.stories_touch();

alter table public.stories enable row level security;

drop policy if exists "stories_read_published" on public.stories;
create policy "stories_read_published"
  on public.stories for select to anon, authenticated
  using (status = 'published');

drop policy if exists "stories_admin_read" on public.stories;
create policy "stories_admin_read"
  on public.stories for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "stories_admin_insert" on public.stories;
create policy "stories_admin_insert"
  on public.stories for insert to authenticated
  with check ((select public.is_admin()));

drop policy if exists "stories_admin_update" on public.stories;
create policy "stories_admin_update"
  on public.stories for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "stories_admin_delete" on public.stories;
create policy "stories_admin_delete"
  on public.stories for delete to authenticated
  using ((select public.is_admin()));

-- Nga 30 tetori 2026 Supabase s'jep leje vetë: lejet shkruhen këtu. RLS-ja vendos çfarë sheh secili.
grant select on public.stories to anon, authenticated;
grant insert, update, delete on public.stories to authenticated;
grant all on public.stories to service_role;

-- Të preferuarat e çdo prindi.
create table if not exists public.story_favorites (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  story_slug text not null references public.stories(slug) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, story_slug)
);

alter table public.story_favorites enable row level security;

drop policy if exists "story_favorites_own_read" on public.story_favorites;
create policy "story_favorites_own_read"
  on public.story_favorites for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "story_favorites_own_insert" on public.story_favorites;
create policy "story_favorites_own_insert"
  on public.story_favorites for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "story_favorites_own_update" on public.story_favorites;
create policy "story_favorites_own_update"
  on public.story_favorites for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "story_favorites_own_delete" on public.story_favorites;
create policy "story_favorites_own_delete"
  on public.story_favorites for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.story_favorites from anon;
grant select, insert, update, delete on public.story_favorites to authenticated;
grant all on public.story_favorites to service_role;

-- Ku mbeti prindi në çdo përrallë (faqja nga 0) dhe nëse e mbaroi; "Të lexuara së fundmi" del sipas updated_at.
create table if not exists public.story_progress (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  story_slug text not null references public.stories(slug) on update cascade on delete cascade,
  page       integer not null default 0 check (page >= 0),
  pages      integer not null check (pages between 1 and 200),
  finished   boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, story_slug),
  constraint story_progress_page_in_range check (page < pages)
);

create index if not exists story_progress_user_recent_idx on public.story_progress (user_id, updated_at desc);

alter table public.story_progress enable row level security;

drop policy if exists "story_progress_own_read" on public.story_progress;
create policy "story_progress_own_read"
  on public.story_progress for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "story_progress_own_insert" on public.story_progress;
create policy "story_progress_own_insert"
  on public.story_progress for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists "story_progress_own_update" on public.story_progress;
create policy "story_progress_own_update"
  on public.story_progress for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

drop policy if exists "story_progress_own_delete" on public.story_progress;
create policy "story_progress_own_delete"
  on public.story_progress for delete to authenticated
  using (user_id = (select auth.uid()));

revoke all on public.story_progress from anon;
grant select, insert, update, delete on public.story_progress to authenticated;
grant all on public.story_progress to service_role;

-- Kopertinat me foto: bucket publik (lexohen me lidhje të drejtpërdrejtë), i ngarkojnë dhe i ndryshojnë vetëm adminët.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('story-covers', 'story-covers', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists story_covers_admin_insert on storage.objects;
create policy story_covers_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'story-covers' and (select public.is_admin()));

drop policy if exists story_covers_admin_update on storage.objects;
create policy story_covers_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'story-covers' and (select public.is_admin()))
  with check (bucket_id = 'story-covers' and (select public.is_admin()));

drop policy if exists story_covers_admin_delete on storage.objects;
create policy story_covers_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'story-covers' and (select public.is_admin()));

-- Përrallat fillestare (të njëjtat si content/stories/sq.json në app). Kur një përrallë ekziston, s'preket:
-- ndryshimet e adminit mbeten.
insert into public.stories (slug, language, title, summary, paragraphs, categories, age_min_months, age_max_months, reading_minutes, cover_key, status, featured, sort_order)
values
(
  $s$hena-qe-nuk-donte-te-flinte$s$, 'sq', $s$Hëna që s'donte të flinte$s$,
  $s$Hëna do të luajë gjithë natën, derisa kupton pse ndriçon kur të gjithë flenë.$s$,
  array[
    $s$Një mbrëmje, kur dielli u fsheh pas kodrave, Hëna u zgjua në qiell. U shtri, u kruajt pas veshit dhe vështroi poshtë, nga qyteti i vogël ku dritat po fikeshin një nga një.$s$,
    $s$«Pse duhet të fle unë, kur të gjithë të tjerët flenë?» pyeti Hëna. «Unë dua të luaj!»$s$,
    $s$Kaloi pranë saj një re e bardhë. «Hajde të luajmë kukafshehtas», i tha Hëna. Reja qeshi, u zgjat dhe e mbuloi Hënën si me një batanije të hollë. «Të gjeta!» bërtiti Hëna, dhe reja vazhdoi rrugën e saj, ngadalë, drejt maleve.$s$,
    $s$Pastaj Hëna pa një yll të vogël që dridhej. «Pse dridhesh, yll i vogël?» «Kam pak frikë nga errësira», pëshpëriti ylli. Hëna u afrua dhe ndriçoi më fort. «Kur unë jam këtu, errësira bëhet e butë», i tha.$s$,
    $s$Poshtë, në një dritare, një vajzë e vogël po shihte qiellin nga shtrati. Mamaja e saj i tha: «Shiko, Hëna po ruan yjet. Kur ti fle, ajo ruan edhe ëndrrat e tua.»$s$,
    $s$Hëna dëgjoi dhe buzëqeshi. Kuptoi se nuk ishte zgjuar për të luajtur, por për të ndriçuar natën, që të gjithë të flinin të qetë.$s$,
    $s$Kështu, Hëna qëndroi e qetë në qiell, e rrumbullakët dhe e ngrohtë. Ylli i vogël nuk u drodh më. Reja fjeti mbi mal. Dhe vajza e vogël mbylli sytë. Natën e mirë, Hënë. Natën e mirë, yje. Natën e mirë, ti.$s$
  ]::text[],
  array['sleep', 'emotions']::text[], 12, 72, 3, 'moon', 'published', true, 10
),
(
  $s$ariu-i-vogel-dhe-batanija$s$, 'sq', $s$Ariu i vogël dhe batanija e ngrohtë$s$,
  $s$Ariu i Vogël ka ftohtë para gjumit, dhe mamaja e di saktësisht çfarë i duhet.$s$,
  array[
    $s$Në një shpellë të ngrohtë jetonte Ariu i Vogël. Ishte koha për të fjetur, por Ariu i Vogël kishte ftohtë.$s$,
    $s$«Mami, kam ftohtë në këmbë», tha ai. Mamaja i solli një palë çorape të buta. «Ja, tani këmbët janë ngrohtë.»$s$,
    $s$«Mami, kam ftohtë në veshë», tha ai. Mamaja i solli një kapelë të vogël. «Ja, tani veshët janë ngrohtë.»$s$,
    $s$«Mami, kam ftohtë në zemër», tha ai me zë të ulët. Mamaja buzëqeshi, u shtri pranë tij dhe e përqafoi fort, fort.$s$,
    $s$«Po tani?» pyeti mamaja. Ariu i Vogël mbylli sytë. «Tani jam ngrohtë kudo.»$s$,
    $s$Jashtë frynte era dhe binte bora. Por brenda, në shpellën e vogël, dy arinj flinin të ngrohtë nën një batanije të madhe. Natën e mirë, Ariu i Vogël.$s$
  ]::text[],
  array['sleep', 'nature']::text[], 0, 36, 2, 'bear', 'published', true, 20
),
(
  $s$dhelpra-lili-dhe-pylli-i-heshtur$s$, 'sq', $s$Dhelpra Lili dhe pylli i heshtur$s$,
  $s$Një mëngjes pylli hesht, dhe Dhelpra Lili zbulon pse kafshët po dëgjojnë.$s$,
  array[
    $s$Dhelpra Lili ishte dhelpra më kurioze e pyllit. Çdo mëngjes dilte nga strofulla dhe dëgjonte zërat e pyllit: zogjtë që këndonin, gjethet që shushurinin dhe përroin që llokoçiste mbi gurë.$s$,
    $s$Por një mëngjes, pylli ishte i heshtur. Asnjë zog nuk këndonte. Lili vuri veshët pa lëvizur. «Ku shkuan zërat?» pyeti veten.$s$,
    $s$Ajo vrapoi te lisi i vjetër, ku jetonte Ketri Kiko. «Kiko, pse hesht pylli?» Ketri nxori kokën nga zgavra. «Shiko lart», i tha. Qielli ishte gri dhe i rëndë.$s$,
    $s$Lili vazhdoi te përroi. Breshka Tina po fshihej nën një gjethe të madhe. «Po vjen stuhia», tha Tina. «Kur pylli hesht, kafshët po dëgjojnë. Ato përgatiten.»$s$,
    $s$Lili kuptoi. Ajo ndihmoi Ketrin të mblidhte lajthitë brenda, i tregoi Breshkës një gur të madh ku të strehohej, dhe pastaj vrapoi në strofull, pikërisht kur ranë pikat e para të shiut.$s$,
    $s$Shiu ra gjithë pasditen. Lili dëgjonte nga strofulla: pika-pika mbi gjethe, gurgullimë në përrua, era nëpër degë. «Pylli s'ishte i heshtur», mendoi ajo. «Thjesht po priste.»$s$,
    $s$Kur doli dielli, zogjtë filluan të këndonin më fort se kurrë. Dhe Lili mësoi diçka të re: ndonjëherë, që të dëgjosh mirë, duhet të rrish në heshtje.$s$
  ]::text[],
  array['nature', 'adventure']::text[], 36, 72, 3, 'fox', 'published', false, 30
),
(
  $s$kermilli-qe-nuk-nxitonte$s$, 'sq', $s$Kërmilli që nuk nxitonte$s$,
  $s$Të gjithë i thonë Leos të shpejtojë, por vetëm ai i sheh të gjitha.$s$,
  array[
    $s$Në kopshtin e gjyshes jetonte një kërmill i vogël me emrin Leo. Leo ecte ngadalë, shumë ngadalë, dhe mbante shtëpinë në shpinë.$s$,
    $s$«Shpejto, Leo!» i thoshte Mollëkuqja. «Nxito, Leo!» i thoshte Bleta. «Do të vonohesh!» i thoshte Milingona. Por Leo vetëm buzëqeshte dhe vazhdonte rrugën, hap pas hapi.$s$,
    $s$Rrugës, Leo shihte gjëra që të tjerët nuk i vinin re: një pikë vese që shkëlqente si yll, një lule që sapo hapej, një gjethe me formën e zemrës.$s$,
    $s$Një ditë, Bleta humbi rrugën për në zgjua. Fluturoi lart e poshtë, por nuk e gjeti dot. «Leo, a e di ku është lulja e madhe e verdhë? Zgjoi im është pranë saj.»$s$,
    $s$«Po», tha Leo. «Kalova pranë saj dje, ngadalë, dhe e pashë mirë. Është pas gardhit, pranë kovës blu.» Bleta fluturoi atje dhe e gjeti menjëherë zgjoin.$s$,
    $s$Atë mbrëmje, Bleta i solli Leos një pikë mjaltë. «Faleminderit», i tha. «Ti nuk nxiton, por i sheh të gjitha.»$s$,
    $s$Leo e shijoi mjaltin ngadalë, siç i shijonte të gjitha. Dhe që atë ditë, kur dikush në kopsht kishte nevojë të gjente diçka, vinte e pyeste kërmillin që nuk nxitonte.$s$
  ]::text[],
  array['lessons', 'nature']::text[], 12, 72, 3, 'snail', 'published', false, 40
),
(
  $s$varka-e-letres$s$, 'sq', $s$Varka e letrës$s$,
  $s$Ardi palos një varkë letre dhe e ndjek në udhëtimin e saj të parë.$s$,
  array[
    $s$Pas shiut, Ardi palosi një varkë nga një fletë e bardhë letre. Me laps blu i vizatoi një dritare dhe një flamur të vogël. «Do të quhesh Guximtarja», i tha.$s$,
    $s$Ai e vendosi varkën në përroin pranë shtëpisë. Uji e mori menjëherë dhe Guximtarja nisi udhëtimin e saj.$s$,
    $s$Varka kaloi pranë një bretkose që u ul mbi një gur dhe i bëri të fala: «Kua-kua, rrugë të mbarë!» Kaloi nën një urë druri, ku një mace e vështroi me sy të mëdhenj.$s$,
    $s$Pastaj përroi u bë më i shpejtë. Guximtarja u rrotullua një herë, dy herë, dhe u ndal te një degë që kishte rënë në ujë. Ardi vrapoi pas saj, pa e humbur nga sytë.$s$,
    $s$«Mos u tremb, Guximtare!» Ai u përkul me kujdes, e shtyu degën me një shkop dhe varka u lirua. Uji e çoi më tej, drejt pellgut të madh të parkut.$s$,
    $s$Në pellg, varka notoi e qetë mes rosave. Ardi u ul në bar dhe e pa duke lëkundur flamurin e saj të vogël, sikur thoshte faleminderit.$s$,
    $s$Kur u kthye në shtëpi, Ardi i tregoi mamit gjithë aventurën. «A do ta bësh përsëri?» pyeti mamaja. «Po», tha Ardi. «Nesër do të palos një varkë për bretkosën.»$s$
  ]::text[],
  array['adventure']::text[], 36, 72, 3, 'boat', 'published', true, 50
),
(
  $s$dy-shoqet-dhe-ombrella-e-verdhe$s$, 'sq', $s$Dy shoqet dhe ombrella e verdhë$s$,
  $s$Bie shi, ombrella është e vogël, dhe dy shoqe gjejnë një mënyrë që të mos lagen vetëm.$s$,
  array[
    $s$Ema dhe Sara ishin shoqe të ngushta. Shkonin bashkë në kopsht, ndanin lapsat me ngjyra dhe qeshnin me të njëjtat shaka.$s$,
    $s$Një ditë, kur dolën nga kopshti, filloi shiu. Ema kishte një ombrellë të verdhë, të vogël. Sara nuk kishte ombrellë.$s$,
    $s$«Hajde nën ombrellën time», tha Ema. Por ombrella ishte e vogël. Kur Ema e mbante mbi Sarën, lagej Ema. Kur e mbante mbi veten, lagej Sara.$s$,
    $s$Ato u ndalën nën një strehë dhe menduan. «Po sikur të afrohemi shumë?» tha Sara. U afruan aq shumë, sa supet iu prekën. Ombrella i mbuloi të dyja, pothuajse.$s$,
    $s$Rrugës, këmbët iu lagën, flokët iu lagën pak, por ato qeshnin. Kërcenin mbi pellgje dhe numëronin pikat që binin mbi ombrellë: një, dy, tre, njëqind!$s$,
    $s$Kur arritën te shtëpia e Sarës, mamaja e saj u dha nga një peshqir dhe një filxhan çaj të ngrohtë. «U latë?» pyeti ajo. «Pak», tha Ema. «Por ishte më bukur se kurrë.»$s$,
    $s$Atë natë, Sara vizatoi një ombrellë të verdhë me dy vajza poshtë saj. Mbi vizatim shkroi me shkronja të mëdha: SHOQJA IME. Të nesërmen ia dhuroi Emës.$s$
  ]::text[],
  array['friendship']::text[], 36, 72, 3, 'umbrella', 'published', false, 60
),
(
  $s$reja-qe-qante$s$, 'sq', $s$Reja që qante$s$,
  $s$Nina, reja e vogël gri, mëson se nuk ka gjë të keqe të qash kur ndihesh e rëndë.$s$,
  array[
    $s$Lart në qiell jetonte një re e vogël gri me emrin Nina. Retë e tjera ishin të bardha dhe të gëzuara, por Nina ndihej e rëndë.$s$,
    $s$«Pse je kaq e trishtuar?» e pyeti Era. «Nuk e di», tha Nina. «Ndihem plot, plot, sikur do të pëlcas.»$s$,
    $s$Era i tha: «Ndoshta ke diçka për të nxjerrë. Nuk ka gjë të keqe të qash.» Nina hezitoi. Pastaj filloi të qante, fillimisht pak, pastaj shumë.$s$,
    $s$Pikat e saj ranë poshtë, mbi kopshtet e thata. Lulet ngritën kokat. Pemët pinë ujë. Fëmijët dolën me çizme dhe kërcyen në pellgje.$s$,
    $s$Kur mbaroi së qari, Nina u ndje e lehtë, aq e lehtë sa u bë e bardhë si retë e tjera. Dielli doli pas saj dhe në qiell u shfaq një ylber.$s$,
    $s$«Shiko», tha Era, «lotët e tu bënë diçka të bukur.» Nina shikoi poshtë: kopshtet shkëlqenin, fëmijët qeshnin.$s$,
    $s$Që atë ditë, Nina e dinte: kur ndihesh e rëndë, mund ta tregosh. Dhe pas lotëve, shpesh vjen një ylber.$s$
  ]::text[],
  array['emotions', 'nature']::text[], 36, 72, 3, 'cloud', 'published', false, 70
),
(
  $s$ylli-me-i-vogel$s$, 'sq', $s$Ylli më i vogël$s$,
  $s$Ylli i Vogël mendon se askush s'e sheh, derisa një djalë që ka frikë nga errësira e gjen.$s$,
  array[
    $s$Në qiell kishte mijëra yje. Disa ishin të mëdhenj e të shndritshëm, disa vezullonin me ngjyra. Dhe kishte një yll shumë të vogël, aq të vogël sa mezi dukej.$s$,
    $s$«Askush nuk më sheh», mendonte Ylli i Vogël. «Jam shumë i vogël që të ndihmoj dikë.»$s$,
    $s$Një natë, një djalë i vogël me emrin Bardh nuk po flinte dot. Kishte frikë nga errësira në dhomën e tij. Ai u ngrit dhe shikoi nga dritarja.$s$,
    $s$Yjet e mëdhenj ishin larg, mbi male. Por mu mbi çatinë e shtëpisë, pikërisht përballë dritares së tij, ndriçonte Ylli i Vogël.$s$,
    $s$«Ja ku je!» tha Bardhi. «Ti je ylli im.» Ylli i Vogël u ndez aq fort sa mundi, nga gëzimi.$s$,
    $s$Çdo natë pas asaj, Bardhi i thoshte natën e mirë yllit të tij para se të flinte. Dhe Ylli i Vogël e ruante dritaren derisa lindte dielli.$s$,
    $s$Ylli i Vogël kuptoi se nuk duhet të jesh i madh që të jesh i rëndësishëm. Mjafton të ndriçosh për dikë.$s$
  ]::text[],
  array['sleep', 'emotions']::text[], 12, 72, 3, 'star', 'published', true, 80
),
(
  $s$bufi-bubi-numeron-yjet$s$, 'sq', $s$Bufi Bubi numëron yjet$s$,
  $s$Bubi do t'i numërojë të gjithë yjet, dhe një nga një, kafshët e pyllit bien në gjumë.$s$,
  array[
    $s$Në majë të një pishe të gjatë jetonte Bufi Bubi. Ditën flinte, natën rrinte zgjuar. Por sonte Bubi donte të bënte diçka të veçantë: të numëronte yjet.$s$,
    $s$«Një», tha Bubi, dhe tregoi me krah yllin e parë. «Dy», tregoi një tjetër. «Tre, katër, pesë.»$s$,
    $s$Lepurushi u zgjua në strofull. «Çfarë po bën, Bubi?» «Po numëroj yjet. Gjashtë, shtatë, tetë.» Lepurushi u shtri dhe dëgjoi. Sytë iu rënduan.$s$,
    $s$Iriqi doli nga gjethet. «Sa yje ka?» «Nuk e di ende. Nëntë, dhjetë.» Iriqi u mblodh si top dhe mbylli sytë.$s$,
    $s$Edhe Ketri, edhe Breshka, edhe Zogu i Vogël dëgjonin zërin e qetë të Bubit: «Njëmbëdhjetë, dymbëdhjetë...» Dhe një nga një, të gjithë fjetën.$s$,
    $s$Bubi shikoi rreth e rrotull. Pylli flinte i qetë. «Sa yje ka? Nuk e mbarova dot», tha ai butë. «Por i vura të gjithë në gjumë.»$s$,
    $s$Tani është radha jote. Mbyll sytë dhe numëro me Bubin: një... dy... tre... Natën e mirë.$s$
  ]::text[],
  array['sleep', 'nature']::text[], 12, 48, 2, 'owl', 'published', false, 90
),
(
  $s$qengji-dhe-ura-e-drunjte$s$, 'sq', $s$Qengji dhe ura e drunjtë$s$,
  $s$Bardhi ka frikë ta kalojë urën, derisa një shok i vjetër ecën pranë tij.$s$,
  array[
    $s$Qengji Bardhi jetonte në një livadh të gjelbër pranë një lumi të vogël. Përtej lumit kishte një livadh tjetër, plot me tërfil, ushqimi i tij i preferuar.$s$,
    $s$Mbi lumë kishte një urë të ngushtë druri. Çdo ditë Bardhi shkonte deri te ura, shikonte ujin që rridhte poshtë dhe kthehej mbrapsht. «Ura lëkundet», thoshte. «Kam frikë.»$s$,
    $s$Një ditë erdhi Kali i Vjetër. «Edhe unë kisha frikë dikur», i tha. «Por kisha një shok që eci pranë meje.»$s$,
    $s$«A do të ecësh pranë meje?» pyeti Bardhi. «Sigurisht», tha Kali. «Do të ecim ngadalë, një hap pas tjetrit. Ti shiko përpara, jo poshtë.»$s$,
    $s$Bardhi vuri këmbën e parë mbi urë. Ura kërciti. Ai u ndal. Kali priti me durim. Bardhi mori frymë thellë dhe bëri hapin e dytë, pastaj të tretin.$s$,
    $s$Në mes të urës, Bardhi ndjeu erën e tërfilit. Edhe pak, edhe pak... dhe ja, ishte përtej!$s$,
    $s$Atë pasdite, Bardhi hëngri tërfil sa deshi. Dhe kur u kthye, e kaloi urën vetë. Frika ishte ende aty, pak, por ai e dinte tashmë që ishte më i fortë se ajo.$s$
  ]::text[],
  array['friendship', 'lessons']::text[], 36, 72, 3, 'lamb', 'published', false, 100
),
(
  $s$fara-e-vogel$s$, 'sq', $s$Fara e vogël$s$,
  $s$Me ujë, me diell dhe me durim, një farë e vogël bëhet lule.$s$,
  array[
    $s$Në një vazo me dhe ishte një farë e vogël. Ishte errët dhe qetë. Fara priste.$s$,
    $s$Erdhi uji. Pik, pik, pik. Fara piu dhe u fry pak. «Faleminderit, ujë», tha ajo.$s$,
    $s$Erdhi dielli. I ngrohtë, i ngrohtë. Fara nxori një rrënjë të hollë poshtë në dhe. «Faleminderit, diell», tha ajo.$s$,
    $s$Kaluan ditët. Një mëngjes, fara shtyu me gjithë forcën e saj dhe nxori kokën mbi dhe: dy gjethe të vogla, të gjelbra, të njoma.$s$,
    $s$«Jam e vogël», mendoi bima. Por çdo ditë rritej pak. Një gjethe tjetër. Edhe një. Një kërcell më i gjatë.$s$,
    $s$Dhe një ditë pranvere, në majë të kërcellit u hap një lule e kuqe, e madhe dhe e bukur. Një flutur erdhi dhe u ul mbi të.$s$,
    $s$Edhe ti, si fara e vogël, rritesh çdo ditë pak nga pak. Me ujë, me diell dhe me shumë dashuri.$s$
  ]::text[],
  array['nature', 'lessons']::text[], 12, 48, 2, 'seed', 'published', false, 110
),
(
  $s$breshka-dhe-lepuri$s$, 'sq', $s$Breshka dhe lepuri$s$,
  $s$Përralla e vjetër e Ezopit, e rrëfyer nga e para: kush fiton garën, i shpejti apo ai që nuk ndalet?$s$,
  array[
    $s$Ishte një herë një lepur që vraponte shumë shpejt dhe i pëlqente ta tregonte këtë. «Askush në pyll nuk vrapon sa unë», thoshte ai çdo ditë.$s$,
    $s$Një ditë, breshka i tha me qetësi: «Le të bëjmë një garë. Deri te lisi i madh, përtej kodrës.» Lepuri qeshi aq shumë sa i ranë veshët mbi sy. «Ti? Me mua? Mirë, le ta bëjmë!»$s$,
    $s$Ketri dha shenjën dhe gara nisi. Lepuri u nis si era dhe pas pak nuk dukej më. Breshka eci ngadalë, hap pas hapi, pa u ndalur.$s$,
    $s$Në mes të rrugës, lepuri shikoi pas. Breshka nuk dukej gjëkundi. «Kam kohë të pushoj pak», tha ai, u shtri nën një hije të freskët dhe e zuri gjumi.$s$,
    $s$Breshka kaloi pranë tij ngadalë, pa zhurmë. Vazhdoi të ecte, hap pas hapi, ndërsa dielli lëvizte në qiell.$s$,
    $s$Kur lepuri u zgjua, dielli po perëndonte. Vrapoi me të gjitha forcat drejt lisit, por kur arriti, breshka ishte ulur tashmë atje, e lodhur dhe e lumtur.$s$,
    $s$«Si më munde?» pyeti lepuri. Breshka buzëqeshi: «Ti ishe më i shpejti. Por unë nuk u ndala.» Që atë ditë, lepuri nuk u mburr më, dhe të dy u bënë shokë.$s$
  ]::text[],
  array['classic', 'lessons']::text[], 36, 72, 3, 'turtle', 'published', false, 120
),
(
  $s$miu-i-qytetit-dhe-miu-i-fshatit$s$, 'sq', $s$Miu i qytetit dhe miu i fshatit$s$,
  $s$Përralla e vjetër e Ezopit, e rrëfyer nga e para: djathë me frikë apo grurë në qetësi?$s$,
  array[
    $s$Në një fshat të qetë, nën rrënjët e një dardhe, jetonte Miu i Fshatit. Shtëpia e tij ishte e thjeshtë: një shtrat me kashtë, disa kokrra gruri dhe një pamje e bukur nga livadhi.$s$,
    $s$Një ditë, i erdhi për vizitë kushëriri i tij, Miu i Qytetit. Miu i Fshatit i shtroi gjithçka që kishte: grurë, fara luledielli dhe një copë mollë.$s$,
    $s$Miu i Qytetit hëngri pak dhe rrudhi hundën. «Si mund të jetosh kështu, kaq thjeshtë? Eja me mua në qytet. Atje ka djathë, bukë të ëmbël dhe ëmbëlsira!»$s$,
    $s$Kështu, të dy u nisën për në qytet. Shtëpia e Miut të Qytetit ishte në një kuzhinë të madhe. Mbi tryezë kishte gjithçka: djathë, biskota, rrush.$s$,
    $s$Por sapo filluan të hanin, dera u hap me zhurmë. «Macja!» pëshpëriti Miu i Qytetit, dhe vrapuan të fshiheshin pas dollapit. Zemrat u rrihnin fort.$s$,
    $s$Kur macja iku, provuan përsëri. Por pastaj erdhi qeni, pastaj njerëzit me fshesë. Miu i Fshatit nuk hëngri dot as një kafshatë të qetë.$s$,
    $s$Të nesërmen, Miu i Fshatit përqafoi kushëririn e tij. «Faleminderit për gjithçka», i tha. «Por unë kthehem te dardha ime. Më mirë grurë në qetësi, sesa djathë me frikë.» Dhe u kthye në shtëpi, i lumtur.$s$
  ]::text[],
  array['classic', 'friendship']::text[], 36, 72, 3, 'mice', 'published', false, 130
),
(
  $s$mirembrema-shtepi$s$, 'sq', $s$Mirëmbrëma, shtëpi$s$,
  $s$Një përshëndetje e butë për gjithçka në shtëpi, para se bebja të mbyllë sytë.$s$,
  array[
    $s$Dielli shkoi të flejë pas kodrës. Mirëmbrëma, diell.$s$,
    $s$Zogjtë u kthyen në fole. Mirëmbrëma, zogj.$s$,
    $s$Macja u mblodh mbi qilim. Mirëmbrëma, mace.$s$,
    $s$Lodrat u futën në kuti. Mirëmbrëma, arush. Mirëmbrëma, top. Mirëmbrëma, kubikë.$s$,
    $s$Dritat u ulën, zërat u qetësuan. Mirëmbrëma, dhomë.$s$,
    $s$Hëna doli në dritare dhe tha: Natën e mirë, të gjithëve.$s$,
    $s$Dhe ti, zemra ime, mbylli sytë. Natën e mirë, bebe.$s$
  ]::text[],
  array['sleep']::text[], 0, 24, 1, 'house', 'published', true, 5
)
on conflict (slug) do nothing;
