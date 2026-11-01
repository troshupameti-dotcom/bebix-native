import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { onCartAdded } from "@/lib/shop/cartAdded";
import { haptics } from "@/lib/haptics";

// Skena: e njëjta "pilulë" e errët si njoftimet e vogla (toast), në të njëjtin vend poshtë.
const W = 236;
const H = 56;
const CART_W = 34;
const CART_H = 28;
const CART_TOP = 18;
const CART_STOP = (W - CART_W) / 2;
const WHEEL = 8;
const CREAM = "#FBF6EE";
const BOX = "#C9702E";

// Koha (ms): karroca hyn, kutia bie, karroca ikën, pastaj del "U shtua ✅".
const T_ROLL_IN = 460;
const T_DROP = 340;
const T_LAND = T_DROP + 300;
const T_DRIVE = 900;
const T_TEXT = 1150;
const T_HIDE = 2350;
const T_END = 2650;

/**
 * Animacioni i shtimit në shportë: një karrocë e vogël hyn rrotullueshëm, kap një kuti që bie dhe ikën;
 * pastaj del "U shtua në shportë ✅". Me "Zvogëlo lëvizjet" të telefonit del vetëm teksti. Kur shtohen
 * disa produkte njëherësh (p.sh. "Porosit përsëri"), animacioni luhet një herë.
 */
export function CartAddedHost() {
  const { t } = useTranslation();
  const [play, setPlay] = useState(0);
  const playing = useRef(false);

  useEffect(
    () =>
      onCartAdded(() => {
        if (playing.current) return;
        playing.current = true;
        setPlay((n) => n + 1);
      }),
    []
  );

  useEffect(() => {
    if (!play) return;
    AccessibilityInfo.announceForAccessibility(t("cart_added_check"));
    const end = setTimeout(() => {
      playing.current = false;
      setPlay(0);
    }, T_END);
    return () => clearTimeout(end);
  }, [play, t]);

  if (!play) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
      <SafeAreaView edges={["bottom"]} pointerEvents="none">
        <CartScene key={play} label={t("cart_added_check")} />
      </SafeAreaView>
    </View>
  );
}

function CartScene({ label }: { label: string }) {
  const reduceMotion = useReducedMotion();
  const stage = useSharedValue(0);
  const cartX = useSharedValue(reduceMotion ? W + 20 : -CART_W - 8);
  const cartY = useSharedValue(0);
  const tilt = useSharedValue(0);
  const boxY = useSharedValue(-44);
  const boxOn = useSharedValue(0);
  const text = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    stage.value = withSequence(
      withTiming(1, { duration: 160 }),
      withDelay(T_HIDE - 160, withTiming(0, { duration: 240 }))
    );
    if (reduceMotion) return;
    cartX.value = withSequence(
      withTiming(CART_STOP, { duration: T_ROLL_IN, easing: Easing.out(Easing.cubic) }),
      withDelay(T_DRIVE - T_ROLL_IN, withTiming(W + 24, { duration: 440, easing: Easing.in(Easing.cubic) }))
    );
    boxOn.value = withDelay(T_DROP, withTiming(1, { duration: 1 }));
    boxY.value = withDelay(
      T_DROP,
      withSequence(
        withTiming(5, { duration: T_LAND - T_DROP, easing: Easing.in(Easing.quad) }),
        withSpring(3, { damping: 9, stiffness: 320 })
      )
    );
    // Karroca ulet pak kur e kap kutinë, pastaj ngrihet "me hundë" kur niset.
    cartY.value = withDelay(T_LAND, withSequence(withTiming(2.5, { duration: 70 }), withSpring(0, { damping: 8, stiffness: 300 })));
    tilt.value = withDelay(T_DRIVE, withSequence(withTiming(-8, { duration: 160 }), withTiming(-4, { duration: 280 })));
    text.value = withDelay(T_TEXT, withTiming(1, { duration: 220, easing: Easing.out(Easing.quad) }));
    const tap = setTimeout(() => haptics.tap(), T_LAND);
    return () => clearTimeout(tap);
  }, [reduceMotion, stage, cartX, cartY, tilt, boxY, boxOn, text]);

  const stageStyle = useAnimatedStyle(() => ({ opacity: stage.value, transform: [{ translateY: (1 - stage.value) * 16 }] }));
  const cartStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: cartX.value }, { translateY: cartY.value }, { rotate: `${tilt.value}deg` }],
  }));
  // Rrotat rrotullohen sa ecën karroca (rruga / rrezja).
  const wheelStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${cartX.value / (WHEEL / 2)}rad` }] }));
  const boxStyle = useAnimatedStyle(() => ({ opacity: boxOn.value, transform: [{ translateY: boxY.value }] }));
  const textStyle = useAnimatedStyle(() => ({ opacity: text.value, transform: [{ translateY: (1 - text.value) * 6 }] }));

  return (
    <Animated.View
      style={[
        {
          alignSelf: "center",
          width: W,
          height: H,
          marginBottom: 90,
          borderRadius: 18,
          overflow: "hidden",
          backgroundColor: "#2C271F",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.2,
          shadowRadius: 16,
          elevation: 6,
        },
        stageStyle,
      ]}
    >
      <Animated.View style={[{ position: "absolute", left: 0, top: CART_TOP, width: CART_W, height: CART_H }, cartStyle]}>
        {/* Kutia: fëmijë i karrocës, që të ikë bashkë me të pasi bie brenda. */}
        <Animated.View style={[{ position: "absolute", left: 11, top: 0, width: 14, height: 12 }, boxStyle]}>
          <Svg width={14} height={12} viewBox="0 0 14 12">
            <Rect x="0.5" y="0.5" width="13" height="11" rx="1.6" fill={BOX} />
            <Path d="M0.5 3.6h13" stroke="#A85A22" strokeWidth={1} />
            <Rect x="5.6" y="0.5" width="2.8" height="11" fill="#E8B07A" />
          </Svg>
        </Animated.View>
        <Svg width={CART_W} height={CART_H} viewBox="0 0 34 28" style={{ position: "absolute" }}>
          <Path d="M7.4 8h22.9l-3 10H8.7Z" fill={CREAM} fillOpacity={0.16} />
          <Path d="M1.5 3.5h4.2l3 14.5h18.6l3-10H7.4" fill="none" stroke={CREAM} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        {[11.5 - WHEEL / 2, 25 - WHEEL / 2].map((left) => (
          <Animated.View key={left} style={[{ position: "absolute", left, top: 23.5 - WHEEL / 2, width: WHEEL, height: WHEEL }, wheelStyle]}>
            <Svg width={WHEEL} height={WHEEL} viewBox="0 0 8 8">
              <Circle cx="4" cy="4" r="2.9" fill="#2C271F" stroke={CREAM} strokeWidth={1.8} />
              <Circle cx="4" cy="1.9" r="0.75" fill={CREAM} />
            </Svg>
          </Animated.View>
        ))}
      </Animated.View>

      <Animated.View style={[{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }, textStyle]}>
        <Text style={{ color: CREAM, fontSize: 14, fontFamily: "Inter_600SemiBold" }} numberOfLines={1}>
          {label}
        </Text>
      </Animated.View>
    </Animated.View>
  );
}
