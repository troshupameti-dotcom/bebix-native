import { useState } from "react";
import { useLocalSearchParams } from "expo-router";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { BackButton } from "@/components/ui/BackButton";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { SUPPORT_EMAIL, openSupportEmail } from "@/lib/support";
import { useTranslation } from "@/lib/i18n/LanguageContext";

/**
 * Tekstet ligjore.
 *
 * Rregulli këtu: asnjë fjali nuk premton diçka që app-i nuk e bën sot.
 * Versioni i mëparshëm thoshte se të dhënat mund të fshiheshin "në çdo
 * kohë" (s'kishte fshirje llogarie), se të drejtat e GDPR-së do të
 * mbështeteshin "kur backend-i të jetë gati" (ishte gati prej kohësh), se
 * raportimet shqyrtoheshin "brenda 24 orëve" (s'kishte ekran ku të
 * shiheshin), dhe se dyqani do të kishte checkout "kur të aktivizohet"
 * (pranonte porosi). Tani secila prej tyre përshkruan gjendjen e vërtetë.
 */

const LAST_UPDATED = "24 tetor 2026";

const DOCS: { title: string; body: string }[] = [
  {
    title: "Kushtet e Përdorimit",
    body:
      "Bebix është aplikacion për prindër dhe kujdestarë ligjorë mbi 18 vjeç. Llogaria krijohet dhe kontrollohet nga një i rritur.\n\n" +
      "Duke e përdorur, pranon: të mos ngarkosh përmbajtje të paligjshme apo fyese; të respektosh privatësinë e prindërve të tjerë dhe të fëmijëve të tyre; të mos e përdorësh app-in për reklamë ose spam; dhe të mos e trajtosh përmbajtjen e app-it si këshillë mjekësore.\n\n" +
      "Llogaria jote është përgjegjësia jote. Nëse dyshon se dikush ka hyrë në të, ndërro fjalëkalimin dhe na njofto.\n\n" +
      "Mund ta pezullojmë një llogari që shkel këto kushte ose rregullat e Komunitetit.",
  },
  {
    title: "Politika e Privatësisë",
    body:
      "ÇFARË MBLEDHIM\n" +
      "• Llogaria: email-i, dhe emri nëse e shkruan. Kur hyn me Google, marrim email-in dhe emrin nga Google.\n" +
      "• Bebi: emri, datëlindja, gjinia nëse e shton, dhe çdo regjistrim që fut vetë — ushqyerje, gjumë, pelena, rritje, vaksina, të dhëna mjekësore, momente me foto.\n" +
      "• Komuniteti: postimet, komentet, pëlqimet, foto e video që ngarkon.\n" +
      "• Dyqani: emri, telefoni dhe adresa që shkruan te porosia, bashkë me produktet e porositura.\n" +
      "• Telefoni: një identifikues për njoftimet (push token), nëse i lejon njoftimet.\n" +
      "• Asistenti AI: sa pyetje ke bërë sot (pa përmbajtjen), dhe përgjigjet që raporton vetë. Bisedat nuk ruhen.\n" +
      "• Rrëzimet e app-it: kur app-i rrëzohet, dërgohet një raport teknik (modeli i telefonit, versioni i sistemit dhe i app-it, vendi i gabimit) — pa emër, pa email, pa të dhënat e bebit.\n" +
      "• Përdorimi: ngjarje të përgjithshme si hapja e app-it, hapja e dyqanit, krijimi i një porosie, regjistrimi i një ushqyerjeje, gjumi ose pelene (vetëm lloji dhe ora, jo sasia apo shënimet), ftesa te Familja dhe sa lloje njoftimesh ke fikur. Lidhen me një identifikues të rastësishëm ose me ID-në teknike të llogarisë, pa emra, pa adresa, pa email dhe pa emrin apo datëlindjen e bebit.\n\n" +
      "KU RUHEN\n" +
      "Te Supabase, në serverë brenda Bashkimit Evropian (Frankfurt). Fotot e momenteve rrinë në një hapësirë private: i sheh vetëm ti dhe prindi që fton te Familja, me një lidhje të përkohshme. Postimet, komentet dhe fotot e Komunitetit janë publike: i sheh kushdo, edhe në faqen e webit www.bebix.store.\n\n" +
      "COOKIES\n" +
      "Faqja e webit përdor vetëm cookies dhe ruajtje në shfletues që i duhen asaj për të punuar: për të të mbajtur të kyçur, për gjuhën, temën e ngjyrave dhe zonën kohore që zgjedh, si dhe për shportën dhe formularët e papërfunduar, që ruhen vetëm në shfletuesin tënd. Nuk përdorim cookies reklamash ose gjurmimi, as cookies të palëve të treta, ndaj nuk të kërkojmë pëlqim për to. Statistikat e vizitave në web numërohen pa cookie. Cookies mund t'i fshish kur të duash nga rregullimet e shfletuesit; pas kësaj do të duhet të hysh sërish në llogari.\n\n" +
      "PSE\n" +
      "Për të ta ofruar shërbimin që kërkon: ruajtja e historikut të bebit, njoftimet që zgjedh, komuniteti dhe dërgimi i porosive. Të dhënat e bebit i përpunojmë me pëlqimin tënd; porositë, sepse na duhen për të përmbushur blerjen.\n\n" +
      "ME KË NDAHEN\n" +
      "Nuk i shesim të dhënat tua, asnjëherë. I ndajmë vetëm me ata që na ndihmojnë ta ofrojmë shërbimin: Supabase (ruajtja, BE), Vercel (faqja e webit; regjistrat teknikë si adresa IP), Expo (dërgimi i njoftimeve), Sentry (raportet e rrëzimeve), PostHog (statistikat e përdorimit të përshkruara më lart; serverë në SHBA), Resend (email-et e konfirmimit dhe të rikthimit të fjalëkalimit), Anthropic (asistenti AI: vetëm pyetjet që i bën dhe mosha e fëmijës, kur e përdor dhe pasi jep pëlqimin; serverë në SHBA), Stripe (vetëm kur zgjedh të paguash me kartë: pagesa bëhet në faqen e Stripe, ndaj numrin e kartës nuk e shohim as e ruajmë ne), Google ose Apple (vetëm kur zgjedh të hysh me ta), dhe partnerin që të dërgon porosinë — atij i shkojnë emri, telefoni dhe adresa, pa të cilat dërgesa nuk bëhet dot. Asgjë prej të dhënave të bebit nuk u jepet partnerëve. Kur fton një prind tjetër te Familja, ai sheh dhe shton të dhënat e bebit njësoj si ti.\n\n" +
      "SA KOHË\n" +
      "Të dhënat e llogarisë dhe të bebit rrinë derisa ta fshish llogarinë. Porositë ruhen edhe pas fshirjes, të anonimizuara, sepse na kërkohen për kontabilitet.\n\n" +
      "TË DREJTAT E TUA\n" +
      "Mund të shohësh dhe të ndryshosh të dhënat brenda app-it, t'i eksportosh si PDF ose CSV nga Bebi → Cilësimet → Eksporto, dhe ta fshish llogarinë nga Cilësimet → Fshi llogarinë. Për çdo kërkesë tjetër — akses, korrigjim, kufizim, kundërshtim — shkruajna te " + SUPPORT_EMAIL + " dhe përgjigjemi brenda 30 ditëve.",
  },
  {
    title: "Fshirja e llogarisë dhe e të dhënave",
    body:
      "Llogarinë mund ta fshish vetë, brenda app-it: Cilësimet → Fshi llogarinë. Nuk kërkohet email, nuk kërkohet leje nga ne.\n\n" +
      "FSHIHET MENJËHERË DHE PËRGJITHMONË:\n" +
      "• Profili i bebit dhe i gjithë historiku: ushqyerjet, gjumi, pelenat, rritja, vaksinat, të dhënat mjekësore.\n" +
      "• Fotot e momenteve, nga telefoni dhe nga serveri.\n" +
      "• Postimet, komentet, pëlqimet dhe të ruajturat te Komuniteti.\n" +
      "• Lidhja e telefonit me njoftimet.\n" +
      "• Vetë llogaria.\n\n" +
      "MBETET:\n" +
      "Porositë e bëra te dyqani, si regjistrim tregtar. Emri, telefoni dhe adresa hiqen prej tyre, pra porosia nuk lidhet më me ty; mbetet vetëm çfarë u shit, për sa dhe kur. Kjo na kërkohet nga kontabiliteti dhe nga partnerët që i dërguan.\n\n" +
      "Nëse llogaria jote është e lidhur me panelin e adminit ose me një partner, fshirja bllokohet për siguri — shkruajna te " + SUPPORT_EMAIL + ". Nëse s'ke akses te app-i, po ashtu shkruajna dhe e bëjmë ne.",
  },
  {
    title: "Të dhënat e fëmijës",
    body:
      "Bebix përpunon të dhëna për një fëmijë, por i fut prindi ose kujdestari ligjor — jo fëmija. App-i nuk u drejtohet fëmijëve dhe nuk mbledh asgjë prej tyre drejtpërdrejt.\n\n" +
      "Të dhënat shëndetësore të bebit (vaksinat, matjet, shënimet mjekësore) janë kategori e ndjeshme dhe ruhen vetëm sepse ti zgjedh t'i futësh. Nuk përdoren për reklama dhe nuk ndahen me palë të treta.\n\n" +
      "Te Komuniteti, mos publiko të dhëna që e identifikojnë bebin — emër të plotë, adresë, institucion shëndetësor, ose foto ku duket dokumenti i tij.",
  },
  {
    title: "Përjashtimi mjekësor",
    body:
      "Bebix jep informacion të përgjithshëm edukativ, jo këshillë mjekësore. Kujtesat për vaksinat, kufijtë e rritjes dhe çdo sugjerim brenda app-it nuk zëvendësojnë vlerësimin e një mjeku.\n\n" +
      "Për çdo shqetësim shëndetësor, kontakto pediatrin. Në rast urgjence, kontakto shërbimin e urgjencës — mos prit përgjigje nga app-i ose nga Komuniteti.\n\n" +
      "Ekspertët e verifikuar te Komuniteti japin mendim të përgjithshëm publik, jo diagnozë për rastin tënd.",
  },
  {
    title: "Funksionet me AI",
    body:
      "Bebix AI është asistent me inteligjencë artificiale, jo mjek dhe jo njeri. Përgjigjet i shkruan modeli Claude i kompanisë Anthropic (SHBA).\n\n" +
      "KUSH E PËRDOR\n" +
      "Vetëm prindërit dhe kujdestarët mbi 18 vjeç, me llogari. Nuk është për fëmijë. Para përdorimit të parë app-i kërkon pëlqimin tënd, dhe pa të asgjë nuk dërgohet.\n\n" +
      "ÇFARË DËRGOHET\n" +
      "Pyetjet që shkruan te biseda (deri në 20 mesazhet e fundit), gjuha, dhe faza e mosha e fëmijës. Nuk dërgohen emri yt, emri i bebit, email-i apo vendndodhja. Mos shkruaj te biseda të dhëna që të identifikojnë ty ose fëmijën.\n\n" +
      "SI RUHEN\n" +
      "Bebix nuk i ruan bisedat: zhduken kur mbyll ekranin. Anthropic i përpunon vetëm për të shkruar përgjigjen dhe, sipas kushteve të tij për bizneset, nuk i përdor për të trajnuar modelet. Për kufirin ditor ruajmë vetëm sa pyetje ke bërë sot, pa përmbajtjen. Kur raporton një përgjigje, ruajmë pyetjen, përgjigjen dhe arsyen, që t'i shqyrtojë ekipi i Bebix-it.\n\n" +
      "KUFIZIMET\n" +
      "• Informacion i përgjithshëm, jo diagnozë dhe jo këshillë mjekësore. Përgjigjet mund të kenë pasaktësi: përdori si ide, jo si fakt.\n" +
      "• Nuk jep doza ilaçesh dhe nuk thotë kur të nisësh apo të ndalosh një ilaç.\n" +
      "• Në emergjencë thirr 112 ose shko në urgjencë; mos prit përgjigje nga AI-ja.\n" +
      "• Ka kufi pyetjesh në ditë për çdo llogari.\n\n" +
      "RAPORTIMI\n" +
      "Te çdo përgjigje ka butonin \"Raporto\". Raportimet i shqyrton ekipi i Bebix-it, dhe na ndihmojnë ta përmirësojmë asistentin.",
  },
  {
    title: "Rregullat e Komunitetit",
    body:
      "Nuk lejohen: përmbajtje fyese, urrejtje, ngacmim, material seksual, spam, reklamë e padeklaruar, dhe këshilla mjekësore të rreme të paraqitura si fakt.\n\n" +
      "Mos publiko të dhëna që identifikojnë bebin ose persona të tjerë pa lejen e tyre.\n\n" +
      "Çdo postim dhe koment mund të raportohet nga menuja ⋯, dhe çdo përdorues mund të bllokohet — postimet dhe komentet e tij zhduken për ty menjëherë.\n\n" +
      "Një postim me tri ose më shumë raportime fshihet automatikisht nga feed-i derisa ta shqyrtojmë; autori vazhdon ta shohë të vetin. Raportimet i shqyrtojmë sa më shpejt të mundemi, dhe përmbajtja që shkel rregullat hiqet. Llogaria e autorit mund të pezullohet.",
  },
  {
    title: "Dyqani, dërgesa dhe kthimet",
    body:
      "Porositë paguhen në dorëzim. Kostoja e dërgesës konfirmohet kur të kontaktojmë për porosinë, përpara se ajo të nisë.\n\n" +
      "Produktet shiten nga Bebix ose nga partnerë të listuar; partneri që e dërgon merr emrin, telefonin dhe adresën tënde, vetëm për dërgesën.\n\n" +
      "Nëse produkti arrin i dëmtuar, i gabuar ose nuk përputhet me përshkrimin, shkruajna te " + SUPPORT_EMAIL + " brenda 14 ditëve nga marrja dhe e zgjidhim — zëvendësim ose kthim parash.\n\n" +
      "Statusin e porosisë e ndjek te Dyqani → Porositë e mia.",
  },
  {
    title: "Njoftimet",
    body:
      "Njoftimet brenda app-it (zilja te faqja kryesore) ndërtohen në telefonin tënd nga të dhënat e bebit — vonesa vaksinash, kohë nga ushqyerja e fundit, e të ngjashme.\n\n" +
      "Njoftimet push kërkojnë lejen tënde dhe mund t'i fikësh në çdo kohë nga Cilësimet → Njoftimet, ose nga cilësimet e telefonit.",
  },
  {
    title: "Ndryshimet e këtyre kushteve",
    body:
      "Kur ndryshojmë diçka thelbësore — çfarë mbledhim, me kë e ndajmë, sa e mbajmë — do ta njoftojmë brenda app-it përpara se ndryshimi të hyjë në fuqi.\n\n" +
      "Përditësuar më " + LAST_UPDATED + ".",
  },
];

