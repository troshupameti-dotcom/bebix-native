import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { View, Text, Pressable, TextInput, ScrollView, ActivityIndicator, Image, useWindowDimensions, type TextInputProps } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAppState } from "@/lib/state/AppStateContext";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { Icon } from "@/components/ui/Icon";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useKeyboardHeight } from "@/lib/ui/useKeyboardHeight";
import { supabase } from "@/lib/supabase/client";
import { BackButton } from "@/components/ui/BackButton";
import { fetchSavedContact } from "@/lib/shop/orders";
import { rememberGuestOrder } from "@/lib/shop/guestOrders";
import type { TranslationKey } from "@/lib/i18n/translations";
import { track } from "@/lib/analytics/posthog";
import { friendlyError } from "@/lib/errors/userMessage";
import { isValidPhone, newOrderRef, reconcileCart, type CartChange, type ProductNow } from "@/lib/shop/cartCheck";
import { SHIPPING_COUNTRIES, type ShipCountry } from "@/lib/shop/shipping";
import { AVAILABLE_METHODS, BANK_DETAILS, paymentReference, type PaymentMethod } from "@/lib/shop/payment";
import { startCardPayment } from "@/lib/shop/cardPayment";

/**
 * Gabimet e bazës vijnë si tekst teknik (p.sh. kufizime stoku). Klienti
 * duhet të kuptojë çfarë të bëjë, jo çfarë tha Postgres-i.
 */
/** Kthen nje CELES perkthimi, ose null nese mesazhi s'njihet. */
/** Kontakti i mysafirit, që formulari të dalë i mbushur herën tjetër. */
const GUEST_CONTACT_KEY = "bebix_guest_contact_v1";

const PAY_TITLE: Record<PaymentMethod, TranslationKey> = {
  cod: "co_pay_cod",
  card: "co_pay_card",
  bank_transfer: "co_pay_bank",
};
const PAY_HINT: Record<PaymentMethod, TranslationKey> = {
  cod: "co_pay_cod_hint",
  card: "co_pay_card_hint",
  bank_transfer: "co_pay_bank_hint",
};

function friendlyErrorKey(message: string): TranslationKey | null {
  const m = message.toLowerCase();
  if (m.includes("stock") || m.includes("stok")) return "co_err_stock";
  if (m.includes("jwt") || m.includes("auth") || m.includes("loguar")) return "co_err_session";
  if (m.includes("network") || m.includes("fetch")) return "co_err_network";
  return null;
}

