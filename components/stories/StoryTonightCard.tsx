import { useId, useMemo, useState } from "react";
import { View, Text, Pressable, type LayoutChangeEvent } from "react-native";
import { router } from "expo-router";
import Svg, { Circle, Defs, LinearGradient, Mask, RadialGradient, Rect, Stop } from "react-native-svg";
import { BookOpen, LibraryBig, Shuffle } from "lucide-react-native";
import { StoryBookCover } from "@/components/stories/StoryBookCover";
import { useStoryMeta } from "@/components/stories/StoryParts";
import { useBookFonts } from "@/components/stories/book/theme";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { shadows } from "@/lib/shadows";
import { isEvening, tonightPool } from "@/lib/stories/catalog";
import { useStoryIndex } from "@/lib/stories/useStoryIndex";
import { useStoryUserData } from "@/lib/stories/userData";

/**
 * "Përrallë për sonte" te kreu, si një dritare e ndriçuar në mbrëmje: qielli i natës pas orës 17:00 (hëna, yjet) dhe
 * qielli i ditës para saj, libri nën dritën e llambës, dhe tri veprime: lexo (ose vazhdo aty ku mbeti), "Një tjetër"
 * dhe biblioteka. Ngjyrat janë të kartelës vetë (si një ilustrim), ndaj duken njësoj në temën e çelët dhe të errët.
 */
const NIGHT = {
  from: "#26483F",
  mid: "#1F3D38",
  to: "#162C28",
  label: "#C1DDD8",
  title: "#FBF6EC",
  text: "rgba(243,236,225,0.74)",
  line: "rgba(193,221,216,0.34)",
  chip: "#C1DDD8",
  primary: "#F3ECE1",
  onPrimary: "#1F3D38",
  ghost: "rgba(243,236,225,0.34)",
  onGhost: "#F3ECE1",
  glow: "#F3EBD9",
  glowOpacity: 0.28,
  track: "rgba(243,236,225,0.16)",
  fill: "#C1DDD8",
};
const DAY = {
  from: "#E6F0EC",
  mid: "#CFE3DE",
  to: "#BFD9D3",
  label: "#2E5650",
  title: "#1F3D38",
  text: "#3E5A55",
  line: "rgba(31,61,56,0.22)",
  chip: "#2E5650",
  primary: "#1F3D38",
  onPrimary: "#F3ECE1",
  ghost: "rgba(31,61,56,0.3)",
  onGhost: "#1F3D38",
  glow: "#FFFFFF",
  glowOpacity: 0.6,
  track: "rgba(31,61,56,0.14)",
  fill: "#1F3D38",
};

/** "Një tjetër" mbahet gjatë ditës (edhe kur kthehesh te kreu), dhe nis nga e para të nesërmen. */
let picked = { day: "", offset: 0 };
export function __resetTonightPickForTests() {
  picked = { day: "", offset: 0 };
}

/**
 * Yjet si matje: rrjetë e lehtë me zhvendosje të qëndrueshme (pa rastësi), vetëm në brezin e sipërm të qiellit, që
 * të mos bien mbi titull.
 */
function stars(width: number) {
  const out: { x: number; y: number; r: number; o: number }[] = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 27; i++) {
    const x = width * 0.5 + (i % 9) * 22 + rnd() * 12;
    const y = 6 + Math.floor(i / 9) * 11 + rnd() * 6;
    const r = rnd() < 0.18 ? 1.3 : 0.75;
    const o = 0.25 + rnd() * 0.6;
    if (x < width - 70 && y < 40) out.push({ x, y, r, o });
  }
  return out;
}

function Sky({ width, height, evening }: { width: number; height: number; evening: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const p = evening ? NIGHT : DAY;
  const dots = useMemo(() => (evening ? stars(width) : []), [evening, width]);
  return (
    <Svg width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }} pointerEvents="none">
      <Defs>
        <LinearGradient id={`bg${id}`} x1="0" y1="0" x2="0.35" y2="1">
          <Stop offset="0" stopColor={p.from} />
          <Stop offset="0.46" stopColor={p.mid} />
          <Stop offset="1" stopColor={p.to} />
        </LinearGradient>
        {evening ? (
          <RadialGradient id={`halo${id}`}>
            <Stop offset="0" stopColor="#F3EBD9" stopOpacity={0.16} />
            <Stop offset="1" stopColor="#F3EBD9" stopOpacity={0} />
          </RadialGradient>
        ) : (
          <RadialGradient id={`halo${id}`}>
            <Stop offset="0" stopColor="#FBF3DC" stopOpacity={0.95} />
            <Stop offset="0.45" stopColor="#F6EACB" stopOpacity={0.55} />
            <Stop offset="1" stopColor="#F6EACB" stopOpacity={0} />
          </RadialGradient>
        )}
        <Mask id={`moon${id}`}>
          <Rect x={0} y={0} width={width} height={height} fill="#FFFFFF" />
          <Circle cx={width - 22} cy={22} r={23} fill="#000000" />
        </Mask>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={`url(#bg${id})`} />
      {dots.map((s, i) => (
        <Circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#F3EBD9" opacity={s.o} />
      ))}
      <Circle cx={width - 34} cy={30} r={evening ? 64 : 78} fill={`url(#halo${id})`} />
      {evening ? (
        <Circle cx={width - 34} cy={30} r={25} fill="#EFE6D2" mask={`url(#moon${id})`} />
      ) : (
        <Circle cx={width - 30} cy={26} r={20} fill="#FBF3DC" />
      )}
    </Svg>
  );
}

