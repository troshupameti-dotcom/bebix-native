import { TextInput } from "react-native";
import { cssInterop } from "nativewind";

/**
 * NativeWind s'e njeh vetë ngjyrën e placeholder-it. Ky regjistrim shton
 * `placeholderClassName` (p.sh. "text-ink-faint"), që ngjyra të ndjekë temën
 * pa `placeholderTextColor` të ngurtë në çdo input.
 *
 * `className` duhet përsëritur siç e ka NativeWind si parazgjedhje, sepse
 * thirrja e re e zëvendëson regjistrimin e vjetër.
 *
 * Importohet një herë, te app/_layout.tsx.
 */
cssInterop(TextInput, {
  className: { target: "style", nativeStyleToProp: { textAlign: true } },
  placeholderClassName: { target: false, nativeStyleToProp: { color: "placeholderTextColor" } },
});

declare module "react-native" {
  interface TextInputProps {
    /** Klasa për ngjyrën e placeholder-it, p.sh. "text-ink-faint". */
    placeholderClassName?: string;
  }
}
