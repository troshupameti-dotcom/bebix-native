import { useState, type ReactNode } from "react";
import { Image, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Ellipse, G, Line, Path, Rect } from "react-native-svg";
import type { StoryMeta } from "@/lib/stories/types";

/**
 * Ilustrimet e përrallave, të vizatuara në app (pa skedarë dhe pa lidhje të jashtme): një skenë më vete për çdo
 * përrallë, me ngjyrat e buta të Bebix-it. Janë figura, jo pjesë e temës, ndaj ngjyrat janë fikse dhe duken njësoj
 * në temën e çelët dhe të errët. Përrallat që shtohen më vonë nga baza mund të sjellin foto (`cover_url`, nga
 * bucket-i `story-covers`); pa foto dhe pa skenë të njohur del libri i hapur.
 */
type Scene = { bg: string; draw: () => ReactNode };

const EYE = { stroke: "#5E5346", strokeWidth: 1.8, fill: "none", strokeLinecap: "round" as const };

/** Yll me katër cepa, i butë. */
const sparkle = (x: number, y: number, r: number, fill: string, opacity = 1) => (
  <Path d={`M${x} ${y - r} Q${x} ${y} ${x + r} ${y} Q${x} ${y} ${x} ${y + r} Q${x} ${y} ${x - r} ${y} Q${x} ${y} ${x} ${y - r}Z`} fill={fill} opacity={opacity} />
);

const dots = (points: [number, number, number][], fill: string, opacity = 1) =>
  points.map(([x, y, r], i) => <Circle key={i} cx={x} cy={y} r={r} fill={fill} opacity={opacity} />);

