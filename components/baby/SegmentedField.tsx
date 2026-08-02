import { View, Text, Pressable } from "react-native";
import { Icon, IconName } from "@/components/ui/Icon";
import { haptics } from "@/lib/haptics";

type Option<T extends string> = { value: T; label: string; icon?: IconName };

type SegmentedFieldProps<T extends string> = {
  label?: string;
  options: Option<T>[];
  value: T;
  onChange: (v: T) => void;
};

export function SegmentedField<T extends string>({ label, options, value, onChange }: SegmentedFieldProps<T>) {
  return (
    <View className="gap-1.5">
      {label && <Text className="font-bodyMedium text-[12.5px] text-ink-soft">{label}</Text>}
      <View className="flex-row flex-wrap gap-2">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                haptics.select();
                onChange(opt.value);
              }}
              className={`flex-row items-center gap-1.5 rounded-xl border px-3.5 py-2.5 ${
                active ? "border-ink bg-ink" : "border-ink/10 bg-white"
              }`}
            >
              {opt.icon && <Icon name={opt.icon} size={14} color={active ? "#FBF6EE" : "#2C271F"} />}
              <Text className={`font-bodyMedium text-[12.5px] ${active ? "text-cream" : "text-ink"}`}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
