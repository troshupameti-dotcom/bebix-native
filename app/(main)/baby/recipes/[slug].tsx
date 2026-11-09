import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Share, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { ChefHat, Clock, Heart, Info, Share2, ShieldAlert, Snowflake, Users, Utensils } from "lucide-react-native";
import { BackButton } from "@/components/ui/BackButton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { AllergenBadges, AllergyWarning, RecipeCover, STAGE_LABEL, useRecipeText } from "@/components/recipes/RecipeParts";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTones } from "@/lib/theme/tone";
import { haptics } from "@/lib/haptics";
import { useToast } from "@/lib/toast/ToastContext";
import { useAppState } from "@/lib/state/AppStateContext";
import { useHouseholdRole } from "@/lib/hooks/useHouseholdRole";
import { trackRecordLogged } from "@/lib/analytics/babyEvents";
import { useRecipes } from "@/lib/recipes/useRecipes";
import { findRecipe } from "@/lib/recipes/api";
import { toggleRecipeFavorite, useRecipeFavorites } from "@/lib/recipes/favorites";
import { useRecipeChild } from "@/lib/recipes/useRecipeChild";
import { allergyConflicts, ingredientLine, shareText } from "@/lib/recipes/catalog";
import { LIKING_OPTIONS, ReactionCard, SymptomChips } from "@/components/recipes/FoodParts";
import { useFoods } from "@/lib/recipes/foods";
import { addFoodTry, updateFoodTry } from "@/lib/recipes/foodTries";
import { recipeFoodKeys } from "@/lib/recipes/firstFoods";
import type { FoodLiking, ReactionSymptom, ServeByAge } from "@/lib/recipes/types";
import type { TranslationKey } from "@/lib/i18n/translations";

const WIDE = 720;
const SERVE: { key: keyof ServeByAge; label: TranslationKey; from: number; to: number }[] = [
  { key: "6-8", label: "recipes_serve_6_8", from: 0, to: 9 },
  { key: "9-11", label: "recipes_serve_9_11", from: 9, to: 12 },
  { key: "12+", label: "recipes_serve_12", from: 12, to: 999 },
];

/**
 * Faqja e recetës: emblemat (mosha, koha, alergjenët, ngrirja), paralajmërimi kur fëmija ka alergji ndaj një
 * përbërësi, përbërësit për bebin ose për gjithë familjen, hapat me shkronja të mëdha, si ta servirësh sipas
 * moshës, kutia kundër mbytjes, ruajtja dhe këshilla për familjen. "Shëno si ushqim" e shënon si ushqim të ngurtë,
 * me të njëjtën rrugë si karta e ushqyerjes, dhe çdo ushqim i recetës shënohet si i provuar (Ushqimet e para). Kur
 * receta ka alergjen, pas "Si i pëlqeu?" pyet butë "Pati reagim?".
 */
