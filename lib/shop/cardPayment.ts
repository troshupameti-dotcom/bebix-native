import * as WebBrowser from "expo-web-browser";
import { supabase } from "@/lib/supabase/client";

/**
 * Pagesa me kartë përmes Stripe Checkout: funksioni `create-card-checkout` kthen adresën e faqes së Stripe
 * (karta s'kalon kurrë përmes Bebix-it) dhe `stripe-webhook` e shënon porosinë "paguar" kur Stripe konfirmon.
 */

/** Krijon sesionin e pagesës dhe kthen adresën e saj, ose null kur s'u hap (çelësat mungojnë, rrjeti, etj.). */
async function createCardCheckoutUrl(orderId: string, ref: string, lang: "sq" | "en"): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke<{ url?: string }>("create-card-checkout", {
      body: { order_id: orderId, client_ref: ref, lang },
    });
    return !error && data?.url ? data.url : null;
  } catch {
    return null;
  }
}

/**
 * Hap faqen e pagesës te shfletuesi i brendshëm dhe pret derisa klienti ta mbyllë.
 * Kthen false kur faqja s'u hap; true kur u hap (rezultati i pagesës vjen vetëm nga webhook-u, jo nga këtu).
 */
export async function startCardPayment(orderId: string, ref: string, lang: "sq" | "en"): Promise<boolean> {
  const url = await createCardCheckoutUrl(orderId, ref, lang);
  if (!url) return false;
  try {
    await WebBrowser.openBrowserAsync(url);
    return true;
  } catch {
    return false;
  }
}
