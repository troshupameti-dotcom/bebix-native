/**
 * Mesazhe diagnostikimi vetëm gjatë zhvillimit. Në aplikacionin e publikuar nuk
 * shkruajnë asgjë (as në pajisje, as me të dhëna të përdoruesit); gabimet e
 * vërteta shkojnë te `reportError` (Sentry).
 */
export function log(...args: unknown[]): void {
  if (__DEV__) console.log(...args);
}

/** Njësoj si `log`, për gabime të rikuperueshme (p.sh. një listë që s'u ngarkua): në produkt nuk shkruan asgjë. */
export function logWarn(...args: unknown[]): void {
  if (__DEV__) console.warn(...args);
}
