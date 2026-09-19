import { View, Text, Pressable } from "react-native";
import { Icon, type IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useThemeColors } from "@/lib/theme/useThemeColors";

/**
 * Shënimi me një prekje.
 *
 * Një ushqyerje ndodh 8–12 herë në ditë dhe një pelenë po aq. Formulari me
 * gjashtë fusha — lloji, ana, kohëzgjatja, sasia, data, shënimi — është i
 * saktë por i papërdorshëm në orën tre të natës: prindi thjesht nuk e
 * shënon, dhe app-i mbetet bosh.
 *
 * Prandaj këtu shënohet ME NJË PREKJE, me kohën e tanishme dhe llojin që
 * zgjedh. Detajet mbeten te formulari i plotë, për kë i do — por nuk janë
 * kusht për të mbajtur historikun.
 *
 * Pas çdo shënimi vjen një njoftim me "Zhbëj": gabimi me një prekje
 * ndreqet po me një prekje.
 */

export type QuickAction = {
  key: string;
  label: string;
  /** Rreshti i dytë, p.sh. sasia e fundit e përdorur. */
  sub?: string;
  icon: IconName;
  onPress: () => void;
};

export function QuickLog({ title, actions }: { title: string; actions: QuickAction[] }) {
  const theme = useThemeColors();

  return (
    <View className="mb-5">
      <Text className="font-bodyMedium text-xs text-ink-faint uppercase mb-2">{title}</Text>
      <View className="flex-row" style={{ gap: 10 }}>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            onPress={() => {
              haptics.tap();
              action.onPress();
            }}
            accessibilityRole="button"
            accessibilityLabel={action.label}
            style={shadows.soft}
            className="flex-1 items-center rounded-xl2 bg-surface py-4 active:opacity-70"
          >
            <Icon name={action.icon} size={22} color={theme.inkSoft} />
            <Text className="font-bodyMedium text-[13px] text-ink mt-2 text-center" numberOfLines={1}>
              {action.label}
            </Text>
            {action.sub ? (
              <Text className="font-body text-[10px] text-ink-faint mt-0.5" numberOfLines={1}>
                {action.sub}
              </Text>
            ) : null}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/**
 * Sasitë e zakonshme të shishes, si copëza. E fundit e përdorur del e para,
 * sepse prindi zakonisht jep të njëjtën sasi disa ditë me radhë.
 */
export function AmountChips({
  amounts, lastUsed, onPick, label,
}: {
  amounts: number[];
  lastUsed: number | null;
  onPick: (ml: number) => void;
  label: string;
}) {
  const ordered = lastUsed != null
    ? [lastUsed, ...amounts.filter((a) => a !== lastUsed)]
    : amounts;

  return (
    <View className="mb-5">
      <Text className="font-bodyMedium text-xs text-ink-faint uppercase mb-2">{label}</Text>
      <View className="flex-row flex-wrap" style={{ gap: 8 }}>
        {ordered.map((ml) => (
          <Pressable
            key={ml}
            onPress={() => {
              haptics.tap();
              onPick(ml);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${ml} ml`}
            className={`rounded-full px-4 py-2.5 ${ml === lastUsed ? "bg-ink" : "bg-cream-soft"}`}
          >
            <Text className={`font-bodyMedium text-sm ${ml === lastUsed ? "text-on-accent" : "text-ink"}`}>
              {ml} ml
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
