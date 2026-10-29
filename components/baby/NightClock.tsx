import Svg, { Circle, Defs, Line, RadialGradient, Stop } from "react-native-svg";
import type { NightTextColor } from "@/lib/baby/nightMode";

/**
 * Ngjyrat e natës: e kuqe mbi të zezë të plotë. Drita e kuqe e ndal më pak melatoninën se e bardha dhe e kaltra
 * (pra prindi dhe bebi rikthehen më lehtë në gjumë), dhe në ekranet OLED e zeza e plotë do të thotë piksel i fikur.
 * Ngjyrat s'kanë pothuajse fare të kaltër: as teksti më i ndritshëm s'kalon 11% të kaltër (#F5361B).
 */
export const NIGHT_COLORS = {
  bg: "#000000",
  text: "#F5361B",
  soft: "#A82614",
  faint: "#5E1409",
  panel: "#070100",
  button: "#150301",
  buttonOn: "#3F0A03",
  line: "#2B0602",
  /** Fytyra e orës analoge (qendra dhe mesi i gradientit). */
  faceCenter: "#1A0402",
  faceMid: "#0A0100",
  /** Drita e kuqe: ngjyra e plotë, fuqia vjen nga ndriçimi dhe tejdukshmëria. */
  glow: "#FF1A00",
};
export type NightPalette = typeof NIGHT_COLORS;

/**
 * Ngjyrat e shkrimeve që zgjedh prindi te cilësimet. E kuqja (më sipër) mbetet parazgjedhja; të tjerat janë më të
 * ndritshme dhe kanë më shumë dritë të kaltër. Sfondi mbetet i zi dhe drita e kuqe (`glow`) mbetet e kuqe kudo.
 */
export const NIGHT_PALETTES: Record<NightTextColor, NightPalette> = {
  red: NIGHT_COLORS,
  // e bardha e ftohtë e Hënës
  silver: { ...NIGHT_COLORS, text: "#D9E0EA", soft: "#939CAC", faint: "#4A5160", panel: "#030406", button: "#0D1119", buttonOn: "#1F2632", line: "#1A1F29", faceCenter: "#141A24", faceMid: "#080B10" },
  // bluja e butë e "x"-it të logos
  blue: { ...NIGHT_COLORS, text: "#8DB5DE", soft: "#5F82A8", faint: "#2F4560", panel: "#020509", button: "#0A1322", buttonOn: "#172A44", line: "#132138", faceCenter: "#0E1A2C", faceMid: "#060B14" },
  // rozë e ngrohtë (jo vjollcë)
  rose: { ...NIGHT_COLORS, text: "#F2A7AF", soft: "#AE7077", faint: "#5C383D", panel: "#060203", button: "#190C0F", buttonOn: "#3A1C21", line: "#2C1519", faceCenter: "#22100F", faceMid: "#0E0606" },
};

/** Ngjyrat për zgjedhjen e ruajtur; çdo vlerë e panjohur bie te e kuqja. */
export function nightPalette(color: NightTextColor | undefined): NightPalette {
  return (color && NIGHT_PALETTES[color]) || NIGHT_COLORS;
}

/**
 * Ora e murit, e rrumbullakët, pa numra: 60 vija (ato të orëve më të gjata dhe
 * më të trasha), akrepat e orës dhe të minutës, dhe një akrep i hollë sekondash.
 * Fytyra ka një gradient të butë që e bën të duket e thellë, jo e sheshtë.
 */
export function AnalogNightClock({ now, size = 240, colors: C = NIGHT_COLORS }: { now: Date; size?: number; colors?: NightPalette }) {
  const r = size / 2;
  const cx = r;
  const cy = r;
  const h = now.getHours() % 12;
  const m = now.getMinutes();
  const sec = now.getSeconds();

  // Këndet në gradë: 0 = ora 12, në drejtim të akrepave.
  const hourAngle = (h + m / 60) * 30;
  const minuteAngle = (m + sec / 60) * 6;
  const secondAngle = sec * 6;

  const point = (angle: number, length: number) => {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + length * Math.cos(rad), y: cy + length * Math.sin(rad) };
  };

  const ticks = Array.from({ length: 60 }, (_, i) => {
    const isHour = i % 5 === 0;
    const isQuarter = i % 15 === 0;
    const outer = r * 0.9;
    const inner = isQuarter ? r * 0.74 : isHour ? r * 0.78 : r * 0.85;
    const a = point(i * 6, outer);
    const b = point(i * 6, inner);
    return (
      <Line
        key={i}
        x1={a.x}
        y1={a.y}
        x2={b.x}
        y2={b.y}
        stroke={isHour ? C.text : C.faint}
        strokeWidth={isQuarter ? 3.4 : isHour ? 2.4 : 1}
        strokeLinecap="round"
        opacity={isHour ? 0.95 : 0.7}
      />
    );
  });

  const hand = (angle: number, length: number, tail: number, width: number, color: string) => {
    const tip = point(angle, length);
    const back = point(angle + 180, tail);
    return <Line x1={back.x} y1={back.y} x2={tip.x} y2={tip.y} stroke={color} strokeWidth={width} strokeLinecap="round" />;
  };

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} accessibilityRole="image">
      <Defs>
        <RadialGradient id="face" cx="50%" cy="42%" r="60%">
          <Stop offset="0%" stopColor={C.faceCenter} />
          <Stop offset="70%" stopColor={C.faceMid} />
          <Stop offset="100%" stopColor={C.bg} />
        </RadialGradient>
      </Defs>
      {/* Fytyra dhe dy unaza të holla (buza e orës). */}
      <Circle cx={cx} cy={cy} r={r - 1} fill="url(#face)" />
      <Circle cx={cx} cy={cy} r={r - 2} fill="none" stroke={C.line} strokeWidth={2} />
      <Circle cx={cx} cy={cy} r={r * 0.95} fill="none" stroke={C.line} strokeWidth={0.8} opacity={0.6} />
      {ticks}
      {hand(hourAngle, r * 0.5, r * 0.08, 6, C.text)}
      {hand(minuteAngle, r * 0.72, r * 0.1, 3.6, C.text)}
      {hand(secondAngle, r * 0.8, r * 0.16, 1.2, C.soft)}
      <Circle cx={cx} cy={cy} r={6} fill={C.text} />
      <Circle cx={cx} cy={cy} r={2.4} fill={C.bg} />
    </Svg>
  );
}
