/**
 * Kërkimi te rrjedha bëhet te serveri (jo vetëm mes 20 postimeve të ngarkuara). Teksti vendoset brenda një filtri `or`
 * të PostgREST, ku presja, kllapat dhe yllza e prishin sintaksën, ndaj hiqen; gjatësia kufizohet.
 */
export function sanitizeSearch(input: string): string {
  return input
    .replace(/[,()*%"\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60)
    .trim();
}
