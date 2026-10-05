/**
 * Repartet e mjekëve dhe të ekspertëve (pediatër, gjinekolog/e, ortoped, psikolog/e, ...): pjesa pa rrjet.
 *
 * Burimi është tabela `community_specialties` (admini mund të shtojë reparte; shih `specialties.ts`). Lista më poshtë
 * është rezerva kur tabela s'ekziston ende (para migrimit) ose rrjeti dështon; çelësat duhet të jenë të njëjtët me ato
 * të migrimit `20261005180000_community_specialties.sql` (një test e ruan këtë).
 */
export type Specialty = { key: string; label: string; labelEn: string; emoji: string };

export const FALLBACK_SPECIALTIES: Specialty[] = [
  { key: "pediatrician", label: "Pediatër", labelEn: "Pediatrician", emoji: "🩺" },
  { key: "neonatologist", label: "Neonatolog/e", labelEn: "Neonatologist", emoji: "👶" },
  { key: "gynecologist", label: "Gjinekolog/e", labelEn: "Gynecologist", emoji: "🤰" },
  { key: "midwife", label: "Mami", labelEn: "Midwife", emoji: "🏥" },
  { key: "orthopedist", label: "Ortoped", labelEn: "Orthopedist", emoji: "🦴" },
  { key: "psychologist", label: "Psikolog/e", labelEn: "Psychologist", emoji: "🧠" },
  { key: "psychiatrist", label: "Psikiatër/e", labelEn: "Psychiatrist", emoji: "🧩" },
  { key: "neurologist", label: "Neurolog/e", labelEn: "Neurologist", emoji: "⚡" },
  { key: "dermatologist", label: "Dermatolog/e", labelEn: "Dermatologist", emoji: "🧴" },
  { key: "ent", label: "Otorinolaringolog/e (ORL)", labelEn: "ENT specialist", emoji: "👂" },
  { key: "ophthalmologist", label: "Okulist/e", labelEn: "Ophthalmologist", emoji: "👁️" },
  { key: "allergist", label: "Alergolog/e", labelEn: "Allergist", emoji: "🤧" },
  { key: "gastroenterologist", label: "Gastroenterolog/e", labelEn: "Gastroenterologist", emoji: "🍽️" },
  { key: "cardiologist", label: "Kardiolog/e", labelEn: "Cardiologist", emoji: "❤️" },
  { key: "endocrinologist", label: "Endokrinolog/e", labelEn: "Endocrinologist", emoji: "⚕️" },
  { key: "pediatric_dentist", label: "Stomatolog/e pediatrik/e", labelEn: "Pediatric dentist", emoji: "🦷" },
  { key: "nutritionist", label: "Nutricionist/e", labelEn: "Nutritionist", emoji: "🥦" },
  { key: "lactation", label: "Konsulent/e gjidhënieje", labelEn: "Lactation consultant", emoji: "🤱" },
  { key: "sleep_coach", label: "Trajner/e gjumi", labelEn: "Sleep coach", emoji: "😴" },
  { key: "physiotherapist", label: "Fizioterapeut/e", labelEn: "Physiotherapist", emoji: "🤸" },
  { key: "speech_therapist", label: "Logoped/e", labelEn: "Speech therapist", emoji: "🗣️" },
  { key: "other", label: "Specialitet tjetër", labelEn: "Other specialty", emoji: "⚕️" },
];

/** Emri i repartit në gjuhën e përdoruesit; null kur ekspertit s'i është caktuar reparte. */
export function specialtyLabel(key: string | null | undefined, language: string, list: Specialty[] = FALLBACK_SPECIALTIES): string | null {
  if (!key) return null;
  const s = list.find((x) => x.key === key) ?? FALLBACK_SPECIALTIES.find((x) => x.key === key);
  if (!s) return null;
  return language === "en" ? s.labelEn : s.label;
}

export function specialtyEmoji(key: string | null | undefined, list: Specialty[] = FALLBACK_SPECIALTIES): string {
  if (!key) return "🩺";
  return (list.find((x) => x.key === key) ?? FALLBACK_SPECIALTIES.find((x) => x.key === key))?.emoji ?? "🩺";
}
