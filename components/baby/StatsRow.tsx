import { View, Text } from "react-native";
import { shadows } from "@/lib/shadows";

type Stat = { label: string; value: string };

export function StatsRow({ stats }: { stats: Stat[] }) {
  return (
    <View className="mb-4 flex-row gap-2.5">
      {stats.map((s) => (
        <View key={s.label} style={shadows.press} className="flex-1 rounded-xl2 border border-ink/10 bg-white px-3 py-3">
          <Text className="font-bodySemibold text-[16px] text-ink">{s.value}</Text>
          <Text className="mt-0.5 font-body text-[10.5px] text-ink-soft" numberOfLines={1}>
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
