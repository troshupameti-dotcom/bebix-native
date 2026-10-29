import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import {
  Dimensions,
  Keyboard,
  LayoutAnimation,
  Platform,
  ScrollView,
  TextInput,
  View,
  type KeyboardEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewInstance,
  type ScrollViewProps,
  type StyleProp,
  type ViewInstance,
  type ViewStyle,
} from "react-native";

/**
 * Sa e mbulon tastiera një pamje: lartësia nga maja e tastierës deri në fund të pamjes, e matur në ekran.
 * Kështu del e saktë në çdo pajisje pa numra fiks: me ose pa shiritin e tab-eve poshtë, me hapësirën e sigurt të
 * iPhone-it, në tablet, në iPad me tastierë të jashtme (vetëm shiriti i shkurtoreve), dhe në Android, ku dritarja
 * ndonjëherë zvogëlohet vetë (atëherë matja e radhës jep 0 dhe s'ngjitet dy herë). Tastiera lundruese ose e ndarë
 * e iPad-it s'mbulon fundin e ekranit, ndaj s'ngjit asgjë.
 */
export function useKeyboardInset(onKeyboard?: (keyboardTop: number) => void) {
  const ref = useRef<ViewInstance>(null);
  const onKeyboardRef = useRef(onKeyboard);
  useEffect(() => {
    onKeyboardRef.current = onKeyboard;
  });
  const keyboardTop = useRef<number | null>(null);
  const bottom = useRef<number | null>(null);
  const [inset, setInset] = useState(0);

  const apply = useCallback(() => {
    const top = keyboardTop.current;
    // Para matjes së parë: pamja merret deri në fund të ekranit (rasti më i zakonshëm).
    const viewBottom = bottom.current ?? Dimensions.get("screen").height;
    setInset(top == null ? 0 : Math.max(0, Math.round(viewBottom - top)));
  }, []);

  // Pozicioni i pamjes mund të ndryshojë pa ndryshuar madhësia (animacioni i hapjes së ekranit), ndaj rimatet.
  const measure = useCallback(() => {
    ref.current?.measureInWindow?.((_x, y, _w, h) => {
      bottom.current = y + h;
      apply();
    });
  }, [apply]);

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const animate = (e?: KeyboardEvent) => {
      if (ios && e?.duration) LayoutAnimation.configureNext({ duration: e.duration, update: { type: LayoutAnimation.Types.keyboard } });
    };
    const onShow = (e: KeyboardEvent) => {
      const { screenY, height } = e.endCoordinates;
      const docked = !ios || screenY + height >= Dimensions.get("screen").height - 1;
      keyboardTop.current = docked && height > 0 ? screenY : null;
      animate(e);
      apply();
      measure();
      if (keyboardTop.current != null) onKeyboardRef.current?.(keyboardTop.current);
    };
    const onHide = (e?: KeyboardEvent) => {
      keyboardTop.current = null;
      animate(e);
      apply();
    };
    // iPhone: "willChangeFrame" kap edhe ndryshimet e lartësisë (emoji, shiriti i sugjerimeve, tastiera e jashtme).
    const subs = ios
      ? [Keyboard.addListener("keyboardWillChangeFrame", onShow), Keyboard.addListener("keyboardWillHide", onHide)]
      : [Keyboard.addListener("keyboardDidShow", onShow), Keyboard.addListener("keyboardDidHide", onHide)];
    return () => subs.forEach((s) => s.remove());
  }, [apply, measure]);

  return { ref, inset, onLayout: measure };
}

/**
 * Zëvendësimi i KeyboardAvoidingView: përmbajtja ngjitet saktësisht sa e mbulon tastiera, në iPhone, Android,
 * tablet dhe iPad, brenda tab-eve, stack-ut ose dritareve Modal.
 */
export function KeyboardSafeView({
  children,
  className = "flex-1",
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const { ref, inset, onLayout } = useKeyboardInset();
  return (
    <View ref={ref} onLayout={onLayout} className={className} style={[style, { paddingBottom: inset }]}>
      {children}
    </View>
  );
}

/**
 * ScrollView për formularët: ngjitet mbi tastierë si `KeyboardSafeView`, dhe fusha ku po shkruan lëviz vetë mbi
 * tastierë kur ajo hapet (në Android edhe kur kalon në fushën tjetër, nga vetë sistemi).
 */
export function KeyboardScrollView({
  ref,
  children,
  onScroll,
  boxClassName = "flex-1",
  ...props
}: ScrollViewProps & { ref?: Ref<ScrollViewInstance>; children?: ReactNode; className?: string; boxClassName?: string }) {
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  const offset = useRef(0);
  const reveal = useCallback((keyboardTop: number) => {
    const input = TextInput.State.currentlyFocusedInput?.() as unknown as ViewInstance | null;
    if (!input) return;
    // Pritet një çast, që hapësira poshtë të jetë vendosur para matjes.
    setTimeout(() => {
      input.measureInWindow?.((_x, y, _w, h) => {
        const overflow = y + h + 16 - keyboardTop;
        if (overflow > 0) scrollRef.current?.scrollTo({ y: offset.current + overflow, animated: true });
      });
    }, Platform.OS === "ios" ? 60 : 120);
  }, []);
  const { ref: boxRef, inset, onLayout } = useKeyboardInset(reveal);
  const setRef = useCallback(
    (node: ScrollViewInstance | null) => {
      scrollRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) (ref as { current: ScrollViewInstance | null }).current = node;
    },
    [ref]
  );
  return (
    <View ref={boxRef} onLayout={onLayout} className={boxClassName} style={{ paddingBottom: inset }}>
      <ScrollView
        ref={setRef}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
        {...props}
        onScroll={(e: NativeSyntheticEvent<NativeScrollEvent>) => {
          offset.current = e.nativeEvent.contentOffset.y;
          onScroll?.(e);
        }}
      >
        {children}
      </ScrollView>
    </View>
  );
}
