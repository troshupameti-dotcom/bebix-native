import { useState } from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { ChevronDown } from "lucide-react-native";
import { FormField } from "@/components/baby/FormField";
import { ThemedSwitch } from "@/components/ui/ThemedSwitch";
import { goBackOr } from "@/components/ui/BackButton";
import { useToast } from "@/lib/toast/ToastContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { AdminScreen, Btn, Card, Empty, ErrorNote, Loading, OptionSheet, runAction, useAdminData } from "@/components/admin/AdminUI";
import { fetchProductForEdit, saveProduct, validateProduct, type EditableProduct } from "@/lib/admin/api";
import { BADGES, optionOf, type Option } from "@/lib/admin/labels";

type Sheet = "brand" | "category" | "badge" | null;

/** Ndryshimi i një produkti. Fotot ndryshohen te paneli i webit (si edhe atje, te paneli i vjetër). */
export default function AdminProductEdit() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error } = useAdminData(() => fetchProductForEdit(String(id)), [id]);
  return (
    <AdminScreen title="Ndrysho produktin" fallback="/(main)/more/admin/products">
      <ErrorNote message={error} />
      {!data && !error ? <Loading /> : null}
      {data && !data.product ? <Empty title="Produkti nuk u gjet." /> : null}
      {data?.product ? <ProductForm initial={data.product} brands={data.brands} categories={data.categories} /> : null}
    </AdminScreen>
  );
}

function ProductForm({ initial, brands, categories }: { initial: EditableProduct; brands: { id: string; label: string }[]; categories: { id: string; label: string }[] }) {
  const theme = useThemeColors();
  const { showToast } = useToast();
  const [v, setV] = useState(initial);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof EditableProduct>(key: K, value: EditableProduct[K]) => setV((s) => ({ ...s, [key]: value }));

  const brandOptions: Option[] = [{ key: "", label: "Pa markë" }, ...brands.map((b) => ({ key: b.id, label: b.label }))];
  const categoryOptions: Option[] = [{ key: "", label: "Pa kategori" }, ...categories.map((c) => ({ key: c.id, label: c.label }))];

  async function save() {
    const problem = validateProduct(v);
    if (problem) {
      Alert.alert("Kontrollo të dhënat", problem);
      return;
    }
    setBusy(true);
    await runAction(() => saveProduct(v), () => {
      showToast("Produkti u ruajt.");
      goBackOr("/(main)/more/admin/products");
    });
    setBusy(false);
  }

  return (
    <>
      <Card className="gap-3">
        <FormField label="Emri" value={v.name} onChangeText={(t) => set("name", t)} />
        <FormField label="Përshkrimi" value={v.description} onChangeText={(t) => set("description", t)} multiline style={{ minHeight: 110, textAlignVertical: "top" }} />
        <View className="flex-row gap-3">
          <View className="flex-1"><FormField label="Çmimi (€)" value={v.price} onChangeText={(t) => set("price", t)} keyboardType="decimal-pad" /></View>
          <View className="flex-1"><FormField label="Çmimi i vjetër (€)" value={v.compare} onChangeText={(t) => set("compare", t)} keyboardType="decimal-pad" placeholder="Opsional" /></View>
        </View>
        <FormField
          label={v.partnerManaged ? "Stoku (e menaxhon partneri)" : "Stoku"}
          value={v.stock}
          onChangeText={(t) => set("stock", t)}
          keyboardType="number-pad"
          editable={!v.partnerManaged}
          style={v.partnerManaged ? { opacity: 0.55 } : undefined}
        />
        <Picker label="Marka" value={optionOf(brandOptions, v.brandId).label} onPress={() => setSheet("brand")} color={theme.inkFaint} />
        <Picker label="Kategoria" value={optionOf(categoryOptions, v.categoryId).label} onPress={() => setSheet("category")} color={theme.inkFaint} />
        <Picker label="Etiketa" value={optionOf(BADGES, v.badge).label} onPress={() => setSheet("badge")} color={theme.inkFaint} />
        <View className="flex-row gap-3">
          <View className="flex-1"><FormField label="Mosha nga (muaj)" value={v.minAge} onChangeText={(t) => set("minAge", t)} keyboardType="number-pad" /></View>
          <View className="flex-1"><FormField label="Mosha deri (muaj)" value={v.maxAge} onChangeText={(t) => set("maxAge", t)} keyboardType="number-pad" /></View>
        </View>
      </Card>

      <Card className="gap-1 py-2">
        <Toggle label="Aktiv (shfaqet në dyqan)" value={v.active} onChange={(on) => set("active", on)} />
        <Toggle label="Dërgesë falas" value={v.freeDelivery} onChange={(on) => set("freeDelivery", on)} />
      </Card>

      <Btn label="Ruaj" busy={busy} onPress={() => void save()} />

      <OptionSheet
        visible={sheet !== null}
        title={sheet === "brand" ? "Marka" : sheet === "category" ? "Kategoria" : "Etiketa"}
        options={sheet === "brand" ? brandOptions : sheet === "category" ? categoryOptions : BADGES}
        value={sheet === "brand" ? v.brandId : sheet === "category" ? v.categoryId : v.badge}
        onPick={(key) => (sheet === "brand" ? set("brandId", key) : sheet === "category" ? set("categoryId", key) : set("badge", key))}
        onClose={() => setSheet(null)}
      />
    </>
  );
}

function Picker({ label, value, onPress, color }: { label: string; value: string; onPress: () => void; color: string }) {
  return (
    <View className="gap-1.5">
      <Text className="font-bodyMedium text-[12.5px] text-ink-soft">{label}</Text>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} className="flex-row items-center justify-between rounded-2xl border border-ink/10 bg-surface px-4 py-3.5">
        <Text className="font-body text-[15px] text-ink">{value}</Text>
        <ChevronDown size={16} color={color} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (on: boolean) => void }) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <Text className="flex-1 font-bodyMedium text-sm text-ink">{label}</Text>
      <ThemedSwitch value={value} onValueChange={onChange} accessibilityLabel={label} />
    </View>
  );
}
