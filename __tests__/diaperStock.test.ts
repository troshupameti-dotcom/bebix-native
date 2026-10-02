import { estimateDiaperStock } from "@/lib/baby/diaperStock";

jest.mock("@react-native-async-storage/async-storage", () => ({ __esModule: true, default: { getItem: jest.fn(), setItem: jest.fn() } }));

const NOW = new Date("2026-10-10T12:00:00Z").getTime();
const ago = (hours: number) => new Date(NOW - hours * 3_600_000).toISOString();

describe("estimateDiaperStock", () => {
  it("heq nga stoku vetëm pelenat e shënuara pas vendosjes", () => {
    const stock = { remaining: 30, setAt: ago(24) };
    const entries = [{ at: ago(30) }, { at: ago(10) }, { at: ago(5) }, { at: ago(1) }];
    expect(estimateDiaperStock(stock, entries, NOW).left).toBe(27);
  });

  it("nuk del kurrë nën zero", () => {
    expect(estimateDiaperStock({ remaining: 1, setAt: ago(48) }, [{ at: ago(5) }, { at: ago(4) }, { at: ago(3) }], NOW).left).toBe(0);
  });

  it("llogarit ditët e mbetura nga mesatarja e 3 ditëve të fundit", () => {
    const stock = { remaining: 40, setAt: ago(100) };
    const entries = Array.from({ length: 24 }, (_, i) => ({ at: ago(1 + i * 2.5) })); // 24 në ~60 orë
    const e = estimateDiaperStock(stock, entries, NOW);
    expect(e.perDay).toBeCloseTo(8, 5);
    expect(e.left).toBe(16);
    expect(e.daysLeft).toBeCloseTo(2, 5);
    expect(e.low).toBe(true);
  });

  it("nuk është 'low' kur ka plot pelena dhe ditë", () => {
    const stock = { remaining: 80, setAt: ago(1) };
    const entries = [{ at: ago(10) }, { at: ago(20) }, { at: ago(30) }, { at: ago(40) }, { at: ago(50) }, { at: ago(60) }];
    const e = estimateDiaperStock(stock, entries, NOW);
    expect(e.low).toBe(false);
    expect(e.daysLeft).toBeGreaterThan(10);
  });

  it("pa ditar të fundit, 'low' vlen vetëm nga numri i pelenave", () => {
    expect(estimateDiaperStock({ remaining: 20, setAt: ago(1) }, [], NOW)).toEqual({ left: 20, perDay: null, daysLeft: null, low: false });
    expect(estimateDiaperStock({ remaining: 5, setAt: ago(1) }, [], NOW).low).toBe(true);
  });
});
