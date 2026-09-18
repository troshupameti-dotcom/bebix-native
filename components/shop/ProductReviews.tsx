import { useCallback, useState } from "react";
import { View, Text, Pressable, TextInput, ActivityIndicator } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Icon } from "@/components/ui/Icon";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { useAppState } from "@/lib/state/AppStateContext";
import { useCurrentUserId } from "@/lib/hooks/useCurrentUserId";
import { fetchReviews, submitReview, deleteMyReview, ProductReview } from "@/lib/shop/reviews";

const MAX_BODY = 1000;

/** Yjet e leximit. Pa vlerësime nuk shfaqet asgjë — "5.0 (0)" duket i sajuar. */
export function Stars({ rating, size = 14 }: { rating: number; size?: number }) {
  const theme = useThemeColors();
  return (
    <View className="flex-row" accessibilityLabel={`${rating} nga 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon
          key={n}
          name={n <= Math.round(rating) ? "starFilled" : "star"}
          size={size}
          color={n <= Math.round(rating) ? "#C9702E" : theme.creamLine}
        />
      ))}
    </View>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const theme = useThemeColors();
  return (
    <View className="flex-row">
      {[1, 2, 3, 4, 5].map((n) => (
        <Pressable
          key={n}
          onPress={() => { haptics.tap(); onChange(n); }}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel={`${n} yje`}
          accessibilityState={{ selected: value === n }}
          className="mr-1.5"
        >
          <Icon
            name={n <= value ? "starFilled" : "star"}
            size={30}
            color={n <= value ? "#C9702E" : theme.creamLine}
          />
        </Pressable>
      ))}
    </View>
  );
}

function ReviewRow({ review }: { review: ProductReview }) {
  return (
    <View className="py-3 border-t border-cream-line">
      <View className="flex-row items-center mb-1.5">
        <Stars rating={review.rating} size={12} />
        <Text className="font-bodyMedium text-xs text-ink ml-2 flex-1" numberOfLines={1}>
          {review.isMine ? "Ti" : review.authorName}
        </Text>
        {review.verifiedPurchase && (
          <View className="bg-olive-bg rounded-full px-2 py-0.5">
            <Text className="font-bodyMedium text-[10px] text-olive">E bleu këtu</Text>
          </View>
        )}
      </View>
      {review.body ? (
        <Text className="font-body text-xs text-ink-soft leading-5">{review.body}</Text>
      ) : null}
    </View>
  );
}

export function ProductReviews({ productId }: { productId: string }) {
  const router = useRouter();
  const theme = useThemeColors();
  const myId = useCurrentUserId();
  const { state } = useAppState();

  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [total, setTotal] = useState(0);
  const [mine, setMine] = useState<ProductReview | null>(null);
  const [loading, setLoading] = useState(true);

  const [writing, setWriting] = useState(false);
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const result = await fetchReviews(productId);
      setReviews(result.reviews);
      setTotal(result.total);
      setMine(result.mine);
    } catch {
      // Vlerësimet janë dytësore: produkti shihet edhe pa to.
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const average = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : 0;

  function openForm() {
    if (!myId) {
      router.push({ pathname: "/(auth)/login", params: { redirect: `/shop/${productId}` } });
      return;
    }
    setRating(mine?.rating ?? 0);
    setBody(mine?.body ?? "");
    setError(null);
    setWriting(true);
  }

  async function handleSave() {
    if (rating < 1) {
      setError("Zgjidh sa yje i jep.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await submitReview({
        productId,
        rating,
        body,
        authorName: state.profile.parentName ?? null,
      });
      setWriting(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Vlerësimi nuk u ruajt.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);
    try {
      await deleteMyReview(productId);
      setWriting(false);
      await load();
    } catch (e: any) {
      setError(e?.message ?? "Fshirja dështoi.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View className="px-5 mt-6">
        <ActivityIndicator className="text-olive" />
      </View>
    );
  }

  return (
    <View className="px-5 mt-7">
      <View className="flex-row items-center justify-between mb-3">
        <Text className="font-bodySemibold text-base text-ink">
          Vlerësimet{total > 0 ? ` (${total})` : ""}
        </Text>
        {!writing && (
          <Pressable onPress={openForm} hitSlop={8} accessibilityRole="button">
            <Text className="font-bodyMedium text-xs text-olive">
              {mine ? "Ndrysho vlerësimin tënd" : "Shkruaj vlerësim"}
            </Text>
          </Pressable>
        )}
      </View>

      {writing && (
        <View style={shadows.soft} className="bg-surface rounded-xl2 p-4 mb-4">
          <Text className="font-bodyMedium text-sm text-ink-soft mb-2">Sa yje i jep?</Text>
          <StarPicker value={rating} onChange={setRating} />

          <Text className="font-bodyMedium text-sm text-ink-soft mt-4 mb-2">
            Çfarë duhet të dinë prindërit e tjerë? (opsionale)
          </Text>
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="P.sh. cilësia, madhësia, sa zgjati..."
            placeholderClassName="text-ink-faint"
            multiline
            maxLength={MAX_BODY}
            className="bg-cream-soft rounded-xl2 px-3 py-2.5 font-body text-sm text-ink min-h-[80px]"
            textAlignVertical="top"
          />

          {error && <Text className="font-body text-xs text-orange mt-2">{error}</Text>}

          <View className="flex-row mt-4">
            <Pressable
              onPress={() => setWriting(false)}
              className="flex-1 bg-cream-soft rounded-xl2 py-3 items-center mr-2"
            >
              <Text className="font-bodyMedium text-sm text-ink">Anulo</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={saving}
              className="flex-1 bg-olive rounded-xl2 py-3 items-center"
              style={{ opacity: saving ? 0.5 : 1 }}
            >
              {saving ? (
                <ActivityIndicator color={theme.onAccent} />
              ) : (
                <Text className="font-bodySemibold text-sm text-on-accent">Ruaj</Text>
              )}
            </Pressable>
          </View>

          {mine && (
            <Pressable onPress={handleDelete} className="items-center mt-3">
              <Text className="font-bodyMedium text-xs text-orange">Fshi vlerësimin tim</Text>
            </Pressable>
          )}
        </View>
      )}

      {reviews.length === 0 ? (
        !writing && (
          <Text className="font-body text-xs text-ink-soft leading-5">
            Ende nuk ka vlerësime për këtë produkt. Nëse e ke provuar, shkruaj i pari — prindërit e
            tjerë vendosin duke lexuar përvoja të vërteta.
          </Text>
        )
      ) : (
        <>
          <View className="flex-row items-center mb-1">
            <Text className="font-display text-2xl text-ink mr-2">{average.toFixed(1)}</Text>
            <Stars rating={average} size={16} />
          </View>
          {reviews.map((review) => (
            <ReviewRow key={review.id} review={review} />
          ))}
        </>
      )}
    </View>
  );
}
