import { View, Text, TextInput, Pressable } from "react-native";

type InfoRowProps = {
  label: string;
  value: string;
  editing: boolean;
  isCustom?: boolean;
  onChangeValue: (v: string) => void;
  onChangeLabel?: (v: string) => void;
  onRemove: () => void;
  placeholder?: string;
};

export function InfoRow({
  label,
  value,
  editing,
  isCustom,
  onChangeValue,
  onChangeLabel,
  onRemove,
  placeholder,
}: InfoRowProps) {
  return (
    <View className="flex-row items-center justify-between border-b border-ink/8 py-3 dark:border-cream/10">
      {isCustom && editing ? (
        <TextInput
          value={label}
          onChangeText={onChangeLabel}
          className="flex-1 font-body text-[13.5px] text-ink dark:text-cream"
        />
      ) : (
        <Text className="flex-1 font-body text-[13.5px] text-ink dark:text-cream">{label}</Text>
      )}
      <TextInput
        value={value}
        onChangeText={onChangeValue}
        editable={editing}
        placeholder={placeholder}
        placeholderTextColor="#A79D8A"
        textAlign="right"
        className={`font-body text-[13.5px] text-ink-soft dark:text-cream/60 ${
          editing ? "border-b border-dashed border-orange" : ""
        }`}
      />
      {editing && (
        <Pressable onPress={onRemove} hitSlop={8} className="ml-2.5 h-[22px] w-[22px] items-center justify-center rounded-full bg-[#E2604A]">
          <Text style={{ color: "#fff", fontSize: 13, lineHeight: 14 }}>×</Text>
        </Pressable>
      )}
    </View>
  );
}
