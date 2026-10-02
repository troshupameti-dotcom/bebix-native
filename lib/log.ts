/**
 * Mesazhe diagnostikimi vetëm gjatë zhvillimit. Në aplikacionin e publikuar nuk
 * shkruajnë asgjë (as në pajisje, as me të dhëna të përdoruesit); gabimet e
 * vërteta shkojnë te `reportError` (Sentry).
 */
export function log(...args: unknown[]): void {
  if (__DEV__) console.log(...args);
}
