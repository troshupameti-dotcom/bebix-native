import { useMemo } from "react";
import { View, Text, ScrollView, Pressable, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppState, active } from "@/lib/state/AppStateContext";
import { Icon, IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
// ⚠️ Rregullo këtë import nëse skedari yt me productCatalog/articleCatalog
// ndodhet diku tjetër (p.sh. "@/lib/state/shopTypes"):
import { productCatalog, articleCatalog, initialNotifications, Product } from "@/lib/homeContent";

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

function timeOfDay(iso: string): string {
  return new Date(iso).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" });
}

function isToday(iso: string): boolean {
  const d = new Date(iso);
  const n = new Date();
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
}

// ---------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------

function SectionHeader({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  return (
    <View className="flex-row items-center justify-between mb-3 mt-7 px-5">
      <Text className="font-display text-lg text-ink">{title}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll}>
          <Text className="font-bodyMedium text-sm text-olive">Shiko të gjitha</Text>
        </Pressable>
      )}
    </View>
  );
}

function ReminderCard({
  icon,
  label,
  subLabel,
  accent,
  onPress,
}: {
  icon: IconName;
  label: string;
  subLabel: string;
  accent: "olive" | "orange";
  onPress: () => void;
}) {
  const bg = accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = accent === "olive" ? "#6E7452" : "#C9702E";
  return (
    <Pressable
      onPress={onPress}
      style={shadows.soft}
      className="w-[47%] bg-surface rounded-xl2 p-4 mb-3"
    >
      <View className={`w-10 h-10 rounded-full items-center justify-center mb-3 ${bg}`}>
        <Icon name={icon} size={20} color={fg} />
      </View>
      <Text className="font-bodySemibold text-sm text-ink mb-1">{label}</Text>
      <Text className="font-body text-xs text-ink-soft">{subLabel}</Text>
    </Pressable>
  );
}

function QuickAction({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="items-center w-[22%] mb-4">
      <View style={shadows.soft} className="w-14 h-14 rounded-xl2 bg-surface items-center justify-center mb-2">
        <Icon name={icon} size={22} color="#6E7452" />
      </View>
      <Text className="font-body text-xs text-ink-soft text-center" numberOfLines={2}>
        {label}
      </Text>
    </Pressable>
  );
}

