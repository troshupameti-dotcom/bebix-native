import { useEffect, useRef } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Line, Path } from "react-native-svg";
import type { BottomTabBarProps } from "expo-router/tabs";
import { Icon } from "@/components/ui/Icon";
import { haptics } from "@/lib/haptics";

export type TabGlyph = "baby" | "shop" | "sparkle" | "community" | "settings";
export type TabBarColors = { background: string; border: string; active: string; inactive: string };

type Props = BottomTabBarProps & {
  /** Vetëm këto skeda dalin në shirit, me këtë radhë; të tjerat (p.sh. njoftimet) hapen nga diku tjetër. */
  items: { name: string; icon: TabGlyph }[];
  colors: TabBarColors;
};

const ICON = 22;
// Rrethi që mbush ikonën rritet nga qendra deri sa mbulon edhe qoshet e katrorit (diagonalja ≈ 31).
const FILL_MAX = 32;

/**
 * Shiriti poshtë. Ikona e prekur mbushet me ngjyrë nga qendra, "kërcen" pak.
 * Shiriti i gatshëm i React Navigation e vizaton çdo ikonë dy herë (aktive/joaktive) dhe i ndërron me
 * opacitet, ndaj ikona s'e di kur preket; prandaj shiriti është i yni. Prekja kalon nga e njëjta ngjarje
 * `tabPress`, kështu që mbrojtja e mysafirit te layout-i dhe "mbrapa" punojnë si më parë.
 */
export function TabBar({ state, descriptors, emitter, navigateToTab, insets, items, colors }: Props) {
  // Lartësia mbetet ajo e mëparshme (58 + zona e sigurt poshtë), që ekranet të mos ndryshojnë.
  const paddingBottom = Math.max(insets.bottom, 8);
  const order = new Map(items.map((it, i) => [it.name, i]));
  const routes = state.routes.filter((r) => order.has(r.name)).sort((a, b) => order.get(a.name)! - order.get(b.name)!);

  return (
    <View
      accessibilityRole="tablist"
      style={{
        flexDirection: "row",
        height: 58 + insets.bottom,
        paddingTop: 6,
        paddingBottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.border,
      }}
    >
      {routes.map((route) => {
        const focused = state.routes[state.index]?.key === route.key;
        const { options } = descriptors[route.key];
        const label = typeof options.title === "string" ? options.title : route.name;
        const icon = items[order.get(route.name)!].icon;

        const onPress = () => {
          const event = emitter.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            haptics.select();
            navigateToTab(route.key);
          }
        };
        const onLongPress = () => emitter.emit({ type: "tabLongPress", target: route.key });

        return (
          <TabItem
            key={route.key}
            label={label}
            icon={icon}
            focused={focused}
            colors={colors}
            onPress={onPress}
            onLongPress={onLongPress}
          />
        );
      })}
    </View>
  );
}

