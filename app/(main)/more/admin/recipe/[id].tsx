import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useToast } from "@/lib/toast/ToastContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { AdminScreen, Btn, Card, ErrorNote, Loading, Pill, confirm, runAction, useAdminData } from "@/components/admin/AdminUI";
import { ThemedSwitch } from "@/components/ui/ThemedSwitch";
import { AllergenBadges, RecipeCover } from "@/components/recipes/RecipeParts";
import {
  fetchAdminRecipe,
  saveRecipeText,
  setRecipeFeatured,
  setRecipeStatus,
  splitParagraphs,
  type AdminRecipe,
  type RecipeTab,
} from "@/lib/admin/api";
import { ingredientLine } from "@/lib/recipes/catalog";
import { dateTime, TONES } from "@/lib/admin/labels";

const STATUS_LABEL: Record<RecipeTab, string> = { draft: "Në punë", published: "E publikuar", archived: "E arkivuar" };

type Draft = { title: string; summary: string; steps: string; chokingNote: string; familyTip: string };

/**
 * Një recetë te paneli: gjithë receta si e sheh prindi, dhe veprimet. Admini ndryshon titullin, përshkrimin, hapat,
 * kujdesin ndaj mbytjes dhe këshillën për familjen, dhe e publikon me një prekje. Përbërësit ndryshohen te
 * Table Editor-i (njësitë kontrollohen nga baza).
 */
