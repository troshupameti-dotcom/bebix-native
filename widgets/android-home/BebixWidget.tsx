import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { ColorProp } from "react-native-android-widget";
import type { Language } from "@/lib/i18n/translations";
import type { WidgetSnapshot } from "@/lib/widgets/snapshot";
import { clockLabel, diaperLabel, durationShort, feedingLabel, wt } from "@/lib/widgets/texts";

export const WIDGET_NAME = "BebixQuick";
/** Të dy widget-et e listës: "Bebix" (4×2, zmadhohet deri në tablet) dhe "Bebix i vogël" (2×2). Pamja zgjidhet sipas madhësisë. */
export const WIDGET_NAMES = [WIDGET_NAME, "BebixMini"] as const;

type Tone = { tint: ColorProp; bg: ColorProp };
type Palette = { bg: ColorProp; ink: ColorProp; soft: ColorProp; line: ColorProp; feed: Tone; diaper: Tone; dirty: Tone; sleep: Tone };

// Të njëjtat ngjyra si app-i (theme/palette.js dhe lib/theme/tone.ts): ushqimi rozë, pelena blu, gjumi vjollcë.
const LIGHT: Palette = {
  bg: "#FFFFFF",
  ink: "#1C1A16",
  soft: "#565047",
  line: "#EFE9E1",
  feed: { tint: "#9E2C5B", bg: "#F6DCE7" },
  diaper: { tint: "#285F90", bg: "#D9E7F2" },
  dirty: { tint: "#845612", bg: "#F3E4C8" },
  sleep: { tint: "#692E81", bg: "#E7DAEF" },
};
const DARK: Palette = {
  bg: "#1E1B17",
  ink: "#F2EDE5",
  soft: "#C1B7A9",
  line: "#2B2620",
  feed: { tint: "#E08AB0", bg: "#3A222B" },
  diaper: { tint: "#8DB4D8", bg: "#1F2A33" },
  dirty: { tint: "#D9B47A", bg: "#352B1C" },
  sleep: { tint: "#BE95D0", bg: "#2E2232" },
};

const link = (uri: string) => ({ clickAction: "OPEN_URI", clickActionData: { uri } });

/** Madhësia e widget-it në dp: Android e jep kur shtohet ose zmadhohet; pamja zgjidhet sipas saj. */
export type WidgetSize = { widthDp: number; heightDp: number };
export type Layout = "small" | "medium" | "large";

/** Cila pamje i përshtatet madhësisë: e vogla (2×2), e mesmja (4×2, parazgjedhja) ose e madhja (4×3 e më shumë, tableti). */
export function layoutFor({ widthDp, heightDp }: WidgetSize): Layout {
  if (widthDp > 0 && widthDp < 240) return "small";
  if (heightDp >= 170) return "large";
  return "medium";
}

/** Tekstet e tri kutive, të përbashkëta për çdo madhësi. */
function cells(s: WidgetSnapshot, lang: Language, now: Date) {
  const none = wt(lang, "widget_none");
  const nextFeed = s.nextFeedingAt && new Date(s.nextFeedingAt).getTime() > now.getTime() ? s.nextFeedingAt : null;
  return {
    feed: {
      label: wt(lang, "widget_feeding"),
      value: s.breastSince ? clockLabel(s.breastSince, now) : s.feeding ? clockLabel(s.feeding.at, now) : none,
      detail: s.breastSince ? wt(lang, "widget_breast_running") : s.feeding ? feedingLabel(lang, s.feeding.type) : "",
      next: nextFeed && !s.breastSince ? wt(lang, "widget_next", { time: clockLabel(nextFeed, now) }) : "",
    },
    diaper: {
      label: wt(lang, "widget_diaper"),
      value: s.diaper ? clockLabel(s.diaper.at, now) : none,
      detail: s.diaper ? diaperLabel(lang, s.diaper.type) : "",
    },
    sleep: {
      label: wt(lang, "widget_sleep"),
      value: s.sleep ? clockLabel(s.sleep.since, now) : s.lastWakeAt ? clockLabel(s.lastWakeAt, now) : none,
      detail: s.sleep ? wt(lang, "widget_asleep") : s.lastWakeAt ? wt(lang, "widget_awake") : "",
    },
  };
}

