# Widget-et e Bebix

Widget-i në ekranin kryesor të telefonit tregon kur u ushqye bebi, kur u ndërrua pelena dhe a po fle. Me një prekje shënon pelenën ose gjumin, pa e hapur app-in.

| Pjesa | Gjendja |
|---|---|
| Android: widget-i në ekranin kryesor | ✅ gati për provë |
| Lidhjet `bebix://` (për widget, Shortcuts, NFC) | ✅ gati |
| iPhone: widget-et, ekrani i kyçur, Dynamic Island | ⏳ faza tjetër (duhet llogaria Apple) |
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

## b) Pas pagesës së Apple Developer ($99/vit)

Kjo bëhet në fazën tjetër. Hapat që do të duhen:

1. **Llogaria Apple Developer** (si person, ose si kompani pas D-U-N-S).
2. Unë shtoj **`expo-widgets`**: libraria zyrtare e Expo SDK 57 për widget-et e iPhone-it dhe Live Activities. E zgjodha në vend të `@bacons/apple-targets`, sepse është pjesë e Expo dhe s'kërkon kod Swift më vete.
   - Widget i vogël dhe i mesëm, plus widget-et e ekranit të kyçur.
   - Butonat brenda widget-it (iOS 17+) për pelenën dhe gjumin, me të njëjtën radhë si në Android.
   - **Live Activity / Dynamic Island**: timeri i gjumit dhe i gjirit numëron në ekranin e kyçur.
   - App Group: `group.com.bebix.app`.
3. Ti ekzekuton:
   ```powershell
   npx eas-cli build -p ios --profile preview
   ```
   EAS të kërkon të hysh me Apple ID. Certifikatat, App Group-in dhe identifikuesin e widget-it (`com.bebix.app.widgets`) i krijon vetë.
4. Për ta instaluar në iPhone pa App Store, regjistro telefonin një herë:
   ```powershell
   npx eas-cli device:create
   ```
5. Për App Store: `npx eas-cli build -p ios --profile production`, pastaj `npx eas-cli submit -p ios`.

---

## c) Google Play

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

## d) Ora (vetëm plani, s'është ndërtuar)

- **Apple Watch:** shtohet pas iOS-it. Tri butona të mëdhenj (pelenë, fle/u zgjua, ushqeva) dhe "komplikacion" në fytyrën e orës me orën e ushqimit të fundit. Përdor të njëjtën radhë: ora dërgon veprimin te iPhone-i, iPhone-i e shkruan në ditar.
- **Wear OS (Samsung Galaxy Watch):** "Tile" me të njëjtat tri butona, i lidhur me telefonin.
- Të dyja kërkojnë kod native më vete. Ia vlen pasi të shohim sa përdoret widget-i.
