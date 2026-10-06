import { View, Text, TextInput } from "react-native";
import { shadows } from "@/lib/shadows";
import { Icon, type IconName } from "@/components/ui/Icon";
import { JiggleWrap } from "./JiggleWrap";
import { RemoveBadge } from "./RemoveBadge";

/** Ikona dhe ngjyra e secilit lloj të dhëne mjekësore, që dallohen me një vështrim si te "Rritja". */
export function medicalAccent(key: string): { icon: IconName; tint: string; tintBg: string; cardBg: string } {
  switch (key) {
    case "blood":
    case "rh":
      return { icon: "heart", tint: "#B23A1C", tintBg: "#F3DCCF", cardBg: "#FBF0EA" };
    case "allergies":
      return { icon: "shield", tint: "#C9702E", tintBg: "#F5E1CC", cardBg: "#FCF3EA" };
    case "doctor":
      return { icon: "user", tint: "#2E6FA8", tintBg: "#D9E7F2", cardBg: "#EEF4FA" };
    case "birth_weight":
      return { icon: "cube", tint: "#7A3596", tintBg: "#E7DAEF", cardBg: "#F4EEF8" };
    default:
      return { icon: "star", tint: "#6E7452", tintBg: "#E4E7DA", cardBg: "#F1F3EA" };
  }
}

/**
 * Pllakë e të dhënave mjekësore (grupi i gjakut, alergjitë, pediatri...), në të njëjtën pamje si kartat e rritjes:
 * sfond i butë me ngjyrën e vet, rreth-ikonë, titull i vogël dhe vlerë e madhe.
 */
export function MedicalTile({
  rowKey, label, value, editing, isCustom, placeholder, onChangeValue, onChangeLabel, onRemove,
}: {
  rowKey: string;
  label: string;
  value: string;
  editing: boolean;
  isCustom?: boolean;
  placeholder?: string;
  onChangeValue: (v: string) => void;
  onChangeLabel?: (v: string) => void;
  onRemove: () => void;
}) {
  const a = medicalAccent(rowKey);
  return (
    <JiggleWrap active={editing} style={{ flex: 1 }}>
      <View style={[shadows.soft, { backgroundColor: a.cardBg }]} className="relative rounded-xl2 border border-ink/5 p-4">
        {editing && <RemoveBadge onPress={onRemove} />}
        <View className="mb-2.5 flex-row items-center">
          <View className="mr-2.5 h-9 w-9 items-center justify-center rounded-full" style={{ backgroundColor: a.tintBg }}>
            <Icon name={a.icon} size={17} color={a.tint} />
          </View>
          {isCustom && editing ? (
            <TextInput value={label} onChangeText={onChangeLabel} className="flex-1 font-bodySemibold text-[12.5px]" style={{ color: a.tint }} />
          ) : (
            <Text className="flex-1 font-bodySemibold text-[12.5px]" style={{ color: a.tint }} numberOfLines={2}>{label}</Text>
          )}
        </View>
        <TextInput
          value={value}
          onChangeText={onChangeValue}
          editable={editing}
          placeholder={editing ? placeholder : "—"}
          placeholderClassName="text-ink-faint"
          className={`font-display text-[20px] text-ink ${editing ? "border-b border-dashed border-orange" : ""}`}
        />
      </View>
    </JiggleWrap>
  );
}