/** Kutia e një lloji: emri me ngjyrë, ora e madhe dhe (kur ka vend) hollësia. Prekja hap ekranin përkatës. */
function Cell({ p, tone, label, value, detail, uri, showDetail }: {
  p: Palette;
  tone: Tone;
  label: string;
  value: string;
  detail: string;
  uri: string;
  showDetail: boolean;
}) {
  return (
    <FlexWidget
      {...link(uri)}
      accessibilityLabel={`${label} ${value} ${detail}`}
      style={{ flex: 1, height: "match_parent", backgroundColor: tone.bg, borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, justifyContent: "center" }}
    >
      <TextWidget text={label} style={{ fontSize: 11, fontWeight: "700", color: tone.tint }} maxLines={1} truncate="END" />
      <TextWidget text={value} style={{ fontSize: 17, fontWeight: "700", color: p.ink }} maxLines={1} truncate="END" />
      {showDetail && detail ? <TextWidget text={detail} style={{ fontSize: 11, color: p.soft }} maxLines={1} truncate="END" /> : null}
    </FlexWidget>
  );
}

/** Butonat: të paktën 40dp të lartë; teksti deri në dy rreshta, që fjalët e gjata të mos priten. */
function Action({ tone, text, action, height, fontSize }: {
  tone: Tone;
  text: string;
  action: { clickAction: string; clickActionData?: Record<string, unknown> };
  height: number;
  fontSize: number;
}) {
  return (
    <FlexWidget
      {...action}
      accessibilityLabel={text}
      style={{ flex: 1, height, backgroundColor: tone.bg, borderRadius: 14, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 }}
    >
      <TextWidget text={text} style={{ fontSize, fontWeight: "700", color: tone.tint, textAlign: "center" }} maxLines={2} truncate="END" />
    </FlexWidget>
  );
}

function Actions({ p, s, lang, height, widthDp }: { p: Palette; s: WidgetSnapshot; lang: Language; height: number; widthDp: number }) {
  // Në widget-et e ngushta (rreth 300dp) "Jashtëqitje" s'nxë me 13; teksti zvogëlohet pak në vend që të pritet.
  const fontSize = widthDp > 0 && widthDp < 330 ? 11 : 13;
  return (
    <FlexWidget style={{ width: "match_parent", flexDirection: "row", flexGap: 6 }}>
      <Action tone={p.feed} text={wt(lang, "widget_feed_action")} action={link("bebix://quick/feeding")} height={height} fontSize={fontSize} />
      <Action tone={p.diaper} text={diaperLabel(lang, "wet")} action={{ clickAction: "DIAPER", clickActionData: { type: "wet" } }} height={height} fontSize={fontSize} />
      <Action tone={p.dirty} text={wt(lang, "widget_dirty_short")} action={{ clickAction: "DIAPER", clickActionData: { type: "dirty" } }} height={height} fontSize={fontSize} />
      <Action tone={p.sleep} text={wt(lang, s.sleep ? "widget_sleep_end" : "widget_sleep_start")} action={{ clickAction: "SLEEP_TOGGLE" }} height={height} fontSize={fontSize} />
    </FlexWidget>
  );
}

/** Rreshti i pamjes së vogël: pikë me ngjyrë, emri dhe ora. */
function Row({ p, tone, label, value, uri }: { p: Palette; tone: Tone; label: string; value: string; uri: string }) {
  return (
    <FlexWidget {...link(uri)} style={{ width: "match_parent", flex: 1, flexDirection: "row", alignItems: "center", flexGap: 8 }}>
      <FlexWidget style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: tone.tint }} />
      <TextWidget text={label} style={{ fontSize: 12, fontWeight: "600", color: p.soft }} maxLines={1} truncate="END" />
      <FlexWidget style={{ flex: 1 }} />
      <TextWidget text={value} style={{ fontSize: 15, fontWeight: "700", color: p.ink }} maxLines={1} truncate="END" />
    </FlexWidget>
  );
}

