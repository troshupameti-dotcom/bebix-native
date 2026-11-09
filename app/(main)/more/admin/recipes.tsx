import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AdminScreen, Chips, Empty, ErrorNote, Loading, Pill, useAdminData } from "@/components/admin/AdminUI";
import { RecipeCover } from "@/components/recipes/RecipeParts";
import { fetchAdminRecipes, type AdminRecipe, type RecipeTab } from "@/lib/admin/api";
import { dateOnly, TONES } from "@/lib/admin/labels";

const TABS: { key: RecipeTab; label: string }[] = [
  { key: "draft", label: "Në punë" },
  { key: "published", label: "Të publikuara" },
  { key: "archived", label: "Të arkivuara" },
];

/**
 * Recetat te paneli, si Përrallat: receta e re shtohet si draft (Table Editor, SQL ose migrim), admini e lexon, e
 * ndryshon nëse duhet dhe e publikon; prindërit s'e shohin para kësaj.
 */
export default function AdminRecipes() {
  const router = useRouter();
  const [tab, setTab] = useState<RecipeTab>("published");
  const { data, error, refreshing, pull } = useAdminData(() => fetchAdminRecipes(tab), [tab]);

  return (
    <AdminScreen title="Recetat" subtitle="Lexojini, ndryshojini dhe publikojini. Prindërit shohin vetëm të publikuarat." refreshing={refreshing} onRefresh={pull}>
      <Chips items={TABS} value={tab} onChange={setTab} />
      <ErrorNote message={error} />
      {!data && !error ? <Loading /> : null}
      {data && data.length === 0 ? (
        <Empty
          title={tab === "draft" ? "S'ka receta në punë." : tab === "published" ? "Ende s'ka receta të publikuara." : "S'ka receta të arkivuara."}
          body={tab === "draft" ? "Recetat e reja shtohen me migrim ose nga Table Editor-i, me status 'draft'." : undefined}
        />
      ) : null}
      {data?.map((r) => <RecipeItem key={r.id} recipe={r} onPress={() => router.push({ pathname: "/more/admin/recipe/[id]" as never, params: { id: r.id } })} />)}
    </AdminScreen>
  );
}

function RecipeItem({ recipe, onPress }: { recipe: AdminRecipe; onPress: () => void }) {
  const age = recipe.ageMinMonths >= 24 ? `${recipe.ageMinMonths / 12} vjeç+` : `${recipe.ageMinMonths} muaj+`;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={recipe.title} className="mb-3 flex-row gap-4 rounded-2xl border border-cream-line bg-surface p-3.5 active:opacity-80">
      <RecipeCover recipe={recipe} style={{ width: 66, height: 66 }} radius={14} />
      <View className="flex-1">
        <Text className="font-bodySemibold text-[15px] text-ink" numberOfLines={2}>
          {recipe.title}
        </Text>
        <Text className="mt-0.5 font-body text-[12.5px] leading-[17px] text-ink-soft" numberOfLines={2}>
          {recipe.summary}
        </Text>
        <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
          {recipe.featured ? <Pill label="E veçuar" tone={TONES.green} /> : null}
          {recipe.isAlbanian ? <Pill label="Shqiptare" tone={TONES.blue} /> : null}
          <Text className="font-body text-[11.5px] text-ink-faint">
            {age} · {recipe.prepMinutes + recipe.cookMinutes} min · {dateOnly(recipe.publishedAt ?? recipe.createdAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
