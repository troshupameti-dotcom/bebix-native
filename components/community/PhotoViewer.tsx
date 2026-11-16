import { FlatList, Image, Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import type { PostMedia } from "@/lib/community/media";

/**
 * Fotot e postimit në ekran të plotë, mbi sfond të zi: rrëshqit anash mes tyre, zmadho me dy gishta (iPhone), mbyll me
 * ✕ ose me butonin "mbrapa" të Android-it. `index` = fotoja që hapet e para; null = e mbyllur.
 */
export function PhotoViewer({ images, index, onClose }: { images: PostMedia[]; index: number | null; onClose: () => void }) {
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [seen, setSeen] = useState<number | null>(null);
  const open = index !== null;
  const current = seen ?? index ?? 0;

  const close = () => {
    setSeen(null);
    onClose();
  };

  return (
    <Modal visible={open} animationType="fade" onRequestClose={close} statusBarTranslucent presentationStyle="fullScreen">
      <View style={{ flex: 1, backgroundColor: "#000000" }}>
        {open ? (
          <FlatList
            data={images}
            horizontal
            pagingEnabled
            keyExtractor={(m) => m.path}
            initialScrollIndex={index ?? 0}
            getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => setSeen(Math.round(e.nativeEvent.contentOffset.x / width))}
            renderItem={({ item }) => (
              <ScrollView
                style={{ width, height }}
                contentContainerStyle={{ width, height, alignItems: "center", justifyContent: "center" }}
                maximumZoomScale={3}
                minimumZoomScale={1}
                centerContent
                showsHorizontalScrollIndicator={false}
                showsVerticalScrollIndicator={false}
              >
                <Image source={{ uri: item.url }} style={{ width, height }} resizeMode="contain" accessibilityIgnoresInvertColors />
              </ScrollView>
            )}
          />
        ) : null}

        <View pointerEvents="box-none" style={{ position: "absolute", top: insets.top + 8, left: 16, right: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {images.length > 1 ? (
            <View style={{ backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 }}>
              <Text className="font-bodySemibold text-[13px]" style={{ color: "#FFFFFF" }}>
                {current + 1} / {images.length}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <Pressable
            onPress={close}
            accessibilityRole="button"
            accessibilityLabel={t("cpost_photo_close")}
            hitSlop={10}
            style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center" }}
          >
            <X size={22} color="#FFFFFF" strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
