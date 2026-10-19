import { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";
import { clockTime } from "@/lib/dateUtils";

type DateTimeFieldProps = {
  label: string;
  value: string; // ISO
  mode: "date" | "time" | "datetime";
  onChange: (iso: string) => void;
};

/**
 * Android: dialogët nativë hapen me API-në imperative. Android s'ka mënyrën "datetime" (me komponentin e vjetër app-i
 * rrëzohej te pelena, ushqimi, gjumi dhe momentet), ndaj hapet data, pastaj ora, dhe bashkohen.
 */
function openAndroidPicker(value: Date, mode: DateTimeFieldProps["mode"], onChange: (iso: string) => void) {
  const pickTime = (base: Date) =>
    DateTimePickerAndroid.open({
      value: base,
      mode: "time",
      is24Hour: true,
      onChange: (event, selected) => {
        if (event.type === "set" && selected) onChange(selected.toISOString());
      },
    });
  if (mode === "time") {
    pickTime(value);
    return;
  }
  DateTimePickerAndroid.open({
    value,
    mode: "date",
    onChange: (event, selected) => {
      if (event.type !== "set" || !selected) return;
      if (mode === "date") {
        onChange(selected.toISOString());
        return;
      }
      const next = new Date(value);
      next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate());
      // Dialogu i dytë hapet pasi mbyllet i pari.
      setTimeout(() => pickTime(next), 50);
    },
  });
}

export function DateTimeField({ label, value, mode, onChange }: DateTimeFieldProps) {
  const { lang } = useTranslation();
  const [show, setShow] = useState(false);
  const date = new Date(value);

  const display =
    mode === "date"
      ? date.toLocaleDateString(lang === "en" ? "en-GB" : "sq-AL", { day: "numeric", month: "short", year: "numeric" })
      : mode === "time"
      ? clockTime(date)
      : `${date.toLocaleDateString(lang === "en" ? "en-GB" : "sq-AL", { day: "numeric", month: "short" })}, ${clockTime(date)}`;

  return (
    <View className="gap-1.5">
      <Text className="font-bodyMedium text-[12.5px] text-ink-soft">{label}</Text>
      <Pressable
        onPress={() => {
          haptics.select();
          if (Platform.OS === "android") {
            openAndroidPicker(date, mode, onChange);
            return;
          }
          // iPhone: rrota shfaqet poshtë fushës; prekja tjetër e mbyll.
          setShow((open) => !open);
        }}
        className="rounded-2xl border border-ink/10 bg-surface px-4 py-3.5"
      >
        <Text className="font-body text-[15px] text-ink">{display}</Text>
      </Pressable>
      {show && Platform.OS !== "android" && (
        <DateTimePicker
          value={date}
          mode={mode}
          display="spinner"
          // iPhone: shqipja e jep orën 12-orëshe; vetëm për orën (pa emra muajsh) përdoret formati 24-orësh.
          locale={mode === "time" ? "en-GB" : undefined}
          onChange={(event, selected) => {
            if (event.type === "dismissed") {
              setShow(false);
              return;
            }
            if (selected) onChange(selected.toISOString());
          }}
        />
      )}
    </View>
  );
}
