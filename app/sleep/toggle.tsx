import { DeepLinkAction } from "@/components/widgets/DeepLinkAction";

/** bebix://sleep/toggle — fle ↔ u zgjua, njësoj si butoni i widget-it. */
export default function SleepToggleLink() {
  return <DeepLinkAction action={{ kind: "sleep_toggle" }} to="/(main)/baby/sleep" />;
}
