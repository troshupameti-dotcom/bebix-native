import { useState } from "react";
import { View, Text, Pressable, TextInput } from "react-native";
import { Icon, IconName } from "@/components/ui/Icon";
import { useTranslation } from "@/lib/i18n/LanguageContext";

export type PickerOption = { key: string; label: string; icon?: IconName };

type PickerSheetContentProps = {
  title: string;
  options: PickerOption[];
  onSelect: (key: string) => void;
  allowCustom?: boolean;
  needsValue?: boolean;
  customLabelPlaceholder?: string;
  customValuePlaceholder?: string;
  onConfirmCustom?: (label: string, value: string) => void;
};

/**
 * Shared "add item" sheet body: a scrollable list of not-yet-added
 * presets, plus an optional "add something else" row that reveals a
 * tiny inline form. Used for Growth stats, Medical info, Milestones,
 * and Quick actions — same interaction, different data.
 */
export function PickerSheetContent({
  title,
  options,
  onSelect,
  allowCustom,
  needsValue,
  customLabelPlaceholder,
  customValuePlaceholder,
  onConfirmCustom,
}: PickerSheetContentProps) {
  const { t } = useTranslation();
  const [showCustom, setShowCustom] = useState(false);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");

  function confirm() {
    if (!name.trim()) return;
    onConfirmCustom?.(name.trim(), value.trim());
    setName("");
    setValue("");
    setShowCustom(false);
  }

  return (
    <View className="gap-1 pb-2">
      <Text className="mb-2 font-display text-lg text-ink">{title}</Text>

      {!showCustom && (
        <>
          {options.map((opt) => (
            <Pressable
              key={opt.key}
              onPress={() => onSelect(opt.key)}
              className="flex-row items-center gap-3 border-b border-ink/8 py-3"
            >
              {opt.icon && (
                <View className="h-9 w-9 items-center justify-center rounded-xl bg-cream-soft">
                  <Icon name={opt.icon} size={17} color="#2C271F" />
                </View>
              )}
              <Text className="font-body text-[14px] text-ink">{opt.label}</Text>
            </Pressable>
          ))}
          {options.length === 0 && !allowCustom && (
            <Text className="py-3 font-body text-[13px] text-ink-soft">{t("all_added")}</Text>
          )}
          {allowCustom && (
            <Pressable onPress={() => setShowCustom(true)} className="flex-row items-center gap-3 py-3">
              <View className="h-9 w-9 items-center justify-center rounded-xl bg-cream-soft">
                <Icon name="edit" size={16} color="#2C271F" />
              </View>
              <Text className="font-body text-[14px] text-ink">{t("custom_option")}</Text>
            </Pressable>
          )}
        </>
      )}

      {showCustom && (
        <View className="gap-3 pt-1">
          <View className="gap-1.5">
            <Text className="font-bodyMedium text-[13px] text-ink-soft">{t("label_field")}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={customLabelPlaceholder}
              placeholderTextColor="#A79D8A"
              className="rounded-2xl border border-ink/10 bg-white px-4 py-3.5 font-body text-[15px] text-ink"
            />
          </View>
          {needsValue && (
            <View className="gap-1.5">
              <Text className="font-bodyMedium text-[13px] text-ink-soft">{t("value_field")}</Text>
              <TextInput
                value={value}
                onChangeText={setValue}
                placeholder={customValuePlaceholder}
                placeholderTextColor="#A79D8A"
                className="rounded-2xl border border-ink/10 bg-white px-4 py-3.5 font-body text-[15px] text-ink"
              />
            </View>
          )}
          <Pressable onPress={confirm} className="mt-2 items-center rounded-2xl bg-ink py-4">
            <Text className="font-bodySemibold text-[15px] text-cream">{t("add_action")}</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}
