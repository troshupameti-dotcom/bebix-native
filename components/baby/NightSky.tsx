import { memo, useEffect, useMemo } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import Animated, {
  Easing, cancelAnimation, interpolate, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat, withSequence, withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * Qielli i natës pas pamjes së natës: blu e mesnatës shumë e errët, Hëna e vërtetë me një aureolë të butë, dhe yje
 * të vegjël me madhësi e shkëlqim të ndryshëm. Vetëm dekor: s'merr prekje, s'lexohet nga lexuesi i ekranit.
 *
 * - Hëna: `assets/images/night/moon.png` (44 KB), sferë e vizatuar nga harta e Hënës e NASA-s (LRO, CGI Moon Kit,
 *   NASA's Scientific Visualization Studio, svs.gsfc.nasa.gov/4720), me dritë Lommel–Seeliger si te Hëna e vërtetë.
 * - Qielli, aureola dhe yjet: SVG, të vizatuara një herë. Yjet vijnë nga një numër fiks (gjithmonë të njëjtat).
 * - I gjallë: yjet vezullojnë në tri grupe me ritme të ndryshme, Hëna noton butë dhe aureola i merr frymë, dy re
 *   të holla kalojnë ngadalë dhe herë pas here bie një yll. Vetëm tejdukshmëri dhe zhvendosje me Reanimated, në
 *   fijen e ekranit: SVG-ja vizatohet një herë, JavaScript-i s'punon. Me "Zvogëlo lëvizjen" të telefonit qielli
 *   rri i palëvizshëm. `memo` pa props: ora që ndryshon çdo sekondë s'e rivizaton qiellin.
 * - Errësira mbetet: sipër blu e thellë, poshtë e zezë e plotë (njësoj si shiriti i skedave natën), tekstet e kuqe
 *   rrinë mbi pjesën më të errët.
 */

export const NIGHT_SKY = {
  top: "#0B1832",
  mid: "#060F22",
  low: "#030713",
  bottom: "#000000",
  /** Drita e Hënës: e bardhë e ftohtë, as e artë as vjollcë. */
  moonlight: "#D3DFF2",
};

const STAR_COLORS = ["#FFFFFF", "#FFFFFF", "#FFFFFF", "#E2EBFF", "#D3E1FF", "#FFF3E6"];

/** Numra "të rastit" të përsëritshëm (mulberry32): yjet dalin në të njëjtat vende çdo herë. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Star = { x: number; y: number; r: number; o: number; c: string; glow: boolean };

/** Vendi i Hënës: djathtas lart, nën butonin "Mbyll", larg orës në mes (në ekranet e ulëta pak më lart). */
export function moonFrame(width: number, top: number, height = 844) {
  const size = Math.round(Math.min(120, Math.max(72, width * 0.21)));
  return { size, x: width - 26 - size, y: top + (height < 720 ? 58 : 64) };
}

export function makeStars(width: number, height: number, moon: { cx: number; cy: number; r: number }): Star[] {
  const rnd = seeded(20261028);
  const count = Math.round(Math.min(220, Math.max(90, (width * height) / 2600)));
  const stars: Star[] = [];
  // Pjesa ku rri ora dhe "Fle prej…": yjet aty zbehen, që teksti i kuq të lexohet pa pika përmbi.
  const quiet = (x: number, y: number) => ((x - width / 2) / (width * 0.42)) ** 2 + ((y - height * 0.43) / (height * 0.1)) ** 2 < 1;
  const place = (n: number, dust: boolean) => {
    for (let i = 0, added = 0; i < n * 3 && added < n; i++) {
      const x = rnd() * width;
      // më shumë yje lart; poshtë (te butonat) qielli qetësohet
      const yn = Math.pow(rnd(), 1.7);
      const y = yn * height;
      if (Math.hypot(x - moon.cx, y - moon.cy) < moon.r * 1.7) continue; // asnjë yll mbi Hënë ose në aureolën e saj
      const big = dust ? 0 : Math.pow(rnd(), 3.2);
      const r = dust ? 0.25 + rnd() * 0.2 : 0.35 + big * 1.25;
      const fade = (yn > 0.62 ? Math.max(0, 1 - (yn - 0.62) / 0.38) : 1) * (quiet(x, y) ? 0.35 : 1);
      // "pluhuri": yje shumë të zbehtë që i japin qiellit thellësi
      const o = (dust ? 0.08 + 0.16 * rnd() : 0.22 + 0.6 * Math.pow(rnd(), 1.4) + big * 0.25) * fade;
      if (o < 0.05) continue;
      stars.push({ x, y, r, o: Math.min(0.95, o), c: STAR_COLORS[Math.floor(rnd() * STAR_COLORS.length)], glow: r > 1.15 && !quiet(x, y) });
      added++;
    }
  };
  place(count, false);
  place(Math.round(count * 0.9), true);
  return stars;
}

/** Përsërit pa fund një lëkundje 0 → 1 → 0 me kohëzgjatjen e dhënë (ms), duke nisur pas `delay`. */
function useLoop(duration: number, delay: number, on: boolean): SharedValue<number> {
  const v = useSharedValue(0);
  useEffect(() => {
    if (!on) {
      v.value = 0;
      return;
    }
    const ease = Easing.inOut(Easing.sin);
    v.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration, easing: ease }), withTiming(0, { duration, easing: ease })), -1));
    return () => cancelAnimation(v);
  }, [v, duration, delay, on]);
  return v;
}

