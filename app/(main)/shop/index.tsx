import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { View, Text, FlatList, ScrollView, Pressable, TextInput, Image, ActivityIndicator, BackHandler } from "react-native";
import { useContentWidth, gridColumns } from "@/lib/layout";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams, useFocusEffect, useScrollToTop } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { Icon } from "@/components/ui/Icon";
import { categoryPhoto } from "@/lib/shop/categoryPhotos";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { Product, Brand } from "@/lib/homeContent";
import { BrandMarquee } from "@/components/shop/BrandMarquee";
import {
  fetchProductPage, fetchBrands, fetchCategories,
  type ProductSort, type ShopCategory, type ShopRanking, PRODUCT_PAGE_SIZE,
} from "@/lib/shopData";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";
import { track } from "@/lib/analytics/posthog";
import { friendlyError } from "@/lib/errors/userMessage";
import { AGE_BANDS, bandForMonths, formatAgeRange, monthsSince, parseAgeBand } from "@/lib/shop/age";
import { ShopSuggestionCard } from "@/components/shop/ShopSuggestionCard";
import { useActiveChild } from "@/lib/age/useActiveChild";
import { hasFeature } from "@/lib/age/stageConfig";

const PADDING_X = 20;
const GRID_GAP = 12;
const SEARCH_DEBOUNCE_MS = 350;

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
  const { t, language } = useTranslation();
  const { state } = useAppState();
  const theme = useThemeColors();
  const width = useContentWidth();
  const columns = gridColumns(width);
  const cardWidth = (width - PADDING_X * 2 - GRID_GAP * (columns - 1)) / columns;

  // Një lidhje mund ta çojë klientin këtu me kërkimin gati (p.sh. "Porosit pelena").
  const { q: queryParam } = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(typeof queryParam === "string" ? queryParam : "");
  // Kur lidhja ndryshon pasi ekrani është hapur, kërkimi përditësohet gjatë vizatimit (jo në efekt).
  const [seenParam, setSeenParam] = useState(queryParam);
  if (queryParam !== seenParam) {
    setSeenParam(queryParam);
    if (typeof queryParam === "string" && queryParam) setQuery(queryParam);
  }
  const [search, setSearch] = useState("");
  // Celesi i kategorise nga baza, ose "all". Kategorite i menaxhon paneli.
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<ProductSort>("newest");
  const [showSort, setShowSort] = useState(false);
  // Grupmosha e zgjedhur ("0-3", "3-6"...), ose null. Bebi i profilit ka një shkurtore "Për [emri]".
  const [ageKey, setAgeKey] = useState<string | null>(null);
  const ageBand = parseAgeBand(ageKey);
  const babyBand = bandForMonths(monthsSince(state.profile.babyDob));
  const babyFirstName = (state.profile.nickname || state.profile.babyName || "").trim().split(" ")[0];
  // Renditja sipas moshës: grupmosha e zgjedhur te çipat, përndryshe fëmija aktiv. Asgjë s'fshihet: produktet që
  // përputhen dalin të parat, ato pa moshë pas tyre, të tjerat në fund.
  const { stage, months } = useActiveChild();
  const ranking = useMemo<ShopRanking | null>(() => {
    if (ageBand) return { ageFrom: ageBand.from, ageTo: ageBand.to, pregnancy: false };
    if (!hasFeature(stage, "shopRanking")) return null;
    if (stage === "pregnancy") return { ageFrom: null, ageTo: null, pregnancy: true };
    return months != null ? { ageFrom: months, ageTo: months, pregnancy: false } : null;
  }, [ageBand, stage, months]);
  const rankingKey = ranking ? `${ranking.ageFrom ?? ""}-${ranking.ageTo ?? ""}-${ranking.pregnancy ? "p" : ""}` : "";

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
  // Shtypja e tab-it kur je tashmë në të të çon në krye të faqes (si te Instagrami).
  const listRef = useRef<FlatList<Product>>(null);
  useScrollToTop(listRef);

  const isFiltering = search.trim().length > 0 || category !== "all" || ageBand !== null;

  // Kërkimi shkon te serveri, prandaj pritet derisa shkruesi të ndalet.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const filterKey = `${search}|${category}|${sort}|${ageKey ?? ""}|${rankingKey}|${reloadNonce}`;
  const loading = loadedKey !== filterKey && error === null;
  // Vetëm hapja e parë tregon skeletin në vend të listës. Ndërrimi i kategorisë/filtrit e mban listën (dhe shiritin
  // e kategorive) në vend: më parë lista rindërtohej nga e para, kategoritë ktheheshin në fillim dhe faqja lart.
  const firstLoad = loading && loadedKey === null;
  // Pozicioni i shiritit të kategorive, që të mbetet aty ku preku prindi.
  const [catScrollX, setCatScrollX] = useState(0);

  // "Mbrapa" i Android-it me një kategori/kërkim/moshë aktive: pastron filtrin (kthehet te "Të gjitha"), jo të dalë
  // nga Dyqani te kreu. Regjistrohet një çast më vonë, që të thirret para kontejnerit të navigimit.
  useFocusEffect(
    useCallback(() => {
      if (!isFiltering) return;
      let sub: { remove: () => void } | undefined;
      const id = setTimeout(() => {
        sub = BackHandler.addEventListener("hardwareBackPress", () => {
          setQuery("");
          setCategory("all");
          setAgeKey(null);
          return true;
        });
      }, 0);
      return () => {
        clearTimeout(id);
        sub?.remove();
      };
    }, [isFiltering])
  );

  // Te gjitha shkrimet e state-it rrine brenda .then/.catch: sinkronisht
  // brenda efektit do te shkaktonin render te dyte pa nevoje.
  useEffect(() => {
    const id = ++requestId.current;
    let active = true;
    fetchProductPage({ search, category, sort, page: 0, age: ageBand, ranking })
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
        setError(friendlyError(e, t, "shop_load_error_title"));
      });
    return () => { active = false; };
  }, [filterKey, search, category, sort, ageBand, ranking, t]);
  const loadMore = useCallback(async () => {
    if (loadingMore || loading || !hasMore) return;
    const id = requestId.current;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const result = await fetchProductPage({ search, category, sort, page: next, age: ageBand, ranking });
      if (id !== requestId.current) return;
      setItems((prev) => [...prev, ...result.items]);
      setHasMore(result.hasMore);
      setPage(next);
    } catch {
      // Faqja tjetër dështoi: lista ekzistuese mbetet, provohet me scroll-in tjetër.
    } finally {
      if (id === requestId.current) setLoadingMore(false);
    }
  }, [loadingMore, loading, hasMore, page, search, category, sort, ageBand, ranking]);


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
          contentOffset={{ x: catScrollX, y: 0 }}
          onMomentumScrollEnd={(e) => setCatScrollX(e.nativeEvent.contentOffset.x)}
          onScrollEndDrag={(e) => setCatScrollX(e.nativeEvent.contentOffset.x)}
        >
          {[
            { id: "all", key: "all", label: t("shop_all_chip"), icon: "shop" as const, emoji: "🛍️" },
            ...categories,
          ].map((cat) => {
            const isActive = category === cat.key;
            const photo = categoryPhoto(cat.key, "imageUrl" in cat ? cat.imageUrl : null);
            return (
              <Pressable
                key={cat.id}
                onPress={() => setCategory(isActive && cat.key !== "all" ? "all" : cat.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
                className="w-[88px] items-center"
              >
                {/* Korniza është gjithmonë aty (transparente kur s'është zgjedhur): kur hiqej/shtohej, Android-i e
                    priste foton brenda kutisë me qoshe dhe fotoja s'dukej më pas zgjedhjes dhe heqjes së kategorisë. */}
                <View
                  className={`h-[76px] w-[76px] items-center justify-center overflow-hidden rounded-2xl border-2 ${
                    isActive ? "border-ink" : "border-transparent"
                  } ${photo ? "bg-cream-soft" : isActive ? "bg-ink" : "bg-cream-soft"}`}
                >
                  {/* Foto e vërtetë kur ka; emoji kur s'ka; ikona si rezervë
                      e fundit. Kategoritë e reja nga paneli s'kanë foto në
                      app dhe bien te dy hapat e tjerë pa u prishur asgjë.

                      Emoji-ja mbush katrorin. `includeFontPadding` dhe
                      `textAlignVertical` jane per Android, ku pa to teksti
                      merr mbushje shtese lart e poshte dhe glifi pritet kur
                      `lineHeight` eshte sa kutia. */}
                  {photo ? (
                    <Image source={photo} style={{ width: 72, height: 72 }} resizeMode="cover" fadeDuration={0} />
                  ) : cat.emoji ? (
                    <Text
                      style={{
                        fontSize: 52,
                        lineHeight: 60,
                        textAlign: "center",
                        includeFontPadding: false,
                        textAlignVertical: "center",
                      }}
                    >
                      {cat.emoji}
                    </Text>
                  ) : (
                    <Icon name={cat.icon} size={26} color={isActive ? theme.onAccent : theme.inkSoft} />
                  )}
                </View>
                <Text
                  className={`mt-1.5 text-center text-[11px] ${
                    isActive ? "font-bodySemibold text-ink" : "font-bodyMedium text-ink-soft"
                  }`}
                  numberOfLines={2}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}
      {/* "Mosha e bebit" menjëherë pas kategorive: produktet e përshtatshme për moshën; me profil, shkurtorja "Për [emri]" e zgjedh vetë grupin e bebit. */}
      <Text className="font-bodySemibold text-base text-ink px-5 mt-2 mb-2">{t("shop_age_title")}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
        {babyBand && babyFirstName ? (
          <Chip
            label={t("shop_age_for_baby", { name: babyFirstName })}
            active={ageKey === babyBand.key}
            onPress={() => setAgeKey(ageKey === babyBand.key ? null : babyBand.key)}
          />
        ) : null}
        {AGE_BANDS.map((b) => (
          <Chip
            key={b.key}
            label={formatAgeRange(b.from, b.to, language === "en" ? "en" : "sq") ?? b.key}
            active={ageKey === b.key}
            onPress={() => setAgeKey(ageKey === b.key ? null : b.key)}
          />
        ))}
      </ScrollView>

      {!isFiltering && brands.length > 0 && (
        <>
          <Text className="font-bodySemibold text-base text-ink px-5 mt-2 mb-2">{t("shop_brands")}</Text>
          <BrandMarquee brands={brands} onOpen={(b) => router.push(`/shop/brand/${b.id}`)} />
        </>
      )}

      {/* Një sugjerim i vetëm: pelenat po mbarojnë, madhësia tjetër, ose diçka për moshën. */}
      {!isFiltering && (
        <View className="px-5 mt-4">
          <ShopSuggestionCard placement="shop" />
        </View>
      )}

      {!isFiltering && onSale.length > 0 && (
        <>
          <Text className="font-bodySemibold text-base text-ink px-5 mt-5 mb-2">{t("shop_on_sale")}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
            {onSale.map((p) => (
              <View key={p.id} className="mr-3">
                <ProductCard product={p} cardWidth={150} onPress={() => router.push(`/shop/${p.id}`)} />
              </View>
            ))}
          </ScrollView>
        </>
      )}

      <View className="flex-row items-center justify-between px-5 mt-5 mb-2">
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
  ), [brands, onSale, categories, category, isFiltering, showSort, sort, total, router, t, theme, ageKey, babyBand, babyFirstName, language, catScrollX]);

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
      ) : firstLoad ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View className="flex-row flex-wrap" style={{ columnGap: GRID_GAP, rowGap: GRID_GAP, paddingHorizontal: PADDING_X, paddingTop: 16 }}>
            {Array.from({ length: columns * 3 }).map((_, i) => (
              <ProductCardSkeleton key={i} cardWidth={cardWidth} />
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          ref={listRef}
          // Ndryshimi i numrit të kolonave kërkon montim të ri të listës.
          key={columns}
          data={loading ? [] : items}
          keyExtractor={(item) => item.id}
          numColumns={columns}
          renderItem={({ item }) => (
            <ProductCard product={item} cardWidth={cardWidth} onPress={() => router.push(`/shop/${item.id}`)} />
          )}
          columnWrapperStyle={columns > 1 ? { gap: GRID_GAP, paddingHorizontal: PADDING_X } : undefined}
          contentContainerStyle={{ paddingBottom: 120 }}
          // Element, jo komponent: kështu koka (me shiritin e kategorive) s'rimontohet në çdo ndryshim filtri.
          ListHeaderComponent={renderHeader()}
          ListFooterComponent={renderFooter}
          ListEmptyComponent={
            loading ? (
              // Filtri i ri po ngarkohet: skeleti poshtë kokës, që faqja të mos kërcejë lart.
              <View className="flex-row flex-wrap" style={{ columnGap: GRID_GAP, rowGap: GRID_GAP, paddingHorizontal: PADDING_X, paddingTop: 16 }}>
                {Array.from({ length: columns * 2 }).map((_, i) => (
                  <ProductCardSkeleton key={i} cardWidth={cardWidth} />
                ))}
              </View>
            ) : (
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
            )
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
