import { Pressable, Text, View } from "react-native";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { dueMonthOptions, type DueMonth } from "@/lib/babyProfile";

const same = (a: DueMonth | null, b: DueMonth) => !!a && a.year === b.year && a.month === b.month;

/**
 * "Në cilin muaj pritet bebi?": ky muaj dhe 9 të ardhshmit si pllaka (muaji sipër, viti poshtë), tre për rresht.
 * Vetëm muaji: askush s'e di ditën e saktë (`dueFromMonth` merr mesin e muajit).
 */
export function DueMonthPicker({ value, onChange, now }: { value: DueMonth | null; onChange: (m: DueMonth) => void; now?: Date }) {
  const { t } = useTranslation();
  const names = t("diary_months").split(",");
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} accessibilityRole="radiogroup">
      {dueMonthOptions(now).map((m) => {
        const on = same(value, m);
        return (
          <Pressable
            key={`${m.year}-${m.month}`}
            onPress={() => {
              haptics.tap();
              onChange(m);
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${names[m.month]} ${m.year}`}
            style={{ width: "31.5%", alignItems: "center", paddingVertical: 10, borderRadius: 14, borderWidth: 1 }}
            className={on ? "border-olive bg-olive" : "border-cream-line bg-surface"}
          >
            <Text className={`font-bodySemibold text-[14px] ${on ? "text-on-accent" : "text-ink"}`}>{names[m.month]}</Text>
            <Text className={`font-body text-[12px] ${on ? "text-on-accent" : "text-ink-faint"}`}>{m.year}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
