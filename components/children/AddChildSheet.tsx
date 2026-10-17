import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { FormField } from "@/components/baby/FormField";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { formatDobInput, parseDobInput, parseDueInput } from "@/lib/babyProfile";
import { haptics } from "@/lib/haptics";
import { addChildAndSwitch, childErrorMessage } from "@/components/children/childActions";

/** Fëmija i ri: emri dhe datëlindja. I dyti pa Premium hap dritaren e Premium-it (`onPremium`). */
export function AddChildSheet({ visible, onClose, onPremium }: { visible: boolean; onClose: () => void; onPremium: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // "Ka lindur" (datëlindja) ose "Pritet" (data e pritur e lindjes, shtatzënia).
  const [kind, setKind] = useState<"born" | "expecting">("born");

  function close() {
    setName("");
    setDob("");
    setError(null);
    setKind("born");
    onClose();
  }

  async function save() {
    const date = kind === "born" ? parseDobInput(dob) : parseDueInput(dob);
    if (!date) {
      setError(t("children_err_date"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addChildAndSwitch(
        kind === "born" ? { name: name.trim(), birthDate: date } : { name: name.trim(), birthDate: null, dueDate: date }
      );
      haptics.success();
      close();
    } catch (e) {
      const msg = childErrorMessage(e);
      if (msg === "premium") {
        close();
        onPremium();
      } else {
        setError(t(msg));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <BottomSheet visible={visible} onClose={close}>
      <View className="gap-4 pb-2">
        <Text accessibilityRole="header" className="font-display text-xl text-ink">
          {t("children_add_title")}
        </Text>
        <View className="flex-row rounded-2xl bg-cream-soft p-1" accessibilityRole="tablist">
          {(["born", "expecting"] as const).map((k) => (
            <Pressable
              key={k}
              onPress={() => setKind(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: kind === k }}
              className={`flex-1 items-center rounded-xl py-2 ${kind === k ? "bg-surface" : ""}`}
            >
              <Text className={`font-bodyMedium text-[13px] ${kind === k ? "text-ink" : "text-ink-faint"}`}>
                {t(k === "born" ? "children_kind_born" : "children_kind_expecting")}
              </Text>
            </Pressable>
          ))}
        </View>
        <FormField label={t("children_name_label")} placeholder={t("children_name_ph")} value={name} onChangeText={setName} autoCapitalize="words" />
        <FormField
          label={t(kind === "born" ? "children_dob_label" : "children_due_label")}
          placeholder={t("children_dob_ph")}
          value={dob}
          onChangeText={(v) => setDob(formatDobInput(v))}
          keyboardType="number-pad"
          maxLength={10}
        />
        {error ? (
          <Text accessibilityRole="alert" className="font-body text-[13px] text-orange">
            {error}
          </Text>
        ) : null}
        <Pressable
          onPress={save}
          disabled={busy}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy, busy }}
          className="items-center rounded-2xl bg-olive py-3.5"
          style={{ opacity: busy ? 0.6 : 1 }}
        >
          <Text className="font-bodySemibold text-[15px] text-on-accent">{t("children_add_save")}</Text>
        </Pressable>
      </View>
    </BottomSheet>
  );
}
