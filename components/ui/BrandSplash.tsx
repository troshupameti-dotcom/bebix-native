import { useEffect, useRef, useState } from "react";
import { Animated, StyleSheet } from "react-native";
import { Image } from "expo-image";

/**
 * Logoja e plotë (me moton) mbi gjithçka, sa hapet app-i. Splash-i i sistemit te
 * Android 12+ e pret ikonën në rreth, prandaj atje shfaqet vetëm shenja "b";
 * logoja e plotë del këtu, e mprehtë, dhe zbehet butë në çastin `until`
 * (ose pas 600 ms, nëse app-i u ngarkua më vonë se aq).
 * Te iOS ka të njëjtën figurë, madhësi dhe sfond si splash-i: kalimi s'duket.
 */
export function BrandSplash({ until }: { until: number }) {
  const opacity = useRef(new Animated.Value(1)).current;
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 450, useNativeDriver: true }).start(() => setDone(true));
    }, Math.max(600, until - Date.now()));
    return () => clearTimeout(timer);
  }, [opacity, until]);

  if (done) return null;
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wrap, { opacity }]}>
      <Image source={require("@/assets/splash.png")} style={styles.logo} contentFit="contain" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: "#F3F3F1", alignItems: "center", justifyContent: "center", zIndex: 1000 },
  logo: { width: 300, height: 300 },
});
