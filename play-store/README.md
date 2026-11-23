# TROA në Google Play: materialet e gatshme

Këtu është gjithçka që ngjitet ose ngarkohet te Play Console. Skedarët:

- `icon-512.png`: ikona e dyqanit (512×512), bufi mbi ulli.
- `feature-graphic-1024x500.png`: imazhi i gjerë i dyqanit (1024×500).
- `make-screenshots.py`: i kthen screenshot-et e telefonit në foto dyqani me titull (shih pjesën 4).
- Ky dokument: tekstet, përgjigjet e formularëve dhe plani me hapa.

Përgjigjet e formularëve bazohen në atë që bën app-i sot (23 nëntor 2026). Para se t'i dërgosh, kalo një herë çdo
përgjigje.

---

## 1. Plani me radhë

| Hapi | Çfarë | Kur |
|---|---|---|
| 1 | Paguaj 25 $ dhe krijo llogarinë Play Console, pastaj verifikimi i identitetit | Dita 0 |
| 2 | Gjej 12 testues dhe mblidh email-et e tyre Gmail | Që tani |
| 3 | Krijo aplikacionin `TROA` (paketa `com.bebix.app`, s'ndryshon më pas), plotëso faqen e dyqanit dhe formularët (më poshtë) | Dita 1–2 |
| 4 | Build `production` (AAB) dhe ngarkimi te **Testim i mbyllur** | Dita 2–3 |
| 5 | Testuesit e instalojnë nga Play dhe e mbajnë 14 ditë rresht | Dita 3–17 |
| 6 | Kërko **Qasje në prodhim** (Production access), pastaj rishikimi nga Google | Dita 17+ |

Nëse llogaria hapet si **biznes** (me numër D-U-N-S), testimi i detyrueshëm me 12 testues për 14 ditë zakonisht
s'kërkohet. Kontrolloje te Play Console para se të vendosësh.

## 2. Build-i për Play

```
cd "C:\Users\Meti\Desktop\BEBIX APP\bebix-native\bebix-native"
npm run preflight
npx eas-cli build -p android --profile production
```

- Del skedar `.aab` (jo APK). Shkarkoje nga linku që jep Expo dhe ngarkoje me dorë te Play Console → Testim i
  mbyllur → Krijo version. **Ngarkimi i parë duhet të jetë me dorë.**
- `versionCode` rritet vetë (`autoIncrement`).
- Çelësi i firmës mbahet nga Expo. Shkarko një kopje: `npx eas-cli credentials`, pastaj Android, pastaj Download
  keystore. Ruaje diku të sigurt.

---

## 3. Faqja e dyqanit

### Shqip (gjuha kryesore)

**Emri (maks. 30):** `TROA: bebi, nata dhe dyqani`

**Përshkrim i shkurtër (maks. 80):**
`Ditari i bebit, pamja e natës, recetat dhe dyqani për bebe, në një vend.`

**Përshkrim i plotë (maks. 4000):**

```
TROA është shoqëruesi i prindërve, nga shtatzënia deri në 12 vjeç: ditari i bebit, ndihma natën, recetat, përrallat dhe dyqani me produkte për bebe, në një aplikacion të vetëm.

DITA E BEBIT, ME NJË PREKJE
• Shëno ushqyerjen (gji, biberon, ushqim), pelenat dhe gjumin me një prekje
• Kohëmatësi i gjirit të kujton nga cila anë ta nisësh herën tjetër
• "Sot" tregon me një shikim kur hëngri, kur fjeti dhe kur u ndërrua për herë të fundit
• Widget-i në ekranin kryesor: shëno pa e hapur aplikacionin

NATËN, ME NJË DORË
• Pamja e natës: butona të mëdhenj, ekran i errët që s'të verbon, ora me bufin e TROA-s
• Drita e butë për ndërrimin e pelenës, që fiket vetë pas 10 minutash
• Ndizet vetë në orarin që zgjedh

RRITJA DHE SHËNDETI
• Pesha dhe gjatësia në grafikë të qartë
• Kalendari i vaksinave dhe të dhënat mjekësore: grupi i gjakut, alergjitë, pediatri
• Përmbledhja e muajit dhe libri i vitit të parë me fotot dhe arritjet

ÇFARË T'I GATUAJ SOT?
• Receta për bebe nga 6 muaj deri në 5 vjeç, sipas moshës
• Ushqimet e para me sasitë në gramë dhe vlerat ushqyese
• Paralajmërim kur një recetë ka diçka nga alergjitë e bebit

PËRRALLA PËR GJUMË
• Libra të ilustruar me faqe që kthehen
• Përrallë e re çdo javë

DYQANI PËR BEBE
• Produkte nga marka të njohura, me foto të qarta
• Kërko, filtro sipas kategorisë ose markës dhe ruaj të preferuarat
• Porosit edhe pa llogari dhe paguaj kur ta marrësh
• Ndiq statusin e porosisë: në pritje, e konfirmuar, e nisur, e dorëzuar

KOMUNITETI
• Pyet, ndaj përvojën dhe lexo këshilla nga prindër të tjerë
• Repartet e ekspertëve: pediatër dhe specialistë që përgjigjen

E GJITHË FAMILJA BASHKË
• Fto partnerin ose gjyshërit: të gjithë shohin të njëjtat të dhëna
• Disa fëmijë në një llogari

I SIGURT DHE I THJESHTË
• Shqip dhe anglisht, tema e çelët dhe e errët
• Të dhënat e tua janë të tuat: mund t'i nxjerrësh ose t'i fshish kur të duash, brenda aplikacionit ose në web
• Udhëzime të përgjithshme, jo këshillë mjekësore: për çdo shqetësim pyet pediatrin

TROA. Për bebin tënd, me dashuri.
```

### English

**Name (max 30):** `TROA: baby, nights & shop`

**Short description (max 80):**
`Baby diary, night mode, recipes and a baby shop, all in one app.`

**Full description:**

```
TROA is a companion for parents, from pregnancy until age 12: your baby's diary, help at night, recipes, bedtime stories and a baby products shop, in one app.

YOUR BABY'S DAY IN ONE TAP
• Log feeding (breast, bottle, solids), diapers and sleep with one tap
• The breastfeeding timer reminds you which side to start next time
• "Today" shows at a glance when your baby last ate, slept and was changed
• Home screen widget: log without opening the app

ONE-HANDED AT NIGHT
• Night mode: big buttons, a dark screen that won't dazzle you, a clock with the TROA owl
• A soft light for diaper changes that turns off by itself after 10 minutes
• Turns on by itself on the schedule you choose

GROWTH AND HEALTH
• Weight and height on clear charts
• Vaccination calendar and medical details: blood type, allergies, pediatrician
• Monthly recap and a first-year book with photos and milestones

WHAT SHOULD I COOK TODAY?
• Baby recipes from 6 months to 5 years, by age
• First foods with gram amounts and nutrition values
• A warning when a recipe contains one of your baby's allergens

BEDTIME STORIES
• Illustrated books with turning pages
• A new story every week

THE BABY SHOP
• Products from trusted brands, with clear photos
• Search, filter by category or brand, and save favorites
• Order even without an account and pay on delivery
• Follow your order: pending, confirmed, shipped, delivered

COMMUNITY
• Ask questions, share experience and read tips from other parents
• Expert departments: pediatricians and specialists who answer

THE WHOLE FAMILY TOGETHER
• Invite your partner or grandparents: everyone sees the same data
• Several children in one account

SIMPLE AND SAFE
• Albanian and English, light and dark theme
• Your data is yours: export or delete it any time, in the app or on the web
• General guidance, not medical advice: ask your pediatrician about any concern

TROA. For your baby, with love.
```

**Kategoria:** Prindërim (Parenting). **Etiketat:** bebe, prindër, gjumi, dyqan.
**Email kontakti:** `info.troababy@gmail.com`. **Faqja:** `https://www.bebix.store` (ndryshoje kur të blesh domenin e ri).
**Politika e privatësisë:** `https://www.bebix.store/sq/legal/privacy`.

---

## 4. Screenshot-et (8 foto)

1. Bëj screenshot në telefon, në pamjen e çelët, me një bebe prove (emër, disa regjistrime). Mos shfaq të dhëna
   të vërteta të klientëve.
2. Ruaji te `play-store/screenshots/raw/` me emrat `01.png` … `08.png`, në këtë radhë:

| Nr. | Ekrani | Titulli që del sipër |
|---|---|---|
| 01 | Bebi → Sot (kartat e ushqimit, pelenës, gjumit) | Gjithë dita e bebit, me një shikim |
| 02 | Modaliteti i natës (ora analoge me bufin) | Natën, me një dorë |
| 03 | Rritja (grafiku i peshës) | Rritja, javë pas jave |
| 04 | Ushqim → një recetë | Çfarë t'i gatuaj sot? |
| 05 | Përrallat (libri i hapur) | Përralla për gjumë |
| 06 | Dyqani (lista me produkte) | Dyqani për bebe |
| 07 | Komuniteti | Prindër dhe ekspertë |
| 08 | Cilësimet → Familja | E gjithë familja bashkë |

3. Nga rrënja e projektit:

```
python play-store/make-screenshots.py          (shqip, te screenshots/out/)
python play-store/make-screenshots.py --en     (anglisht, te screenshots/out-en/)
```

Fotot dalin 1080×1920, me titullin sipër në ngjyrat e TROA-s. Ngarko ato të shqipes te gjuha shqipe dhe ato të
anglishtes te gjuha angleze. Për App Store vlejnë të njëjtat, me screenshot-e nga iPhone.

---

## 5. Data safety (përgjigjet e sugjeruara)

Pyetjet kryesore:
- **A mbledh ose ndan aplikacioni të dhëna përdoruesi?** Po.
- **A janë të gjitha të dhënat e enkriptuara gjatë transferimit?** Po (HTTPS).
- **A mund të kërkojnë përdoruesit fshirjen e të dhënave?** Po. Lidhja: `https://www.bebix.store/sq/delete-account`.

| Lloji | Çfarë | Mbledhet | Ndahet | Qëllimi | E detyrueshme |
|---|---|---|---|---|---|
| Informacion personal | Emri | Po | Po, me dyqanin/distributorin për dërgesë | Funksionimi, porositë | Po |
| Informacion personal | Email | Po | Jo | Llogaria, njoftimet | Po (për llogari) |
| Informacion personal | Numri i telefonit | Po | Po, për dërgesë | Porositë | Po (për porosi) |
| Informacion personal | Adresa | Po | Po, për dërgesë | Porositë | Po (për porosi) |
| Shëndet dhe fitnes | Pesha, gjatësia, ushqyerja, pelenat, gjumi, vaksinat, alergjitë, grupi i gjakut, shënimet mjekësore të bebit | Po | Jo | Funksionimi | Jo |
| Foto dhe video | Foto e bebit, kujtimet, postimet e komunitetit | Po | Jo | Funksionimi | Jo |
| Mesazhet | Bisedat në komunitet dhe me ekspertët | Po | Jo | Funksionimi | Jo |
| Aktiviteti i aplikacionit | Postimet dhe komentet në komunitet | Po | Jo | Funksionimi | Jo |
| Aktiviteti i aplikacionit | Ndërveprimet (analitika, PostHog) | Po | Jo (ofrues shërbimi) | Analitika | Jo |
| Informacion e performanca | Raportet e gabimeve (Sentry) | Po | Jo (ofrues shërbimi) | Diagnostikimi | Po |
| Pajisja ose ID të tjera | Çelësi për njoftime (push token) | Po | Jo | Njoftimet | Jo |

**Nuk mbledh:** vendndodhjen, kontaktet e telefonit. **Pagesat me kartë** (kur të ndizen) i përpunon Stripe; TROA s'e
sheh as s'e ruan numrin e kartës. Te formulari shëno "Informacion financiar → Historia e blerjeve: Po, për
porositë" nëse Google e kërkon.

Shënimi për "ndarjen": dërgimi i emrit, telefonit dhe adresës te dyqani që e dërgon porosinë është shënuar "Po".
Kjo është përgjigjja më e sigurt.

## 6. Formularët e tjerë

**Qasja në aplikacion (App access):** zgjidh "Pjesë të aplikacionit janë të kufizuara" dhe shkruaj:

```
Dyqani hapet pa llogari: te ekrani i hyrjes shtyp "Vazhdo te Dyqani pa Login".
Për pjesën tjetër (ditari, pamja e natës, komuniteti) hyr me llogarinë e provës:
Email: [VENDOS EMAILIN E LLOGARISË SË PROVËS]
Fjalëkalimi: [VENDOS FJALËKALIMIN]
```

Hap një llogari prove me email dhe fjalëkalim, pa lidhje me llogarinë tënde personale, dhe shto një bebe prove.

**Reklamat:** Jo, aplikacioni s'ka reklama.

**Klasifikimi i përmbajtjes:** "Jo" te dhuna, përmbajtja seksuale, droga, bixhozi. Te "përmbajtje e krijuar nga
përdoruesit": **Po** (komuniteti). Aplikacioni ka raportim dhe bllokim të postimeve dhe përdoruesve.

**Audienca e synuar:** 18 vjeç e lart (prindër). Mos zgjidh grupmoshat e fëmijëve: app-i është për prindër.

**Aplikacionet shëndetësore:** te deklarata e shëndetit zgjidh se app-i **nuk është pajisje mjekësore**. Pesha,
gjatësia dhe vaksinat janë regjistër personal, jo diagnozë.

**Fshirja e llogarisë:** lidhja `https://www.bebix.store/sq/delete-account`. Fshirja punon edhe brenda
aplikacionit (Cilësimet → Fshi llogarinë).

**Lejet (Permissions):** njoftimet (kujtesat), kamera (foto e bebit, kujtimet), mikrofoni (kur regjistron një video për Komunitetin),
vibrimi. Fotot zgjidhen me zgjedhësin e sistemit, pa leje për krejt galerinë (`READ_MEDIA_IMAGES` është e bllokuar).
Asnjë leje vendndodhjeje.
