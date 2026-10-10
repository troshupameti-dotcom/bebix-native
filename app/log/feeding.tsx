import { DeepLinkAction } from "@/components/widgets/DeepLinkAction";

/** bebix://log/feeding — hap ushqyerjen, ku "Ushqeva tani" është gati me llojin e fundit. */
export default function LogFeedingLink() {
  return <DeepLinkAction action={null} to="/(main)/baby/feeding" />;
}