function Body({ snapshot, p, lang, now, size }: { snapshot: WidgetSnapshot | null; p: Palette; lang: Language; now: Date; size: WidgetSize }) {
  if (!snapshot) {
    return (
      <FlexWidget
        {...link("bebix://")}
        style={{ height: "match_parent", width: "match_parent", backgroundColor: p.bg, borderRadius: 24, padding: 16, justifyContent: "center" }}
      >
        <TextWidget text="Bebix" style={{ fontSize: 17, fontWeight: "700", color: p.ink }} />
        <TextWidget text={wt(lang, "widget_open_app")} style={{ fontSize: 13, color: p.soft, marginTop: 4 }} maxLines={3} />
      </FlexWidget>
    );
  }
  const s = snapshot;
  const c = cells(s, lang, now);
  const layout = layoutFor(size);
  const title = s.babyName ? `Bebix · ${s.babyName}` : "Bebix";

  // E vogla (2×2): tri rreshta me orët; prekja e secilit hap ekranin e vet.
  if (layout === "small") {
    return (
      <FlexWidget style={{ height: "match_parent", width: "match_parent", backgroundColor: p.bg, borderRadius: 24, paddingHorizontal: 14, paddingVertical: 12, flexDirection: "column", flexGap: 2 }}>
        <TextWidget text={title} style={{ fontSize: 12, fontWeight: "700", color: p.ink }} maxLines={1} truncate="END" />
        <Row p={p} tone={p.feed} label={c.feed.label} value={c.feed.value} uri="bebix://quick/feeding" />
        <Row p={p} tone={p.diaper} label={c.diaper.label} value={c.diaper.value} uri="bebix://quick/diaper" />
        <Row p={p} tone={p.sleep} label={c.sleep.label} value={c.sleep.value} uri="bebix://sleep" />
      </FlexWidget>
    );
  }

  // E mesmja (4×2): tri kutitë dhe katër butona. Hollësia del vetëm kur ka lartësi, që asgjë të mos pritet.
  if (layout === "medium") {
    const roomy = size.heightDp >= 130;
    return (
      <FlexWidget style={{ height: "match_parent", width: "match_parent", backgroundColor: p.bg, borderRadius: 24, padding: 8, flexDirection: "column", flexGap: 6 }}>
        <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "row", flexGap: 6 }}>
          <Cell p={p} tone={p.feed} {...c.feed} uri="bebix://log/feeding" showDetail={roomy} />
          <Cell p={p} tone={p.diaper} {...c.diaper} uri="bebix://log/diaper" showDetail={roomy} />
          <Cell p={p} tone={p.sleep} {...c.sleep} uri="bebix://sleep" showDetail={roomy} />
        </FlexWidget>
        <Actions p={p} s={s} lang={lang} height={40} widthDp={size.widthDp} />
      </FlexWidget>
    );
  }

  // E madhja (4×3 e më shumë, tableti): titulli, kutitë me hollësi, ushqimi i radhës, butonat dhe "Sot".
  const today = s.today;
  return (
    <FlexWidget style={{ height: "match_parent", width: "match_parent", backgroundColor: p.bg, borderRadius: 28, padding: 12, flexDirection: "column", flexGap: 8 }}>
      <FlexWidget {...link("bebix://")} style={{ width: "match_parent", flexDirection: "row", alignItems: "center", paddingHorizontal: 4 }}>
        <TextWidget text={title} style={{ fontSize: 15, fontWeight: "700", color: p.ink }} maxLines={1} truncate="END" />
        <FlexWidget style={{ flex: 1 }} />
        {c.feed.next ? <TextWidget text={c.feed.next} style={{ fontSize: 12, fontWeight: "600", color: p.feed.tint }} maxLines={1} /> : null}
      </FlexWidget>
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "row", flexGap: 8 }}>
        <Cell p={p} tone={p.feed} {...c.feed} uri="bebix://log/feeding" showDetail />
        <Cell p={p} tone={p.diaper} {...c.diaper} uri="bebix://log/diaper" showDetail />
        <Cell p={p} tone={p.sleep} {...c.sleep} uri="bebix://sleep" showDetail />
      </FlexWidget>
      <Actions p={p} s={s} lang={lang} height={48} widthDp={size.widthDp} />
      {today && size.heightDp >= 230 ? (
        <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", backgroundColor: p.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 }}>
          <TextWidget text={wt(lang, "widget_today")} style={{ fontSize: 12, fontWeight: "700", color: p.ink }} />
          <FlexWidget style={{ flex: 1 }} />
          <TextWidget
            text={wt(lang, "widget_today_summary", { f: String(today.feedings), d: String(today.diapers), s: durationShort(lang, today.sleepMin) })}
            style={{ fontSize: 12, color: p.soft }}
            maxLines={1}
            truncate="END"
          />
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}

/** Widget-i për të dyja temat; Android zgjedh vetë sipas temës së telefonit. */
export function renderBebixWidget(snapshot: WidgetSnapshot | null, opts: { lang: Language; widthDp?: number; heightDp: number; now?: Date }) {
  const now = opts.now ?? new Date();
  const size = { widthDp: opts.widthDp ?? 0, heightDp: opts.heightDp };
  const lang = snapshot?.lang ?? opts.lang;
  return {
    light: <Body snapshot={snapshot} p={LIGHT} lang={lang} now={now} size={size} />,
    dark: <Body snapshot={snapshot} p={DARK} lang={lang} now={now} size={size} />,
  };
}
