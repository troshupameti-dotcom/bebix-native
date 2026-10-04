/**
 * Metodat e pagesës.
 *
 *  - `cod`           : paguan kur ta marrësh (parazgjedhja, punon kudo).
 *  - `bank_transfer` : transfertë bankare, për diasporën ose kë nuk dëshiron të paguajë në dorëzim.
 *                      Shfaqet VETËM kur janë vendosur të dhënat e bankës te EAS (variablat më poshtë);
 *                      pa to, klienti nuk e sheh fare opsionin.
 *  - `card`          : kartë përmes Stripe Checkout (faqja e Stripe, jo e jona). Shfaqet VETËM kur
 *                      EXPO_PUBLIC_CARD_PAYMENTS=1, pra pasi çelësat e Stripe janë vendosur te Supabase.
 */
export type PaymentMethod = "cod" | "bank_transfer" | "card";

export type BankDetails = { beneficiary: string; iban: string; bank: string };

function readBank(): BankDetails | null {
  const iban = process.env.EXPO_PUBLIC_BANK_IBAN?.trim();
  const beneficiary = process.env.EXPO_PUBLIC_BANK_BENEFICIARY?.trim();
  if (!iban || !beneficiary) return null;
  return { iban, beneficiary, bank: process.env.EXPO_PUBLIC_BANK_NAME?.trim() ?? "" };
}

/** Të dhënat e bankës nga EXPO_PUBLIC_BANK_IBAN, EXPO_PUBLIC_BANK_BENEFICIARY dhe (opsionale) EXPO_PUBLIC_BANK_NAME. */
export const BANK_DETAILS: BankDetails | null = readBank();

/** Pagesa me kartë hapet me EXPO_PUBLIC_CARD_PAYMENTS=1 (`.trim()`: vlera shpesh ruhet me hapësirë në fund). */
export const CARD_ENABLED: boolean = (process.env.EXPO_PUBLIC_CARD_PAYMENTS ?? "").trim() === "1";

/** Metodat që i shfaqet klientit; "cod" ka gjithmonë. */
export const AVAILABLE_METHODS: PaymentMethod[] = [
  "cod",
  ...(CARD_ENABLED ? (["card"] as const) : []),
  ...(BANK_DETAILS ? (["bank_transfer"] as const) : []),
];

/** Referenca që klienti e shkruan te transferta: kodi i porosisë (#XXXXXXXX). */
export function paymentReference(orderId: string): string {
  return `#${orderId.slice(0, 8).toUpperCase()}`;
}
