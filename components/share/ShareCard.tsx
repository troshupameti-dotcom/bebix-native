import { forwardRef } from "react";
import { View, Text, Image } from "react-native";
import type { CardAspect, CardContent, CardTemplate } from "@/lib/share/cards";

const WORDMARK_ON_LIGHT = require("@/assets/images/wordmark.png");
const WORDMARK_ON_DARK = require("@/assets/images/wordmark-dark.png");

/** Gjerësia bazë e dizajnit; gjithçka shkallëzohet sipas gjerësisë reale. */
const BASE = 360;

type Props = {
  template: CardTemplate;
  aspect: CardAspect;
  content: CardContent;
  photoUri: string | null;
  width: number;
  onPhotoLoad?: () => void;
};

/**
 * Karta që bëhet imazh (react-native-view-shot). Ngjyra fikse — jo tema e
 * app-it — që imazhi të dalë njësoj kudo ku ndahet. Logoja e vogël Bebix
 * rri poshtë, e qetë.
 */
export const ShareCard = forwardRef<View, Props>(function ShareCard({ template, aspect, content, photoUri, width, onPhotoLoad }, ref) {
  const s = width / BASE;
  const height = aspect === "story" ? width * (16 / 9) : width;
  const story = aspect === "story";

  const big = (color: string, unitColor: string) =>
    content.big ? (
      <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
        <Text style={{ fontFamily: "Poppins_700Bold", fontSize: (story ? 120 : 96) * s, lineHeight: (story ? 128 : 104) * s, color }}>{content.big}</Text>
        {content.unit ? (
          <Text style={{ fontFamily: "Inter_600SemiBold", fontSize: 22 * s, color: unitColor, marginLeft: 8 * s, marginBottom: 18 * s }}>{content.unit}</Text>
        ) : null}
      </View>
    ) : (
      <Text style={{ fontSize: (story ? 72 : 56) * s }}>{content.emoji}</Text>
    );

  const title = (color: string, sub: string, align: "left" | "center" = "left") => (
    <>
      <Text style={{ fontFamily: "Poppins_700Bold", fontSize: (story ? 30 : 24) * s, lineHeight: (story ? 38 : 31) * s, color, textAlign: align, marginTop: 6 * s }} numberOfLines={3}>
        {content.title}
      </Text>
      <Text style={{ fontFamily: "Inter_500Medium", fontSize: 13 * s, color: sub, textAlign: align, marginTop: 6 * s }} numberOfLines={1}>
        {content.subtitle}
      </Text>
    </>
  );

  const logo = (dark: boolean, align: "flex-start" | "center" | "flex-end" = "flex-start") => (
    <Image source={dark ? WORDMARK_ON_DARK : WORDMARK_ON_LIGHT} style={{ width: 64 * s, height: 18 * s, alignSelf: align, opacity: 0.85 }} resizeMode="contain" />
  );

  const photo = (size: number, round: boolean, border?: string) =>
    photoUri ? (
      <Image
        source={{ uri: photoUri }}
        onLoad={onPhotoLoad}
        style={{ width: size, height: size, borderRadius: round ? size / 2 : 24 * s, borderWidth: border ? 4 * s : 0, borderColor: border }}
      />
    ) : null;

  let body: React.ReactNode;

  if (template === "photo" && photoUri) {
    // Foto e plotë me hije poshtë (tre shtresa, si gradient pa librari).
    body = (
      <View style={{ flex: 1, backgroundColor: "#17212B" }}>
        <Image source={{ uri: photoUri }} onLoad={onPhotoLoad} style={{ position: "absolute", width, height }} resizeMode="cover" />
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: height * 0.55, backgroundColor: "rgba(10,14,20,0.18)" }} />
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: height * 0.42, backgroundColor: "rgba(10,14,20,0.25)" }} />
        <View style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: height * 0.3, backgroundColor: "rgba(10,14,20,0.3)" }} />
        <View style={{ flex: 1, justifyContent: "flex-end", padding: 24 * s }}>
          {big("#FFFFFF", "rgba(255,255,255,0.85)")}
          {title("#FFFFFF", "rgba(255,255,255,0.8)")}
          <View style={{ marginTop: 16 * s }}>
            {logo(true)}
          </View>
        </View>
      </View>
    );
  } else if (template === "pastel") {
    body = (
      <View style={{ flex: 1, backgroundColor: "#F6DCE7", alignItems: "center", justifyContent: "center", padding: 24 * s }}>
        <View style={{ position: "absolute", top: -40 * s, right: -40 * s, width: 160 * s, height: 160 * s, borderRadius: 80 * s, backgroundColor: "#E7DAEF" }} />
        <View style={{ position: "absolute", bottom: -50 * s, left: -30 * s, width: 180 * s, height: 180 * s, borderRadius: 90 * s, backgroundColor: "#D9E7F2" }} />
        {photo((story ? 190 : 130) * s, true, "#FFFFFF")}
        <View style={{ marginTop: (photoUri ? 14 : 0) * s, alignItems: "center" }}>
          {big("#B8336A", "#7A3596")}
        </View>
        {title("#17212B", "#5C6670", "center")}
        <View style={{ position: "absolute", bottom: 18 * s, alignSelf: "center" }}>
          {logo(false, "center")}
        </View>
      </View>
    );
  } else if (template === "night") {
    const stars = [
      [0.12, 0.1, 14], [0.82, 0.08, 10], [0.7, 0.22, 8], [0.2, 0.3, 9], [0.9, 0.4, 12], [0.08, 0.62, 10], [0.86, 0.72, 9], [0.3, 0.86, 8],
    ];
    body = (
      <View style={{ flex: 1, backgroundColor: "#1B1F3B", alignItems: "center", justifyContent: "center", padding: 24 * s }}>
        {stars.map(([x, y, size], i) => (
          <Text key={i} style={{ position: "absolute", left: x * width, top: y * height, fontSize: size * s, color: "#F2C46D", opacity: 0.7 }}>
            ✦
          </Text>
        ))}
        {photo((story ? 180 : 124) * s, true, "#F2C46D")}
        <View style={{ marginTop: (photoUri ? 14 : 0) * s, alignItems: "center" }}>
          {big("#F2C46D", "#E9DFCC")}
        </View>
        {title("#FFFFFF", "#B9B4D6", "center")}
        <View style={{ position: "absolute", bottom: 18 * s, alignSelf: "center" }}>
          {logo(true, "center")}
        </View>
      </View>
    );
  } else {
    // "cream" (edhe "photo" pa foto).
    body = (
      <View style={{ flex: 1, backgroundColor: "#FBF6EE", padding: 22 * s, justifyContent: "space-between" }}>
        {photoUri ? (
          <Image
            source={{ uri: photoUri }}
            onLoad={onPhotoLoad}
            style={{ width: width - 44 * s, height: (story ? height * 0.52 : height * 0.5), borderRadius: 24 * s }}
            resizeMode="cover"
          />
        ) : (
          <View />
        )}
        <View>
          {big("#7A3596", "#B8336A")}
          {title("#17212B", "#5C6670")}
        </View>
        {logo(false)}
      </View>
    );
  }

  return (
    <View ref={ref} collapsable={false} style={{ width, height, overflow: "hidden", borderRadius: 0 }}>
      {body}
    </View>
  );
});
