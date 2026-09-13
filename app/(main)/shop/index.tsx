import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, TextInput, Image, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { CATEGORY_META, Product, ProductCategory, Brand } from "@/lib/homeContent";
import { fetchProducts, fetchBrands } from "@/lib/shopData";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";

type SortMode = "relevant" | "priceAsc" | "priceDesc" | "rating";

const PADDING_X = 20; // px-5
const GRID_GAP = 12;

/** 15. Mobile → 2, Tablet → 3, Desktop → 4 kolona. */
function useGridColumns() {
  const { width } = useWindowDimensions();
  if (width >= 1024) return 4;
  if (width >= 768) return 3;
  return 2;
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`px-4 py-2 rounded-full mr-2 ${active ? "bg-olive" : "bg-surface dark:bg-ink/40"}`}
      style={!active ? shadows.soft : undefined}
    >
      <Text className={`font-bodyMedium text-xs ${active ? "text-white" : "text-ink-soft dark:text-cream/60"}`}>{label}</Text>
    </Pressable>
  );
}

/** Kategoritë tash si grid 2×3 me ikona të mëdha — krejt 6 shihen menjëherë, pa scroll. */
function CategoryTile({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: Parameters<typeof Icon>[0]["name"];
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={!active ? shadows.soft : undefined}
      className={`flex-1 items-center py-4 rounded-xl2 ${active ? "bg-olive" : "bg-surface dark:bg-ink/40"}`}
    >
      <Icon name={icon} size={22} color={active ? "#FFFFFF" : "#6E7452"} />
      <Text className={`font-bodyMedium text-xs mt-2 text-center ${active ? "text-white" : "text-ink dark:text-cream"}`} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function ShopScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { state } = useAppState();
  const isDark = state.darkMode;
  const { width } = useWindowDimensions();
  const columns = useGridColumns();
  const cardWidth = (width - PADDING_X * 2 - GRID_GAP * (columns - 1)) / columns;

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<ProductCategory | "all">("all");
  const [sort, setSort] = useState<SortMode>("relevant");
  const [showFilters, setShowFilters] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setLoadError(null);
    try {
      const [productsData, brandsData] = await Promise.all([fetchProducts(), fetchBrands()]);
      setProducts(productsData);
      setBrands(brandsData);
    } catch (e: any) {
      setLoadError(e.message ?? "Diçka shkoi keq.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const flashDeals = useMemo(() => products.filter((p) => p.compareAtPrice != null), [products]);
  const trending = useMemo(() => products.filter((p) => p.rating >= 4.6).slice(0, 6), [products]);

  const filtered = useMemo(() => {
    let list = products.slice();
    if (query.trim()) {
      const q = query.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.brand.toLowerCase().includes(q));
    }
    if (category !== "all") list = list.filter((p) => p.category === category);
    if (sort === "priceAsc") list.sort((a, b) => a.price - b.price);
    if (sort === "priceDesc") list.sort((a, b) => b.price - a.price);
    if (sort === "rating") list.sort((a, b) => b.rating - a.rating);
    return list;
  }, [products, query, category, sort]);

  const isSearching = query.trim().length > 0 || category !== "all" || sort !== "relevant";
  const categoryKeys = Object.keys(CATEGORY_META) as ProductCategory[];

  function ProductGrid({ items }: { items: Product[] }) {
    return (
      <View
        className="px-5 mt-4 flex-row flex-wrap"
        style={{ columnGap: GRID_GAP, rowGap: GRID_GAP, paddingHorizontal: PADDING_X }}
      >
        {items.map((p) => (
          <ProductCard key={p.id} product={p} cardWidth={cardWidth} onPress={() => router.push(`/shop/${p.id}`)} />
        ))}
      </View>
    );
  }

  function SkeletonGrid() {
    return (
      <View
        className="flex-row flex-wrap"
        style={{ columnGap: GRID_GAP, rowGap: GRID_GAP, paddingHorizontal: PADDING_X, paddingTop: 16 }}
      >
        {Array.from({ length: columns * 3 }).map((_, i) => (
          <ProductCardSkeleton key={i} cardWidth={cardWidth} />
        ))}
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream dark:bg-ink" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-2 mb-4">
        <View>
          <Text className="font-display text-2xl text-ink dark:text-cream">{t("shop_title")}</Text>
          {state.profile.parentName && (
            <Text className="font-body text-xs text-ink-faint dark:text-cream/50 mt-0.5">
              {t("shop_welcome", { name: state.profile.parentName.split(" ")[0] })}
            </Text>
          )}
        </View>
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.push("/shop/wishlist")}
            style={shadows.soft}
            className="w-10 h-10 rounded-full bg-surface dark:bg-ink/40 items-center justify-center mr-2"
          >
            <Icon name="heart" size={18} color={isDark ? "#F7F1E4" : "#2C271F"} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/shop/cart")}
            style={shadows.soft}
            className="w-10 h-10 rounded-full bg-surface dark:bg-ink/40 items-center justify-center"
          >
            <Icon name="cart" size={18} color={isDark ? "#F7F1E4" : "#2C271F"} />
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
        <View style={shadows.soft} className="flex-row items-center bg-surface dark:bg-ink/40 rounded-xl2 px-4 py-3">
          <Icon name="search" size={18} color="#A79D8A" />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("shop_search_ph")}
            placeholderTextColor="#A79D8A"
            className="flex-1 ml-2 font-body text-sm text-ink dark:text-cream"
          />
          <Pressable onPress={() => setShowFilters((v) => !v)}>
            <Icon name="chart" size={18} color={showFilters ? "#C9702E" : "#A79D8A"} />
          </Pressable>
        </View>
      </View>

      {showFilters && (
        <View className="px-5 mb-4">
          <Text className="font-bodyMedium text-xs text-ink-soft dark:text-cream/60 mb-2">{t("shop_sort_by")}</Text>
          <View className="flex-row mb-3">
            <Chip label={t("sort_relevant")} active={sort === "relevant"} onPress={() => setSort("relevant")} />
            <Chip label={t("sort_price_asc")} active={sort === "priceAsc"} onPress={() => setSort("priceAsc")} />
            <Chip label={t("sort_price_desc")} active={sort === "priceDesc"} onPress={() => setSort("priceDesc")} />
            <Chip label={t("sort_rating")} active={sort === "rating"} onPress={() => setSort("rating")} />
          </View>
        </View>
      )}

      {loading ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <SkeletonGrid />
        </ScrollView>
      ) : loadError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Icon name="close" size={24} color="#C9702E" />
          <Text className="font-bodyMedium text-sm text-ink dark:text-cream mt-3 text-center">{t("shop_load_error_title")}</Text>
          <Text className="font-body text-xs text-ink-faint dark:text-cream/50 mt-1 text-center">{loadError}</Text>
          <Pressable onPress={load} className="mt-4 bg-olive rounded-full px-5 py-2.5">
            <Text className="font-bodyMedium text-xs text-white">{t("shop_retry")}</Text>
          </Pressable>
        </View>
      ) : products.length === 0 ? (
        // 14. Empty state
        <View className="flex-1 items-center justify-center px-8">
          <Icon name="cube" size={24} color="#A79D8A" />
          <Text className="font-bodyMedium text-sm text-ink dark:text-cream mt-3 text-center">{t("shop_empty_title")}</Text>
          <Text className="font-body text-xs text-ink-faint dark:text-cream/50 mt-1 text-center">{t("shop_empty_sub")}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Kategoritë — grid 2×3, krejt të dukshme pa scroll */}
          <View className="px-5 mb-2">
            <View className="flex-row justify-between mb-2">
              <Chip label={t("shop_all_chip")} active={category === "all"} onPress={() => setCategory("all")} />
            </View>
            <View style={{ gap: GRID_GAP }}>
              {[0, 1].map((row) => (
                <View key={row} className="flex-row" style={{ gap: GRID_GAP }}>
                  {categoryKeys.slice(row * 3, row * 3 + 3).map((cat) => (
                    <CategoryTile
                      key={cat}
                      label={t(CATEGORY_META[cat].labelKey as any)}
                      icon={CATEGORY_META[cat].icon}
                      active={category === cat}
                      onPress={() => setCategory(category === cat ? "all" : cat)}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>

          {isSearching ? (
            filtered.length === 0 ? (
              // 14. Empty state kur s'ka rezultate
              <View className="items-center justify-center px-8 mt-10">
                <Icon name="search" size={24} color="#A79D8A" />
                <Text className="font-bodyMedium text-sm text-ink dark:text-cream mt-3 text-center">{t("shop_no_results_title")}</Text>
                <Pressable
                  onPress={() => {
                    setQuery("");
                    setCategory("all");
                    setSort("relevant");
                  }}
                  className="mt-4 bg-olive rounded-full px-5 py-2.5"
                >
                  <Text className="font-bodyMedium text-xs text-white">{t("shop_view_all")}</Text>
                </Pressable>
              </View>
            ) : (
              <ProductGrid items={filtered} />
            )
          ) : (
            <>
              {/* 9. Section header — Markat */}
              {brands.length > 0 && (
                <>
                  <Text className="font-bodySemibold text-lg text-ink dark:text-cream px-5 mt-5 mb-3">{t("shop_brands")}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                    {brands.map((b) => {
                      const bg = b.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
                      const fg = b.accent === "olive" ? "#6E7452" : "#C9702E";
                      return (
                        <Pressable
                          key={b.id}
                          onPress={() => router.push(`/shop/brand/${b.id}`)}
                          className="items-center mr-4 w-20"
                        >
                          <View
                            style={shadows.soft}
                            className="w-20 h-20 rounded-2xl bg-surface dark:bg-ink/40 items-center justify-center overflow-hidden"
                          >
                            {b.logoUrl ? (
                              <Image source={{ uri: b.logoUrl }} className="w-full h-full" resizeMode="cover" />
                            ) : (
                              <View className={`w-full h-full items-center justify-center ${bg}`}>
                                <Icon name={b.icon} size={26} color={fg} />
                              </View>
                            )}
                          </View>
                          <Text className="font-bodyMedium text-[11px] text-ink dark:text-cream text-center mt-2" numberOfLines={1}>
                            {b.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </>
              )}

              {flashDeals.length > 0 && (
                <>
                  <View className="flex-row items-center justify-between px-5 mt-6 mb-3">
                    <Text className="font-bodySemibold text-lg text-ink dark:text-cream">{t("shop_flash_deals")}</Text>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                    {flashDeals.map((p) => (
                      <View key={p.id} className="mr-3">
                        <ProductCard product={p} cardWidth={150} onPress={() => router.push(`/shop/${p.id}`)} />
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}

              {trending.length > 0 && (
                <>
                  <Text className="font-bodySemibold text-lg text-ink dark:text-cream px-5 mt-6 mb-3">{t("shop_trending")}</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
                    {trending.map((p) => (
                      <View key={p.id} className="mr-3">
                        <ProductCard product={p} cardWidth={150} onPress={() => router.push(`/shop/${p.id}`)} />
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* 9. Section header — grid kryesor, me "Shiko të gjitha" */}
              <View className="flex-row items-center justify-between px-5 mt-6 mb-1">
                <Text className="font-bodySemibold text-lg text-ink dark:text-cream">{t("shop_all_products")}</Text>
              </View>
              <ProductGrid items={products} />
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}