export default function RecipeDetail() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { t } = useTranslation();
  const c = useThemeColors();
  const tones = useTones();
  const text = useRecipeText();
  const { width } = useWindowDimensions();
  const { baby } = useAppState();
  const { showToast } = useToast();
  const role = useHouseholdRole();
  const index = useRecipes();
  const favs = useRecipeFavorites();
  const child = useRecipeChild();
  const [family, setFamily] = useState(false);
  const [logged, setLogged] = useState<string | null>(null);
  const [refusedNote, setRefusedNote] = useState(false);
  const foods = useFoods();
  const [loggedTries, setLoggedTries] = useState<{ id: string; foodKey: string }[]>([]);
  const [reactionStep, setReactionStep] = useState<"ask" | "pick" | "card" | null>(null);
  const [symptoms, setSymptoms] = useState<ReactionSymptom[]>([]);
  const wide = width >= WIDE;

  const recipe = useMemo(() => index.recipes.find((r) => r.slug === slug) ?? (slug ? findRecipe(String(slug)) : null), [index.recipes, slug]);

  if (!recipe) {
    return (
      <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom"]}>
        <View className="px-4 pt-2">
          <BackButton fallback="/(main)/baby/recipes" />
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center font-bodySemibold text-[15px] text-ink">{t("recipes_not_found")}</Text>
          <Pressable onPress={() => router.replace("/(main)/baby/recipes")} accessibilityRole="button" className="mt-4 justify-center rounded-full bg-ink px-5" style={{ minHeight: 44 }}>
            <Text className="font-bodyMedium text-[13px] text-cream">{t("recipes_back")}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const conflicts = allergyConflicts(recipe, child.allergens);
  const favorite = favs.isFavorite(recipe.slug);
  const factor = family ? recipe.familyFactor : 1;
  const months = child.months;
  const canLog = role !== "viewer";

  function logAsFood() {
    if (!recipe) return;
    haptics.success();
    const id = baby.addFeedingEntry({ type: "solid", foodCategory: recipe.title });
    trackRecordLogged({ kind: "feeding", source: "app" });
    // Ushqimet e recetës dalin si të provuara te "Ushqimet e para"; pëlqimi shtohet me përgjigjen.
    setLoggedTries(recipeFoodKeys(recipe, foods).map((foodKey) => ({ id: addFoodTry({ foodKey, recipeSlug: recipe.slug }), foodKey })));
    setRefusedNote(false);
    setReactionStep(null);
    setSymptoms([]);
    setLogged(id);
  }

  function answer(liking: FoodLiking) {
    if (!logged) return;
    haptics.select();
    const option = LIKING_OPTIONS.find((l) => l.key === liking)!;
    baby.updateFeedingEntry(logged, { note: `${option.emoji} ${t(option.label)}` });
    loggedTries.forEach(({ id }) => updateFoodTry(id, { liking }));
    if (liking === "refused") {
      setRefusedNote(true);
      return;
    }
    if (recipe!.allergens.length) {
      setReactionStep("ask");
      return;
    }
    setLogged(null);
    showToast(t("recipes_logged", { title: recipe!.title }));
  }

  /** "Pati reagim": shënohet te provat e ushqimeve me alergjen të kësaj recete. */
  function saveReaction() {
    const allergenOf = new Map(foods.map((f) => [f.foodKey, f.allergen]));
    loggedTries.forEach(({ id, foodKey }) => {
      if (allergenOf.get(foodKey)) updateFoodTry(id, { reaction: true, symptoms });
    });
    haptics.select();
    setReactionStep("card");
  }

  const closeSheet = () => {
    if (logged && !refusedNote && reactionStep !== "card") showToast(t("recipes_logged", { title: recipe.title }));
    setLogged(null);
    setRefusedNote(false);
    setReactionStep(null);
  };

  const share = () => {
    haptics.tap();
    void Share.share({ message: shareText(recipe, t("recipes_share_intro")) }).catch(() => {});
  };

  const box = (icon: React.ReactNode, title: string, body: React.ReactNode, bg?: string) => (
    <View className="mt-5 rounded-2xl p-4" style={{ backgroundColor: bg ?? c.surface, borderWidth: bg ? 0 : 1, borderColor: c.creamLine }}>
      <View className="mb-2 flex-row items-center" style={{ gap: 8 }}>
        {icon}
        <Text className="font-bodySemibold text-[15px] text-ink" accessibilityRole="header">
          {title}
        </Text>
      </View>
      {body}
    </View>
  );

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top", "bottom", "left", "right"]}>
      <View className="flex-row items-center justify-between px-4 pb-2 pt-2">
        <BackButton fallback="/(main)/baby/recipes" />
        <Pressable
          onPress={() => {
            haptics.tap();
            toggleRecipeFavorite(recipe.slug, favs.userId);
          }}
          accessibilityRole="button"
          accessibilityLabel={favorite ? t("recipes_saved") : t("recipes_save")}
          accessibilityState={{ selected: favorite }}
          className="h-11 w-11 items-center justify-center rounded-full border border-ink/10 bg-surface"
        >
          <Heart size={19} color={favorite ? c.orange : c.inkSoft} fill={favorite ? c.orange : "transparent"} />
        </Pressable>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 28, alignItems: "center" }}>
        <View style={{ width: "100%", maxWidth: 760 }}>
          <RecipeCover recipe={recipe} style={{ width: "100%", height: wide ? 300 : Math.round((width - 40) * 0.62) }} radius={24} />
          <Text accessibilityRole="header" className="mt-5 font-display text-[28px] leading-[35px] text-ink">
            {recipe.title}
          </Text>
          <Text className="mt-2 font-body text-[15.5px] leading-6 text-ink-soft">{recipe.summary}</Text>

          <View className="mt-3 flex-row flex-wrap" style={{ gap: 6 }}>
            <Badge label={text.age(recipe)} />
            <Badge label={text.time(recipe)} icon={<Clock size={13} color={c.inkSoft} />} />
            <Badge label={t(STAGE_LABEL[recipe.stage])} />
            {recipe.freezerFriendly ? <Badge label={t("recipes_freezes")} icon={<Snowflake size={13} color={c.inkSoft} />} /> : null}
          </View>

          <View className="mt-4">
            <Text className="mb-2 font-bodySemibold text-[13px] uppercase tracking-[1px] text-ink-faint">{t("recipes_allergens_title")}</Text>
            {recipe.allergens.length ? (
              <>
                <AllergenBadges allergens={recipe.allergens} conflicts={conflicts} />
                <Text className="mt-2 font-body text-[12.5px] leading-[18px] text-ink-soft">{t("recipes_allergen_note")}</Text>
              </>
            ) : (
              <Text className="font-body text-[13.5px] text-ink-soft">{t("recipes_no_allergens")}</Text>
            )}
          </View>

          {conflicts.length ? (
            <View className="mt-4">
              <AllergyWarning conflicts={conflicts} />
            </View>
          ) : null}

          {/* Përbërësit: për bebin ose për gjithë familjen. */}
          <View className="mt-6 flex-row items-center justify-between">
            <Text className="font-bodySemibold text-[18px] text-ink" accessibilityRole="header">
              {t("recipes_ingredients")}
            </Text>
            <Text className="font-body text-[12.5px] text-ink-faint">{family ? t("recipes_yield_family", { n: recipe.familyFactor }) : recipe.yieldNote}</Text>
          </View>
          {recipe.familyFactor > 1 ? (
            <View className="mt-3 flex-row rounded-full bg-cream-soft p-1" accessibilityRole="tablist">
              {[false, true].map((fam) => (
                <Pressable
                  key={String(fam)}
                  onPress={() => {
                    haptics.select();
                    setFamily(fam);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: family === fam }}
                  className={`flex-1 flex-row items-center justify-center rounded-full py-2 ${family === fam ? "bg-ink" : ""}`}
                  style={{ gap: 6, minHeight: 40 }}
                >
                  {fam ? <Users size={14} color={family === fam ? c.cream : c.inkSoft} /> : null}
                  <Text className={`font-bodyMedium text-[13px] ${family === fam ? "text-cream" : "text-ink-soft"}`}>{t(fam ? "recipes_portion_family" : "recipes_portion_baby")}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View className="mt-3">
            {recipe.ingredients.map((i, n) => (
              <View key={`${i.name}-${n}`} className="flex-row items-start border-b border-cream-line py-2.5" style={{ gap: 10 }}>
                <View className="mt-2 h-1.5 w-1.5 rounded-full bg-olive" />
                <Text className="flex-1 font-body text-[16px] leading-6 text-ink">
                  {ingredientLine(i, factor)}
                  {i.optional ? <Text className="text-ink-faint">{` (${t("recipes_optional")})`}</Text> : null}
                </Text>
              </View>
            ))}
          </View>

          {/* Hapat. */}
          <View className="mt-7 flex-row items-center justify-between">
            <Text className="font-bodySemibold text-[18px] text-ink" accessibilityRole="header">
              {t("recipes_steps")}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              haptics.tap();
              router.push({ pathname: "/(main)/baby/recipes/cook/[slug]", params: { slug: recipe.slug } });
            }}
            accessibilityRole="button"
            accessibilityHint={t("recipes_cook_mode_hint")}
            className="mt-3 flex-row items-center rounded-2xl border border-cream-line bg-surface px-4 py-3 active:opacity-80"
            style={{ gap: 10 }}
          >
            <ChefHat size={18} color={c.olive} />
            <View className="flex-1">
              <Text className="font-bodySemibold text-[14.5px] text-ink">{t("recipes_cook_mode")}</Text>
              <Text className="font-body text-[12.5px] text-ink-soft">{t("recipes_cook_mode_hint")}</Text>
            </View>
          </Pressable>
          {recipe.steps.map((s, n) => (
            <View key={n} className="mt-4 flex-row" style={{ gap: 12 }}>
              <View className="h-8 w-8 items-center justify-center rounded-full bg-ink">
                <Text className="font-bodySemibold text-[14px] text-cream">{n + 1}</Text>
              </View>
              <Text className="flex-1 font-body text-[17.5px] leading-[27px] text-ink">{s}</Text>
            </View>
          ))}

          {/* Si ta servirësh sipas moshës: grupi i fëmijës del i theksuar. */}
          {box(
            <Utensils size={17} color={c.olive} />,
            t("recipes_serve"),
            <View style={{ gap: 10 }}>
              {SERVE.filter((g) => recipe.serveByAge[g.key]).map((g) => {
                const mine = months != null && months >= g.from && months < g.to;
                return (
                  <View key={g.key} className={`rounded-xl px-3 py-2.5 ${mine ? "bg-cream-soft" : ""}`}>
                    <Text className={`font-bodySemibold text-[13px] ${mine ? "text-olive" : "text-ink-soft"}`}>{t(g.label)}</Text>
                    <Text className="mt-0.5 font-body text-[15px] leading-[22px] text-ink">{recipe.serveByAge[g.key]}</Text>
                  </View>
                );
              })}
            </View>
          )}

          {box(
            <ShieldAlert size={17} color={tones.orange.tint} />,
            t("recipes_choking_title"),
            <Text className="font-body text-[15px] leading-[22px]" style={{ color: tones.orange.ink }}>
              {recipe.chokingNote}
            </Text>,
            tones.orange.tintBg
          )}

          {box(
            <Snowflake size={17} color={c.olive} />,
            t("recipes_storage_title"),
            <View style={{ gap: 8 }}>
              {[
                [t("recipes_storage_fridge"), recipe.storageNote],
                [t("recipes_storage_freezer"), recipe.freezerNote],
                [t("recipes_storage_reheat"), recipe.reheatNote],
              ].map(([label, body]) => (
                <Text key={label} className="font-body text-[15px] leading-[22px] text-ink">
                  <Text className="font-bodySemibold">{label}: </Text>
                  {body}
                </Text>
              ))}
            </View>
          )}

          {box(<Users size={17} color={c.olive} />, t("recipes_family_title"), <Text className="font-body text-[15px] leading-[22px] text-ink">{recipe.familyTip}</Text>)}

          <View className="mt-6 flex-row" style={{ gap: 8 }}>
            <Info size={14} color={c.inkFaint} style={{ marginTop: 2 }} />
            <Text className="flex-1 font-body text-[12.5px] leading-[18px] text-ink-faint">{t("recipes_guidance_note")}</Text>
          </View>
        </View>
      </ScrollView>

      <View className="flex-row border-t border-ink/10 px-4 pb-2 pt-3" style={{ gap: 8 }}>
        <ActionButton
          label={favorite ? t("recipes_saved") : t("recipes_save")}
          icon={<Heart size={17} color={favorite ? c.orange : c.ink} fill={favorite ? c.orange : "transparent"} />}
          onPress={() => {
            haptics.tap();
            toggleRecipeFavorite(recipe.slug, favs.userId);
          }}
        />
        {canLog ? <ActionButton primary label={t("recipes_log")} icon={<Utensils size={17} color={c.cream} />} onPress={logAsFood} /> : null}
        <ActionButton label={t("recipes_share")} icon={<Share2 size={17} color={c.ink} />} onPress={share} />
      </View>

      <BottomSheet visible={!!logged} onClose={closeSheet}>
        <View className="px-5 pb-6 pt-2">
          {reactionStep === "ask" ? (
            <>
              <Text className="font-bodySemibold text-[18px] text-ink">{t("foods_reaction_question")}</Text>
              <Text className="mt-1.5 font-body text-[14px] leading-5 text-ink-soft">{t("foods_reaction_later", { allergens: text.allergenList(recipe.allergens) })}</Text>
              <View className="mt-4" style={{ gap: 8 }}>
                <Pressable onPress={closeSheet} accessibilityRole="button" className="items-center justify-center rounded-full bg-ink" style={{ minHeight: 48 }}>
                  <Text className="font-bodySemibold text-[15px] text-cream">{t("foods_reaction_none")}</Text>
                </Pressable>
                <Pressable onPress={() => setReactionStep("pick")} accessibilityRole="button" className="items-center justify-center rounded-full border border-ink/15" style={{ minHeight: 48 }}>
                  <Text className="font-bodySemibold text-[15px] text-ink">{t("foods_reaction_yes")}</Text>
                </Pressable>
              </View>
            </>
          ) : reactionStep === "pick" ? (
            <>
              <Text className="font-bodySemibold text-[18px] text-ink">{t("foods_reaction_which")}</Text>
              <View className="mt-3">
                <SymptomChips value={symptoms} onChange={setSymptoms} />
              </View>
              <Pressable onPress={saveReaction} accessibilityRole="button" className="mt-5 items-center justify-center rounded-full bg-ink" style={{ minHeight: 48 }}>
                <Text className="font-bodySemibold text-[15px] text-cream">{t("foods_reaction_save")}</Text>
              </Pressable>
            </>
          ) : reactionStep === "card" ? (
            <>
              <ReactionCard allergens={recipe.allergens} canWrite={canLog} />
              <Pressable onPress={closeSheet} accessibilityRole="button" className="mt-4 items-center justify-center rounded-full bg-ink" style={{ minHeight: 48 }}>
                <Text className="font-bodySemibold text-[15px] text-cream">{t("recipes_ok")}</Text>
              </Pressable>
            </>
          ) : refusedNote ? (
            <>
              <Text className="font-bodySemibold text-[18px] text-ink">{t("recipes_refused_title")}</Text>
              <Text className="mt-2 font-body text-[15px] leading-[22px] text-ink-soft">{t("recipes_refused_body")}</Text>
              <Pressable onPress={closeSheet} accessibilityRole="button" className="mt-5 items-center justify-center rounded-full bg-ink" style={{ minHeight: 48 }}>
                <Text className="font-bodySemibold text-[15px] text-cream">{t("recipes_ok")}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text className="font-bodySemibold text-[18px] text-ink">{t("recipes_how_liked")}</Text>
              <Text className="mt-1 font-body text-[13px] text-ink-soft">{t("recipes_logged_sub", { title: recipe.title })}</Text>
              <View className="mt-4" style={{ gap: 8 }}>
                {LIKING_OPTIONS.map((l) => (
                  <Pressable
                    key={l.key}
                    onPress={() => answer(l.key)}
                    accessibilityRole="button"
                    className="flex-row items-center rounded-2xl border border-cream-line bg-surface px-4 active:opacity-80"
                    style={{ gap: 12, minHeight: 56 }}
                  >
                    <Text style={{ fontSize: 24 }}>{l.emoji}</Text>
                    <Text className="font-bodyMedium text-[15.5px] text-ink">{t(l.label)}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable onPress={closeSheet} accessibilityRole="button" className="mt-3 items-center justify-center" style={{ minHeight: 44 }}>
                <Text className="font-bodyMedium text-[14px] text-ink-soft">{t("recipes_skip")}</Text>
              </Pressable>
            </>
          )}
        </View>
      </BottomSheet>
    </SafeAreaView>
  );
}

function Badge({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <View className="flex-row items-center rounded-full bg-cream-soft px-3 py-1.5" style={{ gap: 5 }}>
      {icon}
      <Text className="font-bodyMedium text-[12.5px] text-ink-soft">{label}</Text>
    </View>
  );
}

function ActionButton({ label, icon, onPress, primary = false }: { label: string; icon: React.ReactNode; onPress: () => void; primary?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={`flex-row items-center justify-center rounded-full ${primary ? "bg-ink" : "border border-ink/10 bg-surface"} active:opacity-80`}
      style={{ gap: 6, minHeight: 50, flex: primary ? 1.4 : 1 }}
    >
      {icon}
      <Text numberOfLines={1} className={`font-bodySemibold text-[14px] ${primary ? "text-cream" : "text-ink"}`}>
        {label}
      </Text>
    </Pressable>
  );
}
