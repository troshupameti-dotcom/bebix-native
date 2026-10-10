import { useLocalSearchParams } from "expo-router";
import { DeepLinkAction } from "@/components/widgets/DeepLinkAction";
import { DIAPER_TYPES } from "@/lib/widgets/queue";
import type { DiaperType } from "@/lib/state/babyTypes";

/** bebix://log/diaper?type=wet|dirty|both — shënon pelenën; pa `type` vetëm hap ekranin. */
export default function LogDiaperLink() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  const valid = DIAPER_TYPES.includes(type as DiaperType) ? (type as DiaperType) : null;
  return <DeepLinkAction action={valid ? { kind: "diaper", type: valid } : null} to="/(main)/baby/diaper" />;
}
