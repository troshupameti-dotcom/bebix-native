/**
 * Paleta e Bebix — burimi i vetëm i ngjyrave për light dhe dark.
 *
 * Përdoret nga dy vende:
 *   1. tailwind.config.js — i kthen në variabla CSS (--c-*), që çdo klasë si
 *      `bg-cream` / `text-ink` të ndërrojë vetë me temën, pa `dark:` kudo.
 *   2. lib/theme/useThemeColors.ts — jep vlerat hex për vendet ku RN kërkon
 *      një ngjyrë direkt (ikona, placeholder, ActivityIndicator, tab bar).
 *
 * Kontrasti është i verifikuar me WCAG 2.x: tekstet ≥ 4.5:1 mbi faqe dhe
 * kartela në të dyja temat, dhe teksti mbi butonat ≥ 4.5:1.
 *
 * Emrat janë sipas ROLIT, jo nuancës:
 *   cream*   = sfondet e faqes          surface* = kartelat
 *   ink*     = teksti (kryesor → i zbehtë)
 *   olive* / orange* = theksi i markës   onAccent = tekst/ikonë mbi theks
 * Pra në dark "cream" është sfond i errët dhe "ink" tekst i çelët.
 */

const light = {
  cream: "#FBF6EE",
  creamSoft: "#F3ECDD",
  creamLine: "#E9DFCC",
  surface: "#FFFFFF",
  surfaceAlt: "#F6F1E7",
  ink: "#2C271F",
  inkSoft: "#5F564A",
  inkFaint: "#7A7062",
  olive: "#636A45",
  oliveBg: "#E7EAD9",
  orange: "#A5531A",
  orangeBg: "#FAEEE2",
  onAccent: "#FFFFFF",
};

const dark = {
  // Kafe shumë e errët dhe e ngrohtë, jo e zezë e pastër: më e butë për sytë
  // natën dhe në përputhje me tonet krem të markës.
  cream: "#12100D",
  creamSoft: "#1A1713",
  creamLine: "#2F2A22",
  surface: "#1D1A15",
  surfaceAlt: "#24201A",
  ink: "#F3EDE2",
  inkSoft: "#C4BAA8",
  inkFaint: "#948A79",
  // Theksi ndriçohet në dark që të lexohet mbi sfondin e errët.
  olive: "#A5AE7E",
  oliveBg: "#2A2D1F",
  orange: "#E39A62",
  orangeBg: "#3A2A1C",
  onAccent: "#12100D",
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
