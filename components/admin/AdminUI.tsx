import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "expo-router";
import { Check, ChevronDown, Lock, Search } from "lucide-react-native";
import { BackButton } from "@/components/ui/BackButton";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { KeyboardScrollView } from "@/lib/ui/keyboard";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useIsAdmin } from "@/lib/admin/access";
import { haptics } from "@/lib/haptics";
import { TONES, type Option, type Tone } from "@/lib/admin/labels";

/**
 * Pjesët e përbashkëta të panelit të adminit: e njëjta pamje e sheshtë si pjesa tjetër e app-it (kartela me vijë të
 * hollë, pa hije), kokë me "mbrapa", rifreskim me tërheqje poshtë dhe mbrojtje: pa rolin admin ekrani s'hapet.
 */

export function AdminScreen({
  title,
  subtitle,
  children,
  refreshing = false,
  onRefresh,
  fallback = "/(main)/more/admin",
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  fallback?: string;
}) {
  const theme = useThemeColors();
  const admin = useIsAdmin();
  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-4 pb-2 pt-2">
        <BackButton fallback={fallback as never} className="mr-3" />
        <View className="flex-1">
          <Text className="font-display text-2xl text-ink" numberOfLines={1}>{title}</Text>
          {subtitle ? <Text className="mt-0.5 font-body text-xs text-ink-soft" numberOfLines={2}>{subtitle}</Text> : null}
        </View>
      </View>
      {admin === null ? (
        <ActivityIndicator className="mt-16" color={theme.olive} />
      ) : !admin ? (
        <View className="mt-16 items-center px-10">
          <Lock size={28} color={theme.inkFaint} strokeWidth={1.8} />
          <Text className="mt-3 text-center font-body text-sm text-ink-soft">Kjo pjesë është vetëm për adminët e Bebix.</Text>
        </View>
      ) : (
        <KeyboardScrollView
          className="flex-1"
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 48 }}
          showsVerticalScrollIndicator={false}
          refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.olive} /> : undefined}
        >
          {children}
        </KeyboardScrollView>
      )}
    </SafeAreaView>
  );
}

/**
 * Ngarkimi i të dhënave të një ekrani: në hapje, sa herë kthehesh te ekrani, kur ndryshojnë filtrat (`deps`), dhe
 * me tërheqje poshtë. Gabimi i bazës shfaqet si tekst, jo si dritare.
 */
export function useAdminData<T>(loader: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const latest = useRef(loader);
  useEffect(() => {
    latest.current = loader;
  });
  const run = useRef(0);

  const load = useCallback(async (pull = false) => {
    const id = ++run.current;
    if (pull) setRefreshing(true);
    try {
      const next = await latest.current();
      if (id === run.current) {
        setData(next);
        setError(null);
      }
    } catch (e) {
      if (id === run.current) setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (id === run.current) setRefreshing(false);
    }
  }, []);

  // Filtrat janë vlera të thjeshta (tekst, numra): një çelës i vetëm i ndjek të gjitha.
  const key = JSON.stringify(deps);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useFocusEffect(useCallback(() => void load(), [load, key]));

  return { data, error, refreshing, reload: () => load(), pull: () => load(true) };
}

/** Kërkimi niset pasi admini ndalon së shkruari, jo me çdo shkronjë. */
export function useDebounced<T>(value: T, ms = 400): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return settled;
}

