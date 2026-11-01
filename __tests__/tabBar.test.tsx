/**
 * Shiriti poshtë (components/ui/TabBar.tsx): ikona e prekur mbushet nga qendra, kërcen dhe merr një pikë.
 * Këtu provohet sjellja: radha e skedave, skeda e zgjedhur për lexuesin e ekranit, dhe që prekja kalon nga
 * ngjarja `tabPress` (mbrojtja e mysafirit te layout-i mund ta ndalë).
 */
import { renderScreen, visibleText } from "./helpers/screen";
import { act, type ReactTestInstance } from "react-test-renderer";
import { TabBar, type TabGlyph } from "@/components/ui/TabBar";

const ITEMS: { name: string; icon: TabGlyph }[] = [
  { name: "baby", icon: "baby" },
  { name: "shop", icon: "shop" },
  { name: "ai-chat", icon: "sparkle" },
  { name: "community", icon: "community" },
  { name: "more", icon: "settings" },
];
const TITLES: Record<string, string> = { baby: "Bebi", shop: "Dyqani", "ai-chat": "AI", community: "Komuniteti", more: "Më shumë", notifications: "Njoftimet" };
const COLORS = { background: "#FFFFFF", border: "#EEEEEE", active: "#111111", inactive: "#999999" };

function setup(focus: string, prevent = false) {
  // Njoftimet janë skedë pa buton: s'duhet të dalin në shirit.
  const names = ["baby", "shop", "ai-chat", "community", "more", "notifications"];
  const routes = names.map((name) => ({ key: `${name}-key`, name }));
  const descriptors = Object.fromEntries(routes.map((r) => [r.key, { options: { title: TITLES[r.name] } }]));
  const emitter = { emit: jest.fn(() => ({ defaultPrevented: prevent })) };
  const navigateToTab = jest.fn();
  const props = {
    state: { index: names.indexOf(focus), routes },
    descriptors,
    emitter,
    navigateToTab,
    insets: { top: 0, bottom: 34, left: 0, right: 0 },
    items: ITEMS,
    colors: COLORS,
  } as unknown as Parameters<typeof TabBar>[0];
  return { props, emitter, navigateToTab };
}

const tabs = (root: ReactTestInstance) =>
  root.findAll((n) => typeof n.props.onPress === "function" && n.props.accessibilityState !== undefined && typeof n.type !== "string");
const tab = (root: ReactTestInstance, label: string) => tabs(root).find((n) => n.props.accessibilityLabel === label)!;

describe("shiriti poshtë", () => {
  it("pesë skeda me radhë, pa njoftimet; e zgjedhura shënohet për lexuesin e ekranit", async () => {
    const { props } = setup("shop");
    const r = await renderScreen(<TabBar {...props} />);
    expect(tabs(r.root).map((n) => n.props.accessibilityLabel)).toEqual(["Bebi", "Dyqani", "AI", "Komuniteti", "Më shumë"]);
    expect(visibleText(r.root)).not.toContain("Njoftimet");
    expect(tab(r.root, "Dyqani").props.accessibilityState).toEqual({ selected: true });
    expect(tab(r.root, "Bebi").props.accessibilityState).toEqual({ selected: false });
    expect(r.root.findAll((n) => n.props.accessibilityRole === "tablist")).not.toHaveLength(0);
  });

  it("prekja e një skede tjetër: ngjarja tabPress, pastaj ndërrimi", async () => {
    const { props, emitter, navigateToTab } = setup("baby");
    const r = await renderScreen(<TabBar {...props} />);
    await act(async () => tab(r.root, "Komuniteti").props.onPress());
    expect(emitter.emit).toHaveBeenCalledWith({ type: "tabPress", target: "community-key", canPreventDefault: true });
    expect(navigateToTab).toHaveBeenCalledWith("community-key");
  });

  it("kur layout-i e ndalon (mysafiri pa llogari), skeda s'ndërrohet", async () => {
    const { props, navigateToTab } = setup("shop", true);
    const r = await renderScreen(<TabBar {...props} />);
    await act(async () => tab(r.root, "Bebi").props.onPress());
    expect(navigateToTab).not.toHaveBeenCalled();
  });

  it("prekja e skedës aktive s'e rihap (ngjarja shkon, që lista të kthehet në krye)", async () => {
    const { props, emitter, navigateToTab } = setup("more");
    const r = await renderScreen(<TabBar {...props} />);
    await act(async () => tab(r.root, "Më shumë").props.onPress());
    expect(emitter.emit).toHaveBeenCalledTimes(1);
    expect(navigateToTab).not.toHaveBeenCalled();
  });

  it("ndërrimi i skedës e rivizaton shiritin pa gabim (animacioni i mbushjes)", async () => {
    const first = setup("baby");
    const r = await renderScreen(<TabBar {...first.props} />);
    const next = setup("shop");
    await act(async () => r.update(<TabBar {...next.props} />));
    expect(tab(r.root, "Dyqani").props.accessibilityState).toEqual({ selected: true });
    expect(tab(r.root, "Bebi").props.accessibilityState).toEqual({ selected: false });
  });
});
