/**
 * Hapja e galerisë/kamerës (Sentry REACT-NATIVE-2 dhe 3): leja para hapjes, një picker në të njëjtën kohë,
 * vetëm kur app-i është aktiv, dhe çdo gabim i Android-it kapet me mesazh të qartë në vend të heshtjes.
 */
import { Alert, AppState, Linking } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { __resetPickerForTests, pickMedia } from "@/lib/media/imagePicker";
import { captureToSentry } from "@/lib/errors/sentry";

jest.mock("expo-image-picker", () => ({
  requestCameraPermissionsAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
}));
jest.mock("@/lib/errors/sentry", () => ({ captureToSentry: jest.fn() }));

const picker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const t = (key: string) => key;
const granted = { granted: true, canAskAgain: true, status: "granted", expires: "never" } as never;
const denied = (canAskAgain: boolean) => ({ granted: false, canAskAgain, status: "denied", expires: "never" }) as never;
const asset = { uri: "file:///foto.jpg", width: 1, height: 1 };
const success = { canceled: false, assets: [asset] } as never;

let alert: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  __resetPickerForTests();
  Object.defineProperty(AppState, "currentState", { value: "active", configurable: true });
  alert = jest.spyOn(Alert, "alert").mockImplementation(() => {});
  picker.requestMediaLibraryPermissionsAsync.mockResolvedValue(granted);
  picker.requestCameraPermissionsAsync.mockResolvedValue(granted);
  picker.launchImageLibraryAsync.mockResolvedValue(success);
  picker.launchCameraAsync.mockResolvedValue(success);
});

describe("pickMedia", () => {
  it("leja kontrollohet para hapjes; kthen foton e zgjedhur", async () => {
    const result = await pickMedia("library", { mediaTypes: ["images"] }, t as never);
    expect(picker.requestMediaLibraryPermissionsAsync).toHaveBeenCalled();
    expect(result?.assets[0].uri).toBe("file:///foto.jpg");
  });

  it("gabimi i Android-it (launcher i paregjistruar) kapet: mesazh dhe Sentry, pa crash", async () => {
    picker.launchCameraAsync.mockRejectedValue(new Error("Attempting to launch an unregistered ActivityResultLauncher"));
    await expect(pickMedia("camera", {}, t as never)).resolves.toBeNull();
    expect(alert).toHaveBeenCalledWith("picker_failed_title", "picker_failed_body");
    expect(captureToSentry).toHaveBeenCalledWith(expect.any(Error), "image_picker_camera");
  });

  it("shtypja dy herë: hapet vetëm një picker", async () => {
    let finish: (v: unknown) => void = () => {};
    picker.launchImageLibraryAsync.mockReturnValue(new Promise((r) => (finish = r)) as never);
    const first = pickMedia("library", {}, t as never);
    const second = await pickMedia("library", {}, t as never);
    expect(second).toBeNull();
    finish(success);
    await first;
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    // Pasi mbyllet i pari, mund të hapet sërish.
    await pickMedia("library", {}, t as never);
    expect(picker.launchImageLibraryAsync).toHaveBeenCalledTimes(2);
  });

  it("pa leje: mesazh i qartë; kur telefoni s'pyet më, buton për te Cilësimet", async () => {
    picker.requestCameraPermissionsAsync.mockResolvedValue(denied(false));
    const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    expect(await pickMedia("camera", {}, t as never)).toBeNull();
    expect(picker.launchCameraAsync).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    expect(alert.mock.calls[0][0]).toBe("picker_camera_denied_title");
    buttons.find((b) => b.text === "picker_open_settings")?.onPress?.();
    expect(openSettings).toHaveBeenCalled();
  });

  it("app-i në sfond: s'hapet asgjë", async () => {
    Object.defineProperty(AppState, "currentState", { value: "background", configurable: true });
    expect(await pickMedia("library", {}, t as never)).toBeNull();
    expect(picker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it("anulimi kthen null, pa mesazh", async () => {
    picker.launchImageLibraryAsync.mockResolvedValue({ canceled: true, assets: null } as never);
    expect(await pickMedia("library", {}, t as never)).toBeNull();
    expect(alert).not.toHaveBeenCalled();
  });
});
