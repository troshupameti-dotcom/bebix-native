import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { Sparkles } from "lucide-react-native";
import { useToast } from "@/lib/toast/ToastContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { AdminScreen, Btn, Card, Chips, Empty, ErrorNote, Loading, Pill, runAction, useAdminData } from "@/components/admin/AdminUI";
import { StoryBookCover } from "@/components/stories/StoryBookCover";
import { fetchAdminStories, requestStoryDraft, type AdminStory, type StoryTab } from "@/lib/admin/api";
import { dateOnly, TONES } from "@/lib/admin/labels";

const TABS: { key: StoryTab; label: string }[] = [
  { key: "draft", label: "Për aprovim" },
  { key: "published", label: "Të publikuara" },
  { key: "archived", label: "Të arkivuara" },
];
/** Sa pret admini pas "Shkruaj një tani" para se lista të rifreskohet vetë (Claude shkruan 1–2 minuta). */
const REFRESH_AFTER_MS = [60_000, 120_000, 180_000];

/**
 * Përrallat te paneli: çdo të hënë Claude shkruan një të re dhe ajo pret këtu si draft. Admini e hap, e lexon, e
 * ndryshon nëse duhet dhe e publikon; prindërit s'e shohin para kësaj.
 */
export default function AdminStories() {
  const router = useRouter();
  const theme = useThemeColors();
  const { showToast } = useToast();
  const [tab, setTab] = useState<StoryTab>("draft");
  const [idea, setIdea] = useState("");
  const [writing, setWriting] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const { data, error, refreshing, reload, pull } = useAdminData(() => fetchAdminStories(tab), [tab]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  async function write() {
    setWriting(true);
    const ok = await runAction(() => requestStoryDraft(idea), () => {
      setIdea("");
      setTab("draft");
      showToast("Claude po e shkruan përrallën. Do të dalë këtu për 1–2 minuta.");
    });
    setWriting(false);
    if (!ok) return;
    setWaiting(true);
    timers.current.forEach(clearTimeout);
    timers.current = REFRESH_AFTER_MS.map((ms, i) =>
      setTimeout(() => {
        reload();
        if (i === REFRESH_AFTER_MS.length - 1) setWaiting(false);
      }, ms)
    );
  }

  return (
    <AdminScreen title="Përrallat" subtitle="Claude shkruan një të re çdo të hënë. Ju e lexoni dhe e publikoni." refreshing={refreshing} onRefresh={pull}>
      <Card>
        <View className="flex-row items-center gap-2">
          <Sparkles size={16} color={theme.olive} />
          <Text className="font-bodySemibold text-[15px] text-ink">Përrallë e re nga Claude</Text>
        </View>
        <Text className="mt-1 font-body text-[13px] leading-5 text-ink-soft">
          Përralla e javës vjen vetë të hënën. Për një tani, shkruani një ide (opsionale) dhe shtypni butonin.
        </Text>
        <TextInput
          value={idea}
          onChangeText={setIdea}
          placeholder="Ideja, p.sh. një përrallë për vëllain e vogël që sapo lindi"
          placeholderTextColor={theme.inkFaint}
          multiline
          maxLength={300}
          className="mt-3 min-h-[64px] rounded-2xl border border-cream-line bg-surface px-4 py-3 font-body text-[14px] text-ink"
          style={{ textAlignVertical: "top" }}
        />
        <View className="mt-3">
          <Btn label={waiting ? "Claude po shkruan…" : "Shkruaj një tani"} busy={writing} disabled={waiting} onPress={() => void write()} />
        </View>
      </Card>

      <View className="mt-2">
        <Chips items={TABS} value={tab} onChange={setTab} />
      </View>

      <ErrorNote message={error} />
      {!data && !error ? <Loading /> : null}
      {data && data.length === 0 ? (
        <Empty
          title={tab === "draft" ? "S'ka përralla që presin aprovimin." : tab === "published" ? "Ende s'ka përralla të publikuara këtu." : "S'ka përralla të arkivuara."}
          body={tab === "draft" ? "E hëna e ardhshme sjell një të re, ose shtypni “Shkruaj një tani”." : undefined}
        />
      ) : null}
      {data?.map((s) => <StoryItem key={s.id} story={s} onPress={() => router.push({ pathname: "/more/admin/story/[id]" as never, params: { id: s.id } })} />)}
    </AdminScreen>
  );
}

function StoryItem({ story, onPress }: { story: AdminStory; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={story.title} className="mb-3 flex-row gap-4 rounded-2xl border border-cream-line bg-surface p-3.5 active:opacity-80">
      <StoryBookCover story={story} width={66} showTitle={false} />
      <View className="flex-1">
        <Text className="font-bodySemibold text-[15px] text-ink" numberOfLines={2}>
          {story.title}
        </Text>
        <Text className="mt-0.5 font-body text-[12.5px] leading-[17px] text-ink-soft" numberOfLines={2}>
          {story.summary}
        </Text>
        <View className="mt-2 flex-row flex-wrap items-center gap-1.5">
          {story.source === "ai" ? <Pill label="nga Claude" tone={TONES.blue} /> : null}
          {story.featured ? <Pill label="E veçuar" tone={TONES.green} /> : null}
          <Text className="font-body text-[11.5px] text-ink-faint">
            {story.readingMinutes} min · {Math.floor(story.ageMin / 12)}–{Math.ceil(story.ageMax / 12)} vjeç · {dateOnly(story.publishedAt ?? story.createdAt)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}
