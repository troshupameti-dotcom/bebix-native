/**
 * Kontakti i mbështetjes — një vend i vetëm.
 *
 * Më parë adresa ishte shkruar direkt te ekrani i ndihmës, bashkë me një
 * shënim të dukshëm për përdoruesin: "(Rregullo adresën ... me email-in
 * real)". Kur të ndryshojë adresa, ndryshohet vetëm kjo rresht.
 *
 * KUJDES: kjo adresë del te ekrani i ndihmës, te fshirja e llogarisë dhe te
 * tekstet ligjore. Duhet të jetë kuti e vërtetë që e lexon dikush — Google
 * Play kërkon kontakt funksional, dhe GDPR kërkon një rrugë ku përdoruesi
 * të kërkojë të dhënat ose fshirjen e tyre.
 */
export const SUPPORT_EMAIL = "info.bebix@gmail.com";

/** Adresa për kërkesa të privatësisë; njësoj derisa të ketë ekip të veçantë. */
export const PRIVACY_EMAIL = SUPPORT_EMAIL;

/** Faqja e webit: kushtet, privatësia dhe fshirja e llogarisë jetojnë edhe atje. */
export const WEB_BASE_URL = "https://www.bebix.store";

export function webLegalUrl(language: string, doc: "terms" | "privacy"): string {
  return `${WEB_BASE_URL}/${language === "en" ? "en" : "sq"}/legal/${doc}`;
}
