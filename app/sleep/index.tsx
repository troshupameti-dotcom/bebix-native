import { DeepLinkAction } from "@/components/widgets/DeepLinkAction";

/** bebix://sleep — hap ekranin e gjumit. */
export default function SleepLink() {
  return <DeepLinkAction action={null} to="/(main)/baby/sleep" />;
}
