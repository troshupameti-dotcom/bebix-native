import { useId } from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { StoryCover } from "@/components/stories/StoryCover";
import { shadows } from "@/lib/shadows";
import type { StoryMeta } from "@/lib/stories/types";

/** Letra e etiketës së titullit: e njëjtë me faqet e librit, që kopertina dhe libri të duken një send. */
const LABEL = "#FCF8F0";
const LABEL_TEXT = "#2B2620";
const LABEL_FAINT = "#8C8172";

type Props = {
  story: Pick<StoryMeta, "cover" | "coverUrl" | "title"> & { coverSvg?: string | null };
  width: number;
  /** Titulli mbi kopertinë (si në një libër të vërtetë); në madhësi të vogla fshihet. */
  showTitle?: boolean;
  /** Rreshti i vogël poshtë titullit (p.sh. koha e leximit). */
  caption?: string;
  titleFont?: string;
  captionFont?: string;
  style?: StyleProp<ViewStyle>;
};

/** Raporti i librit: pak më i gjatë se i gjerë. */
export const BOOK_RATIO = 1.36;

/**
 * Përralla si libër: ilustrimi në kopertinë, shpina me hije në të majtë dhe, në madhësi të mëdha, etiketa me
 * titullin. Qoshet e djathta më të rrumbullakëta se shpina, si te kopertinat e forta.
 */
export function StoryBookCover({ story, width, showTitle = width >= 120, caption, titleFont, captionFont, style }: Props) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const height = Math.round(width * BOOK_RATIO);
  const spine = Math.max(5, Math.round(width * 0.07));
  const radius = Math.max(4, Math.round(width * 0.05));
  const labelH = showTitle ? Math.round(height * (caption ? 0.32 : 0.27)) : 0;
  const titleSize = Math.max(12, Math.round(width * 0.085));

  return (
    <View
      style={[{ width, height, backgroundColor: LABEL, borderTopRightRadius: radius, borderBottomRightRadius: radius, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }, shadows.soft, style]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <View style={[StyleSheet.absoluteFill, { overflow: "hidden", borderTopRightRadius: radius, borderBottomRightRadius: radius, borderTopLeftRadius: 3, borderBottomLeftRadius: 3 }]}>
        <StoryCover story={story} style={{ width, height: height - labelH }} radius={0} />
        {showTitle ? (
          <View style={{ height: labelH, backgroundColor: LABEL, paddingHorizontal: Math.round(width * 0.09), paddingLeft: spine + Math.round(width * 0.07), justifyContent: "center" }}>
            <Text style={{ fontFamily: titleFont, fontSize: titleSize, lineHeight: Math.round(titleSize * 1.25), color: LABEL_TEXT, textAlign: "center" }} numberOfLines={2}>
              {story.title}
            </Text>
            {caption ? (
              <Text style={{ fontFamily: captionFont, fontSize: Math.max(10, Math.round(titleSize * 0.7)), color: LABEL_FAINT, textAlign: "center", marginTop: 3 }} numberOfLines={1}>
                {caption}
              </Text>
            ) : null}
          </View>
        ) : null}
        {/* Shpina: hije në të majtë, një vijë drite, pastaj palosja e kopertinës. */}
        <Svg width={spine * 2.4} height={height} style={{ position: "absolute", left: 0, top: 0 }}>
          <Defs>
            <LinearGradient id={`spine${id}`} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#000000" stopOpacity={0.34} />
              <Stop offset="0.38" stopColor="#000000" stopOpacity={0.12} />
              <Stop offset="0.42" stopColor="#FFFFFF" stopOpacity={0.28} />
              <Stop offset="0.5" stopColor="#000000" stopOpacity={0.1} />
              <Stop offset="1" stopColor="#000000" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={spine * 2.4} height={height} fill={`url(#spine${id})`} />
        </Svg>
      </View>
    </View>
  );
}
