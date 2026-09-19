import { Linking, Pressable, Text, View } from "react-native";
import { requireOptionalNativeModule } from "expo-modules-core";
import { Icon } from "@/components/ui/Icon";
import { useTranslation } from "@/lib/i18n/LanguageContext";

/**
 * `expo-video` kërkon modulin nativ në import. Build-et e vjetra (para se të
 * shtohej paketa) s'e kanë, dhe një import i drejtpërdrejtë do e rrëzonte
 * app-in. Prandaj ngarkohet vetëm kur moduli ekziston; përndryshe videoja
 * hapet në luajtësin e sistemit.
 */
const hasNativeVideo = requireOptionalNativeModule("ExpoVideo") != null;

type ExpoVideoModule = typeof import("expo-video");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ExpoVideo: ExpoVideoModule | null = hasNativeVideo ? require("expo-video") : null;

/**
 * Mbi video sfondi eshte gjithmone i zi, ne te dyja temat. #FEFEFE (jo #FFFFFF)
 * qe Icon te mos e perktheje ne ngjyren e temes.
 */
const ON_VIDEO = "#FEFEFE";

export function formatVideoDuration(seconds: number | null | undefined): string | null {
  if (!seconds || seconds <= 0) return null;
  const s = Math.round(seconds); // ruhet ne sekonda (shih new.tsx)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Props = {
  url: string;
  aspectRatio: number;
  duration?: number | null;
  /** Në feed shfaqet vetëm pllaka; luhet te detajet e postimit. */
  interactive: boolean;
  onPressPreview?: () => void;
};

export function PostVideo({ url, aspectRatio, duration, interactive, onPressPreview }: Props) {
  const { t } = useTranslation();
  if (interactive && ExpoVideo) {
    return <NativeVideo module={ExpoVideo} url={url} aspectRatio={aspectRatio} />;
  }

  const label = formatVideoDuration(duration);
  return (
    <Pressable
      onPress={interactive ? () => Linking.openURL(url) : onPressPreview}
      accessibilityRole="button"
      accessibilityLabel={t("video_play")}
      style={{ aspectRatio }}
      className="w-full items-center justify-center overflow-hidden rounded-xl bg-black"
    >
      <View className="h-14 w-14 items-center justify-center rounded-full bg-white/20">
        <Icon name="play" size={24} color={ON_VIDEO} />
      </View>
      {label ? (
        <View className="absolute bottom-2 right-2 rounded-full bg-black/50 px-2 py-0.5">
          <Text className="font-bodySemibold text-[10px] text-white">{label}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function NativeVideo({ module, url, aspectRatio }: { module: ExpoVideoModule; url: string; aspectRatio: number }) {
  const player = module.useVideoPlayer(url, (p) => {
    p.loop = false;
  });
  return (
    <module.VideoView
      player={player}
      nativeControls
      contentFit="contain"
      fullscreenOptions={{ enable: true }}
      style={{ width: "100%", aspectRatio, borderRadius: 12, backgroundColor: "#000" }}
    />
  );
}
