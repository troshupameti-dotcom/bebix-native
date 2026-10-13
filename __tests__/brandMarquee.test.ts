/**
 * Shiriti i markave lëviz vetë (requestAnimationFrame + scrollTo) VETËM kur shihet: Dyqani në fokus dhe
 * app-i në plan të parë. Më parë cikli vazhdonte 60 herë në sekondë edhe te skedat e tjera dhe në sfond.
 */
import { createElement } from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { AppState } from "react-native";
import { BrandMarquee } from "@/components/shop/BrandMarquee";
import type { Brand } from "@/lib/homeContent";

let mockFocused = true;
jest.mock("expo-router", () => ({ useIsFocused: () => mockFocused }));
jest.mock("@/components/ui/Icon", () => ({ Icon: () => null }));

const brands = Array.from({ length: 6 }, (_, i) => ({ id: `b${i}`, name: `Marka ${i}`, logoUrl: null, icon: "shop" }) as unknown as Brand);

/** Te mock-u i jest-expo, currentState është getter: e zëvendësojmë drejtpërdrejt. */
const setAppState = (v: string) => Object.defineProperty(AppState, "currentState", { value: v, configurable: true, writable: true });

let frames: FrameRequestCallback[] = [];
beforeEach(() => {
  frames = [];
  jest.spyOn(globalThis, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
    frames.push(cb);
    return frames.length;
  });
  jest.spyOn(globalThis, "cancelAnimationFrame").mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

/** Ekzekuton kornizat në pritje disa herë dhe kthen sa korniza të reja u kërkuan. */
function pump(rounds: number): number {
  let scheduled = 0;
  for (let i = 0; i < rounds; i++) {
    const batch = frames;
    frames = [];
    act(() => batch.forEach((cb) => cb(0)));
    scheduled += frames.length;
  }
  return scheduled;
}

function mount(): ReactTestRenderer {
  let r!: ReactTestRenderer;
  act(() => {
    r = create(createElement(BrandMarquee, { brands, color: "#000", onOpen: () => {} }));
  });
  return r;
}

describe("shiriti i markave", () => {
  it("lëviz kur Dyqani shihet", () => {
    mockFocused = true;
    setAppState("active");
    const r = mount();
    expect(pump(5)).toBeGreaterThanOrEqual(5); // cikli vazhdon kornizë pas kornize
    act(() => r.unmount());
  });

  it("s'lëviz kur skeda tjetër është në fokus", () => {
    mockFocused = false;
    setAppState("active");
    const r = mount();
    expect(pump(5)).toBe(0); // vetëm pozicionimi fillestar, asnjë cikël
    act(() => r.unmount());
  });

  it("s'lëviz kur app-i është në sfond", () => {
    mockFocused = true;
    setAppState("background");
    const r = mount();
    expect(pump(5)).toBe(0);
    act(() => r.unmount());
  });
});
