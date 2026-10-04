/**
 * Lista e dhuratave hapet vetëm kur EXPO_PUBLIC_GIFTS=1 te EAS (pasi të jetë ekzekutuar SQL-i
 * `20261004120000_gift_lists.sql`); pa të, asnjë buton ose rresht menuje nuk shfaqet.
 */
export const GIFTS_ENABLED = (process.env.EXPO_PUBLIC_GIFTS ?? "").trim() === "1";
