import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "@/lib/i18n/LanguageContext";

/**
 * Shirit i hollë kur telefoni s'ka internet. Pa të, ekranet që s'ngarkohen
 * duken sikur aplikacioni është prishur; me të, klienti e di se është lidhja.
 * Zhduket vetë kur kthehet interneti.
 */
export function OfflineBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    return NetInfo.addEventListener((state) => {
      // `null` = ende nuk dihet; shfaqet vetëm kur dihet qartë që s'ka lidhje.
      setOffline(state.isConnected === false || state.isInternetReachable === false);
    });
  }, []);

  if (!offline) return null;

  return (
    <View
      accessibilityRole="alert"
      pointerEvents="none"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 900,
        backgroundColor: "#1C1A16",
        paddingTop: insets.top + 6,
        paddingBottom: 8,
        paddingHorizontal: 16,
      }}
    >
      <Text style={{ color: "#FFFFFF", fontSize: 13, textAlign: "center", fontWeight: "500" }}>{t("offline_banner")}</Text>
    </View>
  );
}
