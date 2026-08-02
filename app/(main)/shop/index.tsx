import { useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon, IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { productCatalog, brandCatalog, CATEGORY_META, Product, ProductCategory } from "@/lib/homeContent";

type SortMode = "relevant" | "priceAsc" | "priceDesc" | "rating";

function ProductGridCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const { toggleFavorite, isFavorite, bumpCart } = useAppState();
  const fav = isFavorite(product.id);
  const bg = product.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = product.accent === "olive" ? "#6E7452" : "#C9702E";

  return (
    <Pressable onPress={onPress} style={shadows.soft} className="w-[47%] bg-surface rounded-xl2 p-3 mb-4">
      <View className={`w-full h-24 rounded-xl items-center justify-center mb-2 relative ${bg}`}>
        <Icon name={product.icon} size={30} color={fg} />
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            toggleFavorite({ id: product.id, name: product.name, price: `€${product.price.toFixed(2)}`, icon: product.icon });
          }}
          className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-surface items-center justify-center"
        >
          <Icon name="heart" size={14} color={fav ? "#C9702E" : "#A79D8A"} />
        </Pressable>
        {product.badge && (
          <View className="absolute top-1.5 left-1.5 bg-surface rounded-full px-2 py-0.5">
            <Text className="font-bodySemibold text-[9px] text-orange uppercase">{product.badge}</Text>
          </View>
        )}
      </View>
      <Text className="font-body text-[10px] text-ink-faint mb-0.5">{product.brand}</Text>
      <Text className="font-bodyMedium text-xs text-ink mb-1" numberOfLines={2}>
        {product.name}
      </Text>
      <View className="flex-row items-center justify-between">
        <View>
          <Text className="font-bodySemibold text-sm text-ink">€{product.price.toFixed(2)}</Text>
          {product.compareAtPrice && (
            <Text className="font-body text-[10px] text-ink-faint line-through">€{product.compareAtPrice.toFixed(2)}</Text>
          )}
        </View>
        <Pressable
          onPress={() => bumpCart(1)}
          className="w-7 h-7 rounded-full bg-olive items-center justify-center"
        >
          <Icon name="plus" size={14} color="#FFFFFF" />
        </Pressable>
      </View>
    </Pressable>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-4 py-2 rounded-full mr-2 ${active ? "bg-olive" : "bg-surface"}`}
      style={!active ? shadows.soft : undefined}
    >
      <Text className={`font-bodyMedium text-xs ${active ? "text-white" : "text-ink-soft"}`}>{label}</Text>
    </Pressable>
  );
}

export default function ShopScreen() {
  const router = useRouter();
  const { state } = useAppState();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ProductCategory | "all">("all");
  const [sort, setSort] = useState<SortMode>("relevant");
  const [showFilters, setShowFilters] = useState(false);

  const flashDeals = useMemo(() => productCatalog.filter((p) => p.compareAtPrice != null), []);
  const trending = useMemo(() => productCatalog.filter((p) => p.rating >= 4.6).slice(0, 6), []);
  const bestSellers = useMemo(() => productCatalog.filter((p) => p.badge === "bestseller"), []);

  const filtered = useMemo(() => {
    let list = productCatalog.slice();
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q));
    }
    if (category !== "all") list = list.filter((p) => p.category === category);
    if (sort === "priceAsc") list.sort((a, b) => a.price - b.price);
    if (sort === "priceDesc") list.sort((a, b) => b.price - a.price);
    if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [query, category, sort]);

  const isSearching = query.trim().length > 0 || category !== "all" || sort !== "relevant";

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-2 mb-4">
        <Text className="font-display text-2xl text-ink">Dyqani</Text>
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.push("/shop/wishlist")}
            style={shadows.soft}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-2"
          >
            <Icon name="heart" size={18} color="#2C271F" />
          </Pressable>
          <Pressable
            onPress={() => router.push("/shop/cart")}
            style={shadows.soft}
            className="w-10 h-10 rounded-full bg-surface items-center justify-center"
          >
            <Icon name="cart" size={18} color="#2C271F" />
            {state.cartCount > 0 && (
              <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange items-center justify-center">
                <Text className="text-white text-[10px] font-bodySemibold">{state.cartCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Search */}
      <View className="px-5 mb-4">
        <View style={shadows.soft} className="flex-row items-center bg-surface rounded-xl2 px-4 py-3">
          <Icon name="search" size={18} color="#A79D8A" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Kërko produkte ose marka..."
            placeholderTextColor="#A79D8A"
            className="flex-1 ml-2 font-body text-sm text-ink"
          />
          <Pressable onPress={() => setShowFilters((v) => !v)}>
            <Icon name="chart" size={18} color={showFilters ? "#C9702E" : "#A79D8A"} />
          </Pressable>
        </View>
      </View>

      {/* Filters (inline panel) */}
      {showFilters && (
        <View className="px-5 mb-4">
          <Text className="font-bodySemibold text-xs text-ink-soft mb-2">Rendit sipas</Text>
          <View className="flex-row mb-3">
            <Chip label="Relevante" active={sort === "relevant"} onPress={() => setSort("relevant")} />
            <Chip label="Çmimi ↑" active={sort === "priceAsc"} onPress={() => setSort("priceAsc")} />
            <Chip label="Çmimi ↓" active={sort === "priceDesc"} onPress={() => setSort("priceDesc")} />
            <Chip label="Vlerësimi" active={sort === "rating"} onPress={() => setSort("rating")} />
          </View>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Categories */}
        <View className="mb-2">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            <Chip label="Të gjitha" active={category === "all"} onPress={() => setCategory("all")} />
            {(Object.keys(CATEGORY_META) as ProductCategory[]).map((cat) => (
              <Chip key={cat} label={CATEGORY_META[cat].labelKey} active={category === cat} onPress={() => setCategory(cat)} />
            ))}
          </ScrollView>
        </View>

        {isSearching ? (
          // Rezultatet e kërkimit / filtrave
          <View className="px-5 mt-4 flex-row flex-wrap justify-between">
            {filtered.length === 0 ? (
              <Text className="font-body text-sm text-ink-soft mt-6 mx-auto">S'u gjet asnjë produkt.</Text>
            ) : (
              filtered.map((p) => <ProductGridCard key={p.id} product={p} onPress={() => router.push(`/shop/${p.id}`)} />)
            )}
          </View>
        ) : (
          <>
            {/* Brands */}
            <Text className="font-display text-lg text-ink px-5 mt-5 mb-3">Markat</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
              {brandCatalog.map((b) => {
                const bg = b.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
                const fg = b.accent === "olive" ? "#6E7452" : "#C9702E";
                return (
                  <Pressable
                    key={b.id}
                    onPress={() => {
                      const match = productCatalog.find((p) => p.brand === b.name);
                      if (match) setCategory(match.category);
                    }}
                    style={shadows.soft}
                    className="items-center bg-surface rounded-xl2 p-3 mr-3 w-24"
                  >
                    <View className={`w-11 h-11 rounded-full items-center justify-center mb-2 ${bg}`}>
                      <Icon name={b.icon} size={20} color={fg} />
                    </View>
                    <Text className="font-bodyMedium text-[11px] text-ink text-center" numberOfLines={1}>
                      {b.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Flash Deals */}
            <Text className="font-display text-lg text-ink px-5 mt-6 mb-3">⚡ Oferta të Menjëhershme</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
              {flashDeals.map((p) => (
                <View key={p.id} className="mr-3" style={{ width: 150 }}>
                  <ProductGridCard product={p} onPress={() => router.push(`/shop/${p.id}`)} />
                </View>
              ))}
            </ScrollView>

            {/* Trending */}
            <Text className="font-display text-lg text-ink px-5 mt-6 mb-3">Në Modë</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
              {trending.map((p) => (
                <View key={p.id} className="mr-3" style={{ width: 150 }}>
                  <ProductGridCard product={p} onPress={() => router.push(`/shop/${p.id}`)} />
                </View>
              ))}
            </ScrollView>

            {/* Best Sellers */}
            <Text className="font-display text-lg text-ink px-5 mt-6 mb-3">Më të Shiturat</Text>
            <View className="px-5 flex-row flex-wrap justify-between">
              {bestSellers.map((p) => (
                <ProductGridCard key={p.id} product={p} onPress={() => router.push(`/shop/${p.id}`)} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}