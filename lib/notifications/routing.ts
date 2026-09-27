/**
 * Ku të çojë një njoftim kur prindi e prek.
 *
 * Më parë asnjë ekran s'e dëgjonte prekjen e njoftimit: "Koment i ri te
 * postimi yt" hapte app-in te faqja e parë, dhe prindi duhej ta gjente vetë.
 * `data` vjen nga serveri (notification_outbox.data + `key`).
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const BY_TYPE: Record<string, string> = {
  feeding: "/(main)/baby/feeding",
  diaper: "/(main)/baby/diaper",
  sleep: "/(main)/baby/sleep",
  medicine: "/(main)/baby/medical",
  vaccine: "/(main)/baby/vaccinations",
  growth: "/(main)/baby/growth",
  milestone: "/(main)/baby",
  birthday: "/(main)/baby",
  offer: "/(main)/shop",
};

export function routeForNotification(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;

  if (typeof d.postId === "string" && UUID.test(d.postId)) return `/(main)/community/post/${d.postId}`;
  if (typeof d.orderId === "string" && UUID.test(d.orderId)) return "/(main)/shop/orders";
  if (typeof d.type === "string" && BY_TYPE[d.type]) return BY_TYPE[d.type];
  if (typeof d.key === "string" && d.key.startsWith("shop_")) return "/(main)/shop";
  return null;
}
