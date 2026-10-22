import { Image, Modal, Pressable, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { X } from "lucide-react-native";

/**
 * Foto në ekran të plotë: zmadhim me dy gishta (deri 5×), zvarritje kur është e zmadhuar, dy prekje për 2.5× ose
 * kthim, dhe mbyllje me ✕, me rrëshqitje poshtë ose me butonin "mbrapa" të Android-it. Sfondi i zi është me qëllim
 * (si te galeria e telefonit), në të dyja temat.
 */
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const CLOSE_DRAG = 120;

type Props = { uri: string; caption?: string; onClose: () => void };

export function PhotoViewer({ uri, caption, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  /** Sa mund të lëvizë fotoja e zmadhuar pa dalë jashtë ekranit. */
  const clamp = (v: number, s: number, size: number) => {
    "worklet";
    const max = ((s - 1) * size) / 2;
    return Math.min(max, Math.max(-max, v));
  };

  const reset = () => {
    "worklet";
    scale.set(withTiming(1));
    savedScale.set(1);
    tx.set(withTiming(0));
    ty.set(withTiming(0));
    savedX.set(0);
    savedY.set(0);
  };

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.set(Math.min(MAX_SCALE, Math.max(1, savedScale.get() * e.scale)));
    })
    .onEnd(() => {
      if (scale.get() <= 1.02) return reset();
      const s = scale.get();
      const x = clamp(tx.get(), s, width);
      const y = clamp(ty.get(), s, height);
      savedScale.set(s);
      tx.set(withTiming(x));
      ty.set(withTiming(y));
      savedX.set(x);
      savedY.set(y);
    });

  const pan = Gesture.Pan()
    .averageTouches(true)
    .onUpdate((e) => {
      if (savedScale.get() > 1) {
        tx.set(savedX.get() + e.translationX);
        ty.set(savedY.get() + e.translationY);
      } else {
        // Pa zmadhim: fotoja ndjek gishtin poshtë, si te galeria, për ta mbyllur.
        ty.set(Math.max(0, e.translationY));
      }
    })
    .onEnd((e) => {
      if (savedScale.get() > 1) {
        const x = clamp(tx.get(), savedScale.get(), width);
        const y = clamp(ty.get(), savedScale.get(), height);
        tx.set(withTiming(x));
        ty.set(withTiming(y));
        savedX.set(x);
        savedY.set(y);
      } else if (e.translationY > CLOSE_DRAG || e.velocityY > 900) {
        runOnJS(onClose)();
      } else {
        ty.set(withTiming(0));
      }
    });

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.get() > 1) return reset();
      scale.set(withTiming(DOUBLE_TAP_SCALE));
      savedScale.set(DOUBLE_TAP_SCALE);
    });

  const photoStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.get() }, { translateY: ty.get() }, { scale: scale.get() }],
  }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: savedScale.get() > 1 ? 1 : Math.max(0.35, 1 - ty.get() / (height * 0.8)),
  }));

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "#000000" }, backdropStyle]} />
        <GestureDetector gesture={Gesture.Simultaneous(pinch, pan, doubleTap)}>
          <Animated.View style={[{ flex: 1, justifyContent: "center" }, photoStyle]}>
            <Image source={{ uri }} style={{ width, height: height * 0.78 }} resizeMode="contain" accessibilityIgnoresInvertColors />
          </Animated.View>
        </GestureDetector>
        {caption ? (
          <View pointerEvents="none" style={{ position: "absolute", left: 20, right: 20, bottom: insets.bottom + 24 }}>
            <Text style={{ color: "#FFFFFF", fontFamily: "Inter_500Medium", fontSize: 14, textAlign: "center" }} numberOfLines={2}>
              {caption}
            </Text>
          </View>
        ) : null}
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Mbyll foton"
          hitSlop={8}
          style={{ position: "absolute", top: insets.top + 12, right: 16, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" }}
        >
          <X size={22} color="#FFFFFF" />
        </Pressable>
      </GestureHandlerRootView>
    </Modal>
  );
}
