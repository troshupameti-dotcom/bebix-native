import { memo, useMemo } from "react";
import { Image, StyleSheet, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * Qielli i natës pas pamjes së natës: blu e mesnatës shumë e errët, Hëna e vërtetë me një aureolë të butë, dhe yje
 * të vegjël me madhësi e shkëlqim të ndryshëm. Vetëm dekor: s'merr prekje, s'lexohet nga lexuesi i ekranit.
 *
 * - Hëna: `assets/images/night/moon.png` (44 KB), sferë e vizatuar nga harta e Hënës e NASA-s (LRO, CGI Moon Kit,
 *   NASA's Scientific Visualization Studio, svs.gsfc.nasa.gov/4720), me dritë Lommel–Seeliger si te Hëna e vërtetë.
 * - Qielli, aureola dhe yjet: SVG, të vizatuara një herë. Yjet vijnë nga një numër fiks (gjithmonë të njëjtat).
 * - Pa animacion: ekrani rri ndezur me orë të tëra natën, dhe një vezullim i pandërprerë do ta mbante telefonin
 *   duke vizatuar 60 herë në sekondë. `memo` pa props: ora që ndryshon çdo sekondë s'e rivizaton qiellin.
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

export const NightSky = memo(function NightSky() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const moon = moonFrame(width, insets.top, height);
  const cx = moon.x + moon.size / 2;
  const cy = moon.y + moon.size / 2;
  const stars = useMemo(() => makeStars(width, height, { cx, cy, r: moon.size / 2 }), [width, height, cx, cy, moon.size]);
  const halo = moon.size * 1.9;
  const edge = moon.size / 2 / halo;

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
      <Svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMin slice">
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
          {/* aureola e ngushtë rreth diskut */}
          <RadialGradient id="halo" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={NIGHT_SKY.moonlight} stopOpacity={0.3} />
            <Stop offset={edge} stopColor={NIGHT_SKY.moonlight} stopOpacity={0.24} />
            <Stop offset={Math.min(0.95, edge + 0.12)} stopColor={NIGHT_SKY.moonlight} stopOpacity={0.08} />
            <Stop offset={Math.min(0.97, edge + 0.38)} stopColor={NIGHT_SKY.moonlight} stopOpacity={0.025} />
            <Stop offset="1" stopColor={NIGHT_SKY.moonlight} stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="starglow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="0.35" stopColor="#E2EBFF" stopOpacity={0.14} />
            <Stop offset="1" stopColor="#E2EBFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#sky)" />
        <Circle cx={cx} cy={cy} r={Math.max(width, height) * 0.62} fill="url(#moonlight)" />
        {/* yjet më të ndritshëm kanë edhe një dritë të butë rreth tyre */}
        {stars.map((s, i) => (s.glow ? <Circle key={`g${i}`} cx={s.x} cy={s.y} r={s.r * 4.2} fill="url(#starglow)" opacity={s.o} /> : null))}
        {stars.map((s, i) => (
          <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill={s.c} opacity={s.o} />
        ))}
        <Circle cx={cx} cy={cy} r={halo} fill="url(#halo)" />
      </Svg>
      <Image
        source={require("@/assets/images/night/moon.png")}
        style={{ position: "absolute", left: moon.x, top: moon.y, width: moon.size, height: moon.size, opacity: 0.94 }}
        resizeMode="contain"
        accessible={false}
      />
    </View>
  );
});
