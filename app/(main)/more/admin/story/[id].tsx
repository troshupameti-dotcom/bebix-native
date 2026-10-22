import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useToast } from "@/lib/toast/ToastContext";
import { useThemeColors } from "@/lib/theme/useThemeColors";
import { AdminScreen, Btn, Card, ErrorNote, Loading, Pill, confirm, runAction, useAdminData } from "@/components/admin/AdminUI";
import { ThemedSwitch } from "@/components/ui/ThemedSwitch";
import { StoryBookCover } from "@/components/stories/StoryBookCover";
import { useBookFonts } from "@/components/stories/book/theme";
import {
  fetchAdminStory,
  saveStoryText,
  setStoryFeatured,
  setStoryStatus,
  splitParagraphs,
  type AdminStory,
  type StoryTab,
} from "@/lib/admin/api";
import { dateTime, TONES } from "@/lib/admin/labels";

const CATEGORY_LABEL: Record<string, string> = {
  sleep: "Për gjumë",
  nature: "Kafshë dhe natyrë",
  adventure: "Aventurë",
  friendship: "Miqësi",
  emotions: "Emocione",
  lessons: "Mësime jetësore",
  classic: "Përralla klasike",
};
const STATUS_LABEL: Record<StoryTab, string> = { draft: "Pret aprovimin", published: "E publikuar", archived: "E arkivuar" };

/**
 * Një përrallë te paneli: kopertina, gjithë teksti si në libër, dhe veprimet. Draftin e Claude-it admini e lexon të
 * tërin, e ndryshon nëse duhet (titulli, përshkrimi, paragrafët) dhe e publikon me një prekje.
 */
