/**
 * Ekranet që ndryshojnë më shpesh (Home, Dyqani, Arkëtimi, Komuniteti), të hapura me provider-at e vërtetë,
 * pa rrjet dhe pa të dhëna: s'duhet të rrëzohen, duhet të tregojnë rrugëdalje, dhe kërkesat e përdoruesit
 * për renditjen e faqeve mbeten ashtu siç u kërkuan.
 */
import { act } from "react-test-renderer";
import { button, renderScreen, visibleText } from "./helpers/screen";
import BabyHome from "@/app/(main)/baby/index";
import Shop from "@/app/(main)/shop/index";
import Checkout from "@/app/(main)/shop/checkout";
import Community from "@/app/(main)/community/index";
import { MemoriesCard } from "@/components/baby/MemoriesCard";
import { NowCard } from "@/components/baby/NowCard";
import { WeeklyRecapCard } from "@/components/baby/WeeklyRecapCard";
import { TeamCard } from "@/components/baby/TeamCard";
import { ShopSuggestionCard } from "@/components/shop/ShopSuggestionCard";
import { PostpartumCard } from "@/components/parent/PostpartumCard";
import { NightMode } from "@/components/baby/NightMode";

describe("Home", () => {
  // Natën (22:00–06:00) Home-i shfaqet si modaliteti i natës: testi s'duhet të varet nga ora kur nis.
  // Vetëm ora (Date) fiksohet në mesditë; kohëmatësit mbeten të vërtetë.
  beforeEach(() => {
    jest.useFakeTimers({
      now: new Date(2026, 9, 14, 12, 0),
      doNotFake: ["hrtime", "nextTick", "performance", "queueMicrotask", "requestAnimationFrame", "cancelAnimationFrame",
        "requestIdleCallback", "cancelIdleCallback", "setImmediate", "clearImmediate", "setInterval", "clearInterval", "setTimeout", "clearTimeout"],
    });
  });
  afterEach(() => jest.useRealTimers());

  it("hapet pa rrjet dhe pa të dhëna", async () => {
    const r = await renderScreen(<BabyHome />);
    expect(visibleText(r.root)).toContain("Rritja");
  });

  it("pa “Si je sot?” dhe pa “Këtë javë”; Kujtimet mbeten në fund (kërkesat e 12 dhe 15 tetorit)", async () => {
    const r = await renderScreen(<BabyHome />);
    const text = visibleText(r.root);
    expect(text.filter((s) => /Si je sot|Këtë javë:/.test(s))).toEqual([]);
    const cards = [NowCard, WeeklyRecapCard, TeamCard, ShopSuggestionCard, PostpartumCard, MemoriesCard];
    const order = r.root.findAll((n) => cards.includes(n.type as never)).map((n) => (n.type as { name: string }).name);
    expect(order[order.length - 1]).toBe("MemoriesCard");
  });

  it("modaliteti i natës: pa emoji (kërkesa e 12 tetorit)", async () => {
    const r = await renderScreen(<NightMode />);
    const text = visibleText(r.root);
    expect(text.length).toBeGreaterThan(5); // ekrani u shfaq vërtet
    expect(text.filter((s) => /\p{Extended_Pictographic}/u.test(s))).toEqual([]);
  });
});

describe("Dyqani", () => {
  it("pa rrjet: thotë që produktet s'u ngarkuan dhe “Provo përsëri” s'e rrëzon", async () => {
    const r = await renderScreen(<Shop />);
    expect(visibleText(r.root)).toContain("Nuk u ngarkuan produktet.");
    await act(async () => { button(r.root, "Provo përsëri").props.onPress(); });
    expect(visibleText(r.root)).toContain("Dyqani");
  });
});

describe("Arkëtimi", () => {
  it("me shportë bosh: totali 0 dhe porosia s'konfirmohet", async () => {
    const r = await renderScreen(<Checkout />);
    expect(visibleText(r.root)).toContain("€0.00");
    expect(button(r.root, "Konfirmo Porosinë").props.disabled).toBe(true);
  });
});

describe("Komuniteti", () => {
  it("pa rrjet: mesazh i qartë dhe “Provo përsëri”", async () => {
    const r = await renderScreen(<Community />);
    const text = visibleText(r.root);
    expect(text).toContain("Komuniteti nuk u hap");
    await act(async () => { button(r.root, "Provo përsëri").props.onPress(); });
  });

  it("kërkimi rri nën titull, para skedave (kërkesa e 12 tetorit)", async () => {
    const r = await renderScreen(<Community />);
    const text = visibleText(r.root);
    const title = text.indexOf("Komuniteti");
    const search = text.findIndex((s) => s.startsWith("⌨"));
    expect(title).toBeGreaterThanOrEqual(0);
    expect(search).toBeGreaterThan(title);
    expect(search).toBeLessThan(text.indexOf("Për ty"));
  });
});
