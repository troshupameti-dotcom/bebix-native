/* eslint-disable @typescript-eslint/no-require-imports -- fabrika e jest.mock ekzekutohet para importeve */
/**
 * Shiriti i markave lëviz vetë te thread-i i ndërfaqes (Reanimated useFrameCallback + scrollTo), VETËM kur
 * shihet: Dyqani në fokus dhe app-i në plan të parë. Më parë lëvizja ecte nga JavaScript-i (requestAnimationFrame)
 * dhe ngecte kur prindi e zvarriste; edhe më parë vazhdonte edhe te skedat e tjera dhe në sfond.
 */
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { AppState } from "react-native";
import { BrandMarquee } from "@/components/shop/BrandMarquee";
import type { Brand } from "@/lib/homeContent";

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("@/components/ui/Icon", () => ({ Icon: () => null }));
jest.mock("react-native-worklets", () => require("react-native-worklets/src/mock"));

/** Gjendja e ciklit të kornizave të Reanimated-it (mock-u zyrtar s'e ka useFrameCallback). */
const mockFrame = { active: false, created: 0 };
jest.mock("react-native-reanimated", () => {
  const mock = require("react-native-reanimated/mock");
  return {
    ...mock,
    useFrameCallback: (_cb: unknown, autostart = true) => {
      mockFrame.created += 1;
      mockFrame.active = autostart;
      return { setActive: (v: boolean) => (mockFrame.active = v), isActive: autostart, callbackId: 1 };
    },
  };
});

const many = Array.from({ length: 6 }, (_, i) => ({ id: `b${i}`, name: `Marka ${i}`, logoUrl: null, icon: "shop" }) as unknown as Brand);

/** Te mock-u i jest-expo, currentState është getter: e zëvendësojmë drejtpërdrejt. */
const setAppState = (v: string) => Object.defineProperty(AppState, "currentState", { value: v, configurable: true, writable: true });

function mount(brands = many): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(createElement(BrandMarquee, { brands, onOpen: () => {} }));
  });
  return r;
}

beforeEach(() => {
  mockFrame.active = false;
  mockFrame.created = 0;
});

describe("shiriti i markave", () => {
  it("lëviz kur Dyqani shihet, te thread-i i ndërfaqes", () => {
    mockFocused = true;
    setAppState("active");
    const r = mount();
    expect(mockFrame.created).toBeGreaterThan(0);
    expect(mockFrame.active).toBe(true);
    act(() => r.unmount());
    expect(mockFrame.active).toBe(false); // ndalet kur ekrani mbyllet
  });

  it("s'lëviz kur skeda tjetër është në fokus", () => {
    mockFocused = false;
    setAppState("active");
    const r = mount();
    expect(mockFrame.active).toBe(false);
    act(() => r.unmount());
  });

  it("s'lëviz kur app-i është në sfond", () => {
    mockFocused = true;
    setAppState("background");
    const r = mount();
    expect(mockFrame.active).toBe(false);
    act(() => r.unmount());
  });

  it("me pak marka (nën 6) rri e palëvizshme", () => {
    mockFocused = true;
    setAppState("active");
    const r = mount(many.slice(0, 3));
    expect(mockFrame.active).toBe(false);
    act(() => r.unmount());
  });
});

describe("logot në temën e errët", () => {
  const { logoForTheme } = require("@/components/shop/BrandMarquee") as typeof import("@/components/shop/BrandMarquee");
  it("logot e Bebix-it marrin versionin e errët; të tjerat mbeten si janë", () => {
    expect(logoForTheme("https://www.bebix.store/brands/wide/dr-browns.png", true)).toBe("https://www.bebix.store/brands/wide-dark/dr-browns.png");
    expect(logoForTheme("https://www.bebix.store/brands/wide/dr-browns.png", false)).toBe("https://www.bebix.store/brands/wide/dr-browns.png");
    expect(logoForTheme("https://cdn.example.com/logo.png", true)).toBe("https://cdn.example.com/logo.png");
  });
});
