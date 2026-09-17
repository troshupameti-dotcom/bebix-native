import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppState } from "@/lib/state/AppStateContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { buildInbox, type InboxItem } from "@/lib/notifications/inbox";

export type InboxEntry = InboxItem & { read: boolean };

/** Sa shpesh rillogariten kujtesat e bazuara në kohë ("3 orë pa ushqyerje"). */
const REFRESH_MS = 60_000;

/**
 * Njoftimet e bebit bashkë me gjendjen "lexuar". E përdorin edhe zilja te Home
 * edhe ekrani i njoftimeve; meqë "lexuar" ruhet te state-i i app-it, pika te
 * zilja zhduket menjëherë pasi hapen njoftimet.
 */
export function useInbox() {
  const { state, markNotificationsRead } = useAppState();
  const { t, language } = useLanguage();

  // Ora rifreskohet çdo minutë, që kujtesat të dalin pa pritur ndonjë veprim.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const items = useMemo(
    () => buildInbox({ baby: state.baby, prefs: state.notificationPrefs, t, lang: language, now }),
    [state.baby, state.notificationPrefs, t, language, now]
  );

  const read = useMemo(() => new Set(state.readNotificationIds), [state.readNotificationIds]);

  const entries: InboxEntry[] = useMemo(
    () => items.map((item) => ({ ...item, read: read.has(item.id) })),
    [items, read]
  );

  const unreadCount = entries.filter((e) => !e.read).length;
  const currentIds = useMemo(() => items.map((i) => i.id), [items]);

  const markRead = useCallback(
    (id: string) => markNotificationsRead([id], currentIds),
    [markNotificationsRead, currentIds]
  );
  const markAllRead = useCallback(
    () => markNotificationsRead(currentIds, currentIds),
    [markNotificationsRead, currentIds]
  );

  return { entries, unreadCount, markRead, markAllRead };
}
