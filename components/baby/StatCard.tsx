import { View, Text, TextInput } from "react-native";
import { shadows } from "@/lib/shadows";
import { JiggleWrap } from "./JiggleWrap";
import { RemoveBadge } from "./RemoveBadge";

type StatCardProps = {
  label: string;
  value: string;
  sub?: string;
  editing: boolean;
  onChangeValue: (v: string) => void;
  onChangeLabel?: (v: string) => void;
  isCustom?: boolean;
  onRemove: () => void;
};

export function StatCard({
  label,
  value,
  sub,
  editing,
  onChangeValue,
  onChangeLabel,
  isCustom,
  onRemove,
}: StatCardProps) {
  return (
    <JiggleWrap active={editing} style={{ flex: 1 }}>
      <View style={shadows.soft} className="relative rounded-xl2 border border-ink/10 bg-white p-4 dark:bg-ink dark:border-cream/10">
        {editing && <RemoveBadge onPress={onRemove} />}
        {isCustom && editing ? (
          <TextInput
            value={label}
            onChangeText={onChangeLabel}
            className="font-bodyMedium text-[12.5px] text-ink-soft"
          />
        ) : (
          <Text className="font-bodyMedium text-[12.5px] text-ink-soft dark:text-cream/60">{label}</Text>
        )}
        <TextInput
          value={value}
          onChangeText={onChangeValue}
          editable={editing}
          className={`font-bodySemibold text-[19px] text-ink dark:text-cream ${editing ? "border-b border-dashed border-orange" : ""}`}
        />
        {sub ? <Text className="font-body text-[11.5px] text-ink-soft dark:text-cream/50">{sub}</Text> : null}
      </View>
    </JiggleWrap>
  );
}
