/**
 * Auditimi i 19 tetorit: ora gjithmonë 24-orëshe (pa "p.d."), data+ora në Android pa rrëzim (Android s'ka "datetime"),
 * tastiera e matur sipas ekranit, widget-et dhe Google native që s'ngarkohen kur mungon moduli (Expo Go).
 */
import { renderScreen, visibleText } from "./helpers/screen";
import { Dimensions, Keyboard, Platform, Text, View } from "react-native";
import { act } from "react-test-renderer";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { clockTime, formatTime } from "@/lib/dateUtils";
import { DateTimeField } from "@/components/baby/DateTimeField";
import { KeyboardSafeView } from "@/lib/ui/keyboard";
import { hasAndroidWidgets, hasIosWidgets } from "@/lib/widgets/available";
import { nativeGoogleAvailable } from "@/lib/auth/googleNative";
import { useAppState } from "@/lib/state/AppStateContext";
import { savePendingProfile } from "@/lib/babyProfile";
import { DOUBLE_TAP_MS, useTabDoubleTap } from "@/lib/navigation/useTabDoubleTap";

afterEach(() => jest.restoreAllMocks());

describe("ora", () => {
  it("24-orëshe, me zero përpara, në çdo gjuhë", () => {
    expect(clockTime(new Date(2026, 9, 19, 2, 1))).toBe("02:01");
    expect(clockTime(new Date(2026, 9, 19, 14, 5))).toBe("14:05");
    expect(formatTime(new Date(2026, 9, 19, 2, 1).toISOString(), "sq")).toBe("02:01");
  });
});

describe("data dhe ora në Android", () => {
  it("hap datën, pastaj orën (24-orëshe), dhe i bashkon", async () => {
    jest.replaceProperty(Platform, "OS", "android");
    const open = jest.spyOn(DateTimePickerAndroid, "open").mockImplementation(() => {});
    const onChange = jest.fn();
    const value = new Date(2026, 9, 19, 2, 1).toISOString();
    const r = await renderScreen(<DateTimeField label="Koha" mode="datetime" value={value} onChange={onChange} />);
    await act(async () => r.root.findAll((n) => typeof n.props.onPress === "function")[0].props.onPress());
    expect(open.mock.calls[0][0].mode).toBe("date");
    await act(async () => {
      open.mock.calls[0][0].onChange?.({ type: "set", nativeEvent: {} } as never, new Date(2026, 9, 17));
      await new Promise((res) => setTimeout(res, 80));
    });
    expect(open.mock.calls[1][0]).toMatchObject({ mode: "time", is24Hour: true });
    await act(async () => open.mock.calls[1][0].onChange?.({ type: "set", nativeEvent: {} } as never, new Date(2026, 9, 17, 21, 30)));
    const picked = new Date(onChange.mock.calls[0][0]);
    expect([picked.getDate(), picked.getHours(), picked.getMinutes()]).toEqual([17, 21, 30]);
    open.mockRestore();
  });
});

describe("tastiera", () => {
  it("ngjit përmbajtjen sa mbulon tastiera dhe e kthen kur mbyllet", async () => {
    const listeners: Record<string, (e: { endCoordinates: { height: number; screenY: number } }) => void> = {};
    const spy = jest.spyOn(Keyboard, "addListener").mockImplementation(((event: string, cb: never) => {
      listeners[event] = cb;
      return { remove: () => {} };
    }) as never);
    const screen = Dimensions.get("screen").height;
    const r = await renderScreen(
      <KeyboardSafeView>
        <Text>Forma</Text>
      </KeyboardSafeView>
    );
    const box = () => r.root.findAll((n) => n.type === View && visibleText(n).includes("Forma"))[0];
    const pad = () => [box().props.style].flat(2).reduce((acc: number, s: { paddingBottom?: number } | undefined) => s?.paddingBottom ?? acc, 0);
    expect(pad()).toBe(0);
    await act(async () => listeners.keyboardWillChangeFrame({ endCoordinates: { height: 320, screenY: screen - 320 } }));
    expect(pad()).toBe(320);
    // Tastiera lundruese e iPad-it (s'prek fundin e ekranit): asgjë s'ngjitet.
    await act(async () => listeners.keyboardWillChangeFrame({ endCoordinates: { height: 260, screenY: 300 } }));
    expect(pad()).toBe(0);
    await act(async () => listeners.keyboardWillHide({ endCoordinates: { height: 0, screenY: screen } }));
    expect(pad()).toBe(0);
    spy.mockRestore();
  });
});

describe("modulet native që mungojnë në Expo Go", () => {
  it("widget-et dhe Google native s'ngarkohen", () => {
    expect(hasIosWidgets()).toBe(false);
    expect(hasAndroidWidgets()).toBe(false);
    expect(nativeGoogleAvailable()).toBe(false);
  });
});

describe("llogari e re", () => {
  it("emri dhe datëlindja e regjistrimit dalin edhe kur serveri s'i ka ende (telefoni sapo u pastrua)", async () => {
    await savePendingProfile({ parentName: "Mami", babyName: "Ana", babyDob: "2025-03-10" });
    let profile: { babyName: string | null; babyDob: string | null } | null = null;
    function Probe() {
      profile = useAppState().state.profile;
      return null;
    }
    await renderScreen(<Probe />);
    for (let i = 0; i < 5; i++) await act(async () => { await new Promise((res) => setTimeout(res, 15)); });
    expect(profile!.babyName).toBe("Ana");
    const dob = new Date(profile!.babyDob as string);
    expect([dob.getFullYear(), dob.getMonth(), dob.getDate()]).toEqual([2025, 2, 10]);
  });
});

describe("tab-i i Komunitetit", () => {
  it("një prekje s'bën asgjë (faqja mbetet siç ishte); dy prekje të shpejta: në krye dhe rifreskim", async () => {
    const router = require("expo-router") as { useNavigation: () => unknown };
    let listener: ((e: { target?: string }) => void) | null = null;
    let index = 1;
    const tabs = {
      getState: () => ({ type: "tab", index, routes: [{ key: "baby" }, { key: "community" }] }),
      getParent: () => undefined,
      addListener: (_: string, cb: (e: { target?: string }) => void) => {
        listener = cb;
        return () => {};
      },
    };
    jest.spyOn(router, "useNavigation").mockReturnValue({ getParent: () => tabs });
    const onDouble = jest.fn();
    function Probe() {
      useTabDoubleTap(onDouble);
      return null;
    }
    await renderScreen(<Probe />);
    const tap = async () => act(async () => { listener!({ target: "community" }); await new Promise((r) => setTimeout(r, 30)); });

    await tap();
    expect(onDouble).not.toHaveBeenCalled();
    await new Promise((r) => setTimeout(r, DOUBLE_TAP_MS + 20));
    await tap();
    expect(onDouble).not.toHaveBeenCalled();
    await tap();
    expect(onDouble).toHaveBeenCalledTimes(1);

    // Kalimi nga një tab tjetër s'është prekja e parë.
    index = 0;
    await tap();
    index = 1;
    await tap();
    expect(onDouble).toHaveBeenCalledTimes(1);
  });
});
