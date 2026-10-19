import { Alert, Linking } from "react-native";

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

/**
 * Hap emailin për mbështetjen. Telefoni pa aplikacion emaili (p.sh. iPhone pa Mail) e refuzon lidhjen `mailto:`:
 * atëherë prindi sheh adresën, në vend të një gabimi të heshtur.
 */
export async function openSupportEmail(subject: string, noAppMessage: string): Promise<void> {
  try {
    await Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`);
  } catch {
    Alert.alert(SUPPORT_EMAIL, noAppMessage);
  }
}
