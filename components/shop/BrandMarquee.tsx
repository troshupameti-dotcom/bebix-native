import { useEffect, useState } from "react";
import { AccessibilityInfo, AppState, Image, Pressable, ScrollView, Text, View } from "react-native";
import Animated, { scrollTo, useAnimatedRef, useAnimatedScrollHandler, useFrameCallback, useSharedValue } from "react-native-reanimated";
import { useIsFocused } from "expo-router";
import type { Brand } from "@/lib/homeContent";

/**
 * Markat si shirit logosh që rrëshqet ngadalë vetë. Kur prindi e prek, shiriti
 * ndalet dhe kalon nën kontrollin e tij: e lëviz majtas-djathtas ose prek një
 * markë. Pasi heq gishtin (dhe shiriti ndalet), lëvizja vetë rifillon.
 *
 * Pa fund në të dy drejtimet: lista vihet tri herë radhazi dhe pozicioni mbahet
 * te kopja e mesme — kur del prej saj, kërcen pa u vënë re një gjatësi më tej.
 * Me pak marka (nën 6) ose kur pajisja kërkon pak lëvizje, rri e palëvizshme.
 *
 * Lëvizja ecën te thread-i i ndërfaqes (Reanimated: useFrameCallback + scrollTo), jo te JavaScript-i: më parë
 * requestAnimationFrame + scrollTo nga JS-i ngecte sapo JS-i kishte punë tjetër ose kur prindi e zvarriste.
 */
/**
 * Logot: drejtkëndësha 2:1, gjithmonë të bardhë (edhe në temën e errët, që logot e errëta si Dr. Brown's të mos
 * humbin). Logot vijnë të njësuara nga bebix-web/scripts/brand-logos.py (pa të bardhën përreth, me të njëjtën
 * peshë pamore dhe hapësirë), ndaj logoja mbush krejt pllakën pa u prerë.
 */
const LOGO_W = 112;
const LOGO_H = 56;
const COLUMN = LOGO_W;
const GAP = 10;
/** Pikselë në sekondë: i ngadaltë, që logot të lexohen. */
const SPEED = 26;
/** Pas sa kohësh nga lëshimi i gishtit rifillon lëvizja vetë. */
const RESUME_MS = 1200;

function Tile({ brand, onPress }: { brand: Brand; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={brand.name}
      style={({ pressed }) => ({
        width: LOGO_W,
        height: LOGO_H,
        marginRight: GAP,
        borderRadius: 16,
        backgroundColor: "#FFFFFF",
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.07)",
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.85 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}
    >
      {brand.logoUrl ? (
        <Image source={{ uri: brand.logoUrl }} style={{ width: LOGO_W, height: LOGO_H }} resizeMode="contain" />
      ) : (
        // Pa logo: emri si shenjë e thjeshtë, me të njëjtën peshë si logot (ngjyrë e errët mbi të bardhë fikse).
        <Text style={{ color: "#2B2B2B", fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center", paddingHorizontal: 10 }} numberOfLines={2}>
          {brand.name}
        </Text>
      )}
    </Pressable>
  );
}

export function BrandMarquee({ brands, onOpen }: { brands: Brand[]; onOpen: (b: Brand) => void }) {
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
  const rowWidth = brands.length * (COLUMN + GAP);

  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  // Të gjitha këto lexohen dhe shkruhen te thread-i i ndërfaqes.
  const offset = useSharedValue(rowWidth);
  const touching = useSharedValue(false);
  // Prindi e lëvizi: pozicionin e ndjek shiriti nga lëvizja e tij, derisa të rifillojë vetë.
  const userMoved = useSharedValue(false);
  // -1 = "rifillo pas RESUME_MS nga korniza e radhës"; përndryshe koha e kornizës kur rifillon.
  const resumeAt = useSharedValue(0);
  const width = useSharedValue(rowWidth);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduceMotion(v));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    width.set(rowWidth);
    offset.set(rowWidth);
  }, [rowWidth, width, offset]);

  const frame = useFrameCallback((info) => {
    "worklet";
    if (touching.get()) return;
    if (resumeAt.get() === -1) resumeAt.set(info.timestamp + RESUME_MS);
    if (info.timestamp < resumeAt.get()) return;
    userMoved.set(false);
    const dt = Math.min(0.05, (info.timeSincePreviousFrame ?? 16) / 1000);
    // Mbaje pozicionin te kopja e mesme: pa fund majtas dhe djathtas.
    let next = offset.get() + SPEED * dt;
    if (next > width.get() * 1.5) next -= width.get();
    if (next < width.get() * 0.5) next += width.get();
    offset.set(next);
    scrollTo(scrollRef, next, 0, false);
  }, false);

  useEffect(() => {
    frame.setActive(running);
    return () => frame.setActive(false);
    // `frame` është i qëndrueshëm për gjithë jetën e komponentit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  const onScroll = useAnimatedScrollHandler({
    onBeginDrag: () => {
      touching.set(true);
      userMoved.set(true);
    },
    onScroll: (e) => {
      // Vetëm kur e lëviz prindi (ose rrëshqitja pas tij): lëvizja vetë e di vetë pozicionin.
      if (userMoved.get()) offset.set(e.contentOffset.x);
    },
    onEndDrag: (e) => {
      touching.set(false);
      offset.set(e.contentOffset.x);
      resumeAt.set(-1);
    },
    // Rrëshqitja pas lëshimit (momentum) i përket ende prindit: lëvizja vetë pret derisa të ndalet.
    onMomentumBegin: () => {
      touching.set(true);
    },
    onMomentumEnd: (e) => {
      touching.set(false);
      let x = e.contentOffset.x;
      if (x > width.get() * 1.5) x -= width.get();
      if (x < width.get() * 0.5) x += width.get();
      offset.set(x);
      if (x !== e.contentOffset.x) scrollTo(scrollRef, x, 0, false);
      resumeAt.set(-1);
    },
  });

  const row = (prefix: string, hidden: boolean) => (
    <View
      key={prefix}
      style={{ flexDirection: "row" }}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? "no-hide-descendants" : "auto"}
    >
      {brands.map((b) => (
        <Tile key={`${prefix}-${b.id}`} brand={b} onPress={() => onOpen(b)} />
      ))}
    </View>
  );

  if (!moving) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20 }}>
        {row("a", false)}
      </ScrollView>
    );
  }

  return (
    <Animated.ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      decelerationRate="normal"
      contentOffset={{ x: rowWidth, y: 0 }}
      onScroll={onScroll}
    >
      {/* Tri kopje: e mesmja është ajo që shihet; dy anësoret e bëjnë shiritin pa fund. */}
      {row("a", true)}
      {row("b", false)}
      {row("c", true)}
    </Animated.ScrollView>
  );
}
