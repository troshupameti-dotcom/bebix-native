/**
 * "Pyet ekspertin" hapet vetëm kur EXPO_PUBLIC_ASK_EXPERT=1 te EAS (pasi të jetë ekzekutuar SQL-i
 * `20261014090000_expert_questions.sql`); pa të, asnjë buton s'shfaqet. Si GIFTS_ENABLED.
 */
export const ASK_EXPERT_ENABLED = (process.env.EXPO_PUBLIC_ASK_EXPERT ?? "").trim() === "1";
