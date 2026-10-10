import { elapsedSeconds, finishTimer, formatElapsed, parseTimer, startTimer, suggestedSide, switchSide } from "@/lib/baby/breastTimer";

jest.mock("@react-native-async-storage/async-storage", () => ({ getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() }));

const T0 = new Date("2026-10-10T08:00:00Z");
const after = (sec: number) => new Date(T0.getTime() + sec * 1000);

describe("timeri i gjidhënies", () => {
  it("numëron kohën dhe e shfaq si mm:ss / h:mm:ss", () => {
    const timer = startTimer("left", T0);
    expect(elapsedSeconds(timer, after(125))).toBe(125);
    expect(formatElapsed(125)).toBe("02:05");
    expect(formatElapsed(3725)).toBe("1:02:05");
    expect(elapsedSeconds(timer, after(-10))).toBe(0);
  });

  it("ndalimi krijon shënimin me kohën e nisjes dhe kohëzgjatjen në minuta", () => {
    const done = finishTimer(startTimer("right", T0), after(12 * 60 + 40));
    expect(done).toEqual({ at: T0.toISOString(), durationMin: 13, side: "right" });
  });

  it("seancë shumë e shkurtër: pa kohëzgjatje (jo 0 min); gjysmë minute = 1 min", () => {
    expect(finishTimer(startTimer("left", T0), after(10)).durationMin).toBeNull();
    expect(finishTimer(startTimer("left", T0), after(31)).durationMin).toBe(1);
  });

  it("ndërrimi i gjirit gjatë ushqyerjes ruhet si 'të dyja'", () => {
    let timer = startTimer("left", T0);
    timer = switchSide(timer, "right");
    expect(timer.side).toBe("right");
    expect(finishTimer(timer, after(600)).side).toBe("both");
    // kthimi te i njëjti gji s'e dyfishon
    expect(switchSide(startTimer("left", T0), "left").sides).toEqual(["left"]);
  });

  it("timeri i ruajtur lexohet; i prishur, i harruar (>6 orë) ose në të ardhmen hidhet", () => {
    const ok = JSON.stringify(startTimer("left", T0));
    expect(parseTimer(ok, after(60))?.side).toBe("left");
    expect(parseTimer(ok, after(7 * 3600))).toBeNull();
    expect(parseTimer(JSON.stringify(startTimer("left", after(3600))), T0)).toBeNull();
    expect(parseTimer("{prishur", T0)).toBeNull();
    expect(parseTimer(JSON.stringify({ startedAt: T0.toISOString(), side: "lart" }), T0)).toBeNull();
    expect(parseTimer(null, T0)).toBeNull();
  });

  it("gjiri i sugjeruar është tjetri nga i fundit", () => {
    expect(suggestedSide("left")).toBe("right");
    expect(suggestedSide("right")).toBe("left");
    expect(suggestedSide(null)).toBe("left");
    expect(suggestedSide("both")).toBe("left");
  });
});
