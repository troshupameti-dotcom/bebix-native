import { useCallback, useEffect, useRef, useState } from "react";
import { AccessibilityInfo, AppState, Image, Pressable, ScrollView, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { useIsFocused } from "expo-router";
import { Icon } from "@/components/ui/Icon";
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
/** Logot: drejtkëndësha kompaktë, me të njëjtën hapësirë të vogël mes tyre. */
const LOGO_W = 84;
const LOGO_H = 52;
const COLUMN = LOGO_W;
const GAP = 8;
/** Pikselë në sekondë: i ngadaltë, që logot të lexohen. */
const SPEED = 26;
/** Pas sa kohësh nga lëshimi i gishtit rifillon lëvizja vetë. */
const RESUME_MS = 1200;

function Tile({ brand, color, onPress }: { brand: Brand; color: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={brand.name} style={{ width: COLUMN, marginRight: GAP }} className="items-center">
      <View style={{ width: LOGO_W, height: LOGO_H }} className="items-center justify-center overflow-hidden rounded-xl border border-cream-line bg-surface">
        {brand.logoUrl ? <Image source={{ uri: brand.logoUrl }} style={{ width: LOGO_W - 12, height: LOGO_H - 12 }} resizeMode="contain" /> : <Icon name={brand.icon} size={22} color={color} />}
      </View>
      <Text className="mt-1 text-center font-bodyMedium text-[10.5px] text-ink-soft" numberOfLines={1}>
        {brand.name}
      </Text>
    </Pressable>
  );
}

export function BrandMarquee({ brands, color, onOpen }: { brands: Brand[]; color: string; onOpen: (b: Brand) => void }) {
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
        <Tile key={`${prefix}-${b.id}`} brand={b} color={color} onPress={() => onOpen(b)} />
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
