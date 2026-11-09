import { useMemo, useState } from "react";
import { Image, Pressable, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Ellipse, Path, Rect, SvgXml } from "react-native-svg";
import { AlertTriangle, Clock, Heart, Snowflake } from "lucide-react-native";
import { sanitizeSvg } from "@/supabase/functions/story-draft/svg";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useTones, type TONES } from "@/lib/theme/tone";
import { totalMinutes } from "@/lib/recipes/catalog";
import type { Allergen, MealType, Recipe, RecipeStage } from "@/lib/recipes/types";
import type { TranslationKey } from "@/lib/i18n/translations";

// ---- Tekstet ---------------------------------------------------------------------

export const ALLERGEN_LABEL: Record<Allergen, TranslationKey> = {
  milk: "recipes_allergen_milk",
  egg: "recipes_allergen_egg",
  wheat: "recipes_allergen_wheat",
  peanut: "recipes_allergen_peanut",
  tree_nut: "recipes_allergen_tree_nut",
  sesame: "recipes_allergen_sesame",
  soy: "recipes_allergen_soy",
  fish: "recipes_allergen_fish",
  shellfish: "recipes_allergen_shellfish",
};
export const MEAL_LABEL: Record<MealType, TranslationKey> = {
  breakfast: "recipes_meal_breakfast",
  lunch: "recipes_meal_lunch",
  dinner: "recipes_meal_dinner",
  snack: "recipes_meal_snack",
};
export const STAGE_LABEL: Record<RecipeStage, TranslationKey> = {
  pure: "recipes_stage_pure",
  mashed: "recipes_stage_mashed",
  finger: "recipes_stage_finger",
  family: "recipes_stage_family",
};
/** Ngjyra e çdo alergjeni te emblemat (e njëjta në listë dhe te receta). */
const ALLERGEN_TONE: Record<Allergen, keyof typeof TONES> = {
  milk: "blue",
  egg: "amber",
  wheat: "orange",
  peanut: "pink",
  tree_nut: "purple",
  sesame: "green",
  soy: "green",
  fish: "blue",
  shellfish: "pink",
};

const cap = (s: string) => (s ? s[0].toLocaleUpperCase("sq") + s.slice(1) : s);

/** Mosha, koha dhe alergjenët si tekst i shkurtër, të njëjtët kudo. */
export function useRecipeText() {
  const { t } = useTranslation();
  const age = (r: Pick<Recipe, "ageMinMonths">) =>
    r.ageMinMonths >= 24 && r.ageMinMonths % 12 === 0 ? t("recipes_age_years_from", { n: r.ageMinMonths / 12 }) : t("recipes_age_from", { n: r.ageMinMonths });
  const time = (r: Pick<Recipe, "prepMinutes" | "cookMinutes">) => (r.cookMinutes === 0 && r.prepMinutes <= 10 ? t("recipes_nocook_short") : t("recipes_minutes", { n: totalMinutes(r) }));
  const allergen = (a: Allergen) => t(ALLERGEN_LABEL[a]);
  const allergenList = (list: Allergen[]) => list.map(allergen).join(", ");
  return { age, time, allergen, allergenCap: (a: Allergen) => cap(allergen(a)), allergenList };
}

// ---- Kopertina -------------------------------------------------------------------

const COLORS: Record<string, { bg: string; food: string; accent: string }> = {
  orange: { bg: "#F6E3CF", food: "#E8913E", accent: "#F4B26A" },
  green: { bg: "#E2EDD7", food: "#7FA65A", accent: "#A9C98A" },
  red: { bg: "#F5DDD6", food: "#D0583F", accent: "#E99A7F" },
  yellow: { bg: "#F7EBCB", food: "#E6B740", accent: "#F2D27C" },
  brown: { bg: "#EFE2D4", food: "#A86B45", accent: "#C99472" },
  white: { bg: "#EEEAE2", food: "#F6F2EA", accent: "#D9CDB8" },
  pink: { bg: "#F6E0E4", food: "#E59AA8", accent: "#F1C1C9" },
};