export default function CheckoutScreen() {
  const router = useRouter();
  const { state, cartTotal, clearCart, replaceCartItems } = useAppState();
  const { t, language } = useTranslation();
  // "loading" derisa lexohet sesioni lokal — pa këtë, ekrani i kyçjes
  // pulsonte për një moment edhe për përdoruesit e kyçur.
  const [authState, setAuthState] = useState<"loading" | "in" | "out">("loading");

  // Emri vjen nga profili si vlere fillestare; porosia e fundit e plotson
  // pastaj cfare mungon.
  const [fullName, setFullName] = useState(() => state.profile.parentName ?? "");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState<ShipCountry>("XK");
  const [method, setMethod] = useState<PaymentMethod>("cod");
  // Çfarë u dërgua, për udhëzimet e pagesës në ekranin e fundit.
  const [placedPay, setPlacedPay] = useState<{ method: PaymentMethod; amount: number } | null>(null);
  // Dërgesa nga baza: fee numër, ose "na" kur baza s'e njeh ende (para migrimit): atëherë s'tregohet dërgesë.
  const [quote, setQuote] = useState<{ key: string; fee: number | "na" } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [placedId, setPlacedId] = useState<string | null>(null);
  // Porosia me kartë u krijua: ekrani i fundit ofron "Paguaj me kartë" përsëri (faqja s'u hap, ose klienti e mbylli).
  const [cardRetry, setCardRetry] = useState<{ id: string; ref: string } | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardFailed, setCardFailed] = useState(false);
  // Çka ndryshoi në shportë që kur u shtua (çmim, stok, produkt i hequr).
  const [changes, setChanges] = useState<CartChange[]>([]);
  // E njëjta referencë në çdo riprovim të kësaj porosie: nëse përgjigjja e
  // serverit humb në rrjet, riprovimi s'krijon porosi të dytë.
  const orderRef = useRef(newOrderRef());
  const theme = useThemeColors();
  const insets = useSafeAreaInsets();
  // Tastiera: shiriti i konfirmimit ngjitet mbi të (pa shiritin e tab-eve, kur është aty).
  const keyboard = useKeyboardHeight();
  const { height: windowHeight } = useWindowDimensions();
  const containerRef = useRef<View>(null);
  const [bottomGap, setBottomGap] = useState(0);
  const lift = Math.max(0, keyboard - bottomGap);

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

  // Kontakti i porosisë së fundit, i ruajtur në këtë telefon (mysafir dhe me llogari): s'varet nga rrjeti.
  useEffect(() => {
    if (authState === "loading") return;
    let active = true;
    AsyncStorage.getItem(GUEST_CONTACT_KEY)
      .then((raw) => {
        if (!active || !raw) return;
        const saved = JSON.parse(raw) as Partial<Record<"fullName" | "phone" | "address" | "city" | "email", string>>;
        setFullName((prev) => prev || saved.fullName || "");
        setPhone((prev) => prev || saved.phone || "");
        setEmail((prev) => prev || saved.email || "");
        setAddress((prev) => prev || saved.address || "");
        setCity((prev) => prev || saved.city || "");
      })
      .catch(() => {});
    return () => { active = false; };
  }, [authState]);

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

  // Me kartë dërgesa është falas (e llogarit baza); çmimi rikërkohet kur ndryshon metoda.
  const feeMethod = method === "card" && AVAILABLE_METHODS.includes("card") ? "card" : "cod";
  const quoteKey = `${country}|${state.cartItems.map((i) => i.id).join(",")}|${feeMethod}`;
  const shipping = quote?.key === quoteKey ? quote.fee : undefined;
  // Dërgesa e fundit e njohur mbahet gjatë ndërrimit të shtetit, që totali të mos kërcejë.
  const shownFee = typeof shipping === "number" ? shipping : typeof quote?.fee === "number" ? quote.fee : undefined;
  const shippingFee = shownFee ?? 0;
  // Baza e njeh dërgesën vetëm pas migrimit; para tij s'tregohet shtet as dërgesë (porosia shkon si më parë).
  const quoteWorks = quote !== null && quote.fee !== "na";
  // Porosia pret çmimin e shtetit të zgjedhur, që ajo që shihet të jetë ajo që paguhet.
  const quoteReady = quote !== null && (quote.fee === "na" || quote.key === quoteKey);

  // Çmimi i dërgesës e merr bazën, që vendi dhe produktet me "dërgesë falas" të numërohen njësoj si te porosia.
  useEffect(() => {
    if (state.cartItems.length === 0) return;
    let active = true;
    const args = { p_country: country, p_ids: state.cartItems.map((i) => i.id) };
    const standard = () => supabase.rpc("shipping_quote", args);
    // Para migrimit të dërgesës falas me kartë funksioni s'ekziston: atëherë mbetet çmimi i zakonshëm, që është
    // edhe ai që e ngarkon baza, pra çmimi që shihet është gjithmonë ai që paguhet.
    const request = feeMethod === "card"
      ? Promise.resolve(supabase.rpc("shipping_quote_by_method", { ...args, p_method: "card" })).then((res) => (res.error ? standard() : res))
      : standard();
    void Promise.resolve(request).then(({ data, error: quoteError }) => {
      if (!active) return;
      setQuote({ key: quoteKey, fee: quoteError || typeof data !== "number" ? "na" : data });
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey]);

  const canSubmit = !!(fullName.trim() && phone.trim() && address.trim() && city.trim() && state.cartItems.length > 0 && quoteReady);

  const submitOrder = useCallback(async () => {
    if (!canSubmit) return;
    if (!isValidPhone(phone)) {
      setError(t("co_err_phone"));
      return;
    }
    if (authState === "out" && email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      setError(t("co_err_email"));
      return;
    }
    setLoading(true);
    setError(null);
    setChanges([]);
    try {
      // Çmimet dhe stoku i sotëm, para se klienti të konfirmojë: nëse diçka
      // ndryshoi, shporta përditësohet dhe klienti e sheh para porosisë.
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, price, is_active, stock, image_url")
        .in("id", state.cartItems.map((i) => i.id));
      if (productsError) throw productsError;
      const checked = reconcileCart(state.cartItems, (products ?? []) as ProductNow[]);
      if (checked.changes.length > 0) {
        replaceCartItems(checked.items);
        setChanges(checked.changes);
        // Shporta ndryshoi: kjo është tashmë një porosi tjetër.
        orderRef.current = newOrderRef();
        return;
      }

      // place_order() bën gjithçka brenda një transaksioni atomik:
      // verifikon stokun te partnerët, krijon porosinë (orders.items
      // mbetet i njëjtë si më parë), zbret stokun dhe krijon fulfillment
      // per-partner. Nëse stoku s'mjafton për ndonjë artikull, gjithë
      // transaksioni rrëzohet dhe s'krijohet asnjë porosi e pjesshme.
      // Pa llogari: e njëjta porosi, përmes `place_guest_order` (admini
      // e konfirmon me telefon). Me llogari: `place_order`, si më parë.
      const guest = authState === "out";
      const sentRef = orderRef.current;
      // Metoda dërgohet vetëm kur baza e njeh dërgesën (pas migrimit); përndryshe porosia shkon si më parë, "në dorëzim".
      const sentMethod: PaymentMethod = typeof shipping === "number" && AVAILABLE_METHODS.includes(method) ? method : "cod";
      const { data: orderId, error: rpcError } = await supabase.rpc(guest ? "place_guest_order" : "place_order", {
        p_full_name: fullName.trim(),
        p_phone: phone.trim(),
        p_address: address.trim(),
        p_city: city.trim(),
        p_items: state.cartItems,
        p_client_ref: orderRef.current,
        // Vendi dërgohet vetëm kur baza e njeh (pas migrimit); përndryshe porosia shkon si më parë.
        ...(typeof shipping === "number" ? { p_country: country, p_payment_method: sentMethod, p_lang: language === "en" ? "en" : "sq" } : {}),
      });

      if (rpcError) throw new Error(rpcError.message);
      setPlacedId(typeof orderId === "string" ? orderId : null);
      setPlacedPay({ method: sentMethod, amount: cartTotal() + (typeof shipping === "number" ? shipping : 0) });
      const payByCard = sentMethod === "card" && typeof orderId === "string";
      if (guest) {
        // Porosia ruhet në pajisje: statusi i saj del te "Porositë e mia" edhe
        // kur mysafiri del nga app-i dhe kthehet.
        if (typeof orderId === "string") void rememberGuestOrder(orderId);
        // Email-i (opsional) për konfirmim: s'e prish kurrë porosinë nëse dështon.
        if (email.trim() && typeof orderId === "string") {
          const saving = Promise.resolve(
            supabase.rpc("set_order_email", { p_order_id: orderId, p_client_ref: sentRef, p_email: email.trim() })
          ).catch(() => {});
          // Me kartë, email-i duhet të jetë te porosia para se të hapet faqja e pagesës (e merr Stripe për faturën).
          if (payByCard) await saving;
        }
      }
      // Herën tjetër formulari del i mbushur: adresa ruhet në këtë telefon për këdo (me llogari ose mysafir).
      void AsyncStorage.setItem(
        GUEST_CONTACT_KEY,
        JSON.stringify({ fullName: fullName.trim(), phone: phone.trim(), email: email.trim(), address: address.trim(), city: city.trim() })
      ).catch(() => {});

      track("order_placed", {
        items: state.cartItems.reduce((n, i) => n + i.qty, 0),
        value: Number(cartTotal().toFixed(2)),
      });
      clearCart();
      orderRef.current = newOrderRef();
      if (payByCard) {
        // Karta paguhet te faqja e Stripe; porosia shënohet "paguar" vetëm kur Stripe konfirmon (webhook).
        setCardRetry({ id: orderId, ref: sentRef });
        setCardFailed(!(await startCardPayment(orderId, sentRef, language === "en" ? "en" : "sq")));
      }
      setDone(true);
    } catch (e: any) {
      const message = e?.message ?? "";
      track("order_failed", { reason: String(message).slice(0, 120) || "unknown" });
      const key = friendlyErrorKey(message);
      setError(key ? t(key) : friendlyError(e, t, "co_err_generic"));
    } finally {
      setLoading(false);
    }
  }, [canSubmit, fullName, phone, email, address, city, country, method, shipping, state.cartItems, clearCart, cartTotal, replaceCartItems, t, authState, language]);

  const retryCard = useCallback(async () => {
    if (!cardRetry || cardBusy) return;
    setCardBusy(true);
    setCardFailed(false);
    const opened = await startCardPayment(cardRetry.id, cardRetry.ref, language === "en" ? "en" : "sq");
    setCardFailed(!opened);
    setCardBusy(false);
  }, [cardRetry, cardBusy, language]);

  if (authState === "loading") {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center">
        <ActivityIndicator className="text-olive" />
      </SafeAreaView>
    );
  }

  const isGuest = authState === "out";

  if (done) {
    return (
      <SafeAreaView className="flex-1 bg-cream items-center justify-center px-8">
        <View className="w-16 h-16 rounded-full bg-olive-bg items-center justify-center mb-4">
          <Icon name="check" size={28} color="#6E7452" />
        </View>
        <Text className="font-display text-xl text-ink text-center mb-2">{t("co_thanks")}</Text>
        {placedId ? (
          <Text className="font-bodySemibold text-base text-ink text-center mb-2">#{placedId.slice(0, 8).toUpperCase()}</Text>
        ) : null}
        <Text className="font-body text-sm text-ink-soft text-center mb-6 leading-5">
          {isGuest ? t("co_guest_placed_body") : t("co_placed_body")}
        </Text>
        {cardRetry ? (
          <View className="self-stretch rounded-xl2 border border-cream-line bg-surface p-4 mb-6">
            <Text className="font-bodySemibold text-sm text-ink mb-1">{t("co_card_unpaid_title")}</Text>
            <Text className="font-body text-xs text-ink-soft leading-5 mb-3">{t("co_card_unpaid_body")}</Text>
            <Pressable
              onPress={retryCard}
              disabled={cardBusy}
              accessibilityRole="button"
              className={`bg-olive rounded-full py-3.5 px-6 items-center ${cardBusy ? "opacity-50" : ""}`}
            >
              <Text className="font-bodyMedium text-sm text-on-accent">{cardBusy ? t("co_card_redirect") : t("co_card_retry")}</Text>
            </Pressable>
            {cardFailed ? <Text className="font-body text-xs text-orange leading-5 mt-2">{t("co_card_failed")}</Text> : null}
          </View>
        ) : null}
        {placedPay?.method === "bank_transfer" && BANK_DETAILS && placedId ? (
          <View className="self-stretch rounded-xl2 border border-cream-line bg-surface p-4 mb-6">
            <Text className="font-bodySemibold text-sm text-ink mb-2">{t("co_bank_title")}</Text>
            {([
              [t("co_bank_beneficiary"), BANK_DETAILS.beneficiary],
              [t("co_bank_iban"), BANK_DETAILS.iban],
              ...(BANK_DETAILS.bank ? [[t("co_bank_bank"), BANK_DETAILS.bank]] : []),
              [t("co_bank_amount"), `€${placedPay.amount.toFixed(2)}`],
              [t("co_bank_reference"), paymentReference(placedId)],
            ] as [string, string][]).map(([label, value]) => (
              <View key={label} className="flex-row justify-between py-1">
                <Text className="font-body text-xs text-ink-faint mr-3">{label}</Text>
                <Text selectable className="flex-1 text-right font-bodyMedium text-xs text-ink">{value}</Text>
              </View>
            ))}
            <Text className="font-body text-[11px] text-ink-faint mt-2 leading-4">{t("co_bank_note")}</Text>
          </View>
        ) : null}
        {isGuest ? (
          <>
            <Pressable
              onPress={() => {
                router.dismissAll();
                router.replace("/shop"); router.push("/shop/orders"); // stiva: Dyqani, pastaj Porositë; "mbrapa" kthen te Dyqani, jo te kreu
              }}
              className="self-stretch items-center bg-olive rounded-full py-4 mb-3"
            >
              <Text className="font-bodyMedium text-sm text-on-accent">{t("co_see_order")}</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/(auth)/signup")} className="mb-3 py-1">
              <Text className="font-bodyMedium text-sm text-olive">{t("co_guest_create_account")}</Text>
            </Pressable>
          </>
        ) : (
        <Pressable
          onPress={() => {
            // Heq shportën/arketimin nga stiva, jo vetëm ekranin aktual —
            // përndryshe "mbrapa" nga porositë të çon te një shportë e
            // zbrazët (porosia sapo u dërgua), në vend të vendit të vërtetë
            // ku ishte përdoruesi para se të fillonte blerjen.
            router.dismissAll();
            router.replace("/shop"); router.push("/shop/orders"); // stiva: Dyqani, pastaj Porositë; "mbrapa" kthen te Dyqani, jo te kreu
          }}
          className="self-stretch items-center bg-olive rounded-full py-4 mb-3"
        >
          <Text className="font-bodyMedium text-sm text-on-accent">{t("co_see_order")}</Text>
        </Pressable>
        )}
        <Pressable
          onPress={() => {
            router.dismissAll();
            router.replace("/shop");
          }}
        >
          <Text className="font-bodyMedium text-sm text-olive">{t("co_back_to_shop")}</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  const payByCard = method === "card" && AVAILABLE_METHODS.includes("card");
  const grandTotal = cartTotal() + shippingFee;

  return (
    <SafeAreaView className="flex-1 bg-cream" edges={["top"]}>
      <View className="flex-row items-center px-4 pt-2 pb-3">
        <BackButton fallback="/(main)/shop/cart" className="mr-3" />
        <Text className="font-display text-2xl text-ink">{t("co_title")}</Text>
      </View>

      <View
        ref={containerRef}
        className="flex-1"
        style={{ paddingBottom: lift }}
        onLayout={() =>
          containerRef.current?.measureInWindow((_x, y, _w, h) => {
            // Hapësira poshtë ekranit (p.sh. shiriti i tab-eve), që tastiera të mos llogaritet dy herë.
            if (keyboard === 0) setBottomGap(Math.max(0, windowHeight - (y + h)));
          })
        }
      >
        <ScrollView
          className="flex-1 px-4"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingBottom: 24 }}
        >
          {/* Pa llogari: porosia vazhdon; llogaria mbetet opsion, jo kusht. */}
          {isGuest && (
            <View className="mb-6 flex-row items-center gap-3 rounded-xl2 bg-olive-bg px-4 py-3.5">
              <Icon name="user" size={18} color={theme.olive} />
              <Text className="flex-1 font-body text-[13px] leading-5 text-ink-soft">{t("co_guest_note")}</Text>
              <Pressable
                onPress={() => router.push({ pathname: "/(auth)/login", params: { redirect: "/shop/checkout" } })}
                hitSlop={8}
              >
                <Text className="font-bodySemibold text-[13px] text-olive">{t("co_login_action")}</Text>
              </Pressable>
            </View>
          )}

          {/* Çfarë po porosit, e dukshme para se të mbushet formulari */}
          <Section title={t("co_sec_items")}>
            {state.cartItems.map((item) => (
              <View key={item.id} className="flex-row items-center px-4 py-3 border-b border-cream-line">
                <View
                  className={`w-12 h-12 rounded-xl items-center justify-center overflow-hidden mr-3 ${item.imageUrl ? "" : "bg-olive-bg"}`}
                  style={item.imageUrl ? { backgroundColor: "#FFFFFF", padding: 3 } : undefined}
                >
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} className="w-full h-full" resizeMode="contain" />
                  ) : (
                    <Icon name={item.icon as never} size={20} color={theme.olive} />
                  )}
                </View>
                <View className="flex-1 mr-3">
                  <Text className="font-bodyMedium text-sm text-ink" numberOfLines={2}>{item.name}</Text>
                  <Text className="font-body text-xs text-ink-faint mt-0.5">×{item.qty}</Text>
                </View>
                <Text className="font-bodySemibold text-sm text-ink">€{(item.price * item.qty).toFixed(2)}</Text>
              </View>
            ))}
            <View className="px-4 py-3 gap-2">
              <Row label={t("co_products_total")} value={`€${cartTotal().toFixed(2)}`} />
              {shownFee !== undefined ? (
                <Row label={t("co_shipping")} value={shownFee === 0 ? t("co_shipping_free") : `€${shownFee.toFixed(2)}`} />
              ) : null}
            </View>
          </Section>
          <Text className="-mt-4 mb-6 px-1 font-body text-xs text-ink-faint leading-4">{t("co_delivery_note")}</Text>

          <Section title={t("co_sec_contact")}>
            <Field label={t("co_full_name")} value={fullName} onChangeText={setFullName} placeholder={t("co_ph_name")} autoComplete="name" />
            <Field
              label={t("co_phone")}
              value={phone}
              onChangeText={setPhone}
              placeholder={t("co_ph_phone")}
              keyboardType="phone-pad"
              autoComplete="tel"
              last={!isGuest}
            />
            {isGuest ? (
              <Field
                label={t("co_email")}
                value={email}
                onChangeText={setEmail}
                placeholder={t("co_ph_email")}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                last
              />
            ) : null}
          </Section>

          <Section title={t("co_sec_address")}>
            <Field label={t("co_address")} value={address} onChangeText={setAddress} placeholder={t("co_ph_address")} autoComplete="street-address" />
            <Field label={t("co_city")} value={city} onChangeText={setCity} placeholder={t("co_ph_city")} last />
          </Section>

          {quoteWorks ? (
            <View className="mb-6">
              <SectionTitle>{t("co_country")}</SectionTitle>
              <View className="flex-row gap-2">
                {SHIPPING_COUNTRIES.map((c) => {
                  const active = c.code === country;
                  return (
                    <Pressable
                      key={c.code}
                      onPress={() => setCountry(c.code)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      className={`flex-1 rounded-2xl border px-2 py-3 items-center ${active ? "border-olive bg-olive-bg" : "border-cream-line bg-surface"}`}
                    >
                      <Text className="font-bodySemibold text-[13px] text-center text-ink" numberOfLines={2}>
                        {language === "en" ? c.en : c.sq}
                      </Text>
                      <Text className={`font-body text-xs mt-0.5 ${active ? "text-olive" : "text-ink-faint"}`}>€{c.fee.toFixed(2)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ) : null}

          {quoteWorks && AVAILABLE_METHODS.length > 1 ? (
            <Section title={t("co_pay_method")}>
              {AVAILABLE_METHODS.map((m, i) => {
                const active = method === m;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setMethod(m)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    className={`flex-row items-start px-4 py-3.5 ${i < AVAILABLE_METHODS.length - 1 ? "border-b border-cream-line" : ""}`}
                  >
                    <View className={`mt-0.5 mr-3 w-5 h-5 rounded-full border-2 items-center justify-center ${active ? "border-olive" : "border-cream-line"}`}>
                      {active ? <View className="w-2.5 h-2.5 rounded-full bg-olive" /> : null}
                    </View>
                    <View className="flex-1">
                      <Text className="font-bodySemibold text-sm text-ink">{t(PAY_TITLE[m])}</Text>
                      <Text className="font-body text-xs text-ink-faint mt-0.5 leading-4">{t(PAY_HINT[m])}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </Section>
          ) : null}
        </ScrollView>

        {/* Shiriti poshtë: totali dhe konfirmimi gjithmonë në sy; njoftimet dalin mbi butonin, aty ku shikon klienti. */}
        <View className="border-t border-cream-line bg-cream px-4 pt-3" style={{ paddingBottom: lift > 0 ? 12 : Math.max(insets.bottom, 12) }}>
          {changes.length > 0 && (
            <View className="bg-olive-bg rounded-2xl p-3 mb-3">
              <Text className="font-bodySemibold text-xs text-ink mb-1">{t("co_changes_title")}</Text>
              {changes.map((c, i) => (
                <Text key={i} className="font-body text-xs text-ink-soft leading-5">
                  {c.kind === "removed"
                    ? t("co_change_removed", { name: c.name })
                    : c.kind === "price"
                      ? t("co_change_price", { name: c.name, from: c.from.toFixed(2), to: c.to.toFixed(2) })
                      : t("co_change_qty", { name: c.name, n: c.to })}
                </Text>
              ))}
            </View>
          )}

          {error && (
            <View className="bg-orange-bg rounded-2xl p-3 mb-3">
              <Text className="font-body text-xs text-orange leading-5">{error}</Text>
            </View>
          )}

          <View className="flex-row items-center gap-4">
            <View>
              <Text className="font-body text-xs text-ink-faint">{t("co_grand_total")}</Text>
              <Text className="font-display text-xl text-ink">€{grandTotal.toFixed(2)}</Text>
            </View>
            <Pressable
              onPress={submitOrder}
              disabled={!canSubmit || loading}
              accessibilityRole="button"
              className="flex-1 bg-olive rounded-full py-4 items-center"
              style={{ opacity: canSubmit && !loading ? 1 : 0.5 }}
            >
              {loading ? (
                <ActivityIndicator className="text-on-accent" />
              ) : (
                <Text className="font-bodySemibold text-[15px] text-on-accent">{t(payByCard ? "co_card_confirm" : "co_confirm")}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <Text className="font-bodySemibold text-[15px] text-ink mb-2 px-1">{children}</Text>;
}

/** Një grup i pastër: titull sipër, kartë e sheshtë me vijë të hollë (pa hije). */
function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View className="mb-6">
      <SectionTitle>{title}</SectionTitle>
      <View className="bg-surface rounded-xl2 border border-cream-line overflow-hidden">{children}</View>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row items-center justify-between">
      <Text className="font-body text-sm text-ink-soft">{label}</Text>
      <Text className="font-bodyMedium text-sm text-ink">{value}</Text>
    </View>
  );
}

/** Fushë brenda grupit: etiketa e vogël sipër, teksti poshtë; prekja kudo në rresht e hap tastierën. */
function Field({ label, last, ...input }: TextInputProps & { label: string; last?: boolean }) {
  const ref = useRef<TextInput>(null);
  return (
    <Pressable
      onPress={() => ref.current?.focus()}
      accessible={false}
      className={`px-4 pt-3 pb-2 ${last ? "" : "border-b border-cream-line"}`}
    >
      <Text className="font-bodyMedium text-xs text-ink-faint">{label}</Text>
      <TextInput ref={ref} {...input} placeholderClassName="text-ink-faint" className="font-body text-[15px] text-ink py-1.5" />
    </Pressable>
  );
}
