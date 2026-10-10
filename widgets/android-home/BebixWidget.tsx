import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { ColorProp } from "react-native-android-widget";
import type { Language } from "@/lib/i18n/translations";
import type { WidgetSnapshot } from "@/lib/widgets/snapshot";
import { clockLabel, diaperLabel, feedingLabel, wt } from "@/lib/widgets/texts";

export const WIDGET_NAME = "BebixQuick";

type Palette = {
  bg: ColorProp;
  ink: ColorProp;
  soft: ColorProp;
  feed: { tint: ColorProp; bg: ColorProp };
  diaper: { tint: ColorProp; bg: ColorProp };
  dirty: { tint: ColorProp; bg: ColorProp };
  sleep: { tint: ColorProp; bg: ColorProp };
};

// Të njëjtat tone si pllakat e app-it (LogTiles): ushqimi rozë, pelena kaltër, gjumi vjollcë.
const LIGHT: Palette = {
  bg: "#FFFFFF",
  ink: "#17212B",
  soft: "#5C6670",
  feed: { tint: "#B8336A", bg: "#F6DCE7" },
  diaper: { tint: "#2E6FA8", bg: "#D9E7F2" },
  dirty: { tint: "#9A6415", bg: "#F3E4C8" },
  sleep: { tint: "#7A3596", bg: "#E7DAEF" },
};
const DARK: Palette = {
  bg: "#1C2329",
  ink: "#F3F3F1",
  soft: "#A9B1B8",
  feed: { tint: "#F08DB6", bg: "#3A2330" },
  diaper: { tint: "#8DBDE8", bg: "#1F2F3D" },
  dirty: { tint: "#E5B567", bg: "#3A2F1C" },
  sleep: { tint: "#C9A0DD", bg: "#2E2338" },
};

const link = (uri: string) => ({ clickAction: "OPEN_URI", clickActionData: { uri } });

function Cell({ p, tone, label, value, detail, uri }: {
  p: Palette;
  tone: { tint: ColorProp; bg: ColorProp };
  label: string;
  value: string;
  detail: string;
  uri: string;
}) {
  return (
    <FlexWidget
      {...link(uri)}
      accessibilityLabel={`${label} ${value} ${detail}`}
      style={{ flex: 1, height: "match_parent", backgroundColor: tone.bg, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, justifyContent: "center" }}
    >
      <TextWidget text={label} style={{ fontSize: 11, fontWeight: "600", color: tone.tint }} maxLines={1} truncate="END" />
      <TextWidget text={value} style={{ fontSize: 16, fontWeight: "700", color: p.ink }} maxLines={1} truncate="END" />
      {detail ? <TextWidget text={detail} style={{ fontSize: 11, color: p.soft }} maxLines={1} truncate="END" /> : null}
    </FlexWidget>
  );
}

/** Butonat: të paktën 48dp të lartë, që të preken lehtë me një dorë. */
function Action({ tone, text, action }: {
  tone: { tint: ColorProp; bg: ColorProp };
  text: string;
  action: { clickAction: string; clickActionData?: Record<string, unknown> };
}) {
  return (
    <FlexWidget
      {...action}
      accessibilityLabel={text}
      style={{ flex: 1, height: 48, backgroundColor: tone.bg, borderRadius: 14, alignItems: "center", justifyContent: "center" }}
    >
      <TextWidget text={text} style={{ fontSize: 13, fontWeight: "700", color: tone.tint }} maxLines={1} truncate="END" />
    </FlexWidget>
  );
}

function Body({ snapshot, p, lang, now, compact }: { snapshot: WidgetSnapshot | null; p: Palette; lang: Language; now: Date; compact: boolean }) {
  if (!snapshot) {
    return (
      <FlexWidget
        {...link("bebix://")}
        style={{ height: "match_parent", width: "match_parent", backgroundColor: p.bg, borderRadius: 22, padding: 16, justifyContent: "center" }}
      >
        <TextWidget text="Bebix" style={{ fontSize: 16, fontWeight: "700", color: p.ink }} />
        <TextWidget text={wt(lang, "widget_open_app")} style={{ fontSize: 13, color: p.soft, marginTop: 4 }} maxLines={3} />
      </FlexWidget>
    );
  }
  const none = wt(lang, "widget_none");
  const s = snapshot;
  const sleepValue = s.sleep ? clockLabel(s.sleep.since, now) : s.lastWakeAt ? clockLabel(s.lastWakeAt, now) : none;
  const sleepDetail = s.sleep
    ? wt(lang, "widget_asleep")
    : s.lastWakeAt
      ? wt(lang, "widget_awake")
      : "";
  const feedValue = s.breastSince ? clockLabel(s.breastSince, now) : s.feeding ? clockLabel(s.feeding.at, now) : none;
  const feedDetail = s.breastSince
    ? wt(lang, "widget_breast_running")
    : s.feeding
      ? feedingLabel(lang, s.feeding.type)
      : "";

  return (
    <FlexWidget
      style={{ height: "match_parent", width: "match_parent", backgroundColor: p.bg, borderRadius: 22, padding: 10, flexDirection: "column", flexGap: 8 }}
    >
      {compact ? null : (
        <FlexWidget {...link("bebix://")} style={{ width: "match_parent", flexDirection: "row", paddingHorizontal: 4 }}>
          <TextWidget text={s.babyName ? `Bebix · ${s.babyName}` : "Bebix"} style={{ fontSize: 12, fontWeight: "700", color: p.ink }} maxLines={1} truncate="END" />
        </FlexWidget>
      )}
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "row", flexGap: 6 }}>
        <Cell p={p} tone={p.feed} label={wt(lang, "widget_feeding")} value={feedValue} detail={feedDetail} uri="bebix://log/feeding" />
        <Cell
          p={p}
          tone={p.diaper}
          label={wt(lang, "widget_diaper")}
          value={s.diaper ? clockLabel(s.diaper.at, now) : none}
          detail={s.diaper ? diaperLabel(lang, s.diaper.type) : ""}
          uri="bebix://log/diaper"
        />
        <Cell p={p} tone={p.sleep} label={wt(lang, "widget_sleep")} value={sleepValue} detail={sleepDetail} uri="bebix://sleep" />
      </FlexWidget>
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", flexGap: 6 }}>
        <Action tone={p.feed} text={wt(lang, "widget_feed_action")} action={link("bebix://log/feeding")} />
        <Action tone={p.diaper} text={diaperLabel(lang, "wet")} action={{ clickAction: "DIAPER", clickActionData: { type: "wet" } }} />
        <Action tone={p.dirty} text={diaperLabel(lang, "dirty")} action={{ clickAction: "DIAPER", clickActionData: { type: "dirty" } }} />
        <Action tone={p.sleep} text={wt(lang, s.sleep ? "widget_sleep_end" : "widget_sleep_start")} action={{ clickAction: "SLEEP_TOGGLE" }} />
      </FlexWidget>
    </FlexWidget>
  );
}

/** Widget-i për të dyja temat; Android zgjedh vetë sipas temës së telefonit. */
export function renderBebixWidget(snapshot: WidgetSnapshot | null, opts: { lang: Language; heightDp: number; now?: Date }) {
  const now = opts.now ?? new Date();
  const compact = opts.heightDp > 0 && opts.heightDp < 140;
  const lang = snapshot?.lang ?? opts.lang;
  return {
    light: <Body snapshot={snapshot} p={LIGHT} lang={lang} now={now} compact={compact} />,
    dark: <Body snapshot={snapshot} p={DARK} lang={lang} now={now} compact={compact} />,
  };
}