export default function LegalScreen() {
  const theme = useThemeColors();
  const { t } = useTranslation();
  // `section=ai`: hapet direkt pjesa e AI-së (nga dritarja e pëlqimit të asistentit).
  const { section } = useLocalSearchParams<{ section?: string }>();
  const [openIndex, setOpenIndex] = useState<number | null>(() =>
    section === "ai" ? DOCS.findIndex((d) => d.title === "Funksionet me AI") : null
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <BackButton fallback="/(main)/more" className="mr-3" />
        <Text className="font-display text-xl text-ink">Ligjore</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <View className="px-5">
          {DOCS.map((doc, i) => (
            <View key={doc.title} style={shadows.soft} className="bg-surface rounded-xl2 mb-3 overflow-hidden">
              <Pressable
                onPress={() => setOpenIndex(openIndex === i ? null : i)}
                accessibilityRole="button"
                accessibilityState={{ expanded: openIndex === i }}
                className="flex-row items-center justify-between px-4 py-3.5"
              >
                <Text className="font-bodySemibold text-sm text-ink flex-1 mr-2">{doc.title}</Text>
                <Icon name={openIndex === i ? "chevronLeft" : "chevronRight"} size={16} color={theme.inkFaint} />
              </Pressable>
              {openIndex === i && (
                <View className="px-4 pb-4">
                  <Text className="font-body text-sm text-ink-soft leading-6">{doc.body}</Text>
                </View>
              )}
            </View>
          ))}

          <Pressable
            onPress={() => void openSupportEmail("Pyetje ligjore ose privatësie", t("support_no_mail_app"))}
            style={shadows.soft}
            className="bg-surface rounded-xl2 px-4 py-3.5 flex-row items-center mt-2"
          >
            <View className="w-8 h-8 rounded-full bg-olive-bg items-center justify-center mr-3">
              <Icon name="send" size={15} color="#6E7452" />
            </View>
            <View className="flex-1">
              <Text className="font-bodyMedium text-sm text-ink">Kërkesa për të dhënat e tua</Text>
              <Text className="font-body text-xs text-ink-faint mt-0.5">{SUPPORT_EMAIL}</Text>
            </View>
            <Icon name="chevronRight" size={16} color={theme.inkFaint} />
          </Pressable>

          <Text className="font-body text-[11px] text-ink-faint text-center mt-5">
            Përditësuar më {LAST_UPDATED}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
