import { Image, Pressable, View } from "react-native";
import type { PostMedia } from "@/lib/community/media";
import { PostVideo } from "@/components/community/PostVideo";

type Props = {
  media: PostMedia[];
  /** true te detajet e postimit: videoja luhet në vend. */
  interactive?: boolean;
  onPress?: () => void;
};

function ratioOf(m: PostMedia, fallback: number): number {
  if (m.width && m.height) return Math.min(Math.max(m.width / m.height, 0.6), 1.8);
  return fallback;
}

/**
 * Fotot/videot e një postimi. 1 → i plotë sipas përmasave; 2 → krah për
 * krah; 3–4 → rrjetë 2×2. Videoja zë gjithmonë rresht të plotë, që kontrollet
 * të jenë të përdorshme.
 */
export function PostMediaGrid({ media, interactive = false, onPress }: Props) {
  if (!media.length) return null;

  const videos = media.filter((m) => m.type === "video");
  const images = media.filter((m) => m.type === "image");

  return (
    <View className="mb-3 gap-1.5">
      {videos.map((v) => (
        <PostVideo
          key={v.path}
          url={v.url}
          aspectRatio={ratioOf(v, 16 / 9)}
          duration={v.duration}
          interactive={interactive}
          onPressPreview={onPress}
        />
      ))}

      {images.length === 1 ? (
        <Tile item={images[0]} ratio={ratioOf(images[0], 4 / 3)} onPress={onPress} />
      ) : images.length === 2 ? (
        <View className="flex-row gap-1.5">
          {images.map((m) => (
            <View key={m.path} className="flex-1">
              <Tile item={m} ratio={1} onPress={onPress} />
            </View>
          ))}
        </View>
      ) : images.length > 2 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {images.map((m) => (
            <View key={m.path} style={{ width: "49%" }}>
              <Tile item={m} ratio={1} onPress={onPress} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Tile({ item, ratio, onPress }: { item: PostMedia; ratio: number; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole="image">
      <Image
        source={{ uri: item.url }}
        style={{ width: "100%", aspectRatio: ratio }}
        className="rounded-xl bg-cream-soft"
        resizeMode="cover"
      />
    </Pressable>
  );
}
