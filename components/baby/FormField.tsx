import { View, Text, TextInput, TextInputProps } from "react-native";

type FormFieldProps = TextInputProps & {
  label: string;
};

export function FormField({ label, className = "", ...props }: FormFieldProps) {
  return (
    <View className="gap-1.5">
      <Text className="font-bodyMedium text-[12.5px] text-ink-soft">{label}</Text>
      <TextInput
        placeholderClassName="text-ink-faint"
        className={`rounded-2xl border border-ink/10 bg-surface px-4 py-3.5 font-body text-[15px] text-ink ${className}`}
        {...props}
      />
    </View>
  );
}
