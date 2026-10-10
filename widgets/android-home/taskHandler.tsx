import AsyncStorage from "@react-native-async-storage/async-storage";
import { requestWidgetUpdate, type WidgetTaskHandlerProps } from "react-native-android-widget";
import type { Language } from "@/lib/i18n/translations";
import { applyPending, DIAPER_TYPES } from "@/lib/widgets/queue";
import { loadQueue, loadSnapshot, pushAction } from "@/lib/widgets/store";
import type { WidgetSnapshot } from "@/lib/widgets/snapshot";
import type { DiaperType } from "@/lib/state/babyTypes";
import { renderBebixWidget, WIDGET_NAME } from "./BebixWidget";

const LANGUAGE_KEY = "bebix_language_v1";

/** Pamja që sheh prindi: ajo e app-it plus prekjet që app-i s'i ka zbrazur ende. */
async function currentView(): Promise<{ snapshot: WidgetSnapshot | null; lang: Language }> {
  const [snapshot, queue, storedLang] = await Promise.all([
    loadSnapshot(),
    loadQueue(),
    AsyncStorage.getItem(LANGUAGE_KEY).catch(() => null),
  ]);
  const lang: Language = snapshot?.lang ?? (storedLang === "en" ? "en" : "sq");
  return { snapshot: applyPending(snapshot, queue), lang };
}

/**
 * Ekzekutohet nga Android (headless JS) kur widget-i shtohet, rifreskohet,
 * ndryshon madhësi ose preket. Prekjet "DIAPER" dhe "SLEEP_TOGGLE" s'e hapin
 * app-in: ruhen në radhë dhe widget-i rivizatohet menjëherë.
 */
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetAction, widgetInfo, clickAction, clickActionData, renderWidget } = props;
  if (widgetAction === "WIDGET_DELETED") return;

  if (widgetAction === "WIDGET_CLICK") {
    if (clickAction === "DIAPER") {
      const type = clickActionData?.type as DiaperType;
      if (DIAPER_TYPES.includes(type)) await pushAction({ kind: "diaper", type });
    } else if (clickAction === "SLEEP_TOGGLE") {
      await pushAction({ kind: "sleep_toggle" });
    }
  }

  const { snapshot, lang } = await currentView();
  renderWidget(renderBebixWidget(snapshot, { lang, heightDp: widgetInfo.height }));
}

/** Nga app-i: rivizato çdo widget Bebix në ekranin kryesor me pamjen e re. */
export async function refreshAndroidWidgets(): Promise<void> {
  const { snapshot, lang } = await currentView();
  await requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: (info) => renderBebixWidget(snapshot, { lang, heightDp: info.height }),
  });
}
