import { useEffect, useState } from "react";
import { View } from "react-native";
import { Redirect, type Href } from "expo-router";
import { haptics } from "@/lib/haptics";
import { pushAction } from "@/lib/widgets/store";
import type { WidgetActionInput } from "@/lib/widgets/queue";

/**
 * Lidhjet `bebix://…` nga widget-i (ose nga Shortcuts / NFC): veprimi shkon në
 * të njëjtën radhë si prekjet e widget-it — pra pa dyfishim edhe kur ekrani
 * montohet dy herë — dhe pastaj hapet ekrani përkatës.
 */
export function DeepLinkAction({ action, to }: { action: WidgetActionInput | null; to: Href }) {
  const [done, setDone] = useState(!action);
  const key = action ? JSON.stringify(action) : "";

  useEffect(() => {
    if (!key) return;
    let alive = true;
    void pushAction(JSON.parse(key) as WidgetActionInput)
      .then((saved) => saved && haptics.success())
      .finally(() => alive && setDone(true));
    return () => {
      alive = false;
    };
  }, [key]);

  return done ? <Redirect href={to} /> : <View className="flex-1 bg-cream" />;
}
