import { useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { Product, Brand } from "@/lib/homeContent";
import { fetchBrandById, fetchProductsByBrand } from "@/lib/shopData";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";

const PADDING_X = 20;
const GRID_GAP = 12;

function useGridColumns() {
  const { width } = useWindowDimensions();
  if (width >= 1024) return 4;
  if (width >= 768) return 3;
  return 2;
}

export default function BrandProductsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { width } = useWindowDimensions();
  const columns = useGridColumns();
  const cardWidth = (width - PADDING_X * 2 - GRID_GAP * (columns - 1)) / columns;

  const [brand, setBrand] = useState<Brand | null | undefined>(undefined);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [b, p] = await Promise.all([fetchBrandById(id), fetchProductsByBrand(id)]);
        if (!active) return;
        setBrand(b);
        setProducts(p);
      } catch (e: any) {
        if (active) setLoadError(e.message ?? "Diçka shkoi keq.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [id]);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <Pressable onPress={() => router.back()} style={shadows.soft} className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
          <Icon name="chevronLeft" size={18} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-2xl text-ink">{brand?.name ?? "Marka"}</Text>
      </View>

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#6E7452" />
        </View>
      ) : loadError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Icon name="close" size={24} color="#C9702E" />
          <Text className="font-bodyMedium text-sm text-ink mt-3 text-center">S'u ngarkuan produktet.</Text>
        </View>
      ) : products.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Icon name="cube" size={24} color="#A79D8A" />
          <Text className="font-bodyMedium text-sm text-ink mt-3 text-center">
            Ende s'ka produkte për këtë markë.
          </Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View
            className="flex-row flex-wrap"
            style={{ columnGap: GRID_GAP, rowGap: GRID_GAP, paddingHorizontal: PADDING_X }}
          >
            {products.map((p) => (
              <ProductCard key={p.id} product={p} cardWidth={cardWidth} onPress={() => router.push(`/shop/${p.id}`)} />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}