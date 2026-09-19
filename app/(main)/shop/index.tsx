import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, FlatList, ScrollView, Pressable, TextInput, Image, ActivityIndicator, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { Icon } from "@/components/ui/Icon";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { Product, Brand } from "@/lib/homeContent";
import {
  fetchProductPage, fetchBrands, fetchCategories,
  type ProductSort, type ShopCategory, PRODUCT_PAGE_SIZE,
} from "@/lib/shopData";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { track } from "@/lib/analytics/posthog";

const PADDING_X = 20;
const GRID_GAP = 12;
const SEARCH_DEBOUNCE_MS = 350;

function useGridColumns() {
  const { width } = useWindowDimensions();
  if (width >= 1024) return 4;
  if (width >= 768) return 3;
  return 2;
}

const SORT_OPTIONS: { value: ProductSort; labelKey: string }[] = [
  { value: "newest", labelKey: "sort_relevant" },
  { value: "priceAsc", labelKey: "sort_price_asc" },
  { value: "priceDesc", labelKey: "sort_price_desc" },
  { value: "rating", labelKey: "sort_rating" },
];

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      className={`px-3.5 py-1.5 rounded-full mr-2 ${active ? "bg-ink" : "bg-cream-soft"}`}
    >
      <Text className={`font-bodyMedium text-xs ${active ? "text-on-accent" : "text-ink-soft"}`}>{label}</Text>
    </Pressable>
  );
}