/** Drita e llambës pas librit. */
function Glow({ color, opacity }: { color: string; opacity: number }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <Svg width={156} height={180} style={{ position: "absolute", left: -34, top: -30 }} pointerEvents="none">
      <Defs>
        <RadialGradient id={`g${id}`}>
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={156} height={180} fill={`url(#g${id})`} />
    </Svg>
  );
}

export function StoryTonightCard({ months, now }: { months: number | null; now?: Date }) {
  const { t } = useTranslation();
  const meta = useStoryMeta();
  const fonts = useBookFonts();
  const user = useStoryUserData();
  const { stories } = useStoryIndex();
  const [size, setSize] = useState({ w: 0, h: 0 });
  const today = now ?? new Date();
  const dayKey = today.toDateString();
  const [offset, setOffset] = useState(() => (picked.day === dayKey ? picked.offset : 0));
  const pool = useMemo(() => tonightPool(stories, months, today), [stories, months, dayKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const story = pool.length ? pool[offset % pool.length] : null;
  if (!story) return null;

  const evening = isEvening(today.getHours());
  const p = evening ? NIGHT : DAY;
  const progress = user.progressOf(story.slug);
  const pages = Math.max(1, progress?.pages ?? 1);
  const resume = progress && !progress.finished && progress.page > 0 ? progress.page : 0;
  const percent = resume ? Math.max(1, Math.round((resume / pages) * 100)) : 0;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (Math.abs(width - size.w) > 0.5 || Math.abs(height - size.h) > 0.5) setSize({ w: width, h: height });
  };
  const another = () => {
    haptics.tap();
    const next = (offset + 1) % pool.length;
    picked = { day: dayKey, offset: next };
    setOffset(next);
  };
  const read = () => {
    haptics.tap();
    router.push({ pathname: "/(main)/baby/stories/read/[slug]", params: { slug: story.slug, from: String(resume) } });
  };

  return (
    <View style={[{ marginTop: 20, borderRadius: 28, backgroundColor: p.mid }, shadows.soft]}>
      <View style={{ borderRadius: 28, overflow: "hidden", padding: 18 }} onLayout={onLayout}>
        {size.w ? <Sky width={size.w} height={size.h} evening={evening} /> : null}

        <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 10.5, letterSpacing: 1.8, color: p.label, textTransform: "uppercase" }} accessibilityRole="header">
          {t("stories_tonight")}
        </Text>

        <Pressable
          onPress={() => router.push({ pathname: "/(main)/baby/stories/[slug]", params: { slug: story.slug } })}
          accessibilityRole="button"
          accessibilityLabel={`${t("stories_tonight")}: ${story.title}. ${meta.minutes(story)}, ${meta.ages(story)}`}
          style={{ flexDirection: "row", alignItems: "center", gap: 16, marginTop: 16 }}
        >
          <View>
            <Glow color={p.glow} opacity={p.glowOpacity} />
            <StoryBookCover story={story} width={88} showTitle={false} />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: fonts.title, fontSize: 21, lineHeight: 26, color: p.title }} numberOfLines={3}>
              {story.title}
            </Text>
            <Text style={{ fontFamily: fonts.italic, fontSize: 13.5, lineHeight: 19, color: p.text, marginTop: 6 }} numberOfLines={2}>
              {story.summary}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {[meta.minutes(story), meta.ages(story)].map((label) => (
                <Text
                  key={label}
                  style={{ fontFamily: "Inter_500Medium", fontSize: 11, color: p.chip, borderWidth: 1, borderColor: p.line, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3, overflow: "hidden" }}
                >
                  {label}
                </Text>
              ))}
            </View>
            {resume ? (
              <View style={{ height: 3, borderRadius: 2, marginTop: 10, backgroundColor: p.track, overflow: "hidden" }}>
                <View style={{ height: 3, width: `${percent}%`, backgroundColor: p.fill }} />
              </View>
            ) : null}
          </View>
        </Pressable>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 18 }}>
          <Pressable
            onPress={read}
            accessibilityRole="button"
            style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: p.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}
          >
            <BookOpen size={16} color={p.onPrimary} />
            <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 14, color: p.onPrimary }} numberOfLines={1}>
              {resume ? t("stories_continue_pct", { n: percent }) : t("stories_read_now")}
            </Text>
          </Pressable>
          {pool.length > 1 ? (
            <Pressable
              onPress={another}
              accessibilityRole="button"
              accessibilityHint={t("stories_another_hint")}
              style={{ height: 44, borderRadius: 22, borderWidth: 1, borderColor: p.ghost, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", gap: 7 }}
            >
              <Shuffle size={15} color={p.onGhost} />
              <Text style={{ fontFamily: "Inter_500Medium", fontSize: 14, color: p.onGhost }} numberOfLines={1}>
                {t("stories_another")}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => router.push("/(main)/baby/stories")}
            accessibilityRole="button"
            accessibilityLabel={t("stories_all")}
            style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: p.ghost, alignItems: "center", justifyContent: "center" }}
          >
            <LibraryBig size={17} color={p.onGhost} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}
