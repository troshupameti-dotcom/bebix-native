import { useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { ChevronRight } from "lucide-react-native";
import { ThemedSwitch } from "@/components/ui/ThemedSwitch";
import { useToast } from "@/lib/toast/ToastContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { AdminScreen, Btn, Chips, Empty, ErrorNote, Loading, Pill, SearchField, runAction, useAdminData, useDebounced } from "@/components/admin/AdminUI";
import { PRODUCTS_PAGE, fetchProducts, setProductActive, type AdminProduct, type ProductFilter } from "@/lib/admin/api";
import { TONES, eur } from "@/lib/admin/labels";

const FILTERS: { key: ProductFilter; label: string }[] = [
  { key: "", label: "Të gjitha" },
  { key: "active", label: "Aktive" },
  { key: "hidden", label: "Të fshehura" },
  { key: "partner", label: "Nga partnerët" },
  { key: "low", label: "Stok i ulët" },
];

/** Produktet: shfaq ose fshih në dyqan me një prekje; prekja e rreshtit hap ndryshimin e të dhënave. */
export default function AdminProducts() {
  const router = useRouter();
  const theme = useThemeColors();
  const { showToast } = useToast();
  const [filter, setFilter] = useState<ProductFilter>("");
  const [query, setQuery] = useState("");
  const q = useDebounced(query);
  const [limit, setLimit] = useState(PRODUCTS_PAGE);
  // Ndryshimi duket menjëherë; nëse baza e refuzon, kthehet mbrapsht.
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const { data, error, refreshing, reload, pull } = useAdminData(() => fetchProducts({ filter, q, limit }), [filter, q, limit]);

  async function toggle(p: AdminProduct, next: boolean) {
    setOverride((o) => ({ ...o, [p.id]: next }));
    const ok = await runAction(() => setProductActive(p.id, next), () => {
      showToast(next ? "Produkti shfaqet në dyqan." : "Produkti u fsheh nga dyqani.");
      reload();
    });
    if (!ok) setOverride((o) => ({ ...o, [p.id]: !next }));
  }

  const rows = data?.rows ?? [];
  return (
    <AdminScreen title="Produktet" subtitle="Çmimi, stoku dhe shfaqja në dyqan." refreshing={refreshing} onRefresh={pull}>
      <Chips items={FILTERS} value={filter} onChange={(k) => { setFilter(k); setLimit(PRODUCTS_PAGE); }} />
      <SearchField value={query} onChangeText={(v) => { setQuery(v); setLimit(PRODUCTS_PAGE); }} placeholder="Kërko sipas emrit" />
      <ErrorNote message={error} />
      {!data && !error ? <Loading /> : null}
      {data && rows.length === 0 ? <Empty title="Asnjë produkt nuk përputhet." body="Provo një filtër tjetër." /> : null}

      {rows.length ? (
        <View className="overflow-hidden rounded-2xl border border-cream-line bg-surface">
          {rows.map((p, i) => {
            const active = override[p.id] ?? p.active;
            return (
              <Pressable
                key={p.id}
                onPress={() => router.push({ pathname: "/more/admin/product/[id]", params: { id: p.id } })}
                accessibilityRole="button"
                accessibilityLabel={`${p.name}, ndrysho`}
                className={`flex-row items-center px-3.5 py-3 active:opacity-70 ${i < rows.length - 1 ? "border-b border-cream-line" : ""}`}
              >
                {p.image ? (
                  <Image source={{ uri: p.image }} className="mr-3 h-12 w-12 rounded-lg border border-cream-line" style={{ backgroundColor: "#FFFFFF" }} resizeMode="contain" />
                ) : (
                  <View className="mr-3 h-12 w-12 rounded-lg bg-cream-soft" />
                )}
                <View className="mr-2 flex-1">
                  <Text className="font-bodyMedium text-sm text-ink" numberOfLines={2}>{p.name}</Text>
                  <Text className="mt-0.5 font-body text-xs text-ink-soft" numberOfLines={1}>
                    {eur(p.price)} · <Text style={p.stock <= 5 ? { color: TONES.orange.fg, fontFamily: "Inter_600SemiBold" } : undefined}>stoku {p.stock}</Text>
                    {p.brand ? ` · ${p.brand}` : ""}
                  </Text>
                  {p.partnerManaged ? (
                    <View className="mt-1.5">
                      {p.approval === "pending" ? <Pill label="Pret aprovim" /> : p.approval === "rejected" ? <Pill label="Refuzuar" tone={TONES.red} /> : <Pill label="Partner" tone={TONES.blue} />}
                    </View>
                  ) : null}
                </View>
                <ThemedSwitch value={active} onValueChange={(next) => void toggle(p, next)} accessibilityLabel={active ? "Fshih produktin" : "Shfaq produktin"} />
                <ChevronRight size={16} color={theme.inkFaint} strokeWidth={2} style={{ marginLeft: 6 }} />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {data && rows.length < data.total ? (
        <View className="mt-3 items-center">
          <Btn label={`Ngarko më shumë (${data.total - rows.length})`} kind="light" onPress={() => setLimit((n) => n + PRODUCTS_PAGE)} />
        </View>
      ) : null}
    </AdminScreen>
  );
}
