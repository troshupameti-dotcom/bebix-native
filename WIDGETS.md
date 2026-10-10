# Widget-et e Bebix

Widget-i në ekranin kryesor të telefonit tregon kur u ushqye bebi, kur u ndërrua pelena dhe a po fle. Me një prekje shënon pelenën ose gjumin, pa e hapur app-in.

| Pjesa | Gjendja |
|---|---|
| Android: widget-i në ekranin kryesor | ✅ gati për provë |
| Lidhjet `bebix://` (për widget, Shortcuts, NFC) | ✅ gati |
| Android: shortcuts (mbaj gishtin mbi ikonën) | ✅ gati për provë |
| Modaliteti i natës (ora 3 e natës) | ✅ gati për provë |
| iPhone: widget-et, ekrani i kyçur, Live Activity / Dynamic Island | ✅ i shkruar, ⏳ provohet pas llogarisë Apple |
| iPhone: Siri ("Hey Siri, Bebix wet diaper") | ✅ i shkruar, ⏳ provohet pas llogarisë Apple |
| Ora (Apple Watch / Wear OS) | 📝 vetëm plani |

---

## a) Provoje widget-in e Android-it tani

### 1. Bëj build-in e ri
Widget-i ka kod native, ndaj s'del me përditësim OTA. Duhet APK i ri:

```powershell
npx eas-cli build -p android --profile preview
```

Kur mbaron (~15–40 min), hape linkun nga Samsung-u dhe instaloje APK-në sipër asaj të vjetrës. Të dhënat nuk humbin.

### 2. Hape Bebix një herë
Hyr në llogari. App-i e shkruan pamjen e parë për widget-in. Pa këtë hap, widget-i shkruan "Hape Bebix një herë…".

### 3. Shtoje widget-in
1. Mbaj gishtin në një vend bosh të ekranit kryesor → **Widgets**.
2. Kërko **Bebix** → tërhiqe widget-in në ekran (4×2).
3. Mund ta zmadhosh ose ta zvogëlosh duke e mbajtur të shtypur.

### 4. Çfarë duhet të shohësh

```
┌─────────────────────────────────────────┐
│ Bebix · Ana                             │
│ ┌ Ushqimi ┐ ┌ Pelena ┐ ┌ Gjumi ────┐    │
│ │ 14:05   │ │ 13:40  │ │ 12:10     │    │
│ │ Biberon │ │ E lagët│ │ U zgjua   │    │
│ └─────────┘ └────────┘ └───────────┘    │
│ [Ushqeva] [E lagët] [Bajga] [Fli]       │
└─────────────────────────────────────────┘
```

- Ngjyrat janë si te app-i: ushqimi rozë, pelena kaltër, gjumi vjollcë.
- Ndjek temën e telefonit (e çelët / e errët) dhe gjuhën e app-it (shqip / anglisht).

### 5. Lista e provës

| # | Bëj këtë | Duhet të ndodhë |
|---|---|---|
| 1 | Prek **E lagët** | Pelena tregon orën e tanishme dhe "E lagët". App-i s'hapet. |
| 2 | Hape Bebix → Pelenat | Shënimi është aty, me orën e prekjes (jo të hapjes). |
| 3 | Prek **E lagët** 3 herë shpejt | Shënohet **një** herë. |
| 4 | Prek **Fli** | Gjumi: "Po fle" me orën; butoni bëhet **U zgjua**. |
| 5 | Prek **U zgjua** | Gjumi mbyllet; te app-i del me orën e saktë. |
| 6 | Vendos **Airplane mode**, prek **Bajga** dhe **Fli** | Widget-i ndryshon menjëherë; kur hapet app-i, shënimet janë aty. Sync-u shkon kur kthehet interneti. |
| 7 | Mbylle app-in krejt (hiqe nga të fundit), prek **E lagët** | Ruhet; del te app-i herën tjetër që e hap. |
| 8 | Prek **Ushqeva** | Hapet Ushqyerja me "Ushqeva tani" gati. |
| 9 | Nis timerin e gjirit në app | Widget-i: Ushqimi → "Gji · po vazhdon". |
| 10 | Shto pelenë **brenda** app-it | Widget-i rifreskohet vetë brenda pak sekondash. |
| 11 | Ndërro gjuhën në English | Widget-i kalon në anglisht. |
| 12 | Ndërro telefonin në temë të errët | Widget-i errësohet. |
| 13 | Prek kutitë e sipërme (Ushqimi / Pelena / Gjumi) | Hapet ekrani përkatës. |

Nëse diçka s'shkon, më dërgo foto të widget-it dhe numrin e rreshtit nga tabela.

### Lidhjet `bebix://` (për Shortcuts, NFC ose butona të tjerë)

| Lidhja | Çfarë bën |
|---|---|
| `bebix://log/diaper?type=wet` | shënon pelenë të lagët (`dirty` = bajga, `both` = të dyja) |
| `bebix://log/diaper` | hap Pelenat |
| `bebix://log/feeding` | hap Ushqyerjen |
| `bebix://sleep/toggle` | fle ↔ u zgjua |
| `bebix://sleep` | hap Gjumin |

Mund t'i provosh nga kompjuteri me telefonin të lidhur me kabllo:
```powershell
adb shell am start -a android.intent.action.VIEW -d "bebix://log/diaper?type=wet"
```

### Si punon (shkurt)
- App-i shkruan një "pamje" të vogël (ushqimi, pelena dhe gjumi i fundit) sa herë ndryshon diçka.
- Prekja në widget ruhet në një radhë me orën e saj, edhe pa internet dhe edhe kur app-i është i mbyllur. Widget-i e tregon menjëherë.
- Kur hapet app-i (ose nëse është i hapur në sfond), radha zbrazet në ditar dhe pastaj sinkronizohet si çdo shënim tjetër.
- Kundër dyfishimit: çdo prekje ka id-në e vet, dhe dy prekje të njëjta brenda 3 sekondash llogariten si një.

