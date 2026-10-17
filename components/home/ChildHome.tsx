import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { ChevronRight, MessageCircle, ShoppingBag, Stethoscope, Syringe, type LucideIcon } from "lucide-react-native";
import { ProductCard } from "@/components/ProductCard";
import { fetchProductPage } from "@/lib/shopData";
import type { Product } from "@/lib/homeContent";
import { fetchAgeGroup, fetchExperts, fetchFeed, type CommunityExpert, type CommunityPost } from "@/lib/communityData";
import { rankExperts } from "@/lib/community/expertRank";
import { specialtyRank } from "@/lib/age/stageConfig";
import { nextVaccine, isOverdue } from "@/lib/baby/ageGuide";
import { useTranslation } from "@/lib/i18n/LanguageContext";
import { useTones, type ThemedTone } from "@/lib/theme/tone";
import { formatDate } from "@/lib/dateUtils";
import { shadows } from "@/lib/shadows";
import { haptics } from "@/lib/haptics";
import type { Stage } from "@/lib/age/engine";
import type { VaccineEntry } from "@/lib/state/babyTypes";

function CardTitle({ icon: Glyph, tone, title, action, onAction }: {
  icon: LucideIcon;
  tone: ThemedTone;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <View className="mb-2 flex-row items-center">
      <View style={{ backgroundColor: tone.tintBg }} className="mr-2.5 h-8 w-8 items-center justify-center rounded-xl">
        <Glyph size={16} color={tone.tint} strokeWidth={2.2} />
      </View>
      <Text accessibilityRole="header" className="flex-1 font-display text-[16px] text-ink">
        {title}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" hitSlop={8} className="flex-row items-center">
          <Text className="font-bodyMedium text-[13px] text-ink-soft">{action}</Text>
          <ChevronRight size={15} color={tone.inkSoft} strokeWidth={2} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Eksperti i ditës: nga specialitetet e fazës (p.sh. psikologu, logopedi), një tjetër çdo ditë. */
export function expertOfDay(experts: CommunityExpert[], stage: Stage | null, now: Date = new Date()): CommunityExpert | null {
  const ranked = rankExperts(experts, stage);
  if (ranked.length === 0) return null;
  const best = specialtyRank(stage, ranked[0].specialty);
  const top = ranked.filter((e) => specialtyRank(stage, e.specialty) === best);
  const day = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000);
  return top[day % top.length];
}

/**
 * Kreu për fëmijët 3–12 vjeç: produktet e renditura për moshën, postimet më të reja nga grupi i moshës, eksperti i
 * ditës dhe kujtesa për vaksinat/kontrollet. Çdo kartë fshihet vetë kur s'ka çfarë të tregojë (pa rrjet, bosh).
 */
export function ChildHome({ stage, months, ageGroupKey, vaccines, childName }: {
  stage: Stage | null;
  months: number | null;
  ageGroupKey: string | null;
  vaccines: VaccineEntry[];
  childName: string;
}) {
  const { t, lang } = useTranslation();
  const tones = useTones();
  const [products, setProducts] = useState<Product[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [expert, setExpert] = useState<CommunityExpert | null>(null);

  useEffect(() => {
    let alive = true;
    if (months != null) {
      fetchProductPage({ ranking: { ageFrom: months, ageTo: months, pregnancy: false }, pageSize: 6 })
        .then((page) => alive && setProducts(page.items))
        .catch(() => alive && setProducts([]));
    }
    return () => {
      alive = false;
    };
  }, [months]);

  useEffect(() => {
    let alive = true;
    if (ageGroupKey) {
      fetchAgeGroup(ageGroupKey)
        .then((g) => (g ? fetchFeed({ tab: "age", ageGroupId: g.id, limit: 3 }) : []))
        .then((list) => alive && setPosts(list))
        .catch(() => alive && setPosts([]));
    }
    return () => {
      alive = false;
    };
  }, [ageGroupKey]);

  useEffect(() => {
    let alive = true;
    fetchExperts()
      .then((list) => alive && setExpert(expertOfDay(list, stage)))
      .catch(() => alive && setExpert(null));
    return () => {
      alive = false;
    };
  }, [stage]);

  const vaccine = nextVaccine(vaccines);
  const go = (href: Parameters<typeof router.push>[0]) => {
    haptics.tap();
    router.push(href);
  };

  return (
    <View>
      {products.length > 0 ? (
        <View className="mt-5">
          <CardTitle
            icon={ShoppingBag}
            tone={tones.orange}
            title={t("child_home_products", { name: childName })}
            action={t("child_home_to_shop")}
            onAction={() => go("/(main)/shop")}
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {products.map((p) => (
              <View key={p.id}>
                <ProductCard product={p} cardWidth={150} onPress={() => go(`/shop/${p.id}`)} />
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {posts.length > 0 ? (
        <View style={shadows.soft} className="mt-5 rounded-xl3 bg-surface p-4">
          <CardTitle
            icon={MessageCircle}
            tone={tones.blue}
            title={t("child_home_posts")}
            action={t("child_home_to_community")}
            onAction={() => go("/(main)/community")}
          />
          {posts.map((p, i) => (
            <Pressable
              key={p.id}
              onPress={() => go(`/community/post/${p.id}`)}
              accessibilityRole="button"
              className={`py-2.5 ${i === posts.length - 1 ? "" : "border-b border-cream-line"}`}
            >
              <Text className="font-bodySemibold text-[13px] text-ink-soft">{p.authorName}</Text>
              <Text numberOfLines={2} className="mt-0.5 font-body text-[14px] leading-5 text-ink">
                {p.text}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {expert ? (
        <Pressable
          onPress={() => go(`/community/expert/${expert.id}`)}
          accessibilityRole="button"
          style={shadows.soft}
          className="mt-5 rounded-xl3 bg-surface p-4"
        >
          <CardTitle icon={Stethoscope} tone={tones.green} title={t("child_home_expert")} />
          <Text className="font-bodySemibold text-[15px] text-ink">{expert.name}</Text>
          <Text className="mt-0.5 font-body text-[13px] text-ink-soft">{expert.kind}</Text>
          {expert.bio ? (
            <Text numberOfLines={2} className="mt-1.5 font-body text-[13px] leading-5 text-ink-soft">
              {expert.bio}
            </Text>
          ) : null}
        </Pressable>
      ) : null}

      <Pressable
        onPress={() => go(vaccine ? "/(main)/baby/vaccinations" : "/(main)/baby/medical")}
        accessibilityRole="button"
        style={shadows.soft}
        className="mt-5 rounded-xl3 bg-surface p-4"
      >
        <CardTitle icon={Syringe} tone={vaccine && isOverdue(vaccine) ? tones.orange : tones.purple} title={t("child_home_checkups")} />
        <Text className="font-body text-[14px] leading-5 text-ink">
          {vaccine
            ? t(isOverdue(vaccine) ? "age_guide_vaccine_late" : "age_guide_vaccine_due", { name: vaccine.name, date: formatDate(vaccine.dueDate, lang) })
            : t("child_home_checkups_none")}
        </Text>
      </Pressable>
    </View>
  );
}
