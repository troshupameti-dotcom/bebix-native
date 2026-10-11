import { useCallback, useEffect, useMemo, useState } from "react";
import { useAppState } from "@/lib/state/AppStateContext";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { buildInbox, expertAnswerItems, type InboxItem, type UnreadAnswer } from "@/lib/notifications/inbox";
import { ASK_EXPERT_ENABLED } from "@/lib/community/askExpertEnabled";
import { fetchUnreadAnswers } from "@/lib/community/expertQuestions";

export type InboxEntry = InboxItem & { read: boolean };

/** Sa shpesh rillogariten kujtesat e bazuara në kohë ("3 orë pa ushqyerje"). */
const REFRESH_MS = 60_000;
/** Përgjigjet e ekspertëve vijnë nga serveri: më rrallë, që të mos ngarkohet rrjeti. */
const ANSWERS_REFRESH_MS = 5 * 60_000;

/**
 * Njoftimet e bebit (dhe përgjigjet e palexuara të ekspertëve) bashkë me
 * gjendjen "lexuar". E përdorin edhe zilja te Home edhe ekrani i njoftimeve;
 * meqë "lexuar" ruhet te state-i i app-it, pika te zilja zhduket menjëherë
 * pasi hapen njoftimet.
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

  const [answers, setAnswers] = useState<UnreadAnswer[]>([]);
  useEffect(() => {
    if (!ASK_EXPERT_ENABLED) return;
    let alive = true;
    const load = () => void fetchUnreadAnswers().then((a) => alive && setAnswers(a));
    load();
    const id = setInterval(load, ANSWERS_REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const items = useMemo(
    () =>
      [...buildInbox({ baby: state.baby, prefs: state.notificationPrefs, t, lang: language, now }), ...expertAnswerItems(answers, state.notificationPrefs, t)].sort(
        (a, b) => (a.at < b.at ? 1 : -1)
      ),
    [state.baby, state.notificationPrefs, t, language, now, answers]
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
