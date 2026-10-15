/**
 * Butoni "mbrapa" me router-in e VËRTETË (expo-router + react-navigation): Tabs me backBehavior "firstRoute"
 * si te app/(main)/_layout.tsx, stivat e vërteta të çdo pjese, dhe ekranet sipas skedarëve të vërtetë te
 * app/(main) (çdo ekran i ri hyn vetë në test). Butoni mbrapa (goBackOr), butoni fizik i Android-it
 * (hardwareBack) dhe rrëshqitja e iPhone-it provohen për çdo ekran të brendshëm të çdo tab-i.
 *
 * Gabimi i 14 tetorit: Më shumë → Modaliteti i natës → tab-i Home → tab-i Më shumë (rihapet te nata) →
 * "mbrapa" të çonte te Home.
 */
import "expo-router/build/testing-library/mocks";
import { useEffect, type ComponentType } from "react";
import { Text } from "react-native";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { Stack, Tabs, router, usePathname } from "expo-router";
import { ExpoRoot } from "expo-router/build/ExpoRoot";
import { getMockContext } from "expo-router/build/testing-library/mock-config";
import { store } from "expo-router/build/global-state/router-store";
import { goBackOr, hardwareBack } from "@/components/ui/BackButton";
import { noteTabSwitch, recordPath, resetHistory, sectionOf, currentPath } from "@/lib/navigation/history";

/* eslint-disable @typescript-eslint/no-require-imports -- fabrikat e jest.mock dhe layout-et e vërteta ngarkohen me require() */
const fs = require("fs") as { readdirSync(dir: string, opts: { recursive: true }): string[] };
const path = require("path") as { join(...p: string[]): string; sep: string };
declare const __dirname: string;

