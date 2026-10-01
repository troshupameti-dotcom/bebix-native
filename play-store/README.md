# Bebix në Google Play: materialet e gatshme

Këtu është gjithçka që ngjitet ose ngarkohet te Play Console. Skedarët:

- `icon-512.png`: ikona e dyqanit (512×512).
- `feature-graphic-1024x500.png`: imazhi i gjerë i dyqanit (1024×500).
- Ky dokument: tekstet, përgjigjet e formularëve dhe plani me hapa.

Përgjigjet e formularëve bazohen në atë që di për aplikacionin. Para se t'i shtypësh, kalo një herë çdo përgjigje dhe ndrysho nëse diçka s'përputhet.

---

## 1. Plani me radhë

| Hapi | Çfarë | Kur |
|---|---|---|
| 1 | Paguaj 25 $ dhe krijo llogarinë Play Console, pastaj verifikimi i identitetit | Dita 0 |
| 2 | Gjej 12 testues dhe mblidh email-et e tyre Gmail | Që tani |
| 3 | Krijo aplikacionin `Bebix` (paketa `com.bebix.app`), plotëso faqen e dyqanit dhe formularët (më poshtë) | Dita 1–2 |
| 4 | Build `production` (AAB) dhe ngarkimi te **Testim i mbyllur** | Dita 2–3 |
| 5 | Testuesit e instalojnë nga Play dhe e mbajnë 14 ditë rresht | Dita 3–17 |
| 6 | Kërko **Qasje në prodhim** (Production access), pastaj rishikimi nga Google | Dita 17+ |

Nëse llogaria hapet si **biznes** (me numër D-U-N-S), testimi i detyrueshëm me 12 testues për 14 ditë zakonisht nuk kërkohet. Kontrolloje te Play Console para se të vendosësh.

## 2. Build-i për Play

```
cd "C:\Users\Meti\Desktop\BEBIX APP\bebix-native\bebix-native"
npx eas-cli build -p android --profile production
```

- Del skedar `.aab` (jo APK). Shkarkoje nga linku që jep Expo dhe ngarkoje me dorë te Play Console → Testim i mbyllur → Krijo version. **Ngarkimi i parë duhet të jetë me dorë.**
- `versionCode` rritet vetë (`autoIncrement`).
- Variablat e mjedisit (Supabase, PostHog, Sentry) janë të vendosur te Expo për `production`. Kontrolluar.
- Çelësi i firmës mbahet nga Expo. Shkarko një kopje: `npx eas-cli credentials`, pastaj Android, pastaj Download keystore. Ruaje diku të sigurt.

---

## 3. Faqja e dyqanit

### Shqip (gjuha kryesore)

**Emri (maks. 30):** `Bebix: bebi dhe dyqan`

**Përshkrim i shkurtër (maks. 80):**
`Ditari i bebit tënd dhe dyqani me produkte për bebe, në një vend.`

**Përshkrim i plotë (maks. 4000):**

```
Bebix është shoqëruesi i prindërve: ditari i bebit dhe dyqani me produkte për bebe, në një aplikacion të vetëm.

DITARI I BEBIT
• Shëno ushqyerjen dhe pelenat me një prekje, me ngjyra që i dallon menjëherë
• Ndiq peshën dhe gjatësinë me grafikë të qartë, sipas datës
• Ruaj të dhënat mjekësore: grupin e gjakut, alergjitë, pediatrin
• Mbaj kujtimet: foto dhe çaste të para
• Njoftime që të kujtojnë kur të kesh nevojë
• Ndaje bebin me familjen, që të gjithë të shohin të njëjtat të dhëna

DYQANI
• Produkte për bebe nga marka të njohura, me foto të qarta
• Kërko, filtro sipas kategorisë ose markës dhe ruaj të preferuarat
• Porosit pa u regjistruar: mjafton emri, telefoni dhe adresa
• Paguan kur ta marrësh. Pa kartë, pa pagesë paraprake
• Ndiq statusin e porosisë: në pritje, e konfirmuar, e nisur, e dorëzuar

KOMUNITETI
• Pyet, ndaj përvojën dhe lexo këshilla nga prindër të tjerë
• Grupe sipas temës dhe përgjigje nga ekspertë

I SIGURT DHE I THJESHTË
• Shqip dhe anglisht
• Tema e çelët dhe e errët
• Mund ta fshish llogarinë dhe të dhënat kur të duash, brenda aplikacionit ose në web

Bebix. Për bebin tënd, me dashuri.
```

### English

**Name (max 30):** `Bebix: baby & shop`

**Short description (max 80):**
`Your baby's diary and a baby products shop, all in one app.`

**Full description:**

```
Bebix is a companion for parents: your baby's diary and a baby products shop, in one app.

BABY DIARY
• Log feeding and diapers with one tap, in colors you can tell apart at a glance
• Track weight and height with clear charts, by date
• Keep medical details: blood type, allergies, pediatrician
• Save memories: photos and firsts
• Reminders when you need them
• Share your baby with family so everyone sees the same data

SHOP
• Baby products from well-known brands, with clear photos
• Search, filter by category or brand, and save favorites
• Order without signing up: just your name, phone and address
• Pay on delivery. No card, no upfront payment
• Follow your order status: pending, confirmed, shipped, delivered

COMMUNITY
• Ask questions, share experience and read tips from other parents
• Topic groups and answers from experts

SIMPLE AND SAFE
• Albanian and English
• Light and dark theme
• Delete your account and data any time, in the app or on the web

Bebix. For your baby, with love.
```