const SCENES: Record<string, Scene> = {
  moon: {
    bg: "#21403F",
    draw: () => (
      <>
        {dots([[18, 20, 1.4], [40, 34, 1], [62, 14, 1.2], [140, 18, 1.4], [148, 46, 1], [28, 52, 1]], "#F3EBD9", 0.8)}
        {sparkle(52, 24, 5, "#F3EBD9")}
        {sparkle(144, 32, 4, "#F3EBD9", 0.9)}
        <Path d="M0 98 Q40 82 80 96 T160 92 V120 H0Z" fill="#183231" />
        <Circle cx={104} cy={50} r={27} fill="#F3EBD9" />
        <Circle cx={95} cy={38} r={4} fill="#E6DAC2" />
        <Circle cx={119} cy={64} r={3} fill="#E6DAC2" />
        <Path d="M93 50 q4 3.5 8 0" {...EYE} />
        <Path d="M107 50 q4 3.5 8 0" {...EYE} />
        <Circle cx={92} cy={57} r={2.6} fill="#E8B9B2" opacity={0.8} />
        <Circle cx={117} cy={57} r={2.6} fill="#E8B9B2" opacity={0.8} />
        <Path d="M100 60 q4 3 8 0" {...EYE} />
        <G fill="#3B5D5B">
          <Ellipse cx={40} cy={74} rx={22} ry={8} />
          <Circle cx={32} cy={68} r={8} />
          <Circle cx={46} cy={65} r={10} />
        </G>
      </>
    ),
  },
  bear: {
    bg: "#DCE6E3",
    draw: () => (
      <>
        {dots([[12, 16, 2], [30, 30, 1.6], [20, 48, 1.8], [140, 14, 2], [150, 34, 1.6], [134, 44, 1.4], [70, 10, 1.4], [100, 16, 1.8]], "#FFFFFF")}
        <Path d="M14 120 V74 Q14 32 80 32 Q146 32 146 74 V120Z" fill="#5D716D" />
        <Path d="M26 120 V78 Q26 44 80 44 Q134 44 134 78 V120Z" fill="#455854" />
        <Circle cx={88} cy={52} r={6} fill="#80604A" />
        <Circle cx={116} cy={52} r={6} fill="#80604A" />
        <Circle cx={102} cy={68} r={18} fill="#80604A" />
        <Path d="M94 68 q3.5 3 7 0" {...EYE} stroke="#3A2C22" />
        <Path d="M105 68 q3.5 3 7 0" {...EYE} stroke="#3A2C22" />
        <Ellipse cx={102} cy={76} rx={6} ry={4} fill="#B89474" />
        <Circle cx={58} cy={66} r={6} fill="#9A7258" />
        <Circle cx={58} cy={66} r={3} fill="#C9A285" />
        <Circle cx={80} cy={66} r={6} fill="#9A7258" />
        <Circle cx={80} cy={66} r={3} fill="#C9A285" />
        <Circle cx={69} cy={80} r={15} fill="#9A7258" />
        <Ellipse cx={69} cy={86} rx={7} ry={5} fill="#D8BFA6" />
        <Ellipse cx={69} cy={83} rx={2.5} ry={1.8} fill="#3A2C22" />
        <Path d="M61 77 q3.5 3 7 0" {...EYE} stroke="#3A2C22" />
        <Path d="M71 77 q3.5 3 7 0" {...EYE} stroke="#3A2C22" />
        <Path d="M36 96 Q80 86 126 92 L130 120 H32Z" fill="#8F4E5A" />
        <Path d="M40 104 Q80 96 128 101 M38 113 Q80 105 129 110" stroke="#E0A5AE" strokeWidth={2} fill="none" />
      </>
    ),
  },
  fox: {
    bg: "#E4ECDF",
    draw: () => (
      <>
        <Path d="M18 96 L34 38 L50 96Z" fill="#A9C2AE" />
        <Path d="M118 96 L136 30 L154 96Z" fill="#A9C2AE" />
        <Path d="M104 96 L116 52 L128 96Z" fill="#8FAF98" />
        <Path d="M-2 104 L14 50 L30 104Z" fill="#5F8270" />
        <Path d="M0 98 Q80 88 160 100 V120 H0Z" fill="#C9D8C3" />
        <Path d="M96 104 Q130 102 124 72 Q118 90 96 90Z" fill="#C7714A" />
        <Path d="M124 72 Q128 82 121 88 Q117 80 124 72Z" fill="#FAF5EE" />
        <Path d="M64 106 Q62 78 80 72 Q98 78 96 106Z" fill="#C7714A" />
        <Path d="M73 106 Q71 88 80 82 Q89 88 87 106Z" fill="#FAF5EE" />
        <Path d="M63 60 L68 40 L76 53 L84 53 L92 40 L97 60 Q97 72 80 76 Q63 72 63 60Z" fill="#C7714A" />
        <Path d="M68 46 L70 53 L74 52Z M92 46 L90 53 L86 52Z" fill="#7A3F2A" />
        <Path d="M63 60 Q72 64 80 76 Q66 72 63 60Z M97 60 Q88 64 80 76 Q94 72 97 60Z" fill="#FAF5EE" />
        <Circle cx={74} cy={60} r={1.9} fill="#2E2620" />
        <Circle cx={86} cy={60} r={1.9} fill="#2E2620" />
        <Circle cx={80} cy={72} r={2.1} fill="#2E2620" />
        <G fill="#B9C6C2">
          <Ellipse cx={58} cy={22} rx={18} ry={7} />
          <Circle cx={52} cy={17} r={7} />
          <Circle cx={63} cy={15} r={8} />
        </G>
      </>
    ),
  },
  snail: {
    bg: "#F2ECE2",
    draw: () => (
      <>
        <Path d="M0 100 Q80 92 160 100 V120 H0Z" fill="#B7CDB0" />
        <Line x1={132} y1={100} x2={132} y2={58} stroke="#6E9B7B" strokeWidth={3} />
        <Path d="M132 82 Q120 78 118 70 Q128 70 132 82Z" fill="#87B08F" />
        {dots([[132, 46, 6.5], [143, 54, 6.5], [139, 66, 6.5], [125, 66, 6.5], [121, 54, 6.5]], "#E8C46B")}
        <Circle cx={132} cy={57} r={5} fill="#C9853F" />
        <Path d="M30 100 Q30 92 40 92 L92 92 Q100 92 102 84 L104 76 Q108 73 111 78 L111 92 Q111 100 100 100Z" fill="#C2AE93" />
        <Circle cx={66} cy={73} r={20} fill="#B07D5B" />
        <Path d="M66 73 a4 4 0 1 1 4 4 a8 8 0 1 1 -8 -8 a12 12 0 1 1 12 12 a15 15 0 0 1 -15 -15" stroke="#7E5440" strokeWidth={2.4} fill="none" strokeLinecap="round" />
        <Line x1={104} y1={78} x2={99} y2={64} stroke="#C2AE93" strokeWidth={2} strokeLinecap="round" />
        <Line x1={109} y1={78} x2={113} y2={64} stroke="#C2AE93" strokeWidth={2} strokeLinecap="round" />
        <Circle cx={99} cy={63} r={2.4} fill="#7E5440" />
        <Circle cx={113} cy={63} r={2.4} fill="#7E5440" />
        <Circle cx={106} cy={84} r={1.6} fill="#3A2E25" />
        <Path d="M102 89 q3 2.5 6 0" {...EYE} strokeWidth={1.4} />
        <Path d="M20 86 q-3 5 0 7 q3 -2 0 -7Z" fill="#8FC0CF" />
        <Ellipse cx={34} cy={24} rx={6} ry={4.5} fill="#E8C46B" />
        <Path d="M31 21 v6 M35 20 v8" stroke="#5E4A2E" strokeWidth={1.4} />
        <Ellipse cx={33} cy={18} rx={4} ry={3} fill="#FFFFFF" opacity={0.85} />
      </>
    ),
  },
  boat: {
    bg: "#DDEBEB",
    draw: () => (
      <>
        <G fill="#FFFFFF">
          <Ellipse cx={34} cy={24} rx={18} ry={6} />
          <Circle cx={28} cy={20} r={7} />
          <Circle cx={39} cy={18} r={8} />
        </G>
        <Path d="M0 78 Q20 72 40 78 T80 78 T120 78 T160 78 V120 H0Z" fill="#9EC4C5" />
        <Path d="M0 94 Q20 88 40 94 T80 94 T120 94 T160 94 V120 H0Z" fill="#7FA9AC" />
        <Path d="M46 74 L114 74 L102 90 L58 90Z" fill="#FFFFFF" stroke="#5F7A80" strokeWidth={1.5} strokeLinejoin="round" />
        <Path d="M80 30 L80 74 L52 74Z" fill="#FFFFFF" stroke="#5F7A80" strokeWidth={1.5} strokeLinejoin="round" />
        <Path d="M80 40 L80 74 L104 74Z" fill="#F3F1EC" stroke="#5F7A80" strokeWidth={1.5} strokeLinejoin="round" />
        <Line x1={80} y1={30} x2={80} y2={19} stroke="#5F7A80" strokeWidth={1.5} />
        <Path d="M80 19 L93 23 L80 27Z" fill="#8F4E5A" />
        <Circle cx={68} cy={82} r={3} fill="none" stroke="#4C7FA8" strokeWidth={1.4} />
        <Ellipse cx={132} cy={84} rx={9} ry={5} fill="#E8C46B" />
        <Circle cx={139} cy={76} r={4.5} fill="#E8C46B" />
        <Path d="M143 75 L148 77 L143 79Z" fill="#C9853F" />
        <Circle cx={140} cy={75} r={0.9} fill="#2E2620" />
      </>
    ),
  },
  umbrella: {
    bg: "#D8E0E2",
    draw: () => (
      <>
        {[[14, 10], [34, 30], [24, 58], [130, 12], [148, 36], [140, 64], [56, 8], [108, 6], [10, 84], [150, 88]].map(([x, y], i) => (
          <Line key={i} x1={x} y1={y} x2={x - 3} y2={y + 9} stroke="#A2B6BC" strokeWidth={1.6} strokeLinecap="round" />
        ))}
        <Ellipse cx={80} cy={110} rx={46} ry={6} fill="#B3C7CC" />
        <Path d="M80 62 L80 96 Q80 101 75 101" stroke="#6B5A45" strokeWidth={2.2} fill="none" strokeLinecap="round" />
        <Line x1={68} y1={94} x2={68} y2={108} stroke="#5E5346" strokeWidth={2.4} strokeLinecap="round" />
        <Line x1={74} y1={94} x2={74} y2={108} stroke="#5E5346" strokeWidth={2.4} strokeLinecap="round" />
        <Line x1={88} y1={94} x2={88} y2={108} stroke="#5E5346" strokeWidth={2.4} strokeLinecap="round" />
        <Line x1={94} y1={94} x2={94} y2={108} stroke="#5E5346" strokeWidth={2.4} strokeLinecap="round" />
        <Rect x={61} y={76} width={19} height={21} rx={8} fill="#8F4E5A" />
        <Rect x={81} y={76} width={19} height={21} rx={8} fill="#3F6E6A" />
        <Circle cx={70} cy={70} r={7} fill="#E3C2A6" />
        <Circle cx={91} cy={70} r={7} fill="#D9B08F" />
        <Path d="M63 69 Q63 61 70 61 Q77 61 77 69 Q72 64 63 69Z" fill="#5A3E2E" />
        <Path d="M84 69 Q84 61 91 61 Q98 61 98 69 Q92 65 84 69Z" fill="#8A5A3C" />
        <Path d="M67 73 q3 2 6 0 M88 73 q3 2 6 0" {...EYE} strokeWidth={1.2} />
        <Path d="M38 62 Q80 20 122 62 Q115 56 108 62 Q101 56 94 62 Q87 56 80 62 Q73 56 66 62 Q59 56 52 62 Q45 56 38 62Z" fill="#E8C25A" />
        <Path d="M80 26 L80 62 M80 26 Q66 40 66 62 M80 26 Q94 40 94 62" stroke="#C9A040" strokeWidth={1.2} fill="none" />
        <Line x1={80} y1={26} x2={80} y2={21} stroke="#6B5A45" strokeWidth={2} strokeLinecap="round" />
      </>
    ),
  },
  cloud: {
    bg: "#E2EDF1",
    draw: () => (
      <>
        <Path d="M18 112 A62 62 0 0 1 142 112" stroke="#E0A5AE" strokeWidth={7} fill="none" />
        <Path d="M25 112 A55 55 0 0 1 135 112" stroke="#E8C77A" strokeWidth={7} fill="none" />
        <Path d="M32 112 A48 48 0 0 1 128 112" stroke="#A8CBB0" strokeWidth={7} fill="none" />
        <Path d="M39 112 A41 41 0 0 1 121 112" stroke="#9EC4C5" strokeWidth={7} fill="none" />
        <Path d="M0 108 Q80 100 160 108 V120 H0Z" fill="#B7CDB0" />
        {dots([[24, 106, 3], [44, 110, 2.6], [118, 108, 3], [138, 104, 2.6]], "#E0A5AE")}
        <G fill="#C7D0D3">
          <Ellipse cx={80} cy={46} rx={36} ry={15} />
          <Circle cx={63} cy={38} r={14} />
          <Circle cx={86} cy={30} r={18} />
          <Circle cx={104} cy={41} r={12} />
        </G>
        <Path d="M72 44 q3.5 -3 7 0 M88 44 q3.5 -3 7 0" {...EYE} stroke="#6E7C80" />
        <Path d="M80 51 q3 2 6 0" {...EYE} stroke="#6E7C80" />
        <Path d="M71 50 q-2.2 4.5 0 6.5 q2.2 -2 0 -6.5Z" fill="#7FB3C7" />
      </>
    ),
  },
  star: {
    bg: "#1E3940",
    draw: () => (
      <>
        {dots([[14, 14, 1.2], [36, 26, 1], [58, 10, 1.1], [112, 12, 1.2], [136, 26, 1], [150, 10, 1.3], [24, 50, 1], [146, 54, 1.1], [124, 44, 0.9]], "#CFE0DD", 0.7)}
        <Circle cx={80} cy={30} r={16} fill="#F6EAC8" opacity={0.14} />
        {sparkle(80, 30, 10, "#F6EAC8")}
        <Path d="M0 106 Q30 96 56 104 V120 H0Z M104 104 Q130 96 160 104 V120 H104Z" fill="#163036" />
        <Path d="M50 120 V88 L80 64 L110 88 V120Z" fill="#2E4F55" />
        <Path d="M44 90 L80 60 L116 90" stroke="#3E6268" strokeWidth={6} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        <Rect x={69} y={92} width={22} height={17} rx={2} fill="#F1DDA6" />
        <Circle cx={80} cy={100} r={3.6} fill="#2E4F55" />
        <Path d="M74 109 Q74 104 80 104 Q86 104 86 109Z" fill="#2E4F55" />
        <Path d="M80 92 V109 M69 100.5 H76 M84 100.5 H91" stroke="#2E4F55" strokeWidth={1} />
      </>
    ),
  },
  owl: {
    bg: "#243D3A",
    draw: () => (
      <>
        {dots([[16, 20, 1.2], [40, 12, 1], [104, 14, 1.1], [150, 46, 1], [20, 56, 1], [60, 30, 0.9]], "#E8E1D2", 0.75)}
        <Circle cx={130} cy={24} r={10} fill="#EFE6D2" />
        <Circle cx={135} cy={20} r={9} fill="#243D3A" />
        <Path d="M6 90 Q80 80 154 92" stroke="#5B4A3B" strokeWidth={6} fill="none" strokeLinecap="round" />
        <Ellipse cx={28} cy={84} rx={7} ry={3.5} fill="#3F5F55" />
        <Ellipse cx={134} cy={86} rx={7} ry={3.5} fill="#3F5F55" />
        <Path d="M64 48 L67 36 L75 45Z M96 48 L93 36 L85 45Z" fill="#A88C6E" />
        <Ellipse cx={80} cy={64} rx={19} ry={23} fill="#A88C6E" />
        <Path d="M61 62 Q56 76 66 84 Q64 72 61 62Z M99 62 Q104 76 94 84 Q96 72 99 62Z" fill="#8C735A" />
        <Ellipse cx={80} cy={71} rx={11} ry={14} fill="#D9C4A6" />
        <Path d="M75 66 q2 2 4 0 M81 66 q2 2 4 0 M75 72 q2 2 4 0 M81 72 q2 2 4 0 M78 78 q2 2 4 0" stroke="#B9A07F" strokeWidth={1} fill="none" />
        <Circle cx={73} cy={55} r={7} fill="#F6F1E7" />
        <Circle cx={87} cy={55} r={7} fill="#F6F1E7" />
        <Circle cx={73.5} cy={55.5} r={3.2} fill="#2C2420" />
        <Circle cx={86.5} cy={55.5} r={3.2} fill="#2C2420" />
        <Path d="M78 61 L82 61 L80 65.5Z" fill="#C9853F" />
        <Path d="M73 86 v4 M77 86 v4 M83 86 v4 M87 86 v4" stroke="#C9853F" strokeWidth={1.8} strokeLinecap="round" />
      </>
    ),
  },
  lamb: {
    bg: "#E6EFE1",
    draw: () => (
      <>
        <Path d="M0 70 Q80 60 160 70 V120 H0Z" fill="#BFD6B4" />
        <Path d="M0 86 Q80 78 160 88 V102 Q80 94 0 100Z" fill="#9EC4C5" />
        <Rect x={54} y={82} width={58} height={8} rx={2} fill="#A9825F" />
        <Path d="M60 82 v8 M68 82 v8 M76 82 v8 M84 82 v8 M92 82 v8 M100 82 v8" stroke="#8C6A4C" strokeWidth={1} />
        <Path d="M56 82 V73 M110 82 V73 M56 74 H110" stroke="#7E5F44" strokeWidth={2} strokeLinecap="round" />
        {dots([[124, 80, 2.2], [134, 74, 2.2], [144, 82, 2.2], [130, 108, 2.2], [146, 104, 2.2]], "#7FA37A")}
        {dots([[128, 76, 1.4], [140, 78, 1.4], [138, 106, 1.4]], "#FFFFFF")}
        <Line x1={28} y1={80} x2={28} y2={92} stroke="#4C4338" strokeWidth={2.6} strokeLinecap="round" />
        <Line x1={42} y1={80} x2={42} y2={92} stroke="#4C4338" strokeWidth={2.6} strokeLinecap="round" />
        <Ellipse cx={35} cy={82} rx={17} ry={3} fill="#9DB894" />
        {dots([[26, 70, 8], [35, 65, 8.5], [44, 70, 8], [30, 77, 7.5], [41, 77, 7.5]], "#FBF8F2")}
        <Ellipse cx={52} cy={66} rx={6} ry={7.5} fill="#4C4338" />
        <Ellipse cx={47} cy={62} rx={4} ry={2} fill="#4C4338" />
        <Circle cx={53.5} cy={64} r={1.2} fill="#FBF8F2" />
      </>
    ),
  },
  seed: {
    bg: "#F3ECE1",
    draw: () => (
      <>
        <Circle cx={132} cy={24} r={12} fill="#EBCB7A" />
        <Path d="M132 6 v4 M132 38 v4 M114 24 h4 M146 24 h4 M119 11 l3 3 M142 34 l3 3 M145 11 l-3 3 M122 34 l-3 3" stroke="#EBCB7A" strokeWidth={2} strokeLinecap="round" />
        <Path d="M30 40 q-2.5 5 0 7.5 q2.5 -2.5 0 -7.5Z M40 52 q-2.5 5 0 7.5 q2.5 -2.5 0 -7.5Z M24 60 q-2.5 5 0 7.5 q2.5 -2.5 0 -7.5Z" fill="#8FC0CF" />
        <Path d="M80 86 Q78 66 80 46" stroke="#6E9B7B" strokeWidth={3} fill="none" strokeLinecap="round" />
        <Path d="M80 72 Q66 66 64 55 Q76 57 80 72Z" fill="#87B08F" />
        <Path d="M80 64 Q94 58 96 47 Q84 49 80 64Z" fill="#87B08F" />
        {dots([[80, 31, 6], [89, 37, 6], [86, 47, 6], [74, 47, 6], [71, 37, 6]], "#C2605E")}
        <Circle cx={80} cy={40} r={4.2} fill="#EBCB7A" />
        <Path d="M56 84 H104 L99 112 Q98 116 94 116 H66 Q62 116 61 112Z" fill="#C08A6B" />
        <Rect x={52} y={80} width={56} height={8} rx={3} fill="#A9745A" />
        <Path d="M118 60 Q106 48 109 62 Q113 65 118 60Z M118 60 Q130 48 127 62 Q123 65 118 60Z" fill="#9EC4C5" />
        <Line x1={118} y1={54} x2={118} y2={66} stroke="#5E5346" strokeWidth={1.4} strokeLinecap="round" />
      </>
    ),
  },
  turtle: {
    bg: "#E8EEDD",
    draw: () => (
      <>
        <Path d="M0 94 Q60 72 120 88 T160 86 V120 H0Z" fill="#C3D6B7" />
        <Rect x={128} y={56} width={8} height={34} rx={2} fill="#7E5F44" />
        {dots([[132, 44, 16], [120, 52, 10], [144, 52, 10]], "#7FA37A")}
        <Ellipse cx={108} cy={98} rx={14} ry={7.5} fill="#B7A99A" />
        <Circle cx={121} cy={94} r={7} fill="#B7A99A" />
        <Path d="M118 89 Q108 76 114 74 Q120 78 122 88Z M122 88 Q118 74 124 73 Q129 78 125 88Z" fill="#B7A99A" />
        <Path d="M117 94 q2.5 2 5 0" {...EYE} strokeWidth={1.3} />
        <Path d="M132 72 h6 l-6 6 h6 M142 62 h4 l-4 4 h4" stroke="#6E7C80" strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Ellipse cx={36} cy={104} rx={5} ry={3} fill="#A7B98E" />
        <Ellipse cx={68} cy={104} rx={5} ry={3} fill="#A7B98E" />
        <Circle cx={81} cy={95} r={6.5} fill="#A7B98E" />
        <Circle cx={83.5} cy={93.5} r={1.2} fill="#2E2620" />
        <Path d="M26 102 Q28 74 52 74 Q76 74 78 102Z" fill="#6E8F6A" />
        <Path d="M40 80 L52 86 L64 80 M52 86 V100 M34 92 L42 96 M70 92 L62 96" stroke="#4F6F4C" strokeWidth={1.6} fill="none" strokeLinecap="round" />
      </>
    ),
  },
  mice: {
    bg: "#EFE7DA",
    draw: () => (
      <>
        <Path d="M0 50 Q30 38 64 48 V96 H0Z" fill="#CFDDBF" />
        <Path d="M22 50 v-12" stroke="#7E5F44" strokeWidth={3} strokeLinecap="round" />
        <Circle cx={22} cy={32} r={9} fill="#8FAF7A" />
        <Path d="M30 34 q-3 0 -3 4 q0 4 3 4 q3 0 3 -4 q0 -4 -3 -4Z" fill="#D9C46A" />
        <Rect x={96} y={30} width={56} height={44} rx={4} fill="#E4D6C2" />
        <Path d="M96 52 H152 M124 30 V74" stroke="#D0C0A8" strokeWidth={2} />
        <Rect x={0} y={96} width={160} height={24} fill="#D9CBB5" />
        <Path d="M30 104 Q14 104 12 94" stroke="#B08F72" strokeWidth={2} fill="none" strokeLinecap="round" />
        <Ellipse cx={42} cy={92} rx={15} ry={11} fill="#B08F72" />
        <Circle cx={56} cy={80} r={6} fill="#B08F72" />
        <Circle cx={56} cy={80} r={3.4} fill="#E9B9BE" />
        <Circle cx={60} cy={88} r={9} fill="#B08F72" />
        <Circle cx={63} cy={86} r={1.5} fill="#2E2620" />
        <Circle cx={69} cy={90} r={1.8} fill="#6B4B3E" />
        <Path d="M130 104 Q146 104 148 94" stroke="#A9A39B" strokeWidth={2} fill="none" strokeLinecap="round" />
        <Ellipse cx={118} cy={92} rx={15} ry={11} fill="#A9A39B" />
        <Circle cx={104} cy={80} r={6} fill="#A9A39B" />
        <Circle cx={104} cy={80} r={3.4} fill="#E9B9BE" />
        <Circle cx={100} cy={88} r={9} fill="#A9A39B" />
        <Circle cx={97} cy={86} r={1.5} fill="#2E2620" />
        <Circle cx={91} cy={90} r={1.8} fill="#6B4B3E" />
        <Path d="M107 98 l-4 -3 v6Z M107 98 l4 -3 v6Z" fill="#8F4E5A" />
        <Path d="M68 106 L92 106 L92 92Z" fill="#EBCB6E" />
        {dots([[86, 101, 1.6], [90, 97, 1.1], [80, 103, 1.2]], "#D6B04F")}
      </>
    ),
  },
  house: {
    bg: "#2F4C4A",
    draw: () => (
      <>
        {dots([[18, 18, 1.2], [44, 30, 1], [70, 12, 1.1], [102, 22, 1], [24, 48, 0.9]], "#EDE4D0", 0.75)}
        <Circle cx={134} cy={26} r={11} fill="#F1E6CC" />
        <Circle cx={139} cy={22} r={10} fill="#2F4C4A" />
        <Path d="M0 104 Q80 94 160 104 V120 H0Z" fill="#223B39" />
        <Rect x={94} y={42} width={8} height={14} fill="#7A3F4A" />
        <Rect x={54} y={64} width={52} height={44} fill="#E9DFD0" />
        <Path d="M47 67 L80 39 L113 67Z" fill="#8F4E5A" />
        <Rect x={60} y={74} width={11} height={11} rx={1.5} fill="#F1DDA6" />
        <Rect x={89} y={74} width={11} height={11} rx={1.5} fill="#F1DDA6" />
        <Path d="M74 108 V94 Q74 88 80 88 Q86 88 86 94 V108Z" fill="#5D4636" />
        <Ellipse cx={30} cy={104} rx={9} ry={6} fill="#162826" />
        <Circle cx={38} cy={98} r={4.6} fill="#162826" />
        <Path d="M35 95 L35.5 90 L39 94Z M39.5 94 L42 90 L42.5 95Z" fill="#162826" />
        <Path d="M21 104 Q14 100 16 92" stroke="#162826" strokeWidth={2.4} fill="none" strokeLinecap="round" />
      </>
    ),
  },
};

