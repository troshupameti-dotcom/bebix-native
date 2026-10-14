import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, Image, Pressable, ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
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
  const scrollRef = useRef<ScrollView>(null);
  const offset = useRef(0);
  const touching = useRef(false);
  const resumeAt = useRef(0);
  // Gjerësia e një kopjeje të listës.
  const rowWidth = brands.length * (COLUMN + GAP);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => alive && setReduceMotion(v));
    return () => {
      alive = false;
    };
  }, []);

  // Mbaje pozicionin te kopja e mesme: pa fund majtas dhe djathtas.
  const wrap = useCallback(
    (x: number) => {
      if (x < rowWidth * 0.5) return x + rowWidth;
      if (x > rowWidth * 1.5) return x - rowWidth;
      return x;
    },
    [rowWidth]
  );

  // Nis te kopja e mesme.
  useEffect(() => {
    if (!moving) return;
    offset.current = rowWidth;
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: rowWidth, animated: false }));
  }, [moving, rowWidth]);

  // Lëvizja vetë, kornizë pas kornize, kur s'e prek askush (dhe vetëm kur shihet).
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    let last = Date.now();
    const tick = () => {
      const now = Date.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!touching.current && now >= resumeAt.current) {
        const next = wrap(offset.current + SPEED * dt);
        offset.current = next;
        scrollRef.current?.scrollTo({ x: next, animated: false });
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, wrap]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!touching.current && Date.now() < resumeAt.current) {
      // Rrëshqitja pas lëshimit (momentum): ndiq pozicionin, pa kërcime.
      offset.current = e.nativeEvent.contentOffset.x;
      return;
    }
    if (touching.current) offset.current = e.nativeEvent.contentOffset.x;
  };

  const release = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const wrapped = wrap(x);
    offset.current = wrapped;
    if (wrapped !== x) scrollRef.current?.scrollTo({ x: wrapped, animated: false });
  };

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
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      decelerationRate="normal"
      onTouchStart={() => {
        touching.current = true;
      }}
      onTouchEnd={() => {
        touching.current = false;
        resumeAt.current = Date.now() + RESUME_MS;
      }}
      onScrollBeginDrag={() => {
        touching.current = true;
      }}
      onScrollEndDrag={(e) => {
        touching.current = false;
        resumeAt.current = Date.now() + RESUME_MS;
        release(e);
      }}
      onMomentumScrollEnd={(e) => {
        resumeAt.current = Date.now() + RESUME_MS;
        release(e);
      }}
      onScroll={onScroll}
    >
      {/* Tri kopje: e mesmja është ajo që shihet; dy anësoret e bëjnë shiritin pa fund. */}
      {row("a", true)}
      {row("b", false)}
      {row("c", true)}
    </ScrollView>
  );
}
