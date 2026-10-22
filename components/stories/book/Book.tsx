import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useState, type ReactNode } from "react";
import { View, StyleSheet } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from "react-native-reanimated";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { shadows } from "@/lib/shadows";
import type { BookMode } from "@/components/stories/book/layout";
import type { ReaderTheme } from "@/components/stories/book/theme";

/**
 * Libri: faqja kthehet rreth shpinës me gisht (zvarritje majtas/djathtas), me prekje në anët e faqes, ose me butonat.
 * Me një faqe (telefon), faqja ngrihet nga e djathta dhe zbulon tjetrën poshtë saj; me dy faqe (tablet, ekran i
 * gjerë), fleta e djathtë kthehet mbi shpinë dhe pas saj del faqja e re e majtë, si në një libër të hapur.
 * Me "Zvogëlo lëvizjen" të ndezur te telefoni, faqet ndërrohen me zbehje, pa rrotullim.
 */
type Side = "single" | "left" | "right";

export type BookHandle = { flip: (dir: 1 | -1) => void };

type Props = {
  mode: BookMode;
  pageW: number;
  pageH: number;
  position: number;
  count: number;
  theme: ReaderTheme;
  reduceMotion: boolean;
  /** Prekja në anët e faqes kthen faqen; fiket kur faqja ka butona (fundi). */
  edgeTaps: boolean;
  renderPage: (pageIndex: number, side: Side) => ReactNode;
  /** Faqja u kthye: +1 përpara, -1 mbrapa. */
  onTurn: (dir: 1 | -1) => void;
};

const TURN_MS = 460;

/** Faqja si letër: hija e shpinës në anën e brendshme dhe skajet e faqeve të grumbulluara në anën e jashtme. */
function Paper({ w, h, side, theme, children }: { w: number; h: number; side: Side; theme: ReaderTheme; children?: ReactNode }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const spineLeft = side !== "left";
  const shadowW = side === "single" ? 18 : 34;
  return (
    <View style={{ width: w, height: h, backgroundColor: theme.page, overflow: "hidden" }}>
      {children}
      <Svg width={shadowW} height={h} style={{ position: "absolute", top: 0, [spineLeft ? "left" : "right"]: 0 }} pointerEvents="none">
        <Defs>
          <LinearGradient id={`fold${id}`} x1={spineLeft ? "0" : "1"} y1="0" x2={spineLeft ? "1" : "0"} y2="0">
            <Stop offset="0" stopColor={theme.shade} stopOpacity={side === "single" ? 0.14 : 0.2} />
            <Stop offset="1" stopColor={theme.shade} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={shadowW} height={h} fill={`url(#fold${id})`} />
      </Svg>
      {[2, 5].map((x) => (
        <View key={x} pointerEvents="none" style={{ position: "absolute", top: 6, bottom: 6, width: 1, backgroundColor: theme.edge, [spineLeft ? "right" : "left"]: x }} />
      ))}
    </View>
  );
}

/** Një faqe në lëvizje: rrotullim rreth shpinës (ose zbehje), me errësim sa më shumë ngrihet. */
function Leaf({
  progress,
  from,
  to,
  range,
  pivot,
  w,
  h,
  reduceMotion,
  fade,
  theme,
  children,
}: {
  progress: SharedValue<number>;
  from: number;
  to: number;
  /** Pjesa e lëvizjes kur rrotullohet kjo faqe (me dy faqe, gjysma e parë dhe e dyta). */
  range: [number, number];
  pivot: "left" | "right";
  w: number;
  h: number;
  reduceMotion: boolean;
  /** Me zbehje: "out" zhduket, "in" shfaqet. */
  fade: "in" | "out";
  theme: ReaderTheme;
  children: ReactNode;
}) {
  const style = useAnimatedStyle(() => {
    const p = progress.get();
    const t = Math.min(1, Math.max(0, (p - range[0]) / (range[1] - range[0])));
    if (reduceMotion) {
      const visible = fade === "out" ? 1 - p : p;
      return { opacity: visible, transform: [] };
    }
    const angle = from + (to - from) * t;
    const shift = pivot === "left" ? w / 2 : -w / 2;
    // Kur faqja është në teh (90°), fshihet: përndryshe del si një vijë e hollë.
    const edgeOn = (t <= 0 && Math.abs(from) >= 89) || (t >= 1 && Math.abs(to) >= 89);
    return {
      opacity: edgeOn ? 0 : 1,
      transform: [{ perspective: Math.max(2000, w * 5) }, { translateX: -shift }, { rotateY: `${angle}deg` }, { translateX: shift }],
    };
  });
  const shade = useAnimatedStyle(() => {
    if (reduceMotion) return { opacity: 0 };
    const p = progress.get();
    const t = Math.min(1, Math.max(0, (p - range[0]) / (range[1] - range[0])));
    const angle = Math.abs(from + (to - from) * t);
    return { opacity: (angle / 90) * 0.32 };
  });
  return (
    <Animated.View style={[{ position: "absolute", top: 0, width: w, height: h, backfaceVisibility: "hidden" }, style]} pointerEvents="none">
      {children}
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: theme.shade }, shade]} />
    </Animated.View>
  );
}

