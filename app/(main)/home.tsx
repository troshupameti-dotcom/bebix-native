import { useEffect, useMemo, useState } from "react";
import { View, Text, ScrollView, Pressable, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppState, active } from "@/lib/state/AppStateContext";
import { Icon, IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { initialNotifications, Product } from "@/lib/homeContent";
import { fetchProducts } from "@/lib/shopData";
import { ProductCard, ProductCardSkeleton } from "@/components/ProductCard";

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function greetingWord(): string {
  const h = new Date().getHours();
  if (h < 12) return "Mirëmëngjes";
  if (h < 18) return "Mirëdita";
  return "Mirëmbrëma";
}

function ageLabel(dob: string | null): string {
  if (!dob) return "";
  const start = new Date(dob).getTime();
  const days = Math.max(0, Math.floor((Date.now() - start) / 86400000));
  const months = Math.floor(days / 30.44);
  if (months < 1) return `${days} ditë`;
  if (months < 24) return `${months} muaj`;
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  return remMonths ? `${years} vjeç ${remMonths} muaj` : `${years} vjeç`;
}

function timeAgoLabel(iso: string | null): string {
  if (!iso) return "Ende pa regjistrim";
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return "Tani";
  if (mins < 60) return `${mins} min më parë`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} orë më parë`;
  const days = Math.floor(hrs / 24);
  return `${days} ditë më parë`;
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

function hoursSince(iso: string | null): number {
  if (!iso) return Infinity;
  return (Date.now() - new Date(iso).getTime()) / 3600000;
}

// Vendos ç'është gjëja e VETME më e rëndësishme për ta shfaqur tani —
// jo tetë gjëra të barabarta. Kjo është zemra e qasjes "një gjë në herë".
type NextInsight = { icon: IconName; title: string; subtitle: string; route: string };

function computeNextInsight(
  lastFeedingAt: string | null,
  lastSleepAt: string | null,
  lastDiaperAt: string | null
): NextInsight {
  const hf = hoursSince(lastFeedingAt);
  const hs = hoursSince(lastSleepAt);
  const hd = hoursSince(lastDiaperAt);

  const candidates: NextInsight[] = [
    {
      icon: "spoon",
      route: "/baby/feeding",
      title: hf === Infinity ? "Regjistro ushqyerjen e parë" : `${Math.round(hf)} orë pa ushqyerje`,
      subtitle: hf === Infinity ? "Fillo të gjurmosh ushqyerjen" : "Ndoshta është koha për ushqyerjen tjetër",
    },
    {
      icon: "moon",
      route: "/baby/sleep",
      title: hs === Infinity ? "Regjistro gjumin e parë" : `${Math.round(hs)} orë zgjuar`,
      subtitle: hs === Infinity ? "Fillo të gjurmosh gjumin" : "Kontrollo nëse bebi ka nevojë për pushim",
    },
    {
      icon: "diaper",
      route: "/baby/diaper",
      title: hd === Infinity ? "Regjistro ndërrimin e parë" : `${Math.round(hd)} orë nga ndërrimi i fundit`,
      subtitle: hd === Infinity ? "Fillo të gjurmosh pelenat" : "Ndoshta ia vlen të kontrollosh",
    },
  ];

  const hours = [hf, hs, hd];
  const maxIdx = hours.indexOf(Math.max(...hours));
  return candidates[maxIdx];
}

// ---------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------

function QuickAction({
  icon,
  label,
  subLabel,
  onPress,
}: {
  icon: IconName;
  label: string;
  subLabel: string;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={shadows.soft} className="flex-1 bg-surface rounded-xl3 py-5 items-center mx-1.5">
      <View className="w-12 h-12 rounded-full bg-cream-soft items-center justify-center mb-2.5">
        <Icon name={icon} size={22} color="#6E7452" />
      </View>
      <Text className="font-bodySemibold text-sm text-ink">{label}</Text>
      <Text className="font-body text-[11px] text-ink-faint mt-0.5">{subLabel}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------

export default function HomeScreen() {
  const router = useRouter();
  const { state } = useAppState();
  const { profile, baby } = state;

  const displayName = profile.babyName || "bebit";
  const unreadCount = initialNotifications.filter((n) => !n.read).length;

  const lastFeeding = active(baby.feedingLog)[0] ?? null;
  const lastSleep = active(baby.sleepLog)[0] ?? null;
  const lastDiaper = active(baby.diaperLog)[0] ?? null;

  const feedingTodayCount = useMemo(
    () => active(baby.feedingLog).filter((f) => f.type !== "medicine" && isToday(f.at)).length,
    [baby.feedingLog]
  );
  const diaperTodayCount = useMemo(
    () => active(baby.diaperLog).filter((d) => isToday(d.at)).length,
    [baby.diaperLog]
  );

  const nextInsight = useMemo(
    () => computeNextInsight(lastFeeding?.at ?? null, lastSleep?.startAt ?? null, lastDiaper?.at ?? null),
    [lastFeeding, lastSleep, lastDiaper]
  );

  // Produktet reale nga Supabase — një rresht i vetëm, jo dy karuselë.
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    fetchProducts()
      .then(setProducts)
      .catch(() => setProducts([]))
      .finally(() => setProductsLoading(false));
  }, []);

  const featuredProducts = useMemo(() => products.slice().sort((a, b) => b.rating - a.rating).slice(0, 4), [products]);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>
        {/* Greeting bar — minimale, vetëm koha e ditës + zilja */}
        <View className="flex-row items-center justify-between px-6 pt-3 mb-2">
          <Text className="font-body text-sm text-ink-faint">{greetingWord()}</Text>
          <Pressable
            onPress={() => router.push("/notifications")}
            className="w-9 h-9 rounded-full items-center justify-center"
          >
            <Icon name="bell" size={19} color="#6B6154" />
            {unreadCount > 0 && (
              <View className="absolute top-1 right-1 w-2 h-2 rounded-full bg-orange" />
            )}
          </Pressable>
        </View>

        {/* Hero — foto, emri, mosha. Kjo është qendra emocionale e ekranit. */}
        <Pressable onPress={() => router.push("/baby")} className="items-center pt-4 pb-8">
          <View className="w-28 h-28 rounded-full bg-olive-bg items-center justify-center overflow-hidden" style={shadows.softLg}>
            {profile.babyPhoto ? (
              <Image source={{ uri: profile.babyPhoto }} className="w-28 h-28" />
            ) : (
              <Icon name="baby" size={40} color="#6E7452" />
            )}
          </View>
          <Text className="font-display text-3xl text-ink mt-4">
            {profile.babyName || `Shto emrin e ${displayName}`}
          </Text>
          {!!profile.babyDob && (
            <Text className="font-body text-sm text-ink-faint mt-1">{ageLabel(profile.babyDob)}</Text>
          )}
        </Pressable>

        {/* "Next" — një gjë e vetme, kontekstuale, jo tetë gjëra të barabarta */}
        <Pressable
          onPress={() => router.push(nextInsight.route as any)}
          style={shadows.softLg}
          className="mx-6 bg-ink rounded-xl3 p-5 flex-row items-center"
        >
          <View className="w-12 h-12 rounded-full bg-white/15 items-center justify-center mr-4">
            <Icon name={nextInsight.icon} size={22} color="#FFFFFF" />
          </View>
          <View className="flex-1">
            <Text className="font-bodySemibold text-base text-white">{nextInsight.title}</Text>
            <Text className="font-body text-xs text-white/60 mt-0.5">{nextInsight.subtitle}</Text>
          </View>
          <Icon name="chevronRight" size={18} color="rgba(255,255,255,0.5)" />
        </Pressable>

        {/* Tre veprime — vetëm ato që ndodhin disa herë në ditë */}
        <View className="flex-row px-4.5 mt-6">
          <QuickAction
            icon="spoon"
            label="Ushqyerje"
            subLabel={feedingTodayCount > 0 ? `${feedingTodayCount}x sot` : timeAgoLabel(lastFeeding?.at ?? null)}
            onPress={() => router.push("/baby/feeding")}
          />
          <QuickAction
            icon="moon"
            label="Gjumë"
            subLabel={timeAgoLabel(lastSleep?.startAt ?? null)}
            onPress={() => router.push("/baby/sleep")}
          />
          <QuickAction
            icon="diaper"
            label="Pelenë"
            subLabel={diaperTodayCount > 0 ? `${diaperTodayCount}x sot` : timeAgoLabel(lastDiaper?.at ?? null)}
            onPress={() => router.push("/baby/diaper")}
          />
        </View>

        {/* Lidhje diskrete drejt pjesës tjetër (vaksina, rritja, mjekësore...) */}
        <Pressable onPress={() => router.push("/baby")} className="items-center mt-5">
          <Text className="font-body text-xs text-ink-faint">Të gjitha kategoritë e bebit →</Text>
        </Pressable>

        {/* AI — lidhje e qetë, jo banner ngjyrë e fortë */}
        <Pressable onPress={() => router.push("/ai-chat")} className="flex-row items-center justify-center mt-8 mb-2">
          <Icon name="sparkle" size={14} color="#A79D8A" />
          <Text className="font-body text-xs text-ink-faint ml-2">Ke një pyetje? Bisedo me asistentin</Text>
        </Pressable>

        {/* Një rresht i vetëm produktesh — jo dy karuselë */}
        {(productsLoading || featuredProducts.length > 0) && (
          <>
            <View className="flex-row items-center justify-between px-6 mt-9 mb-3">
              <Text className="font-bodySemibold text-base text-ink">Për ty</Text>
              <Pressable onPress={() => router.push("/shop")}>
                <Text className="font-bodyMedium text-xs text-ink-faint">Dyqani →</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 24, paddingRight: 8 }}>
              {productsLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <View key={i} className="mr-3">
                      <ProductCardSkeleton cardWidth={140} />
                    </View>
                  ))
                : featuredProducts.map((p) => (
                    <View key={p.id} className="mr-3">
                      <ProductCard product={p} cardWidth={140} onPress={() => router.push(`/shop/${p.id}`)} />
                    </View>
                  ))}
            </ScrollView>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}