export default function AdminRecipeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useThemeColors();
  const { showToast } = useToast();
  const { data: recipe, error, refreshing, reload, pull } = useAdminData(() => fetchAdminRecipe(String(id ?? "")), [id]);
  const [editing, setEditing] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(key: string, action: () => Promise<void>, message: string, leave = false) {
    setBusy(key);
    await runAction(action, () => {
      showToast(message);
      if (leave) router.back();
      else reload();
    });
    setBusy(null);
  }

  const startEdit = (r: AdminRecipe) =>
    setEditing({ title: r.title, summary: r.summary, steps: r.steps.join("\n\n"), chokingNote: r.chokingNote, familyTip: r.familyTip });

  return (
    <AdminScreen
      title="Receta"
      subtitle={recipe ? `${STATUS_LABEL[recipe.status]} · ${dateTime(recipe.createdAt)}` : undefined}
      fallback="/(main)/more/admin/recipes"
      refreshing={refreshing}
      onRefresh={pull}
    >
      <ErrorNote message={error} />
      {recipe === null && !error ? <Loading /> : null}
      {recipe ? (
        <>
          <RecipeCover recipe={recipe} style={{ width: "100%", height: 170 }} radius={20} />
          <View className="my-3 flex-row flex-wrap gap-1.5">
            <Pill label={recipe.ageMinMonths >= 24 ? `${recipe.ageMinMonths / 12} vjeç+` : `${recipe.ageMinMonths} muaj+`} tone={TONES.blue} />
            <Pill label={`${recipe.prepMinutes + recipe.cookMinutes} min`} />
            {recipe.freezerFriendly ? <Pill label="Ngrihet" /> : null}
            {recipe.isAlbanian ? <Pill label="Shqiptare" tone={TONES.green} /> : null}
          </View>
          <AllergenBadges allergens={recipe.allergens} />

          {editing ? (
            <Card className="mt-3">
              <Field label="Titulli" value={editing.title} onChange={(title) => setEditing({ ...editing, title })} max={120} />
              <Field label="Përshkrimi" value={editing.summary} onChange={(summary) => setEditing({ ...editing, summary })} max={400} multiline />
              <Field label="Hapat (ndahen me një rresht bosh)" value={editing.steps} onChange={(steps) => setEditing({ ...editing, steps })} multiline tall />
              <Field label="Kujdes nga mbytja" value={editing.chokingNote} onChange={(chokingNote) => setEditing({ ...editing, chokingNote })} max={600} multiline />
              <Field label="Për gjithë familjen" value={editing.familyTip} onChange={(familyTip) => setEditing({ ...editing, familyTip })} max={600} multiline />
              <View className="mt-1 flex-row gap-2">
                <View className="flex-1">
                  <Btn label="Anulo" kind="light" onPress={() => setEditing(null)} disabled={busy === "save"} />
                </View>
                <View className="flex-1">
                  <Btn
                    label="Ruaj"
                    busy={busy === "save"}
                    onPress={() =>
                      void act(
                        "save",
                        async () => {
                          await saveRecipeText(recipe.id, { ...editing, steps: splitParagraphs(editing.steps) });
                          setEditing(null);
                        },
                        "Ndryshimet u ruajtën."
                      )
                    }
                  />
                </View>
              </View>
            </Card>
          ) : (
            <Card className="mt-3">
              <Text className="font-display text-[22px] leading-7 text-ink">{recipe.title}</Text>
              <Text className="mt-1.5 font-body text-[14px] leading-5 text-ink-soft">{recipe.summary}</Text>
              <View className="my-3 h-px bg-cream-line" />
              <Text className="font-bodySemibold text-[14px] text-ink">Përbërësit · {recipe.yieldNote}</Text>
              {recipe.ingredients.map((i, n) => (
                <Text key={n} className="mt-1 font-body text-[14.5px] text-ink">
                  • {ingredientLine(i)}
                  {i.optional ? " (sipas dëshirës)" : ""}
                </Text>
              ))}
              <Text className="mt-4 font-bodySemibold text-[14px] text-ink">Hapat</Text>
              {recipe.steps.map((s, n) => (
                <Text key={n} className="mt-1.5 font-body text-[15px] leading-[22px]" style={{ color: theme.ink }}>
                  {n + 1}. {s}
                </Text>
              ))}
              <Text className="mt-4 font-bodySemibold text-[14px] text-ink">Kujdes nga mbytja</Text>
              <Text className="mt-1 font-body text-[14px] leading-5 text-ink">{recipe.chokingNote}</Text>
              <Text className="mt-3 font-bodySemibold text-[14px] text-ink">Për gjithë familjen</Text>
              <Text className="mt-1 font-body text-[14px] leading-5 text-ink">{recipe.familyTip}</Text>
              <View className="mt-4">
                <Btn label="Ndrysho tekstin" kind="light" small onPress={() => startEdit(recipe)} />
              </View>
            </Card>
          )}

          {editing ? null : (
            <View className="mt-2 gap-2">
              {recipe.status !== "published" ? (
                <Btn
                  label={recipe.status === "draft" ? "Publiko" : "Publiko përsëri"}
                  busy={busy === "publish"}
                  onPress={() =>
                    confirm("Ta publikoj?", "Receta del menjëherë te të gjithë prindërit, te Recetat.", "Publiko", () =>
                      void act("publish", () => setRecipeStatus(recipe.id, "published"), "Receta u publikua.", true), false)
                  }
                />
              ) : (
                <Card className="flex-row items-center">
                  <View className="flex-1 pr-3">
                    <Text className="font-bodySemibold text-[14px] text-ink">E veçuar</Text>
                    <Text className="font-body text-xs text-ink-soft">Del e para te lista e recetave.</Text>
                  </View>
                  <ThemedSwitch
                    value={recipe.featured}
                    onValueChange={(v) => void act("featured", () => setRecipeFeatured(recipe.id, v), v ? "U vendos te të veçuarat." : "U hoq nga të veçuarat.")}
                  />
                </Card>
              )}
              {recipe.status === "archived" ? (
                <Btn label="Ktheje në punë" kind="light" busy={busy === "draft"} onPress={() => void act("draft", () => setRecipeStatus(recipe.id, "draft"), "Receta u kthye në punë.")} />
              ) : (
                <Btn
                  label={recipe.status === "published" ? "Hiqe nga recetat" : "Arkivo (mos e publiko)"}
                  kind="light"
                  busy={busy === "archive"}
                  onPress={() =>
                    confirm(
                      recipe.status === "published" ? "Ta heq nga recetat?" : "Ta arkivoj?",
                      "Receta s'fshihet: mbetet te “Të arkivuara” dhe mund të publikohet sërish.",
                      "Arkivo",
                      () => void act("archive", () => setRecipeStatus(recipe.id, "archived"), "Receta u arkivua.", true)
                    )
                  }
                />
              )}
            </View>
          )}
        </>
      ) : null}
    </AdminScreen>
  );
}

function Field({ label, value, onChange, max, multiline = false, tall = false }: { label: string; value: string; onChange: (v: string) => void; max?: number; multiline?: boolean; tall?: boolean }) {
  const theme = useThemeColors();
  return (
    <View className="mb-3">
      <Text className="mb-1.5 font-bodyMedium text-[13px] text-ink-soft">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        maxLength={max}
        multiline={multiline}
        placeholderTextColor={theme.inkFaint}
        className={`rounded-2xl border border-cream-line bg-surface px-4 py-3 font-body text-[15px] text-ink ${tall ? "min-h-[260px]" : multiline ? "min-h-[72px]" : ""}`}
        style={multiline ? { textAlignVertical: "top" } : undefined}
      />
    </View>
  );
}
