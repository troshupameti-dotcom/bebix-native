import { createContext, useCallback, useContext, useRef, useState, ReactNode } from "react";
import { View, Text, Pressable } from "react-native";
import { MotiView, AnimatePresence } from "moti";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "@/lib/i18n/LanguageContext";

type ToastState = { id: string; message: string; onUndo?: () => void } | null;

type ToastContextValue = {
  showToast: (message: string, onUndo?: () => void) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 4000;

/**
 * App-wide "Deleted [Undo]" toast. Any screen calls `showToast(message,
 * onUndo)` after a soft-delete — this is what makes "the user should
 * never have to delete and recreate data by mistake" actually true.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, onUndo?: () => void) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    const id = Date.now().toString(36);
    setToast({ id, message, onUndo });
    timerRef.current = setTimeout(() => setToast(null), AUTO_DISMISS_MS);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastHost toast={toast} onDismiss={() => setToast(null)} />
    </ToastContext.Provider>
  );
}

function ToastHost({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  const { t } = useTranslation();
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: 0, right: 0, bottom: 0 }}>
      <SafeAreaView edges={["bottom"]} pointerEvents="box-none">
        <AnimatePresence>
          {toast && (
            <MotiView
              key={toast.id}
              from={{ opacity: 0, translateY: 20 }}
              animate={{ opacity: 1, translateY: 0 }}
              exit={{ opacity: 0, translateY: 20 }}
              transition={{ type: "timing", duration: 220 }}
              style={{
                marginHorizontal: 20,
                marginBottom: 90,
                backgroundColor: "#2C271F",
                borderRadius: 18,
                paddingVertical: 12,
                paddingHorizontal: 16,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 16,
                elevation: 6,
              }}
            >
              <Text style={{ color: "#FBF6EE", fontSize: 13.5, flex: 1 }} numberOfLines={2}>
                {toast.message}
              </Text>
              {toast.onUndo && (
                <Pressable
                  onPress={() => {
                    toast.onUndo?.();
                    onDismiss();
                  }}
                  hitSlop={8}
                  style={{ marginLeft: 14 }}
                >
                  <Text style={{ color: "#C9702E", fontSize: 13.5, fontWeight: "600" }}>{t("undo_action")}</Text>
                </Pressable>
              )}
            </MotiView>
          )}
        </AnimatePresence>
      </SafeAreaView>
    </View>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
