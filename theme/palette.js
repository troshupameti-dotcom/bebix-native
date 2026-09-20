/**
 * Paleta e Bebix — "Tranquil Oasis". Burimi i vetëm i ngjyrave për light dhe dark.
 *
 * Përdoret nga dy vende:
 *   1. tailwind.config.js — i kthen në variabla CSS (--c-*), që çdo klasë si
 *      `bg-cream` / `text-ink` të ndërrojë vetë me temën, pa `dark:` kudo.
 *   2. lib/theme/useThemeColors.ts — jep vlerat hex për vendet ku RN kërkon
 *      një ngjyrë direkt (ikona, placeholder, ActivityIndicator, tab bar).
 *
 * Ideja: baza është tokë e ngrohtë (taupe), ngjyra vjen nga minta dhe
 * moonstone-i, dhe veprimi është i zi. Kjo është arsyeja pse app-i nuk
 * duket si lodër: ngjyrat rrinë te mbushjet e vogla dhe te shenjat, kurse
 * çdo gjë që shtypet është e zezë klasike.
 *
 * ── Ku shkon secila ngjyrë ──────────────────────────────────────────────
 *   Mint      #C1DDD8  → `oliveBg`, tema e ditës. Rrathët e avatarëve,
 *                        pllakat e ikonave, shenjat e vaksinave. Kjo është
 *                        ngjyra që shihet më shumë.
 *   Moonstone #9EC4C5  → `olive`, tema e natës. Në të errët një theks duhet
 *                        të jetë i çelët, dhe moonstone-i është pikërisht
 *                        motra më e thellë e mintës.
 *   Warm taupe         → gjithë familja neutrale: sfondet, vijat, teksti
 *                        dytësor. Kjo e mban paletën të ngrohtë pa e verdhur.
 *   Rozë e lehtë       → `orangeBg` / `orange`, e kursyer: shenjat e
 *                        ushqyerjes, ndonjë distinktiv, teksti i dytë.
 *
 * ── Pse `olive` është pothuajse e zezë ──────────────────────────────────
 * `bg-olive` përdoret në 28 skedarë si mbushje — butona, pika, pllaka. Duke
 * e bërë vetë token-in jeshile-të-zezë (#1F3D38), çdo buton del klasik i zi
 * pa prekur asnjë nga ato thirrje, dhe të dy familjet e butonave që kishte
 * app-i (jeshile dhe kafe) bëhen një e vetme. Nuk është e zezë e pastër:
 * ka shpirt jeshil, dhe kjo duket kur rri pranë mintës.
 *
 * Kontrasti është i verifikuar me WCAG 2.x, 36 kontrolle në të dyja temat:
 * tekstet ≥ 4.5:1 mbi faqe dhe kartela, teksti mbi butonat 11.8:1, teksti i
 * theksit mbi mintë 8.2:1, dhe vijat e ndarjes ≥ 1.4:1.
 *
 * Emrat janë sipas ROLIT, jo nuancës — prandaj sfondi quhet ende `cream`
 * dhe theksi `olive` edhe pse asnjëra s'është më e tillë. Emri përshkruan ku
 * përdoret, dhe rolet nuk ndryshuan:
 *   cream*   = sfondet e faqes          surface* = kartelat
 *   ink*     = teksti (kryesor → i zbehtë)
 *   olive*   = theksi kryesor           orange*  = theksi i dytë
 *   onAccent = tekst/ikonë mbi theks
 * Pra në dark "cream" është sfond i errët dhe "ink" tekst i çelët.
 */

const light = {
  // Tokë e ngrohtë, jo krem i verdhë: taupe shumë i hapur.
  cream: "#F8F6F2",
  creamSoft: "#EFE9E1",
  creamLine: "#D0C6B8",
  surface: "#FFFFFF",
  // Kartela e dytë merr një frymë mintë, që të mos jetë krejt e ngrohtë.
  surfaceAlt: "#F1F4F2",
  ink: "#1C1A16",
  inkSoft: "#565047",
  inkFaint: "#857C71",
  // E zeza klasike e butonave — me shpirt jeshil, jo e zezë e vdekur.
  olive: "#1F3D38",
  oliveBg: "#C1DDD8",
  // Rozë e pjekur: mjaft e thellë sa të lexohet si tekst.
  orange: "#8F4E5A",
  orangeBg: "#F5E2E4",
  onAccent: "#FFFFFF",
};

const dark = {
  // Kafe shumë e errët dhe e ngrohtë, e njëjta familje me taupe-n e ditës.
  cream: "#14120F",
  creamSoft: "#1B1815",
  creamLine: "#3D372F",
  surface: "#1E1B17",
  surfaceAlt: "#25211C",
  ink: "#F2EDE5",
  inkSoft: "#C1B7A9",
  inkFaint: "#8F8578",
  // Këtu theksi është moonstone: në të errët e zeza s'do të dukej fare.
  olive: "#9EC4C5",
  oliveBg: "#1E2E2D",
  orange: "#E0A5AE",
  orangeBg: "#2E2023",
  onAccent: "#14120F",
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
