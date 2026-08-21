import { useEffect, useRef, ReactNode } from "react";
import { Animated, ViewStyle } from "react-native";

type Props = {
  children: ReactNode;
  style?: ViewStyle;
};

/**
 * Mbështjellës që bën efekt "zoom-in" (si Apple Photos) kur një ekran
 * hapet — fillon më i vogël dhe transparent, pastaj zmadhohet dhe bëhet
 * plotësisht i dukshëm.
 */
export function ZoomScreen({ children, style }: Props) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        speed: 8,
        bounciness: 6,
      }),
      Animated.timing(opacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={[
        { flex: 1, opacity, transform: [{ scale }] },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}