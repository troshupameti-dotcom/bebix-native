import { useRef } from "react";
import { View, Text, Pressable, ScrollView } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { ChevronRight, RotateCcw } from "lucide-react-native";
import { StoryCover } from "@/components/stories/StoryCover";
import type { Block, BookMetrics } from "@/components/stories/book/layout";
import type { BookFonts, ReaderTheme } from "@/components/stories/book/theme";
import type { StoryMeta } from "@/lib/stories/types";

/** Zbukurimi i vogël mes titullit dhe tekstit: dy vija dhe një yll. */
export function Ornament({ color, width = 90 }: { color: string; width?: number }) {
  const c = width / 2;
  return (
    <Svg width={width} height={14} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Line x1={4} y1={7} x2={c - 12} y2={7} stroke={color} strokeWidth={1} strokeLinecap="round" />
      <Line x1={c + 12} y1={7} x2={width - 4} y2={7} stroke={color} strokeWidth={1} strokeLinecap="round" />
      <Path d={`M${c} 1 Q${c} 7 ${c + 6} 7 Q${c} 7 ${c} 13 Q${c} 7 ${c - 6} 7 Q${c} 7 ${c} 1Z`} fill={color} />
    </Svg>
  );
}

const textStyle = (m: BookMetrics, fonts: BookFonts, theme: ReaderTheme) => ({
  fontFamily: fonts.body,
  fontSize: m.fontSize,
  lineHeight: m.lineHeight,
  color: theme.text,
});

/**
 * Matja e rreshtave: paragrafët shkruhen të padukshëm me të njëjtën gjerësi dhe shkronjë si faqja, dhe telefoni
 * tregon ku thyhet çdo rresht. Komponenti rimatet (key) kur ndryshon shkronja, madhësia ose gjerësia.
 */
export function MeasureLines({
  paragraphs,
  metrics,
  fonts,
  theme,
  onDone,
}: {
  paragraphs: string[];
  metrics: BookMetrics;
  fonts: BookFonts;
  theme: ReaderTheme;
  onDone: (lines: string[][]) => void;
}) {
  const results = useRef<(string[] | undefined)[]>([]);
  const sent = useRef(false);
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: "absolute", left: 0, top: 0, width: metrics.innerW, opacity: 0 }}
    >
      {paragraphs.map((p, i) => (
        <Text
          key={i}
          android_hyphenationFrequency="none"
          style={[textStyle(metrics, fonts, theme), { width: metrics.innerW }]}
          onTextLayout={(e) => {
            results.current[i] = e.nativeEvent.lines.map((l) => l.text);
            if (!sent.current && paragraphs.every((_, j) => results.current[j])) {
              sent.current = true;
              onDone(results.current as string[][]);
            }
          }}
        >
          {p}
        </Text>
      ))}
    </View>
  );
}

type CoverProps = {
  story: Pick<StoryMeta, "title" | "cover" | "coverUrl">;
  metrics: BookMetrics;
  fonts: BookFonts;
  theme: ReaderTheme;
  byline: string;
  meta: string;
  hint?: string;
};

/** Faqja e titullit: ilustrimi në kornizë, titulli, zbukurimi dhe koha e leximit. */
export function CoverPage({ story, metrics: m, fonts, theme, byline, meta, hint }: CoverProps) {
  const artH = Math.round(Math.min(m.innerW * 0.82, m.innerH * 0.5));
  const titleSize = Math.round(Math.min(34, Math.max(22, m.pageW * 0.068)));
  return (
    <View style={{ flex: 1, paddingHorizontal: m.padX, paddingTop: m.padTop, paddingBottom: m.padTop, alignItems: "center", justifyContent: "center" }}>
      <View style={{ padding: 6, borderRadius: 18, borderWidth: 1, borderColor: theme.edge }}>
        <StoryCover story={story} style={{ width: m.innerW - 14, height: artH }} radius={13} />
      </View>
      <Text
        accessibilityRole="header"
        style={{ fontFamily: fonts.title, fontSize: titleSize, lineHeight: Math.round(titleSize * 1.22), color: theme.text, textAlign: "center", marginTop: Math.round(m.padTop * 0.9) }}
      >
        {story.title}
      </Text>
      <View style={{ marginVertical: 12 }}>
        <Ornament color={theme.faint} />
      </View>
      <Text style={{ fontFamily: fonts.italic, fontSize: 15, color: theme.faint, textAlign: "center" }}>{byline}</Text>
      <Text style={{ fontFamily: fonts.body, fontSize: 13, color: theme.faint, textAlign: "center", marginTop: 4 }}>{meta}</Text>
      {hint ? <Text style={{ position: "absolute", bottom: m.padTop * 0.6, fontFamily: fonts.italic, fontSize: 12.5, color: theme.faint, opacity: 0.85 }}>{hint}</Text> : null}
    </View>
  );
}

