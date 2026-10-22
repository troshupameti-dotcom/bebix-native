/**
 * Pastrimi i ilustrimit SVG që vizaton Claude. Lejohen vetëm forma të thjeshta (drejtkëndësha, rrathë, vija, shtigje,
 * gradientë) me atribute vizatimi; çdo gjë tjetër (skripte, lidhje, imazhe, tekst, atribute `on…`, `href`, `style`)
 * e hedh poshtë gjithë figurën. Përdoret në server para ruajtjes dhe në app para vizatimit (e njëjta skedë).
 * Pa varësi: punon në Deno, në React Native dhe në teste.
 */

const TAGS = new Set([
  "svg", "g", "rect", "circle", "ellipse", "path", "line", "polyline", "polygon",
  "defs", "linearGradient", "radialGradient", "stop",
]);
const ATTRS = new Set([
  "xmlns", "viewBox", "width", "height", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "fx", "fy",
  "d", "points", "fill", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-dasharray",
  "opacity", "fill-opacity", "stroke-opacity", "fill-rule", "transform", "id", "offset", "stop-color", "stop-opacity",
  "gradientUnits", "gradientTransform",
]);
/** Vlerat: numra, ngjyra, fjalë si "round"/"none", transformime dhe `url(#id)`. Pa ":" ";" "<" ">" thonjëza. */
const VALUE = /^[#a-zA-Z0-9 .,\-()%]*$/;
const ID = /^[a-zA-Z][a-zA-Z0-9_-]{0,30}$/;
const URL_REF = /url\(/i;
const LOCAL_URL = /^url\(#[a-zA-Z][a-zA-Z0-9_-]{0,30}\)$/;

export const SVG_LIMITS = { maxChars: 16000, maxElements: 260 };
/** Figura vizatohet gjithmonë në këtë kornizë (si skenat e app-it), që të mbushë kopertinën. */
export const SVG_VIEWBOX = "0 0 160 120";

export function sanitizeSvg(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const src = input
    .trim()
    .replace(/^<\?xml[^>]*\?>/i, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  if (!src || src.length > SVG_LIMITS.maxChars * 2) return null;

  const tokenRe = /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9]*)((?:\s+[a-zA-Z][a-zA-Z0-9:-]*\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/)?\s*>/g;
  const attrRe = /([a-zA-Z][a-zA-Z0-9:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  const stack: string[] = [];
  let out = "";
  let last = 0;
  let count = 0;
  let m: RegExpExecArray | null;

  while ((m = tokenRe.exec(src))) {
    // Tekst mes etiketave (ose diçka që s'është etiketë e lejuar): figura refuzohet e tëra.
    if (src.slice(last, m.index).trim()) return null;
    last = tokenRe.lastIndex;
    const [, closing, tag, attrs, selfClose] = m;
    if (!TAGS.has(tag)) return null;
    if (closing) {
      if (stack.pop() !== tag) return null;
      out += `</${tag}>`;
      continue;
    }
    if (++count > SVG_LIMITS.maxElements) return null;
    if (stack.length === 0 ? tag !== "svg" : tag === "svg") return null;
    if (stack.length === 0 && out) return null;

    const clean: string[] = [];
    let a: RegExpExecArray | null;
    attrRe.lastIndex = 0;
    while ((a = attrRe.exec(attrs))) {
      const name = a[1];
      const value = (a[2] ?? a[3] ?? "").trim();
      if (!ATTRS.has(name)) return null;
      if (name === "xmlns" || (tag === "svg" && (name === "width" || name === "height" || name === "viewBox"))) continue;
      if (name === "id" ? !ID.test(value) : !VALUE.test(value)) return null;
      if (URL_REF.test(value) && !LOCAL_URL.test(value)) return null;
      clean.push(`${name}="${value}"`);
    }
    const rest = clean.length ? ` ${clean.join(" ")}` : "";
    if (tag === "svg") {
      if (selfClose) return null;
      out += `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${SVG_VIEWBOX}"${rest}>`;
      stack.push(tag);
      continue;
    }
    out += `<${tag}${rest}${selfClose ? "/>" : ">"}`;
    if (!selfClose) stack.push(tag);
  }
  if (src.slice(last).trim() || stack.length || count < 4) return null;
  return out.length <= SVG_LIMITS.maxChars ? out : null;
}
