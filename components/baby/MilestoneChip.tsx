import { Pressable, View, Text, TextInput } from "react-native";
import { Icon } from "@/components/ui/Icon";
import { JiggleWrap } from "./JiggleWrap";
import { RemoveBadge } from "./RemoveBadge";

type MilestoneChipProps = {
  label: string;
  done: boolean;
  editing: boolean;
  isCustom?: boolean;
  onToggle: () => void;
  onChangeLabel?: (v: string) => void;
  onRemove: () => void;
};

export function MilestoneChip({
  label,
  done,
  editing,
  isCustom,
  onToggle,
  onChangeLabel,
  onRemove,
}: MilestoneChipProps) {
  return (
    <JiggleWrap active={editing} style={{ width: "48%" }}>
      <Pressable
        onPress={editing ? undefined : onToggle}
        className={`relative flex-row items-center gap-2 rounded-2xl border px-3 py-3 ${
          done ? "border-olive/30 bg-olive-bg" : "border-ink/10 bg-white dark:bg-ink dark:border-cream/10"
        }`}
      >
        {editing && <RemoveBadge onPress={onRemove} />}
        <View
          className={`h-5 w-5 items-center justify-center rounded-full ${done ? "" : "border border-ink/20"}`}
          style={done ? { backgroundColor: "#6E7452" } : undefined}
        >
          {done && <Icon name="check" size={12} color="#FBF6EE" />}
        </View>
        {isCustom && editing ? (
          <TextInput value={label} onChangeText={onChangeLabel} className="flex-1 font-bodyMedium text-[12.5px] text-ink" />
        ) : (
          <Text numberOfLines={1} className="flex-1 font-bodyMedium text-[12.5px] text-ink dark:text-cream">
            {label}
          </Text>
        )}
      </Pressable>
    </JiggleWrap>
  );
}
