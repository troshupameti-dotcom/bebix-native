import { Pressable, View, Text } from "react-native";
import { Icon, IconName } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { JiggleWrap } from "./JiggleWrap";
import { RemoveBadge } from "./RemoveBadge";

type QuickActionTileProps = {
  icon: IconName;
  label: string;
  accent: "olive" | "orange";
  editing: boolean;
  onPress: () => void;
  onRemove: () => void;
};

export function QuickActionTile({ icon, label, accent, editing, onPress, onRemove }: QuickActionTileProps) {
  const badgeBg = accent === "orange" ? "bg-orange-bg" : "bg-olive-bg";
  const badgeFg = accent === "orange" ? "#C9702E" : "#6E7452";

  return (
    <JiggleWrap active={editing} style={{ flex: 1 }}>
      <Pressable
        onPress={editing ? undefined : onPress}
        style={shadows.soft}
        className="relative items-center gap-1.5 rounded-xl2 border border-ink/10 bg-surface px-1 py-3.5"
      >
        {editing && <RemoveBadge onPress={onRemove} />}
        <View
          style={{ width: 34, height: 34, borderRadius: 12 }}
          className={`items-center justify-center ${badgeBg}`}
        >
          <Icon name={icon} size={17} color={badgeFg} />
        </View>
        <Text numberOfLines={1} className="font-bodySemibold text-[11px] text-ink">
          {label}
        </Text>
      </Pressable>
    </JiggleWrap>
  );
}
