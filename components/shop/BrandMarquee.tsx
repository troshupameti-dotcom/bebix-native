import { useEffect, useState } from "react";
import { AccessibilityInfo, AppState, Image, Pressable, ScrollView, Text, View } from "react-native";
import { useIsFocused } from "expo-router";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { cancelAnimation, useAnimatedStyle, useFrameCallback, useSharedValue, withDecay } from "react-native-reanimated";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import type { Brand } from "@/lib/homeContent";

/**
 * Markat si shirit logosh që rrëshqet ngadalë vetë, pa korniza. Prindi mund ta zvarrisë majtas-djathtas (me
 * rrëshqitje natyrale pas lëshimit) ose të prekë një markë; pasi ndalet, lëvizja vetë rifillon.
 *
 * Butësia: rreshti lëviz me një transformim (translateX) te thread-i i ndërfaqes (Reanimated), jo duke lëvizur
 * një ScrollView. Kështu s'ka rillogaritje të faqes në çdo kornizë dhe JavaScript-i i zënë s'e ndal dot.
 * Pa fund: lista vihet tri herë radhazi dhe pozicioni mbështillet brenda gjerësisë së një kopjeje.
 * Me pak marka (nën 6) ose kur pajisja kërkon pak lëvizje, rri e palëvizshme.
 */

/**
 * Logot vijnë të njësuara nga bebix-web/scripts/brand-logos.py: pa të bardhën përreth, me të njëjtën peshë pamore
 * dhe hapësirë brenda kanavacës 2:1, ndaj s'kanë nevojë për kornizë. Për temën e errët ka version më vete
 * (`/brands/wide-dark/`), ku shkrimet e errëta (Dr. Brown's, Tommee Tippee) janë të çelëta.
 */
const LOGO_W = 104;
const LOGO_H = 52;
const GAP = 4;
const COLUMN = LOGO_W + GAP;
/** Pikselë në sekondë: i ngadaltë, që logot të lexohen. */
const SPEED = 28;
/** Pas sa kohësh nga ndalimi rifillon lëvizja vetë. */
const RESUME_MS = 1200;

/** Logoja për temën: version i errët kur ekziston (logot e Bebix-it), përndryshe e njëjta. */
export function logoForTheme(url: string, dark: boolean): string {
  return dark && url.includes("/brands/wide/") ? url.replace("/brands/wide/", "/brands/wide-dark/") : url;
}

function Tile({ brand, dark, ink, onPress }: { brand: Brand; dark: boolean; ink: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={brand.name}
      style={({ pressed }) => ({
        width: LOGO_W,
        height: LOGO_H,
        marginRight: GAP,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.6 : 1,
      })}
    >
      {brand.logoUrl ? (
        <Image source={{ uri: logoForTheme(brand.logoUrl, dark) }} style={{ width: LOGO_W, height: LOGO_H }} resizeMode="contain" />
      ) : (
        // Pa logo: emri si shenjë e thjeshtë, me të njëjtën peshë si logot.
        <Text style={{ color: ink, fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center", paddingHorizontal: 6 }} numberOfLines={2}>
          {brand.name}
        </Text>
      )}
    </Pressable>
  );
}

export function BrandMarquee({ brands, onOpen }: { brands: Brand[]; onOpen: (b: Brand) => void }) {
  const theme = useThemeColors();
  const [reduceMotion, setReduceMotion] = useState(false);
  const moving = brands.length >= 6 && !reduceMotion;
  // Lëvizja vetë punon vetëm kur shihet: Dyqani është skeda aktive dhe app-i në plan të parë. Skedat mbeten
  // të montuara, ndaj pa këtë cikli 60 herë në sekondë vazhdonte edhe te Bebi/Komuniteti dhe në sfond.
  const focused = useIsFocused();
  const [appActive, setAppActive] = useState(AppState.currentState === "active");
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => setAppActive(state === "active"));
    return () => sub.remove();
  }, []);
  const running = moving && focused && appActive;
  // Gjerësia e një kopjeje të listës.
  const rowWidth = brands.length * COLUMN;

  // Të gjitha këto lexohen dhe shkruhen te thread-i i ndërfaqes.
  const offset = useSharedValue(0);
  const width = useSharedValue(rowWidth);
  // Prindi e mban ose rrëshqitja pas lëshimit vazhdon: lëvizja vetë pret.
  const held = useSharedValue(false);
  // -1 = "rifillo pas RESUME_MS nga korniza e radhës"; përndryshe koha e kornizës kur rifillon.
  const resumeAt = useSharedValue(0);
  const dragStart = useSharedValue(0);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduceMotion(v));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    width.set(rowWidth);
  }, [rowWidth, width]);

  const frame = useFrameCallback((info) => {
    "worklet";
    if (held.get()) return;
    if (resumeAt.get() === -1) resumeAt.set(info.timestamp + RESUME_MS);
    if (info.timestamp < resumeAt.get()) return;
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    offset.set(offset.get() + SPEED * dt);
  }, false);

  useEffect(() => {
    frame.setActive(running);
    return () => frame.setActive(false);
    // `frame` është i qëndrueshëm për gjithë jetën e komponentit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  // Zvarritja: vetëm horizontale (lëvizja vertikale i lihet faqes), prekja e shkurtër i lihet markës.
  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-12, 12])
    .onBegin(() => {
      held.set(true);
      cancelAnimation(offset);
      dragStart.set(offset.get());
    })
    .onUpdate((e) => {
      offset.set(dragStart.get() - e.translationX);
    })
    .onEnd((e) => {
      offset.set(
        withDecay({ velocity: -e.velocityX, deceleration: 0.997 }, () => {
          held.set(false);
          resumeAt.set(-1);
        })
      );
    })
    .onFinalize((_e, success) => {
      // Prekje pa zvarritje (p.sh. mbi një markë): s'ka rrëshqitje, rifillon pas pak.
      if (!success) {
        held.set(false);
        resumeAt.set(-1);
      }
    });

  // Pozicioni mbështillet brenda një kopjeje: kopja e dytë zë vendin e të parës pa u vënë re.
  const rowStyle = useAnimatedStyle(() => {
    const w = width.get();
    const x = w > 0 ? ((offset.get() % w) + w) % w : 0;
    return { transform: [{ translateX: -x }] };
  });

  const row = (prefix: string, hidden: boolean) => (
    <View
      key={prefix}
      style={{ flexDirection: "row" }}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
    >
      {brands.map((b) => (
        <Tile key={`${prefix}-${b.id}`} brand={b} dark={theme.isDark} ink={theme.ink} onPress={() => onOpen(b)} />
      ))}
    </View>
  );

  if (!moving) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
        {row("a", false)}
      </ScrollView>
    );
  }

  return (
    <GestureDetector gesture={pan}>
      <View style={{ overflow: "hidden", height: LOGO_H }}>
        {/* Tri kopje radhazi: gjithmonë mbushin ekranin, edhe kur pozicioni mbështillet. */}
        <Animated.View style={[{ flexDirection: "row" }, rowStyle]}>
          {row("a", false)}
          {row("b", true)}
          {row("c", true)}
        </Animated.View>
      </View>
    </GestureDetector>
  );
}
