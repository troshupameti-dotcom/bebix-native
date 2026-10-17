import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { FormField } from "@/components/baby/FormField";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { formatDobInput, parseDobInput } from "@/lib/babyProfile";
import { haptics } from "@/lib/haptics";
import { addChildAndSwitch, childErrorMessage } from "@/components/children/childActions";

/** Fëmija i ri: emri dhe datëlindja. I dyti pa Premium hap dritaren e Premium-it (`onPremium`). */
export function AddChildSheet({ visible, onClose, onPremium }: { visible: boolean; onClose: () => void; onPremium: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setName("");
    setDob("");
    setError(null);
    onClose();
  }

  async function save() {
    const birthDate = parseDobInput(dob);
    if (!birthDate) {
      setError(t("children_err_date"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await addChildAndSwitch({ name: name.trim(), birthDate });
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
        <FormField label={t("children_name_label")} placeholder={t("children_name_ph")} value={name} onChangeText={setName} autoCapitalize="words" />
        <FormField
          label={t("children_dob_label")}
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