/** Veprim mbi bazën: tregon gabimin me dritare, dridhje e lehtë kur ia del, dhe rifreskon. */
export async function runAction(action: () => Promise<void>, after?: () => void): Promise<boolean> {
  try {
    await action();
    haptics.success();
    after?.();
    return true;
  } catch (e) {
    Alert.alert("Veprimi s'u krye", e instanceof Error ? e.message : String(e));
    return false;
  }
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <View className={`mb-3 rounded-2xl border border-cream-line bg-surface p-4 ${className}`}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <Text className="mb-2 mt-4 px-1 font-bodySemibold text-[15px] text-ink">{children}</Text>;
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <View className="items-center rounded-2xl border border-cream-line bg-surface px-6 py-10">
      <Text className="text-center font-bodySemibold text-sm text-ink">{title}</Text>
      {body ? <Text className="mt-1 text-center font-body text-xs text-ink-soft">{body}</Text> : null}
    </View>
  );
}

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View className="mb-3 rounded-2xl px-4 py-3" style={{ backgroundColor: TONES.red.bg }}>
      <Text className="font-body text-xs leading-5" style={{ color: TONES.red.fg }}>{message}</Text>
    </View>
  );
}

export function Loading() {
  const theme = useThemeColors();
  return <ActivityIndicator className="my-10" color={theme.olive} />;
}

