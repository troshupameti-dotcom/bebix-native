import { Pressable, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";

/**
 * Numrat e profilit: Postime · Ndjekës · Të ndjekur. Ndjekësit dhe të ndjekurit hapin listat (që i sheh vetë personi
 * dhe miqtë e tij; të tjerët shohin një shënim).
 */
export function ProfileStats({ userId, name, posts, followers, following }: {
  userId: string;
  name: string;
  posts: number;
  followers: number;
  following: number;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const open = (kind: "followers" | "following") => {
    haptics.tap();
    router.push({ pathname: "/community/follows", params: { user: userId, kind, name } });
  };
  const item = (value: number, label: string, onPress?: () => void) => (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${value} ${label}`}
      className="flex-1 items-center py-1"
    >
      <Text className="font-display text-lg text-ink">{value}</Text>
      <Text className="mt-0.5 font-body text-[12px] text-ink-soft">{label}</Text>
    </Pressable>
  );
  return (
    <View className="mt-4 w-full flex-row rounded-2xl border border-cream-line bg-surface py-2">
      {item(posts, t("cprof_posts"))}
      <View className="my-2 w-px bg-cream-line" />
      {item(followers, t("cprof_followers"), () => open("followers"))}
      <View className="my-2 w-px bg-cream-line" />
      {item(following, t("cprof_following"), () => open("following"))}
    </View>
  );
}
