import { useMemo, useEffect } from "react";
import { registerForPushNotificationsAsync } from "@/lib/notifications";
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
      <Text className="font-bodySemibold text-lg text-ink">{title}</Text>
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
  todayCount,
}: {
  icon: IconName;
  label: string;
  subLabel: string;
  accent: "olive" | "orange";
  onPress: () => void;
  todayCount?: number;
}) {
  const bg = accent === "olive" ? "bg-olive-bg" : "bg-orange-bg";
  const fg = accent === "olive" ? "#6E7452" : "#C9702E";
  return (
    <Pressable
      onPress={onPress}
      style={shadows.soft}
      className="w-[47%] bg-surface rounded-xl2 p-4 mb-3"
    >
      <View className="flex-row items-start justify-between mb-3">
        <View className={`w-10 h-10 rounded-full items-center justify-center ${bg}`}>
          <Icon name={icon} size={20} color={fg} />
        </View>
        {!!todayCount && (
          <View className="bg-orange rounded-full px-2 py-0.5 min-w-[22px] items-center">
            <Text className="font-bodySemibold text-[10px] text-white">{todayCount}x sot</Text>
          </View>
        )}
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
        <Text className="font-bodyMedium text-[10px] text-orange mb-1 uppercase">{product.badge}</Text>
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

  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

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

  // Numri i ngjarjeve të sotme — përdoret si badge "Xx sot" brenda kartave të Kujtesave
  // (rubrika e veçantë "Sot" u bashkua këtu — ndryshim #3)
  const feedingTodayCount = useMemo(
    () => active(baby.feedingLog).filter((f) => f.type !== "medicine" && isToday(f.at)).length,
    [baby.feedingLog]
  );
  const sleepTodayCount = useMemo(
    () => active(baby.sleepLog).filter((s) => isToday(s.startAt)).length,
    [baby.sleepLog]
  );
  const diaperTodayCount = useMemo(
    () => active(baby.diaperLog).filter((d) => isToday(d.at)).length,
    [baby.diaperLog]
  );
  const medicineTodayCount = useMemo(
    () => active(baby.feedingLog).filter((f) => f.type === "medicine" && isToday(f.at)).length,
    [baby.feedingLog]
  );

  const growthInsight = useMemo(() => {
    const history = active(baby.growthHistory).slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (history.length < 2) return null;
    const [latest, prev] = history;
    const weightDiff = latest.weightKg != null && prev.weightKg != null ? latest.weightKg - prev.weightKg : null;
    const heightDiff = latest.heightCm != null && prev.heightCm != null ? latest.heightCm - prev.heightCm : null;
    return { latest, weightDiff, heightDiff };
  }, [baby.growthHistory]);

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

        {/* Quick actions — RUBRIKA E PARË në homepage (ndryshim #1) */}
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

        {/* AI Chat entry point — RUBRIKA E DYTË (ndryshim #2) */}
        <View className="px-5 mt-7">
          <Pressable
            onPress={() => router.push("/ai-chat")}
            style={shadows.softLg}
            className="bg-olive rounded-xl3 p-4 flex-row items-center"
          >
            <View className="w-11 h-11 rounded-full bg-surface items-center justify-center mr-3">
              <Icon name="sparkle" size={20} color="#6E7452" />
            </View>
            <View className="flex-1">
              <Text className="font-bodyMedium text-base text-white">Bisedo me AI</Text>
              <Text className="font-body text-xs text-white/80">Pyet çdo gjë rreth bebit tënd</Text>
            </View>
            <Icon name="chevronRight" size={20} color="#FFFFFF" />
          </Pressable>
        </View>

        {/* Reminders — "Sot" tani është e bashkuar këtu si badge "Xx sot" (ndryshim #3) */}
        <SectionHeader title="Kujtesat" />
        <View className="px-5 flex-row flex-wrap justify-between">
          <ReminderCard
            icon="spoon"
            label="Ushqyerje"
            subLabel={timeAgoLabel(lastFeeding?.at ?? null)}
            accent="orange"
            todayCount={feedingTodayCount}
            onPress={() => router.push("/baby/feeding")}
          />
          <ReminderCard
            icon="moon"
            label="Gjumë"
            subLabel={timeAgoLabel(lastSleep?.startAt ?? null)}
            accent="olive"
            todayCount={sleepTodayCount}
            onPress={() => router.push("/baby/sleep")}
          />
          <ReminderCard
            icon="baby"
            label="Pelenë"
            subLabel={timeAgoLabel(lastDiaper?.at ?? null)}
            accent="orange"
            todayCount={diaperTodayCount}
            onPress={() => router.push("/baby/diaper")}
          />
          <ReminderCard
            icon="pill"
            label="Ilaç"
            subLabel={timeAgoLabel(lastMedicine?.at ?? null)}
            accent="olive"
            todayCount={medicineTodayCount}
            onPress={() => router.push("/baby/feeding")}
          />
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

        {/* --- Shop section — RUBRIKA MENJËHERË PAS KUJTESAVE (ndryshim #5) --- */}
        <SectionHeader title="Vazhdo blerjen" onSeeAll={() => router.push("/shop")} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingLeft: 20, paddingRight: 8 }}>
          {productCatalog.slice(0, 5).map((p) => (
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