/* eslint-disable @typescript-eslint/no-require-imports -- fabrika e jest.mock ekzekutohet para importeve */
import { useEffect } from "react";
import { act } from "react-test-renderer";
import type { ReactTestInstance } from "react-test-renderer";
import { button, renderScreen, visibleText } from "./helpers/screen";
import { BabyHeroPhoto, HOLD_MS } from "@/components/baby/BabyHeroPhoto";
import { BabyPhotoSheet } from "@/components/baby/BabyPhotoSheet";
import { useBabyPhotoPicker } from "@/lib/baby/babyPhoto";
import { useAppState } from "@/lib/state/AppStateContext";
import type { PickSource } from "@/lib/media/imagePicker";

jest.mock("@/lib/media/imagePicker", () => ({
  pickMedia: jest.fn(async (source: string) => ({ canceled: false, assets: [{ uri: `file:///cache/${source}.jpg` }] })),
}));
const { pickMedia } = require("@/lib/media/imagePicker") as { pickMedia: jest.Mock };

const byLabel = (root: ReactTestInstance, label: string) => root.findAll((n) => n.props.accessibilityLabel === label && typeof n.props.accessibilityRole === "string")[0];

describe("fotoja e bebit te faqja kryesore", () => {
  it("me foto: mbajtja e gjatë (jo prekja e shkurtër) hap zgjedhjet", async () => {
    const onChange = jest.fn();
    const r = await renderScreen(<BabyHeroPhoto uri="file:///baby.jpg" onChange={onChange} />);
    const photo = byLabel(r.root, "Ndrysho foton e bebit");
    expect(photo.props.delayLongPress).toBe(HOLD_MS);
    expect(photo.props.onPress).toBeUndefined();
    await act(async () => photo.props.onLongPress());
    expect(onChange).toHaveBeenCalledTimes(1);
    // Lexuesi i ekranit: prekja e dyfishtë mjafton.
    await act(async () => photo.props.onAccessibilityAction({ nativeEvent: { actionName: "activate" } }));
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it("pa foto: një prekje mjafton dhe del “Shto një foto”", async () => {
    const onChange = jest.fn();
    const r = await renderScreen(<BabyHeroPhoto uri={null} onChange={onChange} />);
    expect(visibleText(r.root)).toContain("Shto një foto");
    await act(async () => byLabel(r.root, "Shto një foto").props.onPress());
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("fleta jep galerinë dhe kamerën, dhe e hap picker-in pasi mbyllet", async () => {
    const onPick = jest.fn();
    const onClose = jest.fn();
    const r = await renderScreen(<BabyPhotoSheet visible onClose={onClose} onPick={onPick} />);
    expect(visibleText(r.root)).toEqual(expect.arrayContaining(["Fotoja e bebit", "Zgjidh nga galeria", "Bëj një foto"]));
    await act(async () => button(r.root, "Bëj një foto").props.onPress());
    expect(onClose).toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
    await act(async () => new Promise((done) => setTimeout(done, 450)));
    expect(onPick).toHaveBeenCalledWith("camera");
  });
});

/** Zgjedhja e fotos: del menjëherë te profili (kamera ose galeria). */
const seen: { choose: ((s: PickSource) => Promise<boolean>) | null; photo: string | null } = { choose: null, photo: null };
function Probe() {
  const app = useAppState();
  const choose = useBabyPhotoPicker();
  useEffect(() => {
    seen.choose = choose;
    seen.photo = app.state.profile.babyPhoto;
  });
  return null;
}

describe("zgjedhja e fotos", () => {
  it("fotoja nga kamera del menjëherë te profili", async () => {
    await renderScreen(<Probe />);
    let ok = false;
    await act(async () => {
      ok = await seen.choose!("camera");
    });
    expect(ok).toBe(true);
    expect(pickMedia).toHaveBeenCalledWith("camera", expect.objectContaining({ mediaTypes: ["images"], allowsEditing: true }), expect.any(Function));
    expect(seen.photo).toBe("file:///cache/camera.jpg");
  });

  it("kur prindi anulon, profili s'ndryshon", async () => {
    pickMedia.mockResolvedValueOnce(null);
    await renderScreen(<Probe />);
    const before = seen.photo;
    let ok = true;
    await act(async () => {
      ok = await seen.choose!("library");
    });
    expect(ok).toBe(false);
    expect(seen.photo).toBe(before);
  });
});