/** Pjata e vizatuar: tas për purètë, pjatë me copa për të tjerat. Çelësi është "tas-ngjyra", p.sh. "bowl-orange". */
function DrawnDish({ cover }: { cover: string | null }) {
  const [shape, color] = (cover ?? "bowl-yellow").split("-");
  const c = COLORS[color] ?? COLORS.yellow;
  return (
    <Svg width="100%" height="100%" viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice">
      <Rect x={0} y={0} width={160} height={120} fill={c.bg} />
      <Circle cx={22} cy={20} r={5} fill="#FFFFFF" opacity={0.55} />
      <Circle cx={140} cy={98} r={7} fill="#FFFFFF" opacity={0.45} />
      <Ellipse cx={80} cy={100} rx={46} ry={6} fill="#000000" opacity={0.07} />
      {shape === "plate" ? (
        <>
          <Ellipse cx={80} cy={78} rx={52} ry={22} fill="#FFFFFF" />
          <Ellipse cx={80} cy={76} rx={40} ry={15} fill="#F4EFE6" />
          <Rect x={52} y={64} width={30} height={10} rx={5} fill={c.food} transform="rotate(-12 67 69)" />
          <Rect x={72} y={70} width={30} height={10} rx={5} fill={c.accent} transform="rotate(8 87 75)" />
          <Circle cx={100} cy={68} r={6} fill={c.food} />
          <Circle cx={60} cy={80} r={4.5} fill={c.accent} />
        </>
      ) : (
        <>
          <Path d="M30 62h100a50 34 0 0 1-100 0Z" fill="#FFFFFF" />
          <Ellipse cx={80} cy={62} rx={50} ry={11} fill={c.food} />
          <Ellipse cx={68} cy={59} rx={14} ry={4} fill={c.accent} opacity={0.9} />
          <Path d="M104 50l20-26" stroke="#C9B79A" strokeWidth={5} strokeLinecap="round" />
          <Ellipse cx={126} cy={20} rx={6} ry={8.5} fill="#D8C7A9" transform="rotate(37 126 20)" />
        </>
      )}
    </Svg>
  );
}

export function RecipeCover({ recipe, style, radius = 18 }: { recipe: Pick<Recipe, "cover" | "coverUrl" | "coverSvg">; style?: StyleProp<ViewStyle>; radius?: number }) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const photo = recipe.coverUrl && !photoFailed ? recipe.coverUrl : null;
  const drawn = useMemo(() => (recipe.coverSvg ? sanitizeSvg(recipe.coverSvg) : null), [recipe.coverSvg]);
  return (
    <View
      style={[{ overflow: "hidden", borderRadius: radius }, style]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: "100%", height: "100%" }} resizeMode="cover" onError={() => setPhotoFailed(true)} />
      ) : drawn ? (
        <SvgXml xml={drawn.replace("<svg ", '<svg preserveAspectRatio="xMidYMid slice" ')} width="100%" height="100%" />
      ) : (
        <DrawnDish cover={recipe.cover} />
      )}
    </View>
  );
}

// ---- Emblemat --------------------------------------------------------------------

