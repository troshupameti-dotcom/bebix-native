import { View, Text, TextInput } from "react-native";
import { shadows } from "@/lib/shadows";
import { Icon, type IconName } from "@/components/ui/Icon";
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
  /** Ikona dhe ngjyra e vet, që "Përmbledhja e rritjes" mos duket si një
   *  formular i bardhë: pesha, gjatësia dhe rrethi i kokës dallohen me
   *  një vështrim, jo vetëm nga etiketa e tekstit. */
  icon?: IconName;
  /** Ngjyra e ngopur, e ikones dhe vijes siper. */
  tint?: string;
  /** Sfondi i bute i rrethit te ikones — pergatitur perpara, jo alpha ne kohe-xhirimi. */
  tintBg?: string;
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
  icon,
  tint,
  tintBg,
}: StatCardProps) {
  return (
    <JiggleWrap active={editing} style={{ flex: 1 }}>
      <View style={shadows.soft} className="relative rounded-xl2 border border-ink/10 bg-surface p-4">
        {editing && <RemoveBadge onPress={onRemove} />}
        {/* Vija e hollë sipër, jo krejt karta e mbushur: mban kartën të
            qetë, por i jep një ngjyrë të vetën secilit lloj matjeje.
            Rrezja e vet — jo `overflow-hidden` te karta — sepse ajo do
            të priste edhe distinktivin e fshirjes qe del jashtë qoshes. */}
        {tint && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              backgroundColor: tint,
              borderTopLeftRadius: 22,
              borderTopRightRadius: 22,
            }}
          />
        )}
        <View className="mb-2 flex-row items-center justify-between">
          {isCustom && editing ? (
            <TextInput
              value={label}
              onChangeText={onChangeLabel}
              className="flex-1 font-bodyMedium text-[12.5px] text-ink-soft"
            />
          ) : (
            <Text className="flex-1 font-bodyMedium text-[12.5px] text-ink-soft">{label}</Text>
          )}
          {icon && (
            <View
              className="h-8 w-8 items-center justify-center rounded-full"
              style={{ backgroundColor: tintBg }}
            >
              <Icon name={icon} size={16} color={tint} />
            </View>
          )}
        </View>
        <TextInput
          value={value}
          onChangeText={onChangeValue}
          editable={editing}
          className={`font-display text-[22px] text-ink ${editing ? "border-b border-dashed border-orange" : ""}`}
        />
        {sub ? <Text className="mt-0.5 font-body text-[11.5px] text-ink-soft">{sub}</Text> : null}
      </View>
    </JiggleWrap>
  );
}