const BOOK: Scene = {
  bg: "#EFE9E1",
  draw: () => (
    <>
      {sparkle(80, 22, 7, "#C9A86A")}
      <Path d="M80 44 Q60 36 34 40 V94 Q60 90 80 98Z" fill="#FFFFFF" stroke="#B9AE9E" strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M80 44 Q100 36 126 40 V94 Q100 90 80 98Z" fill="#FFFFFF" stroke="#B9AE9E" strokeWidth={1.5} strokeLinejoin="round" />
      <Path d="M42 52 Q58 49 72 54 M42 62 Q58 59 72 64 M42 72 Q58 69 72 74 M88 54 Q102 49 118 52 M88 64 Q102 59 118 62 M88 74 Q102 69 118 72" stroke="#D0C6B8" strokeWidth={1.5} fill="none" strokeLinecap="round" />
    </>
  ),
};

/** Skenat e njohura; testi kontrollon që çdo përrallë e app-it ka të sajën dhe që s'përsëriten. */
export const STORY_SCENES = Object.keys(SCENES);

type Props = {
  story: Pick<StoryMeta, "cover" | "coverUrl">;
  style?: StyleProp<ViewStyle>;
  /** Rrumbullakimi i qosheve. */
  radius?: number;
};

export function StoryCover({ story, style, radius = 18 }: Props) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const scene = (story.cover && SCENES[story.cover]) || BOOK;
  const photo = story.coverUrl && !photoFailed ? story.coverUrl : null;
  return (
    <View
      style={[{ overflow: "hidden", borderRadius: radius, backgroundColor: scene.bg }, style]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {photo ? (
        <Image source={{ uri: photo }} style={{ width: "100%", height: "100%" }} resizeMode="cover" onError={() => setPhotoFailed(true)} />
      ) : (
        <Svg width="100%" height="100%" viewBox="0 0 160 120" preserveAspectRatio="xMidYMid slice">
          <Rect x={0} y={0} width={160} height={120} fill={scene.bg} />
          {scene.draw()}
        </Svg>
      )}
    </View>
  );
}
