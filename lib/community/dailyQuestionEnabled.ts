/**
 * "Pyetja e ditës" hapet vetëm kur EXPO_PUBLIC_DAILY_QUESTION=1 te EAS (pasi të jenë ekzekutuar
 * `20261013090000_daily_questions.sql` dhe pyetjet fillestare, dhe të jetë caktuar llogaria editoriale);
 * pa të, karta s'shfaqet. Si GIFTS_ENABLED.
 */
export const DAILY_QUESTION_ENABLED = (process.env.EXPO_PUBLIC_DAILY_QUESTION ?? "").trim() === "1";
