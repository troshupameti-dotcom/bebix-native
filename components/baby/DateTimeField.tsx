import { useState } from "react";
import { View, Text, Pressable, Platform } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { haptics } from "@/lib/haptics";

type DateTimeFieldProps = {
  label: string;
  value: string; // ISO
  mode: "date" | "time" | "datetime";
  onChange: (iso: string) => void;
};

export function DateTimeField({ label, value, mode, onChange }: DateTimeFieldProps) {
  const { lang } = useTranslation();
  const [show, setShow] = useState(false);
  const date = new Date(value);

  const display =
    mode === "date"
      ? date.toLocaleDateString(lang === "en" ? "en-GB" : "sq-AL", { day: "numeric", month: "short", year: "numeric" })
      : mode === "time"
      ? date.toLocaleTimeString(lang === "en" ? "en-GB" : "sq-AL", { hour: "2-digit", minute: "2-digit" })
      : date.toLocaleString(lang === "en" ? "en-GB" : "sq-AL", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
        });

  return (
    <View className="gap-1.5">
      <Text className="font-bodyMedium text-[12.5px] text-ink-soft">{label}</Text>
      <Pressable
        onPress={() => {
          haptics.select();
          setShow(true);
        }}
        className="rounded-2xl border border-ink/10 bg-white px-4 py-3.5"
      >
        <Text className="font-body text-[15px] text-ink">{display}</Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={date}
          mode={mode}
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={(event, selected) => {
            setShow(Platform.OS === "ios");
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
