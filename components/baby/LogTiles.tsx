import { useEffect, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { MotiView } from "moti";
import { Icon, type IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { sinceLabel } from "@/lib/baby/dayStats";
import { useTranslation } from "@/lib/i18n/LanguageContext";

/** Ngjyra e një lloji shënimi: e ngopura për ikonën/tekstin, e buta për sfondin. */
export type Tone = { tint: string; tintBg: string };

/** E njëjta familje ngjyrash si kartat e rritjes, që ekranet të duken një sistem. */
export const TONES = {
  pink: { tint: "#B8336A", tintBg: "#F6DCE7" },
  blue: { tint: "#2E6FA8", tintBg: "#D9E7F2" },
  green: { tint: "#4E7A2E", tintBg: "#E1EBD5" },
  amber: { tint: "#9A6415", tintBg: "#F3E4C8" },
  purple: { tint: "#7A3596", tintBg: "#E7DAEF" },
  orange: { tint: "#B23A1C", tintBg: "#F3DCCF" },
} satisfies Record<string, Tone>;

/**
 * Karta lart: vetëm pyetja që prindi bën vërtet ("sa kohë ka kaluar?"), me
 * numrin e madh. Rifreskohet çdo minutë.
 */
export function SinceHero({
  title,
  lastAt,
  emptyText,
  detail,
  icon,
  tone,
}: {
  title: string;
  lastAt: string | null;
  emptyText: string;
  detail?: string;
  icon: IconName;
  tone: Tone;
}) {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const since = sinceLabel(lastAt, t, now);

  return (
    <View style={[shadows.soft, { backgroundColor: tone.tintBg }]} className="mb-5 rounded-xl3 p-5">
      <View className="flex-row items-center gap-2">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-surface">
          <Icon name={icon} size={16} color={tone.tint} />
        </View>
        <Text className="font-bodySemibold text-[13px]" style={{ color: tone.tint }}>
          {title}
        </Text>
      </View>
      <Text className="mt-3 font-display text-[34px] leading-[40px] text-ink">{since ?? "—"}</Text>
      <Text className="mt-1 font-body text-[13px] text-ink-soft">{since ? detail : emptyText}</Text>
    </View>
  );
}

/**
 * Pllakë e madhe me ngjyrë: një prekje = një shënim, me kohën e tanishme.
 * `selected` e mban të theksuar kur pllaka hap një zgjedhje të dytë (p.sh.
 * sasia e shishes).
 */
export function LogTile({
  label,
  sub,
  icon,
  tone,
  onPress,
  selected,
}: {
  label: string;
  sub?: string;
  icon: IconName;
  tone: Tone;
  onPress: () => void;
  selected?: boolean;
}) {
  return (
    <Pressable
      onPress={() => {
        haptics.tap();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={sub ? `${label}, ${sub}` : label}
      style={[shadows.soft, { backgroundColor: selected ? tone.tint : tone.tintBg, flex: 1, minHeight: 112 }]}
      className="justify-between rounded-xl3 p-4 active:opacity-80"
    >
      <View
        className="h-11 w-11 items-center justify-center rounded-full"
        style={{ backgroundColor: selected ? "rgba(255,255,255,0.22)" : "#FFFFFF" }}
      >
        <Icon name={icon} size={20} color={selected ? "#FFFFFF" : tone.tint} />
      </View>
      <View className="mt-3">
        <Text className="font-bodySemibold text-[15px]" style={{ color: selected ? "#FFFFFF" : "#2C271F" }} numberOfLines={1}>
          {label}
        </Text>
        {sub ? (
          <Text className="font-body text-[12px]" style={{ color: selected ? "rgba(255,255,255,0.85)" : tone.tint }} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Sasitë e shishes, që dalin vetëm pasi prindi prek "Shishe". */
export function AmountRow({
  amounts,
  lastUsed,
  tone,
  onPick,
}: {
  amounts: number[];
  lastUsed: number | null;
  tone: Tone;
  onPick: (ml: number) => void;
}) {
  const ordered = lastUsed != null ? [lastUsed, ...amounts.filter((a) => a !== lastUsed)] : amounts;
  return (
    <MotiView
      from={{ opacity: 0, translateY: -6 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: "timing", duration: 180 }}
      className="mt-3 flex-row flex-wrap"
      style={{ gap: 8 }}
    >
      {ordered.map((ml) => (
        <Pressable
          key={ml}
          onPress={() => {
            haptics.tap();
            onPick(ml);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${ml} ml`}
          className="rounded-full px-5 py-3"
          style={{ backgroundColor: ml === lastUsed ? tone.tint : tone.tintBg }}
        >
          <Text className="font-bodySemibold text-[15px]" style={{ color: ml === lastUsed ? "#FFFFFF" : tone.tint }}>
            {ml} ml
          </Text>
        </Pressable>
      ))}
    </MotiView>
  );
}

/** Rreshti i historikut me ikonën në ngjyrën e llojit. */
export function LogRow({
  title,
  detail,
  icon,
  tone,
  onPress,
}: {
  title: string;
  detail: string;
  icon: IconName;
  tone: Tone;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={shadows.press}
      className="mb-2.5 flex-row items-center gap-3 rounded-xl2 border border-ink/10 bg-surface p-3.5 active:opacity-80"
    >
      <View className="h-10 w-10 items-center justify-center rounded-xl" style={{ backgroundColor: tone.tintBg }}>
        <Icon name={icon} size={17} color={tone.tint} />
      </View>
      <View className="flex-1">
        <Text className="font-bodySemibold text-[14px] text-ink">{title}</Text>
        <Text className="font-body text-xs text-ink-soft" numberOfLines={1}>
          {detail}
        </Text>
      </View>
      <Icon name="chevronRight" size={16} color="#A79D8A" />
    </Pressable>
  );
}
