import { View, Text, TextInput, TextInputProps, Pressable } from "react-native";
import { useState } from "react";
import { Icon } from "@/components/ui/Icon";

type AuthInputProps = TextInputProps & {
  label: string;
  error?: string;
  isPassword?: boolean;
  trailingSlot?: React.ReactNode;
};

/** Shared text field for login/signup: label, focus ring, error, optional password toggle. */
export function AuthInput({
  label,
  error,
  isPassword,
  trailingSlot,
  secureTextEntry,
  ...props
}: AuthInputProps) {
  const [visible, setVisible] = useState(false);
  const [focused, setFocused] = useState(false);

  return (
    <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Text className="font-bodyMedium text-[13px] text-ink-soft">{label}</Text>
        {trailingSlot}
      </View>
      <View
        className={`flex-row items-center rounded-2xl border bg-cream px-4 ${
          error ? "border-red-300" : focused ? "border-ink/25" : "border-ink/10"
        }`}
      >
        <TextInput
          className="flex-1 py-3.5 font-body text-[15px] text-ink"
          placeholderTextColor="#A79D8A"
          secureTextEntry={isPassword ? !visible : secureTextEntry}
          autoCapitalize="none"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
        {isPassword && (
          <Pressable onPress={() => setVisible((v) => !v)} hitSlop={8} className="ml-2">
            <Icon name={visible ? "eyeOff" : "eye"} size={18} color="#A79D8A" />
          </Pressable>
        )}
      </View>
      {error ? <Text className="font-body text-xs text-red-500">{error}</Text> : null}
    </View>
  );
}
