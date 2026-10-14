import { useState } from "react";
import { Text, View } from "react-native";
import Svg, { Circle, Line, Rect } from "react-native-svg";
import { NIGHT_COLORS as C } from "@/components/baby/NightClock";
import { positionIn, type NightSummary } from "@/lib/baby/nightSummary";

const HEIGHT = 30;
const BAR_Y = 11;
const BAR_H = 8;

const hh = (t: number) => String(new Date(t).getHours()).padStart(2, "0");

/**
 * "Nata deri tani" me një shikim: gjumi si shirita, ushqimet si pika sipër, pelenat si vija poshtë, dhe "tani"
 * si vijë vertikale. Pa animacione; orët në skaje dhe në mes.
 */
export function NightTimeline({ summary, now, label }: { summary: NightSummary; now: Date; label: string }) {
  const [width, setWidth] = useState(0);
  const { range } = summary;
  const x = (t: number) => positionIn(range, t) * width;
  const mid = range.start + (range.end - range.start) / 2;

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? (
        <Svg width={width} height={HEIGHT}>
          <Rect x={0} y={BAR_Y} width={width} height={BAR_H} rx={BAR_H / 2} fill={C.button} />
          {summary.sleeps.map((s, i) => (
            <Rect key={`s${i}`} x={x(s.start)} y={BAR_Y} width={Math.max(3, x(s.end) - x(s.start))} height={BAR_H} rx={BAR_H / 2} fill={C.soft} />
          ))}
          {summary.feedings.map((t, i) => (
            <Circle key={`f${i}`} cx={Math.min(width - 3, Math.max(3, x(t)))} cy={4} r={3} fill={C.text} />
          ))}
          {summary.diapers.map((t, i) => (
            <Line key={`d${i}`} x1={x(t)} x2={x(t)} y1={BAR_Y + BAR_H + 3} y2={HEIGHT - 1} stroke={C.soft} strokeWidth={2} strokeLinecap="round" />
          ))}
          <Line x1={x(now.getTime())} x2={x(now.getTime())} y1={BAR_Y - 4} y2={BAR_Y + BAR_H + 4} stroke={C.text} strokeWidth={2} strokeLinecap="round" />
        </Svg>
      ) : (
        <View style={{ height: HEIGHT }} />
      )}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
        {[range.start, mid, range.end].map((t) => (
          <Text key={t} style={{ color: C.faint, fontSize: 11, fontFamily: "Inter_500Medium" }}>
            {hh(t)}
          </Text>
        ))}
      </View>
    </View>
  );
}
