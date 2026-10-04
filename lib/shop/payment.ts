/**
 * Metodat e pagesës.
 *
 *  - `cod`           : paguan kur ta marrësh (parazgjedhja, punon kudo).
 *  - `bank_transfer` : transfertë bankare, për diasporën ose kë nuk dëshiron të paguajë në dorëzim.
 *                      Shfaqet VETËM kur janë vendosur të dhënat e bankës te EAS (variablat më poshtë);
 *                      pa to, klienti nuk e sheh fare opsionin.
 *  - `card`          : kartë; do të hapet kur të lidhet një ofrues pagese.
 */
export type PaymentMethod = "cod" | "bank_transfer";

export type BankDetails = { beneficiary: string; iban: string; bank: string };

function readBank(): BankDetails | null {
  const iban = process.env.EXPO_PUBLIC_BANK_IBAN?.trim();
  const beneficiary = process.env.EXPO_PUBLIC_BANK_BENEFICIARY?.trim();
  if (!iban || !beneficiary) return null;
  return { iban, beneficiary, bank: process.env.EXPO_PUBLIC_BANK_NAME?.trim() ?? "" };
}

/** Të dhënat e bankës nga EXPO_PUBLIC_BANK_IBAN, EXPO_PUBLIC_BANK_BENEFICIARY dhe (opsionale) EXPO_PUBLIC_BANK_NAME. */
export const BANK_DETAILS: BankDetails | null = readBank();

/** Referenca që klienti e shkruan te transferta: kodi i porosisë (#XXXXXXXX). */
export function paymentReference(orderId: string): string {
  return `#${orderId.slice(0, 8).toUpperCase()}`;
}
