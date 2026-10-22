import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import {
  BadgeCheck, BookOpen, ChartColumn, ChevronRight, ExternalLink, Flag, Layers, Megaphone, Package, Receipt, Store, Tags, Wallet, type LucideIcon,
} from "lucide-react-native";
import { AdminScreen, ErrorNote, Kpi, Loading, SectionTitle, useAdminData } from "@/components/admin/AdminUI";
import { IconTile, TILE_COLORS as C } from "@/components/settings/IconTile";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { fetchDashboard } from "@/lib/admin/api";
import { change, eur } from "@/lib/admin/labels";
import { WEB_BASE_URL } from "@/lib/support";

type Entry = { key: string; icon: LucideIcon; color: string; label: string; count?: number; onPress: () => void };

/**
 * Paneli i adminit në app: pasqyra e shitjeve, çfarë pret veprim, dhe pjesët e panelit. Punët e përditshme bëhen
 * këtu; ato që duan ekran të madh (produkt i ri me foto, analitika, markat, njoftimi për ofertë) hapen te paneli i
 * webit.
 */
export default function AdminHome() {
  const router = useRouter();
  const theme = useThemeColors();
  const { data, error, refreshing, pull } = useAdminData(fetchDashboard, []);

  const go = (path: string, params?: Record<string, string>) => router.push({ pathname: path as never, params });
  const web = (path: string) => void WebBrowser.openBrowserAsync(`${WEB_BASE_URL}/admin${path}`).catch(() => {});

  const daily: Entry[] = [
    { key: "orders", icon: Receipt, color: C.orange, label: "Porositë", count: data?.pendingOrders, onPress: () => go("/more/admin/orders", data?.pendingOrders ? { status: "pending" } : undefined) },
    { key: "requests", icon: Layers, color: C.purple, label: "Produkte për aprovim", count: data?.pendingProducts, onPress: () => go("/more/admin/requests") },
    { key: "products", icon: Package, color: C.blue, label: "Produktet", onPress: () => go("/more/admin/products") },
    { key: "experts", icon: BadgeCheck, color: C.teal, label: "Ekspertët", count: data?.pendingExperts, onPress: () => go("/more/admin/experts") },
    { key: "reports", icon: Flag, color: C.red, label: "Raportimet", count: data?.openReports, onPress: () => go("/more/admin/reports") },
    { key: "stories", icon: BookOpen, color: C.green, label: "Përrallat", count: data?.storyDrafts, onPress: () => go("/more/admin/stories") },
    { key: "partners", icon: Store, color: C.green, label: "Partnerët", count: data?.pendingPartners, onPress: () => go("/more/admin/partners") },
    { key: "payouts", icon: Wallet, color: C.indigo, label: "Pagesat e partnerëve", onPress: () => go("/more/admin/payouts") },
  ];
  const onWeb: Entry[] = [
    { key: "new", icon: Package, color: C.gray, label: "Produkt i ri (me foto)", onPress: () => web("/products/new") },
    { key: "analytics", icon: ChartColumn, color: C.gray, label: "Analitika", onPress: () => web("/analytics") },
    { key: "catalog", icon: Tags, color: C.gray, label: "Marka dhe kategori", onPress: () => web("/catalog") },
    { key: "offers", icon: Megaphone, color: C.gray, label: "Njoftim për ofertë", onPress: () => web("/offers") },
  ];

  return (
    <AdminScreen title="Paneli i adminit" subtitle="Shitjet e 30 ditëve dhe ato që presin ty." fallback="/(main)/more" refreshing={refreshing} onRefresh={pull}>
      <ErrorNote message={error} />
      {!data && !error ? <Loading /> : null}
      {data ? (
        <>
          <View className="mb-3 flex-row gap-3">
            <Kpi label="Qarkullimi, 30 ditë" value={eur(data.revenue30)} delta={change(data.revenue30, data.revenuePrev30)} />
            <Kpi label="Porosi, 30 ditë" value={String(data.orders30)} delta={change(data.orders30, data.ordersPrev30)} />
          </View>
          <View className="flex-row gap-3">
            <Kpi label="Shporta mesatare" value={eur(data.avgOrder30)} />
            <Kpi label="Anuluar, 30 ditë" value={`${data.cancelled30} (${data.cancelledPct30}%)`} />
          </View>
        </>
      ) : null}

      <SectionTitle>Puna e përditshme</SectionTitle>
      <Menu entries={daily} chevron={theme.inkFaint} />

      <SectionTitle>Në panelin e webit</SectionTitle>
      <Menu entries={onWeb} chevron={theme.inkFaint} external />

      {data && data.top.length > 0 ? (
        <>
          <SectionTitle>Produktet që shiten më shumë</SectionTitle>
          <View className="overflow-hidden rounded-2xl border border-cream-line bg-surface">
            {data.top.map((p, i) => (
              <View key={p.id} className={`flex-row items-center px-4 py-3 ${i < data.top.length - 1 ? "border-b border-cream-line" : ""}`}>
                <Text className="mr-3 w-5 font-bodySemibold text-[13px] text-ink-faint">{i + 1}</Text>
                <Text className="flex-1 font-bodyMedium text-sm text-ink" numberOfLines={1}>{p.name}</Text>
                <Text className="ml-3 font-body text-xs text-ink-soft">{p.units} copë</Text>
                <Text className="ml-3 font-bodySemibold text-sm text-ink">{eur(p.revenue)}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </AdminScreen>
  );
}

function Menu({ entries, chevron, external = false }: { entries: Entry[]; chevron: string; external?: boolean }) {
  return (
    <View className="overflow-hidden rounded-2xl border border-cream-line bg-surface">
      {entries.map((e, i) => (
        <Pressable
          key={e.key}
          onPress={e.onPress}
          accessibilityRole="button"
          accessibilityLabel={e.count ? `${e.label}, ${e.count} presin` : e.label}
          className={`flex-row items-center px-4 py-3 active:opacity-70 ${i < entries.length - 1 ? "border-b border-cream-line" : ""}`}
        >
          <IconTile icon={e.icon} color={e.color} />
          <Text className="ml-3 flex-1 font-bodyMedium text-[15px] text-ink">{e.label}</Text>
          {e.count ? (
            <View className="mr-2 min-w-[24px] items-center rounded-full px-2 py-0.5" style={{ backgroundColor: C.red }}>
              <Text className="font-bodySemibold text-[12px] text-white">{e.count}</Text>
            </View>
          ) : null}
          {external ? <ExternalLink size={16} color={chevron} strokeWidth={2} /> : <ChevronRight size={18} color={chevron} strokeWidth={2} />}
        </Pressable>
      ))}
    </View>
  );
}