function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const bg = product.accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = product.accent === "olive" ? "#6E7452" : "#C9702E";
  return (
    <Pressable onPress={onPress} style={shadows.soft} className="w-36 bg-surface rounded-xl2 p-3 mr-3">
      <View className={`w-full h-20 rounded-xl items-center justify-center mb-2 ${bg}`}>
        <Icon name={product.icon} size={26} color={fg} />
      </View>
      {product.badge && (
        <Text className="font-bodySemibold text-[10px] text-orange mb-1 uppercase">{product.badge}</Text>
      )}
      <Text className="font-bodyMedium text-xs text-ink mb-1" numberOfLines={2}>
        {product.name}
      </Text>
      <Text className="font-bodySemibold text-sm text-ink">€{product.price.toFixed(2)}</Text>
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

  const displayName = profile.nickname || profile.babyName || "bebi";
  const unreadCount = initialNotifications.filter((n) => !n.read).length;

  const lastFeeding = active(baby.feedingLog)[0] ?? null;
  const lastSleep = active(baby.sleepLog)[0] ?? null;
  const lastDiaper = active(baby.diaperLog)[0] ?? null;
  const lastMedicine = active(baby.feedingLog).find((f) => f.type === "medicine") ?? null;

  const nextVaccine = useMemo(() => {
    const list = active(baby.vaccines).filter((v) => !v.givenDate);
    return list.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0] ?? null;
  }, [baby.vaccines]);

  const todayItems = useMemo(() => {
    type Item = { id: string; icon: IconName; label: string; at: string };
    const items: Item[] = [];
    active(baby.feedingLog).forEach((f) => isToday(f.at) && items.push({ id: `f-${f.id}`, icon: "spoon", label: "Ushqyerje", at: f.at }));
    active(baby.sleepLog).forEach((s) => isToday(s.startAt) && items.push({ id: `s-${s.id}`, icon: "moon", label: s.isNap ? "Gjumë ditor" : "Gjumë nate", at: s.startAt }));
    active(baby.diaperLog).forEach((d) => isToday(d.at) && items.push({ id: `d-${d.id}`, icon: "baby", label: "Ndërrim pelene", at: d.at }));
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [baby.feedingLog, baby.sleepLog, baby.diaperLog]);

  const growthInsight = useMemo(() => {
    const history = active(baby.growthHistory).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (history.length < 2) return null;
    const [latest, prev] = history;
    const weightDiff = latest.weightKg != null && prev.weightKg != null ? latest.weightKg - prev.weightKg : null;
    const heightDiff = latest.heightCm != null && prev.heightCm != null ? latest.heightCm - prev.heightCm : null;
    return { latest, weightDiff, heightDiff };
  }, [baby.growthHistory]);

  const aiInsight = useMemo(() => {
    const feedings = active(baby.feedingLog).slice(0, 6);
    if (feedings.length < 2) {
      return "Regjistro pak ushqyerje dhe gjumë sot — sa më shumë të dhëna, aq më të sakta bëhen këshillat këtu.";
    }
    const gaps: number[] = [];
    for (let i = 0; i < feedings.length - 1; i++) {
      gaps.push((new Date(feedings[i].at).getTime() - new Date(feedings[i + 1].at).getTime()) / 3600000);
    }
    const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    return `${displayName} është ushqyer mesatarisht çdo ${avg.toFixed(1)} orë kohët e fundit. Kjo është brenda rangut normal për moshën e tij/saj.`;
  }, [baby.feedingLog, displayName]);

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header / Greeting */}
        <View className="flex-row items-center justify-between px-5 pt-2 mb-5">
          <View>
            <Text className="font-body text-sm text-ink-soft">{greetingWord()},</Text>
            <Text className="font-display text-2xl text-ink">Familja e {displayName}s 👋</Text>
          </View>
          <Pressable
            onPress={() => router.push("/notifications")}
            style={shadows.soft}
            className="w-11 h-11 rounded-full bg-surface items-center justify-center"
          >
            <Icon name="bell" size={20} color="#2C271F" />
            {unreadCount > 0 && (
              <View className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-orange items-center justify-center">
                <Text className="text-white text-[10px] font-bodySemibold">{unreadCount}</Text>
              </View>
            )}
          </Pressable>
        </View>

        {/* Baby profile card */}
        <Pressable
          onPress={() => router.push("/baby")}
          style={shadows.softLg}
          className="mx-5 bg-surface rounded-xl3 p-4 flex-row items-center"
        >
          <View className="w-16 h-16 rounded-full bg-olive-bg items-center justify-center overflow-hidden mr-4">
            {profile.babyPhoto ? (
              <Image source={{ uri: profile.babyPhoto }} className="w-16 h-16" />
            ) : (
              <Icon name="baby" size={28} color="#6E7452" />
            )}
          </View>
          <View className="flex-1">
            <Text className="font-bodySemibold text-base text-ink">{profile.babyName || "Shto emrin e bebit"}</Text>
            <Text className="font-body text-sm text-ink-soft">{profile.babyDob ? ageLabel(profile.babyDob) : "Plotëso profilin për të filluar"}</Text>
          </View>
          <Icon name="chevronRight" size={20} color="#A79D8A" />
        </Pressable>

        {/* Today's schedule */}
        <SectionHeader title="Sot" onSeeAll={() => router.push("/baby")} />
        <View className="px-5">
          {todayItems.length === 0 ? (
            <View style={shadows.soft} className="bg-surface rounded-xl2 p-4">
              <Text className="font-body text-sm text-ink-soft">Ende s'ka regjistrime sot — shto ushqyerjen, gjumin ose pelenën e parë.</Text>
            </View>
          ) : (
            todayItems.slice(0, 4).map((item) => (
              <View key={item.id} style={shadows.soft} className="flex-row items-center bg-surface rounded-xl2 p-3 mb-2">
                <View className="w-9 h-9 rounded-full bg-cream-soft items-center justify-center mr-3">
                  <Icon name={item.icon} size={16} color="#6E7452" />
                </View>
                <Text className="font-bodyMedium text-sm text-ink flex-1">{item.label}</Text>
                <Text className="font-body text-xs text-ink-faint">{timeOfDay(item.at)}</Text>
              </View>
            ))
          )}
        </View>

        {/* Reminders */}
        <SectionHeader title="Kujtesat" />
        <View className="px-5 flex-row flex-wrap justify-between">
          <ReminderCard icon="spoon" label="Ushqyerje" subLabel={timeAgoLabel(lastFeeding?.at ?? null)} accent="orange" onPress={() => router.push("/baby/feeding")} />
          <ReminderCard icon="moon" label="Gjumë" subLabel={timeAgoLabel(lastSleep?.startAt ?? null)} accent="olive" onPress={() => router.push("/baby/sleep")} />
          <ReminderCard icon="baby" label="Pelenë" subLabel={timeAgoLabel(lastDiaper?.at ?? null)} accent="orange" onPress={() => router.push("/baby/diaper")} />
          <ReminderCard icon="pill" label="Ilaç" subLabel={timeAgoLabel(lastMedicine?.at ?? null)} accent="olive" onPress={() => router.push("/baby/feeding")} />
          <ReminderCard
            icon="syringe"
            label="Vaksinë"
            subLabel={nextVaccine ? `${nextVaccine.name}` : "Asnjë e planifikuar"}
            accent="orange"
            onPress={() => router.push("/baby/vaccinations")}
          />
          <ReminderCard
            icon="chart"
            label="Rritja"
            subLabel={growthInsight?.latest ? `Përditësuar ${timeAgoLabel(growthInsight.latest.date)}` : "Shto matje"}
            accent="olive"
            onPress={() => router.push("/baby/growth")}
          />
        </View>

        {/* AI Insight of the Day */}
        <SectionHeader title="Këshilla e ditës" />
        <View className="mx-5 bg-olive-bg rounded-xl3 p-4 flex-row" style={shadows.soft}>
          <View className="w-9 h-9 rounded-full bg-surface items-center justify-center mr-3">
            <Icon name="sparkle" size={18} color="#6E7452" />
          </View>
          <Text className="font-body text-sm text-ink flex-1 leading-5">{aiInsight}</Text>
        </View>

        {/* Weekly growth summary */}
        {growthInsight && (
          <>
            <SectionHeader title="Përmbledhja e rritjes" onSeeAll={() => router.push("/baby/growth")} />
            <View className="mx-5 flex-row" style={shadows.soft}>
              <View className="flex-1 bg-surface rounded-xl2 p-4 mr-2">
                <Text className="font-body text-xs text-ink-soft mb-1">Peshë</Text>
                <Text className="font-display text-lg text-ink">{growthInsight.latest.weightKg ?? "–"} kg</Text>
                {growthInsight.weightDiff != null && (
                  <Text className="font-bodyMedium text-xs text-olive mt-1">
                    {growthInsight.weightDiff >= 0 ? "+" : ""}
                    {growthInsight.weightDiff.toFixed(1)} kg
                  </Text>
                )}
              </View>
              <View className="flex-1 bg-surface rounded-xl2 p-4 ml-2">
                <Text className="font-body text-xs text-ink-soft mb-1">Gjatësi</Text>
                <Text className="font-display text-lg text-ink">{growthInsight.latest.heightCm ?? "–"} cm</Text>
                {growthInsight.heightDiff != null && (
                  <Text className="font-bodyMedium text-xs text-olive mt-1">
                    {growthInsight.heightDiff >= 0 ? "+" : ""}
                    {growthInsight.heightDiff.toFixed(1)} cm
                  </Text>
                )}
              </View>
            </View>
          </>
        )}

        {/* Quick actions */}
        <SectionHeader title="Veprime të shpejta" />
        <View className="px-5 flex-row flex-wrap justify-between">
          <QuickAction icon="spoon" label="Ushqyerje" onPress={() => router.push("/baby/feeding")} />
          <QuickAction icon="moon" label="Gjumë" onPress={() => router.push("/baby/sleep")} />
          <QuickAction icon="baby" label="Pelenë" onPress={() => router.push("/baby/diaper")} />
          <QuickAction icon="chart" label="Rritja" onPress={() => router.push("/baby/growth")} />
          <QuickAction icon="syringe" label="Vaksina" onPress={() => router.push("/baby/vaccinations")} />
          <QuickAction icon="camera" label="Momente" onPress={() => router.push("/baby/moments")} />
          <QuickAction icon="shield" label="Mjekësore" onPress={() => router.push("/baby/medical")} />
          <QuickAction icon="cart" label="Dyqan" onPress={() => router.push("/shop")} />
        </View>

        {/* --- Shop section (të dhëna shembull — Shop-i real ende s'ekziston) --- */}
        <SectionHeader title="Vazhdo blerjen" onSeeAll={() => router.push("/shop")} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 8 }}>
          {productCatalog.slice(0, 5).map((p) => (
            <ProductCard key={p.id} product={p} onPress={() => router.push("/shop")} />
          ))}
        </ScrollView>

        <SectionHeader title="Shikuar së fundi" onSeeAll={() => router.push("/shop")} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 8 }}>
          {productCatalog.slice(3, 7).map((p) => (
            <ProductCard key={p.id} product={p} onPress={() => router.push("/shop")} />
          ))}
        </ScrollView>

        <SectionHeader title="Rekomanduar për ty" onSeeAll={() => router.push("/shop")} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 8 }}>
          {productCatalog.slice(6, 10).map((p) => (
            <ProductCard key={p.id} product={p} onPress={() => router.push("/shop")} />
          ))}
        </ScrollView>

        {/* Active orders / delivery tracking — placeholder deri sa të ketë backend porosish */}
        <SectionHeader title="Porositë aktive" />
        <View className="mx-5 bg-surface rounded-xl2 p-4 items-center" style={shadows.soft}>
          <Icon name="cube" size={24} color="#A79D8A" />
          <Text className="font-body text-sm text-ink-soft mt-2 text-center">
            Ende s'ke porosi aktive. Kur të bësh një blerje, gjurmimi i dërgesës do të shfaqet këtu.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
