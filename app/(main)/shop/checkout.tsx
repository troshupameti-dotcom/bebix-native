import { useCallback, useEffect, useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { supabase } from "@/lib/supabase/client";
import { BackButton } from "@/components/ui/BackButton";
import { fetchSavedContact } from "@/lib/shop/orders";
import { track } from "@/lib/analytics/posthog";

/**
 * Gabimet e bazës vijnë si tekst teknik (p.sh. kufizime stoku). Klienti
 * duhet të kuptojë çfarë të bëjë, jo çfarë tha Postgres-i.
 */
function friendlyError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("stock") || m.includes("stok")) {
    return "Njëri nga produktet sapo mbaroi nga stoku. Hiqe nga shporta dhe provo përsëri.";
  }
  if (m.includes("jwt") || m.includes("auth") || m.includes("loguar")) {
    return "Sesioni skadoi. Kyçu përsëri dhe porosia ruhet në shportë.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "S'ka lidhje me internetin. Kontrollo lidhjen dhe provo përsëri.";
  }
  return message;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { state, cartTotal, clearCart } = useAppState();
  // "loading" derisa lexohet sesioni lokal — pa këtë, ekrani i kyçjes
  // pulsonte për një moment edhe për përdoruesit e kyçur.
  const [authState, setAuthState] = useState<"loading" | "in" | "out">("loading");

  // Emri vjen nga profili si vlere fillestare; porosia e fundit e plotson
  // pastaj cfare mungon.
  const [fullName, setFullName] = useState(() => state.profile.parentName ?? "");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) setAuthState(data.session ? "in" : "out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (active) setAuthState(session ? "in" : "out");
    });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);

  // Parambushje: emri nga profili, adresa dhe telefoni nga porosia e fundit.
  useEffect(() => {
    let active = true;
    if (authState !== "in") return;

    fetchSavedContact().then((saved) => {
      if (!active || !saved) return;
      setFullName((prev) => prev || saved.fullName);
      setPhone((prev) => prev || saved.phone);
      setAddress((prev) => prev || saved.address);
      setCity((prev) => prev || saved.city);
    });

    return () => { active = false; };
  }, [authState]);

  useEffect(() => {
    if (state.cartItems.length === 0) return;
    track("checkout_started", {
      items: state.cartItems.reduce((n, i) => n + i.qty, 0),
      value: Number(cartTotal().toFixed(2)),
    });
    // Vetem ne hapje te ekranit, jo sa here ndryshon shporta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canSubmit = !!(fullName.trim() && phone.trim() && address.trim() && city.trim() && state.cartItems.length > 0);

  const submitOrder = useCallback(async () => {
    if (!canSubmit) return;
    setLoading(true);
    setError(null);
    try {
      // place_order() bën gjithçka brenda një transaksioni atomik:
      // verifikon stokun te partnerët, krijon porosinë (orders.items
      // mbetet i njëjtë si më parë), zbret stokun dhe krijon fulfillment
      // per-partner. Nëse stoku s'mjafton për ndonjë artikull, gjithë
      // transaksioni rrëzohet dhe s'krijohet asnjë porosi e pjesshme.
      const { error: rpcError } = await supabase.rpc("place_order", {
        p_full_name: fullName.trim(),
        p_phone: phone.trim(),
        p_address: address.trim(),
        p_city: city.trim(),
        p_items: state.cartItems,
      });

      if (rpcError) throw new Error(rpcError.message);

      track("order_placed", {
        items: state.cartItems.reduce((n, i) => n + i.qty, 0),
        value: Number(cartTotal().toFixed(2)),
      });
      clearCart();
      setDone(true);
    } catch (e: any) {
      const message = e?.message ?? "Diçka shkoi keq, provo përsëri.";
      track("order_failed", { reason: String(message).slice(0, 120) });
      setError(friendlyError(message));
    } finally {
      setLoading(false);
    }
  }, [canSubmit, fullName, phone, address, city, state.cartItems, clearCart, cartTotal]);

  // --- Kyçja kërkohet PARA formularit, jo pasi e mbush.
  if (authState === "loading") {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator className="text-olive" />
      </SafeAreaView>
    );
  }

  if (authState === "out") {
    return (
      <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
        <View className="flex-row items-center px-5 pt-2 mb-4">
          <BackButton fallback="/(main)/shop/cart" className="mr-3" />
          <Text className="font-display text-2xl text-ink">Përfundo Porosinë</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8 -mt-16">
          <View className="w-14 h-14 rounded-full bg-olive-bg items-center justify-center mb-4">
            <Icon name="lock" size={24} color="#6E7452" />
          </View>
          <Text className="font-bodySemibold text-base text-ink mb-2 text-center">Kyçu për të porositur</Text>
          <Text className="font-body text-sm text-ink-soft text-center leading-5 mb-6">
            Na duhet llogaria jote që ta ndjekësh porosinë dhe të mos e rishkruash adresën herën tjetër.
            Shporta të ruhet.
          </Text>
          <Pressable
            onPress={() => router.push({ pathname: "/(auth)/login", params: { redirect: "/shop/checkout" } })}
            className="bg-olive rounded-xl2 py-3.5 px-8"
          >
            <Text className="font-bodySemibold text-sm text-on-accent">Kyçu</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center px-8">
        <View className="w-16 h-16 rounded-full bg-olive-bg items-center justify-center mb-4">
          <Icon name="check" size={28} color="#6E7452" />
        </View>
        <Text className="font-display text-xl text-ink text-center mb-2">Faleminderit!</Text>
        <Text className="font-body text-sm text-ink-soft text-center mb-6 leading-5">
          Porosia jote u regjistrua. Do të kontaktohesh për konfirmimin dhe koston e dërgesës.
        </Text>
        <Pressable onPress={() => router.replace("/shop/orders")} className="bg-olive rounded-xl2 py-3 px-6 mb-3">
          <Text className="font-bodyMedium text-sm text-on-accent">Shiko porosinë</Text>
        </Pressable>
        <Pressable onPress={() => router.replace("/shop")}>
          <Text className="font-bodyMedium text-sm text-olive">Kthehu te Dyqani</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <BackButton fallback="/(main)/shop/cart" className="mr-3" />
        <Text className="font-display text-2xl text-ink">Përfundo Porosinë</Text>
      </View>

      <ScrollView className="px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Çfarë po porosit — e dukshme para se të mbushet formulari */}
        <View style={shadows.soft} className="bg-surface rounded-xl2 p-4 mb-5">
          {state.cartItems.map((item) => (
            <View key={item.id} className="flex-row items-center justify-between mb-2">
              <Text className="flex-1 font-body text-xs text-ink-soft" numberOfLines={1}>
                {item.name} ×{item.qty}
              </Text>
              <Text className="font-bodyMedium text-xs text-ink ml-3">€{(item.price * item.qty).toFixed(2)}</Text>
            </View>
          ))}
          <View className="flex-row items-center justify-between pt-2 mt-1 border-t border-cream-line">
            <Text className="font-bodyMedium text-sm text-ink-soft">Totali i produkteve</Text>
            <Text className="font-bodySemibold text-lg text-ink">€{cartTotal().toFixed(2)}</Text>
          </View>
          <Text className="font-body text-[11px] text-ink-faint mt-2 leading-4">
            Dërgesa llogaritet me konfirmimin e porosisë. Paguan në dorëzim.
          </Text>
        </View>

        <Text className="font-bodyMedium text-sm text-ink-soft mb-2">Emri i plotë</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="p.sh. Arta Krasniqi"
          placeholderClassName="text-ink-faint"
          style={shadows.soft}
          className="bg-surface rounded-xl2 px-4 py-3 font-body text-sm text-ink mb-4"
        />

        <Text className="font-bodyMedium text-sm text-ink-soft mb-2">Numri i telefonit</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="p.sh. 044 123 456"
          placeholderClassName="text-ink-faint"
          keyboardType="phone-pad"
          style={shadows.soft}
          className="bg-surface rounded-xl2 px-4 py-3 font-body text-sm text-ink mb-4"
        />

        <Text className="font-bodyMedium text-sm text-ink-soft mb-2">Adresa</Text>
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Rruga, numri"
          placeholderClassName="text-ink-faint"
          style={shadows.soft}
          className="bg-surface rounded-xl2 px-4 py-3 font-body text-sm text-ink mb-4"
        />

        <Text className="font-bodyMedium text-sm text-ink-soft mb-2">Qyteti</Text>
        <TextInput
          value={city}
          onChangeText={setCity}
          placeholder="p.sh. Prishtinë"
          placeholderClassName="text-ink-faint"
          style={shadows.soft}
          className="bg-surface rounded-xl2 px-4 py-3 font-body text-sm text-ink mb-6"
        />

        {error && (
          <View className="bg-orange-bg rounded-xl2 p-3 mb-4">
            <Text className="font-body text-xs text-orange leading-5">{error}</Text>
          </View>
        )}

        <Pressable
          onPress={submitOrder}
          disabled={!canSubmit || loading}
          className="bg-olive rounded-xl2 py-3.5 items-center"
          style={{ opacity: canSubmit && !loading ? 1 : 0.5 }}
        >
          {loading ? (
            <ActivityIndicator className="text-on-accent" />
          ) : (
            <Text className="font-bodySemibold text-sm text-on-accent">Konfirmo Porosinë</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