/** Një grup yjesh në SVG-në e vet, që vezullon i tëri (shumë më lirë se çdo yll më vete). */
function StarLayer({ stars, width, height, pulse, low }: { stars: Star[]; width: number; height: number; pulse: SharedValue<number>; low: number }) {
  const style = useAnimatedStyle(() => ({ opacity: interpolate(pulse.value, [0, 1], [1, low]) }));
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMin slice">
        <Defs>
          <RadialGradient id="starglow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="0.35" stopColor="#E2EBFF" stopOpacity={0.14} />
            <Stop offset="1" stopColor="#E2EBFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {/* yjet më të ndritshëm kanë edhe një dritë të butë rreth tyre */}
        {stars.map((s, i) => (s.glow ? <Circle key={`g${i}`} cx={s.x} cy={s.y} r={s.r * 4.2} fill="url(#starglow)" opacity={s.o} /> : null))}
        {stars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.c} opacity={s.o} />
        ))}
      </Svg>
    </Animated.View>
  );
}

/** Një re e hollë, e zbehtë, që kalon ngadalë nga e majta në të djathtë (rreth një minutë e gjysmë). */
function Cloud({ width, y, w, duration, delay, opacity, on }: { width: number; y: number; w: number; duration: number; delay: number; opacity: number; on: boolean }) {
  const x = useSharedValue(0);
  useEffect(() => {
    if (!on) return;
    x.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1));
    return () => cancelAnimation(x);
  }, [x, duration, delay, on]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(x.value, [0, 1], [-w, width]) }],
    opacity: on ? interpolate(x.value, [0, 0.12, 0.88, 1], [0, opacity, opacity, 0]) : 0,
  }));
  const h = w * 0.32;
  return (
    <Animated.View style={[{ position: "absolute", left: 0, top: y, width: w, height: h }, style]}>
      <Svg width={w} height={h}>
        <Defs>
          <RadialGradient id="cloud" cx="50%" cy="50%" rx="50%" ry="50%">
            <Stop offset="0" stopColor="#9FB2D6" stopOpacity={0.55} />
            <Stop offset="0.6" stopColor="#7F93BA" stopOpacity={0.18} />
            <Stop offset="1" stopColor="#7F93BA" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w * 0.5} cy={h * 0.55} rx={w * 0.5} ry={h * 0.42} fill="url(#cloud)" />
        <Ellipse cx={w * 0.34} cy={h * 0.42} rx={w * 0.26} ry={h * 0.36} fill="url(#cloud)" />
        <Ellipse cx={w * 0.66} cy={h * 0.46} rx={w * 0.22} ry={h * 0.3} fill="url(#cloud)" />
      </Svg>
    </Animated.View>
  );
}

/** Ylli që bie: një vijë e hollë që shkëlqen dhe shuhet, rreth një herë në 9 sekonda. */
function ShootingStar({ width, height, on }: { width: number; height: number; on: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!on) return;
    p.value = withDelay(
      3000,
      withRepeat(withSequence(withTiming(1, { duration: 1100, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 0 }), withTiming(0, { duration: 8000 })), -1)
    );
    return () => cancelAnimation(p);
  }, [p, on]);
  const len = Math.min(140, width * 0.32);
  const dx = width * 0.42;
  const dy = height * 0.16;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.12, 0.75, 1], [0, 1, 0.7, 0]),
    transform: [{ translateX: p.value * dx }, { translateY: p.value * dy }, { rotate: `${angle}deg` }],
  }));
  return (
    <Animated.View style={[{ position: "absolute", left: width * 0.08, top: height * 0.1, width: len, height: 3 }, style]}>
      <Svg width={len} height={3}>
        <Defs>
          <LinearGradient id="trail" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0.9} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0.5} width={len} height={2} rx={1} fill="url(#trail)" />
        <Circle cx={len - 1.5} cy={1.5} r={1.5} fill="#FFFFFF" />
      </Svg>
    </Animated.View>
  );
}