/** Faqja e tekstit; pa matje (fallback) teksti mund të rrëshqasë brenda faqes, që të mos pritet kurrë. */
export function TextPage({ blocks, number, metrics: m, fonts, theme, scrollable }: { blocks: Block[]; number: number; metrics: BookMetrics; fonts: BookFonts; theme: ReaderTheme; scrollable: boolean }) {
  const body = blocks.map((b, i) => (
    <Text
      key={`${b.paragraph}-${b.start}`}
      android_hyphenationFrequency="none"
      style={[textStyle(m, fonts, theme), { marginTop: i > 0 && b.start === 0 ? m.paragraphGap : 0 }]}
    >
      {b.text}
    </Text>
  ));
  return (
    <View style={{ flex: 1 }}>
      {scrollable ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: m.padX, paddingTop: m.padTop, paddingBottom: m.padBottom }}>
          {body}
        </ScrollView>
      ) : (
        <View style={{ paddingHorizontal: m.padX, paddingTop: m.padTop, height: m.pageH - m.padBottom + Math.round(m.lineHeight * 0.4), overflow: "hidden" }}>{body}</View>
      )}
      <Text style={{ position: "absolute", bottom: Math.round(m.padTop * 0.55), left: 0, right: 0, textAlign: "center", fontFamily: fonts.italic, fontSize: 12.5, color: theme.faint }}>
        {number}
      </Text>
    </View>
  );
}

type EndProps = {
  metrics: BookMetrics;
  fonts: BookFonts;
  theme: ReaderTheme;
  labels: { end: string; body: string; again: string; next: string; library: string };
  next: Pick<StoryMeta, "title" | "cover" | "coverUrl"> | null;
  onAgain: () => void;
  onNext: () => void;
  onLibrary: () => void;
};

/** Faqja e fundit: "Fund", përralla tjetër, leximi sërish dhe kthimi te biblioteka. */
export function EndPage({ metrics: m, fonts, theme, labels, next, onAgain, onNext, onLibrary }: EndProps) {
  return (
    <View style={{ flex: 1, paddingHorizontal: m.padX, paddingVertical: m.padTop, justifyContent: "center" }}>
      <Ornament color={theme.faint} width={120} />
      <Text accessibilityRole="header" style={{ fontFamily: fonts.title, fontSize: 40, color: theme.text, textAlign: "center", marginTop: 14 }}>
        {labels.end}
      </Text>
      <Text style={{ fontFamily: fonts.italic, fontSize: 16, lineHeight: 24, color: theme.faint, textAlign: "center", marginTop: 6 }}>{labels.body}</Text>
      <View style={{ marginTop: 28, gap: 10 }}>
        {next ? (
          <Pressable
            onPress={onNext}
            accessibilityRole="button"
            accessibilityLabel={`${labels.next}: ${next.title}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: 16, borderWidth: 1, borderColor: theme.edge }}
          >
            <StoryCover story={next} style={{ width: 58, height: 46 }} radius={10} />
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: fonts.body, fontSize: 12, color: theme.faint }}>{labels.next}</Text>
              <Text style={{ fontFamily: fonts.title, fontSize: 15.5, color: theme.text }} numberOfLines={1}>
                {next.title}
              </Text>
            </View>
            <ChevronRight size={18} color={theme.faint} />
          </Pressable>
        ) : null}
        <Pressable
          onPress={onAgain}
          accessibilityRole="button"
          style={{ minHeight: 48, borderRadius: 24, backgroundColor: theme.button, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
        >
          <RotateCcw size={16} color={theme.buttonText} />
          <Text style={{ fontFamily: fonts.title, fontSize: 15, color: theme.buttonText }}>{labels.again}</Text>
        </Pressable>
        <Pressable
          onPress={onLibrary}
          accessibilityRole="button"
          style={{ minHeight: 48, borderRadius: 24, borderWidth: 1, borderColor: theme.edge, alignItems: "center", justifyContent: "center" }}
        >
          <Text style={{ fontFamily: fonts.body, fontSize: 15, color: theme.text }}>{labels.library}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Faqja bosh në fund të librit me dy faqe. */
export function BlankPage({ theme }: { theme: ReaderTheme }) {
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", opacity: 0.6 }}>
      <Ornament color={theme.edge} width={70} />
    </View>
  );
}
