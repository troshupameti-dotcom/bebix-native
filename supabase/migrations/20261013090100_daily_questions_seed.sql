-- =====================================================================
-- "Pyetja e ditës": 30 pyetjet fillestare, një në ditë nga e nesërmja e
-- ditës kur ekzekutohet ky skedar (Europe/Belgrade).
-- Pyetje të hapura, të ngrohta, pa këshilla mjekësore dhe pa faj.
-- Mund të ekzekutohet sërish: pyetjet që ekzistojnë (i njëjti tekst) ose
-- ditët e zëna anashkalohen.
-- Ekzekutoje PAS 20261013090000_daily_questions.sql.
-- =====================================================================

insert into public.community_daily_questions (active_date, text, text_en)
select public.daily_question_today() + v.n, v.text, v.text_en
from (values
  (1,  $$Çka të ka ndihmu me e qetësu bebin në mbrëmje?$$, $$What has helped you calm your baby in the evening?$$),
  (2,  $$Cili është momenti yt i preferuar i ditës me bebin?$$, $$What's your favourite moment of the day with your baby?$$),
  (3,  $$Çka të bën me buzëqesh edhe pas një nate pa gjumë?$$, $$What makes you smile even after a sleepless night?$$),
  (4,  $$Cila këngë apo melodi e qetëson më shumë bebin tënd?$$, $$Which song or tune soothes your baby the most?$$),
  (5,  $$Si e kaloni zakonisht mëngjesin me bebin?$$, $$What does a typical morning with your baby look like?$$),
  (6,  $$Cila lojë e thjeshtë e bën bebin të qeshë?$$, $$Which simple game makes your baby laugh?$$),
  (7,  $$Çka do t'i thoshe vetes në javën e parë si prind?$$, $$What would you tell yourself in your first week as a parent?$$),
  (8,  $$Si e gjen pak kohë vetëm për vete gjatë ditës?$$, $$How do you find a little time for yourself during the day?$$),
  (9,  $$Cili ushqim i ri ka pasur më shumë sukses te bebi juaj?$$, $$Which new food has been the biggest hit with your baby?$$),
  (10, $$Çka ju ndihmon kur bebi nxjerr dhëmbë dhe është më i shqetësuar?$$, $$What helps when your baby is teething and more unsettled?$$),
  (11, $$Cila është rutina juaj para gjumit të natës?$$, $$What's your bedtime routine?$$),
  (12, $$Kush të ka ndihmu më shumë në këto muaj, dhe si?$$, $$Who has helped you most in these months, and how?$$),
  (13, $$Çka mban gjithmonë në çantën e bebit kur dilni?$$, $$What do you always keep in the baby bag when you go out?$$),
  (14, $$Cili libër apo lodër është bërë i preferuari i bebit?$$, $$Which book or toy has become your baby's favourite?$$),
  (15, $$Si e kaloni kohën jashtë kur moti është i mirë?$$, $$How do you spend time outdoors when the weather is nice?$$),
  (16, $$Çka të ka befasu më shumë te bebi yt këtë javë?$$, $$What has surprised you most about your baby this week?$$),
  (17, $$Si i ndani punët e natës në familje?$$, $$How do you share the night-time tasks at home?$$),
  (18, $$Cila këshillë e marrë nga dikush tjetër të ka ndihmu vërtet?$$, $$Which piece of advice from someone else really helped you?$$),
  (19, $$Çka e bën banjën e bebit një moment të këndshëm për ju?$$, $$What makes bath time a nice moment for you?$$),
  (20, $$Si e mbani mend një moment të veçantë: foto, shënime, apo diçka tjetër?$$, $$How do you keep special moments: photos, notes or something else?$$),
  (21, $$Çka ju ndihmon në ditët kur bebi s'do të flejë gjatë ditës?$$, $$What helps on days when your baby won't nap?$$),
  (22, $$Cili është zbulimi juaj më i mirë për ushqyerjen në këto javë?$$, $$What's your best feeding discovery in recent weeks?$$),
  (23, $$Si e kujdesesh për veten kur je i lodhur ose e lodhur?$$, $$How do you look after yourself when you're tired?$$),
  (24, $$Cila fjalë apo tingull i bebit të ka mbetur në zemër?$$, $$Which word or sound from your baby has stayed in your heart?$$),
  (25, $$Çka i keni mësu bebit, apo çka keni mësu nga bebi?$$, $$What have you taught your baby, or learned from your baby?$$),
  (26, $$Si e qetësoni bebin kur jeni në rrugë apo në vizitë?$$, $$How do you calm your baby when you're out or visiting?$$),
  (27, $$Cila gjë e vogël e bën ditën tuaj më të lehtë?$$, $$What little thing makes your day easier?$$),
  (28, $$Çka i thoni një prindi që sapo ka sjellë bebin në shtëpi?$$, $$What would you tell a parent who just brought their baby home?$$),
  (29, $$Si e festoni një hap të ri të bebit, sado të vogël?$$, $$How do you celebrate a new milestone, however small?$$),
  (30, $$Për çka je mirënjohës ose mirënjohëse sot si prind?$$, $$What are you grateful for today as a parent?$$)
) as v(n, text, text_en)
where not exists (select 1 from public.community_daily_questions q where q.text = v.text)
on conflict (active_date) do nothing;
