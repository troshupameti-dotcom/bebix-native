import { useMemo } from "react";
import { useAppState } from "@/lib/state/AppStateContext";
import { useActiveChild } from "@/lib/age/useActiveChild";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { childAllergens } from "@/lib/recipes/catalog";
import type { Allergen } from "@/lib/recipes/types";
import type { TranslationKey } from "@/lib/i18n/translations";

/**
 * Fëmija për të cilin gatuhet: emri, mosha në muaj dhe alergjitë e shënuara te profili (cilësimet e bebit dhe
 * rreshti "Alergji" te Info mjekësore, që `medicalSync` i mban njësoj).
 */
export function useRecipeChild() {
  const { state } = useAppState();
  const { months } = useActiveChild();
  const allergyText = [state.profile.allergies, state.baby.medicalInfo?.find((m) => m.key === "allergies")?.value].filter(Boolean).join(", ");
  const allergens = useMemo(() => childAllergens(allergyText), [allergyText]);
  const name = state.profile.babyName?.trim() || null;
  return { months, name, allergens };
}

/**
 * Shton një reagim te alergjitë e profilit, VETËM pasi prindi e konfirmon (e thërret ekrani pas "Po, shtoje").
 * Shkruhet njësoj si te cilësimet e bebit: fusha e profilit dhe rreshti "Alergji" te Info mjekësore. Kthen false kur
 * alergjeni ishte tashmë i shënuar.
 */
export function useAddAllergy(): (allergens: Allergen[], at: Date) => boolean {
  const { state, updateProfile, baby } = useAppState();
  const { t, lang } = useTranslation();
  return (allergens, at) => {
    const profile = state.profile;
    const row = state.baby.medicalInfo?.find((m) => m.key === "allergies")?.value?.trim();
    const base = profile.allergies?.trim() || row || "";
    const known = childAllergens(base);
    const add = allergens.filter((a) => !known.includes(a));
    if (!add.length) return false;
    const date = at.toLocaleDateString(lang === "en" ? "en-GB" : "sq-AL", { day: "numeric", month: "long", year: "numeric" });
    const entry = add.map((a) => t("foods_allergy_entry", { allergen: t(`recipes_allergen_${a}` as TranslationKey), date })).join(", ");
    const next = base ? `${base}, ${entry}` : entry;
    updateProfile({ allergies: next });
    baby.syncMedicalFromProfile({ bloodType: profile.bloodType, pediatrician: profile.pediatrician ?? "", allergies: next });
    return true;
  };
}