function TabItem({
  label,
  icon,
  focused,
  colors,
  onPress,
  onLongPress,
}: {
  label: string;
  icon: TabGlyph;
  focused: boolean;
  colors: TabBarColors;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const fill = useSharedValue(focused ? 1 : 0);
  const pop = useSharedValue(1);

  // Në hapjen e parë skeda aktive shfaqet gati e mbushur, pa animacion; animacioni vjen vetëm me ndërrimin.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const to = focused ? 1 : 0;
    if (reduceMotion) {
      fill.value = to;
      pop.value = 1;
      return;
    }
    if (focused) {
      fill.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
      pop.value = withSequence(
        withTiming(1.2, { duration: 130, easing: Easing.out(Easing.quad) }),
        withSpring(1, { damping: 8, stiffness: 260, mass: 0.6 })
      );
    } else {
      fill.value = withTiming(0, { duration: 180, easing: Easing.in(Easing.quad) });
      pop.value = withTiming(1, { duration: 120 });
    }
  }, [focused, reduceMotion, fill, pop]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  // Rrethi prerës rritet nga qendra e ikonës; ikona e mbushur brenda tij rri në vend (zhvendoset sa rrethi).
  const clipStyle = useAnimatedStyle(() => {
    const d = fill.value * FILL_MAX;
    return { width: d, height: d, borderRadius: d / 2, left: (ICON - d) / 2, top: (ICON - d) / 2 };
  });
  const innerStyle = useAnimatedStyle(() => {
    const d = fill.value * FILL_MAX;
    return { left: (d - ICON) / 2, top: (d - ICON) / 2 };
  });

  const tint = focused ? colors.active : colors.inactive;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      // Si React Navigation: "tab" s'lexohet mirë nga VoiceOver-i i iOS-it, ndaj atje është "button".
      accessibilityRole={Platform.OS === "ios" ? "button" : "tab"}
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
    >
      <Animated.View style={[{ width: ICON, height: ICON }, popStyle]}>
        {/* Ylli i AI-së zë vetëm pjesën e sipërme të katrorit (y 3–15): zbritet sa të rrijë në qendër si të tjerat. */}
        <View style={{ width: ICON, height: ICON, transform: [{ translateY: icon === "sparkle" ? 2.75 : 0 }] }}>
          <Icon name={icon} size={ICON} color={tint} />
          <Animated.View style={[{ position: "absolute", overflow: "hidden" }, clipStyle]}>
            <Animated.View style={[{ position: "absolute", width: ICON, height: ICON }, innerStyle]}>
              <FilledGlyph name={icon} color={colors.active} cut={colors.background} />
            </Animated.View>
          </Animated.View>
        </View>
      </Animated.View>
      <Text
        numberOfLines={1}
        maxFontSizeMultiplier={1.2}
        style={{ marginTop: 4, fontSize: 10.5, lineHeight: 13, fontFamily: "Inter_500Medium", includeFontPadding: false, color: tint }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Ikonat e skedave të mbushura, të vizatuara mbi të njëjtat forma si `Icon`. Detajet e brendshme (doreza e
 * çantës, vrima e ingranazhit, ndarja mes dy njerëzve) priten me ngjyrën e shiritit, që të mos humbasin.
 */
function FilledGlyph({ name, color, cut }: { name: TabGlyph; color: string; cut: string }) {
  const solid = { fill: color, stroke: color, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const line = (stroke: string, width = 1.6) => ({ stroke, strokeWidth: width, strokeLinecap: "round" as const, fill: "none" });
  return (
    <Svg width={ICON} height={ICON} viewBox="0 0 24 24">
      {name === "baby" ? (
        <>
          <Circle cx="12" cy="8.8" r="3.7" {...solid} />
          <Path d="M6 21c0-4 3-6 6-6s6 2 6 6Z" {...solid} />
        </>
      ) : name === "shop" ? (
        <>
          <Path d="M4 8l1.5-4h13L20 8Z" {...solid} />
          <Path d="M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V8Z" {...solid} />
          <Line x1="4.8" y1="8" x2="19.2" y2="8" {...line(cut, 1.2)} />
          <Path d="M9 12a3 3 0 0 0 6 0" {...line(cut)} />
        </>
      ) : name === "sparkle" ? (
        <Path d="M12 3l1.6 4.8L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.2L12 3Z" {...solid} />
      ) : name === "community" ? (
        <>
          <Circle cx="8" cy="9" r="3" {...solid} />
          <Path d="M2 20c0-3 2.5-5 6-5s6 2 6 5Z" {...solid} />
          {/* Një "aureolë" me ngjyrën e shiritit e ndan personin e dytë nga i pari. */}
          <Path d="M10 20c0-3 2.5-5 6-5s6 2 6 5Z" fill={cut} stroke={cut} strokeWidth={3.4} strokeLinejoin="round" />
          <Circle cx="16" cy="9" r="3" {...solid} />
          <Path d="M10 20c0-3 2.5-5 6-5s6 2 6 5Z" {...solid} />
        </>
      ) : (
        <>
          <Circle cx="12" cy="12" r="5.2" {...solid} />
          <Circle cx="12" cy="12" r="1.8" fill={cut} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const a = (deg * Math.PI) / 180;
            return (
              <Line
                key={deg}
                x1={12 + 6 * Math.cos(a)}
                y1={12 + 6 * Math.sin(a)}
                x2={12 + 8.5 * Math.cos(a)}
                y2={12 + 8.5 * Math.sin(a)}
                {...line(color, 2.2)}
              />
            );
          })}
        </>
      )}
    </Svg>
  );
}