/** Alergjenët me ngjyrë. Ai që fëmija e ka si alergji del me shenjë paralajmërimi. */
export function AllergenBadges({ allergens, conflicts = [], small = false }: { allergens: Allergen[]; conflicts?: Allergen[]; small?: boolean }) {
  const tones = useTones();
  const text = useRecipeText();
  if (!allergens.length) return null;
  return (
    <View className="flex-row flex-wrap" style={{ gap: 6 }}>
      {allergens.map((a) => {
        const tone = tones[ALLERGEN_TONE[a]];
        const warn = conflicts.includes(a);
        return (
          <View
            key={a}
            className="flex-row items-center rounded-full"
            style={{ gap: 4, backgroundColor: tone.tintBg, paddingHorizontal: small ? 8 : 10, paddingVertical: small ? 2 : 4, borderWidth: warn ? 1.5 : 0, borderColor: tone.tint }}
          >
            {warn ? <AlertTriangle size={small ? 11 : 13} color={tone.tint} strokeWidth={2.2} /> : null}
            <Text style={{ color: tone.ink, fontSize: small ? 11 : 12.5 }} className={warn ? "font-bodySemibold" : "font-bodyMedium"}>
              {text.allergenCap(a)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

/** Karta e verdhë: receta përmban një alergjen që fëmija e ka të shënuar te profili. */
export function AllergyWarning({ conflicts }: { conflicts: Allergen[] }) {
  const { t } = useTranslation();
  const tones = useTones();
  const text = useRecipeText();
  if (!conflicts.length) return null;
  return (
    <View accessibilityRole="alert" className="flex-row rounded-2xl p-3.5" style={{ gap: 10, backgroundColor: tones.amber.tintBg }}>
      <AlertTriangle size={19} color={tones.amber.tint} strokeWidth={2.2} />
      <Text className="flex-1 font-bodyMedium text-[14px] leading-5" style={{ color: tones.amber.ink }}>
        {t(conflicts.length === 1 ? "recipes_warning_one" : "recipes_warning_many", { allergens: text.allergenList(conflicts) })}
      </Text>
    </View>
  );
}

// ---- Kartat ----------------------------------------------------------------------

function Meta({ recipe, conflict }: { recipe: Recipe; conflict: boolean }) {
  const c = useThemeColors();
  const tones = useTones();
  const text = useRecipeText();
  return (
    <View className="mt-1 flex-row flex-wrap items-center" style={{ columnGap: 8, rowGap: 2 }}>
      <Text className="font-body text-[12px] text-ink-soft">{text.age(recipe)}</Text>
      <View className="flex-row items-center" style={{ gap: 3 }}>
        <Clock size={11} color={c.inkFaint} />
        <Text className="font-body text-[12px] text-ink-soft">{text.time(recipe)}</Text>
      </View>
      {recipe.freezerFriendly ? <Snowflake size={12} color={c.inkFaint} /> : null}
      {conflict ? <AlertTriangle size={13} color={tones.amber.tint} strokeWidth={2.2} /> : null}
    </View>
  );
}

/** Karta në rreshtat që rrëshqasin anash (seksionet). */
export function RecipeCard({ recipe, width, favorite, conflict, onPress }: { recipe: Recipe; width: number; favorite: boolean; conflict: boolean; onPress: (slug: string) => void }) {
  const c = useThemeColors();
  return (
    <Pressable onPress={() => onPress(recipe.slug)} accessibilityRole="button" accessibilityLabel={recipe.title} style={{ width }} className="active:opacity-80">
      <View>
        <RecipeCover recipe={recipe} style={{ width, height: Math.round(width * 0.75) }} />
        {favorite ? (
          <View className="absolute right-2 top-2 h-7 w-7 items-center justify-center rounded-full bg-surface">
            <Heart size={14} color={c.orange} fill={c.orange} />
          </View>
        ) : null}
      </View>
      <Text numberOfLines={2} className="mt-2 font-bodySemibold text-[14px] leading-[18px] text-ink">
        {recipe.title}
      </Text>
      <Meta recipe={recipe} conflict={conflict} />
    </Pressable>
  );
}

/** Rreshti i listës së plotë. */
export function RecipeRow({ recipe, favorite, conflicts, onPress }: { recipe: Recipe; favorite: boolean; conflicts: Allergen[]; onPress: (slug: string) => void }) {
  const c = useThemeColors();
  return (
    <Pressable
      onPress={() => onPress(recipe.slug)}
      accessibilityRole="button"
      accessibilityLabel={recipe.title}
      className="mb-3 flex-row rounded-2xl border border-cream-line bg-surface p-2.5 active:opacity-80"
      style={{ gap: 12 }}
    >
      <RecipeCover recipe={recipe} style={{ width: 76, height: 76 }} radius={14} />
      <View className="flex-1 justify-center">
        <View className="flex-row items-start" style={{ gap: 6 }}>
          <Text numberOfLines={2} className="flex-1 font-bodySemibold text-[15px] leading-5 text-ink">
            {recipe.title}
          </Text>
          {favorite ? <Heart size={15} color={c.orange} fill={c.orange} /> : null}
        </View>
        <Meta recipe={recipe} conflict={conflicts.length > 0} />
        {recipe.allergens.length ? (
          <View className="mt-1.5">
            <AllergenBadges allergens={recipe.allergens} conflicts={conflicts} small />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
