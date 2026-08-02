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
  const badgeBg = accent === "orange" ? "#F5E1CC" : "#E7EAD9";
  const badgeFg = accent === "orange" ? "#C9702E" : "#6E7452";

  return (
    <JiggleWrap active={editing} style={{ flex: 1 }}>
      <Pressable
        onPress={editing ? undefined : onPress}
        style={shadows.soft}
        className="relative items-center gap-1.5 rounded-xl2 border border-ink/10 bg-white px-1 py-3.5 dark:bg-ink dark:border-cream/10"
      >
        {editing && <RemoveBadge onPress={onRemove} />}
        <View
          style={{ backgroundColor: badgeBg, width: 34, height: 34, borderRadius: 12 }}
          className="items-center justify-center"
        >
          <Icon name={icon} size={17} color={badgeFg} />
        </View>
        <Text numberOfLines={1} className="font-bodySemibold text-[11px] text-ink dark:text-cream">
          {label}
        </Text>
      </Pressable>
    </JiggleWrap>
  );
}
