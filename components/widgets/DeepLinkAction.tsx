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
    void pushAction(JSON.parse(key) as WidgetActionInput, new Date(), "deep_link")
      .then((saved) => saved && haptics.success())
      .finally(() => alive && setDone(true));
    return () => {
      alive = false;
    };
  }, [key]);

  // withAnchor: ekrani hapet me faqen kryesore të pjesës poshtë (p.sh. kreu nën Ushqyerjen), që "mbrapa" të ketë
  // ku të kthehet. Më parë ekrani hapej i vetëm në stivë.
  return done ? <Redirect href={to} withAnchor /> : <View className="flex-1 bg-cream" />;
}