---

## b) Shortcuts në Android dhe modaliteti i natës (provohen tani)

**Shortcuts:** mbaj gishtin mbi ikonën e Bebix. Dalin **E lagët**, **Bajga**, **Gjumi** dhe **Ushqim**.
- Mund t'i tërheqësh edhe si ikona më vete në ekranin kryesor.
- Shënojnë njësoj si widget-i: me orën e prekjes, pa dyfishim, edhe pa internet.
- Google Assistant: "Hey Google, hap Bebix" punon kudo. Thirrja e një shortcut-i me emër ("Hey Google, Bebix E lagët") varet nga telefoni dhe gjuha. Shqipja s'mbështetet nga Assistant-i, ndaj në anglisht përdor emrat "Wet", "Dirty", "Sleep".

**Modaliteti i natës:**
- Ndizet vetë **22:00–06:00**. E fik ose e ndez te Më shumë → Pamja → "Modaliteti i natës automatikisht".
- E ndez edhe me **🌙** lart te faqja e bebit.
- Ekrani bëhet shumë i errët, me ngjyrë të ngrohtë, pa animacione, me 4 butona të mëdhenj poshtë: Ushqim, E lagët, Bajga, Fli/U zgjua.
- Butoni i ushqimit ndjek llojin e fundit: gjiri nis/ndal timerin, biberoni ruan sasinë e fundit.
- Pas çdo prekjeje: dridhje + "✓ U ruajt · Anulo".
- **Dil** e fik deri në mëngjes (07:00).

**"U ruajt" pas çdo shënimi:** ushqyerja, pelenat dhe tani edhe gjumi (nisja dhe mbarimi) kanë shiritin "U ruajt · Ndrysho · Fshi".

---

## c) Pas pagesës së Apple Developer ($99/vit)

Kodi i iPhone-it është **i shkruar dhe gati për build**. S'është provuar ende, sepse pa llogari Apple s'bëhet build për iOS.

Çfarë përmban:
- **Widget-et** (`expo-widgets`, libraria zyrtare e Expo SDK 57): i vogël, i mesëm (me lidhjet E lagët / Bajga / Gjumi) dhe tre për ekranin e kyçur. Ndjekin temën e errët/çelët dhe gjuhën e app-it.
- **Live Activity / Dynamic Island:** kur nis gjumi ose timeri i gjirit, kohëmatësi numëron vetë në ekranin e kyçur dhe në Dynamic Island. Mbyllet vetë kur mbaron.
- **Siri / Shortcuts:** "Hey Siri, log a wet diaper in Bebix", "Bebix dirty diaper", "Bebix sleep", "Log a feeding in Bebix". Siri s'flet shqip, ndaj frazat janë në anglisht. Në app-in Shortcuts mund t'i riemërtosh si të duash.
- App Group: `group.com.bebix.app`; identifikuesi i widget-it: `com.bebix.app.widgets`.

Hapat:
1. **Llogaria Apple Developer** (si person, ose si kompani pas D-U-N-S).
2. Ti ekzekuton:
   ```powershell
   npx eas-cli build -p ios --profile preview
   ```
   EAS të kërkon të hysh me Apple ID. Certifikatat, App Group-in dhe identifikuesin e widget-it i krijon vetë.
3. Për ta instaluar në iPhone pa App Store, regjistro telefonin një herë:
   ```powershell
   npx eas-cli device:create
   ```
4. Provo: shto widget-in, nis një gjumë (duhet të dalë Live Activity) dhe thuaj "Hey Siri, Bebix wet diaper".
5. Për App Store: `npx eas-cli build -p ios --profile production`, pastaj `npx eas-cli submit -p ios`.

**Nëse build-i i parë i iOS dështon:** dërgoma log-un e EAS. Si zgjidhje e përkohshme, hiq nga `app.json` rreshtin `"./plugins/withBebixAppIntents"` (Siri) ose blloku `"expo-widgets"` (widget-et), dhe pjesa tjetër ndërtohet normalisht.

---

## d) Google Play

Widget-i s'kërkon asgjë të veçantë nga Google Play: shkon brenda të njëjtit app.

1. Pas pagesës së llogarisë Play Console ($25 një herë), krijo app-in **Bebix** me paketën `com.bebix.app`.
2. Build për dyqan (AAB):
   ```powershell
   npx eas-cli build -p android --profile production
   ```
3. Ngarkoje te **Testing → Internal testing** (ose `npx eas-cli submit -p android`).
4. Te **Store listing**, shto edhe një foto ekrani me widget-in në ekranin kryesor: e bën app-in më tërheqës.
5. Llogaritë personale të reja duhet të bëjnë **testim të mbyllur me 12 testues për 14 ditë** para publikimit. Për llogari kompanie ky kusht s'vlen.

---

## e) Ora (vetëm plani, s'është ndërtuar)

- **Apple Watch:** shtohet pas iOS-it. Tri butona të mëdhenj (pelenë, fle/u zgjua, ushqeva) dhe "komplikacion" në fytyrën e orës me orën e ushqimit të fundit. Përdor të njëjtën radhë: ora dërgon veprimin te iPhone-i, iPhone-i e shkruan në ditar.
- **Wear OS (Samsung Galaxy Watch):** "Tile" me të njëjtat tri butona, i lidhur me telefonin.
- Të dyja kërkojnë kod native më vete. Ia vlen pasi të shohim sa përdoret widget-i.