/** Filtrat si kapsula, në një rresht që rrëshqet anash. */
export function Chips<K extends string>({ items, value, onChange }: { items: { key: K; label: string; count?: number }[]; value: K; onChange: (key: K) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} className="-mx-4 mb-3" contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
      {items.map((item) => {
        const on = item.key === value;
        return (
          <Pressable
            key={item.key || "all"}
            onPress={() => {
              haptics.select();
              onChange(item.key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            className={`rounded-full border px-4 py-2 ${on ? "border-ink bg-ink" : "border-cream-line bg-surface"}`}
          >
            <Text className={`font-bodyMedium text-[13px] ${on ? "text-cream" : "text-ink"}`}>
              {item.label}
              {item.count ? ` · ${item.count}` : ""}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Statusi me ngjyrë; kur ka `onPress`, ndryshohet duke e prekur. */
export function Pill({ label, tone = TONES.gray, onPress }: { label: string; tone?: Tone; onPress?: () => void }) {
  const body = (
    <View className="flex-row items-center gap-1 self-start rounded-full px-3 py-1.5" style={{ backgroundColor: tone.bg }}>
      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: tone.fg }} />
      <Text className="font-bodySemibold text-[12px]" style={{ color: tone.fg }}>{label}</Text>
      {onPress ? <ChevronDown size={13} color={tone.fg} strokeWidth={2.4} /> : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}, ndrysho`} hitSlop={6}>
      {body}
    </Pressable>
  );
}

export function Btn({
  label,
  onPress,
  kind = "primary",
  busy = false,
  disabled = false,
  small = false,
}: {
  label: string;
  onPress: () => void;
  kind?: "primary" | "light" | "danger";
  busy?: boolean;
  disabled?: boolean;
  small?: boolean;
}) {
  const theme = useThemeColors();
  const off = busy || disabled;
  const shape = kind === "primary" ? "bg-ink" : kind === "danger" ? "" : "border border-cream-line bg-surface";
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      accessibilityRole="button"
      accessibilityState={{ disabled: off }}
      className={`items-center justify-center rounded-full ${small ? "px-4 py-2" : "px-5 py-3"} ${shape}`}
      style={[kind === "danger" ? { backgroundColor: TONES.red.fg } : null, { opacity: off ? 0.5 : 1 }]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={kind === "light" ? theme.ink : theme.cream} />
      ) : (
        <Text className={`font-bodySemibold ${small ? "text-[13px]" : "text-sm"} ${kind === "light" ? "text-ink" : kind === "danger" ? "text-white" : "text-cream"}`}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Kpi({ label, value, delta, warn, onPress }: { label: string; value: string; delta?: string | null; warn?: boolean; onPress?: () => void }) {
  const body = (
    <View className="flex-1 rounded-2xl border border-cream-line bg-surface p-3.5" style={warn ? { borderColor: TONES.orange.fg } : undefined}>
      <Text className="font-body text-xs text-ink-faint" numberOfLines={1}>{label}</Text>
      <Text className="mt-1 font-display text-xl text-ink" numberOfLines={1}>{value}</Text>
      {delta ? (
        <Text className="mt-0.5 font-bodyMedium text-[11px]" style={{ color: delta.startsWith("-") ? TONES.red.fg : TONES.green.fg }}>
          {delta} kundrejt 30 ditëve para
        </Text>
      ) : null}
    </View>
  );
  if (!onPress) return body;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="flex-1">
      {body}
    </Pressable>
  );
}

export function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder: string }) {
  const theme = useThemeColors();
  return (
    <View className="mb-3 flex-row items-center rounded-full border border-cream-line bg-surface px-4">
      <Search size={16} color={theme.inkFaint} strokeWidth={2} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.inkFaint}
        returnKeyType="search"
        autoCorrect={false}
        className="flex-1 py-3 pl-2.5 font-body text-[14px] text-ink"
      />
    </View>
  );
}

/** Zgjedhja nga një listë (statuse, marka, partnerë) në dritaren nga poshtë: punon njësoj në iPhone dhe Android. */
export function OptionSheet({
  visible,
  title,
  options,
  value,
  onPick,
  onClose,
  pickSelected = false,
}: {
  visible: boolean;
  title: string;
  options: Option[];
  value?: string | null;
  onPick: (key: string) => void;
  onClose: () => void;
  /** Edhe prekja e vlerës së shënuar thërret `onPick` (p.sh. konfirmimi i repartit të propozuar). */
  pickSelected?: boolean;
}) {
  const theme = useThemeColors();
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text className="mb-2 font-bodySemibold text-base text-ink">{title}</Text>
      {options.map((o) => {
        const on = o.key === (value ?? "");
        return (
          <Pressable
            key={o.key || "none"}
            onPress={() => {
              haptics.select();
              onClose();
              if (!on || pickSelected) onPick(o.key);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            className="flex-row items-center border-b border-cream-line py-3.5"
          >
            {o.tone ? <View className="mr-3 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: o.tone.fg }} /> : null}
            <Text className={`flex-1 font-body text-[15px] text-ink ${on ? "font-bodySemibold" : ""}`}>{o.label}</Text>
            {on ? <Check size={18} color={theme.olive} strokeWidth={2.4} /> : null}
          </Pressable>
        );
      })}
    </BottomSheet>
  );
}

/** Dritare me një fushë teksti (arsyeja e refuzimit, shënimi): zëvendëson `prompt`-in e webit. */
export function TextSheet({
  visible,
  title,
  placeholder,
  confirmLabel,
  minLength = 0,
  danger = false,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  title: string;
  placeholder: string;
  confirmLabel: string;
  minLength?: number;
  danger?: boolean;
  onConfirm: (text: string) => Promise<void> | void;
  onClose: () => void;
}) {
  const theme = useThemeColors();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const ready = text.trim().length >= minLength;
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text className="mb-3 font-bodySemibold text-base text-ink">{title}</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={theme.inkFaint}
        multiline
        maxLength={300}
        className="min-h-[88px] rounded-2xl border border-cream-line bg-surface px-4 py-3 font-body text-[15px] text-ink"
        style={{ textAlignVertical: "top" }}
      />
      <View className="mt-4 flex-row gap-2">
        <View className="flex-1">
          <Btn label="Anulo" kind="light" onPress={onClose} disabled={busy} />
        </View>
        <View className="flex-1">
          <Btn
            label={confirmLabel}
            kind={danger ? "danger" : "primary"}
            busy={busy}
            disabled={!ready}
            onPress={async () => {
              setBusy(true);
              await onConfirm(text.trim());
              setBusy(false);
              setText("");
            }}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

/** Pyetje para veprimeve që s'kthehen (fshirja, ndryshimi i një porosie të mbyllur). */
export function confirm(title: string, message: string, action: string, onYes: () => void, destructive = true): void {
  Alert.alert(title, message, [
    { text: "Anulo", style: "cancel" },
    { text: action, style: destructive ? "destructive" : "default", onPress: onYes },
  ]);
}