export const NightSky = memo(function NightSky() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();
  const alive = !reduceMotion;
  const moon = moonFrame(width, insets.top, height);
  const cx = moon.x + moon.size / 2;
  const cy = moon.y + moon.size / 2;
  const stars = useMemo(() => makeStars(width, height, { cx, cy, r: moon.size / 2 }), [width, height, cx, cy, moon.size]);
  // tri grupe yjesh, secili me ritmin e vet të vezullimit
  const groups = useMemo(() => [0, 1, 2].map((g) => stars.filter((_, i) => i % 3 === g)), [stars]);
  const halo = moon.size * 1.9;
  const edge = moon.size / 2 / halo;

  const t1 = useLoop(2600, 0, alive);
  const t2 = useLoop(3700, 900, alive);
  const t3 = useLoop(5100, 1700, alive);
  const breath = useLoop(5200, 0, alive);
  const float = useLoop(7400, 400, alive);

  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(breath.value, [0, 1], [0.78, 1]),
    transform: [{ scale: interpolate(breath.value, [0, 1], [0.98, 1.04]) }],
  }));
  const moonStyle = useAnimatedStyle(() => ({ transform: [{ translateY: interpolate(float.value, [0, 1], [-3, 3]) }] }));

  return (
    <View
      pointerEvents="none"
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={StyleSheet.absoluteFill}
      testID="night-sky"
    >
      {/* Përmasat e dritares si viewBox, të prera poshtë kur ekrani është më i ulët: yjet mbeten rrathë. */}
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMin slice" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={NIGHT_SKY.top} />
            <Stop offset="0.38" stopColor={NIGHT_SKY.mid} />
            <Stop offset="0.72" stopColor={NIGHT_SKY.low} />
            <Stop offset="1" stopColor={NIGHT_SKY.bottom} />
          </LinearGradient>
          {/* drita e Hënës që zbehet butë në qiell */}
          <RadialGradient id="moonlight" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={NIGHT_SKY.moonlight} stopOpacity={0.09} />
            <Stop offset="0.45" stopColor={NIGHT_SKY.moonlight} stopOpacity={0.03} />
            <Stop offset="1" stopColor={NIGHT_SKY.moonlight} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#sky)" />
        <Circle cx={cx} cy={cy} r={Math.max(width, height) * 0.62} fill="url(#moonlight)" />
      </Svg>

      <StarLayer stars={groups[0]} width={width} height={height} pulse={t1} low={0.35} />
      <StarLayer stars={groups[1]} width={width} height={height} pulse={t2} low={0.5} />
      <StarLayer stars={groups[2]} width={width} height={height} pulse={t3} low={0.6} />

      <Cloud width={width} y={height * 0.17} w={width * 0.62} duration={95000} delay={0} opacity={0.22} on={alive} />
      <Cloud width={width} y={height * 0.31} w={width * 0.44} duration={130000} delay={40000} opacity={0.16} on={alive} />

      <ShootingStar width={width} height={height} on={alive} />

      {/* aureola e Hënës që merr frymë */}
      <Animated.View style={[{ position: "absolute", left: cx - halo, top: cy - halo, width: halo * 2, height: halo * 2 }, haloStyle]}>
        <Svg width={halo * 2} height={halo * 2}>
          <Defs>
            <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={NIGHT_SKY.moonlight} stopOpacity={0.3} />
              <Stop offset={edge} stopColor={NIGHT_SKY.moonlight} stopOpacity={0.24} />
              <Stop offset={Math.min(0.95, edge + 0.12)} stopColor={NIGHT_SKY.moonlight} stopOpacity={0.08} />
              <Stop offset={Math.min(0.97, edge + 0.38)} stopColor={NIGHT_SKY.moonlight} stopOpacity={0.025} />
              <Stop offset="1" stopColor={NIGHT_SKY.moonlight} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Circle cx={halo} cy={halo} r={halo} fill="url(#halo)" />
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: "absolute", left: moon.x, top: moon.y, width: moon.size, height: moon.size }, moonStyle]}>
        <Image
          source={require("@/assets/images/night/moon.png")}
          style={{ width: moon.size, height: moon.size, opacity: 0.94 }}
          resizeMode="contain"
          accessible={false}
        />
      </Animated.View>
    </View>
  );
});