**Kategoria:** Prindërim (Parenting). **Etiketat:** bebe, prindër, dyqan.
**Email kontakti:** `info.bebix@gmail.com`. **Faqja:** `https://www.bebix.store`.
**Politika e privatësisë:** `https://www.bebix.store/sq/legal/privacy`.

---

## 4. Screenshot-et (të paktën 2, më mirë 6–8)

Gjithë telefoni, portret. Nxirri nga telefoni, në pamjen e çelët, me të dhëna të vërteta (bebi me emër, disa regjistrime):

1. **Ditari i bebit** (ekrani kryesor me kartat e ushqyerjes e pelenave)
2. **Rritja** (grafiku i peshës ose gjatësisë)
3. **Dyqani** (lista me produkte dhe markat)
4. **Faqja e një produkti**
5. **Shporta ose arkëtimi** (me "Paguan kur ta marrësh")
6. **Porositë e mia** (me statuset me ngjyra)
7. **Komuniteti**
8. **Të dhënat mjekësore ose Kujtimet**

Mos shfaq të dhëna personale të vërteta të klientëve të tjerë.

---

## 5. Data safety (përgjigjet e sugjeruara)

Pyetjet kryesore:
- **A mbledh ose ndan aplikacioni të dhëna përdoruesi?** Po.
- **A janë të gjitha të dhënat e enkriptuara gjatë transferimit?** Po (HTTPS).
- **A mund të kërkojnë përdoruesit fshirjen e të dhënave?** Po. Lidhja: `https://www.bebix.store/sq/delete-account`.

| Lloji | Çfarë | Mbledhet | Ndahet | Qëllimi | E detyrueshme |
|---|---|---|---|---|---|
| Informacion personal | Emri | Po | Po, me tregtarin për dërgesë | Funksionimi i aplikacionit, porositë | Po |
| Informacion personal | Email | Po | Jo | Llogaria, njoftimet | Po (për llogari) |
| Informacion personal | Numri i telefonit | Po | Po, me tregtarin për dërgesë | Porositë | Po (për porosi) |
| Informacion personal | Adresa | Po | Po, me tregtarin për dërgesë | Porositë | Po (për porosi) |
| Shëndet dhe fitnes | Pesha, gjatësia, ushqyerja, pelenat, alergjitë, grupi i gjakut e shënimet mjekësore të bebit | Po | Jo | Funksionimi i aplikacionit | Jo |
| Foto dhe video | Foto e bebit, kujtimet, postimet e komunitetit | Po | Jo | Funksionimi i aplikacionit | Jo |
| Aktiviteti i aplikacionit | Postimet dhe komentet në komunitet | Po | Jo | Funksionimi i aplikacionit | Jo |
| Aktiviteti i aplikacionit | Ndërveprimet (analitika, PostHog) | Po | Jo (ofrues shërbimi) | Analitika | Jo |
| Informacion e performanca | Raportet e gabimeve (Sentry) | Po | Jo (ofrues shërbimi) | Diagnostikimi | Po |
| Pajisja ose ID të tjera | Çelësi për njoftime (push token) | Po | Jo | Njoftimet | Jo |

**Nuk mbledh:** vendndodhjen, të dhëna financiare (pagesa është në dorëzim), kontaktet, mesazhet private.

Dy përgjigje që mund t'i vendosësh ndryshe: nëse Google e konsideron dërgimin te tregtari "ndarje", e kam shënuar "Po" për emrin, telefonin e adresën. Kjo është përgjigjja më e sigurt.

## 6. Formularët e tjerë

**Qasja në aplikacion (App access):** zgjidh "Pjesë të aplikacionit janë të kufizuara" dhe shkruaj:

```
Dyqani hapet pa llogari: te ekrani i hyrjes shtyp "Vazhdo te Dyqani pa Login".
Për pjesën tjetër (ditari, komuniteti) hyr me llogarinë e provës:
Email: [VENDOS EMAILIN E LLOGARISË SË PROVËS]
Fjalëkalimi: [VENDOS FJALËKALIMIN]
```

Hap një llogari prove me email e fjalëkalim, pa lidhje me llogarinë tënde personale.

**Reklamat:** Jo, aplikacioni nuk ka reklama.

**Klasifikimi i përmbajtjes:** përgjigju "Jo" te dhuna, përmbajtja seksuale, droga, bixhozi. Te "përmbajtje e krijuar nga përdoruesit": **po** (komuniteti), dhe aplikacioni ka raportim të postimeve.

**Audienca e synuar:** 18 vjeç e lart (prindër). Mos zgjidh grupmoshat e fëmijëve, sepse aplikacioni është për prindër e jo për fëmijë.

**Deklarimi i aplikacionit për lajme, qeveri, shëndet:** shëndeti: aplikacioni **nuk është aplikacion mjekësor**. Mbajtja e peshës dhe gjatësisë është regjistër personal, jo diagnozë.

**Fshirja e llogarisë:** lidhja `https://www.bebix.store/sq/delete-account`. Fshirja punon edhe brenda aplikacionit.