export default function AdminStoryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const theme = useThemeColors();
  const fonts = useBookFonts();
  const { showToast } = useToast();
  const { data: story, error, refreshing, reload, pull } = useAdminData(() => fetchAdminStory(String(id ?? "")), [id]);
  const [editing, setEditing] = useState<null | { title: string; summary: string; body: string }>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function act(key: string, action: () => Promise<void>, message: string, leave = false) {
    setBusy(key);
    await runAction(action, () => {
      showToast(message);
      if (leave) router.back();
      else reload();
    });
    setBusy(null);
  }

  const startEdit = (s: AdminStory) => setEditing({ title: s.title, summary: s.summary, body: s.paragraphs.join("\n\n") });

  return (
    <AdminScreen
      title="Përralla"
      subtitle={story ? `${STATUS_LABEL[story.status]} · ${story.source === "ai" ? "e shkroi Claude" : "shtuar nga ekipi"} · ${dateTime(story.createdAt)}` : undefined}
      fallback="/(main)/more/admin/stories"
      refreshing={refreshing}
      onRefresh={pull}
    >
      <ErrorNote message={error} />
      {story === null && !error ? <Loading /> : null}
      {story ? (
        <>
          {story.source === "ai" && story.status === "draft" ? (
            <View className="mb-3 rounded-2xl bg-cream-soft p-4">
              <Text className="font-body text-[13px] leading-5 text-ink">
                {"E shkroi Claude dhe s'e ka parë ende askush. Lexojeni të gjithën: gjuhën, emrat dhe nëse i përshtatet moshës. Pastaj publikojeni, ndryshojeni ose arkivojeni."}
              </Text>
              {story.idea ? <Text className="mt-2 font-body text-[13px] text-ink-soft">Ideja: {story.idea}</Text> : null}
            </View>
          ) : null}

          <View className="items-center py-4">
            <StoryBookCover story={story} width={170} titleFont={fonts.title} captionFont={fonts.italic} caption={`${story.readingMinutes} min lexim`} />
          </View>

          <View className="mb-3 flex-row flex-wrap justify-center gap-1.5">
            {story.categories.map((c) => (
              <Pill key={c} label={CATEGORY_LABEL[c] ?? c} />
            ))}
            <Pill label={`${Math.floor(story.ageMin / 12)}–${Math.ceil(story.ageMax / 12)} vjeç`} tone={TONES.blue} />
          </View>

          {editing ? (
            <Card>
              <Field label="Titulli" value={editing.title} onChange={(title) => setEditing({ ...editing, title })} max={80} />
              <Field label="Përshkrimi" value={editing.summary} onChange={(summary) => setEditing({ ...editing, summary })} max={400} multiline />
              <Field
                label="Teksti (paragrafët ndahen me një rresht bosh)"
                value={editing.body}
                onChange={(body) => setEditing({ ...editing, body })}
                multiline
                tall
              />
              <View className="mt-1 flex-row gap-2">
                <View className="flex-1">
                  <Btn label="Anulo" kind="light" onPress={() => setEditing(null)} disabled={busy === "save"} />
                </View>
                <View className="flex-1">
                  <Btn
                    label="Ruaj"
                    busy={busy === "save"}
                    onPress={() =>
                      void act(
                        "save",
                        async () => {
                          await saveStoryText(story.id, { title: editing.title, summary: editing.summary, paragraphs: splitParagraphs(editing.body) });
                          setEditing(null);
                        },
                        "Ndryshimet u ruajtën."
                      )
                    }
                  />
                </View>
              </View>
            </Card>
          ) : (
            <Card>
              <Text style={{ fontFamily: fonts.title, fontSize: 22, lineHeight: 28, color: theme.ink }}>{story.title}</Text>
              <Text style={{ fontFamily: fonts.italic, fontSize: 15, lineHeight: 22, color: theme.inkSoft, marginTop: 6 }}>{story.summary}</Text>
              <View className="my-3 h-px bg-cream-line" />
              {story.paragraphs.map((p, i) => (
                <Text key={i} style={{ fontFamily: fonts.body, fontSize: 16.5, lineHeight: 26, color: theme.ink, marginTop: i ? 12 : 0 }}>
                  {p}
                </Text>
              ))}
              <View className="mt-4">
                <Btn label="Ndrysho tekstin" kind="light" small onPress={() => startEdit(story)} />
              </View>
            </Card>
          )}

          {editing ? null : (
            <View className="mt-2 gap-2">
              {story.status !== "published" ? (
                <Btn
                  label={story.status === "draft" ? "Publiko" : "Publiko përsëri"}
                  busy={busy === "publish"}
                  onPress={() =>
                    confirm("Ta publikoj?", "Përralla del menjëherë te të gjithë prindërit, te biblioteka e përrallave.", "Publiko", () =>
                      void act("publish", () => setStoryStatus(story.id, "published"), "Përralla u publikua.", true), false)
                  }
                />
              ) : (
                <Card className="flex-row items-center">
                  <View className="flex-1 pr-3">
                    <Text className="font-bodySemibold text-[14px] text-ink">Te “Të veçuarat”</Text>
                    <Text className="font-body text-xs text-ink-soft">Del e madhe në krye të bibliotekës.</Text>
                  </View>
                  <ThemedSwitch
                    value={story.featured}
                    onValueChange={(v) => void act("featured", () => setStoryFeatured(story.id, v), v ? "U vendos te të veçuarat." : "U hoq nga të veçuarat.")}
                  />
                </Card>
              )}
              {story.status === "archived" ? (
                <Btn label="Ktheje në draft" kind="light" busy={busy === "draft"} onPress={() => void act("draft", () => setStoryStatus(story.id, "draft"), "Përralla u kthye në draft.")} />
              ) : (
                <Btn
                  label={story.status === "published" ? "Hiqe nga biblioteka" : "Arkivo (mos e publiko)"}
                  kind="light"
                  busy={busy === "archive"}
                  onPress={() =>
                    confirm(
                      story.status === "published" ? "Ta heq nga biblioteka?" : "Ta arkivoj?",
                      "Përralla s'fshihet: mbetet te “Të arkivuara” dhe mund të publikohet sërish.",
                      "Arkivo",
                      () => void act("archive", () => setStoryStatus(story.id, "archived"), "Përralla u arkivua.", true)
                    )
                  }
                />
              )}
            </View>
          )}
        </>
      ) : null}
    </AdminScreen>
  );
}

function Field({ label, value, onChange, max, multiline = false, tall = false }: { label: string; value: string; onChange: (v: string) => void; max?: number; multiline?: boolean; tall?: boolean }) {
  const theme = useThemeColors();
  return (
    <View className="mb-3">
      <Text className="mb-1.5 font-bodyMedium text-[13px] text-ink-soft">{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        maxLength={max}
        multiline={multiline}
        placeholderTextColor={theme.inkFaint}
        className={`rounded-2xl border border-cream-line bg-surface px-4 py-3 font-body text-[15px] text-ink ${tall ? "min-h-[320px]" : multiline ? "min-h-[72px]" : ""}`}
        style={multiline ? { textAlignVertical: "top" } : undefined}
      />
    </View>
  );
}
