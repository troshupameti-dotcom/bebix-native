import { useState } from "react";
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { supabase } from "@/lib/supabase/client";

export default function CheckoutScreen() {
  const router = useRouter();
  const { state, cartTotal, clearCart } = useAppState();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const canSubmit = fullName.trim() && phone.trim() && address.trim() && city.trim() && state.cartItems.length > 0;

  async function submitOrder() {
    if (!canSubmit) return;
    setLoading(true);
    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error("Duhet të jesh i loguar për të bërë porosi.");

      // place_order() bën gjithçka brenda një transaksioni atomik:
      // verifikon stokun te partnerët, krijon porosinë (orders.items
      // mbetet i njëjtë si më parë), zbret stokun dhe krijon fulfillment
      // per-partner. Nëse stoku s'mjafton për ndonjë artikull, gjithë
      // transaksioni rrëzohet dhe s'krijohet asnjë porosi e pjesshme.
      const { error } = await supabase.rpc("place_order", {
        p_full_name: fullName.trim(),
        p_phone: phone.trim(),
        p_address: address.trim(),
        p_city: city.trim(),
        p_items: state.cartItems,
      });

      if (error) throw error;

      clearCart();
      setDone(true);
    } catch (e: any) {
      Alert.alert("Gabim", e.message ?? "Diçka shkoi keq, provo përsëri.");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center px-8">
        <View className="w-16 h-16 rounded-full bg-olive-bg items-center justify-center mb-4">
          <Icon name="sparkle" size={28} color="#6E7452" />
        </View>
        <Text className="font-display text-xl text-ink text-center mb-2">Faleminderit!</Text>
        <Text className="font-body text-sm text-ink-soft text-center mb-6">
          Porosia jote u pranua dhe do të kontaktohesh së shpejti për dërgesën.
        </Text>
        <Pressable onPress={() => router.replace("/shop")} className="bg-olive rounded-xl2 py-3 px-6">
          <Text className="font-bodyMedium text-sm text-white">Kthehu te Dyqani</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-5 pt-2 mb-4">
        <Pressable onPress={() => router.back()} style={shadows.soft} className="w-10 h-10 rounded-full bg-surface items-center justify-center mr-3">
          <Icon name="chevronLeft" size={18} color="#2C271F" />
        </Pressable>
        <Text className="font-display text-2xl text-ink">Përfundo Porosinë</Text>
      </View>

      <ScrollView className="px-5" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <Text className="font-bodyMedium text-sm text-ink-soft mb-2">Emri i plotë</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="p.sh. Arta Krasniqi"
          style={shadows.soft}
          className="bg-surface rounded-xl2 px-4 py-3 font-body text-sm text-ink mb-4"
        />

        <Text className="font-bodyMedium text-sm text-ink-soft mb-2">Numri i telefonit</Text>
        <TextInput
          value={phone}
          onChangeText={setPhone}
          placeholder="p.sh. 044 123 456"
          keyboardType="phone-pad"
          style={shadows.soft}
          className="bg-surface rounded-xl2 px-4 py-3 font-body text-sm text-ink mb-4"
        />

        <Text className="font-bodyMedium text-sm text-ink-soft mb-2">Adresa</Text>
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder="Rruga, numri"
          style={shadows.soft}
          className="bg-surface rounded-xl2 px-4 py-3 font-body text-sm text-ink mb-4"
        />

        <Text className="font-bodyMedium text-sm text-ink-soft mb-2">Qyteti</Text>
        <TextInput
          value={city}
          onChangeText={setCity}
          placeholder="p.sh. Prishtinë"
          style={shadows.soft}
          className="bg-surface rounded-xl2 px-4 py-3 font-body text-sm text-ink mb-6"
        />

        <View style={shadows.soft} className="bg-surface rounded-xl2 p-4 flex-row items-center justify-between mb-6">
          <Text className="font-bodyMedium text-sm text-ink-soft">Totali</Text>
          <Text className="font-bodyMedium text-lg text-ink">€{cartTotal().toFixed(2)}</Text>
        </View>

        <Pressable
          onPress={submitOrder}
          disabled={!canSubmit || loading}
          className="bg-olive rounded-xl2 py-3.5 items-center"
          style={{ opacity: canSubmit && !loading ? 1 : 0.5 }}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text className="font-bodySemibold text-sm text-white">Konfirmo Porosinë</Text>}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}