jest.mock("@/components/ui/Icon", () => ({ Icon: () => null }));
jest.mock("@react-native-async-storage/async-storage", () => require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

const TABS = ["baby", "shop", "ai-chat", "community", "more"];
const MAIN = path.join(__dirname, "..", "app", "(main)");

// Ekranet e vërteta: "(main)/more/night-mode", "(main)/shop/[id]"...
const screenFiles = fs.readdirSync(MAIN, { recursive: true })
  .map((f) => f.split(path.sep).join("/"))
  .filter((f) => f.endsWith(".tsx") && !f.endsWith("_layout.tsx"))
  .map((f) => f.replace(/\.tsx$/, ""));

function Root() {
  const p = usePathname();
  useEffect(() => { recordPath(p); }, [p]);
  return <Stack screenOptions={{ headerShown: false }} />;
}
/** Si app/(main)/_layout.tsx për përdoruesin e kyçur; prekja e tab-it shënohet si te guardTabPress. */
function Main() {
  return (
    <Tabs initialRouteName="baby" backBehavior="firstRoute" screenOptions={{ headerShown: false }}>
      {TABS.map((n) => <Tabs.Screen key={n} name={n} />)}
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}
const stub = (name: string): ComponentType => function Screen() { return <Text>{name}</Text>; };

// Layout-et e pjesëve si module të plota: me `unstable_settings` (stiva nis nga faqja kryesore), si në app.
const context: Record<string, unknown> = { _layout: Root, "(main)/_layout": Main };
for (const s of ["baby", "shop", "community", "more"]) context[`(main)/${s}/_layout`] = require(`@/app/(main)/${s}/_layout`);
for (const f of screenFiles) context[`(main)/${f}`] = stub(f);
const ctx = getMockContext(context as Record<string, ComponentType>);

/** Rruga e ekranit: "more/night-mode" → "/more/night-mode", "shop/[id]" → "/shop/1", "baby/index" → "/baby". */
const routeOf = (f: string) => "/" + f.replace(/\/index$/, "").replace(/\[[^\]]+\]/g, "1");
const sectionRoot = (s: string) => `/${s}`;
const inner = screenFiles.filter((f) => f.includes("/") && !f.endsWith("/index")).map(routeOf);

const where = () => store.getRouteInfo().pathname;
const step = (fn: () => void) => act(() => { fn(); jest.runOnlyPendingTimers(); });
/** Prekja e tab-it: si te layout-i (shënimi), pastaj navigimi që ruan ekranin ku kishte mbetur tab-i. */
const tapTab = (name: string) => step(() => {
  if (sectionOf(currentPath()) !== name) noteTabSwitch();
  (store.navigationRef.current as unknown as { navigate: (n: string) => void }).navigate(name);
});
const push = (p: string) => step(() => router.push(p as never));
const back = () => step(() => goBackOr("/"));
/** Android: hardwareBack(); kur kthen false, sistemi bën pop vetë. */
const androidBack = () => step(() => { if (!hardwareBack()) store.navigationRef.current?.goBack(); });
/** iPhone: rrëshqitja mbrapa, pa asnjë shënim nga app-i. */
const swipeBack = () => step(() => store.navigationRef.current?.goBack());

let root: ReactTestRenderer | null = null;
function open(start = "/baby") {
  jest.useFakeTimers();
  process.env.EXPO_ROUTER_IMPORT_MODE = "sync";
  resetHistory();
  act(() => { root = create(<ExpoRoot context={ctx} location={start} />); });
  jest.runOnlyPendingTimers();
}
afterEach(() => { act(() => root?.unmount()); root = null; jest.useRealTimers(); });

const BACKS = { "butoni mbrapa": back, "butoni i Android-it": androidBack, "rrëshqitja e iPhone-it": swipeBack } as const;

it("u gjetën ekranet e app-it", () => {
  expect(inner.length).toBeGreaterThan(30);
  expect(inner).toContain("/more/night-mode");
});

describe.each(Object.entries(BACKS))("%s", (_name, goBack) => {
  const tabInner = inner.filter((p) => TABS.includes(sectionOf(p) ?? ""));

  it.each(tabInner)("%s: hapur nga rrënja e tab-it → mbrapa te rrënja", (page) => {
    open();
    const s = sectionOf(page)!;
    tapTab(s);
    push(page);
    expect(where()).toBe(page);
    goBack();
    expect(where()).toBe(sectionRoot(s));
  });

  it.each(tabInner)("%s: pas ndërrimit të tab-it dhe kthimit → mbrapa mbetet brenda tab-it", (page) => {
    open();
    const s = sectionOf(page)!;
    tapTab(s);
    push(page);
    tapTab(s === "shop" ? "community" : "shop");
    tapTab(s);
    expect(where()).toBe(page);
    goBack();
    expect(where()).toBe(sectionRoot(s));
  });
});

describe("hyrja nga një pjesë tjetër", () => {
  it.each([["butoni mbrapa", back], ["butoni i Android-it", androidBack]] as const)(
    "%s: Më shumë → Porositë e mia → mbrapa = Më shumë, edhe pas ndërrimit të tab-it",
    (_n, goBack) => {
      open();
      tapTab("more");
      push("/shop/orders");
      goBack();
      expect(where()).toBe("/more");

      push("/shop/orders");
      tapTab("baby");
      tapTab("shop");
      expect(where()).toBe("/shop/orders");
      goBack();
      expect(where()).toBe("/more");
    }
  );

  it("njoftimet → vaksinat → mbrapa = njoftimet → mbrapa = Home (pa rreth)", () => {
    open();
    push("/notifications");
    push("/baby/vaccinations");
    back();
    expect(where()).toBe("/notifications");
    back();
    expect(where()).toBe("/baby");
  });

  it("Home → Cilësimet e bebit → mbrapa = Home", () => {
    open();
    push("/baby/settings");
    androidBack();
    expect(where()).toBe("/baby");
  });
});

describe("disa hapa brenda së njëjtës pjesë", () => {
  it.each(Object.entries(BACKS))("%s: Më shumë → Pamja → Modaliteti i natës → mbrapa → Pamja → mbrapa → Më shumë", (_n, goBack) => {
    open();
    tapTab("more");
    push("/more/appearance");
    push("/more/night-mode");
    goBack();
    expect(where()).toBe("/more/appearance");
    goBack();
    expect(where()).toBe("/more");
  });

  it("Më shumë → Porositë → produkti → mbrapa (iPhone) → Porositë → mbrapa = Më shumë", () => {
    open();
    tapTab("more");
    push("/shop/orders");
    push("/shop/1");
    swipeBack();
    expect(where()).toBe("/shop/orders");
    back();
    expect(where()).toBe("/more");
  });
});

/** Si te Cilësimet: faqja e një pjese tjetër hapet me faqen kryesore të saj poshtë (withAnchor). */
const pushAnchored = (p: string) => step(() => router.push(p as never, { withAnchor: true }));

describe("Cilësimet → Porositë → mbrapa → Produktet e ruajtura → mbrapa (gabimi i 15 tetorit)", () => {
  it.each([["butoni mbrapa", back], ["butoni i Android-it", androidBack]] as const)("%s: kthehet te Cilësimet, jo te Porositë", (_n, goBack) => {
    open();
    tapTab("more");
    pushAnchored("/shop/orders");
    goBack();
    expect(where()).toBe("/more");
    pushAnchored("/shop/wishlist");
    goBack();
    expect(where()).toBe("/more");
    // Faqet e hapura nga Cilësimet s'mbeten në stivën e Dyqanit: tab-i Dyqani hapet te fillimi i tij.
    tapTab("shop");
    expect(where()).toBe("/shop");
  });
});
