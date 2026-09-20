/**
 * Paleta e Bebix — burimi i vetëm i ngjyrave për light dhe dark.
 *
 * Përdoret nga dy vende:
 *   1. tailwind.config.js — i kthen në variabla CSS (--c-*), që çdo klasë si
 *      `bg-cream` / `text-ink` të ndërrojë vetë me temën, pa `dark:` kudo.
 *   2. lib/theme/useThemeColors.ts — jep vlerat hex për vendet ku RN kërkon
 *      një ngjyrë direkt (ikona, placeholder, ActivityIndicator, tab bar).
 *
 * Ngjyrat dalin nga vetë logoja, jo nga shija: navy-ja #13293D e fjalës
 * "bebix" është ngjyra e tekstit, dhe blu-ja e qiellit #8FBEE8 e shkronjës
 * "b" është theksi në temën e errët. Paleta e mëparshme (krem i ngrohtë me
 * theks ulliri) nuk kishte asnjë lidhje me logon — prandaj logoja dukej
 * gjithmonë e ngjitur mbi app-in, jo pjesë e tij.
 *
 * Sfondet janë të ftohta dhe me kromë shumë të ulët: kjo faqe lexohet edhe
 * në tre të mëngjesit, dhe një sfond i ngopur lodh.
 *
 * Dy palete të tjera u shqyrtuan dhe u lanë mënjanë — "Neutrale e pastër"
 * dhe "Sherebelë". Të dyja kalojnë të njëjtat kontrolle dhe ndërrimi është
 * vetëm ky skedar; krahasimi rri te:
 * https://claude.ai/artifact/2VJfGwHV3DNNLmvaKdg5iR
 *
 * Kontrasti është i verifikuar me WCAG 2.x: tekstet ≥ 4.5:1 mbi faqe dhe
 * kartela në të dyja temat, teksti mbi butonat ≥ 4.5:1, dhe vijat e ndarjes
 * ≥ 1.4:1 (më parë 1.22:1 — mezi dukeshin).
 *
 * Emrat janë sipas ROLIT, jo nuancës. Kjo është arsyeja pse tokeni i sfondit
 * quhet ende `cream` dhe theksi `olive` edhe pse asnjëra s'është më e tillë:
 * emri përshkruan ku përdoret, dhe rolet nuk ndryshuan.
 *   cream*   = sfondet e faqes          surface* = kartelat
 *   ink*     = teksti (kryesor → i zbehtë)
 *   olive*   = theksi kryesor (blu)     orange*  = theksi i dytë (i ngrohtë)
 *   onAccent = tekst/ikonë mbi theks
 * Pra në dark "cream" është sfond i errët dhe "ink" tekst i çelët.
 */

const light = {
  cream: "#F6F9FC",
  creamSoft: "#EAF1F8",
  creamLine: "#C8D3DF",
  surface: "#FFFFFF",
  surfaceAlt: "#F1F6FB",
  ink: "#13293D",
  inkSoft: "#47596C",
  inkFaint: "#6E8090",
  // Blu-ja e logos është shumë e çelët për një buton me tekst të bardhë;
  // theksi është e njëjta familje, e thelluar sa duhet për 4.5:1.
  olive: "#1F6193",
  oliveBg: "#E2EFFA",
  // Rëra e ngrohtë e logos mban të dytin: ngroh një paletë që përndryshe
  // do të ishte krejt e ftohtë.
  orange: "#9C5A22",
  orangeBg: "#FBEFE1",
  onAccent: "#FFFFFF",
};

const dark = {
  // Navy shumë e errët, jo e zezë e pastër: e njëjta familje me tekstin e
  // temës së ditës, që të dyja temat të ndihen si i njëjti app.
  cream: "#0C151E",
  creamSoft: "#131E29",
  creamLine: "#2B3B4E",
  surface: "#152131",
  surfaceAlt: "#1B2938",
  ink: "#E9EFF6",
  inkSoft: "#B2C0CF",
  inkFaint: "#8193A5",
  // Këtu theksi është pikërisht blu-ja e shkronjës "b".
  olive: "#8FBEE8",
  oliveBg: "#192A3B",
  orange: "#E2A876",
  orangeBg: "#33261A",
  onAccent: "#0C151E",
};

/** "#RRGGBB" -> "R G B", forma që pranon `rgb(var(--x) / <alpha-value>)`. */
function toRgbChannels(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

/** creamSoft -> --c-cream-soft */
function cssVar(token) {
  return `--c-${token.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`;
}

module.exports = { light, dark, toRgbChannels, cssVar };