export default function ShopScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const { state } = useAppState();
  const theme = useThemeColors();
  const { width } = useWindowDimensions();
  const columns = useGridColumns();
  const cardWidth = (width - PADDING_X * 2 - GRID_GAP * (columns - 1)) / columns;

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  // Celesi i kategorise nga baza, ose "all". Kategorite i menaxhon paneli.
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<ProductSort>("newest");
  const [showSort, setShowSort] = useState(false);

  const [items, setItems] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [page, setPage] = useState(0);
  // `loading` nuk eshte flamur me vete: eshte pyetja "a i perket lista
  // filtrave te tanishem". Nje flamur i vecante mund te dale nga sinkroni
  // me listen; kjo nuk mundet.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [brands, setBrands] = useState<Brand[]>([]);
  const [onSale, setOnSale] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);

  // Çdo ndryshim filtri nis një kërkesë; përgjigjet e vona nga filtrat e
  // mëparshëm duhen injoruar, përndryshe lista "kërcen" mbrapsht.
  const requestId = useRef(0);

  const isFiltering = search.trim().length > 0 || category !== "all";

  // Kërkimi shkon te serveri, prandaj pritet derisa shkruesi të ndalet.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const filterKey = `${search}|${category}|${sort}|${reloadNonce}`;
  const loading = loadedKey !== filterKey && error === null;

  // Te gjitha shkrimet e state-it rrine brenda .then/.catch: sinkronisht
  // brenda efektit do te shkaktonin render te dyte pa nevoje.
  useEffect(() => {
    const id = ++requestId.current;
    let active = true;
    fetchProductPage({ search, category, sort, page: 0 })
      .then((result) => {
        if (!active || id !== requestId.current) return;
        setItems(result.items);
        setTotal(result.total);
        setHasMore(result.hasMore);
        setPage(0);
        setError(null);
        setLoadedKey(filterKey);
      })
      .catch((e: any) => {
        if (!active || id !== requestId.current) return;
        setError(e?.message ?? t("shop_load_error_title"));
      });
    return () => { active = false; };
  }, [filterKey, search, category, sort, t]);
  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const result = await fetchProductPage({ search, category, sort, page: next });
      if (id !== requestId.current) return;
      setItems((prev) => [...prev, ...result.items]);
      setHasMore(result.hasMore);
      setPage(next);
    } catch {
      // Faqja tjetër dështoi: lista ekzistuese mbetet, provohet me scroll-in tjetër.
    } finally {
      if (id === requestId.current) setLoadingMore(false);
    }
  }, [loadingMore, loading, hasMore, page, search, category, sort]);


  // Markat dhe ofertat ngarkohen një herë; nuk varen nga filtrat.
  useEffect(() => {
    let active = true;
    Promise.all([
      fetchBrands(),
      fetchProductPage({ onSaleOnly: true, pageSize: 8 }),
      fetchCategories(),
    ])
      .then(([brandList, sale, categoryList]) => {
        if (!active) return;
        setBrands(brandList);
        setOnSale(sale.items);
        setCategories(categoryList);
      })
      .catch(() => {
        // Seksione dytësore: nëse dështojnë, grid-i kryesor mjafton.
      });
    track("shop_opened");
    return () => { active = false; };
  }, []);


  const renderHeader = useCallback(() => (
    <View>
      {/* Kategorite vijne nga paneli, jo nga kodi: mund te shtohen pa
          prekur app-in, prandaj shiriti rreshqet ne vend te nje rrjeti
          me numer te fiksuar. */}
      {categories.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
        >
          {[{ id: "all", key: "all", label: t("shop_all_chip"), icon: "shop" as const }, ...categories].map((cat) => {
            const isActive = category === cat.key;
            return (
              <Pressable
                key={cat.id}
                onPress={() => setCategory(isActive && cat.key !== "all" ? "all" : cat.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                className="items-center w-[76px]"
              >
                <View
                  className={`w-14 h-14 rounded-2xl items-center justify-center ${isActive ? "bg-ink" : "bg-cream-soft"}`}
                >
                  <Icon name={cat.icon} size={22} color={isActive ? theme.onAccent : theme.inkSoft} />
                </View>
                <Text
                  className={`font-bodyMedium text-[11px] mt-1.5 text-center ${isActive ? "text-ink" : "text-ink-soft"}`}
                  numberOfLines={2}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {!isFiltering && brands.length > 0 && (
        <>
          <Text className="font-bodySemibold text-base text-ink px-5 mt-6 mb-3">{t("shop_brands")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {brands.map((b) => (
              <Pressable key={b.id} onPress={() => router.push(`/shop/brand/${b.id}`)} className="items-center mr-4 w-[72px]">
                <View className="w-[72px] h-[72px] rounded-2xl bg-surface border border-cream-line items-center justify-center overflow-hidden">
                  {b.logoUrl ? (
                    <Image source={{ uri: b.logoUrl }} className="w-full h-full" resizeMode="cover" />
                  ) : (
                    <Icon name={b.icon} size={24} color={theme.inkFaint} />
                  )}
                </View>
                <Text className="font-body text-[11px] text-ink-soft text-center mt-2" numberOfLines={1}>{b.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </>
      )}

      {!isFiltering && onSale.length > 0 && (
        <>
          <Text className="font-bodySemibold text-base text-ink px-5 mt-7 mb-3">{t("shop_on_sale")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {onSale.map((p) => (
              <View key={p.id} className="mr-3">
                <ProductCard product={p} cardWidth={150} onPress={() => router.push(`/shop/${p.id}`)} />
              </View>
            ))}
          </ScrollView>
        </>
      )}

      <View className="flex-row items-center justify-between px-5 mt-7 mb-3">
        <Text className="font-bodySemibold text-base text-ink">
          {isFiltering ? t("shop_results_count", { n: total }) : t("shop_all_products")}
        </Text>
        <Pressable onPress={() => setShowSort((v) => !v)} hitSlop={8} accessibilityRole="button">
          <Text className="font-bodyMedium text-xs text-olive">{t("shop_sort_by")}</Text>
        </Pressable>
      </View>

      {showSort && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }} className="mb-3">
          {SORT_OPTIONS.map((option) => (
            <Chip
              key={option.value}
              label={t(option.labelKey as any)}
              active={sort === option.value}
              onPress={() => setSort(option.value)}
            />
          ))}
        </ScrollView>
      )}
    </View>
  ), [brands, onSale, categories, category, isFiltering, showSort, sort, total, router, t, theme]);

  const renderFooter = useCallback(() => {
    if (loadingMore) {
      return (
        <View className="py-6">
          <ActivityIndicator className="text-olive" />
        </View>
      );
    }
    if (!hasMore && items.length > 0) {
      return (
        <Text className="font-body text-xs text-ink-faint text-center py-6">
          {t("shop_end_of_list", { n: total })}
        </Text>
      );
    }
    return <View className="h-6" />;
  }, [loadingMore, hasMore, items.length, total, t]);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-end justify-between px-5 pt-2 mb-3">
        <View>
          <Text className="font-display text-2xl text-ink">{t("shop_title")}</Text>
          {state.profile.parentName && (
            <Text className="font-body text-xs text-ink-faint mt-0.5">
              {t("shop_welcome", { name: state.profile.parentName.split(" ")[0] })}
            </Text>
          )}
        </View>
        <View className="flex-row items-center">
          <Pressable
            onPress={() => router.push("/shop/orders")}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t("my_orders")}
            className="w-10 h-10 items-center justify-center"
          >
            <Icon name="cube" size={20} color={theme.inkSoft} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/shop/wishlist")}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t("saved_products")}
            className="w-10 h-10 items-center justify-center"
          >
            <Icon name="heart" size={20} color={theme.inkSoft} />
          </Pressable>
          <Pressable
            onPress={() => router.push("/shop/cart")}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel={t("cart_title")}
            className="w-10 h-10 items-center justify-center"
          >
            <Icon name="cart" size={20} color={theme.ink} />
            {state.cartCount > 0 && (
              <View className="absolute top-0.5 right-0 w-4 h-4 rounded-full bg-orange items-center justify-center">
                <Text className="text-on-accent text-[10px] font-bodySemibold">{state.cartCount}</Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      <View className="px-5 mb-3">
        <View className="flex-row items-center bg-surface border border-cream-line rounded-xl2 px-3.5 py-2.5">
          <Icon name="search" size={18} color={theme.inkFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t("shop_search_ph")}
            placeholderClassName="text-ink-faint"
            returnKeyType="search"
            className="flex-1 ml-2 font-body text-sm text-ink"
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel={t("community_clear_search")}>
              <Icon name="close" size={16} color={theme.inkFaint} />
            </Pressable>
          )}
        </View>
      </View>

      {error ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="font-bodyMedium text-sm text-ink text-center">{t("shop_load_error_title")}</Text>
          <Text className="font-body text-xs text-ink-faint mt-1 text-center">{error}</Text>
          <Pressable
            onPress={() => { setError(null); setReloadNonce((n) => n + 1); }}
            className="mt-4 bg-olive rounded-full px-5 py-2.5"
          >
            <Text className="font-bodyMedium text-xs text-on-accent">{t("shop_retry")}</Text>
          </Pressable>
        </View>
      ) : loading ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="flex-row flex-wrap" style={{ columnGap: GRID_GAP, rowGap: GRID_GAP, paddingHorizontal: PADDING_X, paddingTop: 16 }}>
            {Array.from({ length: columns * 3 }).map((_, i) => (
              <ProductCardSkeleton key={i} cardWidth={cardWidth} />
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          // Ndryshimi i numrit të kolonave kërkon montim të ri të listës.
          key={columns}
          data={items}
          keyExtractor={(item) => item.id}
          numColumns={columns}
          renderItem={({ item }) => (
            <ProductCard product={item} cardWidth={cardWidth} onPress={() => router.push(`/shop/${item.id}`)} />
          )}
          columnWrapperStyle={columns > 1 ? { gap: GRID_GAP, paddingHorizontal: PADDING_X } : undefined}
          contentContainerStyle={{ paddingBottom: 120 }}
          ListHeaderComponent={renderHeader}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            <View className="items-center px-10 py-12">
              <Icon name="search" size={24} color={theme.inkFaint} />
              <Text className="font-bodyMedium text-sm text-ink mt-3 text-center">
                {isFiltering ? t("shop_no_results_title") : t("shop_empty_title")}
              </Text>
              {isFiltering && (
                <Pressable
                  onPress={() => { setQuery(""); setCategory("all"); }}
                  className="mt-4 bg-olive rounded-full px-5 py-2.5"
                >
                  <Text className="font-bodyMedium text-xs text-on-accent">{t("shop_view_all")}</Text>
                </Pressable>
              )}
            </View>
          }
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          showsVerticalScrollIndicator={false}
          initialNumToRender={PRODUCT_PAGE_SIZE}
          windowSize={7}
          removeClippedSubviews
        />
      )}
    </SafeAreaView>
  );
}
