import { View, Text, TextInput, Pressable } from "react-native";
import { Icon, type IconName } from "@/components/ui/Icon";

type InfoRowProps = {
  label: string;
  value: string;
  editing: boolean;
  isCustom?: boolean;
  /** Çelësi i rreshtit (blood, allergies, doctor, ...): zgjedh ikonën. */
  rowKey?: string;
  onChangeValue: (v: string) => void;
  onChangeLabel?: (v: string) => void;
  onRemove: () => void;
  placeholder?: string;
};

const ROW_ICONS: Record<string, IconName> = {
  blood: "heart",
  rh: "heart",
  allergies: "shield",
  doctor: "user",
  birth_weight: "chart",
};

/**
 * Rresht i të dhënave mjekësore, në të njëjtën pamje si kontaktet e emergjencës: rreth me ikonë, titulli i vogël
 * sipër dhe vlera e trashë poshtë (emri i ekranit nuk del më majtas me vlerën krejt djathtas).
 */
export function InfoRow({ label, value, editing, isCustom, rowKey, onChangeValue, onChangeLabel, onRemove, placeholder }: InfoRowProps) {
  const icon = (rowKey && ROW_ICONS[rowKey]) || "shield";
  return (
    <View className="flex-row items-center border-b border-ink/8 py-3">
      <View className="mr-3 h-9 w-9 items-center justify-center rounded-full bg-olive-bg">
        <Icon name={icon} size={16} color="#6E7452" />
      </View>
      <View className="flex-1">
        {isCustom && editing ? (
          <TextInput value={label} onChangeText={onChangeLabel} className="font-body text-xs text-ink-soft" />
        ) : (
          <Text className="font-body text-xs text-ink-soft">{label}</Text>
        )}
        <TextInput
          value={value}
          onChangeText={onChangeValue}
          editable={editing}
          placeholder={editing ? placeholder : "—"}
          placeholderClassName="text-ink-faint"
          className={`py-0.5 font-bodySemibold text-[13.5px] text-ink ${editing ? "border-b border-dashed border-orange" : ""}`}
        />
      </View>
      {editing && (
        <Pressable
          onPress={onRemove}
          hitSlop={8}
          accessibilityRole="button"
          className="ml-2.5 h-[22px] w-[22px] items-center justify-center rounded-full bg-[#E2604A]"
        >
          <Text style={{ color: "#fff", fontSize: 13, lineHeight: 14 }}>×</Text>
        </Pressable>
      )}
    </View>
  );
}
