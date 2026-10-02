import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import { reportError } from "@/lib/errors/reporter";

/**
 * Kur një ekran rrëzohet gjatë vizatimit, klienti sheh këtë, jo një ekran të
 * bardhë ose rrëzim të aplikacionit. Gabimi dërgohet te Sentry.
 *
 * Shfaqet jashtë ofruesve (gjuha, tema), prandaj nuk përdor asnjërin: ngjyra
 * të fiksuara dhe tekst në të dyja gjuhët.
 */
export function AppErrorBoundary({ error, retry }: { error: Error; retry: () => void }) {
  useEffect(() => {
    reportError(error, "error_boundary");
  }, [error]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32, backgroundColor: "#F3F3F1" }}>
      <Text style={{ fontSize: 20, fontWeight: "700", color: "#1C1A16", textAlign: "center" }}>Diçka shkoi keq</Text>
      <Text style={{ marginTop: 6, fontSize: 14, color: "#565047", textAlign: "center" }}>Something went wrong</Text>
      <Text style={{ marginTop: 14, fontSize: 14, lineHeight: 21, color: "#565047", textAlign: "center" }}>
        Provo përsëri. Të dhënat e tua janë të sigurta.{"\n"}Try again. Your data is safe.
      </Text>
      <Pressable
        onPress={retry}
        accessibilityRole="button"
        accessibilityLabel="Provo përsëri"
        style={{ marginTop: 24, backgroundColor: "#1F3D38", borderRadius: 999, paddingHorizontal: 28, paddingVertical: 13 }}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "600" }}>Provo përsëri · Try again</Text>
      </Pressable>
    </View>
  );
}
