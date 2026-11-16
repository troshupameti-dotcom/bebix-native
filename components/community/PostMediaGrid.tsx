import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import type { PostMedia } from "@/lib/community/media";
import { PostVideo } from "@/components/community/PostVideo";
import { PhotoViewer } from "@/components/community/PhotoViewer";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type Props = {
  media: PostMedia[];
  /** true te detajet e postimit: videoja luhet në vend dhe fotot hapen në ekran të plotë. */
  interactive?: boolean;
  onPress?: () => void;
};

function ratioOf(m: PostMedia, fallback: number): number {
  if (m.width && m.height) return Math.min(Math.max(m.width / m.height, 0.6), 1.8);
  return fallback;
}

/**
 * Fotot/videot e një postimi. 1 → e plotë sipas përmasave; 2 → krah për krah; 3 → një e gjerë lart dhe dy poshtë;
 * 4 → rrjetë 2×2. Videoja zë gjithmonë rresht të plotë, që kontrollet të jenë të përdorshme.
 * Te detajet (`interactive`) prekja e një fotoje e hap në ekran të plotë; te rrjedha hap postimin.
 */
export function PostMediaGrid({ media, interactive = false, onPress }: Props) {
  const [viewer, setViewer] = useState<number | null>(null);
  if (!media.length) return null;

  const videos = media.filter((m) => m.type === "video");
  const images = media.filter((m) => m.type === "image");
  const tile = (i: number, ratio: number) => (
    <Tile item={images[i]} ratio={ratio} index={i} total={images.length} onPress={interactive ? () => setViewer(i) : onPress} zoom={interactive} />
  );

  return (
    <View className="mb-3 gap-1.5">
      {videos.map((v) => (
        <PostVideo key={v.path} url={v.url} aspectRatio={ratioOf(v, 16 / 9)} duration={v.duration} interactive={interactive} onPressPreview={onPress} />
      ))}

      {images.length === 1 ? (
        tile(0, ratioOf(images[0], 4 / 3))
      ) : images.length === 2 ? (
        <View className="flex-row gap-1.5">
          <View className="flex-1">{tile(0, 1)}</View>
          <View className="flex-1">{tile(1, 1)}</View>
        </View>
      ) : images.length === 3 ? (
        <>
          {tile(0, 16 / 9)}
          <View className="flex-row gap-1.5">
            <View className="flex-1">{tile(1, 1)}</View>
            <View className="flex-1">{tile(2, 1)}</View>
          </View>
        </>
      ) : images.length > 3 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {images.map((m, i) => (
            <View key={m.path} style={{ width: "49%" }}>
              {tile(i, 1)}
            </View>
          ))}
        </View>
      ) : null}

      {interactive ? <PhotoViewer images={images} index={viewer} onClose={() => setViewer(null)} /> : null}
    </View>
  );
}

function Tile({ item, ratio, index, total, onPress, zoom }: { item: PostMedia; ratio: number; index: number; total: number; onPress?: () => void; zoom: boolean }) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={zoom ? "imagebutton" : "image"}
      accessibilityLabel={zoom ? t("cpost_photo_open", { n: index + 1, total }) : undefined}
      className="active:opacity-90"
    >
      <Image source={{ uri: item.url }} style={{ width: "100%", aspectRatio: ratio }} className="rounded-2xl bg-cream-soft" resizeMode="cover" />
    </Pressable>
  );
}
