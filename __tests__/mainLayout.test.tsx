/**
 * Layout-i kryesor (tab-et) me provider-at e vërtetë: kush hyn pa llogari, dhe butoni fizik "mbrapa" i
 * Android-it. Ky buton u "ndreq" të paktën 5 herë; logjika (lib/navigation/history.ts) testohet veç te
 * navigationHistory.test.ts, këtu provohet që layout-i e lidh saktë me router-in.
 */
import { fakeSupabase, renderScreen, router, setPathname } from "./helpers/screen";
import { BackHandler } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import MainLayout from "@/app/(main)/_layout";
import { recordPath, resetHistory } from "@/lib/navigation/history";

/** Mbajtësit e "mbrapa" që regjistron layout-i; i fundit thirret i pari, si te Android-i. */
type BackPress = Parameters<typeof BackHandler.addEventListener>[1];
let handlers: BackPress[] = [];
beforeEach(() => {
  handlers = [];
  resetHistory();
  Object.values(router()).forEach((fn) => typeof fn?.mockClear === "function" && fn.mockClear());
  jest.spyOn(BackHandler, "addEventListener").mockImplementation((_e, h) => {
    handlers.push(h);
    return { remove: () => { handlers = handlers.filter((x) => x !== h); } };
  });
});
afterEach(() => jest.restoreAllMocks());

/** Si Android-i: provon mbajtësit nga i fundit; true = u trajtua në app, false = sjellja native. */
const pressBack = () => [...handlers].reverse().some((h) => (h as () => boolean | null | undefined)() === true);

describe("layout-i kryesor", () => {
  it("pa llogari dhe pa zgjedhur “pa login”: dërgohet te hyrja", async () => {
    await renderScreen(<MainLayout />);
    expect(router().replace).toHaveBeenCalledWith("/(auth)/login");
  });

  it("mysafiri shfleton Dyqanin pa u nxjerrë; “mbrapa” te Dyqani e çon te hyrja", async () => {
    await AsyncStorage.setItem("bebix_guest_mode", "true");
    setPathname("/shop");
    await renderScreen(<MainLayout />);
    expect(router().replace).not.toHaveBeenCalled();
    expect(pressBack()).toBe(true);
    expect(router().replace).toHaveBeenCalledWith("/(auth)/login");
  });

  it("i kyçur: Më shumë → Porositë e mia → “mbrapa” = Më shumë (jo Dyqani)", async () => {
    fakeSupabase().session = { user: { id: "u1" } };
    setPathname("/shop/orders");
    await renderScreen(<MainLayout />);
    recordPath("/more");
    recordPath("/shop/orders");
    expect(pressBack()).toBe(true);
    expect(router().replace).toHaveBeenCalledWith("/more");
  });

  it("i kyçur, në rrënjën e një tab-i: “mbrapa” i lihet Android-it", async () => {
    fakeSupabase().session = { user: { id: "u1" } };
    setPathname("/baby");
    await renderScreen(<MainLayout />);
    recordPath("/shop");
    recordPath("/baby");
    expect(pressBack()).toBe(false);
    expect(router().replace).not.toHaveBeenCalled();
  });
});