/** Hija që hedh faqja në lëvizje mbi faqen poshtë saj. */
function CastShadow({ progress, invert, theme, style }: { progress: SharedValue<number>; invert: boolean; theme: ReaderTheme; style: object }) {
  const a = useAnimatedStyle(() => {
    const p = progress.get();
    return { opacity: (invert ? p : 1 - p) * 0.22 };
  });
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, backgroundColor: theme.shade }, style, a]} />;
}

export const Book = forwardRef<BookHandle, Props>(function Book(
  { mode, pageW, pageH, position, count, theme, reduceMotion, edgeTaps, renderPage, onTurn },
  ref
) {
  const spread = mode === "spread";
  const bookW = spread ? pageW * 2 : pageW;
  const progress = useSharedValue(0);
  const active = useSharedValue(0);
  const canNext = useSharedValue(position < count - 1);
  const canPrev = useSharedValue(position > 0);
  const [flip, setFlip] = useState<null | { dir: 1 | -1; auto: boolean }>(null);
  // Një kthim në një kohë: zvarritja dhe butonat s'nisin dy faqe njëherësh.
  const busy = useSharedValue(false);

  useEffect(() => {
    canNext.set(position < count - 1);
    canPrev.set(position > 0);
  }, [position, count, canNext, canPrev]);

  const finish = useCallback(
    (dir: 1 | -1) => {
      busy.set(false);
      setFlip(null);
      onTurn(dir);
    },
    [onTurn, busy]
  );
  const cancel = useCallback(() => {
    busy.set(false);
    setFlip(null);
  }, [busy]);
  const begin = useCallback(
    (dir: 1 | -1) => {
      busy.set(true);
      setFlip({ dir, auto: false });
    },
    [busy]
  );

  // Kthimi me buton ose me prekje: animacioni nis pasi faqja në lëvizje është vendosur në ekran.
  useEffect(() => {
    if (!flip?.auto) return;
    progress.set(0);
    progress.set(
      withTiming(1, { duration: reduceMotion ? 220 : TURN_MS, easing: Easing.inOut(Easing.cubic) }, (done) => {
        if (done) runOnJS(finish)(flip.dir);
      })
    );
  }, [flip, progress, reduceMotion, finish]);

  const turn = useCallback(
    (dir: 1 | -1) => {
      if (busy.get()) return;
      const next = position + dir;
      if (next < 0 || next >= count) return;
      busy.set(true);
      progress.set(0);
      setFlip({ dir, auto: true });
    },
    [position, count, progress, busy]
  );
  useImperativeHandle(ref, () => ({ flip: turn }), [turn]);

  const pan = Gesture.Pan()
    .activeOffsetX([-14, 14])
    .failOffsetY([-26, 26])
    .onStart((e) => {
      const dir = e.translationX < 0 ? 1 : -1;
      if (busy.get() || (dir === 1 && !canNext.get()) || (dir === -1 && !canPrev.get())) {
        active.set(0);
        return;
      }
      active.set(dir);
      progress.set(0);
      runOnJS(begin)(dir);
    })
    .onUpdate((e) => {
      const dir = active.get();
      if (!dir) return;
      progress.set(Math.min(1, Math.max(0, (-dir * e.translationX) / (bookW * (spread ? 0.75 : 0.9)))));
    })
    .onEnd((e) => {
      const dir = active.get() as 1 | -1 | 0;
      if (!dir) return;
      active.set(0);
      const p = progress.get();
      const complete = p > 0.33 || -dir * e.velocityX > 550;
      const target = complete ? 1 : 0;
      progress.set(
        withTiming(target, { duration: 140 + 320 * Math.abs(target - p), easing: Easing.out(Easing.cubic) }, (done) => {
          if (!done) return;
          if (complete) runOnJS(finish)(dir);
          else runOnJS(cancel)();
        })
      );
    });

  const tap = Gesture.Tap()
    .enabled(edgeTaps)
    .maxDuration(260)
    .onEnd((e) => {
      if (e.x > bookW * 0.68) runOnJS(turn)(1);
      else if (e.x < bookW * 0.32) runOnJS(turn)(-1);
    });

  const page = (i: number, side: Side) => (
    <Paper w={pageW} h={pageH} side={side} theme={theme}>
      {renderPage(i, side)}
    </Paper>
  );

  const dir = flip?.dir ?? 0;
  let content: ReactNode;
  if (!spread) {
    const base = dir === 1 ? position + 1 : position;
    content = (
      <>
        {page(base, "single")}
        {dir ? <CastShadow progress={progress} invert={dir === -1} theme={theme} style={{ left: 0, width: pageW, height: pageH }} /> : null}
        {dir === 1 ? (
          <Leaf progress={progress} from={0} to={-90} range={[0, 1]} pivot="left" w={pageW} h={pageH} reduceMotion={reduceMotion} fade="out" theme={theme}>
            {page(position, "single")}
          </Leaf>
        ) : null}
        {dir === -1 ? (
          <Leaf progress={progress} from={-90} to={0} range={[0, 1]} pivot="left" w={pageW} h={pageH} reduceMotion={reduceMotion} fade="in" theme={theme}>
            {page(position - 1, "single")}
          </Leaf>
        ) : null}
      </>
    );
  } else {
    const L = position * 2;
    const leftBase = dir === -1 ? L - 2 : L;
    const rightBase = dir === 1 ? L + 3 : L + 1;
    content = (
      <View style={{ flexDirection: "row" }}>
        {page(leftBase, "left")}
        {page(rightBase, "right")}
        {dir === 1 ? (
          <>
            <CastShadow progress={progress} invert={false} theme={theme} style={{ left: pageW, width: pageW, height: pageH }} />
            <View style={{ position: "absolute", left: pageW, top: 0 }}>
              <Leaf progress={progress} from={0} to={-90} range={[0, 0.5]} pivot="left" w={pageW} h={pageH} reduceMotion={reduceMotion} fade="out" theme={theme}>
                {page(L + 1, "right")}
              </Leaf>
            </View>
            <View style={{ position: "absolute", left: 0, top: 0 }}>
              <Leaf progress={progress} from={90} to={0} range={[0.5, 1]} pivot="right" w={pageW} h={pageH} reduceMotion={reduceMotion} fade="in" theme={theme}>
                {page(L + 2, "left")}
              </Leaf>
            </View>
          </>
        ) : null}
        {dir === -1 ? (
          <>
            <CastShadow progress={progress} invert={false} theme={theme} style={{ left: 0, width: pageW, height: pageH }} />
            <View style={{ position: "absolute", left: 0, top: 0 }}>
              <Leaf progress={progress} from={0} to={90} range={[0, 0.5]} pivot="right" w={pageW} h={pageH} reduceMotion={reduceMotion} fade="out" theme={theme}>
                {page(L, "left")}
              </Leaf>
            </View>
            <View style={{ position: "absolute", left: pageW, top: 0 }}>
              <Leaf progress={progress} from={-90} to={0} range={[0.5, 1]} pivot="left" w={pageW} h={pageH} reduceMotion={reduceMotion} fade="in" theme={theme}>
                {page(L - 1, "right")}
              </Leaf>
            </View>
          </>
        ) : null}
        {/* Palosja në mes të librit. */}
        <View pointerEvents="none" style={{ position: "absolute", left: pageW - 1, top: 0, width: 2, height: pageH, backgroundColor: theme.shade, opacity: 0.12 }} />
      </View>
    );
  }

  return (
    <GestureDetector gesture={Gesture.Race(pan, tap)}>
      <View style={[{ width: bookW, height: pageH, borderRadius: 4, backgroundColor: theme.page }, shadows.softLg]} collapsable={false}>
        {/* Pa prerje: fleta që ngrihet del pak jashtë librit, si në realitet. */}
        <View style={{ width: bookW, height: pageH }}>{content}</View>
      </View>
    </GestureDetector>
  );
});
